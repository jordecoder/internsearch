from __future__ import annotations

import json

import pytest

import career_scoring
from career_scoring import (
    CareerScore,
    fallback_career_score,
    get_or_score_career_fit,
    score_career_fit,
)
from database import get_career_score, init_db
from job_model import Job
from scoring import Score

PROFILE = {
    "target_career_paths": ["Data Engineer", "AI Engineer / Applied AI Engineer"],
    "excluded_career_paths": ["Data Analyst", "Business Analyst"],
    "education": ["BSc Computing Science"],
    "professional_experience": ["Data Engineering Intern"],
    "ai_experience": ["Agentic RAG platform"],
    "career_projects": [{"name": "Intern Search", "description": "multi-source pipeline"}],
    "technical_skills": ["Python", "SQL", "PostgreSQL"],
}


def _job(**kwargs):
    defaults = dict(
        source="Greenhouse:acme",
        title="Data Platform Engineer Intern",
        company="Acme",
        location="Singapore",
        url="https://example.com/job",
        description="Build ingestion pipelines and data infrastructure.",
    )
    return Job(**{**defaults, **kwargs})


def _score(**kwargs):
    defaults = dict(
        role_relevance=80,
        skill_relevance=70,
        location_relevance=90,
        timeline_relevance=85,
        degree_relevance=60,
        overall=76,
        timeline_match="2027 internship",
    )
    return Score(**{**defaults, **kwargs})


class FakeResponse:
    def __init__(self, payload: dict):
        self.text = json.dumps(payload)


def test_score_career_fit_returns_none_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert score_career_fit(_job(), PROFILE) is None


def test_score_career_fit_parses_valid_response(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    payload = {
        "career_direction_fit": 28,
        "technical_match": 20,
        "evidence_strength": 12,
        "engineering_depth": 9,
        "career_value": 9,
        "eligibility": 9,
        "bonus_penalty": 5,
        "final_score": 92,
        "classification": "Strong Target",
        "primary_track": "Data Engineering",
        "why_it_matches": "Directly builds data infrastructure matching your target path.",
        "main_gap": "No Kafka experience shown.",
        "recommendation": "APPLY IMMEDIATELY",
    }

    class FakeModel:
        def __init__(self, *_a, **_kw):
            pass

        def generate_content(self, prompt):
            assert "Data Engineer" in prompt
            assert "Data Analyst" in prompt  # excluded paths still shown to the model
            return FakeResponse(payload)

    import google.generativeai as genai

    monkeypatch.setattr(genai, "GenerativeModel", FakeModel)
    monkeypatch.setattr(genai, "configure", lambda **_kw: None)

    result = score_career_fit(_job(), PROFILE)
    assert result is not None
    assert result.final_score == 92
    assert result.classification == "Strong Target"
    assert result.primary_track == "Data Engineering"
    assert result.source == "llm"


def test_score_career_fit_clamps_out_of_range_values(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    payload = {
        "career_direction_fit": 999,
        "technical_match": -50,
        "evidence_strength": 15,
        "engineering_depth": 10,
        "career_value": 10,
        "eligibility": 10,
        "bonus_penalty": 500,
        "final_score": 500,
        "classification": "not a real classification",
        "primary_track": "not a real track",
        "why_it_matches": "x",
        "main_gap": "y",
        "recommendation": "not a real recommendation",
    }

    class FakeModel:
        def __init__(self, *_a, **_kw):
            pass

        def generate_content(self, _prompt):
            return FakeResponse(payload)

    import google.generativeai as genai

    monkeypatch.setattr(genai, "GenerativeModel", FakeModel)
    monkeypatch.setattr(genai, "configure", lambda **_kw: None)

    result = score_career_fit(_job(), PROFILE)
    assert result is not None
    assert result.career_direction_fit == 30  # clamped to max
    assert result.technical_match == 0  # clamped to min
    assert result.final_score == 100  # clamped to max
    assert result.classification in career_scoring.CLASSIFICATIONS
    assert result.primary_track in career_scoring.TRACKS
    assert result.recommendation in career_scoring.RECOMMENDATIONS


def test_score_career_fit_returns_none_on_gemini_error(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    class FailingModel:
        def __init__(self, *_a, **_kw):
            pass

        def generate_content(self, _prompt):
            raise RuntimeError("network error")

    import google.generativeai as genai

    monkeypatch.setattr(genai, "GenerativeModel", FailingModel)
    monkeypatch.setattr(genai, "configure", lambda **_kw: None)

    assert score_career_fit(_job(), PROFILE) is None


def test_score_career_fit_returns_none_on_malformed_json(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")

    class BadResponse:
        text = "not json at all {{"

    class BadModel:
        def __init__(self, *_a, **_kw):
            pass

        def generate_content(self, _prompt):
            return BadResponse()

    import google.generativeai as genai

    monkeypatch.setattr(genai, "GenerativeModel", BadModel)
    monkeypatch.setattr(genai, "configure", lambda **_kw: None)

    assert score_career_fit(_job(), PROFILE) is None


def test_fallback_deprioritizes_analyst_roles():
    analyst_job = _job(
        title="Data Analyst Intern",
        description="Build dashboards, run ad-hoc SQL analysis, present business insights to stakeholders.",
    )
    engineer_job = _job(
        title="Data Platform Engineer Intern",
        description="Design and build backend data pipelines and infrastructure APIs.",
    )
    score = _score()

    analyst_result = fallback_career_score(analyst_job, score)
    engineer_result = fallback_career_score(engineer_job, score)

    assert analyst_result.source == "fallback"
    assert analyst_result.career_direction_fit < engineer_result.career_direction_fit
    assert analyst_result.final_score < engineer_result.final_score
    assert analyst_result.classification in career_scoring.CLASSIFICATIONS


def test_get_or_score_career_fit_caches_across_calls(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)  # forces fallback, but caching is what's under test
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)
    job = _job()
    score = _score()

    call_count = {"n": 0}
    real_fallback = career_scoring.fallback_career_score

    def counting_fallback(*args, **kwargs):
        call_count["n"] += 1
        return real_fallback(*args, **kwargs)

    monkeypatch.setattr(career_scoring, "fallback_career_score", counting_fallback)

    first = get_or_score_career_fit(db_path, job, score, PROFILE)
    second = get_or_score_career_fit(db_path, job, score, PROFILE)

    assert call_count["n"] == 1  # only scored once — second call hit the cache
    assert first.final_score == second.final_score
    assert get_career_score(db_path, job.stable_id) is not None


def test_get_or_score_career_fit_recovers_from_corrupt_cache(tmp_path, monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    db_path = str(tmp_path / "jobs.sqlite3")
    init_db(db_path)
    job = _job()
    score = _score()

    from database import save_career_score

    save_career_score(db_path, job.stable_id, "not valid json {{")

    result = get_or_score_career_fit(db_path, job, score, PROFILE)
    assert isinstance(result, CareerScore)
