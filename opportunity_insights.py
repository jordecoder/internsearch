from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from job_model import Job
from resume_matcher import ResumeMatch
from scoring import Score


@dataclass(frozen=True)
class OpportunityInsights:
    opportunity_type: str
    role_family: str
    deadline: str
    recommended_action: str
    resume_suggestion: str
    referral_priority: bool


ROLE_FAMILY_TERMS = {
    "AI/ML/RAG": [
        "rag",
        "llm",
        "generative ai",
        "genai",
        "machine learning",
        "deep learning",
        "ai engineer",
        "ml engineer",
        "nlp",
        "computer vision",
    ],
    "Data Engineering": [
        "data engineer",
        "data engineering",
        "data pipeline",
        "etl",
        "spark",
        "airflow",
        "dbt",
        "data platform",
        "data warehouse",
    ],
    "Data Science / Analytics": [
        "data science",
        "data scientist",
        "data analyst",
        "analytics",
        "business intelligence",
        "bi analyst",
        "experimentation",
        "dashboard",
    ],
    "Software Engineering": [
        "software engineer",
        "software engineering",
        "backend",
        "frontend",
        "full stack",
        "application developer",
        "platform engineer",
        "api",
    ],
    "Cybersecurity": [
        "cybersecurity",
        "cyber security",
        "security engineer",
        "infosec",
        "threat",
        "vulnerability",
    ],
    "Cloud / DevOps": [
        "cloud",
        "devops",
        "site reliability",
        "sre",
        "kubernetes",
        "docker",
        "infrastructure",
    ],
    "Tech Consulting": [
        "technology consulting",
        "tech consulting",
        "it consulting",
        "it consultant",
        "solutions engineer",
        "solution architect",
        "requirements gathering",
    ],
    "Product / Technical Analyst": [
        "product analyst",
        "technical analyst",
        "business analyst",
        "product intern",
    ],
}

DEFAULT_EXACT_SOURCE_PREFIXES = [
    "greenhouse:",
    "lever:",
    "ashby:",
    "smartrecruiters:",
    "internsg",
    "workday:",
]

DEFAULT_PROGRAMME_PAGE_TERMS = [
    "student",
    "students",
    "graduates",
    "graduate programme",
    "graduate program",
    "internship programme",
    "internship program",
    "internships",
    "early careers",
    "campus",
    "university",
    "join-us",
    "join us",
    "careers",
]

DEFAULT_EXACT_URL_TERMS = [
    "/job/",
    "/jobs/",
    "/posting/",
    "/postings/",
    "/open-positions/",
    "/position/",
    "gh_jid=",
    "lever.co/",
    "greenhouse.io/",
    "ashbyhq.com/",
    "smartrecruiters.com/",
]

DEFAULT_GENERIC_TITLE_TERMS = [
    "careers",
    "join us",
    "join-us",
    "students and graduates",
    "students & graduates",
    "internships",
    "student programmes",
    "student programs",
    "early careers",
]


def _text(job: Job) -> str:
    return " ".join(
        [job.title or "", job.company or "", job.location or "", job.description or "", job.url or ""]
    ).lower()


def _contains_any(text: str, terms: list[str]) -> bool:
    return any(term.lower() in text for term in terms)


def _source_has_prefix(source: str, prefixes: list[str]) -> bool:
    return any(source.startswith(prefix.lower()) for prefix in prefixes)


def is_exact_job_posting(job: Job, config: dict[str, Any]) -> bool:
    text = _text(job)
    title = (job.title or "").lower()
    source = (job.source or "").lower()
    url = (job.url or "").lower()

    detection = config.get("exact_job_detection", {})
    exact_source_prefixes = [
        str(prefix).lower()
        for prefix in detection.get("exact_source_prefixes", DEFAULT_EXACT_SOURCE_PREFIXES)
    ]
    exact_url_terms = [
        str(term).lower()
        for term in detection.get("exact_url_terms", DEFAULT_EXACT_URL_TERMS)
    ]
    generic_title_terms = [
        str(term).lower()
        for term in detection.get("generic_title_terms", DEFAULT_GENERIC_TITLE_TERMS)
    ]
    programme_terms = [
        str(term).lower()
        for term in config.get("opportunity_classification", {}).get(
            "programme_page_terms",
            DEFAULT_PROGRAMME_PAGE_TERMS,
        )
    ]
    concrete_role_terms = [
        str(term).lower()
        for term in config.get("candidate_filters", {}).get("technical_terms", [])
    ]

    has_internship = "intern" in text or "internship" in text
    has_concrete_role = _contains_any(title, concrete_role_terms)
    generic_title = _contains_any(title, generic_title_terms)

    if generic_title and not has_concrete_role:
        return False

    if source.startswith("careerspage"):
        programme_like = _contains_any(url, programme_terms) or _contains_any(title, programme_terms)
        exact_url = _contains_any(url, exact_url_terms)
        return has_internship and has_concrete_role and (exact_url or not programme_like)

    if _source_has_prefix(source, exact_source_prefixes):
        return has_internship and not generic_title

    exact_url = _contains_any(url, exact_url_terms)
    return has_internship and has_concrete_role and exact_url


