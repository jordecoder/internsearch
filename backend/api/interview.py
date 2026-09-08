"""Server-side mock interview chat (behavioral / technical / group discussion).

Stateless by design: the frontend keeps the transcript and resends it each
turn (same approach the old client-side version used against a user's own
Gemini key) — the backend just needs the resume/JD/mode/history to produce the
next turn(s), running against the backend's own GEMINI_API_KEY.
"""

import json
from typing import Annotated, Literal

import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from api.auth import get_current_user, limiter
from api.gemini_client import GEN_MODEL

router = APIRouter()

InterviewMode = Literal["behavioral", "technical", "group_discussion"]

_MAX_RESUME_CHARS = 4000
_MAX_JD_CHARS = 2500
_MAX_TRANSCRIPT_TURNS = 40


class ChatTurn(BaseModel):
    role: Literal["user", "model"]
    text: str
    speaker: str | None = None


class InterviewTurnRequest(BaseModel):
    mode: InterviewMode
    resume_text: str = ""
    job_description: str = ""
    history: list[ChatTurn] = Field(default_factory=list)
    user_message: str | None = None


class InterviewTurnResponse(BaseModel):
    turns: list[ChatTurn]


class InterviewFeedbackRequest(BaseModel):
    mode: InterviewMode
    job_description: str = ""
    history: list[ChatTurn]


class InterviewFeedbackResponse(BaseModel):
    overall_impression: str
    strengths: list[str]
    improvements: list[str]
    sample_better_answer: str


def _transcript(history: list[ChatTurn]) -> str:
    if not history:
        return "(nothing yet — this is the start of the session)"
    lines = []
    for t in history[-_MAX_TRANSCRIPT_TURNS:]:
        speaker = "Candidate" if t.role == "user" else (t.speaker or "Interviewer")
        lines.append(f"{speaker}: {t.text}")
    return "\n".join(lines)


def _mode_briefing(mode: InterviewMode) -> str:
    if mode == "group_discussion":
        return (
            "This is a Group Discussion / Leaderless Group Discussion (GD/LGD) round, a common "
            "internship-screening format.\nYou play EVERY participant except the candidate: 2-3 "
            "simulated co-participants with distinct names and personas (e.g. one assertive/dominant, "
            "one analytical/data-driven, one quiet-but-insightful), plus a neutral moderator voice "
            '(speaker "Moderator") used only to open with the topic and to close the round.\nAfter the '
            "candidate speaks, have 1-2 of the OTHER participants respond naturally — build on, "
            "challenge, or redirect the point, and occasionally talk over each other's ideas the way a "
            "real GD does. Stay strictly on the discussion topic.\nKeep the discussion moving at a "
            "realistic pace; do not let it stall."
        )
    if mode == "technical":
        return (
            'This is a technical interview for an internship role. You play a single interviewer (speaker "Interviewer").\n'
            "Ask one technical question at a time grounded in the job description and the candidate's "
            "resume (concepts, past projects, problem-solving). Give a brief, natural reaction to each "
            "answer (not a lecture) before asking the next question or a follow-up probing deeper on a weak point."
        )
    return (
        'This is a behavioral interview for an internship role. You play a single interviewer (speaker "Interviewer").\n'
        "Ask one behavioral/motivational question at a time (STAR-style: past experiences, teamwork, "
        "challenges, why this role). React briefly and naturally to each answer before moving to the "
        "next question or a relevant follow-up."
    )


def _call_gemini_json(prompt: str, temperature: float) -> dict:
    model = genai.GenerativeModel(
        model_name=GEN_MODEL,
        generation_config=genai.GenerationConfig(temperature=temperature, response_mime_type="application/json"),
    )
    try:
        response = model.generate_content(prompt)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Gemini request failed: {exc}")
    try:
        return json.loads(response.text)
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gemini returned an unparseable response.")


@router.post("/interview/turn", response_model=InterviewTurnResponse)
@limiter.limit("40/hour")
async def interview_turn(
    request: Request,
    body: InterviewTurnRequest,
    username: Annotated[str, Depends(get_current_user)],
) -> InterviewTurnResponse:
    history = list(body.history)
    if body.user_message:
        history.append(ChatTurn(role="user", text=body.user_message))
        instruction = (
            "The candidate just spoke (see transcript). Have 1-2 OTHER participants react to what the "
            "candidate said and keep the discussion going."
            if body.mode == "group_discussion"
            else "The candidate just answered (see transcript). React briefly, then ask your next question or a natural follow-up."
        )
    else:
        instruction = (
            "Open the session now: have the Moderator introduce a single, specific discussion topic "
            "relevant to the job description (or a general tech/business topic if no JD was given), then "
            "have 2 participants give short opening statements on it."
            if body.mode == "group_discussion"
            else "Open the session now: greet the candidate briefly, then ask your first question."
        )

    prompt = f"""{_mode_briefing(body.mode)}

CANDIDATE'S RESUME (for context — only the interviewer/participants can see this, the candidate is answering live):
{body.resume_text[:_MAX_RESUME_CHARS] or '(no resume provided — ask generic questions for this type of role)'}

JOB DESCRIPTION:
{body.job_description[:_MAX_JD_CHARS] or '(no specific JD provided — treat as a general tech internship)'}

TRANSCRIPT SO FAR:
{_transcript(history)}

{instruction}

Respond with ONLY a valid JSON object (no markdown, no code fences):
{{
  "turns": [
    {{"speaker": "string — name of whoever is speaking (e.g. Interviewer, Moderator, or a participant's name)", "text": "string — what they say"}}
  ]
}}
Keep each turn's text realistically short (1-5 sentences), the way people actually talk."""

    data = _call_gemini_json(prompt, temperature=0.7)
    turns = [ChatTurn(role="model", text=t.get("text", ""), speaker=t.get("speaker")) for t in data.get("turns", [])]
    return InterviewTurnResponse(turns=turns)


@router.post("/interview/feedback", response_model=InterviewFeedbackResponse)
@limiter.limit("15/hour")
async def interview_feedback(
    request: Request,
    body: InterviewFeedbackRequest,
    username: Annotated[str, Depends(get_current_user)],
) -> InterviewFeedbackResponse:
    role_note = (
        "Evaluate the CANDIDATE only, on: clarity of points, how well they built on/responded to "
        "others, assertiveness without talking over people, and structure."
        if body.mode == "group_discussion"
        else "Evaluate the CANDIDATE only, on: clarity, specificity/evidence (STAR-style where relevant), relevance to the role, and confidence."
    )
    mode_label = body.mode.replace("_", " ")

    prompt = f"""You are an expert interview coach reviewing a completed {mode_label} practice session for an internship candidate.

JOB DESCRIPTION:
{body.job_description[:_MAX_JD_CHARS] or '(none given)'}

FULL TRANSCRIPT:
{_transcript(body.history)}

{role_note}
Be honest and specific — cite something concrete from the transcript in each point, not generic advice.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{{
  "overall_impression": "string — 2-3 sentence overall assessment",
  "strengths": ["string — specific things the candidate did well, citing the transcript"],
  "improvements": ["string — specific, actionable things to improve, citing the transcript"],
  "sample_better_answer": "string — a rewritten, stronger version of the candidate's weakest answer from the transcript"
}}"""

    data = _call_gemini_json(prompt, temperature=0.4)
    return InterviewFeedbackResponse(
        overall_impression=data.get("overall_impression", ""),
        strengths=data.get("strengths", []),
        improvements=data.get("improvements", []),
        sample_better_answer=data.get("sample_better_answer", ""),
    )
