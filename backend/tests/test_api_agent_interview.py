"""Tests for the Claude-backed endpoints (apply agent, interview).

Claude calls are mocked — these tests never hit the network or spend credits.
"""
from __future__ import annotations

import os

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("OWNER_PASSWORD", "test-owner-password")
os.environ.setdefault("GITHUB_TOKEN", "test-github-token")

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import agent, interview
from api.auth import _create_token
from api.claude_client import ClaudeError

app = FastAPI()
app.include_router(agent.router, prefix="/api")
app.include_router(interview.router, prefix="/api")
client = TestClient(app)

AUTH_HEADERS = {"Authorization": f"Bearer {_create_token()}"}

PACK = {
    "role_title": "Data Engineering Intern",
    "required_skills": ["Python", "SQL", "Airflow"],
    "matched_skills": ["Python", "SQL"],
    "missing_skills": ["Airflow"],
    "coverage_percent": 70,
    "tailored_summary": "Python and SQL developer who builds data pipelines.",
    "prioritised_bullets": ["Built an ETL pipeline in Python"],
    "suggested_additions": ["Mention any scheduler experience"],
    "keyword_tips": "Use 'data pipeline' and 'ETL'.",
    "cover_letter": "Dear Acme team, ...",
    "essay_answer": "I want to join Acme because ...",
    "interview_focus": ["Walk through the ETL pipeline design"],
}

JD = "We need a data engineering intern comfortable with Python, SQL and Airflow. " * 2


class FakeClaude:
    """Stand-in for claude_client.structured — records the call, returns a canned payload."""

    def __init__(self):
        self.calls: list[dict] = []
        self.next_payload: dict = {}
        self.error: Exception | None = None

    def __call__(self, *, system, prompt, output, **kwargs):
        self.calls.append({"system": system, "prompt": prompt, "output": output, **kwargs})
        if self.error:
            raise self.error
        return output.model_validate(self.next_payload)

    @property
    def last(self) -> dict:
        return self.calls[-1]


@pytest.fixture(autouse=True)
def fake_claude(monkeypatch):
    fake = FakeClaude()
    monkeypatch.setattr(agent, "structured", fake)
    monkeypatch.setattr(interview, "structured", fake)
    return fake


@pytest.fixture
def board_calls(monkeypatch):
    calls: list[tuple] = []

    def fake_advance(*args):
        calls.append(args)
        return True

    monkeypatch.setattr(agent, "advance_board_entry", fake_advance)
    return calls


def _apply(data: dict, filename: str = "resume.txt", body: bytes = b"Python developer. Built an ETL pipeline."):
    return client.post(
        "/api/agent/apply",
        files={"resume": (filename, body)},
        data=data,
        headers=AUTH_HEADERS,
    )


# ── apply agent ────────────────────────────────────────────────────────────────

def test_apply_requires_auth():
    r = client.post("/api/agent/apply", files={"resume": ("r.txt", b"x")}, data={"job_description": JD})
    assert r.status_code == 401


def test_apply_with_posting_url_fetches_and_updates_board(fake_claude, board_calls):
    fake_claude.next_payload = PACK
    url = "https://jobs.example.com/acme/data-intern"
    r = _apply({"job_description": JD, "company_name": "Acme", "job_title": "Data Intern", "job_url": url})

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cover_letter"] == PACK["cover_letter"]
    assert body["interview_focus"] == PACK["interview_focus"]
    assert body["board_updated"] is True
    assert board_calls == [(url, "tailoring", "Data Intern", "Acme")]

    call = fake_claude.last
    assert [t["name"] for t in call["tools"]] == ["web_fetch"]
    assert url in call["prompt"]
    assert "Built an ETL pipeline" in call["prompt"]


def test_apply_without_url_skips_web_fetch_and_board(fake_claude, board_calls):
    fake_claude.next_payload = PACK
    r = _apply({"job_description": JD})
    assert r.status_code == 200, r.text
    assert r.json()["board_updated"] is False
    assert fake_claude.last["tools"] is None
    assert board_calls == []


def test_apply_ignores_non_http_url(fake_claude, board_calls):
    fake_claude.next_payload = PACK
    r = _apply({"job_description": JD, "job_url": "javascript:alert(1)"})
    assert r.status_code == 200
    assert fake_claude.last["tools"] is None
    assert board_calls == []


