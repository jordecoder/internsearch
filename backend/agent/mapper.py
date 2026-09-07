"""Maps extracted form fields to values from the candidate profile.

Two passes:
1. Deterministic regex/keyword rules for common fields (name, email, phone,
   links, school, work authorization, resume/cover-letter upload, canned
   `answers` from the profile). Fast, free, and predictable.
2. A Gemini function-calling fallback (same pattern as backend/api/rag.py)
   for whatever free-text fields are left — it can only ever produce
   `fill_text` actions, never anything that touches a button.

Either pass, plus an independent filter here and another inside
agent.browser.FormBrowser, refuses to ever target a submit-like control.
"""

from __future__ import annotations

import json
import os
import re

from agent.schema import ActionType, FieldKind, FillAction, FormField, PageButton, is_submit_like

_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"first\s*name"), "first_name"),
    (re.compile(r"last\s*name|surname|family\s*name"), "last_name"),
    (re.compile(r"full\s*name|your\s*name|applicant\s*name|^name$|^name\b"), "name"),
    (re.compile(r"e[\s-]?mail"), "email"),
    (re.compile(r"phone|mobile|contact\s*number"), "phone"),
    (re.compile(r"linkedin"), "linkedin_url"),
    (re.compile(r"github"), "github_url"),
    (re.compile(r"portfolio|personal\s*site|website"), "portfolio_url"),
    (re.compile(r"school|university|college"), "school"),
    (re.compile(r"degree|major|field\s*of\s*study"), "degree"),
    (re.compile(r"graduat"), "graduation_date"),
    (re.compile(r"location|current\s*city|address"), "location"),
]

_WHY_PATTERN = re.compile(r"why.*(work|join|interest|excite)|why.*compan|motivat")
_COVER_LETTER_PATTERN = re.compile(r"cover\s*letter")
_RESUME_PATTERN = re.compile(r"resume|\bcv\b")
_WORK_AUTH_PATTERN = re.compile(r"work\s*authoriz|legally\s*(authorized|eligible)|right\s*to\s*work|sponsor")
_SPONSOR_PATTERN = re.compile(r"sponsor")


def _norm(label: str) -> str:
    return re.sub(r"[^a-z0-9\s]", " ", label.lower())


def _split_name(name: str) -> tuple[str, str]:
    parts = str(name).strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _truthy(s: str) -> bool:
    return s.strip().lower() in {"true", "yes", "y", "1"}


def _best_option_match(options: list[str], target: str) -> str | None:
    if not options or not target:
        return None
    t = target.strip().lower()
    for opt in options:
        if opt.strip().lower() == t:
            return opt
    for opt in options:
        ol = opt.strip().lower()
        if t in ol or ol in t:
            return opt
    t_tokens = set(re.findall(r"[a-z0-9]+", t))
    best, best_score = None, 0
    for opt in options:
        o_tokens = set(re.findall(r"[a-z0-9]+", opt.lower()))
        score = len(t_tokens & o_tokens)
        if score > best_score:
            best, best_score = opt, score
    return best if best_score > 0 else None


def _lookup_answer(profile: dict, label: str) -> str | None:
    answers = profile.get("answers") or {}
    norm_label = _norm(label)
    for q, a in answers.items():
        nq = _norm(str(q))
        if nq and (nq in norm_label or norm_label in nq):
            return str(a)
    return None


def _select_like(f: FormField, target_text: str, positive_default: bool | None = None) -> FillAction | None:
    if f.kind == FieldKind.CHECKBOX:
        if target_text:
            want = _truthy(target_text)
        elif positive_default is not None:
            want = positive_default
        else:
            return None
        return FillAction(f.selector, f.label, ActionType.CHECK, "true" if want else "false")

    if f.kind == FieldKind.RADIO:
        own_label = f.label.split(": ", 1)[-1].strip()
        candidates = f.options or [own_label]
        best = _best_option_match(candidates, target_text) if target_text else None
        if best is None and positive_default is not None:
            words = ("yes", "authoriz", "eligib") if positive_default else ("no", "not ", "requir")
            for opt in candidates:
                if any(w in opt.lower() for w in words):
                    best = opt
                    break
        if best is None or best.strip().lower() != own_label.lower():
            return None
        return FillAction(f.selector, f.label, ActionType.CHECK, "true")

    if f.kind == FieldKind.SELECT:
        best = _best_option_match(f.options, target_text) if target_text else None
        if best is None and positive_default is not None:
            words = ("yes", "authoriz", "eligib") if positive_default else ("no", "requir")
            for opt in f.options:
                if any(w in opt.lower() for w in words):
                    best = opt
                    break
        if best is None:
            return None
        return FillAction(f.selector, f.label, ActionType.SELECT_OPTION, best)

    return None


