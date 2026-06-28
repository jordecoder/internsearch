from __future__ import annotations

import logging
import os

from confluent_kafka import Producer
from confluent_kafka.admin import AdminClient, NewTopic

from pipeline.schemas import TOPIC, JobEvent

LOGGER = logging.getLogger(__name__)


def _build_config() -> dict:
    """Build confluent-kafka config from environment variables.

    For Confluent Cloud set:
        KAFKA_BOOTSTRAP_SERVERS  e.g. pkc-xxxx.us-east-1.aws.confluent.cloud:9092
        KAFKA_API_KEY            Confluent Cloud API key
        KAFKA_API_SECRET         Confluent Cloud API secret

    For local Docker (no credentials needed):
        KAFKA_BOOTSTRAP_SERVERS  localhost:9092
    """
    servers = os.environ["KAFKA_BOOTSTRAP_SERVERS"]
    cfg: dict = {
        "bootstrap.servers": servers,
        "client.id": "internsearch-producer",
        # Retry config for reliability
        "retries": 5,
        "retry.backoff.ms": 500,
        "acks": "all",
    }
    key = os.getenv("KAFKA_API_KEY")
    secret = os.getenv("KAFKA_API_SECRET")
    if key and secret:
        # KAFKA_SASL_MECHANISM:
        #   PLAIN          → Confluent Cloud (default)
        #   SCRAM-SHA-256  → Upstash Kafka (free tier)
        mechanism = os.getenv("KAFKA_SASL_MECHANISM", "PLAIN")
        cfg.update({
            "security.protocol": "SASL_SSL",
            "sasl.mechanisms": mechanism,
            "sasl.username": key,
            "sasl.password": secret,
        })
    return cfg


def _ensure_topic(cfg: dict) -> None:
    admin = AdminClient(cfg)
    meta = admin.list_topics(timeout=10)
    if TOPIC not in meta.topics:
        fs = admin.create_topics([
            NewTopic(TOPIC, num_partitions=3, replication_factor=1)
        ])
        for topic, future in fs.items():
            try:
                future.result()
                LOGGER.info("kafka_topic_created topic=%s", topic)
            except Exception as exc:
                # Topic may already exist in a race — not fatal
                LOGGER.warning("kafka_topic_create_warning topic=%s error=%s", topic, exc)


class JobProducer:
    """Publishes JobEvent messages to the internship-jobs Kafka topic."""

    def __init__(self) -> None:
        cfg = _build_config()
        _ensure_topic(cfg)
        self._producer = Producer(cfg)
        self._published = 0
        self._failed = 0

    def publish(self, event: JobEvent) -> None:
        self._producer.produce(
            topic=TOPIC,
            # URL as key → same job always lands on same partition → ordering guaranteed
            key=event.url.encode(),
            value=event.to_bytes(),
            on_delivery=self._on_delivery,
        )
        # Non-blocking poll to trigger delivery callbacks without waiting
        self._producer.poll(0)

    def flush(self) -> None:
        """Wait for all in-flight messages to be delivered before exiting."""
        remaining = self._producer.flush(timeout=60)
        if remaining:
            LOGGER.warning("kafka_flush_timeout remaining_messages=%s", remaining)
        LOGGER.info(
            "kafka_producer_flush_complete published=%s failed=%s",
            self._published,
            self._failed,
        )

    def _on_delivery(self, err, msg) -> None:
        if err:
            self._failed += 1
            LOGGER.error(
                "kafka_delivery_failed error=%s topic=%s key=%s",
                err,
                msg.topic(),
                msg.key(),
            )
        else:
            self._published += 1
            LOGGER.debug(
                "kafka_delivered topic=%s partition=%s offset=%s key=%s",
                msg.topic(),
                msg.partition(),
                msg.offset(),
                msg.key().decode() if msg.key() else None,
            )
