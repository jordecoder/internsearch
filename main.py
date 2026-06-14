from __future__ import annotations

import argparse
import logging
import time
from typing import Any

from dotenv import load_dotenv
import yaml

from database import init_db, mark_notified, record_discovery, was_notified
from http_client import PoliteHttpClient
from notifier import send_telegram
from scoring import is_fresh, passes_threshold, score_job
from sources.greenhouse import fetch_greenhouse_boards
from sources.internsg import fetch_internsg
from sources.lever import fetch_lever_companies
from sources.mycareersfuture import fetch_mycareersfuture

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


def fetch_all_jobs(config: dict[str, Any], client: PoliteHttpClient):
    all_jobs = []
    sources = config.get("sources", {})

    internsg = sources.get("internsg", {})
    if internsg.get("enabled", False):
        all_jobs.extend(fetch_internsg(internsg.get("search_terms", []), client))

    greenhouse = sources.get("greenhouse", {})
    if greenhouse.get("enabled", False):
        all_jobs.extend(fetch_greenhouse_boards(greenhouse.get("boards", []), client))

    lever = sources.get("lever", {})
    if lever.get("enabled", False):
        all_jobs.extend(fetch_lever_companies(lever.get("companies", []), client))

    mycareersfuture = sources.get("mycareersfuture", {})
    if mycareersfuture.get("enabled", False):
        all_jobs.extend(
            fetch_mycareersfuture(
                endpoint=mycareersfuture.get("endpoint", ""),
                search_terms=mycareersfuture.get("search_terms", []),
                client=client,
            )
        )

    unique = {job.stable_id: job for job in all_jobs}
    return list(unique.values())


def run_once(config: dict[str, Any]) -> int:
    db_path = config.get("database_path", "jobs.sqlite3")
    posted_within_hours = int(config.get("posted_within_hours", 24))

    init_db(db_path)
    client = make_client(config)
    jobs = fetch_all_jobs(config, client)

    sent = 0
    matched = 0

    for job in jobs:
        is_new = record_discovery(db_path, job)
        if was_notified(db_path, job):
            continue
        if not is_fresh(job, is_new=is_new, hours=posted_within_hours):
            continue

        score = score_job(job, config)
        if not passes_threshold(score, config):
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

    LOGGER.info(
        "run_complete",
        extra={"fetched": len(jobs), "matched": matched, "sent": sent},
    )
    return sent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Run one check and exit.")
    parser.add_argument("--config", default="config.yaml", help="Path to config YAML.")
    args = parser.parse_args()

    load_dotenv()
    config = load_config(args.config)
    configure_logging(config.get("log_level", "INFO"))

    if args.once:
        run_once(config)
        return

    interval_minutes = int(config.get("check_interval_minutes", 120))
    while True:
        run_once(config)
        time.sleep(interval_minutes * 60)


if __name__ == "__main__":
    main()
