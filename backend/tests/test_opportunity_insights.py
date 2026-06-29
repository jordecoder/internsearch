from job_model import Job
from opportunity_insights import (
    build_opportunity_insights,
    build_source_health,
    classify_opportunity_type,
    classify_role_family,
    extract_deadline,
    is_exact_job_posting,
)
from resume_matcher import ResumeMatch
from scoring import Score


CONFIG = {
    "candidate_filters": {
        "technical_terms": ["data engineering", "software engineer", "cybersecurity"],
    },
    "thresholds": {"overall": 70},
    "referral_priority_companies": ["DSTA"],
    "manual_review_digest": {
        "enabled": True,
        "max_items": 3,
        "links": [{"label": "Indeed"}, {"label": "LinkedIn"}, {"label": "NUS"}],
    },
    "source_health": {"known_manual_or_blocked_sources": ["Indeed"]},
}


def test_classifies_generic_public_sector_page_as_programme_page():
    job = Job(
        source="CareersPage:DSTA",
        title="DSTA Internships",
        company="DSTA",
        location="Singapore",
        url="https://www.dsta.gov.sg/join-us/student/internships",
    )

    assert classify_opportunity_type(job, CONFIG) == "internship_programme_page"
    assert not is_exact_job_posting(job, CONFIG)


def test_classifies_api_backed_internship_as_exact_job_posting():
    job = Job(
        source="Greenhouse:workato",
        title="Analytics Engineer Intern",
        company="Workato",
        location="Singapore",
        url="https://job-boards.greenhouse.io/workato/jobs/123",
        description="Analytics internship using Python and SQL.",
    )

    assert is_exact_job_posting(job, CONFIG)
    assert classify_opportunity_type(job, CONFIG) == "job_posting"


def test_careers_page_exact_role_link_can_be_exact_posting():
    job = Job(
        source="CareersPage:Example",
        title="Data Engineering Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/careers/jobs/data-engineering-intern-123",
        description="Build data pipelines.",
    )

    assert is_exact_job_posting(job, CONFIG)
    assert classify_opportunity_type(job, CONFIG) == "job_posting"


def test_classifies_role_family_and_deadline():
    job = Job(
        source="InternSG",
        title="Data Engineering Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
        description="Build ETL pipelines. Applications close 30 June 2026.",
    )

    assert classify_role_family(job) == "Data Engineering"
    assert extract_deadline(job) == "30 June 2026"


def test_build_opportunity_insights_adds_action_and_resume_suggestion():
    job = Job(
        source="CareersPage:DSTA",
        title="DSTA Internships",
        company="DSTA",
        location="Singapore",
        url="https://www.dsta.gov.sg/join-us/student/internships",
        description="Cybersecurity and software internships.",
    )
    score = Score(70, 60, 90, 80, 55, 66, "Newly discovered")
    match = ResumeMatch(["python"], ["cybersecurity"], 50, 2)

    insights = build_opportunity_insights(job, score, match, CONFIG)

    assert insights.opportunity_type == "internship_programme_page"
    assert insights.referral_priority is True
    assert "Open programme page" in insights.recommended_action
    assert "cybersecurity" in insights.resume_suggestion


def test_source_health_includes_manual_sources():
    health = build_source_health({"InternSG": 12, "Greenhouse": 0}, CONFIG)

    assert "Greenhouse: no results (0)" in health
    assert "InternSG: ok (12)" in health
    assert "Manual review required: 3 links" in health
    assert "Indeed: manual/API needed" in health
