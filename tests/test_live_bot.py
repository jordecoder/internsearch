import live_bot
from database import get_metadata, init_db


def test_poll_once_processes_live_telegram_command(tmp_path, monkeypatch):
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)
    sent = []

    monkeypatch.setattr(
        live_bot,
        "get_telegram_updates",
        lambda **kwargs: [
            {
                "update_id": 25,
                "message": {
                    "chat": {"id": 123},
                    "text": "/help",
                },
            }
        ],
    )

    def fake_send(message, *, disable_web_page_preview=False, chat_id=None):
        sent.append((message, disable_web_page_preview, chat_id))

    monkeypatch.setattr("bot_commands.send_telegram_message", fake_send)

    processed = live_bot.poll_once(
        db_path,
        expected_chat_id="123",
        poll_timeout_seconds=1,
    )

    assert processed == 1
    assert sent[0][2] == "123"
    assert "Internship monitor commands" in sent[0][0]
    assert get_metadata(db_path, "telegram_last_update_offset") == "25"
