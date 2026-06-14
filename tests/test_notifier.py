from datetime import datetime, timezone

from job_model import Job
from notifier import format_actionable_job_message, format_job_message
from scoring import Score


def test_telegram_message_uses_html_links_score_and_display_names():
    job = Job(
        source="Greenhouse:workato",
        title="data engineering intern",
        company="workato",
        location="Singapore",
        url="https://example.com/job?a=1&b=2",
        posted_at=datetime(2026, 6, 14, 0, 0, tzinfo=timezone.utc),
    )
    score = Score(
        role_relevance=95,
        skill_relevance=90,
        location_relevance=90,
        timeline_relevance=100,
        degree_relevance=85,
        overall=92,
        timeline_match="Summer 2027",
    )

    message = format_job_message(job, score)

    assert "New Internship Match" in message
    assert "<b><a href=\"https://example.com/job?a=1&amp;b=2\">Data Engineering Intern</a></b>" in message
    assert "<b>Company</b>: Workato" in message
    assert "<b>Source</b>: Greenhouse: Workato" in message
    assert "<b>Posted Time</b>:" in message
    assert "SGT" in message
    assert "<b>Relevance Score</b>: 92/100" in message
    assert "<a href=\"https://example.com/job?a=1&amp;b=2\">Apply Here</a>" in message


def test_actionable_message_labels_near_match_clearly():
    job = Job(
        source="CareersPage:DSTA",
        title="dsta internships",
        company="DSTA",
        location="Singapore",
        url="https://example.com/internships?a=1&b=2",
    )
    score = Score(
        role_relevance=70,
        skill_relevance=40,
        location_relevance=90,
        timeline_relevance=80,
        degree_relevance=55,
        overall=64,
        timeline_match="Newly discovered, timeline unspecified",
    )

    message = format_actionable_job_message(job, score, "Resume coverage: 50%")

    assert "New Actionable Internship Posting" in message
    assert "missed the stricter score filter" in message
    assert "DSTA Internships" in message
    assert "Resume coverage: 50%" in message
    assert "https://example.com/internships?a=1&amp;b=2" in message
