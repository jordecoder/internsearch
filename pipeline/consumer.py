from __future__ import annotations

import logging
import os
from typing import Any

from confluent_kafka import Consumer, KafkaError, Message

from database import init_db, mark_notified, record_discovery, was_notified
from notifier import send_actionable_telegram, send_telegram
from opportunity_insights import build_opportunity_insights
from pipeline.schemas import DLQ_TOPIC, TOPIC, JobEvent
from resume_matcher import load_resume_profile, match_resume_to_job
from scoring import is_actionable_candidate, is_fresh, passes_threshold, score_job

LOGGER = logging.getLogger(__name__)
GROUP_ID = "job-alerter"
_MAX_FAILURES = 3


def _build_config() -> dict:
    servers = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
    cfg: dict = {
        "bootstrap.servers": servers,
        "group.id": GROUP_ID,
        # Start from earliest so no events are missed if consumer restarts
        "auto.offset.reset": "earliest",
        # Manual commit: we commit only after successful processing
        "enable.auto.commit": False,
        "max.poll.interval.ms": 300000,
    }
    key = os.getenv("KAFKA_API_KEY")
    secret = os.getenv("KAFKA_API_SECRET")
    if key and secret:
        mechanism = os.getenv("KAFKA_SASL_MECHANISM", "PLAIN")
        cfg.update({
            "security.protocol": "SASL_SSL",
            "sasl.mechanisms": mechanism,
            "sasl.username": key,
            "sasl.password": secret,
        })
    return cfg


