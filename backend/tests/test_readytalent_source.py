import base64
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import pytest
import yaml

from main import fetch_all_jobs
from opportunity_insights import classify_opportunity_type
from scoring import is_actionable_candidate, score_job
from sources.readytalent import (
    AAD,
    DASHBOARD_URL,
    KEY_ENV,
    decode_key,
    fetch_readytalent,
    job_url,
)

FIXTURES = Path(__file__).parent / "fixtures"
# Fixture written by the extension's own JavaScript (sync.js -> WebCrypto AES-GCM),
# encrypted with this throwaway test key (bytes 0..31). Proves the browser side and
# this decryptor agree on format, IV, tag and AAD.
EXTENSION_FIXTURE = FIXTURES / "readytalent_inbox_from_extension.json"
TEST_KEY = base64.b64encode(bytes(range(32))).decode()
NOW = datetime(2026, 11, 7, 8, 0, tzinfo=timezone.utc)
CONFIG_PATH = Path(__file__).parent.parent / "config.example.yaml"


def _encrypt(payload: dict, key_b64: str) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    iv = os.urandom(12)
    ct = AESGCM(base64.b64decode(key_b64)).encrypt(iv, json.dumps(payload).encode(), AAD)
    return {
        "format": "readytalent-inbox",
        "v": 1,
        "alg": "AES-256-GCM",
        "iv": base64.b64encode(iv).decode(),
        "ciphertext": base64.b64encode(ct).decode(),
    }


def _item(job_id, title, **extra):
    base = {
        "id": job_id,
        "title": title,
        "company": "ACME PTE. LTD.",
        "close": "31/12/2026",
        "salary": "$1,200",
        "vacancies": "1",
        "type": "Full-time/Part-time Jobs",
        "programmes": [],
    }
    base.update(extra)
    return base


@pytest.fixture(autouse=True)
def _clear_key(monkeypatch):
    monkeypatch.delenv(KEY_ENV, raising=False)


def test_decrypts_snapshot_written_by_extension(monkeypatch):
    pytest.importorskip("cryptography")
    monkeypatch.setenv(KEY_ENV, TEST_KEY)

    jobs = fetch_readytalent(EXTENSION_FIXTURE, now=NOW)

    titles = {job.title for job in jobs}
    assert "Applied AI Engineering Intern (DATO)" in titles
    assert "AI assisted image recognition for dimensioning" in titles
    # Closed listings (close date in the past) are dropped.
    assert "Data Analyst Intern (closed)" not in titles
    assert len(jobs) == 3

    dato = next(job for job in jobs if "DATO" in job.title)
    assert dato.source == "ReadyTalent"
    assert dato.company == "NHG POPULATION HEALTH"
    assert dato.location == "Singapore"
    assert dato.url == f"{DASHBOARD_URL}#job=74b3003a-54b6-f111-aaae-002248ecbd52"
    assert "Applications close: 28/04/2027" in dato.description
    assert "BSc (Hons) Applied Artificial Intelligence" in dato.description
    assert dato.metadata["readytalent_id"] == "74b3003a-54b6-f111-aaae-002248ecbd52"


def test_each_listing_gets_a_unique_url_so_dedup_keeps_them_apart(monkeypatch, tmp_path):
    pytest.importorskip("cryptography")
    monkeypatch.setenv(KEY_ENV, TEST_KEY)
    inbox = tmp_path / "inbox.json"
    payload = {
        "generated_at": NOW.isoformat(),
        "jobs": [_item("a1", "Data Engineering Intern"), _item("b2", "AI Engineer Intern")],
    }
    inbox.write_text(json.dumps(_encrypt(payload, TEST_KEY)))

    config = {"sources": {"readytalent": {"enabled": True, "inbox_path": str(inbox)}}}
    jobs, counts = fetch_all_jobs(config, client=None)

    assert counts == {"ReadyTalent": 2}
    assert sorted(job.url for job in jobs) == [job_url("a1"), job_url("b2")]


def test_full_time_part_time_label_does_not_zero_the_role_score(monkeypatch, tmp_path):
    pytest.importorskip("cryptography")
    monkeypatch.setenv(KEY_ENV, TEST_KEY)
    inbox = tmp_path / "inbox.json"
    inbox.write_text(json.dumps(_encrypt({"jobs": [_item("x", "Data Engineering Intern")]}, TEST_KEY)))
    config = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))

    (job,) = fetch_readytalent(inbox, now=NOW)
    score = score_job(job, config, now=NOW)

    assert "full-time" not in job.description.lower()
    assert score.role_relevance >= 70
    assert score.location_relevance >= 70


def test_readytalent_internships_flow_into_alerts(monkeypatch):
    pytest.importorskip("cryptography")
    monkeypatch.setenv(KEY_ENV, TEST_KEY)
    config = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8"))

    jobs = {job.title: job for job in fetch_readytalent(EXTENSION_FIXTURE, now=NOW)}
    dato = jobs["Applied AI Engineering Intern (DATO)"]
    score = score_job(dato, config, now=NOW)

    assert classify_opportunity_type(dato, config) == "job_posting"
    assert is_actionable_candidate(dato, score, config)


def test_missing_key_skips_source(tmp_path):
    jobs = fetch_readytalent(EXTENSION_FIXTURE, now=NOW)
    assert jobs == []


def test_wrong_key_skips_source(monkeypatch):
    pytest.importorskip("cryptography")
    monkeypatch.setenv(KEY_ENV, base64.b64encode(b"\x01" * 32).decode())
    assert fetch_readytalent(EXTENSION_FIXTURE, now=NOW) == []


def test_missing_inbox_returns_nothing(tmp_path):
    assert fetch_readytalent(tmp_path / "nope.json", now=NOW) == []


def test_plaintext_inbox_supported_for_local_runs(tmp_path):
    inbox = tmp_path / "inbox.json"
    inbox.write_text(json.dumps({"jobs": [_item("p1", "Software Engineer Intern")]}))

    (job,) = fetch_readytalent(inbox, now=NOW)

    assert job.title == "Software Engineer Intern"
    assert job.url == job_url("p1")


def test_decode_key_accepts_url_safe_and_unpadded_base64():
    raw = bytes(range(32))
    assert decode_key(base64.urlsafe_b64encode(raw).decode().rstrip("=")) == raw
    with pytest.raises(ValueError):
        decode_key(base64.b64encode(b"short").decode())


def test_readytalent_kept_out_of_public_dashboard_export(monkeypatch, tmp_path):
    import export_jobs
    from database import init_db, record_discovery
    from job_model import Job

    db = tmp_path / "jobs.sqlite3"
    out = tmp_path / "docs" / "jobs.json"
    init_db(str(db))
    record_discovery(
        str(db),
        Job(source="ReadyTalent", title="Data Engineering Intern", company="NHG",
            location="Singapore", url=job_url("rt1")),
    )
    record_discovery(
        str(db),
        Job(source="greenhouse:grab", title="Data Engineering Intern", company="Grab",
            location="Singapore", url="https://job-boards.greenhouse.io/grab/jobs/1"),
    )
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(export_jobs, "_DB_PATH", str(db))
    monkeypatch.setattr(export_jobs, "_CONFIG_PATH", str(CONFIG_PATH))
    monkeypatch.setattr(export_jobs, "_OUTPUT_PATH", str(out))

    export_jobs.main()

    sources = {job["source"] for job in json.loads(out.read_text())["jobs"]}
    assert "ReadyTalent" not in sources
    assert "greenhouse:grab" in sources
