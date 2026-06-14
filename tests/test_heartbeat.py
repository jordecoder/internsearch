from datetime import datetime, timezone

from database import init_db, set_metadata
from job_model import Job
import main
from main import (
    format_actionable_digest,
    format_heartbeat_message,
    format_manual_review_digest,
    format_near_match_digest,
    format_weekly_summary,
    heartbeat_due,
    send_status_telegram_message,
    send_test_telegram_message,
)
from opportunity_insights import OpportunityInsights
from resume_matcher import ResumeMatch
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


def test_heartbeat_supports_fractional_hour_interval(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)
    set_metadata(db_path, "last_heartbeat_time", "2026-06-14T00:00:00+00:00")

    assert not heartbeat_due(
        db_path,
        interval_hours=0.25,
        now=datetime(2026, 6, 14, 0, 14, tzinfo=timezone.utc),
    )
    assert heartbeat_due(
        db_path,
        interval_hours=0.25,
        now=datetime(2026, 6, 14, 0, 15, tzinfo=timezone.utc),
    )


def test_heartbeat_message_includes_run_summary():
    message = format_heartbeat_message(
        fetched=238,
        matched=0,
        sent=0,
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
        actionable_candidates=4,
    )

    assert "Internship monitor heartbeat" in message
    assert "Fetched jobs: 238" in message
    assert "Actionable candidates: 4" in message
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
        [
            (
                job,
                score,
                ResumeMatch(["python"], ["docker"], 50, 2),
                OpportunityInsights(
                    opportunity_type="job_posting",
                    role_family="Data Engineering",
                    deadline="No deadline found",
                    recommended_action="Apply quickly and seek referral before or immediately after applying.",
                    resume_suggestion="Tailor Data Engineering resume bullets toward: docker.",
                    referral_priority=True,
                ),
            )
        ],
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
    )

    assert "Daily near-match internship digest" in message
    assert "Data Platform Intern" in message
    assert "score 65/100" in message
    assert "Resume coverage: 50%" in message
    assert "gaps: docker" in message
    assert "seek referral" in message
    assert "Role: Data Engineering" in message
    assert "Deadline: No deadline found" in message
    assert "https://example.com/job?a=1&amp;b=2" in message


def test_actionable_digest_includes_seen_before_candidates():
    job = Job(
        source="Greenhouse:workato",
        title="Analytics Engineer Intern",
        company="Workato",
        location="Singapore",
        url="https://example.com/workato",
    )
    score = Score(
        role_relevance=80,
        skill_relevance=70,
        location_relevance=90,
        timeline_relevance=80,
        degree_relevance=60,
        overall=74,
        timeline_match="Newly discovered, timeline unspecified",
    )

    message = format_actionable_digest(
        [
            (
                job,
                score,
                ResumeMatch(["python"], [], 100, 1),
                OpportunityInsights(
                    opportunity_type="job_posting",
                    role_family="Data Science / Analytics",
                    deadline="No deadline found",
                    recommended_action="Apply now; this is a strong match.",
                    resume_suggestion="Resume already covers tracked Data Science / Analytics keywords.",
                    referral_priority=False,
                ),
                False,
            )
        ],
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
    )

    assert "Current actionable Singapore tech internships" in message
    assert "Analytics Engineer Intern" in message
    assert "seen before" in message
    assert "Role: Data Science / Analytics" in message


def test_weekly_summary_includes_totals_and_gaps():
    message = format_weekly_summary(
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
        fetched_postings=4129,
        actionable_candidates=4,
        alerts_sent=3,
        top_companies=[("Grab", 5)],
        common_missing_keywords=[("docker", 4)],
    )

    assert "Weekly internship search summary" in message
    assert "Fetched postings reviewed: 4129" in message
    assert "Actionable Singapore tech internships: 4" in message
    assert "Strict alerts sent: 3" in message
    assert "Grab: 5" in message
    assert "docker: 4" in message


def test_manual_review_digest_includes_links_and_notes():
    message = format_manual_review_digest(
        [
            {
                "label": "Indeed Singapore - data engineer intern",
                "url": "https://sg.indeed.com/jobs?q=data+engineer+intern&l=Singapore",
                "note": "Indeed often blocks automation.",
            }
        ],
        now=datetime(2026, 6, 14, 12, 0, tzinfo=timezone.utc),
    )

    assert "Manual job-source review" in message
    assert "Indeed Singapore - data engineer intern" in message
    assert "https://sg.indeed.com/jobs?q=data+engineer+intern&amp;l=Singapore" in message
    assert "blocks automation" in message


def test_send_test_telegram_message_uses_notifier(monkeypatch):
    sent = {}

    def fake_send(message, *, disable_web_page_preview=False):
        sent["message"] = message
        sent["disable_web_page_preview"] = disable_web_page_preview

    monkeypatch.setattr(main, "send_telegram_message", fake_send)

    send_test_telegram_message()

    assert "Internship monitor test" in sent["message"]
    assert "GitHub Actions secrets are working" in sent["message"]
    assert sent["disable_web_page_preview"] is True


def test_send_status_telegram_message_uses_notifier(monkeypatch):
    sent = {}

    def fake_send(message, *, disable_web_page_preview=False):
        sent["message"] = message
        sent["disable_web_page_preview"] = disable_web_page_preview

    monkeypatch.setattr(main, "send_telegram_message", fake_send)

    send_status_telegram_message("Started GitHub Actions monitor run")

    assert "Internship monitor status" in sent["message"]
    assert "Started GitHub Actions monitor run" in sent["message"]
    assert sent["disable_web_page_preview"] is True
