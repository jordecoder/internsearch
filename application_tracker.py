from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from job_model import Job
from resume_matcher import ResumeMatch
from scoring import Score


FIELDNAMES = [
    "job_url",
    "company",
    "title",
    "location",
    "source",
    "score",
    "status",
    "date_found",
    "last_seen",
    "resume_coverage",
    "missing_keywords",
    "notes",
]


def update_application_tracker(
    path: str,
    job: Job,
    score: Score,
    resume_match: ResumeMatch,
    *,
    status: str = "found",
    notes: str = "",
) -> None:
    tracker_path = Path(path)
    rows = []
    if tracker_path.exists():
        with tracker_path.open("r", encoding="utf-8", newline="") as f:
            rows = list(csv.DictReader(f))

    now = datetime.now(timezone.utc).date().isoformat()
    existing = None
    for row in rows:
        if row.get("job_url") == job.url:
            existing = row
            break

    data = {
        "job_url": job.url,
        "company": job.company,
        "title": job.title,
        "location": job.location,
        "source": job.source,
        "score": str(score.overall),
        "status": status,
        "date_found": existing.get("date_found", now) if existing else now,
        "last_seen": now,
        "resume_coverage": str(resume_match.coverage_percent),
        "missing_keywords": ", ".join(resume_match.missing_keywords[:8]),
        "notes": notes,
    }

    if existing:
        existing.update(data)
    else:
        rows.append(data)

    tracker_path.parent.mkdir(parents=True, exist_ok=True)
    with tracker_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)
