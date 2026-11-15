"""Pure functions of the AI request."""

from custom_components.ai_coach.prompt import (
    STRUCTURE,
    CoachResult,
    data_line,
    data_text,
    default_prompt,
    language_name,
    normalize_result,
)


def test_language_name() -> None:
    assert language_name("it") == "Italian"
    assert language_name("it-IT") == "Italian"
    assert language_name("pt_BR") == "Portuguese"
    assert language_name("xx") == "English"
    assert language_name(None) == "English"


def test_normalize_result_clamps_and_cleans() -> None:
    result = normalize_result(
        {"summary": "  ok ", "score": 104.6, "confidence": -2, "tips": ["- Air: open", "", "2) Sleep: 23:00", *"abcd"]},
        "2026-01-01T00:00:00+00:00",
    )
    assert result.summary == "ok"
    assert result.score == 100
    assert result.confidence == 0
    assert result.tips == ["Air: open", "Sleep: 23:00", "a", "b", "c"]
    assert normalize_result({"tips": "one\n\ntwo", "score": "n/a"}, "t").tips == ["one", "two"]
    assert normalize_result({"score": "n/a"}, "t").score is None
    assert normalize_result({"score": float("nan")}, "t").score is None


def test_result_round_trip() -> None:
    result = CoachResult(time="2026-01-01T00:00:00+00:00", summary="s", score=70, confidence=8, tips=["a"])
    assert CoachResult.from_dict(result.as_dict()) == result
    assert CoachResult.from_dict({}) is None
    assert CoachResult.from_dict({"time": 5}) is None


def test_data_lines_match_the_card() -> None:
    assert data_line("Living room CO2", "Living room", "1180", "ppm") == "- Living room CO2 [Living room]: 1180 ppm"
    assert data_line("Humidity", None, "unavailable", "%") == "- Humidity: unavailable"
    assert data_line("sensor.gone", None, None, None) == "- sensor.gone: missing"
    assert data_text([]) == "No data."


def test_default_prompt() -> None:
    prompt = default_prompt(
        "home energy", "- Power: 300 W", "Monday", "Italian", "Energia", "Night tariff after 23:00."
    )
    assert "Topic of the analysis: home energy." in prompt
    assert "- Power: 300 W" in prompt
    assert "Write in Italian." in prompt
    assert '"Energia: ..."' in prompt
    assert "Night tariff after 23:00." in prompt
    assert "Additional instructions" not in default_prompt("t", "d", "w", "English", "Energy")
    assert set(STRUCTURE) == {"summary", "score", "tips", "confidence"}