def test_apply_clamps_coverage(fake_claude, board_calls):
    fake_claude.next_payload = {**PACK, "coverage_percent": 140}
    assert _apply({"job_description": JD}).json()["coverage_percent"] == 100


def test_apply_board_failure_still_returns_pack(fake_claude, monkeypatch):
    fake_claude.next_payload = PACK

    def boom(*_args):
        raise RuntimeError("GitHub down")

    monkeypatch.setattr(agent, "advance_board_entry", boom)
    r = _apply({"job_description": JD, "job_url": "https://jobs.example.com/x"})
    assert r.status_code == 200
    assert r.json()["board_updated"] is False


def test_apply_claude_error_is_502(fake_claude, board_calls):
    fake_claude.error = ClaudeError("Claude declined this request.")
    r = _apply({"job_description": JD})
    assert r.status_code == 502
    assert r.json()["detail"] == "Claude declined this request."


def test_apply_rejects_unsupported_resume_type(fake_claude):
    r = _apply({"job_description": JD}, filename="resume.png")
    assert r.status_code == 415
    assert fake_claude.calls == []


def test_apply_rejects_short_job_description(fake_claude):
    assert _apply({"job_description": "too short"}).status_code == 422


# ── interview ──────────────────────────────────────────────────────────────────

def test_interview_turn_start_has_no_user_message_in_prompt(fake_claude):
    fake_claude.next_payload = {"turns": [{"speaker": "Interviewer", "text": "Tell me about yourself."}]}
    r = client.post(
        "/api/interview/turn",
        json={"mode": "behavioral", "resume_text": "", "job_description": "", "history": []},
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 200
    assert r.json()["turns"] == [{"role": "model", "text": "Tell me about yourself.", "speaker": "Interviewer"}]
    assert "Open the session now" in fake_claude.last["prompt"]


def test_interview_turn_continue_includes_user_message_in_transcript(fake_claude):
    fake_claude.next_payload = {"turns": [{"speaker": "Interviewer", "text": "Good, tell me more."}]}
    r = client.post(
        "/api/interview/turn",
        json={
            "mode": "technical",
            "resume_text": "",
            "job_description": "",
            "history": [{"role": "model", "text": "What's your favorite language?", "speaker": "Interviewer"}],
            "user_message": "Python, because of its readability.",
        },
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 200
    assert "Candidate: Python, because of its readability." in fake_claude.last["prompt"]


def test_interview_turn_group_discussion_can_return_multiple_speakers(fake_claude):
    fake_claude.next_payload = {
        "turns": [
            {"speaker": "Moderator", "text": "Topic: remote internships."},
            {"speaker": "Priya", "text": "I think remote saves commute time."},
        ]
    }
    r = client.post(
        "/api/interview/turn",
        json={"mode": "group_discussion", "resume_text": "", "job_description": "", "history": []},
        headers=AUTH_HEADERS,
    )
    turns = r.json()["turns"]
    assert len(turns) == 2
    assert turns[1]["speaker"] == "Priya"


def test_interview_feedback(fake_claude):
    fake_claude.next_payload = {
        "overall_impression": "Solid answers overall.",
        "strengths": ["Clear structure"],
        "improvements": ["Be more concise"],
        "sample_better_answer": "A tighter version of the answer.",
    }
    r = client.post(
        "/api/interview/feedback",
        json={
            "mode": "behavioral",
            "job_description": "",
            "history": [
                {"role": "model", "text": "Tell me about a challenge.", "speaker": "Interviewer"},
                {"role": "user", "text": "I once had a project fail and I..."},
            ],
        },
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["overall_impression"] == "Solid answers overall."
    assert body["strengths"] == ["Clear structure"]


def test_interview_claude_error_is_502(fake_claude):
    fake_claude.error = ClaudeError("Claude's answer was cut off — try again with a shorter input.")
    r = client.post(
        "/api/interview/turn",
        json={"mode": "behavioral", "resume_text": "", "job_description": "", "history": []},
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 502


def test_interview_feedback_requires_auth():
    r = client.post("/api/interview/feedback", json={"mode": "behavioral", "job_description": "", "history": []})
    assert r.status_code == 401
