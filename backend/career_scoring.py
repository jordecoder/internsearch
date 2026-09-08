"""LLM-based career-fit scoring.

The old `scoring.py` answers "am I qualified for this role" with a cheap,
deterministic keyword formula — it stays exactly as-is and still does the
first-pass eligibility/actionable filtering (fast, free, no network call).

This module answers the harder question the candidate actually cares about:
"does this role move me toward the career I actually want", which needs
semantic judgment a regex formula can't give (recognizing that a "Data
Scientist" role doing LLM system-building is a stronger fit than a "Software
Engineer" role that's really dashboard maintenance). It's an LLM call, so it
runs at most ONCE per job (cached by stable_id — see database.py's
career_scores table) rather than on every pipeline run, and it degrades to
`fallback_career_score()` — never an exception — whenever Gemini isn't
configured or the call fails, so an unattended pipeline run never breaks on
this.
"""
from __future__ import annotations

import json
import logging
import os
import re
import textwrap
from dataclasses import dataclass
from typing import Any

from dataclasses import asdict

from database import get_career_score, save_career_score
from job_model import Job
from opportunity_insights import classify_role_family
from scoring import Score

LOGGER = logging.getLogger(__name__)

_GEN_MODEL = "gemini-2.0-flash"

CLASSIFICATIONS = ("Strong Target", "Target", "Reach", "Fallback", "Skip")
RECOMMENDATIONS = ("APPLY IMMEDIATELY", "APPLY", "APPLY IF INTERESTED", "FALLBACK ONLY", "SKIP")
TRACKS = (
    "Data Engineering",
    "AI Engineering",
    "ML Engineering",
    "Backend/Data Platform",
    "MLOps",
    "Data Science",
    "Analytics",
    "Other",
)


@dataclass(frozen=True)
class CareerScore:
    final_score: int
    career_direction_fit: int  # /30
    technical_match: int  # /25
    evidence_strength: int  # /15
    engineering_depth: int  # /10
    career_value: int  # /10
    eligibility: int  # /10
    bonus_penalty: int  # +/- applied on top, already folded into final_score
    classification: str  # one of CLASSIFICATIONS
    primary_track: str  # one of TRACKS
    why_it_matches: str
    main_gap: str
    recommendation: str  # one of RECOMMENDATIONS
    source: str = "llm"  # "llm" or "fallback" — lets callers/tests distinguish


def _profile_block(profile: dict[str, Any]) -> str:
    def _list(key: str) -> str:
        items = profile.get(key, [])
        return "\n".join(f"- {item}" for item in items) if items else "(none listed)"

    projects = profile.get("career_projects", [])
    projects_text = (
        "\n".join(f"- {p.get('name', '')}: {p.get('description', '').strip()}" for p in projects)
        if projects
        else "(none listed)"
    )

    return textwrap.dedent(f"""
        TARGET CAREER PATHS (priority order, highest first):
        {_list('target_career_paths')}

        ROLES TO AVOID (should NOT score well on career direction, even if qualified):
        {_list('excluded_career_paths')}

        EDUCATION:
        {_list('education')}

        PROFESSIONAL EXPERIENCE:
        {_list('professional_experience')}

        AI EXPERIENCE:
        {_list('ai_experience')}

        PROJECTS:
        {projects_text}

        TECHNICAL SKILLS:
        {_list('technical_skills')}
    """).strip()


def _job_block(job: Job) -> str:
    return textwrap.dedent(f"""
        Role: {job.title}
        Company: {job.company}
        Location: {job.location or 'Unspecified'}
        Source: {job.source}
        Description:
        {(job.description or '(no description text available)')[:6000]}
    """).strip()


