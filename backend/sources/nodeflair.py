from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from http_client import PoliteHttpClient
from job_model import Job

_BASE_URL = "https://nodeflair.com"
_JOBS_URL = f"{_BASE_URL}/jobs"
_BROWSER_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://nodeflair.com/",
}


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None


def _jobs_from_next_data(data: dict) -> list[dict]:
    page_props = data.get("props", {}).get("pageProps", {})
    for key in ("jobs", "listings", "results"):
        val = page_props.get(key)
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            for subkey in ("jobs", "listings", "results", "items"):
                sub = val.get(subkey)
                if isinstance(sub, list):
                    return sub
    return []


def _parse_next_data(html: str) -> list[Job]:
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        return []
    try:
        raw = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    job_dicts = _jobs_from_next_data(raw)
    jobs = []
    for item in job_dicts:
        title = str(item.get("title") or item.get("jobTitle") or "").strip()
        company = str(
            item.get("company") or item.get("companyName") or item.get("company_name") or "Unknown"
        ).strip()
        location = str(item.get("location") or item.get("country") or "Singapore").strip()

        url = str(item.get("url") or item.get("jobUrl") or item.get("job_url") or "").strip()
        if not url:
            slug = str(item.get("slug") or item.get("id") or "").strip()
            company_slug = str(
                item.get("companySlug") or item.get("company_slug") or company.lower().replace(" ", "-")
            )
            if slug:
                url = f"{_BASE_URL}/companies/{company_slug}/jobs/{slug}"
        elif not url.startswith("http"):
            url = urljoin(_BASE_URL, url)

        if not title or not url:
            continue

        posted_at = _parse_date(
            item.get("createdAt") or item.get("posted_at") or item.get("postedAt")
        )

        desc_parts = []
        for field in ("description", "summary", "requirements"):
            val = item.get(field)
            if isinstance(val, str) and val:
                desc_parts.append(val)
        skills = item.get("skills") or item.get("techStack") or item.get("tech_stack")
        if isinstance(skills, list):
            desc_parts.append(" ".join(str(s) for s in skills))
        elif isinstance(skills, str) and skills:
            desc_parts.append(skills)
        salary = item.get("salary") or item.get("salaryRange") or item.get("salary_range")
        if salary:
            desc_parts.append(f"Salary: {salary}")

        jobs.append(
            Job(
                source="NodeFlair",
                title=title[:200],
                company=company,
                location=location,
                url=url,
                posted_at=posted_at,
                description=" ".join(desc_parts)[:3000],
            )
        )
    return jobs


def _parse_html_cards(html: str) -> list[Job]:
    soup = BeautifulSoup(html, "html.parser")
    jobs = []
    for card in soup.select(
        "[data-testid*='job'], [data-cy*='job'], .job-card, .job-listing, "
        ".jobCard, .listing-card, article"
    ):
        link = card.find("a", href=re.compile(r"/companies/.+/jobs/|/jobs/view/"))
        if not link:
            continue
        title_el = card.find(["h2", "h3", "h4"]) or card.find(
            class_=re.compile(r"title|heading", re.I)
        )
        title = (title_el.get_text(strip=True) if title_el else link.get_text(strip=True))
        if not title:
            continue
        href = str(link.get("href", ""))
        url = urljoin(_BASE_URL, href)
        description = card.get_text(" ", strip=True)[:2000]
        jobs.append(
            Job(
                source="NodeFlair",
                title=title[:200],
                company="Unknown",
                location="Singapore",
                url=url,
                posted_at=None,
                description=description,
            )
        )
    return jobs


def fetch_nodeflair_jobs(
    searches: list[dict], client: PoliteHttpClient | None = None
) -> list[Job]:
    client = client or PoliteHttpClient(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0.0.0 Safari/537.36"
        ),
        delay_seconds=3.0,
    )

    all_jobs: list[Job] = []

    for search in searches:
        query = str(search.get("query", "intern"))
        location = str(search.get("location", "Singapore"))
        seniority = str(search.get("seniority", "Intern"))

        params: dict[str, object] = {
            "query": query,
            "countries[]": location,
            "seniorities[]": seniority,
        }
        try:
            response = client.get(_JOBS_URL, params=params, headers=_BROWSER_HEADERS)
            if response.status_code in (401, 403, 429, 999):
                break
            if response.status_code == 404:
                continue
            response.raise_for_status()
        except Exception:
            continue

        jobs = _parse_next_data(response.text)
        if not jobs:
            jobs = _parse_html_cards(response.text)
        all_jobs.extend(jobs)

    unique = {job.url.lower(): job for job in all_jobs}
    return list(unique.values())
