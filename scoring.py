from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from job_model import Job


@dataclass(frozen=True)
class Score:
    role_relevance: int
    skill_relevance: int
    location_relevance: int
    timeline_relevance: int
    degree_relevance: int
    overall: int
    timeline_match: str


def _text(job: Job) -> str:
    return " ".join(
        [job.title or "", job.company or "", job.location or "", job.description or ""]
    ).lower()


def _count_matches(text: str, terms: list[str]) -> int:
    count = 0
    for term in terms:
        pattern = r"\b" + re.escape(term.lower()).replace(r"\ ", r"\s+") + r"\b"
        if re.search(pattern, text):
            count += 1
    return count


def _has_any(text: str, terms: list[str]) -> bool:
    return _count_matches(text, terms) > 0


def _bounded(value: float) -> int:
    return max(0, min(100, round(value)))


def score_job(job: Job, config: dict[str, Any], *, now: datetime | None = None) -> Score:
    now = now or datetime.now(timezone.utc)
    text = _text(job)

    role_terms = config.get("role_keywords", [])
    skill_terms = config.get("target_keywords", [])
    degree_terms = config.get("degree_keywords", [])
    priority_companies = [c.lower() for c in config.get("priority_companies", [])]

    role_score = _score_role(text, role_terms)
    skill_score = _score_skills(text, skill_terms, job, priority_companies)
    location_score = _score_location(text)
    timeline_score, timeline_match = _score_timeline(text, job, now)
    degree_score = _score_degree(text, degree_terms)

    overall = _bounded(
        role_score * 0.25
        + skill_score * 0.25
        + location_score * 0.20
        + timeline_score * 0.20
        + degree_score * 0.10
    )

    return Score(
        role_relevance=role_score,
        skill_relevance=skill_score,
        location_relevance=location_score,
        timeline_relevance=timeline_score,
        degree_relevance=degree_score,
        overall=overall,
        timeline_match=timeline_match,
    )


def passes_threshold(score: Score, config: dict[str, Any]) -> bool:
    thresholds = config.get("thresholds", {})
    return (
        score.overall >= int(thresholds.get("overall", 70))
        and score.timeline_relevance >= int(thresholds.get("timeline", 80))
        and score.location_relevance >= int(thresholds.get("location", 70))
    )


def is_actionable_candidate(job: Job, score: Score, config: dict[str, Any]) -> bool:
    filters = config.get("candidate_filters", {})
    text = _text(job)
    title = (job.title or "").lower()

    if score.location_relevance < int(filters.get("min_location", 70)):
        return False

    required_locations = filters.get("required_locations", ["singapore"])
    if required_locations and not _has_any(text, required_locations):
        return False

    internship_terms = filters.get("internship_terms", ["intern", "internship"])
    if not _has_any(title, internship_terms):
        return False

    rejected_terms = filters.get("rejected_terms", [])
    if _has_any(title, rejected_terms):
        return False

    technical_terms = filters.get("technical_terms", [])
    if technical_terms and not _has_any(text, technical_terms):
        return False

    return True


def is_fresh(job: Job, *, is_new: bool, hours: int, now: datetime | None = None) -> bool:
    if job.posted_at is None:
        return is_new

    now = now or datetime.now(timezone.utc)
    posted_at = job.posted_at
    if posted_at.tzinfo is None:
        posted_at = posted_at.replace(tzinfo=timezone.utc)

    return posted_at >= now - timedelta(hours=hours)


def _score_role(text: str, role_terms: list[str]) -> int:
    if any(term in text for term in ["full-time", "full time", "permanent"]):
        return 0
    if "intern" not in text and "internship" not in text:
        return 35

    matches = _count_matches(text, role_terms)
    return _bounded(70 + min(matches, 4) * 8)


def _score_skills(
    text: str, skill_terms: list[str], job: Job, priority_companies: list[str]
) -> int:
    matches = _count_matches(text, skill_terms)
    base = min(100, matches * 12)

    if "intern" in text and any(
        term in text
        for term in [
            "data engineer",
            "data engineering",
            "machine learning",
            "generative ai",
            "llm",
            "rag",
            "analytics engineer",
            "data science",
        ]
    ):
        base += 25

    if job.company.lower() in priority_companies:
        base += 8

    return _bounded(base)


def _score_location(text: str) -> int:
    if "singapore" in text or re.search(r"\bsg\b", text):
        if "remote" in text:
            return 100
        if "hybrid" in text:
            return 95
        return 90
    if "remote" in text:
        return 65
    return 35


def _score_timeline(text: str, job: Job, now: datetime) -> tuple[int, str]:
    hard_rejects = [
        "summer 2026",
        "winter 2026",
        "immediate start",
        "immediate-start",
        "start immediately",
        "polytechnic only",
        "poly-only",
        "full-time permanent",
        "full time permanent",
    ]
    if any(term in text for term in hard_rejects):
        return 0, "Rejected timeline"

    target_terms = [
        "summer 2027",
        "fall 2027",
        "august 2027",
        "sep 2027",
        "september 2027",
        "off-cycle internship 2027",
        "off cycle internship 2027",
        "university internship",
        "undergraduate internship",
        "bachelor's degree internship",
        "bachelors degree internship",
    ]
    for term in target_terms:
        if term in text:
            return 100, term.title()

    if "2027" in text and ("intern" in text or "internship" in text):
        return 88, "2027 internship"

    if job.posted_at:
        posted_at = job.posted_at
        if posted_at.tzinfo is None:
            posted_at = posted_at.replace(tzinfo=timezone.utc)
        age_hours = (now - posted_at).total_seconds() / 3600
        if age_hours <= 6:
            return 85, "Fresh posting, timeline unspecified"
        if age_hours <= 24:
            return 80, "Recent posting, timeline unspecified"

    return 80, "Newly discovered, timeline unspecified"


def _score_degree(text: str, degree_terms: list[str]) -> int:
    if "polytechnic only" in text or "poly-only" in text:
        return 20
    matches = _count_matches(text, degree_terms)
    if matches:
        return _bounded(65 + min(matches, 4) * 10)
    if "student" in text or "intern" in text:
        return 55
    return 35
