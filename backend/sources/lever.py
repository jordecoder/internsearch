from __future__ import annotations

from datetime import datetime, timezone

from http_client import PoliteHttpClient
from job_model import Job


def _parse_created_at(value: int | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    except Exception:
        return None


def fetch_lever_companies(
    companies: list[str], client: PoliteHttpClient | None = None
) -> list[Job]:
    jobs: list[Job] = []
    client = client or PoliteHttpClient(user_agent="SGInternshipJobMonitor/1.0")

    for company in companies:
        url = f"https://api.lever.co/v0/postings/{company}?mode=json"
        try:
            response = client.get(url)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            data = response.json()
        except Exception:
            continue

        for item in data:
            categories = item.get("categories") or {}
            location = categories.get("location", "")
            commitment = categories.get("commitment", "")
            team = categories.get("team", "")

            description_parts = [
                item.get("descriptionPlain", ""),
                commitment,
                team,
            ]

            jobs.append(
                Job(
                    source=f"Lever:{company}",
                    title=item.get("text", ""),
                    company=company,
                    location=location,
                    url=item.get("hostedUrl", ""),
                    posted_at=_parse_created_at(item.get("createdAt")),
                    description=" ".join(description_parts)[:3000],
                )
            )

    return [j for j in jobs if j.title and j.url]
