"""Tests for the server-side generation endpoints (cover letter/essay, interview).

Gemini calls are mocked — these tests never hit the network or spend quota.
"""
from __future__ import annotations

import json
import os

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("INVITE_CODE", "test-invite")
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-key")

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import generate, interview
from api.auth import _create_token

app = FastAPI()
app.include_router(generate.router, prefix="/api")
app.include_router(interview.router, prefix="/api")
client = TestClient(app)

AUTH_HEADERS = {"Authorization": f"Bearer {_create_token('jordan')}"}


class FakeResponse:
    def __init__(self, payload: dict):
        self.text = json.dumps(payload)


class FakeModel:
    """Stand-in for genai.GenerativeModel — records the last prompt, returns a canned payload."""

    last_prompt: str | None = None
    next_payload: dict = {}

    def __init__(self, *_a, **_kw):
        pass

    def generate_content(self, prompt: str):
        FakeModel.last_prompt = prompt
        return FakeResponse(FakeModel.next_payload)


@pytest.fixture(autouse=True)
def fake_gemini(monkeypatch):
    monkeypatch.setattr(generate.genai, "GenerativeModel", FakeModel)
    monkeypatch.setattr(interview.genai, "GenerativeModel", FakeModel)
    yield FakeModel


def test_generate_materials_requires_auth():
    r = client.post("/api/generate/materials", json={"resume_text": "x" * 30, "job_description": "y" * 60})
    assert r.status_code == 401


def test_generate_materials_returns_letter_and_essay(fake_gemini):
    fake_gemini.next_payload = {
        "cover_letter": "Dear Acme, ...",
        "essay_answer": "I want to work here because ...",
        "key_points_used": ["Python", "led a team of 3"],
    }
    r = client.post(
        "/api/generate/materials",
        json={
            "resume_text": "Experienced Python developer. " * 3,
            "job_description": "We need a software engineering intern with Python skills. " * 3,
            "company_name": "Acme",
            "essay_question": "Why Acme?",
        },
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["cover_letter"] == "Dear Acme, ..."
    assert "Python" in body["key_points_used"]
    assert "Acme" in fake_gemini.last_prompt


def test_generate_materials_rejects_short_resume():
    r = client.post(
        "/api/generate/materials",
        json={"resume_text": "short", "job_description": "y" * 60},
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 422


def test_interview_turn_start_has_no_user_message_in_prompt(fake_gemini):
    fake_gemini.next_payload = {"turns": [{"speaker": "Interviewer", "text": "Tell me about yourself."}]}
    r = client.post(
        "/api/interview/turn",
        json={"mode": "behavioral", "resume_text": "", "job_description": "", "history": []},
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 200
    turns = r.json()["turns"]
    assert turns == [{"role": "model", "text": "Tell me about yourself.", "speaker": "Interviewer"}]
    assert "Open the session now" in fake_gemini.last_prompt


def test_interview_turn_continue_includes_user_message_in_transcript(fake_gemini):
    fake_gemini.next_payload = {"turns": [{"speaker": "Interviewer", "text": "Good, tell me more."}]}
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
    assert "Candidate: Python, because of its readability." in fake_gemini.last_prompt


def test_interview_turn_group_discussion_can_return_multiple_speakers(fake_gemini):
    fake_gemini.next_payload = {
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


def test_interview_feedback(fake_gemini):
    fake_gemini.next_payload = {
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


def test_interview_feedback_requires_auth():
    r = client.post("/api/interview/feedback", json={"mode": "behavioral", "job_description": "", "history": []})
    assert r.status_code == 401