def classify_opportunity_type(job: Job, config: dict[str, Any]) -> str:
    title = (job.title or "").lower()
    source = (job.source or "").lower()
    url = (job.url or "").lower()

    if job.metadata.get("opportunity_type"):
        return job.metadata["opportunity_type"]

    programme_terms = config.get("opportunity_classification", {}).get(
        "programme_page_terms",
        DEFAULT_PROGRAMME_PAGE_TERMS,
    )
    concrete_role_terms = config.get("candidate_filters", {}).get("technical_terms", [])

    if is_exact_job_posting(job, config):
        return "job_posting"

    if (
        _contains_any(url, programme_terms) or _contains_any(title, programme_terms)
    ):
        return "internship_programme_page"

    if "manual" in source:
        return "manual_search_link"

    if _contains_any(title, concrete_role_terms):
        return "career_page"

    return "career_page"


def classify_role_family(job: Job, config: dict[str, Any] | None = None) -> str:
    text = _text(job)
    families = (config or {}).get("role_families", ROLE_FAMILY_TERMS)
    best_family = "General Tech"
    best_count = 0
    for family, terms in families.items():
        count = sum(1 for term in terms if str(term).lower() in text)
        if count > best_count:
            best_family = str(family)
            best_count = count
    return best_family


def extract_deadline(job: Job) -> str:
    text = " ".join([job.title or "", job.description or ""])
    patterns = [
        r"(?:apply by|deadline|closing date|applications close|closes on)[:\s]+([0-3]?\d\s+[A-Za-z]+\s+20\d{2})",
        r"(?:apply by|deadline|closing date|applications close|closes on)[:\s]+([A-Za-z]+\s+[0-3]?\d,?\s+20\d{2})",
        r"(?:apply by|deadline|closing date|applications close|closes on)[:\s]+([0-3]?\d[/-][01]?\d[/-]20\d{2})",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip().rstrip(".")

    if job.posted_at:
        return "No deadline found; prioritize while fresh"
    return "No deadline found"


def _is_referral_priority(job: Job, config: dict[str, Any]) -> bool:
    companies = {str(company).lower() for company in config.get("referral_priority_companies", [])}
    company = (job.company or "").lower()
    return company in companies


def build_resume_suggestion(role_family: str, resume_match: ResumeMatch) -> str:
    if resume_match.tracked_keywords_found == 0:
        return f"Tailor resume toward {role_family}; job text has limited tracked keywords."
    if not resume_match.missing_keywords:
        return f"Resume already covers tracked {role_family} keywords; lead with matching project bullets."
    gaps = ", ".join(resume_match.missing_keywords[:5])
    return f"Tailor {role_family} resume bullets toward: {gaps}."


def build_recommended_action(
    job: Job,
    score: Score,
    resume_match: ResumeMatch,
    config: dict[str, Any],
    *,
    opportunity_type: str,
    role_family: str,
) -> str:
    if opportunity_type == "internship_programme_page":
        return "Open programme page, check current intake/deadline, then apply or bookmark."

    if _is_referral_priority(job, config):
        return "Apply quickly and seek referral before or immediately after applying."

    if score.overall >= int(config.get("thresholds", {}).get("overall", 70)):
        return "Apply now; this is a strong match."

    if resume_match.coverage_percent < 60 and resume_match.tracked_keywords_found:
        return f"Review first; tailor resume for {role_family} before applying."

    return "Review and apply if the job description fits your semester timeline."


def build_opportunity_insights(
    job: Job,
    score: Score,
    resume_match: ResumeMatch,
    config: dict[str, Any],
) -> OpportunityInsights:
    opportunity_type = classify_opportunity_type(job, config)
    role_family = classify_role_family(job, config)
    deadline = extract_deadline(job)
    referral_priority = _is_referral_priority(job, config)
    resume_suggestion = build_resume_suggestion(role_family, resume_match)
    recommended_action = build_recommended_action(
        job,
        score,
        resume_match,
        config,
        opportunity_type=opportunity_type,
        role_family=role_family,
    )
    return OpportunityInsights(
        opportunity_type=opportunity_type,
        role_family=role_family,
        deadline=deadline,
        recommended_action=recommended_action,
        resume_suggestion=resume_suggestion,
        referral_priority=referral_priority,
    )


def build_source_health(source_counts: dict[str, int], config: dict[str, Any]) -> list[str]:
    health: list[str] = []
    for source, count in sorted(source_counts.items()):
        status = "ok" if count > 0 else "no results"
        health.append(f"{source}: {status} ({count})")

    manual = config.get("manual_review_digest", {})
    if manual.get("enabled", True):
        labels = [str(item.get("label", "Manual source")) for item in manual.get("links", [])]
        if labels:
            health.append(f"Manual review required: {min(len(labels), int(manual.get('max_items', 10)))} links")

    blocked = config.get("source_health", {}).get("known_manual_or_blocked_sources", [])
    for source in blocked:
        health.append(f"{source}: manual/API needed")
    return health
