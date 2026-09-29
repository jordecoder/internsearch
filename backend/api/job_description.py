"""Fetches a job posting's description on demand, for jobs the scraper saved
without one (every LinkedIn job — its search API returns no description).

LinkedIn has a public, no-login endpoint for a single posting; any other URL
falls back to the posting page's main text. Only called when the owner picks a
job in the UI, so it adds no load to the scheduled scraper.
"""
import ipaddress
import re
import socket
from typing import Annotated
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel

from api.auth import get_current_user, limiter

router = APIRouter()

_LINKEDIN_POSTING_URL = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
_LINKEDIN_JOB_ID = re.compile(r"(\d{8,})")
_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
_TIMEOUT = 15
_MAX_CHARS = 20_000


class JobDescriptionResponse(BaseModel):
    description: str


def _clean(text: str) -> str:
    return re.sub(r"\n{3,}", "\n\n", text).strip()[:_MAX_CHARS]


def _is_public_host(host: str) -> bool:
    """Refuse URLs that resolve to private/loopback addresses — this endpoint
    fetches arbitrary URLs server-side, so it must not reach internal services."""
    try:
        addresses = {info[4][0] for info in socket.getaddrinfo(host, None)}
    except (socket.gaierror, UnicodeError):
        return False
    return all(ipaddress.ip_address(a.split("%")[0]).is_global for a in addresses)


def _linkedin_description(job_id: str) -> str:
    resp = requests.get(_LINKEDIN_POSTING_URL.format(job_id=job_id), headers=_HEADERS, timeout=_TIMEOUT)
    resp.raise_for_status()
    markup = BeautifulSoup(resp.text, "html.parser").select_one(".show-more-less-html__markup")
    return _clean(markup.get_text("\n", strip=True)) if markup else ""


def _page_description(url: str) -> str:
    resp = requests.get(url, headers=_HEADERS, timeout=_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "header", "footer", "form", "svg"]):
        tag.decompose()
    root = soup.select_one("main, article, [role=main]") or soup.body or soup
    return _clean(root.get_text("\n", strip=True))


@router.get("/job-description", response_model=JobDescriptionResponse)
@limiter.limit("60/hour")
def job_description(
    request: Request,
    username: Annotated[str, Depends(get_current_user)],
    url: str = Query(..., min_length=10, max_length=2000),
) -> JobDescriptionResponse:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname or not _is_public_host(parsed.hostname):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Not a public job posting URL.")

    host = parsed.hostname.lower()
    linkedin_id = _LINKEDIN_JOB_ID.search(parsed.path) if host.endswith("linkedin.com") else None
    try:
        text = _linkedin_description(linkedin_id.group(1)) if linkedin_id else _page_description(url)
    except requests.RequestException as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Couldn't load the posting: {exc}")

    if len(text) < 50:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Couldn't find a description on that page.")
    return JobDescriptionResponse(description=text)
