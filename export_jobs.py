"""Export scored jobs from SQLite to docs/jobs.json for the web dashboard."""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone

import yaml

from job_model import Job
from opportunity_insights import is_exact_job_posting
from scoring import is_actionable_candidate, score_job

_DB_PATH = os.environ.get("DB_PATH", "jobs.sqlite3")
_CONFIG_PATH = os.environ.get("CONFIG_PATH", "config.yaml")
_OUTPUT_PATH = "docs/jobs.json"
_DAYS_BACK = 14


def _load_config() -> dict:
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _fetch_rows(db_path: str) -> list[dict]:
    if not os.path.exists(db_path):
        return []
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            """
            SELECT stable_id, source, title, company, location, url,
                   posted_time, first_seen_time, last_seen_time, notified_time
            FROM jobs
            WHERE first_seen_time >= datetime('now', ?)
            ORDER BY first_seen_time DESC
            LIMIT 1000
            """,
            (f"-{_DAYS_BACK} days",),
        ).fetchall()
    return [dict(r) for r in rows]


def _to_job(row: dict) -> Job:
    posted_at = None
    if row.get("posted_time"):
        try:
            posted_at = datetime.fromisoformat(row["posted_time"])
            if posted_at.tzinfo is None:
                posted_at = posted_at.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return Job(
        source=row["source"] or "",
        title=row["title"] or "",
        company=row["company"] or "",
        location=row["location"] or "",
        url=row["url"] or "",
        posted_at=posted_at,
        description="",
    )


def _passes_dashboard_filter(job: Job, score: Score, config: dict) -> bool:
    """Singapore tech intern roles only. Skips the strict score threshold but
    keeps the technical-terms and rejected-terms checks so non-tech roles
    (tourism, finance, marketing, etc.) are excluded from the dashboard."""
    filters = config.get("candidate_filters", {})
    title = (job.title or "").lower()
    location_text = (job.location or "").lower()

    if score.location_relevance < int(filters.get("min_location", 70)):
        return False

    required = filters.get("required_locations", ["singapore"])
    if required and location_text and not any(r in location_text for r in required):
        return False
    if required and not location_text and not any(
        r in f"{title} {job.company}".lower() for r in required
    ):
        return False

    if not any(t in title for t in ["intern", "internship"]):
        return False

    rejected = [str(t).lower() for t in filters.get("rejected_terms", [])]
    if any(t in title for t in rejected):
        return False

    technical_terms = [str(t).lower() for t in filters.get("technical_terms", [])]
    if technical_terms and not any(t in title for t in technical_terms):
        trusted = [str(c).lower() for c in filters.get("trusted_technical_companies", [])]
        company = (job.company or "").lower()
        if not any(t in company for t in trusted):
            return False

    return True


def main() -> None:
    config = _load_config()
    rows = _fetch_rows(_DB_PATH)

    results = []
    for row in rows:
        job = _to_job(row)
        score = score_job(job, config)
        if not _passes_dashboard_filter(job, score, config):
            continue
        if not is_exact_job_posting(job, config):
            continue
        actionable = is_actionable_candidate(job, score, config)
        results.append(
            {
                "stable_id": row["stable_id"],
                "source": row["source"],
                "title": row["title"],
                "company": row["company"],
                "location": row["location"],
                "url": row["url"],
                "posted_time": row["posted_time"],
                "first_seen_time": row["first_seen_time"],
                "last_seen_time": row["last_seen_time"],
                "notified": bool(row["notified_time"]),
                "actionable": actionable,
                "score": {
                    "overall": score.overall,
                    "role": score.role_relevance,
                    "skill": score.skill_relevance,
                    "location": score.location_relevance,
                    "timeline": score.timeline_relevance,
                    "degree": score.degree_relevance,
                    "timeline_match": score.timeline_match,
                },
            }
        )

    os.makedirs("docs", exist_ok=True)
    payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "total": len(results),
        "jobs": results,
    }
    with open(_OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))

    actionable_count = sum(1 for r in results if r["actionable"])
    print(
        f"Exported {len(results)} jobs ({actionable_count} actionable) -> {_OUTPUT_PATH}"
    )


if __name__ == "__main__":
    sys.exit(main())
