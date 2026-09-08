"""Server-side generation for cover letters / essay answers.

Mirrors what the frontend used to do client-side against a user-pasted Gemini
key (frontend/src/lib/gemini.ts::generateApplicationMaterials) — same prompt,
same JSON contract — just running against the backend's own GEMINI_API_KEY so
nobody visiting the site needs a key of their own.
"""

import json
from typing import Annotated

import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from api.auth import get_current_user, limiter
from api.gemini_client import GEN_MODEL

router = APIRouter()

_MAX_RESUME_CHARS = 6000
_MAX_JD_CHARS = 3000


class MaterialsRequest(BaseModel):
    resume_text: str = Field(..., min_length=20)
    job_description: str = Field(..., min_length=50)
    company_name: str = ""
    essay_question: str = "Why do you want to work here?"


class MaterialsResponse(BaseModel):
    cover_letter: str
    essay_answer: str
    key_points_used: list[str]


def _prompt(body: MaterialsRequest) -> str:
    return f"""You are an expert career-services writer helping a candidate apply for an internship.

RESUME:
{body.resume_text[:_MAX_RESUME_CHARS]}

JOB DESCRIPTION (Company: {body.company_name or 'the company'}):
{body.job_description[:_MAX_JD_CHARS]}

ESSAY QUESTION TO ANSWER:
"{body.essay_question or 'Why do you want to work here?'}"

Rules:
- Only use experience, skills, and facts actually present in the resume. Never fabricate accomplishments, dates, or employers.
- The cover letter should be 3-4 short paragraphs, specific to this role and company, ready to send as-is (no placeholders like "[Company Name]" — use the real name given above).
- The essay answer should directly answer the question in 150-250 words, connecting the candidate's real background to specific, concrete things about this role/company mentioned in the JD (avoid generic flattery).
- Confident, natural, first-person voice. No cliches like "I am writing to express my interest".

Respond with ONLY a valid JSON object (no markdown, no code fences) with exactly these fields:
{{
  "cover_letter": "string — the full cover letter, ready to send",
  "essay_answer": "string — the essay answer to the question above",
  "key_points_used": ["string — resume facts/skills woven into the writing"]
}}"""


@router.post("/generate/materials", response_model=MaterialsResponse)
@limiter.limit("10/hour")
async def generate_materials(
    request: Request,
    body: MaterialsRequest,
    username: Annotated[str, Depends(get_current_user)],
) -> MaterialsResponse:
    model = genai.GenerativeModel(
        model_name=GEN_MODEL,
        generation_config=genai.GenerationConfig(temperature=0.5, response_mime_type="application/json"),
    )
    try:
        response = model.generate_content(_prompt(body))
    except Exception as exc:  # Gemini SDK raises various google.api_core errors
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"Gemini request failed: {exc}")

    try:
        data = json.loads(response.text)
    except (ValueError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Gemini returned an unparseable response.")

    return MaterialsResponse(
        cover_letter=data.get("cover_letter", ""),
        essay_answer=data.get("essay_answer", ""),
        key_points_used=data.get("key_points_used", []),
    )
