# Application-filling agent

Opens a job application form with a real browser, fills it in using your
candidate profile and tailored content, and stops. It never clicks Submit,
Apply, or Send — you do that yourself after reviewing what it filled in.

## The safety model

This isn't "the AI is instructed not to submit." It's architecturally
incapable of it:

- The only actions the fill plan can express at all are `fill_text`,
  `select_option`, `check`, `upload_file`, and `click_to_expand`
  (`agent/schema.py::ActionType`). There is no generic "click this button"
  action anywhere in the vocabulary — not for the deterministic mapper, not
  for the Gemini fallback, not for the executor. A submit button is simply
  not a kind of thing this system can act on.
- Every button and link on the page is scanned for submit-like names
  ("Submit", "Apply Now", "Send Application", `type=submit`, …) and those
  selectors are excluded from the fill plan independently in three places:
  `mapper.build_fill_plan`, `browser.FormBrowser` (every one of its five verbs
  refuses to act on a selector flagged this way), and `filler.execute_fill_plan`
  (an assertion that would abort the whole run if it were ever somehow
  reached). See `backend/tests/test_apply_agent.py` — it asserts the mock
  form's submit-click counter is still zero after a full run.
- The Gemini fallback (used only for free-text fields the deterministic rules
  don't recognize) is told to answer honestly from your profile/JD/cover
  letter and to say `skip: true` rather than invent anything — but even if it
  went rogue, its output can only ever become a `fill_text` action, because
  that's the only thing `_gemini_fill_free_text` knows how to construct.

What it does at the end of a run: fills every field it can, takes a
full-page screenshot, writes a `summary.json` (what got filled, what didn't,
confirmed by reading the value back out of the DOM), and — with `--headed`
— leaves the browser window open and waits for you at a terminal prompt
before closing it. You look at the page, and if it's right, **you** click
Submit.

**Pointing this at a real company's live application form is your call to
make while you're at the keyboard, not something to queue up unattended.**
Nothing about the architecture stops you from doing that (it's just a normal
browser tab), but the whole point of stopping before submit is so a human is
actually looking at the result before it goes out under your name.

## Setup

```powershell
venv\Scripts\Activate.ps1
pip install -r backend\agent\requirements.txt
playwright install chromium

copy backend\agent\candidate_profile.example.yaml backend\agent\candidate_profile.yaml
# then edit candidate_profile.yaml with your real details — it's gitignored
```

`GEMINI_API_KEY` is read from `.env` (same variable the rest of this repo
already uses for `backend/api/rag.py`). Without it, the agent still fills
everything the deterministic rules recognize; it just leaves free-text
fields it can't map for you to fill in by hand instead of guessing.

## Running it

```powershell
cd backend
python -m agent.apply_agent "https://boards.greenhouse.io/example/jobs/12345" `
    --profile agent/candidate_profile.yaml `
    --jd-file jd.txt `
    --cover-letter-file cover_letter.txt `
    --essay-file essay_answer.txt `
    --headed
```

- `--headed` shows the browser and waits for you at the end before closing —
  this is how you'd actually use it, since you need the live tab open to
  click Submit.
- Without `--headed` it runs headless and just leaves you the screenshot +
  `summary.json` + a saved `storage_state.json` (cookies/session) under
  `agent/review/<timestamp>/`.
- `--jd-file` / `--cover-letter-file` / `--essay-file` are plain text files —
  reuse whatever the resume tailor / cover letter generator produced.
- `--no-gemini` skips the LLM fallback entirely (fully deterministic, zero
  network calls) — useful for a quick offline check of what the rule-based
  mapper alone can cover.

## `candidate_profile.yaml`

See `candidate_profile.example.yaml` for the full shape: name, contact info,
links, school/degree, work authorization, `resume_pdf_path` /
`cover_letter_path` for file-upload fields, and a free-form `answers:` map
for canned answers to recurring screener questions (matched loosely against
the field's label).

## Known limitations / TODOs

- **Tested only against a local mock form** (`backend/tests/fixtures/mock_application_form.html`),
  deliberately — this was built without ever pointing Playwright at a real
  company's site, so there's no real-world guarantee yet about how well the
  label-extraction heuristics hold up against Greenhouse's/Lever's/Workday's
  actual DOM quirks (multi-step wizards, React-controlled inputs that ignore
  `.fill()` without a follow-up keyboard event, shadow DOM, iframed forms).
  Try it against a real posting yourself with `--headed` before trusting it,
  and expect to iterate on `mapper.py`'s regex rules per ATS.
- **`--resume-from` (reopening a previously-filled session) isn't
  implemented.** Playwright's `storage_state.json` only captures
  cookies/localStorage, not unsaved form input, so "resuming" a headless run
  wouldn't actually restore what was typed into the fields — it would need to
  re-run the fill against the reopened page, which is just running with
  `--headed` again. Left out rather than shipping something that implies more
  than it does.
- **No CAPTCHA / anti-bot handling.** Out of scope — if a site throws a
  CAPTCHA, the agent will simply fail to fill whatever's behind it and you'll
  see that in `summary.json`.
- **Multi-page/wizard forms** (fill page 1, click Next, fill page 2, …) aren't
  handled — `click_to_expand` is only for in-page accordions/dropdowns that
  reveal more of the *same* page, not pagination. Each step would need its
  own `apply_agent` invocation against the resulting URL/state today.