_PROMPT_TEMPLATE = textwrap.dedent("""
    You are scoring internship postings for a candidate against their ACTUAL career
    goals, not just whether they're technically qualified. This distinction matters:
    "I am qualified for this role" and "this role moves me toward my desired career"
    are different questions, and BOTH should affect the score. A Data Analyst role
    the candidate is 95% qualified for should score LOWER than a Data Platform
    Engineer role they're only 70% qualified for, because the former pulls their
    career in the wrong direction and the latter advances it.

    {profile}

    THE ROLE TO SCORE:
    {job}

    Score this role 0-100 using exactly these six weighted components. Judge by
    actual day-to-day responsibilities described in the posting, NOT the job title
    alone — override the title when responsibilities indicate otherwise (e.g. a
    "Data Analyst" title doing mostly SQL dashboards scores LOW on career fit; a
    "Data Scientist" title doing LLM systems and model deployment scores HIGH; a
    "Software Engineer" title doing distributed data infrastructure scores VERY HIGH).

    1. CAREER DIRECTION FIT (0-30, the most important component): how well the
       actual responsibilities match the candidate's target career paths above, in
       priority order. Roles matching the excluded list should score low here
       (0-10) even if every technical requirement is met — do not give a role
       double credit for being both a strong direction fit AND easy to get; those
       are different axes.
    2. TECHNICAL MATCH (0-25): compare required technologies/capabilities against
       the candidate's actual skills. Give partial credit for clearly transferable
       experience (e.g. strong SQL/ETL/Python transfers partially to a role asking
       for Spark/Kafka — note the gap, don't zero it out). Do not treat unrelated
       tools as equivalent (PostgreSQL is not Kafka; Docker is not Kubernetes).
    3. EVIDENCE STRENGTH (0-15): how strongly the candidate's actual experience/
       projects PROVE the match, not just whether a skill is listed. Direct
       professional or project evidence should score much higher than a bare skill
       list — this exists specifically to stop keyword-stuffing from inflating
       scores.
    4. ENGINEERING DEPTH (0-10): reward roles where the candidate would BUILD
       systems (design, implement, deploy, pipeline, platform, infrastructure,
       API, backend, distributed systems, ML systems, RAG/agents) over roles
       dominated by dashboards, ad-hoc analysis, or reporting. Don't penalize
       stakeholder collaboration by itself — only when analysis/reporting IS the
       primary work.
    5. CAREER VALUE (0-10): how much this strengthens a FUTURE application toward
       Data Engineering / AI Engineering / ML Engineering / Backend-Data Platform
       — technical depth, production exposure, scale, ownership, AI/ML exposure.
       Do not award high value purely for company fame; a smaller company with
       genuine infrastructure work can beat a famous company's dashboard role.
    6. ELIGIBILITY (0-10): degree eligibility, graduation timing, location,
       required experience level, mandatory technologies, internship dates. Only
       apply a major penalty for a HARD requirement clearly unmet (explicit
       "must"/"required"/"minimum qualification"); a "nice to have"/"preferred"
       gap should cost little. If the posting doesn't specify, assume no penalty.

    Then apply bonuses/penalties on top (fold the net effect into final_score, and
    report the net adjustment separately as bonus_penalty):
    - Analyst-heavy penalty: -15 to -30 when the role is PRIMARILY BI reporting,
      dashboard development, commercial/product/operational analytics, or ad-hoc
      SQL analysis — based on actual responsibilities, not merely having "Analyst"
      in the title.
    - Engineering bonus: +5 to +10 (final_score capped at 100) for roles with
      genuinely strong exposure to production data systems, distributed systems,
      real-time pipelines, ML infrastructure, or RAG/LLM/agent systems.

    Use the FULL 0-100 range — do not cluster everything around 60-70. A highly
    aligned role should be able to score 85-95+. A dashboard-heavy analyst role
    should be able to score below 50 even if every stated requirement is
    technically met.

    Respond with ONLY a valid JSON object (no markdown, no code fences) with
    exactly these fields:
    {{
      "career_direction_fit": 0,
      "technical_match": 0,
      "evidence_strength": 0,
      "engineering_depth": 0,
      "career_value": 0,
      "eligibility": 0,
      "bonus_penalty": 0,
      "final_score": 0,
      "classification": "one of: Strong Target, Target, Reach, Fallback, Skip",
      "primary_track": "one of: Data Engineering, AI Engineering, ML Engineering, Backend/Data Platform, MLOps, Data Science, Analytics, Other",
      "why_it_matches": "2-4 sentences: why this fits or doesn't fit the career direction, which parts of the background directly match",
      "main_gap": "1-2 sentences on the single largest gap",
      "recommendation": "one of: APPLY IMMEDIATELY, APPLY, APPLY IF INTERESTED, FALLBACK ONLY, SKIP"
    }}
""").strip()


