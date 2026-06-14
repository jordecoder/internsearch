from datetime import datetime, timezone

from job_model import Job
from scoring import is_fresh, passes_threshold, score_job


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
    "priority_companies": ["Grab"],
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
