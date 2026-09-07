"""Tests for the pipeline board endpoints in api/tracker.py.

GitHub API calls are mocked — these tests never touch the network.
"""
from __future__ import annotations

import base64
import json
import os

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("INVITE_CODE", "test-invite")
os.environ.setdefault("GITHUB_TOKEN", "test-github-token")

import pytest

# The job-monitor CI workflow only installs backend/requirements.txt, not the
# FastAPI stack in backend/api/requirements.txt — skip cleanly there instead of
# breaking that pipeline's test step. Run with backend/api/requirements.txt
# installed (as this repo's own venv has) to actually exercise these.
pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import tracker
from api.auth import _create_token

app = FastAPI()
app.include_router(tracker.router, prefix="/api")
client = TestClient(app)

AUTH_HEADERS = {"Authorization": f"Bearer {_create_token('jordan')}"}


class FakeGitHubStore:
    """In-memory stand-in for the docs/applied.json file on GitHub."""

    def __init__(self, initial: dict | None = None):
        self.content = initial if initial is not None else {}
        self.sha = "sha-0"
        self._version = 0

    def get(self, *_a, **_kw):
        class Resp:
            status_code = 200

            def raise_for_status(_self):
                pass

            def json(_self):
                return {
                    "content": base64.b64encode(json.dumps(self.content).encode()).decode(),
                    "sha": self.sha,
                }

        return Resp()

    def put(self, *_a, **kw):
        body = kw["json"]
        assert body["sha"] == self.sha or self._version == 0 and "sha" not in body
        self.content = json.loads(base64.b64decode(body["content"]).decode())
        self._version += 1
        self.sha = f"sha-{self._version}"

        class Resp:
            status_code = 200
            text = ""

        return Resp()


@pytest.fixture(autouse=True)
def fake_github(monkeypatch):
    store = FakeGitHubStore()
    monkeypatch.setattr(tracker.requests, "get", store.get)
    monkeypatch.setattr(tracker.requests, "put", store.put)
    return store


def test_get_board_empty():
    r = client.get("/api/board", headers=AUTH_HEADERS)
    assert r.status_code == 200
    assert r.json() == {"jobs": {}, "updated_at": ""}


def test_upsert_then_get_board_entry():
    r = client.post(
        "/api/board",
        json={"url": "https://boards.greenhouse.io/acme/jobs/1", "status": "applied", "notes": "referred by Alex", "title": "SWE Intern", "company": "Acme"},
        headers=AUTH_HEADERS,
    )
    assert r.status_code == 200
    body = r.json()
    entry = body["jobs"]["https://boards.greenhouse.io/acme/jobs/1"]
    assert entry["status"] == "applied"
    assert entry["notes"] == "referred by Alex"
    assert entry["company"] == "Acme"
    assert entry["updated_at"]

    r2 = client.get("/api/board", headers=AUTH_HEADERS)
    assert r2.json()["jobs"]["https://boards.greenhouse.io/acme/jobs/1"]["title"] == "SWE Intern"


def test_upsert_preserves_title_company_when_omitted():
    url = "https://jobs.lever.co/acme/2"
    client.post("/api/board", json={"url": url, "status": "found", "title": "Data Intern", "company": "Acme"}, headers=AUTH_HEADERS)
    r = client.post("/api/board", json={"url": url, "status": "interviewing"}, headers=AUTH_HEADERS)
    entry = r.json()["jobs"][url]
    assert entry["status"] == "interviewing"
    assert entry["title"] == "Data Intern"
    assert entry["company"] == "Acme"


def test_legacy_string_status_is_upgraded_on_read(fake_github):
    fake_github.content = {"jobs": {"https://old.example.com/job": "applied"}, "updated_at": "2026-01-01T00:00:00+00:00"}
    fake_github.sha = "sha-legacy"
    r = client.get("/api/board", headers=AUTH_HEADERS)
    entry = r.json()["jobs"]["https://old.example.com/job"]
    assert entry["status"] == "applied"
    assert entry["notes"] == ""


def test_delete_board_entry():
    url = "https://boards.greenhouse.io/acme/jobs/3"
    client.post("/api/board", json={"url": url, "status": "found"}, headers=AUTH_HEADERS)
    r = client.post("/api/board/delete", json={"url": url}, headers=AUTH_HEADERS)
    assert r.status_code == 200
    assert url not in r.json()["jobs"]


def test_board_requires_auth():
    r = client.get("/api/board")
    assert r.status_code == 401
