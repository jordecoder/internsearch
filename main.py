from __future__ import annotations

import argparse
import html
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from dotenv import load_dotenv
import yaml

from application_tracker import update_application_tracker
from database import (
    count_jobs_since,
    count_notifications_since,
    get_metadata,
    init_db,
    mark_notified,
    record_discovery,
    set_metadata,
    top_companies_since,
    was_notified,
)
from http_client import PoliteHttpClient
from notifier import send_telegram, send_telegram_message
from resume_matcher import ResumeMatch, load_resume_profile, match_resume_to_job
from scoring import Score, is_fresh, passes_threshold, score_job
from sources.ashby import fetch_ashby_boards
from sources.careers_page import fetch_careers_pages
from sources.greenhouse import fetch_greenhouse_boards
from sources.internsg import fetch_internsg
from sources.lever import fetch_lever_companies
from sources.mycareersfuture import fetch_mycareersfuture
from sources.smartrecruiters import fetch_smartrecruiters_companies
from sources.workday import fetch_workday_sites

LOGGER = logging.getLogger(__name__)


def configure_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def load_config(path: str = "config.yaml") -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def make_client(config: dict[str, Any]) -> PoliteHttpClient:
    http = config.get("http", {})
    return PoliteHttpClient(
        user_agent=http.get("user_agent", "SGInternshipJobMonitor/1.0"),
        delay_seconds=float(http.get("rate_limit_seconds", 1.5)),
        retries=int(http.get("retries", 3)),
        timeout_seconds=int(http.get("timeout_seconds", 25)),
    )


def _fetch_source(name: str, fetcher) -> list[Any]:
    try:
        return fetcher()
    except Exception:
        LOGGER.exception("source_fetch_failed source=%s", name)
        return []


def fetch_all_jobs(config: dict[str, Any], client: PoliteHttpClient):
    all_jobs = []
    source_counts: dict[str, int] = {}
    sources = config.get("sources", {})

    internsg = sources.get("internsg", {})
    if internsg.get("enabled", False):
        jobs = _fetch_source(
            "InternSG",
            lambda: fetch_internsg(internsg.get("search_terms", []), client),
        )
        source_counts["InternSG"] = len(jobs)
        all_jobs.extend(jobs)

    greenhouse = sources.get("greenhouse", {})
    if greenhouse.get("enabled", False):
        jobs = _fetch_source(
            "Greenhouse",
            lambda: fetch_greenhouse_boards(greenhouse.get("boards", []), client),
        )
        source_counts["Greenhouse"] = len(jobs)
        all_jobs.extend(jobs)

    lever = sources.get("lever", {})
    if lever.get("enabled", False):
        jobs = _fetch_source(
            "Lever",
            lambda: fetch_lever_companies(lever.get("companies", []), client),
        )
        source_counts["Lever"] = len(jobs)
        all_jobs.extend(jobs)

    ashby = sources.get("ashby", {})
    if ashby.get("enabled", False):
        jobs = _fetch_source(
            "Ashby",
            lambda: fetch_ashby_boards(ashby.get("boards", []), client),
        )
        source_counts["Ashby"] = len(jobs)
        all_jobs.extend(jobs)

    smartrecruiters = sources.get("smartrecruiters", {})
    if smartrecruiters.get("enabled", False):
        jobs = _fetch_source(
            "SmartRecruiters",
            lambda: fetch_smartrecruiters_companies(
                smartrecruiters.get("companies", []), client
            ),
        )
        source_counts["SmartRecruiters"] = len(jobs)
        all_jobs.extend(jobs)

    workday = sources.get("workday", {})
    if workday.get("enabled", False):
        jobs = _fetch_source(
            "Workday",
            lambda: fetch_workday_sites(workday.get("sites", []), client),
        )
        source_counts["Workday"] = len(jobs)
        all_jobs.extend(jobs)

    careers_pages = sources.get("careers_pages", {})
    if careers_pages.get("enabled", False):
        jobs = _fetch_source(
            "Careers pages",
            lambda: fetch_careers_pages(careers_pages.get("pages", []), client),
        )
        source_counts["Careers pages"] = len(jobs)
        all_jobs.extend(jobs)

    mycareersfuture = sources.get("mycareersfuture", {})
    if mycareersfuture.get("enabled", False):
        jobs = _fetch_source(
            "MyCareersFuture",
            lambda: fetch_mycareersfuture(
                endpoint=mycareersfuture.get("endpoint", ""),
                search_terms=mycareersfuture.get("search_terms", []),
                client=client,
            ),
        )
        source_counts["MyCareersFuture"] = len(jobs)
        all_jobs.extend(jobs)

    unique = {job.stable_id: job for job in all_jobs}
    return list(unique.values()), source_counts