def _match_deterministic(
    f: FormField, profile: dict, cover_letter_text: str, essay_answer_text: str
) -> FillAction | None:
    label = _norm(f.label)
    name = str(profile.get("name", ""))
    first, last = _split_name(name)

    if f.kind == FieldKind.FILE:
        if _RESUME_PATTERN.search(label):
            path = profile.get("resume_pdf_path")
            return FillAction(f.selector, f.label, ActionType.UPLOAD_FILE, path) if path else None
        if _COVER_LETTER_PATTERN.search(label):
            path = profile.get("cover_letter_path")
            return FillAction(f.selector, f.label, ActionType.UPLOAD_FILE, path) if path else None
        return None

    if f.kind in (FieldKind.RADIO, FieldKind.SELECT, FieldKind.CHECKBOX):
        if _WORK_AUTH_PATTERN.search(label) and not _SPONSOR_PATTERN.search(label):
            return _select_like(f, str(profile.get("work_authorization", "")), positive_default=True)
        if _SPONSOR_PATTERN.search(label):
            requires = bool(profile.get("sponsorship_required", False))
            return _select_like(f, "yes" if requires else "no", positive_default=not requires)
        if f.kind == FieldKind.SELECT and re.search(r"school|university|college", label):
            val = str(profile.get("school", ""))
            return _select_like(f, val) if val else None
        if f.kind == FieldKind.SELECT and re.search(r"degree", label):
            val = str(profile.get("degree", ""))
            return _select_like(f, val) if val else None
        canned = _lookup_answer(profile, f.label)
        if canned is not None:
            return _select_like(f, canned)
        return None

    if f.kind == FieldKind.TEXTAREA and _COVER_LETTER_PATTERN.search(label) and cover_letter_text:
        return FillAction(f.selector, f.label, ActionType.FILL_TEXT, cover_letter_text)

    if f.kind == FieldKind.TEXTAREA and _WHY_PATTERN.search(label) and essay_answer_text:
        return FillAction(f.selector, f.label, ActionType.FILL_TEXT, essay_answer_text)

    for pattern, key in _RULES:
        if pattern.search(label):
            value = first if key == "first_name" else last if key == "last_name" else str(profile.get(key, "")).strip()
            return FillAction(f.selector, f.label, ActionType.FILL_TEXT, value) if value else None

    canned = _lookup_answer(profile, f.label)
    if canned is not None:
        return FillAction(f.selector, f.label, ActionType.FILL_TEXT, canned)

    return None


_ANSWER_TOOL = None  # built lazily so importing this module never requires google-generativeai to be configured


def _answer_tool():
    global _ANSWER_TOOL
    if _ANSWER_TOOL is None:
        import google.generativeai as genai

        _ANSWER_TOOL = genai.protos.Tool(
            function_declarations=[
                genai.protos.FunctionDeclaration(
                    name="answer_form_fields",
                    description="Provide honest, specific answers for the given application-form fields.",
                    parameters=genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties={
                            "answers": genai.protos.Schema(
                                type=genai.protos.Type.ARRAY,
                                items=genai.protos.Schema(
                                    type=genai.protos.Type.OBJECT,
                                    properties={
                                        "index": genai.protos.Schema(type=genai.protos.Type.INTEGER),
                                        "answer": genai.protos.Schema(type=genai.protos.Type.STRING),
                                        "skip": genai.protos.Schema(type=genai.protos.Type.BOOLEAN),
                                    },
                                    required=["index", "skip"],
                                ),
                            ),
                        },
                        required=["answers"],
                    ),
                )
            ]
        )
    return _ANSWER_TOOL


