"""Kafka consumer — scores job events and fires Telegram alerts.

Modes:
  default   Long-running (for always-on workers like Render)
  --drain   Process all pending messages then exit (for GitHub Actions)

Run:  python -m pipeline.run_consumer [--drain] [--config config.yaml]
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
    import requests as _req
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat = os.getenv("TELEGRAM_CHAT_ID")
    if not (token and chat):
        return
    try:
        _req.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat, "text": f"[internsearch] Kafka consumer crashed: {type(exc).__name__}: {exc}"},
            timeout=5,
        )
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Kafka job consumer")
    parser.add_argument("--config", default="config.yaml")
    parser.add_argument(
        "--drain",
        action="store_true",
        help="Process all pending messages then exit (GitHub Actions mode)",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    configure_logging(config.get("log_level", "INFO"))

    LOGGER.info("pipeline_consumer_starting mode=%s", "drain" if args.drain else "continuous")
    consumer = JobConsumer(config)

    def _on_sigterm(signum, frame):
        LOGGER.info("pipeline_consumer_sigterm")
        consumer._consumer.close()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _on_sigterm)

    try:
        if args.drain:
            consumer.drain()
        else:
            consumer.run()
    except Exception as exc:
        LOGGER.exception("pipeline_consumer_crashed")
        _send_crash_alert(exc)
        sys.exit(1)


if __name__ == "__main__":
    main()
