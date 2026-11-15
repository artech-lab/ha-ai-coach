# SPDX-License-Identifier: GPL-3.0-or-later
"""AI Coach: scheduled AI analysis of any group of entities, with a bundled card."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration
import voluptuous as vol

from .coach import Coach
from .const import (
    ATTR_CONFIDENCE,
    ATTR_CONFIG_ENTRY_ID,
    ATTR_SCORE,
    ATTR_SUMMARY,
    ATTR_TIPS,
    CARD_FILENAME,
    CARD_URL,
    DOMAIN,
    SERVICE_RUN_ANALYSIS,
    SERVICE_SET_RESULT,
)

PLATFORMS: list[Platform] = [Platform.BINARY_SENSOR, Platform.BUTTON, Platform.SENSOR]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type AiCoachConfigEntry = ConfigEntry[Coach]

RUN_SCHEMA = vol.Schema({vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string})
SET_RESULT_SCHEMA = vol.Schema(
    {
        vol.Required(ATTR_CONFIG_ENTRY_ID): cv.string,
        vol.Required(ATTR_SUMMARY): cv.string,
        vol.Optional(ATTR_SCORE): vol.All(vol.Coerce(float), vol.Range(min=0, max=100)),
        vol.Optional(ATTR_CONFIDENCE): vol.All(vol.Coerce(float), vol.Range(min=0, max=10)),
        vol.Optional(ATTR_TIPS, default=list): vol.All(cv.ensure_list, [cv.string]),
    }
)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the bundled dashboard card, load it in every dashboard and register the actions.

    The version in ``manifest.json`` is the single source of truth: it is
    appended to the card URL, which busts the browser cache after an update
    and tells the card its own version.
    """
    version = str((await async_get_integration(hass, DOMAIN)).version)
    hass.data[DOMAIN] = version
    card = Path(__file__).parent / "frontend" / CARD_FILENAME
    await hass.http.async_register_static_paths([StaticPathConfig(CARD_URL, str(card), cache_headers=False)])
    add_extra_js_url(hass, f"{CARD_URL}?v={version}")

    async def run_analysis(call: ServiceCall) -> ServiceResponse:
        coach = _coach(call)
        try:
            result = await coach.async_run()
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="analysis_failed",
                translation_placeholders={"name": coach.entry.title, "error": str(err)},
            ) from err
        return result.as_dict() if result else {}

    async def set_result(call: ServiceCall) -> None:
        values = {k: v for k, v in call.data.items() if k != ATTR_CONFIG_ENTRY_ID}
        await _coach(call).async_set_result(values)

    hass.services.async_register(
        DOMAIN, SERVICE_RUN_ANALYSIS, run_analysis, schema=RUN_SCHEMA, supports_response=SupportsResponse.OPTIONAL
    )
    hass.services.async_register(DOMAIN, SERVICE_SET_RESULT, set_result, schema=SET_RESULT_SCHEMA)
    return True


def _coach(call: ServiceCall) -> Coach:
    """The coach of the config entry named in an action call."""
    entry_id = call.data[ATTR_CONFIG_ENTRY_ID]
    entry = call.hass.config_entries.async_get_entry(entry_id)
    if entry is None or entry.domain != DOMAIN:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="entry_not_found",
            translation_placeholders={"entry_id": entry_id},
        )
    if entry.state is not ConfigEntryState.LOADED:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="entry_not_loaded",
            translation_placeholders={"name": entry.title},
        )
    return entry.runtime_data


async def async_setup_entry(hass: HomeAssistant, entry: AiCoachConfigEntry) -> bool:
    """Set up a coach from a config entry."""
    coach = Coach(hass, entry, hass.data[DOMAIN])
    await coach.async_load()
    entry.runtime_data = coach
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    coach.async_start()
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: AiCoachConfigEntry) -> bool:
    """Unload a config entry."""
    if unloaded := await hass.config_entries.async_unload_platforms(entry, PLATFORMS):
        await entry.runtime_data.async_stop()
    return unloaded


async def _async_reload(hass: HomeAssistant, entry: AiCoachConfigEntry) -> None:
    """Reload when the options change."""
    await hass.config_entries.async_reload(entry.entry_id)
