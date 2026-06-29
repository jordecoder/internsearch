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


def fetch_smartrecruiters_companies(
    companies: list[str], client: PoliteHttpClient | None = None
) -> list[Job]:
    jobs: list[Job] = []
    client = client or PoliteHttpClient(user_agent="SGInternshipJobMonitor/1.0")

    for company in companies:
        url = f"https://api.smartrecruiters.com/v1/companies/{company}/postings?limit=100"
        try:
            response = client.get(url)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            data = response.json()
        except Exception:
            continue

        for item in data.get("content", []):
            location = item.get("location") or {}
            location_name = location.get("city") or location.get("country") or ""
            jobs.append(
                Job(
                    source=f"SmartRecruiters:{company}",
                    title=item.get("name", ""),
                    company=company,
                    location=location_name,
                    url=item.get("ref") or item.get("postingUrl") or "",
                    posted_at=_parse_datetime(item.get("releasedDate")),
                    description=" ".join(
                        [
                            item.get("name", ""),
                            item.get("department", {}).get("label", ""),
                            item.get("typeOfEmployment", {}).get("label", ""),
                        ]
                    )[:3000],
                )
            )

    return [j for j in jobs if j.title and j.url]
