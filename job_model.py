from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class Job:
    source: str
    title: str
    company: str
    location: str
    url: str
    posted_at: Optional[datetime] = None
    description: str = ""
    metadata: dict[str, str] = field(default_factory=dict)

    @property
    def stable_id(self) -> str:
        return f"{self.source}|{self.company}|{self.title}|{self.url}".lower()
