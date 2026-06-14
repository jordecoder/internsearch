from datetime import datetime, timezone

from database import init_db, set_metadata
from job_model import Job
from main import format_heartbeat_message, format_near_match_digest, heartbeat_due
from scoring import Score


def test_heartbeat_is_due_when_never_sent(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)

    assert heartbeat_due(
        db_path,
        interval_hours=24,
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
    )


def test_heartbeat_waits_for_interval(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)
    set_metadata(db_path, "last_heartbeat_time", "2026-06-14T00:00:00+00:00")

    assert not heartbeat_due(
        db_path,
        interval_hours=24,
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
    )
    assert heartbeat_due(
        db_path,
        interval_hours=24,
        now=datetime(2026, 6, 15, 0, 0, tzinfo=timezone.utc),
    )


def test_heartbeat_message_includes_run_summary():
    message = format_heartbeat_message(
        fetched=238,
        matched=0,
        sent=0,
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
    )

    assert "Internship monitor heartbeat" in message
    assert "Fetched jobs: 238" in message
    assert "Passed filters: 0" in message
    assert "Telegram job alerts sent: 0" in message


def test_near_match_digest_includes_job_links_and_scores():
    job = Job(
        source="Greenhouse:grab",
        title="Data Platform Intern",
        company="Grab",
        location="Singapore",
        url="https://example.com/job?a=1&b=2",
    )
    score = Score(
        role_relevance=80,
        skill_relevance=70,
        location_relevance=90,
        timeline_relevance=40,
        degree_relevance=60,
        overall=65,
        timeline_match="Timeline unclear",
    )

    message = format_near_match_digest(
        [(job, score)],
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
    )

    assert "Daily near-match internship digest" in message
    assert "Data Platform Intern" in message
    assert "score 65/100" in message
    assert "https://example.com/job?a=1&amp;b=2" in message
