from __future__ import annotations

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


def _matches(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def _clean_title(title: str) -> str:
    return title.strip().lstrip("> ").strip()


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

            jobs.append(
                Job(
                    source=f"CareersPage:{name}",
                    title=title[:200],
                    company=company,
                    location=str(page.get("default_location") or ""),
                    url=href,
                    posted_at=None,
                    description=surrounding[:2000],
                )
            )

    unique = {}
    for job in jobs:
        unique[job.url.lower()] = job
    return list(unique.values())
