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
    get_metadata,
    init_db,
    mark_notified,
    record_discovery,
    set_metadata,
    was_notified,
)
from http_client import PoliteHttpClient
from notifier import send_actionable_telegram, send_telegram, send_telegram_message
from opportunity_insights import (
    OpportunityInsights,
    build_opportunity_insights,
    build_source_health,
)
from resume_matcher import ResumeMatch, load_resume_profile, match_resume_to_job
from scoring import Score, is_actionable_candidate, is_fresh, passes_threshold, score_job
from time_utils import format_singapore_time
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

    unique = {}
    for job in all_jobs:
        key = (job.url or job.stable_id).lower()
        unique[key] = job
    return list(unique.values()), source_counts


def heartbeat_due(db_path: str, interval_hours: float, now: datetime | None = None) -> bool:
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


def _format_source_health(source_health: list[str] | None) -> str:
    if not source_health:
        return ""
    lines = ["Source health:"]
    for item in source_health[:12]:
        lines.append(f"- {html.escape(item)}")
    return "\n".join(lines)


def format_heartbeat_message(
    fetched: int,
    matched: int,
    sent: int,
    now: datetime,
    source_counts: dict[str, int] | None = None,
    actionable_candidates: int | None = None,
    source_health: list[str] | None = None,
) -> str:
    timestamp = format_singapore_time(now)
    actionable_line = ""
    if actionable_candidates is not None:
        actionable_line = f"Actionable candidates: {actionable_candidates}\n"
    return (
        "✅ <b>Internship monitor heartbeat</b>\n\n"
        f"Last run: {timestamp}\n"
        f"Fetched jobs: {fetched}\n"
        f"{actionable_line}"
        f"Passed filters: {matched}\n"
        f"Telegram job alerts sent: {sent}\n\n"
        f"{_format_source_counts(source_counts or {})}"
        + (f"\n\n{_format_source_health(source_health)}" if source_health else "")
    )


def maybe_send_heartbeat(
    db_path: str,
    config: dict[str, Any],
    *,
    fetched: int,
    matched: int,
    sent: int,
    source_counts: dict[str, int],
    actionable_candidates: int | None = None,
    source_health: list[str] | None = None,
) -> None:
    heartbeat = config.get("heartbeat", {})
    if not heartbeat.get("enabled", True):
        return

    interval_hours = float(heartbeat.get("interval_hours", 24))
    now = datetime.now(timezone.utc)
    if not heartbeat_due(db_path, interval_hours, now=now):
        return

    send_telegram_message(
        format_heartbeat_message(
            fetched,
            matched,
            sent,
            now,
            source_counts,
            actionable_candidates,
            source_health,
        ),
        disable_web_page_preview=True,
    )
    set_metadata(db_path, "last_heartbeat_time", now.isoformat())


def _format_resume_note(resume_match: ResumeMatch) -> str:
    if resume_match.tracked_keywords_found == 0:
        return "Resume keyword signal: no tracked technical keywords found"
    if not resume_match.missing_keywords:
        return f"Resume coverage: {resume_match.coverage_percent}%"
    gaps = ", ".join(resume_match.missing_keywords[:5])
    return f"Resume coverage: {resume_match.coverage_percent}% | gaps: {html.escape(gaps)}"


