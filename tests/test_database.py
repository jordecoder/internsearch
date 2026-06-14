from job_model import Job
from database import init_db, mark_notified, record_discovery, was_notified


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
