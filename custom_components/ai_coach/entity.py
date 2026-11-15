# SPDX-License-Identifier: GPL-3.0-or-later
"""Base entity for AI Coach."""

from __future__ import annotations

from typing import Any

from homeassistant.core import callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity import Entity, EntityDescription
from homeassistant.util import slugify

from .coach import Coach
from .const import DEFAULT_NAME, DOMAIN, ENTITY_PREFIX


class CoachEntity(Entity):
    """Common behaviour: device grouping, English entity IDs, push updates."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, coach: Coach, description: EntityDescription, platform: str) -> None:
        """Initialise the entity."""
        self.coach = coach
        self.entity_description = description
        entry = coach.entry
        self._attr_translation_key = description.key
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        # Explicit English object IDs, independent of the UI language: sensor.ai_coach_<name>_score
        name = slugify(entry.title) or slugify(DEFAULT_NAME)
        prefix = name if name.startswith(ENTITY_PREFIX) else f"{ENTITY_PREFIX}_{name}"
        self.entity_id = f"{platform}.{prefix}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="AI Coach",
            model=coach.topic[:60],
            sw_version=coach.version,
            entry_type=DeviceEntryType.SERVICE,
        )
        self._written: Any = None

    async def async_added_to_hass(self) -> None:
        """Subscribe to coach updates."""
        self.async_on_remove(self.coach.add_listener(self._on_update))

    @callback
    def _on_update(self) -> None:
        """Write the state only when it actually changed."""
        current = (self.state, self.extra_state_attributes, self.available)
        if current != self._written:
            self._written = current
            self.async_write_ha_state()
