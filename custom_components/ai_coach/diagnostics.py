# SPDX-License-Identifier: GPL-3.0-or-later
"""Diagnostics support for AI Coach."""

from __future__ import annotations

from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.core import HomeAssistant

from . import AiCoachConfigEntry
from .const import CONF_ENTITIES, CONF_INSTRUCTIONS, CONF_PROMPT_TEMPLATE

# Entity IDs and prompts can describe the household: keep them out of shared diagnostics.
TO_REDACT = {CONF_ENTITIES, CONF_INSTRUCTIONS, CONF_PROMPT_TEMPLATE}


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: AiCoachConfigEntry) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    return {
        "config": async_redact_data({**entry.data, **entry.options}, TO_REDACT),
        "coach": entry.runtime_data.diagnostics(),
    }
