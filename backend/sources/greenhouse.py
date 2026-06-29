from __future__ import annotations

from datetime import datetime, timezone
from dateutil.parser import isoparse

from http_client import PoliteHttpClient
from job_model import Job


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = isoparse(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def fetch_greenhouse_boards(
    boards: list[str], client: PoliteHttpClient | None = None
) -> list[Job]:
    jobs: list[Job] = []
    client = client or PoliteHttpClient(user_agent="SGInternshipJobMonitor/1.0")

    for board in boards:
        url = f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs?content=true"
        try:
            response = client.get(url)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            data = response.json()
        except Exception:
            continue

        for item in data.get("jobs", []):
            offices = item.get("offices") or []
            locations = []
            for office in offices:
                if office.get("name"):
                    locations.append(office["name"])

            location = ", ".join(locations) or (item.get("location") or {}).get("name", "")

            jobs.append(
                Job(
                    source=f"Greenhouse:{board}",
                    title=item.get("title", ""),
                    company=board,
                    location=location,
                    url=item.get("absolute_url", ""),
                    posted_at=_parse_datetime(item.get("updated_at")),
                    description=item.get("content", "")[:3000],
                )
            )

    return [j for j in jobs if j.title and j.url]
