from __future__ import annotations

import html
import logging
import os
from datetime import datetime, timezone

from application_tracker import read_pipeline_summary, set_job_status
from database import get_metadata, recent_jobs, search_jobs, set_metadata
from display_utils import display_company, display_source, display_title, posted_date
from notifier import get_telegram_updates, register_bot_commands, send_telegram_message
from time_utils import format_singapore_time

LOGGER = logging.getLogger(__name__)

HELP_MESSAGE = """<b>Internship monitor commands</b>

/help - Show available commands
/faq - Explain how the monitor works
/status - Show the latest saved run summary
/date &lt;job/company/title/url&gt; - Find when a job was posted or first seen
/recent - Show recently discovered jobs
/sources - Show latest source counts
/schedule - Show the GitHub Actions scrape schedule
/applied &lt;title, company, or URL&gt; - Mark a job as applied
/skip &lt;title, company, or URL&gt; - Mark a job as not interested
/pipeline - Show your application pipeline summary
"""


FAQ_MESSAGE = """<b>Internship monitor FAQ</b>

<b>How often does it scrape?</b>
Every 3 hours on a Singapore-time cadence.

<b>Why did I not receive job alerts?</b>
The bot only sends scraped jobs that pass Singapore, internship, role, and score filters. No message usually means no current exact job posting passed.

<b>Are JobStreet/FastJobs scraped?</b>
No. Dynamic job boards are kept as manual links and sent once daily at 20:00 SGT.

<b>Are commands instant?</b>
Yes, if the live bot worker is running. On GitHub Actions alone, commands are processed only when the workflow runs.
"""


SCHEDULE_MESSAGE = """<b>Schedule</b>

Scrape runs at:
02:00, 05:00, 08:00, 11:00, 14:00, 17:00, 20:00, 23:00 SGT

Manual-review links send only once daily at/after 20:00 SGT.
"""

_STATUS_ORDER = ["applied", "interviewing", "offer", "rejected", "found", "skipped"]
_STATUS_LABELS = {
    "applied": "Applied",
    "interviewing": "Interviewing",
    "offer": "Offer",
    "rejected": "Rejected",
    "found": "Found (not yet applied)",
    "skipped": "Skipped",
}


def process_telegram_commands(db_path: str, tracker_path: str = "applications.csv") -> int:
    expected_chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not expected_chat_id:
        raise RuntimeError("Missing TELEGRAM_CHAT_ID in environment/.env")

    try:
        register_bot_commands()
    except Exception:
        LOGGER.warning("register_bot_commands_failed", exc_info=True)

    last_offset = get_metadata(db_path, "telegram_last_update_offset")
    offset = int(last_offset) + 1 if last_offset and last_offset.isdigit() else None
    updates = get_telegram_updates(offset=offset)
    return process_telegram_updates(
        db_path, updates, expected_chat_id=expected_chat_id, tracker_path=tracker_path
    )


def process_telegram_updates(
    db_path: str,
    updates: list[dict],
    *,
    expected_chat_id: str,
    tracker_path: str = "applications.csv",
) -> int:
    processed = 0
    last_offset = get_metadata(db_path, "telegram_last_update_offset")
    max_update_id = int(last_offset) if last_offset and last_offset.isdigit() else None

    for update in updates:
        update_id = int(update.get("update_id", 0))
        max_update_id = max(update_id, max_update_id or update_id)
        message = update.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = str(chat.get("id", ""))
        if chat_id != str(expected_chat_id):
            continue

        text = str(message.get("text") or "").strip()
        if not text.startswith("/"):
            continue

        reply = handle_command(db_path, text, tracker_path=tracker_path)
        send_telegram_message(reply, disable_web_page_preview=True, chat_id=chat_id)
        processed += 1

    if max_update_id is not None:
        set_metadata(db_path, "telegram_last_update_offset", str(max_update_id))

    return processed


def handle_command(
    db_path: str, text: str, *, tracker_path: str = "applications.csv"
) -> str:
    command, _, arg = text.partition(" ")
    command_name = command.split("@", 1)[0].lower()
    arg = arg.strip()

    if command_name in ("/help", "/start"):
        return HELP_MESSAGE
    if command_name == "/faq":
        return FAQ_MESSAGE
    if command_name == "/schedule":
        return SCHEDULE_MESSAGE
    if command_name == "/status":
        return _format_status(db_path)
    if command_name == "/sources":
        return _format_sources(db_path)
    if command_name == "/recent":
        return _format_recent(db_path)
    if command_name == "/date":
        return _format_date_lookup(db_path, arg)
    if command_name == "/applied":
        return _handle_status_update(db_path, tracker_path, arg, "applied", "✅ Marked as applied")
    if command_name == "/skip":
        return _handle_status_update(db_path, tracker_path, arg, "skipped", "⏭ Marked as skipped")
    if command_name == "/pipeline":
        return _format_pipeline(tracker_path)
    return "Unknown command. Send /help for available commands."


