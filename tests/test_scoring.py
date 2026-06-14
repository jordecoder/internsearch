from datetime import datetime, timezone

from job_model import Job
from scoring import is_actionable_candidate, is_fresh, passes_threshold, score_job


CONFIG = {
    "thresholds": {"overall": 70, "timeline": 80, "location": 70},
    "role_keywords": [
        "data engineering intern",
        "machine learning intern",
        "internship",
    ],
    "target_keywords": [
        "python",
        "sql",
        "spark",
        "airflow",
        "rag",
        "llm",
        "data engineering",
        "machine learning",
    ],
    "degree_keywords": ["bachelor's degree", "undergraduate", "computer science"],
    "priority_companies": ["Grab", "DSTA", "CSIT", "GovTech Singapore"],
    "candidate_filters": {
        "min_location": 70,
        "required_locations": ["singapore"],
        "internship_terms": ["intern", "internship", "internships"],
        "technical_terms": [
            "data engineering",
            "analytics",
            "data analyst",
            "machine learning",
            "software engineer",
            "technology consulting",
            "it consulting",
            "python",
            "sql",
            "rag",
            "llm",
        ],
        "rejected_terms": [
            "senior",
            "manager",
            "marketing",
            "growth",
            "support",
            "communications",
            "social media",
            "public policy",
        ],
        "trusted_technical_companies": ["dsta", "csit", "govtech singapore"],
    },
}


def test_high_quality_2027_singapore_internship_passes_thresholds():
    job = Job(
        source="Greenhouse:grab",
        title="Data Engineering Intern",
        company="Grab",
        location="Singapore",
        url="https://example.com/job",
        posted_at=datetime(2026, 6, 14, 4, 0, tzinfo=timezone.utc),
        description=(
            "Summer 2027 internship for undergraduate Computer Science students. "
            "Build Python SQL Spark Airflow data pipelines and RAG systems."
        ),
    )

    score = score_job(
        job, CONFIG, now=datetime(2026, 6, 14, 5, 0, tzinfo=timezone.utc)
    )

    assert score.overall >= 70
    assert score.timeline_relevance == 100
    assert score.location_relevance >= 70
    assert passes_threshold(score, CONFIG)
    assert is_actionable_candidate(job, score, CONFIG)


def test_2026_or_immediate_start_is_rejected_by_timeline():
    job = Job(
        source="Lever:example",
        title="Machine Learning Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
        description="Summer 2026 immediate start role using Python SQL LLM.",
    )

    score = score_job(job, CONFIG)

    assert score.timeline_relevance == 0
    assert not passes_threshold(score, CONFIG)


def test_unknown_post_time_is_fresh_only_when_newly_discovered():
    job = Job(
        source="InternSG",
        title="AI Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
        posted_at=None,
    )

    assert is_fresh(job, is_new=True, hours=24)
    assert not is_fresh(job, is_new=False, hours=24)


def test_senior_manager_outside_singapore_is_not_actionable():
    job = Job(
        source="Greenhouse:databricks",
        title="Senior Manager, Global Premier Support",
        company="databricks",
        location="Sydney, Australia",
        url="https://example.com/job",
        description="Customer support manager role.",
    )

    score = score_job(job, CONFIG)

    assert not is_actionable_candidate(job, score, CONFIG)


def test_marketing_growth_intern_is_not_actionable():
    job = Job(
        source="InternSG",
        title="Marketing & Growth Intern - Founder's Office",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
        description="Marketing growth internship.",
    )

    score = score_job(job, CONFIG)

    assert not is_actionable_candidate(job, score, CONFIG)


def test_analytics_intern_is_actionable():
    job = Job(
        source="InternSG",
        title="Analytics Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
        description="Use SQL Python dashboards and business intelligence analytics.",
    )

    score = score_job(job, CONFIG)

    assert is_actionable_candidate(job, score, CONFIG)
    assert score.overall >= 60


def test_it_consulting_intern_is_actionable():
    job = Job(
        source="InternSG",
        title="Technology Consulting Intern",
        company="Example",
        location="Singapore",
        url="https://example.com/job",
        description="IT consulting internship for cloud data transformation projects.",
    )

    score = score_job(job, CONFIG)

    assert is_actionable_candidate(job, score, CONFIG)


def test_public_policy_intern_with_technical_company_boilerplate_is_not_actionable():
    job = Job(
        source="Greenhouse:cloudflare",
        title="Public Policy Intern, APJC",
        company="cloudflare",
        location="Singapore",
        url="https://example.com/job",
        description="Cloud cybersecurity network platform company using Python SQL.",
    )

    score = score_job(job, CONFIG)

    assert not is_actionable_candidate(job, score, CONFIG)


def test_dsta_generic_internship_link_is_actionable_as_trusted_technical_employer():
    job = Job(
        source="CareersPage:DSTA",
        title="DSTA Internships",
        company="DSTA",
        location="Singapore",
        url="https://www.dsta.gov.sg/join-us/student/internships",
        description="Internships in engineering, data analytics, cybersecurity and software.",
    )

    score = score_job(job, CONFIG)

    assert is_actionable_candidate(job, score, CONFIG)


def test_trusted_technical_employer_still_rejects_marketing_roles():
    job = Job(
        source="CareersPage:DSTA",
        title="Marketing Intern",
        company="DSTA",
        location="Singapore",
        url="https://example.com/job",
        description="Marketing communications internship.",
    )

    score = score_job(job, CONFIG)

    assert not is_actionable_candidate(job, score, CONFIG)


def test_trusted_technical_employer_rejects_corporate_communications():
    job = Job(
        source="CareersPage:CSIT",
        title="Corporate Communications Internship (Social Media)",
        company="CSIT",
        location="Singapore",
        url="https://example.com/job",
        description="Communications internship.",
    )

    score = score_job(job, CONFIG)

    assert not is_actionable_candidate(job, score, CONFIG)
