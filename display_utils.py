from __future__ import annotations

from datetime import datetime, timezone

from time_utils import format_singapore_time


ACRONYMS = {
    "ai",
    "api",
    "apac",
    "apjc",
    "aws",
    "bi",
    "cxs",
    "dbs",
    "dso",
    "dsta",
    "etl",
    "gcp",
    "genai",
    "gic",
    "hr",
    "htx",
    "ibm",
    "imc",
    "imda",
    "it",
    "llm",
    "ml",
    "nlp",
    "ocbc",
    "ogp",
    "qa",
    "rag",
    "sg",
    "sme",
    "sql",
    "sre",
    "ubs",
    "uob",
}

COMPANY_DISPLAY = {
    "accenture": "Accenture",
    "airbnb": "Airbnb",
    "anthropic": "Anthropic",
    "apple": "Apple",
    "atlassian": "Atlassian",
    "bytedance": "ByteDance",
    "canva": "Canva",
    "cloudflare": "Cloudflare",
    "csit": "CSIT",
    "databricks": "Databricks",
    "dbs": "DBS",
    "dsta": "DSTA",
    "figma": "Figma",
    "gic": "GIC",
    "google": "Google",
    "govtech": "GovTech",
    "govtech singapore": "GovTech Singapore",
    "grab": "Grab",
    "ibm": "IBM",
    "imc": "IMC",
    "internsg": "InternSG",
    "jpmorgan": "JPMorgan",
    "mongodb": "MongoDB",
    "nvidia": "NVIDIA",
    "ocbc": "OCBC",
    "openai": "OpenAI",
    "open government products": "Open Government Products",
    "ogp": "OGP",
    "sap": "SAP",
    "sea": "Sea",
    "shopee": "Shopee",
    "stripe": "Stripe",
    "tiktok": "TikTok",
    "uob": "UOB",
    "visa": "Visa",
    "wise": "Wise",
    "workato": "Workato",
}


def display_text(value: str) -> str:
    parts = str(value or "").replace("_", " ").split()
    if not parts:
        return ""

    formatted = []
    for part in parts:
        separators = ["/", "-"]
        token = part
        for separator in separators:
            if separator in token:
                token = separator.join(_format_word(piece) for piece in token.split(separator))
                break
        else:
            token = _format_word(token)
        formatted.append(token)
    return " ".join(formatted)


def display_company(company: str) -> str:
    raw = str(company or "").strip()
    mapped = COMPANY_DISPLAY.get(raw.lower())
    if mapped:
        return mapped
    return display_text(raw)


def display_title(title: str) -> str:
    return display_text(title)


def display_source(source: str) -> str:
    raw = str(source or "").strip()
    if ":" in raw:
        provider, name = raw.split(":", 1)
        return f"{display_text(provider)}: {display_company(name)}"
    return display_text(raw)


def posted_date(job_posted_at: datetime | None) -> str:
    if not job_posted_at:
        return "Unknown"
    posted = job_posted_at
    if posted.tzinfo is None:
        posted = posted.replace(tzinfo=timezone.utc)
    return format_singapore_time(posted)


def _format_word(word: str) -> str:
    lowered = word.lower()
    stripped = lowered.strip("()[]{}.,")
    if stripped in ACRONYMS:
        return word.replace(stripped, stripped.upper())
    if stripped in COMPANY_DISPLAY:
        return word.replace(stripped, COMPANY_DISPLAY[stripped])
    return word[:1].upper() + word[1:].lower()
