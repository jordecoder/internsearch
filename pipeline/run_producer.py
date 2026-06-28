"""Fetch all enabled job sources and publish new discoveries to Kafka.

Run manually:  python -m pipeline.run_producer
Run in CI:     python -m pipeline.run_producer --config config.yaml
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# Allow running from repo root without installing as a package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv()

from database import init_db, record_discovery
from main import configure_logging, fetch_all_jobs, load_config, make_client
from pipeline.producer import JobProducer
from pipeline.schemas import JobEvent

LOGGER = logging.getLogger(__name__)


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish job discoveries to Kafka")
    parser.add_argument("--config", default="config.yaml")
    args = parser.parse_args()

    config = load_config(args.config)
    configure_logging(config.get("log_level", "INFO"))

    db_path: str = config.get("database_path", "jobs.sqlite3")
    init_db(db_path)

    LOGGER.info("pipeline_producer_starting")
    client = make_client(config)
    jobs, source_counts = fetch_all_jobs(config, client)
    LOGGER.info("pipeline_fetched total=%s sources=%s", len(jobs), source_counts)

    producer = JobProducer()
    published = new_count = 0

    for job in jobs:
        # Only publish jobs the DB hasn't seen before — dedup happens here,
        # not in the consumer, so the consumer only receives genuinely new postings.
        is_new = record_discovery(db_path, job)
        if not is_new:
            continue
        try:
            producer.publish(JobEvent.from_job(job))
            published += 1
        except Exception:
            LOGGER.exception("pipeline_publish_failed url=%s", job.url)
        new_count += 1

    producer.flush()
    LOGGER.info(
        "pipeline_producer_done new_jobs=%s published=%s total_fetched=%s",
        new_count,
        published,
        len(jobs),
    )


if __name__ == "__main__":
    main()
