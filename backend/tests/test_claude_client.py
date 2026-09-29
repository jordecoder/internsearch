"""Tests for api/claude_client.py — the request shape sent to Claude and how
each stop reason is handled. The SDK client is replaced with a fake; nothing
here touches the network.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

pytest.importorskip("anthropic")

from pydantic import BaseModel

from api import claude_client
from api.claude_client import ClaudeError, _strict_schema, structured


class Inner(BaseModel):
    name: str


class Outer(BaseModel):
    items: list[Inner]
    score: int = 5


def _text(t: str):
    return SimpleNamespace(type="text", text=t)


def _response(stop_reason: str, content: list):
    return SimpleNamespace(stop_reason=stop_reason, content=content, _request_id="req_test")


class FakeMessages:
    def __init__(self, responses: list):
        self.responses = list(responses)
        self.calls: list[dict] = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self.responses.pop(0)


@pytest.fixture
def fake_messages(monkeypatch):
    holder = {}

    def install(*responses):
        messages = FakeMessages(responses)
        client = SimpleNamespace(beta=SimpleNamespace(messages=messages))
        monkeypatch.setattr(claude_client, "get_client", lambda: client)
        holder["m"] = messages
        return messages

    return install


def test_strict_schema_inlines_refs_and_closes_objects():
    schema = _strict_schema(Outer)
    assert "$defs" not in json.dumps(schema) and "$ref" not in json.dumps(schema)
    assert schema["additionalProperties"] is False
    assert schema["required"] == ["items", "score"]  # defaults don't make a field optional
    item = schema["properties"]["items"]["items"]
    assert item["additionalProperties"] is False and item["required"] == ["name"]
    assert "default" not in schema["properties"]["score"]


def test_structured_sends_opus_5_with_fallback_and_schema(fake_messages):
    messages = fake_messages(_response("end_turn", [_text('{"items": [{"name": "a"}], "score": 3}')]))
    result = structured(system="sys", prompt="hi", output=Outer)

    assert result == Outer(items=[Inner(name="a")], score=3)
    call = messages.calls[0]
    assert call["model"] == "claude-opus-5"
    assert call["fallbacks"] == "default"
    assert call["betas"] == ["server-side-fallback-2026-07-01"]
    assert call["thinking"] == {"type": "adaptive"}
    assert call["output_config"]["format"]["type"] == "json_schema"
    assert "tools" not in call


def test_structured_resumes_after_pause_turn(fake_messages):
    paused_content = [SimpleNamespace(type="server_tool_use")]
    messages = fake_messages(
        _response("pause_turn", paused_content),
        _response("end_turn", [SimpleNamespace(type="web_fetch_tool_result"), _text('{"name": "done"}')]),
    )
    result = structured(system="s", prompt="p", output=Inner, tools=[{"type": "web_fetch_20260209", "name": "web_fetch"}])

    assert result.name == "done"
    resumed = messages.calls[1]["messages"]
    assert resumed[0] == {"role": "user", "content": "p"}
    assert resumed[1] == {"role": "assistant", "content": paused_content}


def test_structured_uses_only_text_after_the_last_tool_block(fake_messages):
    fake_messages(
        _response(
            "end_turn",
            [_text("Let me read the posting."), SimpleNamespace(type="web_fetch_tool_result"), _text('{"name": "x"}')],
        )
    )
    assert structured(system="s", prompt="p", output=Inner).name == "x"


@pytest.mark.parametrize(
    "stop_reason, message",
    [("refusal", "declined"), ("max_tokens", "cut off")],
)
def test_structured_raises_on_unusable_stop_reasons(fake_messages, stop_reason, message):
    fake_messages(_response(stop_reason, []))
    with pytest.raises(ClaudeError, match=message):
        structured(system="s", prompt="p", output=Inner)


def test_structured_raises_on_invalid_json(fake_messages):
    fake_messages(_response("end_turn", [_text("not json")]))
    with pytest.raises(ClaudeError, match="unparseable"):
        structured(system="s", prompt="p", output=Inner)
