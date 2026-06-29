from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urljoin

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


def _location(item: dict) -> str:
    locations = item.get("locationsText")
    if locations:
        return str(locations)
    primary = item.get("primaryLocation") or {}
    if isinstance(primary, dict):
        return str(primary.get("displayName") or primary.get("name") or "")
    return str(primary or "")


def fetch_workday_sites(
    sites: list[dict[str, object]], client: PoliteHttpClient | None = None
) -> list[Job]:
    jobs: list[Job] = []
    client = client or PoliteHttpClient(user_agent="SGInternshipJobMonitor/1.0")

    for site in sites:
        name = str(site.get("name") or site.get("company") or "Workday")
        company = str(site.get("company") or name)
        endpoint = str(site.get("endpoint") or "")
        career_base_url = str(site.get("career_base_url") or "")
        if not endpoint:
            continue

        payload = site.get("payload")
        if not isinstance(payload, dict):
            payload = {
                "appliedFacets": {},
                "limit": int(site.get("limit") or 100),
                "offset": 0,
                "searchText": str(site.get("search_text") or ""),
            }

        try:
            response = client.post(
                endpoint,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        except Exception:
            continue

        for item in data.get("jobPostings", []):
            external_path = item.get("externalPath") or item.get("url") or ""
            url = urljoin(career_base_url, external_path) if career_base_url else external_path
            jobs.append(
                Job(
                    source=f"Workday:{name}",
                    title=item.get("title", ""),
                    company=company,
                    location=_location(item),
                    url=url,
                    posted_at=_parse_datetime(
                        item.get("postedOn")
                        or item.get("startDate")
                        or item.get("postedOnDate")
                    ),
                    description=" ".join(
                        [
                            item.get("title", ""),
                            item.get("bulletFields", "") if isinstance(item.get("bulletFields"), str) else "",
                            item.get("timeType", ""),
                            item.get("workerSubType", ""),
                        ]
                    )[:3000],
                )
            )

    return [j for j in jobs if j.title and j.url]
