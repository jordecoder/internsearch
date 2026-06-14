from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

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


def _value(data: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value:
            return value
        if isinstance(value, dict):
            for nested_key in ("name", "value"):
                nested = value.get(nested_key)
                if isinstance(nested, str) and nested:
                    return nested
    return ""


def fetch_mycareersfuture(
    *,
    endpoint: str,
    search_terms: list[str],
    client: PoliteHttpClient | None = None,
) -> list[Job]:
    if not endpoint:
        return []

    client = client or PoliteHttpClient(user_agent="SGInternshipJobMonitor/1.0")
    jobs: list[Job] = []

    for term in search_terms:
        response = client.get(endpoint, params={"search": term})
        if response.status_code == 404:
            continue
        response.raise_for_status()
        data = response.json()

        items = data.get("results") or data.get("jobs") or data.get("items") or []
        if not isinstance(items, list):
            continue

        for item in items:
            if not isinstance(item, dict):
                continue

            uuid = _value(item, "uuid", "id")
            url = (
                item.get("url")
                or item.get("jobDetailsUrl")
                or (f"https://www.mycareersfuture.gov.sg/job/{uuid}" if uuid else "")
            )

            title = _value(item, "title", "jobTitle", "positionTitle")
            company = _value(item, "company", "employer", "postedCompany")
            location = _value(item, "location", "address") or "Singapore"
            posted = _parse_datetime(
                _value(item, "postedDate", "createdAt", "newPostingDate")
            )

            description = " ".join(
                [
                    _value(item, "description", "jobDescription"),
                    _value(item, "requirements", "jobRequirements"),
                    _value(item, "employmentType"),
                ]
            )

            if title and url:
                jobs.append(
                    Job(
                        source="MyCareersFuture",
                        title=title,
                        company=company or "Unknown",
                        location=location,
                        url=url,
                        posted_at=posted,
                        description=description[:3000],
                    )
                )

    unique = {job.url: job for job in jobs}
    return list(unique.values())
