"""Executes a fill plan against a live page and writes a review package.

Never calls anything that could submit the form: the dispatch table below
only knows the five ActionType verbs, and every action is re-checked against
is_submit_like() as a third, belt-and-suspenders guard (after the mapper's
filter and the browser layer's own per-call guard).
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from agent.browser import FormBrowser
from agent.schema import ActionType, FillAction, FillResult, FormField, is_submit_like


def _values_match(action: FillAction, actual: str) -> bool:
    if action.action == ActionType.UPLOAD_FILE:
        return bool(actual) and Path(action.value).name == actual
    if action.action == ActionType.CHECK:
        return actual.strip().lower() == action.value.strip().lower()
    if action.action == ActionType.SELECT_OPTION:
        return actual.strip().lower() == action.value.strip().lower()
    return actual.strip() == action.value.strip()


def execute_fill_plan(
    browser: FormBrowser,
    actions: list[FillAction],
    unfilled: list[FormField],
    out_dir: str | Path,
    url: str = "",
) -> dict:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    results: list[FillResult] = []
    for a in actions:
        assert isinstance(a.action, ActionType), f"invalid action type: {a.action!r}"
        assert not is_submit_like(a.field_label), (
            f"Refusing to act on {a.field_label!r} — looks submit-like. This should be "
            "unreachable: the mapper and the browser layer already filter these out."
        )
        try:
            if a.action == ActionType.FILL_TEXT:
                browser.fill_text(a.selector, a.value)
            elif a.action == ActionType.SELECT_OPTION:
                browser.select_option(a.selector, a.value)
            elif a.action == ActionType.CHECK:
                browser.check(a.selector, checked=a.value.lower() == "true")
            elif a.action == ActionType.UPLOAD_FILE:
                browser.upload_file(a.selector, a.value)
            elif a.action == ActionType.CLICK_TO_EXPAND:
                browser.click_to_expand(a.selector)

            actual = browser.read_value(a.selector)
            confirmed = _values_match(a, actual)
            results.append(
                FillResult(a.field_label, a.action, a.value, confirmed, note="" if confirmed else f"read back {actual!r}")
            )
        except Exception as exc:  # keep going — one bad field shouldn't abort the whole review package
            results.append(FillResult(a.field_label, a.action, a.value, False, note=str(exc)))

    screenshot_path = out_dir / "screenshot.png"
    browser.screenshot(str(screenshot_path))

    summary = {
        "url": url,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "filled_fields": [
            {"field_label": r.field_label, "action": r.action.value, "value": r.value, "confirmed": r.confirmed, "note": r.note}
            for r in results
        ],
        "unfilled_fields_needing_attention": [
            {"label": f.label, "kind": f.kind.value, "options": f.options} for f in unfilled
        ],
        "screenshot_path": str(screenshot_path),
        "submitted": False,
        "note": "This agent never clicks Submit/Apply/Send. Review the screenshot and the "
        "live page, then submit it yourself.",
    }
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary
