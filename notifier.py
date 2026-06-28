from __future__ import annotations

import html
import os
from datetime import datetime, timezone

import requests

from display_utils import display_company, display_title
from job_model import Job
from scoring import Score

_SKIP_TIMELINE = {
    "newly discovered, timeline unspecified",
    "recent posting, timeline unspecified",
    "fresh posting, timeline unspecified",
}


def _escape(value: str) -> str:
    return html.escape(value or "", quote=True)


def _relative_time(posted_at: datetime | None) -> str:
    if not posted_at:
        return ""
    if posted_at.tzinfo is None:
        posted_at = posted_at.replace(tzinfo=timezone.utc)
    hours = int((datetime.now(timezone.utc) - posted_at).total_seconds() / 3600)
    if hours < 1:
        return "just now"
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days == 1:
        return "yesterday"
    if days < 14:
        return f"{days}d ago"
    return posted_at.strftime("%d %b").lstrip("0").strip()


def _source_short(source: str) -> str:
    return source.split(":")[0] if ":" in source else source


def _build_message(
    job: Job,
    score: Score,
    resume_note: str,
    *,
    near_match: bool,
) -> str:
    title = _escape(display_title(job.title))
    company = _escape(display_company(job.company))
    url = _escape(job.url)
    source = _escape(_source_short(job.source))
    time_str = _relative_time(job.posted_at)
    score_str = f"~{score.overall}" if near_match else str(score.overall)

    line1 = f'<b><a href="{url}">{title}</a></b> — {company}'

    meta = [source]
    if time_str:
        meta.append(time_str)
    meta.append(score_str)
    line2 = " · ".join(meta)

    lines = [line1, line2]

    extras = []
    timeline = (score.timeline_match or "").strip()
    if timeline and timeline.lower() not in _SKIP_TIMELINE:
        extras.append(_escape(timeline))
    if resume_note:
        extras.append(_escape(resume_note))
    if extras:
        lines.append(" · ".join(extras))

    return "\n".join(lines)


def format_job_message(job: Job, score: Score, resume_note: str = "") -> str:
    return _build_message(job, score, resume_note, near_match=False)


def format_actionable_job_message(job: Job, score: Score, resume_note: str = "") -> str:
    return _build_message(job, score, resume_note, near_match=True)


def send_telegram_message(
    message: str,
    *,
    disable_web_page_preview: bool = False,
    chat_id: str | None = None,
) -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    target_chat_id = chat_id or os.getenv("TELEGRAM_CHAT_ID")

    if not token or not target_chat_id:
        raise RuntimeError(
            "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment/.env"
        )

    api_url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": target_chat_id,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": disable_web_page_preview,
    }

    response = requests.post(api_url, json=payload, timeout=20)
    response.raise_for_status()


def send_telegram(job: Job, score: Score, resume_note: str = "") -> None:
    send_telegram_message(format_job_message(job, score, resume_note))


def send_actionable_telegram(job: Job, score: Score, resume_note: str = "") -> None:
    send_telegram_message(format_actionable_job_message(job, score, resume_note))


def get_telegram_updates(
    offset: int | None = None,
    *,
    poll_timeout_seconds: int = 0,
    request_timeout_seconds: int = 20,
) -> list[dict]:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("Missing TELEGRAM_BOT_TOKEN in environment/.env")

    api_url = f"https://api.telegram.org/bot{token}/getUpdates"
    params: dict[str, object] = {
        "timeout": poll_timeout_seconds,
        "allowed_updates": '["message"]',
    }
    if offset is not None:
        params["offset"] = offset

    response = requests.get(api_url, params=params, timeout=request_timeout_seconds)
    response.raise_for_status()
    data = response.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram getUpdates failed: {data}")
    return list(data.get("result", []))
