from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

from job_model import Job

TOPIC = "internship-jobs"
DLQ_TOPIC = "internship-jobs-dlq"


@dataclass
class JobEvent:
    """Kafka message payload for a discovered internship posting."""
    source: str
    title: str
    company: str
    location: str
    url: str
    description: str
    event_type: str = "job_discovered"
    posted_at: str | None = None
    metadata: dict[str, str] = field(default_factory=dict)
    produced_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    # ── serialisation ──────────────────────────────────────────────────────────

    def to_bytes(self) -> bytes:
        return json.dumps(asdict(self), ensure_ascii=False).encode()

    @classmethod
    def from_bytes(cls, data: bytes) -> "JobEvent":
        return cls(**json.loads(data.decode()))

    # ── conversions ────────────────────────────────────────────────────────────

    @classmethod
    def from_job(cls, job: Job) -> "JobEvent":
        return cls(
            source=job.source,
            title=job.title,
            company=job.company,
            location=job.location,
            url=job.url,
            description=job.description,
            posted_at=job.posted_at.isoformat() if job.posted_at else None,
            metadata=dict(job.metadata),
        )

    def to_job(self) -> Job:
        posted = None
        if self.posted_at:
            try:
                posted = datetime.fromisoformat(self.posted_at)
                if posted.tzinfo is None:
                    posted = posted.replace(tzinfo=timezone.utc)
            except ValueError:
                pass
        return Job(
            source=self.source,
            title=self.title,
            company=self.company,
            location=self.location,
            url=self.url,
            description=self.description,
            posted_at=posted,
            metadata=self.metadata,
        )
