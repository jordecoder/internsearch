from __future__ import annotations

import io
import json
import os
import re
import textwrap
from typing import Annotated

import google.generativeai as genai
import numpy as np
import pdfplumber
from docx import Document
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel

from api.auth import get_current_user, limiter

router = APIRouter()

_GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
genai.configure(api_key=_GEMINI_API_KEY)

_EMBED_MODEL = "models/text-embedding-004"
_GEN_MODEL = "gemini-2.0-flash"
_MAX_FILE_BYTES = 5 * 1024 * 1024  # 5 MB


# ── resume parsing ─────────────────────────────────────────────────────────────

def _extract_text_pdf(data: bytes) -> str:
    with pdfplumber.open(io.BytesIO(data)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def _extract_text_docx(data: bytes) -> str:
    doc = Document(io.BytesIO(data))
    return "\n".join(p.text for p in doc.paragraphs)


def _extract_text(filename: str, data: bytes) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext == "pdf":
        return _extract_text_pdf(data)
    if ext in ("docx", "doc"):
        return _extract_text_docx(data)
    if ext == "txt":
        return data.decode("utf-8", errors="replace")
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Only PDF, DOCX, and TXT resumes are supported.",
    )


def _chunk_resume(text: str) -> list[str]:
    """Split resume into sections on blank lines or ALL-CAPS headers."""
    header_pattern = re.compile(r"^([A-Z][A-Z\s/&]+)$", re.MULTILINE)
    sections, last = [], 0
    for match in header_pattern.finditer(text):
        chunk = text[last : match.start()].strip()
        if chunk:
            sections.append(chunk)
        last = match.start()
    tail = text[last:].strip()
    if tail:
        sections.append(tail)
    # Fallback: split on double newlines if no headers found
    if len(sections) <= 1:
        sections = [s.strip() for s in re.split(r"\n{2,}", text) if s.strip()]
    return sections or [text]


# ── embeddings + retrieval ─────────────────────────────────────────────────────

def _embed(texts: list[str], task_type: str) -> list[list[float]]:
    result = genai.embed_content(
        model=_EMBED_MODEL,
        content=texts,
        task_type=task_type,
    )
    return result["embedding"] if isinstance(result["embedding"][0], list) else [result["embedding"]]


def _cosine_sim(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a), np.array(b)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom else 0.0


def _retrieve_top_chunks(
    jd_embedding: list[float],
    chunks: list[str],
    chunk_embeddings: list[list[float]],
    top_k: int = 4,
) -> list[str]:
    scores = [(_cosine_sim(jd_embedding, emb), chunk) for emb, chunk in zip(chunk_embeddings, chunks)]
    scores.sort(reverse=True, key=lambda x: x[0])
    return [chunk for _, chunk in scores[:top_k]]


# ── agentic tool definitions ───────────────────────────────────────────────────

_TOOLS = genai.protos.Tool(
    function_declarations=[
        genai.protos.FunctionDeclaration(
            name="analyze_job_description",
            description="Extract structured requirements from the job description.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "role_title": genai.protos.Schema(type=genai.protos.Type.STRING),
                    "required_skills": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                    "nice_to_have_skills": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                    "key_responsibilities": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                },
                required=["role_title", "required_skills", "key_responsibilities"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="identify_skill_gaps",
            description="Compare JD requirements against the candidate's resume to find matched and missing skills.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "matched_skills": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                    "missing_skills": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                    ),
                    "coverage_percent": genai.protos.Schema(type=genai.protos.Type.INTEGER),
                },
                required=["matched_skills", "missing_skills", "coverage_percent"],
            ),
        ),
        genai.protos.FunctionDeclaration(
            name="produce_tailored_resume",
            description="Produce the final tailored resume output.",
            parameters=genai.protos.Schema(
                type=genai.protos.Type.OBJECT,
                properties={
                    "tailored_summary": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="2–3 sentence professional summary tailored to this role.",
                    ),
                    "prioritised_bullets": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                        description="Top 6–8 experience/project bullets to highlight, reworded to lead with the most relevant skill.",
                    ),
                    "suggested_additions": genai.protos.Schema(
                        type=genai.protos.Type.ARRAY,
                        items=genai.protos.Schema(type=genai.protos.Type.STRING),
                        description="Concrete suggestions for skills or projects to add if the candidate has them.",
                    ),
                    "keyword_tips": genai.protos.Schema(
                        type=genai.protos.Type.STRING,
                        description="Short paragraph on which keywords from the JD to weave into the resume for ATS.",
                    ),
                },
                required=["tailored_summary", "prioritised_bullets", "keyword_tips"],
            ),
        ),
    ]
)


