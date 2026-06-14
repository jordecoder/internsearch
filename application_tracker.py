from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

from job_model import Job
from opportunity_insights import OpportunityInsights
from resume_matcher import ResumeMatch
from scoring import Score


FIELDNAMES = [
    "job_url",
    "company",
    "title",
    "location",
    "source",
    "score",
    "priority",
    "status",
    "referral_status",
    "date_found",
    "last_seen",
    "follow_up_date",
    "opportunity_type",
    "role_family",
    "deadline",
    "resume_coverage",
    "missing_keywords",
    "next_action",
    "resume_suggestion",
    "notes",
]


def update_application_tracker(
    path: str,
    job: Job,
    score: Score,
    resume_match: ResumeMatch,
    *,
    insights: OpportunityInsights | None = None,
    status: str = "found",
    referral_status: str = "",
    follow_up_date: str = "",
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

    resolved_status = status
    if existing and status == "found" and existing.get("status") not in ("", "found", None):
        resolved_status = existing.get("status", status)

    resolved_referral_status = referral_status or (
        "needed" if insights and insights.referral_priority else ""
    )
    if existing and not referral_status and existing.get("referral_status"):
        resolved_referral_status = existing.get("referral_status", "")

    data = {
        "job_url": job.url,
        "company": job.company,
        "title": job.title,
        "location": job.location,
        "source": job.source,
        "score": str(score.overall),
        "priority": _priority_label(score.overall, insights),
        "status": resolved_status,
        "referral_status": resolved_referral_status,
        "date_found": existing.get("date_found", now) if existing else now,
        "last_seen": now,
        "follow_up_date": follow_up_date,
        "opportunity_type": insights.opportunity_type if insights else "",
        "role_family": insights.role_family if insights else "",
        "deadline": insights.deadline if insights else "",
        "resume_coverage": str(resume_match.coverage_percent),
        "missing_keywords": ", ".join(resume_match.missing_keywords[:8]),
        "next_action": insights.recommended_action if insights else "",
        "resume_suggestion": insights.resume_suggestion if insights else "",
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
        writer.writerows([{field: row.get(field, "") for field in FIELDNAMES} for row in rows])


def _priority_label(score: int, insights: OpportunityInsights | None) -> str:
    if insights and insights.referral_priority:
        return "high"
    if score >= 70:
        return "high"
    if score >= 60:
        return "medium"
    return "low"
