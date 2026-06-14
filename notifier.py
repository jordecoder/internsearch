from __future__ import annotations

import html
import os

import requests

from display_utils import display_company, display_source, display_title, posted_date
from job_model import Job
from scoring import Score


def _escape(value: str) -> str:
    return html.escape(value or "", quote=True)


def format_job_message(job: Job, score: Score) -> str:
    posted = posted_date(job.posted_at)
    title = _escape(display_title(job.title))
    company = _escape(display_company(job.company))
    location = _escape(job.location)
    source = _escape(display_source(job.source))
    url = _escape(job.url)
    timeline = _escape(score.timeline_match)

    return (
        "🚨 <b>New Internship Match</b>\n\n"
        f"<b><a href=\"{url}\">{title}</a></b>\n"
        f"<b>Company</b>: {company}\n"
        f"<b>Location</b>: {location}\n"
        f"<b>Source</b>: {source}\n"
        f"<b>Posted Time</b>: {posted}\n"
        f"<b>Relevance Score</b>: {score.overall}/100\n"
        f"<b>Timeline Match</b>: {timeline}\n\n"
        f"<a href=\"{url}\">Apply Here</a>"
    )


def format_actionable_job_message(job: Job, score: Score, resume_note: str) -> str:
    posted = posted_date(job.posted_at)
    title = _escape(display_title(job.title))
    company = _escape(display_company(job.company))
    location = _escape(job.location)
    source = _escape(display_source(job.source))
    url = _escape(job.url)
    timeline = _escape(score.timeline_match)
    resume = _escape(resume_note)

    return (
        "🆕 <b>New Actionable Internship Posting</b>\n\n"
        f"<b><a href=\"{url}\">{title}</a></b>\n"
        f"<b>Company</b>: {company}\n"
        f"<b>Location</b>: {location}\n"
        f"<b>Source</b>: {source}\n"
        f"<b>Posted Time</b>: {posted}\n"
        f"<b>Relevance Score</b>: {score.overall}/100\n"
        f"<b>Timeline Match</b>: {timeline}\n"
        f"<b>Resume Signal</b>: {resume}\n\n"
        "This passed the Singapore tech internship requirements, but missed the stricter score filter.\n\n"
        f"<a href=\"{url}\">Review Posting</a>"
    )


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


def send_telegram(job: Job, score: Score) -> None:
    send_telegram_message(format_job_message(job, score))


def send_actionable_telegram(job: Job, score: Score, resume_note: str) -> None:
    send_telegram_message(format_actionable_job_message(job, score, resume_note))


def get_telegram_updates(offset: int | None = None) -> list[dict]:
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise RuntimeError("Missing TELEGRAM_BOT_TOKEN in environment/.env")

    api_url = f"https://api.telegram.org/bot{token}/getUpdates"
    params: dict[str, object] = {
        "timeout": 0,
        "allowed_updates": '["message"]',
    }
    if offset is not None:
        params["offset"] = offset

    response = requests.get(api_url, params=params, timeout=20)
    response.raise_for_status()
    data = response.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram getUpdates failed: {data}")
    return list(data.get("result", []))
