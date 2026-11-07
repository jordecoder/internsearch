"""SIT ReadyTalent (student job portal), fed by the ReadyTalent Job Watch Chrome extension.

ReadyTalent sits behind SIT's student login, so GitHub Actions can't scrape it.
Instead the extension (running in your logged-in Chrome) reads the dashboard
every few hours and commits an *encrypted* snapshot of the open listings to
``backend/data/readytalent_inbox.json``. This source decrypts that snapshot with
the ``READYTALENT_INBOX_KEY`` secret and turns each listing into a ``Job``.

This repo is public, so listings are never committed in plain text, and
``export_jobs.py`` keeps them out of the public ``docs/jobs.json`` dashboard.

Snapshot envelope (written by the extension)::

    {"format": "readytalent-inbox", "v": 1, "alg": "AES-256-GCM",
     "iv": "<base64 12 bytes>", "ciphertext": "<base64 ciphertext+tag>"}

Decrypted payload::

    {"format": "readytalent-inbox", "v": 1, "generated_at": "<ISO 8601>",
     "jobs": [{"id", "title", "company", "close": "dd/mm/yyyy", "salary",
               "vacancies", "type", "programmes": [...]}]}

A plain-text payload (no "ciphertext" key) is also accepted, for local testing only.
"""
from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import re
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from job_model import Job
from time_utils import SINGAPORE_TZ

LOGGER = logging.getLogger(__name__)

SOURCE_NAME = "ReadyTalent"
DASHBOARD_URL = "https://readytalent2.singaporetech.edu.sg/RT-Student-Dashboard/"
KEY_ENV = "READYTALENT_INBOX_KEY"
# Must match the extension's additionalData, so a ciphertext can't be replayed
# into another context.
AAD = b"readytalent-inbox-v1"


def job_url(job_id: str) -> str:
    """Unique, stable link per listing.

    ReadyTalent's own job pages share a single URL (the portal remembers the
    selected job separately), which would collapse every listing into one under
    URL-based dedup. The ``#job=`` fragment keeps each one distinct, and the
    extension opens the matching job when you follow the link in Chrome.
    """
    return f"{DASHBOARD_URL}#job={job_id}"


def decode_key(raw: str) -> bytes:
    # Accept standard or URL-safe base64, with or without padding.
    value = (raw or "").strip().replace("-", "+").replace("_", "/")
    value += "=" * (-len(value) % 4)
    try:
        key = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError(f"{KEY_ENV} is not valid base64") from exc
    if len(key) != 32:
        raise ValueError(f"{KEY_ENV} must decode to 32 bytes (got {len(key)})")
    return key


def decrypt_inbox(envelope: dict[str, Any], key: bytes) -> dict[str, Any]:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if envelope.get("alg", "AES-256-GCM") != "AES-256-GCM":
        raise ValueError(f"unsupported inbox algorithm: {envelope.get('alg')}")
    iv = base64.b64decode(envelope["iv"])
    ciphertext = base64.b64decode(envelope["ciphertext"])
    plaintext = AESGCM(key).decrypt(iv, ciphertext, AAD)
    return json.loads(plaintext.decode("utf-8"))


def load_inbox(path: str | os.PathLike[str], *, key_env: str = KEY_ENV) -> dict[str, Any] | None:
    inbox_path = Path(path)
    if not inbox_path.exists():
        LOGGER.info("readytalent_inbox_missing path=%s", inbox_path)
        return None

    data = json.loads(inbox_path.read_text(encoding="utf-8"))
    if "ciphertext" not in data:
        if isinstance(data.get("jobs"), list):
            return data
        raise ValueError("unrecognised ReadyTalent inbox format")

    raw_key = os.environ.get(key_env, "")
    if not raw_key:
        LOGGER.warning("readytalent_key_missing env=%s — skipping ReadyTalent", key_env)
        return None
    try:
        return decrypt_inbox(data, decode_key(raw_key))
    except ImportError:
        LOGGER.warning("readytalent_cryptography_missing — pip install cryptography")
        return None
    except Exception as exc:  # wrong key, tampered file, bad base64
        LOGGER.error("readytalent_decrypt_failed error=%s", type(exc).__name__)
        return None


def _parse_close(value: Any) -> date | None:
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})", str(value or ""))
    if not match:
        return None
    day, month, year = (int(g) for g in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _parse_iso(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _employment_type(value: str) -> str:
    # ReadyTalent labels ordinary company postings "Full-time/Part-time Jobs".
    # scoring._score_role treats any "full-time" in the text as a permanent role
    # (role score 0), which would sink real internships, so relabel it.
    if re.search(r"full[\s-]?time\s*/\s*part[\s-]?time", value or "", re.I):
        return "Company job posting"
    return value or "Unspecified"


def _description(item: dict[str, Any]) -> str:
    programmes = [str(p) for p in item.get("programmes") or [] if p]
    lines = [
        "Posted on SIT ReadyTalent (SIT student job portal).",
        f"Listing type: {_employment_type(str(item.get('type') or ''))}",
    ]
    if item.get("close"):
        lines.append(f"Applications close: {item['close']}")
    if item.get("salary"):
        lines.append(f"Pay: {item['salary']}")
    if item.get("vacancies"):
        lines.append(f"Vacancies: {item['vacancies']}")
    lines.append(
        "Open to programmes: " + "; ".join(programmes) if programmes else "Open to all SIT programmes"
    )
    if item.get("description"):
        lines.append(str(item["description"]))
    return "\n".join(lines)


def fetch_readytalent(
    inbox_path: str | os.PathLike[str],
    *,
    max_age_days: int = 7,
    now: datetime | None = None,
) -> list[Job]:
    inbox = load_inbox(inbox_path)
    if not inbox:
        return []

    now = now or datetime.now(timezone.utc)
    generated_at = _parse_iso(inbox.get("generated_at"))
    if generated_at and now - generated_at > timedelta(days=max_age_days):
        # The extension only runs while Chrome is open; a stale snapshot is still
        # safe to process (dedup prevents repeat alerts) but worth flagging.
        LOGGER.warning(
            "readytalent_inbox_stale age_days=%s",
            (now - generated_at).days,
        )

    today_sg = now.astimezone(SINGAPORE_TZ).date()
    jobs: list[Job] = []
    seen_ids: set[str] = set()
    for item in inbox.get("jobs") or []:
        if not isinstance(item, dict):
            continue
        job_id = str(item.get("id") or "").strip()
        title = " ".join(str(item.get("title") or "").split())
        if not job_id or not title or job_id in seen_ids:
            continue
        closes = _parse_close(item.get("close"))
        if closes and closes < today_sg:
            continue
        seen_ids.add(job_id)
        jobs.append(
            Job(
                source=SOURCE_NAME,
                title=title,
                company=" ".join(str(item.get("company") or "").split()) or "Unknown",
                location="Singapore",
                url=job_url(job_id),
                posted_at=None,
                description=_description(item),
                metadata={
                    "readytalent_id": job_id,
                    "listing_type": str(item.get("type") or ""),
                    "closes": str(item.get("close") or ""),
                    "salary": str(item.get("salary") or ""),
                    "programmes": "; ".join(str(p) for p in item.get("programmes") or []),
                },
            )
        )

    LOGGER.info("readytalent_inbox_loaded jobs=%s", len(jobs))
    return jobs
