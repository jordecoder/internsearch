"""Playwright wrapper for the application-filling agent.

This class exposes exactly five verbs — fill_text, select_option, check,
upload_file, click_to_expand — matching agent.schema.ActionType. There is no
generic `.click(selector)` for arbitrary elements. Every one of the five verbs
also independently refuses to act on any selector identified as submit-like by
extract_buttons(), as a second line of defense alongside the filtering done in
mapper.build_fill_plan().
"""

from __future__ import annotations

from typing import Optional

from playwright.sync_api import Browser, BrowserContext, Page, sync_playwright

from agent.schema import FieldKind, FormField, PageButton, is_submit_like

_KIND_MAP = {
    "text": FieldKind.TEXT,
    "email": FieldKind.EMAIL,
    "tel": FieldKind.TEL,
    "search": FieldKind.TEXT,
    "url": FieldKind.TEXT,
    "number": FieldKind.TEXT,
    "textarea": FieldKind.TEXTAREA,
    "select-one": FieldKind.SELECT,
    "select-multiple": FieldKind.SELECT,
    "select": FieldKind.SELECT,
    "checkbox": FieldKind.CHECKBOX,
    "radio": FieldKind.RADIO,
    "file": FieldKind.FILE,
}

# Injects a stable `data-agent-field` / `data-agent-btn` attribute on every
# candidate element so selectors survive re-querying, then returns a plain
# JSON-serializable description of each one (label resolution mirrors how a
# screen reader would announce the field: <label for>, wrapping <label>,
# aria-label/aria-labelledby, placeholder, then nearest preceding text).
_EXTRACT_FIELDS_JS = r"""
() => {
  function visible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return true;
    return el.offsetParent !== null;
  }
  function textOf(el) {
    if (!el) return '';
    return (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function labelFor(el) {
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) { const t = textOf(lab); if (t) return t; }
    }
    let p = el.parentElement;
    for (let i = 0; i < 4 && p; i++) {
      if (p.tagName === 'LABEL') {
        const clone = p.cloneNode(true);
        clone.querySelectorAll('input,select,textarea').forEach(n => n.remove());
        const t = textOf(clone);
        if (t) return t;
      }
      p = p.parentElement;
    }
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const t = labelledBy.split(/\s+/).map(id => textOf(document.getElementById(id))).join(' ').trim();
      if (t) return t;
    }
    if (el.placeholder) return el.placeholder.trim();
    let sib = el.previousElementSibling;
    while (sib) {
      const t = textOf(sib);
      if (t) return t;
      sib = sib.previousElementSibling;
    }
    if (el.parentElement) {
      const t = textOf(el.parentElement);
      if (t) return t.slice(0, 120);
    }
    return el.name || el.id || '(unlabeled field)';
  }
  function groupLabel(el) {
    const fs = el.closest('fieldset');
    if (fs) {
      const legend = fs.querySelector('legend');
      if (legend) { const t = textOf(legend); if (t) return t; }
    }
    return null;
  }

  const nodes = Array.from(document.querySelectorAll('input, select, textarea'));
  const out = [];
  let idx = 0;
  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || (tag === 'select' ? 'select' : tag)).toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (el.disabled) continue;
    if (!visible(el)) continue;

    el.dataset.agentField = 'af-' + idx;
    let label = labelFor(el);
    const grp = groupLabel(el);
    if (grp && (type === 'radio' || type === 'checkbox')) {
      label = grp + ': ' + label;
    }

    let options = [];
    if (tag === 'select') {
      options = Array.from(el.options)
        .filter(o => o.text.trim() !== '')
        .map(o => o.text.trim());
    } else if (type === 'radio' && el.name) {
      const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
      options = Array.from(group).map(r => labelFor(r));
    }

    out.push({
      selector: `[data-agent-field="af-${idx}"]`,
      label: label,
      type: type,
      options: options,
      current_value: (type === 'checkbox' || type === 'radio') ? String(el.checked) : (el.value || ''),
      required: !!el.required,
      max_length: (el.maxLength && el.maxLength > 0) ? el.maxLength : null,
    });
    idx++;
  }
  return out;
}
"""

