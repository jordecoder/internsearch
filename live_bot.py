from __future__ import annotations

import logging
import os
import time

from dotenv import load_dotenv

from bot_commands import process_telegram_updates
from database import get_metadata, init_db
from main import configure_logging, load_config
from notifier import get_telegram_updates, send_telegram_message


LOGGER = logging.getLogger(__name__)


def poll_once(
    db_path: str,
    *,
    expected_chat_id: str,
    poll_timeout_seconds: int,
) -> int:
    last_offset = get_metadata(db_path, "telegram_last_update_offset")
    offset = int(last_offset) + 1 if last_offset and last_offset.isdigit() else None
    updates = get_telegram_updates(
        offset=offset,
        poll_timeout_seconds=poll_timeout_seconds,
        request_timeout_seconds=poll_timeout_seconds + 10,
    )
    if not updates:
        return 0
    return process_telegram_updates(
        db_path,
        updates,
        expected_chat_id=expected_chat_id,
    )


def run_live_bot(config_path: str = "config.yaml") -> None:
    load_dotenv()
    config = load_config(config_path)
    configure_logging(config.get("log_level", "INFO"))

    token = os.getenv("TELEGRAM_BOT_TOKEN")
    expected_chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not expected_chat_id:
        raise RuntimeError("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID")

    db_path = config.get("database_path", "jobs.sqlite3")
    init_db(db_path)

    poll_timeout_seconds = int(os.getenv("TELEGRAM_POLL_TIMEOUT_SECONDS", "25"))
    error_sleep_seconds = float(os.getenv("TELEGRAM_ERROR_SLEEP_SECONDS", "5"))
    if os.getenv("LIVE_BOT_SEND_STARTUP", "").lower() in {"1", "true", "yes"}:
        send_telegram_message(
            "<b>Internship live bot is online</b>\n\nCommands now reply immediately while this worker is running.",
            disable_web_page_preview=True,
        )

    LOGGER.info("live_telegram_bot_started")
    while True:
        try:
            processed = poll_once(
                db_path,
                expected_chat_id=expected_chat_id,
                poll_timeout_seconds=poll_timeout_seconds,
            )
            if processed:
                LOGGER.info("live_telegram_commands_processed count=%s", processed)
        except KeyboardInterrupt:
            LOGGER.info("live_telegram_bot_stopped")
            raise
        except Exception:
            LOGGER.exception("live_telegram_poll_failed")
            time.sleep(error_sleep_seconds)


if __name__ == "__main__":
    run_live_bot()
