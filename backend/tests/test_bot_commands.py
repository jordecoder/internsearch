from datetime import datetime, timezone

import bot_commands
from bot_commands import handle_command, process_telegram_commands
from database import get_metadata, init_db, record_discovery, set_metadata
from job_model import Job


def test_help_and_faq_commands_return_expected_text(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)

    assert "Internship monitor commands" in handle_command(db_path, "/help")
    assert "Every 3 hours" in handle_command(db_path, "/faq")
    assert "02:00" in handle_command(db_path, "/schedule")


def test_status_command_uses_saved_metadata(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)
    set_metadata(db_path, "last_run_time", "2026-06-14T12:00:00+00:00")
    set_metadata(db_path, "last_run_fetched", "100")
    set_metadata(db_path, "last_run_actionable", "3")
    set_metadata(db_path, "last_run_matched", "1")
    set_metadata(db_path, "last_run_sent", "1")

    message = handle_command(db_path, "/status")

    assert "Latest monitor status" in message
    assert "Fetched jobs: 100" in message
    assert "2026-06-14 20:00 SGT" in message


def test_date_command_finds_recorded_job(tmp_path):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)
    record_discovery(
        db_path,
        Job(
            source="Greenhouse:workato",
            title="Analytics Engineer Intern",
            company="workato",
            location="Singapore",
            url="https://example.com/workato",
            posted_at=datetime(2026, 6, 14, 0, 0, tzinfo=timezone.utc),
        ),
    )

    message = handle_command(db_path, "/date workato")

    assert "Date lookup for:" in message
    assert "Analytics Engineer Intern" in message
    assert "Workato" in message
    assert "Posted: 2026-06-14 08:00 SGT" in message


def test_process_telegram_commands_replies_and_records_offset(tmp_path, monkeypatch):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)
    sent = []

    monkeypatch.setenv("TELEGRAM_CHAT_ID", "123")
    monkeypatch.setattr(
        bot_commands,
        "get_telegram_updates",
        lambda offset=None: [
            {
                "update_id": 10,
                "message": {
                    "chat": {"id": 123},
                    "text": "/help",
                },
            }
        ],
    )

    def fake_send(message, *, disable_web_page_preview=False, chat_id=None):
        sent.append((message, disable_web_page_preview, chat_id))

    monkeypatch.setattr(bot_commands, "send_telegram_message", fake_send)

    processed = process_telegram_commands(db_path)

    assert processed == 1
    assert sent[0][2] == "123"
    assert "Internship monitor commands" in sent[0][0]
    assert get_metadata(db_path, "telegram_last_update_offset") == "10"
