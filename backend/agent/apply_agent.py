"""CLI: fill (never submit) a job application form.

    python -m agent.apply_agent <url> --profile agent/candidate_profile.yaml \
        --jd-file jd.txt --cover-letter-file cl.txt --essay-file essay.txt --headed

Run from the `backend/` directory (matches how the rest of this repo's tests
and `api` package are run) so that `agent.*` imports resolve.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml
from dotenv import load_dotenv

from agent.browser import FormBrowser
from agent.filler import execute_fill_plan
from agent.mapper import build_fill_plan

load_dotenv()


def _read_text(path: str | None) -> str:
    if not path:
        return ""
    return Path(path).read_text(encoding="utf-8")


def _print_report(summary: dict, out_dir: Path) -> None:
    print(f"\nFilled {len(summary['filled_fields'])} field(s):")
    for f in summary["filled_fields"]:
        mark = "OK" if f["confirmed"] else "??"
        shown = f["value"] if len(f["value"]) <= 60 else f["value"][:57] + "..."
        print(f"  [{mark}] {f['field_label']}: {f['action']} -> {shown!r}")

    if summary["unfilled_fields_needing_attention"]:
        print(f"\n{len(summary['unfilled_fields_needing_attention'])} field(s) need your attention:")
        for f in summary["unfilled_fields_needing_attention"]:
            print(f"  - {f['label']}")

    print(f"\nScreenshot + summary saved to: {out_dir}")
    print(
        "\nThis agent never clicks Submit / Apply / Send — that button was never even a "
        "candidate action for it. Review the fields above and the live browser tab, then "
        "click Submit yourself if everything looks right."
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m agent.apply_agent",
        description="Fill out a job application form with Playwright + Gemini. Never submits it.",
    )
    parser.add_argument("url", help="Application form URL to open")
    parser.add_argument("--profile", default="agent/candidate_profile.yaml")
    parser.add_argument("--jd-file", default=None, help="Path to a text file with the job description")
    parser.add_argument("--cover-letter-file", default=None, help="Pre-generated cover letter text to reuse")
    parser.add_argument("--essay-file", default=None, help='Pre-generated "why this company" essay answer to reuse')
    parser.add_argument("--headed", action="store_true", help="Show the browser and wait for you before closing it")
    parser.add_argument("--no-gemini", action="store_true", help="Skip the LLM fallback for free-text fields")
    parser.add_argument("--out-dir", default=None, help="Where to save the screenshot + summary.json")
    args = parser.parse_args(argv)

    profile_path = Path(args.profile)
    if not profile_path.exists():
        print(
            f"Candidate profile not found at {profile_path}.\n"
            f"Copy agent/candidate_profile.example.yaml to {profile_path} and fill in your "
            "real details first — nothing in this repo ships with real PII in it.",
            file=sys.stderr,
        )
        return 1
    profile = yaml.safe_load(profile_path.read_text(encoding="utf-8")) or {}

    jd_text = _read_text(args.jd_file)
    cover_letter_text = _read_text(args.cover_letter_file)
    essay_text = _read_text(args.essay_file)

    out_dir = (
        Path(args.out_dir)
        if args.out_dir
        else Path("agent/review") / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )

    browser = FormBrowser(headed=args.headed)
    browser.__enter__()
    try:
        browser.goto(args.url)
        fields = browser.extract_fields()
        buttons = browser.extract_buttons()

        actions, unfilled = build_fill_plan(
            fields,
            buttons,
            profile,
            job_description=jd_text,
            cover_letter_text=cover_letter_text,
            essay_answer_text=essay_text,
            gemini_enabled=not args.no_gemini,
        )

        summary = execute_fill_plan(browser, actions, unfilled, out_dir, url=args.url)
        browser.storage_state(str(out_dir / "storage_state.json"))
        (out_dir / "session.json").write_text(json.dumps({"url": args.url}), encoding="utf-8")

        _print_report(summary, out_dir)

        if args.headed:
            input(
                "\nBrowser window is open for your review. Submit it yourself in that window "
                "if you want to apply, then press Enter here to close it..."
            )
    finally:
        browser.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
