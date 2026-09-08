"""Tests for the register/login endpoints — in particular that they work
regardless of the request's declared Content-Type, since the frontend
deliberately omits it (defaulting to text/plain) on these two calls to avoid
triggering a CORS preflight that at least one real user's network mishandled
even though CORS itself was configured correctly.
"""
from __future__ import annotations

import json
import os
import tempfile
import uuid

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("INVITE_CODE", "the-invite-code")
# auth.py's SQLite users DB defaults to a fixed path (/tmp/internsearch_users.db)
# that persists across test runs — point it at a fresh file so this file's
# tests (which actually create accounts, unlike the other api tests that only
# mint tokens directly) don't collide with leftover state from a previous run.
os.environ["USERS_DB_PATH"] = os.path.join(tempfile.gettempdir(), f"internsearch_test_users_{uuid.uuid4().hex}.db")

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth import router

app = FastAPI()
app.include_router(router, prefix="/auth")
client = TestClient(app)


def _register(payload: dict, content_type: str | None):
    headers = {"Content-Type": content_type} if content_type else {}
    return client.post("/auth/register", content=json.dumps(payload), headers=headers)


def _login(payload: dict, content_type: str | None):
    headers = {"Content-Type": content_type} if content_type else {}
    return client.post("/auth/login", content=json.dumps(payload), headers=headers)


@pytest.mark.parametrize("content_type", ["application/json", "text/plain", None])
def test_register_and_login_work_regardless_of_content_type(content_type):
    username = f"user_{(content_type or 'none').replace('/', '_')}"
    r = _register(
        {"username": username, "password": "testpassword123", "invite_code": "the-invite-code"},
        content_type,
    )
    assert r.status_code == 201, r.text

    r2 = _login({"username": username, "password": "testpassword123"}, content_type)
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["username"] == username
    assert body["access_token"]


def test_register_rejects_wrong_invite_code():
    r = _register(
        {"username": "someone", "password": "testpassword123", "invite_code": "wrong-code"},
        "text/plain",
    )
    assert r.status_code == 403
    assert r.json()["detail"] == "Invalid invite code"


def test_register_validation_error_has_extractable_message():
    r = _register(
        {"username": "shortpwuser", "password": "short", "invite_code": "the-invite-code"},
        "text/plain",
    )
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert isinstance(detail, list)
    assert any("8 characters" in str(item.get("msg", "")) for item in detail)


def test_login_rejects_wrong_password():
    _register({"username": "wrongpassuser", "password": "correctpassword1", "invite_code": "the-invite-code"}, None)
    r = _login({"username": "wrongpassuser", "password": "incorrectpassword"}, None)
    assert r.status_code == 401


def test_register_rejects_non_json_body():
    r = client.post("/auth/register", content="not json at all {{", headers={"Content-Type": "text/plain"})
    assert r.status_code == 422
