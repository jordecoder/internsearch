"""Central Claude SDK access, shared by every module that calls Claude — the
API endpoints (agent, interview) and the pipeline's career scoring / form
filler, which import this lazily.

Everything goes through `structured()`: one request constrained to a JSON
schema derived from a Pydantic model, so callers get a validated object back
instead of hand-parsing free-form text.

(.env is already loaded by this point when imported via the api package — see
api/__init__.py. The pipeline sets ANTHROPIC_API_KEY as a real env var.)
"""
from __future__ import annotations

import copy
from functools import lru_cache
from typing import Any, TypeVar

import anthropic
from pydantic import BaseModel

MODEL = "claude-opus-5"

# Server-side refusal fallback: if Opus 5's safety classifiers decline a
# request, the API re-runs it on Anthropic's recommended fallback model inside
# the same call instead of returning a refusal.
_FALLBACK_BETA = "server-side-fallback-2026-07-01"

_MAX_PAUSE_RESUMES = 3

T = TypeVar("T", bound=BaseModel)


class ClaudeError(RuntimeError):
    """Claude couldn't produce a usable answer (refusal, truncation, bad JSON)."""


@lru_cache(maxsize=1)
def get_client() -> anthropic.Anthropic:
    # Built lazily so importing this module never requires ANTHROPIC_API_KEY.
    return anthropic.Anthropic()


def is_configured() -> bool:
    import os

    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _strict_schema(model: type[BaseModel]) -> dict:
    """Pydantic's JSON schema, reshaped for structured outputs: $refs inlined,
    every object closed (additionalProperties: false) with all fields required."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def fix(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node:
                return fix(copy.deepcopy(defs[node["$ref"].split("/")[-1]]))
            node = {k: fix(v) for k, v in node.items() if k not in ("title", "default")}
            if node.get("type") == "object" and "properties" in node:
                node["additionalProperties"] = False
                node["required"] = list(node["properties"])
            return node
        if isinstance(node, list):
            return [fix(v) for v in node]
        return node

    return fix(schema)


def _final_text(content: list) -> str:
    # With server tools (web fetch) the response interleaves tool blocks and
    # text; the structured JSON is the text after the last tool block.
    tail: list[str] = []
    for block in content:
        if block.type == "text":
            tail.append(block.text)
        else:
            tail = []
    return "".join(tail)


def structured(
    *,
    system: str,
    prompt: str,
    output: type[T],
    effort: str = "high",
    max_tokens: int = 16000,
    tools: list[dict] | None = None,
) -> T:
    """Run one Claude request whose answer must match `output`'s schema."""
    first_turn = {"role": "user", "content": prompt}
    messages: list[dict] = [first_turn]
    extra: dict[str, Any] = {"tools": tools} if tools else {}

    for _ in range(_MAX_PAUSE_RESUMES + 1):
        response = get_client().beta.messages.create(
            model=MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            thinking={"type": "adaptive"},
            output_config={
                "effort": effort,
                "format": {"type": "json_schema", "schema": _strict_schema(output)},
            },
            betas=[_FALLBACK_BETA],
            fallbacks="default",
            **extra,
        )
        # A long server-tool turn can pause; resend it as-is to let Claude continue.
        if response.stop_reason != "pause_turn":
            break
        messages = [first_turn, {"role": "assistant", "content": response.content}]
    else:
        raise ClaudeError("Claude kept pausing without finishing — try again.")

    if response.stop_reason == "refusal":
        raise ClaudeError("Claude declined this request.")
    if response.stop_reason == "max_tokens":
        raise ClaudeError("Claude's answer was cut off — try again with a shorter input.")

    try:
        return output.model_validate_json(_final_text(response.content))
    except ValueError as exc:
        raise ClaudeError(f"Claude returned an unparseable response (request {response._request_id}).") from exc
