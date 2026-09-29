"""Tests for GET /api/job-description. Network calls (DNS and HTTP) are
mocked — these tests never touch LinkedIn or any other site."""
from __future__ import annotations

import os

os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("OWNER_PASSWORD", "test-owner-password")

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

import requests
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api import job_description
from api.auth import _create_token, limiter

app = FastAPI()
app.state.limiter = limiter
app.include_router(job_description.router, prefix="/api")
client = TestClient(app)

AUTH_HEADERS = {"Authorization": f"Bearer {_create_token()}"}

LINKEDIN_URL = "https://sg.linkedin.com/jobs/view/intern-data-ai-at-capitaland-investment-cli-4472733115"
LONG_TEXT = "Build data pipelines in Python and SQL for the Data & AI team. " * 3


class FakeResponse:
    def __init__(self, text: str, status_code: int = 200):
        self.text = text
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code} error")


@pytest.fixture
def fetched(monkeypatch):
    """Record requested URLs; serve the page registered for each."""
    pages: dict[str, FakeResponse] = {}
    calls: list[str] = []

    def fake_get(url, **_kw):
        calls.append(url)
        return pages[url]

    monkeypatch.setattr(job_description.requests, "get", fake_get)
    monkeypatch.setattr(job_description, "_is_public_host", lambda host: host not in ("localhost", "internal.example"))
    limiter.reset()
    return pages, calls


def _get(url: str):
    return client.get("/api/job-description", params={"url": url}, headers=AUTH_HEADERS)


def test_requires_auth():
    assert client.get("/api/job-description", params={"url": LINKEDIN_URL}).status_code == 401


def test_linkedin_uses_public_posting_endpoint(fetched):
    pages, calls = fetched
    posting = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4472733115"
    pages[posting] = FakeResponse(f'<div class="show-more-less-html__markup"><p>{LONG_TEXT}</p><ul><li>SQL</li></ul></div>')

    r = _get(LINKEDIN_URL)

    assert r.status_code == 200, r.text
    assert calls == [posting]
    assert r.json()["description"].startswith("Build data pipelines")
    assert "SQL" in r.json()["description"]


def test_other_sites_use_main_page_text(fetched):
    pages, _ = fetched
    url = "https://boards.greenhouse.io/acme/jobs/123"
    pages[url] = FakeResponse(
        f"<html><body><nav>Menu Careers Login</nav><main><h1>Data Intern</h1><p>{LONG_TEXT}</p>"
        f"<script>var tracking = 1;</script></main><footer>© Acme</footer></body></html>"
    )

    text = _get(url).json()["description"]

    assert text.startswith("Data Intern")
    assert "Menu Careers" not in text and "tracking" not in text and "© Acme" not in text


def test_page_without_a_description_is_404(fetched):
    pages, _ = fetched
    pages["https://example.com/job/1"] = FakeResponse("<html><body><main>Sign in to view</main></body></html>")
    assert _get("https://example.com/job/1").status_code == 404


def test_upstream_error_is_502(fetched):
    pages, _ = fetched
    pages["https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4472733115"] = FakeResponse("", status_code=429)
    assert _get(LINKEDIN_URL).status_code == 502


@pytest.mark.parametrize(
    "url",
    ["ftp://example.com/job/12345", "http://localhost:8000/admin", "https://internal.example/job", "not-a-url-at-all"],
)
def test_rejects_non_public_urls(fetched, url):
    _, calls = fetched
    assert _get(url).status_code == 422
    assert calls == []


def test_is_public_host_blocks_private_addresses(monkeypatch):
    def resolve(ip):
        return lambda host, port: [(None, None, None, "", (ip, 0))]

    monkeypatch.setattr(job_description.socket, "getaddrinfo", resolve("10.0.0.5"))
    assert job_description._is_public_host("sneaky.example") is False
    monkeypatch.setattr(job_description.socket, "getaddrinfo", resolve("127.0.0.1"))
    assert job_description._is_public_host("sneaky.example") is False
    monkeypatch.setattr(job_description.socket, "getaddrinfo", resolve("93.184.216.34"))
    assert job_description._is_public_host("example.com") is True