def _clamp(value: Any, lo: int, hi: int, default: int = 0) -> int:
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return default


def _coerce_enum(value: Any, allowed: tuple[str, ...], default: str) -> str:
    text = str(value or "").strip()
    for option in allowed:
        if text.lower() == option.lower():
            return option
    return default


def score_career_fit(job: Job, profile: dict[str, Any]) -> CareerScore | None:
    """Call Gemini to score career fit. Returns None on any failure — callers
    should fall back to fallback_career_score() rather than crash the pipeline."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return None

    try:
        import google.generativeai as genai

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(
            model_name=_GEN_MODEL,
            generation_config=genai.GenerationConfig(temperature=0.3, response_mime_type="application/json"),
        )
        prompt = _PROMPT_TEMPLATE.format(profile=_profile_block(profile), job=_job_block(job))
        response = model.generate_content(prompt)
        data = json.loads(response.text)
    except Exception:
        LOGGER.exception("career_scoring_llm_call_failed", extra={"title": job.title, "company": job.company})
        return None

    try:
        career_direction_fit = _clamp(data.get("career_direction_fit"), 0, 30)
        technical_match = _clamp(data.get("technical_match"), 0, 25)
        evidence_strength = _clamp(data.get("evidence_strength"), 0, 15)
        engineering_depth = _clamp(data.get("engineering_depth"), 0, 10)
        career_value = _clamp(data.get("career_value"), 0, 10)
        eligibility = _clamp(data.get("eligibility"), 0, 10)
        bonus_penalty = _clamp(data.get("bonus_penalty"), -30, 10)
        base = career_direction_fit + technical_match + evidence_strength + engineering_depth + career_value + eligibility
        final_score = _clamp(data.get("final_score", base + bonus_penalty), 0, 100, default=max(0, min(100, base + bonus_penalty)))

        return CareerScore(
            final_score=final_score,
            career_direction_fit=career_direction_fit,
            technical_match=technical_match,
            evidence_strength=evidence_strength,
            engineering_depth=engineering_depth,
            career_value=career_value,
            eligibility=eligibility,
            bonus_penalty=bonus_penalty,
            classification=_coerce_enum(data.get("classification"), CLASSIFICATIONS, _classification_from_score(final_score)),
            primary_track=_coerce_enum(data.get("primary_track"), TRACKS, "Other"),
            why_it_matches=str(data.get("why_it_matches", ""))[:800],
            main_gap=str(data.get("main_gap", ""))[:400],
            recommendation=_coerce_enum(data.get("recommendation"), RECOMMENDATIONS, _recommendation_from_score(final_score)),
            source="llm",
        )
    except Exception:
        LOGGER.exception("career_scoring_response_malformed", extra={"title": job.title, "company": job.company})
        return None


def _classification_from_score(score: int) -> str:
    if score >= 82:
        return "Strong Target"
    if score >= 65:
        return "Target"
    if score >= 55:
        return "Reach"
    if score >= 40:
        return "Fallback"
    return "Skip"


def _recommendation_from_score(score: int) -> str:
    if score >= 90:
        return "APPLY IMMEDIATELY"
    if score >= 74:
        return "APPLY"
    if score >= 55:
        return "APPLY IF INTERESTED"
    if score >= 40:
        return "FALLBACK ONLY"
    return "SKIP"


_ANALYST_TRACK_PENALTY_TERMS = [
    "data analyst",
    "bi analyst",
    "business intelligence analyst",
    "product analyst",
    "business analyst",
    "commercial analytics",
    "operations analyst",
    "operational analytics",
]

_ENGINEERING_TERMS = [
    "engineer",
    "engineering",
    "pipeline",
    "platform",
    "infrastructure",
    "backend",
    "distributed",
    "api",
    "build",
    "deploy",
    "architect",
    "rag",
    "agent",
    "model deployment",
]

_ROLE_FAMILY_TO_TRACK = {
    "Data Engineering": "Data Engineering",
    "AI/ML/RAG": "AI Engineering",
    "Software Engineering": "Backend/Data Platform",
    "Cloud / DevOps": "MLOps",
    "Data Science / Analytics": "Analytics",
    "Product / Technical Analyst": "Analytics",
}


def fallback_career_score(job: Job, score: Score, config: dict[str, Any] | None = None) -> CareerScore:
    """Deterministic stand-in used when Gemini isn't configured or the call
    fails. Cheaper and dumber than the real thing, but still actively
    deprioritizes analyst-shaped roles instead of scoring them on keywords
    alone — the whole point of this feature — so the pipeline degrades
    gracefully rather than reverting to the old behavior."""
    text = " ".join([job.title or "", job.description or ""]).lower()
    role_family = classify_role_family(job, config)
    track = _ROLE_FAMILY_TO_TRACK.get(role_family, "Other")

    is_analyst_heavy = any(term in text for term in _ANALYST_TRACK_PENALTY_TERMS)
    engineering_signal = sum(1 for term in _ENGINEERING_TERMS if term in text)

    career_direction_fit = 8 if is_analyst_heavy else min(28, 14 + engineering_signal * 2)
    technical_match = round(score.skill_relevance * 0.25)
    evidence_strength = round(min(15, score.skill_relevance * 0.12))
    engineering_depth = 2 if is_analyst_heavy else min(10, engineering_signal * 2)
    career_value = 3 if is_analyst_heavy else 7
    eligibility = round(min(10, (score.location_relevance + score.timeline_relevance) / 20))
    bonus_penalty = -15 if is_analyst_heavy else 0

    base = career_direction_fit + technical_match + evidence_strength + engineering_depth + career_value + eligibility
    final_score = max(0, min(100, base + bonus_penalty))

    return CareerScore(
        final_score=final_score,
        career_direction_fit=career_direction_fit,
        technical_match=technical_match,
        evidence_strength=evidence_strength,
        engineering_depth=engineering_depth,
        career_value=career_value,
        eligibility=eligibility,
        bonus_penalty=bonus_penalty,
        classification=_classification_from_score(final_score),
        primary_track=track,
        why_it_matches="Deterministic fallback score (Gemini unavailable) — approximate only.",
        main_gap="Run with GEMINI_API_KEY configured for a real career-fit assessment.",
        recommendation=_recommendation_from_score(final_score),
        source="fallback",
    )


def _from_dict(data: dict[str, Any]) -> CareerScore:
    return CareerScore(**{f: data.get(f) for f in CareerScore.__dataclass_fields__})


def get_or_score_career_fit(
    db_path: str,
    job: Job,
    score: Score,
    profile: dict[str, Any],
    config: dict[str, Any] | None = None,
) -> CareerScore:
    """Cache-aware entry point main.py should call: reuse a cached score for
    this job if one exists, otherwise score it (LLM if available, else the
    deterministic fallback) and cache the result for every future run."""
    cached = get_career_score(db_path, job.stable_id)
    if cached:
        try:
            return _from_dict(json.loads(cached))
        except (ValueError, TypeError, json.JSONDecodeError):
            LOGGER.warning("career_score_cache_corrupt stable_id=%s — rescoring", job.stable_id)

    result = score_career_fit(job, profile) or fallback_career_score(job, score, config)
    try:
        save_career_score(db_path, job.stable_id, json.dumps(asdict(result)))
    except Exception:
        LOGGER.exception("career_score_cache_write_failed", extra={"title": job.title})
    return result
