from datetime import datetime, timezone

from display_utils import display_company, display_source, display_title, posted_date


def test_display_title_preserves_common_tech_acronyms():
    assert display_title("data engineering intern - rag and llm") == "Data Engineering Intern - RAG And LLM"
    assert display_title("ai/ml engineer intern") == "AI/ML Engineer Intern"


def test_display_title_removes_adjacent_duplicate_words():
    assert display_title("Data Analytics & Engineering Intern Intern") == "Data Analytics & Engineering Intern"


def test_display_company_formats_known_slugs():
    assert display_company("workato") == "Workato"
    assert display_company("govtech singapore") == "GovTech Singapore"
    assert display_company("DSTA") == "DSTA"
    assert display_company("globalfoundries") == "GlobalFoundries"
    assert display_company("mediatek") == "MediaTek"
    assert display_company("asml") == "ASML"
    assert display_company("shopback") == "ShopBack"
    assert display_company("m-daq") == "M-DAQ"
    assert display_company("synapxe") == "Synapxe"
    assert display_company("monee") == "Monee"
    assert display_company("seamoney") == "SeaMoney"
    assert display_company("maribank") == "MariBank"


def test_display_source_formats_provider_and_company():
    assert display_source("Greenhouse:workato") == "Greenhouse: Workato"
    assert display_source("CareersPage:Western Digital") == "Careers Page: Western Digital"
    assert display_source("InternSG") == "InternSG"


def test_posted_date_formats_singapore_time():
    assert posted_date(datetime(2026, 6, 14, 0, 0, tzinfo=timezone.utc)).endswith("SGT")
    assert posted_date(None) == "Unknown"
