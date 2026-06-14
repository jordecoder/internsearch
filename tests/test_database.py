from job_model import Job
from database import (
    get_metadata,
    init_db,
    mark_notified,
    record_discovery,
    set_metadata,
    was_notified,
)


def test_record_discovery_and_notification_dedupe(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    job = Job(
        source="Greenhouse:grab",
        title="Data Engineering Intern",
        company="Grab",
        location="Singapore",
        url="https://example.com/job",
    )

    init_db(db_path)

    assert record_discovery(db_path, job) is True
    assert record_discovery(db_path, job) is False
    assert was_notified(db_path, job) is False

    mark_notified(db_path, job)

    assert was_notified(db_path, job) is True


def test_metadata_round_trip(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)

    assert get_metadata(db_path, "last_heartbeat_time") is None

    set_metadata(db_path, "last_heartbeat_time", "2026-06-14T00:00:00+00:00")

    assert get_metadata(db_path, "last_heartbeat_time") == "2026-06-14T00:00:00+00:00"
