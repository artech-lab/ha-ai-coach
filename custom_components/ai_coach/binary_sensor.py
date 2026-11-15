# SPDX-License-Identifier: GPL-3.0-or-later
"""Binary sensors for AI Coach: analysis in progress, last analysis failed."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
    BinarySensorEntityDescription,
)
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import AiCoachConfigEntry
from .coach import Coach
from .entity import CoachEntity


@dataclass(frozen=True, kw_only=True)
class CoachBinaryDescription(BinarySensorEntityDescription):
    """Describes an AI Coach binary sensor."""

    is_on_fn: Callable[[Coach], bool]


BINARY_SENSORS: tuple[CoachBinaryDescription, ...] = (
    CoachBinaryDescription(
        key="analysing",
        device_class=BinarySensorDeviceClass.RUNNING,
        entity_category=EntityCategory.DIAGNOSTIC,
        is_on_fn=lambda c: c.running,
    ),
    CoachBinaryDescription(
        key="problem",
        device_class=BinarySensorDeviceClass.PROBLEM,
        entity_category=EntityCategory.DIAGNOSTIC,
        is_on_fn=lambda c: c.last_error is not None,
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: AiCoachConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the binary sensors."""
    async_add_entities(CoachBinarySensor(entry.runtime_data, d, "binary_sensor") for d in BINARY_SENSORS)


class CoachBinarySensor(CoachEntity, BinarySensorEntity):
    """An AI Coach binary sensor."""

    entity_description: CoachBinaryDescription

    @property
    def is_on(self) -> bool:
        """Current value."""
        return self.entity_description.is_on_fn(self.coach)