def heartbeat_due(db_path: str, interval_hours: int, now: datetime | None = None) -> bool:
    now = now or datetime.now(timezone.utc)
    last_value = get_metadata(db_path, "last_heartbeat_time")
    if not last_value:
        return True

    try:
        last_sent = datetime.fromisoformat(last_value)
    except ValueError:
        return True

    if last_sent.tzinfo is None:
        last_sent = last_sent.replace(tzinfo=timezone.utc)

    return now - last_sent >= timedelta(hours=interval_hours)


def _format_source_counts(source_counts: dict[str, int]) -> str:
    if not source_counts:
        return "Source counts: unavailable"
    lines = ["Source counts:"]
    for source, count in sorted(source_counts.items()):
        lines.append(f"- {html.escape(source)}: {count}")
    return "\n".join(lines)


def format_heartbeat_message(
    fetched: int,
    matched: int,
    sent: int,
    now: datetime,
    source_counts: dict[str, int] | None = None,
) -> str:
    timestamp = now.astimezone().strftime("%Y-%m-%d %H:%M %Z")
    return (
        "✅ <b>Internship monitor heartbeat</b>\n\n"
        f"Last run: {timestamp}\n"
        f"Fetched jobs: {fetched}\n"
        f"Passed filters: {matched}\n"
        f"Telegram job alerts sent: {sent}\n\n"
        f"{_format_source_counts(source_counts or {})}"
    )


def maybe_send_heartbeat(
    db_path: str,
    config: dict[str, Any],
    *,
    fetched: int,
    matched: int,
    sent: int,
    source_counts: dict[str, int],
) -> None:
    heartbeat = config.get("heartbeat", {})
    if not heartbeat.get("enabled", True):
        return

    interval_hours = int(heartbeat.get("interval_hours", 24))
    now = datetime.now(timezone.utc)
    if not heartbeat_due(db_path, interval_hours, now=now):
        return

    send_telegram_message(
        format_heartbeat_message(fetched, matched, sent, now, source_counts),
        disable_web_page_preview=True,
    )
    set_metadata(db_path, "last_heartbeat_time", now.isoformat())


def _format_resume_note(resume_match: ResumeMatch) -> str:
    if not resume_match.missing_keywords:
        return f"Resume coverage: {resume_match.coverage_percent}%"
    gaps = ", ".join(resume_match.missing_keywords[:5])
    return f"Resume coverage: {resume_match.coverage_percent}% | gaps: {html.escape(gaps)}"


def _referral_note(job: Any, config: dict[str, Any]) -> str:
    companies = {
        str(company).lower()
        for company in config.get("referral_priority_companies", [])
    }
    if job.company.lower() in companies:
        return "Action: seek referral before applying"
    return "Action: review and apply if fit"


def format_near_match_digest(
    items: list[tuple[Any, Score, ResumeMatch, str]],
    *,
    now: datetime,
) -> str:
    timestamp = now.astimezone().strftime("%Y-%m-%d %H:%M %Z")
    lines = [
        "📋 <b>Daily near-match internship digest</b>",
        "",
        f"Generated: {timestamp}",
        "",
    ]
    for index, (job, score, resume_match, referral_note) in enumerate(items, start=1):
        title = html.escape(job.title)
        company = html.escape(job.company)
        location = html.escape(job.location or "Unknown")
        url = html.escape(job.url, quote=True)
        lines.extend(
            [
                f"{index}. <a href=\"{url}\">{title}</a>",
                f"{company} | {location} | score {score.overall}/100",
                f"Timeline: {html.escape(score.timeline_match)}",
                _format_resume_note(resume_match),
                html.escape(referral_note),
                "",
            ]
        )
    return "\n".join(lines).strip()


