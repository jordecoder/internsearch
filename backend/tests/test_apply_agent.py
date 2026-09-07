from __future__ import annotations

import json
from pathlib import Path

import pytest

from agent.browser import FormBrowser
from agent.filler import execute_fill_plan
from agent.mapper import _gemini_fill_free_text, build_fill_plan
from agent.schema import ActionType, FieldKind, FormField

FIXTURE = Path(__file__).parent / "fixtures" / "mock_application_form.html"

PROFILE = {
    "name": "Jordan Example",
    "email": "jordan.example@example.com",
    "phone": "+65 8123 4567",
    "linkedin_url": "https://www.linkedin.com/in/jordan-example",
    "school": "National University of Singapore",
    "work_authorization": "authorized",
}

ESSAY_TEXT = "I want to work here because your engineering culture matches how I like to build things."


@pytest.fixture
def resume_file(tmp_path) -> Path:
    path = tmp_path / "jordan_resume.pdf"
    path.write_bytes(b"%PDF-1.4 fake resume content for testing")
    return path


def test_agent_fills_mock_form_without_submitting(tmp_path, resume_file):
    profile = {**PROFILE, "resume_pdf_path": str(resume_file)}
    out_dir = tmp_path / "review"

    browser = FormBrowser(headed=False)
    browser.__enter__()
    try:
        browser.goto(FIXTURE.resolve().as_uri())
        fields = browser.extract_fields()
        buttons = browser.extract_buttons()

        actions, unfilled = build_fill_plan(
            fields,
            buttons,
            profile,
            job_description="",
            cover_letter_text="",
            essay_answer_text=ESSAY_TEXT,
            gemini_enabled=False,  # no network calls in this test
        )

        summary = execute_fill_plan(browser, actions, unfilled, out_dir, url=FIXTURE.as_uri())

        # ── deterministic fields landed correctly ──
        assert browser.page.input_value("#first_name") == "Jordan"
        assert browser.page.input_value("#last_name") == "Example"
        assert browser.page.input_value("#email") == "jordan.example@example.com"
        assert browser.page.input_value("#phone") == "+65 8123 4567"
        assert browser.page.input_value("#linkedin") == "https://www.linkedin.com/in/jordan-example"
        assert browser.page.eval_on_selector("#school", "el => el.options[el.selectedIndex].text") == (
            "National University of Singapore"
        )
        assert browser.page.is_checked("input[name='work_auth'][value='yes']")
        assert not browser.page.is_checked("input[name='work_auth'][value='no']")
        assert browser.page.input_value("#why") == ESSAY_TEXT

        # ── resume upload registered ──
        uploaded_name = browser.page.eval_on_selector(
            "#resume", "el => el.files.length ? el.files[0].name : ''"
        )
        assert uploaded_name == resume_file.name

        # ── the field with no deterministic match and Gemini disabled is left for a human ──
        assert browser.page.input_value("#project") == ""
        unfilled_labels = [f["label"] for f in summary["unfilled_fields_needing_attention"]]
        assert any("project" in label.lower() for label in unfilled_labels)

        # ── the whole point: submit was never touched ──
        submit_clicks = browser.page.evaluate("window.__submitClicked || 0")
        assert submit_clicks == 0
        assert summary["submitted"] is False

        # ── review artifacts were written ──
        screenshot_path = Path(summary["screenshot_path"])
        assert screenshot_path.exists()
        assert screenshot_path.stat().st_size > 0
        summary_path = out_dir / "summary.json"
        assert summary_path.exists()
        on_disk = json.loads(summary_path.read_text(encoding="utf-8"))
        assert on_disk["submitted"] is False
    finally:
        browser.close()


def test_no_action_ever_targets_a_submit_like_control(tmp_path, resume_file):
    """Extra guard, independent of the mock form's own click counter: walk the
    fill plan itself and confirm no action's selector is one of the buttons
    identified as submit-like."""
    profile = {**PROFILE, "resume_pdf_path": str(resume_file)}

    browser = FormBrowser(headed=False)
    browser.__enter__()
    try:
        browser.goto(FIXTURE.resolve().as_uri())
        fields = browser.extract_fields()
        buttons = browser.extract_buttons()
        submit_selectors = {b.selector for b in buttons if "submit" in b.name.lower()}
        assert submit_selectors, "fixture should contain a Submit Application button"

        actions, _ = build_fill_plan(
            fields, buttons, profile, essay_answer_text=ESSAY_TEXT, gemini_enabled=False
        )
        assert not any(a.selector in submit_selectors for a in actions)
        assert not any(a.action == ActionType.CLICK_TO_EXPAND for a in actions), (
            "nothing in this fixture needs expanding; click_to_expand showing up here would be a bug"
        )
    finally:
        browser.close()


def test_fill_action_rejects_invalid_action_type():
    from agent.schema import FillAction

    with pytest.raises(ValueError):
        FillAction(selector="#x", field_label="x", action="click_submit_button")


class _FakePart:
    def __init__(self, function_call):
        self.function_call = function_call


class _FakeCall:
    def __init__(self, name, args):
        self.name = name
        self.args = args


class _FakeResponse:
    def __init__(self, parts):
        self.parts = parts


class _FakeChat:
    def __init__(self, response):
        self._response = response

    def send_message(self, _prompt):
        return self._response


class _FakeModel:
    def __init__(self, response, **_kwargs):
        self._response = response

    def start_chat(self):
        return _FakeChat(self._response)


def test_gemini_fallback_answers_free_text_field_without_network(monkeypatch):
    """Mocks google.generativeai entirely — no real API key or network call."""
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")

    fake_answer = "I shipped a resume-tailoring RAG pipeline using Python and vector search."
    response = _FakeResponse(
        parts=[_FakePart(_FakeCall("answer_form_fields", {"answers": [{"index": 0, "answer": fake_answer, "skip": False}]}))]
    )

    import google.generativeai as genai

    monkeypatch.setattr(genai, "configure", lambda **_kwargs: None)
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FakeModel(response, **kwargs))

    project_field = FormField(selector="#project", label="Tell us about a project you're proud of", kind=FieldKind.TEXTAREA, max_length=500)

    actions, leftover = _gemini_fill_free_text(
        [project_field],
        PROFILE,
        job_description="Software engineering internship.",
        cover_letter_text="",
        essay_answer_text="",
    )

    assert leftover == []
    assert len(actions) == 1
    assert actions[0].action == ActionType.FILL_TEXT
    assert actions[0].value == fake_answer
    assert actions[0].selector == "#project"


def test_gemini_fallback_skips_when_model_says_skip(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    response = _FakeResponse(
        parts=[_FakePart(_FakeCall("answer_form_fields", {"answers": [{"index": 0, "skip": True}]}))]
    )

    import google.generativeai as genai

    monkeypatch.setattr(genai, "configure", lambda **_kwargs: None)
    monkeypatch.setattr(genai, "GenerativeModel", lambda **kwargs: _FakeModel(response, **kwargs))

    field = FormField(selector="#mystery", label="Describe a time you failed a security clearance", kind=FieldKind.TEXTAREA)
    actions, leftover = _gemini_fill_free_text([field], PROFILE, "", "", "")

    assert actions == []
    assert leftover == [field]
