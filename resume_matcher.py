from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import yaml

from job_model import Job


@dataclass(frozen=True)
class ResumeMatch:
    matched_keywords: list[str]
    missing_keywords: list[str]
    coverage_percent: int


def load_resume_profile(path: str | None) -> dict[str, Any]:
    if not path:
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except FileNotFoundError:
        return {}


def _contains(text: str, term: str) -> bool:
    pattern = r"\b" + re.escape(term.lower()).replace(r"\ ", r"\s+") + r"\b"
    return bool(re.search(pattern, text))


def _job_text(job: Job) -> str:
    return " ".join(
        [job.title or "", job.company or "", job.location or "", job.description or ""]
    ).lower()


def match_resume_to_job(
    job: Job,
    resume_profile: dict[str, Any],
    tracked_keywords: list[str],
) -> ResumeMatch:
    resume_keywords = {
        str(keyword).lower()
        for keyword in resume_profile.get("strength_keywords", [])
    }
    resume_keywords.update(
        str(keyword).lower()
        for keyword in resume_profile.get("target_resume_keywords", [])
    )

    text = _job_text(job)
    relevant = []
    for keyword in tracked_keywords:
        term = str(keyword).lower()
        if _contains(text, term):
            relevant.append(term)

    matched = [term for term in relevant if term in resume_keywords]
    missing = [term for term in relevant if term not in resume_keywords]
    coverage = 100
    if relevant:
        coverage = round(len(matched) / len(relevant) * 100)

    return ResumeMatch(
        matched_keywords=matched,
        missing_keywords=missing,
        coverage_percent=coverage,
    )