def _handle_status_update(
    db_path: str, tracker_path: str, query: str, status: str, confirm_prefix: str
) -> str:
    if not query:
        return f"Usage: /{status} &lt;job title, company, or URL&gt;"

    rows = search_jobs(db_path, query, limit=5)
    if not rows:
        return f"No recorded jobs matched: {html.escape(query)}"

    if len(rows) > 1:
        lines = [
            f"Multiple jobs found for <b>{html.escape(query)}</b>. Be more specific or paste the URL:",
            "",
        ]
        for i, row in enumerate(rows, 1):
            title = html.escape(display_title(str(row.get("title") or "")))
            company = html.escape(display_company(str(row.get("company") or "")))
            url = html.escape(str(row.get("url") or ""), quote=True)
            lines.append(f'{i}. <a href="{url}">{title}</a> — {company}')
        return "\n".join(lines)

    row = rows[0]
    job_url = str(row.get("url") or "")
    title = html.escape(display_title(str(row.get("title") or "")))
    company = html.escape(display_company(str(row.get("company") or "")))
    escaped_url = html.escape(job_url, quote=True)

    updated = set_job_status(tracker_path, job_url, status)
    if updated:
        return f'{confirm_prefix}: <a href="{escaped_url}">{title}</a> — {company}'

    return (
        f"Job found in DB but not yet in your pipeline tracker:\n"
        f'<a href="{escaped_url}">{title}</a> — {company}\n'
        "It will be tracked the next time it passes your filters."
    )


def _format_pipeline(tracker_path: str) -> str:
    summary = read_pipeline_summary(tracker_path)
    if not summary:
        return "No tracked applications yet. Jobs appear here once they pass your filters."

    total = sum(len(jobs) for jobs in summary.values())
    lines = ["🗂 <b>Application Pipeline</b>", "", f"Total tracked: {total}", ""]

    for status in _STATUS_ORDER:
        jobs = summary.get(status, [])
        if not jobs:
            continue
        label = _STATUS_LABELS.get(status, status.title())
        lines.append(f"<b>{label}: {len(jobs)}</b>")
        for job in jobs[:3]:
            title = html.escape(display_title(str(job.get("title") or "")))
            company = html.escape(display_company(str(job.get("company") or "")))
            url = html.escape(str(job.get("job_url") or ""), quote=True)
            score = job.get("score", "")
            score_str = f" | {score}" if score else ""
            lines.append(f'  • <a href="{url}">{title}</a> — {company}{score_str}')
        if len(jobs) > 3:
            lines.append(f"  … and {len(jobs) - 3} more")
        lines.append("")

    while lines and lines[-1] == "":
        lines.pop()
    return "\n".join(lines)


def _format_status(db_path: str) -> str:
    last_run = get_metadata(db_path, "last_run_time") or "Unknown"
    fetched = get_metadata(db_path, "last_run_fetched") or "Unknown"
    actionable = get_metadata(db_path, "last_run_actionable") or "Unknown"
    matched = get_metadata(db_path, "last_run_matched") or "Unknown"
    sent = get_metadata(db_path, "last_run_sent") or "Unknown"
    return (
        "<b>Latest monitor status</b>\n\n"
        f"Last run: {html.escape(_format_iso_time(last_run))}\n"
        f"Fetched jobs: {html.escape(fetched)}\n"
        f"Actionable candidates: {html.escape(actionable)}\n"
        f"Strict matches: {html.escape(matched)}\n"
        f"Telegram alerts sent: {html.escape(sent)}"
    )


def _format_sources(db_path: str) -> str:
    source_counts = get_metadata(db_path, "last_run_source_counts")
    if not source_counts:
        return "No source-count data saved yet. Wait for the next monitor run."
    lines = ["<b>Latest source counts</b>", ""]
    for item in source_counts.split("|"):
        if not item:
            continue
        source, _, count = item.partition("=")
        lines.append(f"- {html.escape(display_source(source))}: {html.escape(count)}")
    return "\n".join(lines)


def _format_recent(db_path: str) -> str:
    rows = recent_jobs(db_path, limit=5)
    if not rows:
        return "No jobs have been recorded yet."
    lines = ["<b>Recently discovered jobs</b>", ""]
    for index, row in enumerate(rows, start=1):
        lines.extend(_format_job_row(index, row))
    return "\n".join(lines).strip()


def _format_date_lookup(db_path: str, query: str) -> str:
    if not query:
        return "Usage: /date <job title, company, or URL>"

    rows = search_jobs(db_path, query, limit=5)
    if not rows:
        return f"No recorded jobs matched: {html.escape(query)}"

    lines = [f"<b>Date lookup for:</b> {html.escape(query)}", ""]
    for index, row in enumerate(rows, start=1):
        lines.extend(_format_job_row(index, row))
    return "\n".join(lines).strip()


def _format_job_row(index: int, row: dict[str, str | None]) -> list[str]:
    title = html.escape(display_title(str(row.get("title") or "Unknown")))
    company = html.escape(display_company(str(row.get("company") or "Unknown")))
    location = html.escape(str(row.get("location") or "Unknown"))
    source = html.escape(display_source(str(row.get("source") or "Unknown")))
    url = html.escape(str(row.get("url") or ""), quote=True)
    posted = _format_iso_time(row.get("posted_time") or "")
    first_seen = _format_iso_time(row.get("first_seen_time") or "")
    last_seen = _format_iso_time(row.get("last_seen_time") or "")

    return [
        f'{index}. <a href="{url}">{title}</a>',
        f"{company} | {location} | {source}",
        f"Posted: {html.escape(posted)}",
        f"First seen: {html.escape(first_seen)}",
        f"Last seen: {html.escape(last_seen)}",
        "",
    ]


def _format_iso_time(value: str) -> str:
    if not value:
        return "Unknown"
    try:
        parsed = datetime.fromisoformat(value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return format_singapore_time(parsed)
    except ValueError:
        return value
