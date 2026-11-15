# SPDX-License-Identifier: GPL-3.0-or-later
"""Pure functions for the AI request: no Home Assistant imports.

The prompt is written in English, which every model understands best, and asks
for the answer in the language of the Home Assistant instance.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import asdict, dataclass, field
import math
import re
from typing import Any

from .const import MAX_TIPS, SUMMARY_MAX

LANGUAGES: dict[str, str] = {
    "en": "English",
    "it": "Italian",
    "de": "German",
    "fr": "French",
    "es": "Spanish",
    "pt": "Portuguese",
    "nl": "Dutch",
    "pl": "Polish",
    "sv": "Swedish",
    "da": "Danish",
    "nb": "Norwegian",
    "fi": "Finnish",
    "cs": "Czech",
    "ru": "Russian",
    "uk": "Ukrainian",
    "el": "Greek",
    "tr": "Turkish",
    "ja": "Japanese",
    "zh": "Chinese",
    "ko": "Korean",
}
# An example theme label in the answer language, so the model writes the chips in it.
THEME_EXAMPLE: dict[str, str] = {"en": "Energy", "it": "Energia", "de": "Energie", "fr": "Energie", "es": "Energia"}

STRUCTURE: dict[str, dict[str, Any]] = {
    "summary": {
        "description": "Current situation in at most 220 characters, with the most relevant value",
        "required": True,
        "selector": {"text": {}},
    },
    "score": {
        "description": "Overall score from 5 to 100, consistent with the summary",
        "required": True,
        "selector": {"number": {"min": 5, "max": 100}},
    },
    "tips": {
        "description": "3 to 5 actionable tips, each starting with a one-word theme label and a colon",
        "required": True,
        "selector": {"text": {"multiple": True}},
    },
    "confidence": {
        "description": "Confidence from 1 to 10 about completeness and consistency of the data",
        "required": True,
        "selector": {"number": {"min": 1, "max": 10}},
    },
}


@dataclass
class CoachResult:
    """The outcome of one analysis, as stored and shown."""

    time: str  # ISO 8601
    summary: str = ""
    score: int | None = None
    confidence: int | None = None
    tips: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        """Serialisable form."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> CoachResult | None:
        """Restore a stored result; None if it is not usable."""
        if not isinstance(data, Mapping) or not isinstance(data.get("time"), str):
            return None
        return normalize_result(data, data["time"])


def language_name(code: str | None) -> str:
    """English name of a language code ("it-IT" -> "Italian")."""
    base = (code or "en").replace("_", "-").split("-")[0].lower()
    return LANGUAGES.get(base, "English")


def _clamp(value: Any, low: int, high: int) -> int | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return round(max(low, min(high, number)))


_BULLET = re.compile(r"^(?:[-*•]|\d+[.)])\s+")


def normalize_result(data: Mapping[str, Any], when: str) -> CoachResult:
    """Validate the structured output of the AI task."""
    tips = data.get("tips")
    if isinstance(tips, str):
        tips = tips.splitlines()
    if not isinstance(tips, list | tuple):
        tips = []
    clean = [_BULLET.sub("", str(t).strip()) for t in tips if t is not None and str(t).strip()]
    return CoachResult(
        time=when,
        summary=str(data.get("summary") or "").strip()[:SUMMARY_MAX],
        score=_clamp(data.get("score"), 0, 100),
        confidence=_clamp(data.get("confidence"), 0, 10),
        tips=clean[:MAX_TIPS],
    )


def data_line(name: str, area: str | None, state: str | None, unit: str | None) -> str:
    """One line of the data block: ``- Name [Area]: value unit``."""
    if state is None:
        value = "missing"
    elif state in ("unavailable", "unknown"):
        value = state
    else:
        value = f"{state} {unit}" if unit else state
    return f"- {name}{f' [{area}]' if area else ''}: {value}"


def data_text(lines: Iterable[str]) -> str:
    """The data block sent to the AI."""
    text = "\n".join(lines)
    return text or "No data."


def default_prompt(topic: str, data: str, when: str, language: str, theme_example: str, extra: str = "") -> str:
    """Instructions used when the coach has no prompt template of its own."""
    extra = extra.strip()
    return "\n".join(
        [
            "You are an AI coach inside the Home Assistant smart home app. You analyse real data collected "
            "automatically and propose practical, concrete actions.",
            "",
            f"Topic of the analysis: {topic}.",
            f"Date and time: {when}.",
            "",
            'Data (name [area]: value unit). "unavailable" means the sensor is offline and "unknown" or "missing" '
            "that it has no value: never invent those values and do not base advice on them, consider them only "
            "for the confidence.",
            data,
            f"\nAdditional instructions from the user:\n{extra}\n" if extra else "",
            f"Write in {language}. Provide:",
            "1. summary: the current situation in at most 220 characters, citing the most relevant value with its "
            "unit and where it comes from.",
            f"2. tips: from 3 to {MAX_TIPS} actionable tips, at most 250 characters each, each about a different "
            f'theme. Start every tip with a one-word theme label in {language} followed by a colon (for example "'
            f'{theme_example}: ..."). After the label cite the current value and how far it is from a sensible '
            "target, then a concrete action with quantity or duration and when to do it. No generic advice.",
            "3. score: overall score from 5 to 100, consistent with the summary: 80-100 excellent, 60-79 good, "
            "40-59 needs attention, 5-39 critical.",
            "4. confidence: from 1 to 10, only about how complete and consistent the data is (10 = every value "
            "available and coherent), not about how good the situation is.",
        ]
    )
