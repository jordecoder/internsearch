import sqlite3

from job_model import Job
from database import (
    count_jobs_since,
    count_notifications_since,
    get_metadata,
    init_db,
    mark_notified,
    record_discovery,
    set_metadata,
    top_companies_since,
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


def test_record_discovery_persists_and_backfills_description(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    job = Job(
        source="Greenhouse:grab",
        title="Data Engineering Intern",
        company="Grab",
        location="Singapore",
        url="https://example.com/job",
        description="Build data pipelines at scale.",
    )
    init_db(db_path)
    record_discovery(db_path, job)

    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT description FROM jobs WHERE stable_id = ?", (job.stable_id,)
        ).fetchone()
    assert row[0] == "Build data pipelines at scale."

    # A re-sighting with a different description doesn't clobber what's stored.
    reseen = Job(
        source=job.source, title=job.title, company=job.company,
        location=job.location, url=job.url, description="different text",
    )
    record_discovery(db_path, reseen)
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT description FROM jobs WHERE stable_id = ?", (job.stable_id,)
        ).fetchone()
    assert row[0] == "Build data pipelines at scale."


def test_record_discovery_strips_html_from_description(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    job = Job(
        source="Greenhouse:stripe",
        title="Software Engineer, Intern",
        company="Stripe",
        location="Singapore",
        url="https://example.com/job",
        description="<h2><strong>Who we are</strong></h2><p>Stripe is a technology company.</p><ul><li>Python</li><li>SQL</li></ul>",
    )
    init_db(db_path)
    record_discovery(db_path, job)

    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT description FROM jobs WHERE stable_id = ?", (job.stable_id,)
        ).fetchone()
    stored = row[0]
    assert "<" not in stored
    assert "Who we are" in stored
    assert "Stripe is a technology company." in stored
    assert "Python" in stored and "SQL" in stored


def test_init_db_adds_description_column_to_legacy_database(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE jobs (
                stable_id TEXT PRIMARY KEY,
                source TEXT NOT NULL,
                title TEXT NOT NULL,
                company TEXT NOT NULL,
                location TEXT NOT NULL,
                url TEXT NOT NULL,
                posted_time TEXT,
                first_seen_time TEXT NOT NULL,
                last_seen_time TEXT NOT NULL,
                notified_time TEXT
            )
            """
        )
        conn.execute(
            "INSERT INTO jobs (stable_id, source, title, company, location, url, first_seen_time, last_seen_time) "
            "VALUES ('id1', 'src', 'Intern', 'Co', 'Singapore', 'https://x', 'now', 'now')"
        )

    init_db(db_path)

    with sqlite3.connect(db_path) as conn:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(jobs)").fetchall()}
        assert "description" in columns
        row = conn.execute("SELECT description FROM jobs WHERE stable_id = 'id1'").fetchone()
    assert row[0] == ""


def test_metadata_round_trip(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)

    assert get_metadata(db_path, "last_heartbeat_time") is None

    set_metadata(db_path, "last_heartbeat_time", "2026-06-14T00:00:00+00:00")

    assert get_metadata(db_path, "last_heartbeat_time") == "2026-06-14T00:00:00+00:00"


def test_summary_counts(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    job = Job(
        source="Greenhouse:grab",
        title="Data Engineering Intern",
        company="Grab",
        location="Singapore",
        url="https://example.com/job",
    )

    init_db(db_path)
    record_discovery(db_path, job)
    mark_notified(db_path, job)

    assert count_jobs_since(db_path, "2000-01-01T00:00:00+00:00") == 1
    assert count_notifications_since(db_path, "2000-01-01T00:00:00+00:00") == 1
    assert top_companies_since(db_path, "2000-01-01T00:00:00+00:00") == [("Grab", 1)]
