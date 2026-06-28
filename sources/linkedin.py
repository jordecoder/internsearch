from __future__ import annotations

import re
from datetime import datetime, timezone

from bs4 import BeautifulSoup

from http_client import PoliteHttpClient
from job_model import Job

_SEARCH_URL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
_BROWSER_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.linkedin.com/",
}


def _clean_url(href: str) -> str:
    match = re.match(r"(https?://[a-z.]*linkedin\.com/jobs/view/\d+)", href)
    return match.group(1) if match else href.split("?")[0]


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value)
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None


def _parse_cards(html: str, fallback_location: str) -> list[Job]:
    soup = BeautifulSoup(html, "html.parser")
    jobs = []
    for card in soup.find_all("li"):
        title_el = card.find(class_="base-search-card__title")
        company_el = card.find(class_="base-search-card__subtitle")
        location_el = card.find(class_="job-search-card__location")
        time_el = card.find("time")
        link_el = card.find("a", href=re.compile(r"linkedin\.com/jobs/view/"))

        title = title_el.get_text(strip=True) if title_el else ""
        company = company_el.get_text(strip=True) if company_el else ""
        location = location_el.get_text(strip=True) if location_el else fallback_location
        href = link_el["href"] if link_el else ""
        posted_at = _parse_date(time_el.get("datetime") if time_el else None)

        if not title or not href:
            continue

        jobs.append(
            Job(
                source="LinkedIn",
                title=title[:200],
                company=company or "Unknown",
                location=location,
                url=_clean_url(href),
                posted_at=posted_at,
                description="",
            )
        )
    return jobs


def fetch_linkedin_jobs(
    searches: list[dict], client: PoliteHttpClient | None = None
) -> list[Job]:
    client = client or PoliteHttpClient(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        delay_seconds=4.0,
    )

    all_jobs: list[Job] = []

    for search in searches:
        keywords = str(search.get("keywords", ""))
        location = str(search.get("location", "Singapore"))
        max_results = int(search.get("max_results", 50))
        time_filter = str(search.get("time_filter", "r604800"))

        start = 0
        while start < max_results:
            params = {
                "keywords": keywords,
                "location": location,
                "f_JT": "I",
                "f_TPR": time_filter,
                "start": start,
                "count": 25,
            }
            try:
                response = client.get(_SEARCH_URL, params=params, headers=_BROWSER_HEADERS)
                if response.status_code in (401, 403, 429, 999):
                    break
                if response.status_code == 404:
                    break
                response.raise_for_status()
            except Exception:
                break

            cards = _parse_cards(response.text, location)
            all_jobs.extend(cards)

            if len(cards) < 25:
                break
            start += 25

    unique = {job.url.lower(): job for job in all_jobs}
    return list(unique.values())
