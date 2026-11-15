"""The analysis engine on a real Home Assistant core, with a fake AI Task service."""

from datetime import datetime, time
from typing import Any

from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import area_registry as ar, entity_registry as er, label_registry as lr
from homeassistant.util import dt as dt_util
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_capture_events

from custom_components.ai_coach.coach import in_window
from custom_components.ai_coach.const import DOMAIN, EVENT_ANALYSIS_COMPLETED

ANSWER = {
    "summary": "Power at 450 W, mostly the server.",
    "score": 64,
    "confidence": 8,
    "tips": ["Energy: switch the server off from 01:00 to 07:00", "Savings: run the dishwasher after 19:00"],
}


@pytest.fixture
def ai_calls(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Register a fake ai_task.generate_data that records its calls."""
    calls: list[dict[str, Any]] = []

    async def generate(call: ServiceCall) -> dict[str, Any]:
        calls.append(dict(call.data))
        if hass.data.get("fail"):
            raise HomeAssistantError("model not found")
        return {"conversation_id": "x", "data": dict(ANSWER)}

    hass.services.async_register("ai_task", "generate_data", generate, supports_response=SupportsResponse.ONLY)
    hass.states.async_set("ai_task.local_model", "unknown")
    return calls


async def _setup(hass: HomeAssistant, **options: Any) -> MockConfigEntry:
    data = {"topic": "energy use of the home", "entities": ["sensor.home_power"], "update_interval": 0}
    data.update(options)
    entry = MockConfigEntry(domain=DOMAIN, title="Energy", data=data)
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_run_analysis_updates_every_entity(hass: HomeAssistant, ai_calls) -> None:
    hass.states.async_set("sensor.home_power", "450", {"unit_of_measurement": "W", "friendly_name": "Home power"})
    entry = await _setup(hass)
    events = async_capture_events(hass, EVENT_ANALYSIS_COMPLETED)

    await hass.services.async_call(
        "button", "press", {"entity_id": "button.ai_coach_energy_run_analysis"}, blocking=True
    )
    await hass.async_block_till_done()

    call = ai_calls[0]
    assert call["entity_id"] == "ai_task.local_model"
    assert "- Home power: 450 W" in call["instructions"]
    assert "Topic of the analysis: energy use of the home." in call["instructions"]
    assert set(call["structure"]) == {"summary", "score", "tips", "confidence"}

    assert hass.states.get("sensor.ai_coach_energy_score").state == "64"
    assert hass.states.get("sensor.ai_coach_energy_confidence").state == "8"
    assert hass.states.get("sensor.ai_coach_energy_summary").state == ANSWER["summary"]
    tips = hass.states.get("sensor.ai_coach_energy_tips")
    assert tips.state == "2"
    assert tips.attributes["tips"] == ANSWER["tips"]
    assert hass.states.get("binary_sensor.ai_coach_energy_analysing").state == "off"
    assert hass.states.get("binary_sensor.ai_coach_energy_problem").state == "off"
    assert hass.states.get("sensor.ai_coach_energy_last_analysis").state not in ("unknown", "unavailable")
    assert events[0].data["score"] == 64
    assert events[0].data["config_entry_id"] == entry.entry_id

    # the result survives a reload
    await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get("sensor.ai_coach_energy_score").state == "64"


async def test_action_returns_the_result_and_reports_failures(hass: HomeAssistant, ai_calls) -> None:
    entry = await _setup(hass)
    result = await hass.services.async_call(
        DOMAIN, "run_analysis", {"config_entry_id": entry.entry_id}, blocking=True, return_response=True
    )
    assert result["score"] == 64

    hass.data["fail"] = True
    with pytest.raises(HomeAssistantError, match="model not found"):
        await hass.services.async_call(DOMAIN, "run_analysis", {"config_entry_id": entry.entry_id}, blocking=True)
    await hass.async_block_till_done()
    assert hass.states.get("binary_sensor.ai_coach_energy_problem").state == "on"
    last = hass.states.get("sensor.ai_coach_energy_last_analysis")
    assert last.attributes["error"] == "model not found"
    # the previous result stays visible
    assert hass.states.get("sensor.ai_coach_energy_score").state == "64"


async def test_set_result(hass: HomeAssistant, ai_calls) -> None:
    entry = await _setup(hass)
    await hass.services.async_call(
        DOMAIN,
        "set_result",
        {"config_entry_id": entry.entry_id, "summary": "Imported.", "score": 45, "confidence": 8, "tips": ["Air: x"]},
        blocking=True,
    )
    await hass.async_block_till_done()
    assert hass.states.get("sensor.ai_coach_energy_score").state == "45"
    assert hass.states.get("sensor.ai_coach_energy_summary").attributes["text"] == "Imported."
    assert ai_calls == []


async def test_prompt_template_and_label(hass: HomeAssistant, ai_calls) -> None:
    area = ar.async_get(hass).async_create("Kitchen")
    label = lr.async_get(hass).async_create("Energy")
    reg = er.async_get(hass)
    fridge = reg.async_get_or_create("sensor", "test", "fridge", suggested_object_id="fridge_energy")
    reg.async_update_entity(fridge.entity_id, labels={label.label_id}, area_id=area.id)
    hass.states.async_set(fridge.entity_id, "1.3", {"unit_of_measurement": "kWh", "friendly_name": "Fridge energy"})

    template = "Coach for {{ topic }} in {{ language }}.\n{{ coach_data }}\nHot: {{ states('sensor.home_power') }}"
    hass.states.async_set("sensor.home_power", "300", {"unit_of_measurement": "W", "friendly_name": "Home power"})
    entry = await _setup(hass, label=label.label_id, prompt_template=template)
    await entry.runtime_data.async_run()

    instructions = ai_calls[0]["instructions"]
    assert instructions.startswith("Coach for energy use of the home in English.")
    assert "- Home power: 300 W" in instructions
    assert "- Fridge energy [Kitchen]: 1.3 kWh" in instructions
    assert instructions.endswith("Hot: 300")


async def test_first_analysis_without_user_action(hass: HomeAssistant, ai_calls, freezer) -> None:
    await _setup(hass, update_interval=6)
    assert ai_calls == []
    freezer.tick(60)
    from pytest_homeassistant_custom_component.common import async_fire_time_changed

    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert len(ai_calls) == 1


async def test_schedule_respects_interval_and_window(hass: HomeAssistant, ai_calls) -> None:
    entry = await _setup(hass, update_interval=2, active_from="08:00:00", active_until="20:00:00")
    coach = entry.runtime_data
    runs = []
    coach._spawn = lambda: runs.append(1)
    tz = dt_util.get_default_time_zone()
    for hour in range(24):
        coach._on_hour(datetime(2026, 1, 5, hour, 0, tzinfo=tz))
    assert len(runs) == 7  # 8, 10, 12, 14, 16, 18, 20


def test_in_window() -> None:
    assert in_window(time(12), None, None)
    assert in_window(time(12), time(8), time(20))
    assert not in_window(time(21), time(8), time(20))
    assert in_window(time(23), time(22), time(6))
    assert in_window(time(5), time(22), time(6))
    assert not in_window(time(12), time(22), time(6))
