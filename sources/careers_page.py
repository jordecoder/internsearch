from __future__ import annotations

import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from http_client import PoliteHttpClient
from job_model import Job


DEFAULT_LINK_TERMS = [
    "intern",
    "internship",
    "software",
    "engineer",
    "machine learning",
    "data",
    "ai",
    "analytics",
    "graduate",
    "university",
]


LOCATION_LABELS = [
    "work location",
    "location",
    "job location",
    "primary location",
]


def _matches(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def _clean_title(title: str) -> str:
    return title.strip().lstrip("> ").strip()


def _extract_location_from_text(text: str) -> str:
    compact = " ".join(text.split())
    for label in LOCATION_LABELS:
        pattern = rf"{label}\s*:\s*([^|;\n\r]+?)(?=\s{{2,}}| Company Description| Job Description|$)"
        match = re.search(pattern, compact, flags=re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return ""


def _fetch_job_detail(
    href: str,
    client: PoliteHttpClient,
) -> tuple[str, str]:
    try:
        response = client.get(href)
        if response.status_code == 404:
            return "", ""
        response.raise_for_status()
    except Exception:
        return "", ""

    soup = BeautifulSoup(response.text, "html.parser")
    page_text = soup.get_text(" ", strip=True)
    return _extract_location_from_text(page_text), page_text[:2000]


def fetch_careers_pages(
    pages: list[dict[str, object]], client: PoliteHttpClient | None = None
) -> list[Job]:
    jobs: list[Job] = []
    client = client or PoliteHttpClient(user_agent="SGInternshipJobMonitor/1.0")

    for page in pages:
        name = str(page.get("name") or page.get("company") or "Company")
        company = str(page.get("company") or name)
        url = str(page.get("url") or "")
        if not url:
            continue

        terms = page.get("keywords")
        keywords = [str(term) for term in terms] if isinstance(terms, list) else DEFAULT_LINK_TERMS

        try:
            response = client.get(url)
            if response.status_code == 404:
                continue
            response.raise_for_status()
        except Exception:
            continue

        soup = BeautifulSoup(response.text, "html.parser")
        for link in soup.find_all("a", href=True):
            raw_href = link["href"].strip()
            if raw_href.startswith(("#", "mailto:", "tel:")):
                continue

            title = _clean_title(link.get_text(" ", strip=True))
            href = urljoin(url, raw_href)
            surrounding = link.parent.get_text(" ", strip=True) if link.parent else title
            text = f"{title} {href}"
            if not title or not _matches(text, keywords):
                continue

            detail_location, detail_description = _fetch_job_detail(href, client)
            location = detail_location or str(page.get("default_location") or "")
            description = detail_description or surrounding[:2000]

            jobs.append(
                Job(
                    source=f"CareersPage:{name}",
                    title=title[:200],
                    company=company,
                    location=location,
                    url=href,
                    posted_at=None,
                    description=description,
                )
            )

    unique = {}
    for job in jobs:
        unique[job.url.lower()] = job
    return list(unique.values())
