"""Shared types for the application-filling agent.

The `ActionType` enum is the safety boundary described in backend/agent/README.md:
it is the complete set of things the agent is physically capable of doing to a
page. There is deliberately no generic "click" action and nothing that can
submit a form — those verbs simply don't exist in this vocabulary, so no prompt,
bug, or bad Gemini response can produce a `FillAction` that submits anything.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum


class ActionType(str, Enum):
    FILL_TEXT = "fill_text"
    SELECT_OPTION = "select_option"
    CHECK = "check"
    UPLOAD_FILE = "upload_file"
    CLICK_TO_EXPAND = "click_to_expand"


class FieldKind(str, Enum):
    TEXT = "text"
    EMAIL = "email"
    TEL = "tel"
    TEXTAREA = "textarea"
    SELECT = "select"
    CHECKBOX = "checkbox"
    RADIO = "radio"
    FILE = "file"


# Accessible-name patterns that mark a button as submit-like. Anything matching
# this is excluded from being an action target anywhere in the pipeline —
# independently in the browser layer, the mapper, and the filler.
SUBMIT_PATTERN = re.compile(
    r"submit|send\s+application|send\s+my\s+application|apply\s+now|"
    r"^apply$|apply\s+for\s+this|finish\s+application|complete\s+application",
    re.IGNORECASE,
)


def is_submit_like(name: str | None, elem_type: str | None = None) -> bool:
    name = (name or "").strip()
    if elem_type and elem_type.lower() == "submit":
        return True
    if not name:
        return False
    return bool(SUBMIT_PATTERN.search(name))


@dataclass(frozen=True)
class FormField:
    selector: str
    label: str
    kind: FieldKind
    options: list[str] = field(default_factory=list)
    current_value: str = ""
    required: bool = False
    max_length: int | None = None


@dataclass(frozen=True)
class PageButton:
    selector: str
    name: str
    elem_type: str


@dataclass(frozen=True)
class FillAction:
    selector: str
    field_label: str
    action: ActionType
    value: str = ""

    def __post_init__(self) -> None:
        # Coerce/validate even if constructed from an external (e.g. Gemini
        # tool-call) string — an invalid value raises here, before it can
        # reach the browser layer.
        object.__setattr__(self, "action", ActionType(self.action))


@dataclass
class FillResult:
    field_label: str
    action: ActionType
    value: str
    confirmed: bool
    note: str = ""
