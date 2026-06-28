from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone
from typing import Annotated, Literal

import requests
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from api.auth import get_current_user

router = APIRouter()

_GITHUB_TOKEN = os.environ["GITHUB_TOKEN"]
_GITHUB_REPO = os.getenv("GITHUB_REPO", "jordecoder/internsearch")
_APPLIED_PATH = "docs/applied.json"
_GH_API = f"https://api.github.com/repos/{_GITHUB_REPO}/contents/{_APPLIED_PATH}"
_GH_HEADERS = {
    "Authorization": f"Bearer {_GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


# ── GitHub helpers ─────────────────────────────────────────────────────────────

def _read_applied() -> tuple[dict, str | None]:
    """Return (applied_dict, sha). sha is None if the file doesn't exist yet."""
    resp = requests.get(_GH_API, headers=_GH_HEADERS, timeout=10)
    if resp.status_code == 404:
        return {}, None
    resp.raise_for_status()
    data = resp.json()
    content = json.loads(base64.b64decode(data["content"]).decode())
    return content, data["sha"]


def _write_applied(payload: dict, sha: str | None, message: str) -> None:
    body: dict = {
        "message": message,
        "content": base64.b64encode(json.dumps(payload, indent=2).encode()).decode(),
    }
    if sha:
        body["sha"] = sha

    resp = requests.put(_GH_API, headers=_GH_HEADERS, json=body, timeout=15)
    if resp.status_code == 409:
        # SHA mismatch — two concurrent writes; signal caller to re-read and retry
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="conflict")
    if resp.status_code not in (200, 201):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub API error: {resp.status_code} {resp.text[:200]}",
        )


# ── schemas ────────────────────────────────────────────────────────────────────

ApplyStatus = Literal["applied", "skipped", "interviewing", "offer", "rejected"]


class MarkAppliedRequest(BaseModel):
    url: str
    job_status: ApplyStatus = "applied"


class AppliedResponse(BaseModel):
    jobs: dict[str, str]
    updated_at: str


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/applied", response_model=AppliedResponse)
def get_applied(
    username: Annotated[str, Depends(get_current_user)],
) -> AppliedResponse:
    applied, _ = _read_applied()
    return AppliedResponse(
        jobs=applied.get("jobs", {}),
        updated_at=applied.get("updated_at", ""),
    )


@router.post("/mark-applied", response_model=AppliedResponse)
def mark_applied(
    body: MarkAppliedRequest,
    username: Annotated[str, Depends(get_current_user)],
) -> AppliedResponse:
    url = str(body.url)

    # Retry up to 3 times on SHA conflict (concurrent writes from multiple friends)
    for attempt in range(3):
        applied, sha = _read_applied()
        jobs: dict = applied.get("jobs", {})
        jobs[url] = body.job_status
        now = datetime.now(timezone.utc).isoformat()
        payload = {"jobs": jobs, "updated_at": now}
        try:
            _write_applied(
                payload,
                sha,
                message=f"chore: mark {body.job_status} [{url[:60]}] [skip ci]",
            )
            return AppliedResponse(jobs=jobs, updated_at=now)
        except HTTPException as exc:
            if exc.status_code == status.HTTP_409_CONFLICT and attempt < 2:
                continue  # re-read latest SHA and retry
            raise

    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Could not save — too many concurrent updates. Please try again.",
    )
