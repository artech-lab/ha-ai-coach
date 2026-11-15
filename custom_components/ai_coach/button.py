# SPDX-License-Identifier: GPL-3.0-or-later
"""Button for AI Coach: run the analysis now."""

from __future__ import annotations

from homeassistant.components.button import ButtonEntity, ButtonEntityDescription
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import AiCoachConfigEntry
from .const import DOMAIN
from .entity import CoachEntity

RUN = ButtonEntityDescription(key="run_analysis")


async def async_setup_entry(
    hass: HomeAssistant,
    entry: AiCoachConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the button."""
    async_add_entities([CoachButton(entry.runtime_data, RUN, "button")])


class CoachButton(CoachEntity, ButtonEntity):
    """Runs the analysis now."""

    async def async_press(self) -> None:
        """Run the analysis and report a failure to the user."""
        if self.coach.running:
            return
        try:
            await self.coach.async_run()
        except HomeAssistantError:
            raise
        except Exception as err:
            raise HomeAssistantError(
                translation_domain=DOMAIN,
                translation_key="analysis_failed",
                translation_placeholders={"name": self.coach.entry.title, "error": str(err)},
            ) from err