# ── agent loop ─────────────────────────────────────────────────────────────────

def _run_agent(jd: str, relevant_chunks: list[str], full_resume: str) -> dict:
    context = "\n\n---\n\n".join(relevant_chunks)
    system = textwrap.dedent("""
        You are an expert resume tailoring assistant.
        Your job is to help a candidate tailor their resume for a specific internship.

        Rules:
        - Only use experience and skills that are present in the resume. Never fabricate.
        - Reorder and reword bullets to lead with the most relevant skills for this role.
        - Be specific and quantified where the resume provides numbers.
        - You MUST call tools in this order:
          1. analyze_job_description
          2. identify_skill_gaps
          3. produce_tailored_resume
    """).strip()

    prompt = (
        f"JOB DESCRIPTION:\n{jd}\n\n"
        f"MOST RELEVANT RESUME SECTIONS (retrieved by semantic search):\n{context}\n\n"
        f"FULL RESUME (for complete context):\n{full_resume}"
    )

    model = genai.GenerativeModel(
        model_name=_GEN_MODEL,
        tools=[_TOOLS],
        system_instruction=system,
    )
    chat = model.start_chat()
    response = chat.send_message(prompt)

    tool_state: dict = {}
    final_output: dict | None = None

    for _ in range(6):  # max agent turns
        tool_calls = [p.function_call for p in response.parts if hasattr(p, "function_call") and p.function_call.name]
        if not tool_calls:
            break

        parts = []
        for call in tool_calls:
            args = dict(call.args)
            tool_state[call.name] = args
            if call.name == "produce_tailored_resume":
                final_output = args
            parts.append(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=call.name,
                        response={"result": "ok", "data": json.dumps(args)},
                    )
                )
            )
        response = chat.send_message(parts)

        if final_output:
            break

    if not final_output:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Agent did not produce a tailored resume. Try again.",
        )

    return {
        "role_title": tool_state.get("analyze_job_description", {}).get("role_title", ""),
        "required_skills": tool_state.get("analyze_job_description", {}).get("required_skills", []),
        "matched_skills": tool_state.get("identify_skill_gaps", {}).get("matched_skills", []),
        "missing_skills": tool_state.get("identify_skill_gaps", {}).get("missing_skills", []),
        "coverage_percent": tool_state.get("identify_skill_gaps", {}).get("coverage_percent", 0),
        "tailored_summary": final_output.get("tailored_summary", ""),
        "prioritised_bullets": final_output.get("prioritised_bullets", []),
        "suggested_additions": final_output.get("suggested_additions", []),
        "keyword_tips": final_output.get("keyword_tips", ""),
    }


# ── endpoint ───────────────────────────────────────────────────────────────────

class TailorResponse(BaseModel):
    role_title: str
    required_skills: list[str]
    matched_skills: list[str]
    missing_skills: list[str]
    coverage_percent: int
    tailored_summary: str
    prioritised_bullets: list[str]
    suggested_additions: list[str]
    keyword_tips: str


@router.post("/tailor", response_model=TailorResponse)
@limiter.limit("5/hour")
async def tailor_resume(
    request: Request,
    username: Annotated[str, Depends(get_current_user)],
    resume: UploadFile = File(..., description="PDF, DOCX, or TXT resume"),
    job_description: str = Form(..., min_length=50),
) -> TailorResponse:
    if resume.size and resume.size > _MAX_FILE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 5 MB)")

    raw = await resume.read()
    if len(raw) > _MAX_FILE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 5 MB)")

    resume_text = _extract_text(resume.filename or "resume.txt", raw)
    if not resume_text.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not extract text from resume")

    chunks = _chunk_resume(resume_text)

    # Embed chunks + JD for semantic retrieval
    chunk_embeddings = _embed(chunks, task_type="retrieval_document")
    jd_embedding = _embed([job_description], task_type="retrieval_query")[0]
    relevant = _retrieve_top_chunks(jd_embedding, chunks, chunk_embeddings, top_k=4)

    result = _run_agent(job_description, relevant, resume_text)
    return TailorResponse(**result)
