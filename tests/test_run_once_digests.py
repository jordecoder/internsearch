from job_model import Job
from database import init_db, record_discovery
import main


def test_run_once_sends_actionable_digest_for_seen_before_candidate(tmp_path, monkeypatch):
    db_path = str(tmp_path / "jobs.sqlite3")
    job = Job(
        source="Greenhouse:workato",
        title="Analytics Engineer Intern",
        company="Workato",
        location="Singapore",
        url="https://example.com/workato",
        description="Analytics internship using Python SQL dashboards.",
    )
    init_db(db_path)
    record_discovery(db_path, job)

    sent_messages = []

    def fake_fetch_all_jobs(config, client):
        return [job], {"Greenhouse": 1}

    def fake_send(message, *, disable_web_page_preview=False):
        sent_messages.append(message)

    monkeypatch.setattr(main, "fetch_all_jobs", fake_fetch_all_jobs)
    monkeypatch.setattr(main, "send_telegram_message", fake_send)

    config = {
        "database_path": db_path,
        "posted_within_hours": 24,
        "log_level": "INFO",
        "http": {"rate_limit_seconds": 0},
        "role_keywords": ["analytics engineer intern", "internship"],
        "target_keywords": ["analytics", "python", "sql"],
        "degree_keywords": ["undergraduate"],
        "thresholds": {"overall": 70, "timeline": 80, "location": 70},
        "candidate_filters": {
            "min_location": 70,
            "required_locations": ["singapore"],
            "internship_terms": ["intern", "internship"],
            "technical_terms": ["analytics", "python", "sql"],
            "rejected_terms": ["marketing", "manager", "senior"],
        },
        "resume_match": {"tracked_keywords": ["python", "sql"]},
        "new_actionable_alerts": {"enabled": True, "min_overall": 55, "min_location": 70},
        "actionable_digest": {"enabled": True, "interval_hours": 0, "max_items": 10},
        "near_match_digest": {"enabled": False},
        "manual_review_digest": {"enabled": False},
        "weekly_summary": {"enabled": False},
        "heartbeat": {"enabled": False},
        "application_tracker": {"enabled": False},
    }

    main.run_once(config)

    assert any("Current actionable Singapore tech internships" in msg for msg in sent_messages)
    assert any("seen before" in msg for msg in sent_messages)
