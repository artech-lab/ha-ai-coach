"""Tests for the config and options flows."""

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.ai_coach.const import DOMAIN

USER_INPUT = {
    "name": "Energy",
    "topic": "energy use of the home",
    "entities": ["sensor.home_power"],
    "update_interval": 0,
}


async def test_user_flow(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM

    result = await hass.config_entries.flow.async_configure(result["flow_id"], dict(USER_INPUT))
    assert result["type"] is FlowResultType.CREATE_ENTRY
    assert result["title"] == "Energy"
    assert result["data"]["entities"] == ["sensor.home_power"]
    await hass.async_block_till_done()
    for entity_id in (
        "sensor.ai_coach_energy_score",
        "sensor.ai_coach_energy_confidence",
        "sensor.ai_coach_energy_summary",
        "sensor.ai_coach_energy_tips",
        "sensor.ai_coach_energy_last_analysis",
        "binary_sensor.ai_coach_energy_analysing",
        "binary_sensor.ai_coach_energy_problem",
        "button.ai_coach_energy_run_analysis",
    ):
        assert hass.states.get(entity_id) is not None, entity_id


async def test_user_flow_errors(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    bad = {**USER_INPUT, "entities": [], "active_from": "08:00:00"}
    result = await hass.config_entries.flow.async_configure(result["flow_id"], bad)
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "no_data", "active_until": "window_incomplete"}


async def test_options_flow(hass: HomeAssistant) -> None:
    entry = MockConfigEntry(domain=DOMAIN, title="Energy", data=dict(USER_INPUT, name=None))
    entry.add_to_hass(hass)
    await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.options.async_configure(
        result["flow_id"],
        {
            "topic": "energy",
            "entities": [],
            "label": "energy",
            "update_interval": 2,
            "active_from": "08:00:00",
            "active_until": "20:00:00",
            "prompt_template": "Custom {{ topic }}",
        },
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    coach = entry.runtime_data
    assert coach.label == "energy"
    assert coach.interval == 2
    assert coach.active_from.hour == 8
    assert coach.prompt_template == "Custom {{ topic }}"
    assert coach.ai_task_entity is None