# Tagged purely so the submit-exclusion filter has something to check against —
# nothing in this codebase ever uses a button's selector as an action target.
_EXTRACT_BUTTONS_JS = r"""
() => {
  function textOf(el) {
    return (el.innerText || el.textContent || el.value || el.getAttribute('aria-label') || '')
      .replace(/\s+/g, ' ').trim();
  }
  const nodes = Array.from(document.querySelectorAll(
    'button, input[type="submit"], input[type="button"], [role="button"], a'
  ));
  const out = [];
  let idx = 0;
  for (const el of nodes) {
    const name = textOf(el);
    if (!name) continue;
    el.dataset.agentBtn = 'ab-' + idx;
    out.push({
      selector: `[data-agent-btn="ab-${idx}"]`,
      name: name,
      type: (el.getAttribute('type') || el.tagName).toLowerCase(),
    });
    idx++;
  }
  return out;
}
"""


class FormBrowser:
    def __init__(self, headed: bool = False, slow_mo_ms: int = 0):
        self._headed = headed
        self._slow_mo_ms = slow_mo_ms
        self._playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._submit_selectors: set[str] = set()

    def __enter__(self) -> "FormBrowser":
        self._playwright = sync_playwright().start()
        self.browser = self._playwright.chromium.launch(headless=not self._headed, slow_mo=self._slow_mo_ms)
        self.context = self.browser.new_context(accept_downloads=False)
        self.page = self.context.new_page()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        # Closing is explicit via .close() so a --headed run can keep the
        # window open for the user after the `with` block if desired.
        pass

    def close(self) -> None:
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if self._playwright:
            self._playwright.stop()

    def goto(self, url: str) -> None:
        self.page.goto(url, wait_until="domcontentloaded")

    def extract_fields(self) -> list[FormField]:
        raw = self.page.evaluate(_EXTRACT_FIELDS_JS)
        fields = []
        for r in raw:
            kind = _KIND_MAP.get(r["type"], FieldKind.TEXT)
            fields.append(
                FormField(
                    selector=r["selector"],
                    label=r["label"],
                    kind=kind,
                    options=r.get("options") or [],
                    current_value=r.get("current_value") or "",
                    required=bool(r.get("required")),
                    max_length=r.get("max_length"),
                )
            )
        return fields

    def extract_buttons(self) -> list[PageButton]:
        raw = self.page.evaluate(_EXTRACT_BUTTONS_JS)
        buttons = [PageButton(selector=r["selector"], name=r["name"], elem_type=r["type"]) for r in raw]
        self._submit_selectors = {b.selector for b in buttons if is_submit_like(b.name, b.elem_type)}
        return buttons

    def _assert_not_submit_like(self, selector: str) -> None:
        if selector in self._submit_selectors:
            raise RuntimeError(
                f"Refusing to act on {selector!r} — it was identified as a submit-like control."
            )

    # ── the only five verbs this agent can perform ──────────────────────
    def fill_text(self, selector: str, value: str) -> None:
        self._assert_not_submit_like(selector)
        self.page.fill(selector, value)

    def select_option(self, selector: str, value: str) -> None:
        self._assert_not_submit_like(selector)
        try:
            self.page.select_option(selector, label=value)
        except Exception:
            self.page.select_option(selector, value=value)

    def check(self, selector: str, checked: bool = True) -> None:
        self._assert_not_submit_like(selector)
        if checked:
            self.page.check(selector)
        else:
            self.page.uncheck(selector)

    def upload_file(self, selector: str, path: str) -> None:
        self._assert_not_submit_like(selector)
        self.page.set_input_files(selector, path)

    def click_to_expand(self, selector: str) -> None:
        self._assert_not_submit_like(selector)
        self.page.click(selector)

    def read_value(self, selector: str) -> str:
        return self.page.eval_on_selector(
            selector,
            """(el) => {
                if (el.type === 'checkbox' || el.type === 'radio') return String(el.checked);
                if (el.tagName.toLowerCase() === 'select') {
                    const opt = el.options[el.selectedIndex];
                    return opt ? opt.text.trim() : '';
                }
                if (el.type === 'file') return el.files.length ? el.files[0].name : '';
                return el.value || '';
            }""",
        )

    def screenshot(self, path: str) -> None:
        self.page.screenshot(path=path, full_page=True)

    def storage_state(self, path: str) -> None:
        self.context.storage_state(path=path)
