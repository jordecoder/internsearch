from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from job_model import Job


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db(db_path: str) -> None:
    parent = Path(db_path).parent
    if str(parent) not in ("", "."):
        parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
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
            """
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """
        )
        _migrate_legacy_schema(conn)


def _migrate_legacy_schema(conn: sqlite3.Connection) -> None:
    tables = {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()
    }
    if "seen_jobs" not in tables:
        return

    rows = conn.execute(
        """
        SELECT stable_id, source, title, company, url, first_seen_at
        FROM seen_jobs
        """
    ).fetchall()
    conn.executemany(
        """
        INSERT OR IGNORE INTO jobs
        (stable_id, source, title, company, location, url, posted_time,
         first_seen_time, last_seen_time, notified_time)
        VALUES (?, ?, ?, ?, '', ?, NULL, ?, ?, ?)
        """,
        [
            (stable_id, source, title, company, url, first_seen, first_seen, first_seen)
            for stable_id, source, title, company, url, first_seen in rows
        ],
    )


def record_discovery(db_path: str, job: Job) -> bool:
    """Persist a fetched job and return True if this is the first sighting."""
    now = _utc_now_iso()
    posted_time = job.posted_at.isoformat() if job.posted_at else None

    with sqlite3.connect(db_path) as conn:
        try:
            conn.execute(
                """
                INSERT INTO jobs
                (stable_id, source, title, company, location, url, posted_time,
                 first_seen_time, last_seen_time)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    job.stable_id,
                    job.source,
                    job.title,
                    job.company,
                    job.location,
                    job.url,
                    posted_time,
                    now,
                    now,
                ),
            )
            return True
        except sqlite3.IntegrityError:
            conn.execute(
                """
                UPDATE jobs
                SET last_seen_time = ?,
                    posted_time = COALESCE(posted_time, ?),
                    location = CASE WHEN location = '' THEN ? ELSE location END
                WHERE stable_id = ?
                """,
                (now, posted_time, job.location, job.stable_id),
            )
            return False


def was_notified(db_path: str, job: Job) -> bool:
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT notified_time FROM jobs WHERE stable_id = ?",
            (job.stable_id,),
        ).fetchone()
    return bool(row and row[0])


def mark_notified(db_path: str, job: Job) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "UPDATE jobs SET notified_time = ? WHERE stable_id = ?",
            (_utc_now_iso(), job.stable_id),
        )


def get_metadata(db_path: str, key: str) -> str | None:
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT value FROM metadata WHERE key = ?",
            (key,),
        ).fetchone()
    return row[0] if row else None


def set_metadata(db_path: str, key: str, value: str) -> None:
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            INSERT INTO metadata (key, value)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, value),
        )


def count_jobs_since(db_path: str, since_iso: str) -> int:
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE first_seen_time >= ?",
            (since_iso,),
        ).fetchone()
    return int(row[0] if row else 0)


def count_notifications_since(db_path: str, since_iso: str) -> int:
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT COUNT(*)
            FROM jobs
            WHERE notified_time IS NOT NULL AND notified_time >= ?
            """,
            (since_iso,),
        ).fetchone()
    return int(row[0] if row else 0)


def top_companies_since(db_path: str, since_iso: str, *, limit: int = 5) -> list[tuple[str, int]]:
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT company, COUNT(*) AS count
            FROM jobs
            WHERE first_seen_time >= ?
            GROUP BY company
            ORDER BY count DESC, company ASC
            LIMIT ?
            """,
            (since_iso, limit),
        ).fetchall()
    return [(str(company), int(count)) for company, count in rows]
