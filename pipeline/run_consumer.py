"""Long-running Kafka consumer — scores arriving job events and fires Telegram alerts.

Designed to run as a Render background worker (always-on).

Run manually:  python -m pipeline.run_consumer
"""
from __future__ import annotations

import argparse
import logging
import os
import signal
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from main import configure_logging, load_config
from pipeline.consumer import JobConsumer

LOGGER = logging.getLogger(__name__)


def _send_crash_alert(exc: BaseException) -> None:
    """Fire a Telegram message to the admin chat when the consumer crashes."""
    import requests as _req
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    if not (token and chat):
        return
    text = f"[internsearch] Kafka consumer crashed: {type(exc).__name__}: {exc}"
    try:
        _req.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat, "text": text},
            timeout=5,
        )
    except Exception:
        pass  # crash alert must never raise


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Kafka job consumer")
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()

    config = load_config(args.config)
    configure_logging(config.get("log_level", "INFO"))

    LOGGER.info("pipeline_consumer_starting")
    consumer = JobConsumer(config)

    # Render (and most container platforms) sends SIGTERM before SIGKILL.
    # Handle it so the consumer can commit its last offset and close cleanly.
    def _on_sigterm(signum, frame):
        LOGGER.info("pipeline_consumer_sigterm received — shutting down")
        consumer._consumer.close()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _on_sigterm)

    try:
        consumer.run()
    except Exception as exc:
        LOGGER.exception("pipeline_consumer_crashed")
        _send_crash_alert(exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