def _gemini_fill_free_text(
    fields: list[FormField],
    profile: dict,
    job_description: str,
    cover_letter_text: str,
    essay_answer_text: str,
) -> tuple[list[FillAction], list[FormField]]:
    if not fields:
        return [], []
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return [], fields

    import google.generativeai as genai

    genai.configure(api_key=api_key)
    field_briefs = [{"index": i, "label": f.label, "max_length": f.max_length} for i, f in enumerate(fields)]
    system = (
        "You are helping a real candidate fill out an internship application form honestly.\n"
        "Only use facts present in the candidate profile, job description, or the provided "
        "cover letter / essay text. Never invent experience, dates, employers, or facts.\n"
        "If a field cannot be answered truthfully and specifically from what you're given, "
        "set skip=true for it instead of guessing.\n"
        "Reuse the provided cover letter / essay text where a field is clearly asking the same "
        "thing (e.g. 'why do you want to work here'), trimmed to any max_length given."
    )
    prompt = (
        f"CANDIDATE PROFILE:\n{json.dumps(profile, default=str)}\n\n"
        f"JOB DESCRIPTION:\n{job_description[:4000]}\n\n"
        f"PRE-WRITTEN COVER LETTER:\n{cover_letter_text[:3000]}\n\n"
        f"PRE-WRITTEN ESSAY ANSWER:\n{essay_answer_text[:2000]}\n\n"
        f"FORM FIELDS TO ANSWER:\n{json.dumps(field_briefs)}"
    )

    model = genai.GenerativeModel(model_name="gemini-2.0-flash", tools=[_answer_tool()], system_instruction=system)
    chat = model.start_chat()
    response = chat.send_message(prompt)

    answers_by_index: dict[int, dict] = {}
    for part in response.parts:
        call = getattr(part, "function_call", None)
        if call and call.name == "answer_form_fields":
            for a in dict(call.args).get("answers", []):
                a = dict(a)
                try:
                    idx = int(a.get("index", -1))
                except (TypeError, ValueError):
                    continue
                answers_by_index[idx] = a

    actions: list[FillAction] = []
    leftover: list[FormField] = []
    for i, f in enumerate(fields):
        a = answers_by_index.get(i)
        if not a or a.get("skip") or not a.get("answer"):
            leftover.append(f)
            continue
        value = str(a["answer"])
        if f.max_length:
            value = value[: f.max_length]
        actions.append(FillAction(f.selector, f.label, ActionType.FILL_TEXT, value))
    return actions, leftover


def build_fill_plan(
    fields: list[FormField],
    buttons: list[PageButton],
    profile: dict,
    job_description: str = "",
    cover_letter_text: str = "",
    essay_answer_text: str = "",
    gemini_enabled: bool = True,
) -> tuple[list[FillAction], list[FormField]]:
    """Returns (actions, fields_left_for_a_human). Never returns an action
    targeting a submit-like control — filtered here independently of the
    per-call guard in FormBrowser."""
    submit_selectors = {b.selector for b in buttons if is_submit_like(b.name, b.elem_type)}

    actions: list[FillAction] = []
    unmatched: list[FormField] = []
    for f in fields:
        if f.selector in submit_selectors:
            continue
        act = _match_deterministic(f, profile, cover_letter_text, essay_answer_text)
        if act is not None:
            actions.append(act)
        else:
            unmatched.append(f)

    if gemini_enabled:
        free_text = [f for f in unmatched if f.kind in (FieldKind.TEXT, FieldKind.EMAIL, FieldKind.TEL, FieldKind.TEXTAREA)]
        other = [f for f in unmatched if f not in free_text]
        gemini_actions, gemini_leftover = _gemini_fill_free_text(
            free_text, profile, job_description, cover_letter_text, essay_answer_text
        )
        actions.extend(a for a in gemini_actions if a.selector not in submit_selectors)
        still_unmatched = other + gemini_leftover
    else:
        still_unmatched = unmatched

    return actions, still_unmatched
