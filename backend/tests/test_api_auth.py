"""Tests for the single-owner login — in particular that it works regardless of
the request's declared Content-Type, since the frontend deliberately omits it
(defaulting to text/plain) to avoid triggering a CORS preflight that at least
one real network mishandled even though CORS itself was configured correctly.
"""
from __future__ import annotations

import json
import os

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("OWNER_PASSWORD", "the-owner-password")

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import jwt

from api.auth import OWNER, _JWT_ALGORITHM, _JWT_SECRET, limiter, router

app = FastAPI()
app.include_router(router, prefix="/auth")
client = TestClient(app)

PASSWORD = os.environ["OWNER_PASSWORD"]


@pytest.fixture(autouse=True)
def fresh_rate_limit():
    # /auth/login allows 5 attempts a minute per client; each test starts clean.
    limiter.reset()


def _login(payload: dict, content_type: str | None = None):
    headers = {"Content-Type": content_type} if content_type else {}
    return client.post("/auth/login", content=json.dumps(payload), headers=headers)


@pytest.mark.parametrize("content_type", [None, "text/plain", "application/json"])
def test_login_with_owner_password_regardless_of_content_type(content_type):
    r = _login({"password": PASSWORD}, content_type)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["username"] == OWNER
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json() == {"username": OWNER}


def test_login_rejects_wrong_password():
    r = _login({"password": PASSWORD + "x"})
    assert r.status_code == 401


def test_login_ignores_a_stray_username_field():
    # The old frontend sent {username, password} — the password alone decides.
    assert _login({"username": "anyone", "password": PASSWORD}).status_code == 200


def test_register_no_longer_exists():
    r = client.post("/auth/register", content=json.dumps({"username": "friend", "password": "x" * 10, "invite_code": "x"}))
    assert r.status_code == 404


def test_token_for_a_non_owner_subject_is_rejected():
    # Tokens minted for the old multi-user accounts share JWT_SECRET but carry a
    # username subject — they must not grant access any more.
    old_token = jwt.encode({"sub": "some-friend"}, _JWT_SECRET, algorithm=_JWT_ALGORITHM)
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert r.status_code == 401


def test_me_requires_a_token():
    assert client.get("/auth/me").status_code == 401


def test_malformed_json_body_returns_422_not_500():
    r = client.post("/auth/login", content="not json", headers={"Content-Type": "text/plain"})
    assert r.status_code == 422


def test_login_is_rate_limited_after_five_attempts():
    for _ in range(5):
        assert _login({"password": "wrong"}).status_code == 401
    r = _login({"password": PASSWORD})
    assert r.status_code == 429  # even the right password waits out the window
