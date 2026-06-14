from __future__ import annotations

from bs4 import BeautifulSoup
from urllib.parse import quote_plus, urljoin, urlsplit, urlunsplit

from http_client import PoliteHttpClient
from job_model import Job


BASE_URL = "https://www.internsg.com"


def _canonical_url(url: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def fetch_internsg(
    search_terms: list[str], client: PoliteHttpClient | None = None
) -> list[Job]:
    jobs: list[Job] = []
    client = client or PoliteHttpClient(user_agent="SGInternshipJobMonitor/1.0")

    for term in search_terms:
        url = f"{BASE_URL}/jobs/?f_p={quote_plus(term)}"
        response = client.get(url)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # InternSG layout can change, so use broad selectors.
        for card in soup.select("article, .ast-row, .job, .type-job_listing"):
            text = card.get_text(" ", strip=True)
            link = card.find("a", href=True)
            if not link:
                continue

            title = link.get_text(" ", strip=True) or term
            job_url = _canonical_url(urljoin(BASE_URL, link["href"]))

            # Best-effort extraction. Filtering later removes weak matches.
            company = "Unknown"
            location = "Singapore"

            jobs.append(
                Job(
                    source="InternSG",
                    title=title,
                    company=company,
                    location=location,
                    url=job_url,
                    posted_at=None,
                    description=text[:2000],
                )
            )

    # Deduplicate by URL.
    unique = {}
    for job in jobs:
        unique[job.url] = job
    return list(unique.values())