def format_near_match_digest(
    items: list[tuple[Any, Score, ResumeMatch, OpportunityInsights]],
    *,
    now: datetime,
) -> str:
    timestamp = format_singapore_time(now)
    lines = [
        "📋 <b>Daily near-match internship digest</b>",
        "",
        f"Generated: {timestamp}",
        "",
    ]
    for index, (job, score, resume_match, insights) in enumerate(items, start=1):
        title = html.escape(job.title)
        company = html.escape(job.company)
        location = html.escape(job.location or "Unknown")
        url = html.escape(job.url, quote=True)
        lines.extend(
            [
                f"{index}. <a href=\"{url}\">{title}</a>",
                f"{company} | {location} | score {score.overall}/100",
                f"Type: {html.escape(insights.opportunity_type)} | Role: {html.escape(insights.role_family)}",
                f"Timeline: {html.escape(score.timeline_match)}",
                f"Deadline: {html.escape(insights.deadline)}",
                _format_resume_note(resume_match),
                html.escape(insights.recommended_action),
                html.escape(insights.resume_suggestion),
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

    interval_hours = float(digest.get("interval_hours", 24))
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


def format_manual_review_digest(items: list[dict[str, str]], *, now: datetime) -> str:
    timestamp = format_singapore_time(now)
    lines = [
        "🔎 <b>Manual job-source review</b>",
        "",
        f"Generated: {timestamp}",
        "",
        "These sources are useful but may block automation or render dynamically.",
        "",
    ]
    for index, item in enumerate(items, start=1):
        label = html.escape(str(item.get("label", "Manual search")))
        url = html.escape(str(item.get("url", "")), quote=True)
        note = html.escape(str(item.get("note", "")))
        if url:
            lines.append(f"{index}. <a href=\"{url}\">{label}</a>")
        else:
            lines.append(f"{index}. {label}")
        if note:
            lines.append(note)
        lines.append("")
    return "\n".join(lines).strip()


def maybe_send_manual_review_digest(db_path: str, config: dict[str, Any]) -> None:
    manual = config.get("manual_review_digest", {})
    if not manual.get("enabled", True):
        return

    items = manual.get("links", [])
    if not items:
        return

    interval_hours = float(manual.get("interval_hours", 24))
    now = datetime.now(timezone.utc)
    last_key = "last_manual_review_digest_time"
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

    max_items = int(manual.get("max_items", 10))
    send_telegram_message(
        format_manual_review_digest(items[:max_items], now=now),
        disable_web_page_preview=True,
    )
    set_metadata(db_path, last_key, now.isoformat())


def format_weekly_summary(
    *,
    now: datetime,
    fetched_postings: int,
    actionable_candidates: int,
    alerts_sent: int,
    top_companies: list[tuple[str, int]],
    common_missing_keywords: list[tuple[str, int]],
) -> str:
    timestamp = format_singapore_time(now)
    company_lines = "\n".join(
        f"- {html.escape(company)}: {count}" for company, count in top_companies
    ) or "- None"
    gap_lines = "\n".join(
        f"- {html.escape(keyword)}: {count}" for keyword, count in common_missing_keywords
    ) or "- None"
    return (
        "📈 <b>Weekly internship search summary</b>\n\n"
        f"Generated: {timestamp}\n"
        f"Fetched postings reviewed: {fetched_postings}\n"
        f"Actionable Singapore tech internships: {actionable_candidates}\n"
        f"Strict alerts sent: {alerts_sent}\n\n"
        f"<b>Top actionable companies</b>\n{company_lines}\n\n"
        f"<b>Common resume keyword gaps</b>\n{gap_lines}"
    )


def maybe_send_weekly_summary(
    db_path: str,
    config: dict[str, Any],
    *,
    fetched_postings: int,
    actionable_items: list[tuple[Any, Score, ResumeMatch, OpportunityInsights]],
    alerts_sent: int,
    missing_keyword_counts: dict[str, int],
) -> None:
    summary = config.get("weekly_summary", {})
    if not summary.get("enabled", True):
        return

    interval_hours = float(summary.get("interval_hours", 168))
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

    company_counts: dict[str, int] = {}
    for job, _, _, _ in actionable_items:
        company_counts[job.company] = company_counts.get(job.company, 0) + 1
    top_companies = sorted(
        company_counts.items(), key=lambda item: (-item[1], item[0].lower())
    )[: int(summary.get("max_companies", 5))]
    common_missing = sorted(
        missing_keyword_counts.items(), key=lambda item: (-item[1], item[0])
    )[: int(summary.get("max_missing_keywords", 8))]
    send_telegram_message(
        format_weekly_summary(
            now=now,
            fetched_postings=fetched_postings,
            actionable_candidates=len(actionable_items),
            alerts_sent=alerts_sent,
            top_companies=top_companies,
            common_missing_keywords=common_missing,
        ),
        disable_web_page_preview=True,
    )
    set_metadata(db_path, last_key, now.isoformat())


def send_test_telegram_message() -> None:
    now = format_singapore_time(datetime.now(timezone.utc))
    send_telegram_message(
        (
            "<b>Internship monitor test</b>\n\n"
            "Telegram bot is connected and GitHub Actions secrets are working.\n"
            f"Sent at: {html.escape(now)}"
        ),
        disable_web_page_preview=True,
    )


def send_status_telegram_message(status: str) -> None:
    now = format_singapore_time(datetime.now(timezone.utc))
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
    near_matches: list[tuple[Any, Score, ResumeMatch, OpportunityInsights]] = []
    actionable_items: list[tuple[Any, Score, ResumeMatch, OpportunityInsights]] = []
    missing_keyword_counts: dict[str, int] = {}
    digest_config = config.get("near_match_digest", {})
    near_min_overall = int(digest_config.get("min_overall", 45))
    near_min_location = int(digest_config.get("min_location", 35))
    actionable_alerts = config.get("new_actionable_alerts", {})
    actionable_alerts_enabled = actionable_alerts.get("enabled", True)
    actionable_alert_min_overall = int(actionable_alerts.get("min_overall", near_min_overall))
    actionable_alert_min_location = int(actionable_alerts.get("min_location", near_min_location))
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
        actionable = is_actionable_candidate(job, score, config)
        if not actionable:
            continue

        resume_match = match_resume_to_job(job, resume_profile, tracked_resume_keywords)
        for keyword in resume_match.missing_keywords:
            missing_keyword_counts[keyword] = missing_keyword_counts.get(keyword, 0) + 1
        insights = build_opportunity_insights(job, score, resume_match, config)
        resume_note = _format_resume_note(resume_match)
        actionable_items.append((job, score, resume_match, insights))
        strict_match = passes_threshold(score, config)

        should_send_actionable_alert = (
            actionable_alerts_enabled
            and is_new
            and not strict_match
            and score.overall >= actionable_alert_min_overall
            and score.location_relevance >= actionable_alert_min_location
        )
        if should_send_actionable_alert:
            try:
                send_actionable_telegram(
                    job,
                    score,
                    "\n".join(
                        [
                            resume_note,
                            f"Type: {insights.opportunity_type}",
                            f"Role family: {insights.role_family}",
                            f"Deadline: {insights.deadline}",
                            insights.recommended_action,
                        ]
                    ),
                )
                mark_notified(db_path, job)
                sent += 1
                LOGGER.info(
                    "actionable_telegram_sent",
                    extra={"title": job.title, "company": job.company, "url": job.url},
                )
            except Exception:
                LOGGER.exception(
                    "actionable_telegram_send_failed",
                    extra={"title": job.title, "company": job.company, "url": job.url},
                )

        if not strict_match:
            if (
                score.overall >= near_min_overall
                and score.location_relevance >= near_min_location
            ):
                near_matches.append((job, score, resume_match, insights))
                if tracker_enabled:
                    update_application_tracker(
                        tracker_path,
                        job,
                        score,
                        resume_match,
                        insights=insights,
                        notes=insights.recommended_action,
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
                    insights=insights,
                    notes=insights.recommended_action,
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
        maybe_send_manual_review_digest(db_path, config)
    except Exception:
        LOGGER.exception("manual_review_digest_send_failed")

    try:
        maybe_send_weekly_summary(
            db_path,
            config,
            fetched_postings=len(jobs),
            actionable_items=actionable_items,
            alerts_sent=sent,
            missing_keyword_counts=missing_keyword_counts,
        )
    except Exception:
        LOGGER.exception("weekly_summary_send_failed")

    try:
        source_health = build_source_health(source_counts, config)
        maybe_send_heartbeat(
            db_path,
            config,
            fetched=len(jobs),
            matched=matched,
            sent=sent,
            source_counts=source_counts,
            actionable_candidates=len(actionable_items),
            source_health=source_health,
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