class JobConsumer:
    """Long-running Kafka consumer that scores jobs and fires Telegram alerts."""

    def __init__(self, app_config: dict[str, Any]) -> None:
        self._app_config = app_config
        self._db_path: str = app_config.get("database_path", "jobs.sqlite3")
        self._posted_within: int = int(app_config.get("posted_within_hours", 24))
        self._resume_profile = load_resume_profile(app_config.get("resume_profile_path"))
        self._tracked_keywords: list[str] = app_config.get("resume_match", {}).get(
            "tracked_keywords", app_config.get("target_keywords", [])
        )
        self._actionable_cfg = app_config.get("new_actionable_alerts", {})

        init_db(self._db_path)

        cfg = _build_config()
        self._consumer = Consumer(cfg)
        # Separate producer for the dead-letter queue
        from confluent_kafka import Producer
        self._dlq = Producer({"bootstrap.servers": os.environ["KAFKA_BOOTSTRAP_SERVERS"],
                               **({
                                   "security.protocol": "SASL_SSL",
                                   "sasl.mechanisms": "PLAIN",
                                   "sasl.username": os.getenv("KAFKA_API_KEY"),
                                   "sasl.password": os.getenv("KAFKA_API_SECRET"),
                               } if os.getenv("KAFKA_API_KEY") else {})})

        self._consumer.subscribe([TOPIC])
        LOGGER.info("kafka_consumer_ready topic=%s group=%s db=%s", TOPIC, GROUP_ID, self._db_path)

    # ── main loop ──────────────────────────────────────────────────────────────

    def run(self) -> None:
        """Continuous mode — runs until interrupted (for always-on workers)."""
        LOGGER.info("kafka_consumer_running")
        try:
            while True:
                msg: Message | None = self._consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                if msg.error():
                    self._handle_kafka_error(msg)
                    continue
                self._handle_message(msg)
        except KeyboardInterrupt:
            LOGGER.info("kafka_consumer_stopping signal=SIGINT")
        finally:
            self._consumer.close()
            LOGGER.info("kafka_consumer_closed")

    def drain(self, idle_timeout: float = 10.0) -> None:
        """Drain mode — process all pending messages then exit.

        Exits after `idle_timeout` seconds of no new messages, which means
        the topic is caught up. Safe to run on a schedule (GitHub Actions).
        """
        LOGGER.info("kafka_consumer_drain_starting idle_timeout=%ss", idle_timeout)
        processed = 0
        idle_seconds = 0.0
        poll_interval = 1.0

        try:
            while idle_seconds < idle_timeout:
                msg: Message | None = self._consumer.poll(timeout=poll_interval)
                if msg is None:
                    idle_seconds += poll_interval
                    continue
                if msg.error():
                    self._handle_kafka_error(msg)
                    continue
                self._handle_message(msg)
                processed += 1
                idle_seconds = 0.0  # reset idle timer on each message
        finally:
            self._consumer.close()
            LOGGER.info("kafka_consumer_drain_complete processed=%s", processed)

    # ── message handling ───────────────────────────────────────────────────────

    def _handle_message(self, msg: Message) -> None:
        offset_info = f"partition={msg.partition()} offset={msg.offset()}"
        try:
            event = JobEvent.from_bytes(msg.value())
        except Exception:
            LOGGER.exception("kafka_deserialise_failed %s", offset_info)
            self._consumer.commit(msg)
            return

        failures = 0
        while failures < _MAX_FAILURES:
            try:
                self._process(event)
                break
            except Exception:
                failures += 1
                LOGGER.exception(
                    "kafka_process_failed attempt=%s/%s url=%s %s",
                    failures, _MAX_FAILURES, event.url, offset_info,
                )

        if failures == _MAX_FAILURES:
            self._send_to_dlq(msg)

        # Always commit so we don't reprocess on restart
        self._consumer.commit(msg)

    def _handle_kafka_error(self, msg: Message) -> None:
        if msg.error().code() == KafkaError._PARTITION_EOF:
            LOGGER.debug("kafka_eof partition=%s offset=%s", msg.partition(), msg.offset())
        else:
            LOGGER.error("kafka_broker_error %s", msg.error())

    def _send_to_dlq(self, msg: Message) -> None:
        try:
            self._dlq.produce(topic=DLQ_TOPIC, key=msg.key(), value=msg.value())
            self._dlq.poll(0)
            LOGGER.warning("kafka_dlq_sent key=%s", msg.key())
        except Exception:
            LOGGER.exception("kafka_dlq_failed")

    # ── job processing ─────────────────────────────────────────────────────────

    def _process(self, event: JobEvent) -> None:
        job = event.to_job()
        LOGGER.info("kafka_processing title=%s company=%s source=%s", job.title, job.company, job.source)

        is_new = record_discovery(self._db_path, job)
        score = score_job(job, self._app_config)
        actionable = is_actionable_candidate(job, score, self._app_config)

        if not actionable:
            LOGGER.debug("kafka_not_actionable url=%s", job.url)
            return

        if was_notified(self._db_path, job):
            LOGGER.debug("kafka_already_notified url=%s", job.url)
            return

        if not is_fresh(job, is_new=is_new, hours=self._posted_within):
            LOGGER.debug("kafka_not_fresh url=%s", job.url)
            return

        resume_match = match_resume_to_job(job, self._resume_profile, self._tracked_keywords)
        insights = build_opportunity_insights(job, score, resume_match, self._app_config)

        resume_note = (
            f"missing: {', '.join(resume_match.missing_keywords[:4])}"
            if resume_match.missing_keywords
            else ""
        )

        strict = passes_threshold(score, self._app_config)
        actionable_min = int(self._actionable_cfg.get("min_overall", 0))
        actionable_loc = int(self._actionable_cfg.get("min_location", 70))

        if strict and insights.opportunity_type == "job_posting":
            send_telegram(job, score, resume_note)
            mark_notified(self._db_path, job)
            LOGGER.info(
                "kafka_strict_alert_sent title=%s company=%s score=%s",
                job.title, job.company, score.overall,
            )
        elif (
            self._actionable_cfg.get("enabled", True)
            and is_new
            and insights.opportunity_type == "job_posting"
            and score.overall >= actionable_min
            and score.location_relevance >= actionable_loc
        ):
            send_actionable_telegram(job, score, resume_note)
            mark_notified(self._db_path, job)
            LOGGER.info(
                "kafka_actionable_alert_sent title=%s company=%s score=%s",
                job.title, job.company, score.overall,
            )
        else:
            LOGGER.info(
                "kafka_below_threshold title=%s score=%s timeline=%s location=%s",
                job.title, score.overall, score.timeline_relevance, score.location_relevance,
            )
