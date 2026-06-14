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


def _location_name(value: object) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return str(value.get("name") or value.get("location") or "")
    return ""


def fetch_ashby_boards(
    boards: list[str], client: PoliteHttpClient | None = None
) -> list[Job]:
    jobs: list[Job] = []
    client = client or PoliteHttpClient(user_agent="SGInternshipJobMonitor/1.0")

    for board in boards:
        url = f"https://api.ashbyhq.com/posting-api/job-board/{board}"
        try:
            response = client.get(url)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            data = response.json()
        except Exception:
            continue

        for item in data.get("jobs", []):
            description_parts = [
                item.get("descriptionPlain") or "",
                item.get("descriptionHtml") or "",
                item.get("department") or "",
                item.get("team") or "",
                item.get("employmentType") or "",
            ]
            job_url = item.get("jobUrl") or item.get("applyUrl") or ""

            jobs.append(
                Job(
                    source=f"Ashby:{board}",
                    title=item.get("title", ""),
                    company=board,
                    location=_location_name(item.get("location")),
                    url=job_url,
                    posted_at=_parse_datetime(
                        item.get("publishedAt")
                        or item.get("postedAt")
                        or item.get("updatedAt")
                    ),
                    description=" ".join(description_parts)[:3000],
                )
            )

    return [j for j in jobs if j.title and j.url]