def maybe_send_near_match_digest(
    db_path: str,
    config: dict[str, Any],
    items: list[tuple[Any, Score, ResumeMatch, str]],
) -> None:
    digest = config.get("near_match_digest", {})
    if not digest.get("enabled", True) or not items:
        return

    interval_hours = int(digest.get("interval_hours", 24))
    now = datetime.now(timezone.utc)
    last_key = "last_near_match_digest_time"
    last_value = get_metadata(db_path, last_key)
    if last_value:
        try:
            last_sent = datetime.fromisoformat(last_value)
            if last_sent.tzinfo is None:
                last_sent = last_sent.replace(tzinfo=timezone.utc)
            if now - last_sent < timedelta(hours=interval_hours):
                return
        except ValueError:
            pass

    max_items = int(digest.get("max_items", 10))
    send_telegram_message(
        format_near_match_digest(items[:max_items], now=now),
        disable_web_page_preview=True,
    )
    set_metadata(db_path, last_key, now.isoformat())


def format_weekly_summary(
    *,
    now: datetime,
    jobs_seen: int,
    alerts_sent: int,
    top_companies: list[tuple[str, int]],
    common_missing_keywords: list[tuple[str, int]],
) -> str:
    timestamp = now.astimezone().strftime("%Y-%m-%d %H:%M %Z")
    company_lines = "\n".join(
        f"- {html.escape(company)}: {count}" for company, count in top_companies
    ) or "- None"
    gap_lines = "\n".join(
        f"- {html.escape(keyword)}: {count}" for keyword, count in common_missing_keywords
    ) or "- None"
    return (
        "📈 <b>Weekly internship search summary</b>\n\n"
        f"Generated: {timestamp}\n"
        f"New jobs seen: {jobs_seen}\n"
        f"Strict alerts sent: {alerts_sent}\n\n"
        f"<b>Top companies</b>\n{company_lines}\n\n"
        f"<b>Common resume keyword gaps</b>\n{gap_lines}"
    )


def maybe_send_weekly_summary(
    db_path: str,
    config: dict[str, Any],
    missing_keyword_counts: dict[str, int],
) -> None:
    summary = config.get("weekly_summary", {})
    if not summary.get("enabled", True):
        return

    interval_hours = int(summary.get("interval_hours", 168))
    now = datetime.now(timezone.utc)
    last_key = "last_weekly_summary_time"
    last_value = get_metadata(db_path, last_key)
    if last_value:
        try:
            last_sent = datetime.fromisoformat(last_value)
            if last_sent.tzinfo is None:
                last_sent = last_sent.replace(tzinfo=timezone.utc)
            if now - last_sent < timedelta(hours=interval_hours):
                return
        except ValueError:
            pass

    since = (now - timedelta(days=7)).isoformat()
    common_missing = sorted(
        missing_keyword_counts.items(), key=lambda item: (-item[1], item[0])
    )[: int(summary.get("max_missing_keywords", 8))]
    send_telegram_message(
        format_weekly_summary(
            now=now,
            jobs_seen=count_jobs_since(db_path, since),
            alerts_sent=count_notifications_since(db_path, since),
            top_companies=top_companies_since(
                db_path, since, limit=int(summary.get("max_companies", 5))
            ),
            common_missing_keywords=common_missing,
        ),
        disable_web_page_preview=True,
    )
    set_metadata(db_path, last_key, now.isoformat())


def send_test_telegram_message() -> None:
    now = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M %Z")
    send_telegram_message(
        (
            "<b>Internship monitor test</b>\n\n"
            "Telegram bot is connected and GitHub Actions secrets are working.\n"
            f"Sent at: {html.escape(now)}"
        ),
        disable_web_page_preview=True,
    )


def send_status_telegram_message(status: str) -> None:
    now = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M %Z")
    send_telegram_message(
        (
            "<b>Internship monitor status</b>\n\n"
            f"Status: {html.escape(status)}\n"
            f"Time: {html.escape(now)}"
        ),
        disable_web_page_preview=True,
    )


