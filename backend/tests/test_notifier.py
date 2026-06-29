from datetime import datetime, timezone

from job_model import Job
from notifier import format_actionable_job_message, format_job_message
from scoring import Score


def _score(**kwargs):
    defaults = dict(
        role_relevance=95,
        skill_relevance=90,
        location_relevance=90,
        timeline_relevance=100,
        degree_relevance=85,
        overall=92,
        timeline_match="Summer 2027",
    )
    return Score(**{**defaults, **kwargs})


def test_strict_match_is_compact_with_title_company_and_score():
    job = Job(
        source="Greenhouse:grab",
        title="data engineering intern",
        company="grab",
        location="Singapore",
        url="https://example.com/job?a=1&b=2",
        posted_at=datetime(2026, 6, 14, 0, 0, tzinfo=timezone.utc),
    )
    score = _score()

    message = format_job_message(job, score, "missing: spark, dbt")

    assert '<a href="https://example.com/job?a=1&amp;b=2">Data Engineering Intern</a>' in message
    assert "Grab" in message
    assert "Greenhouse" in message
    assert "92" in message
    assert "Summer 2027" in message
    assert "missing: spark, dbt" in message
    # fluff removed
    assert "New Internship Match" not in message
    assert "Apply Here" not in message
    assert "Relevance Score" not in message
    assert "Posted Time" not in message
    assert "SGT" not in message
    assert "Location" not in message


def test_useless_timeline_labels_are_suppressed():
    job = Job(
        source="Lever:shopback",
        title="Software Engineer Intern",
        company="shopback",
        location="Singapore",
        url="https://example.com/job",
    )
    score = _score(timeline_match="Newly discovered, timeline unspecified", overall=75)

    message = format_job_message(job, score)

    assert "Newly discovered" not in message
    assert "unspecified" not in message


def test_near_match_score_is_prefixed_with_tilde():
    job = Job(
        source="LinkedIn",
        title="Analytics Intern",
        company="Shopback",
        location="Singapore",
        url="https://example.com/job",
        posted_at=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
    )
    score = _score(overall=71, timeline_match="2027 internship")

    message = format_actionable_job_message(job, score, "missing: dbt")

    assert "~71" in message
    assert "2027 internship" in message
    assert "missing: dbt" in message
    assert "missed the stricter score filter" not in message
    assert "Type:" not in message
    assert "Role family:" not in message
    assert "Deadline:" not in message


def test_no_resume_note_when_no_gaps():
    job = Job(
        source="Ashby:anthropic",
        title="Machine Learning Intern",
        company="anthropic",
        location="Singapore",
        url="https://example.com/job",
    )
    score = _score(timeline_match="Summer 2027", overall=88)

    message = format_job_message(job, score, "")

    assert "missing" not in message
    assert "Summer 2027" in message
