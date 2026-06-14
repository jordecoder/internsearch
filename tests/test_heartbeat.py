from datetime import datetime, timezone

from database import init_db, set_metadata
from main import format_heartbeat_message, heartbeat_due


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