def run_once(config: dict[str, Any]) -> int:
    db_path = config.get("database_path", "jobs.sqlite3")
    posted_within_hours = int(config.get("posted_within_hours", 24))

    init_db(db_path)
    client = make_client(config)
    jobs, source_counts = fetch_all_jobs(config, client)
    resume_profile = load_resume_profile(config.get("resume_profile_path"))
    tracked_resume_keywords = config.get("resume_match", {}).get(
        "tracked_keywords",
        config.get("target_keywords", []),
    )

    sent = 0
    matched = 0
    near_matches: list[tuple[Any, Score, ResumeMatch, str]] = []
    missing_keyword_counts: dict[str, int] = {}
    digest_config = config.get("near_match_digest", {})
    near_min_overall = int(digest_config.get("min_overall", 45))
    near_min_location = int(digest_config.get("min_location", 35))
    tracker_config = config.get("application_tracker", {})
    tracker_enabled = tracker_config.get("enabled", True)
    tracker_path = tracker_config.get("path", "applications.csv")

    for job in jobs:
        is_new = record_discovery(db_path, job)
        if was_notified(db_path, job):
            continue
        fresh = is_fresh(job, is_new=is_new, hours=posted_within_hours)
        if not fresh:
            continue

        score = score_job(job, config)
        resume_match = match_resume_to_job(job, resume_profile, tracked_resume_keywords)
        for keyword in resume_match.missing_keywords:
            missing_keyword_counts[keyword] = missing_keyword_counts.get(keyword, 0) + 1

        if not passes_threshold(score, config):
            if (
                score.overall >= near_min_overall
                and score.location_relevance >= near_min_location
            ):
                note = _referral_note(job, config)
                near_matches.append((job, score, resume_match, note))
                if tracker_enabled:
                    update_application_tracker(
                        tracker_path,
                        job,
                        score,
                        resume_match,
                        notes=note,
                    )
            LOGGER.info(
                "job_below_threshold",
                extra={
                    "title": job.title,
                    "company": job.company,
                    "score": score.overall,
                    "timeline": score.timeline_relevance,
                    "location": score.location_relevance,
                },
            )
            continue

        matched += 1
        try:
            send_telegram(job, score)
            mark_notified(db_path, job)
            if tracker_enabled:
                update_application_tracker(
                    tracker_path,
                    job,
                    score,
                    resume_match,
                    notes=_referral_note(job, config),
                )
            sent += 1
            LOGGER.info(
                "telegram_sent",
                extra={"title": job.title, "company": job.company, "url": job.url},
            )
        except Exception:
            LOGGER.exception(
                "telegram_send_failed",
                extra={"title": job.title, "company": job.company, "url": job.url},
            )

    LOGGER.info("source_counts %s", source_counts)
    LOGGER.info(
        "run_complete fetched=%s matched=%s sent=%s near_matches=%s",
        len(jobs),
        matched,
        sent,
        len(near_matches),
    )

    near_matches.sort(key=lambda item: item[1].overall, reverse=True)

    try:
        maybe_send_near_match_digest(db_path, config, near_matches)
    except Exception:
        LOGGER.exception("near_match_digest_send_failed")

    try:
        maybe_send_weekly_summary(db_path, config, missing_keyword_counts)
    except Exception:
        LOGGER.exception("weekly_summary_send_failed")

    try:
        maybe_send_heartbeat(
            db_path,
            config,
            fetched=len(jobs),
            matched=matched,
            sent=sent,
            source_counts=source_counts,
        )
    except Exception:
        LOGGER.exception("heartbeat_send_failed")

    return sent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Run one check and exit.")
    parser.add_argument(
        "--test-telegram",
        action="store_true",
        help="Send a Telegram test message and exit.",
    )
    parser.add_argument(
        "--status-message",
        help="Send a Telegram status message and exit.",
    )
    parser.add_argument("--config", default="config.yaml", help="Path to config YAML.")
    args = parser.parse_args()

    load_dotenv()
    config = load_config(args.config)
    configure_logging(config.get("log_level", "INFO"))

    if args.status_message:
        send_status_telegram_message(args.status_message)
        LOGGER.info("telegram_status_sent")
        return

    if args.test_telegram:
        send_test_telegram_message()
        LOGGER.info("telegram_test_sent")
        return

    if args.once:
        run_once(config)
        return

    interval_minutes = int(config.get("check_interval_minutes", 120))
    while True:
        run_once(config)
        time.sleep(interval_minutes * 60)


if __name__ == "__main__":
    main()
