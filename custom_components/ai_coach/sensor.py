# SPDX-License-Identifier: GPL-3.0-or-later
"""Sensors for AI Coach: score, confidence, summary, tips and time of the last analysis."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.const import EntityCategory
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.util import dt as dt_util

from . import AiCoachConfigEntry
from .coach import Coach
from .const import STATE_MAX
from .entity import CoachEntity


def _summary(coach: Coach) -> str | None:
    if coach.result is None or not coach.result.summary:
        return None
    text = coach.result.summary
    return text if len(text) <= STATE_MAX else text[: STATE_MAX - 1] + "…"


def _time(coach: Coach) -> Any:
    return dt_util.parse_datetime(coach.result.time) if coach.result else None


@dataclass(frozen=True, kw_only=True)
class CoachSensorDescription(SensorEntityDescription):
    """Describes an AI Coach sensor."""

    value_fn: Callable[[Coach], Any]
    attrs_fn: Callable[[Coach], dict[str, Any] | None] = lambda _c: None


SENSORS: tuple[CoachSensorDescription, ...] = (
    CoachSensorDescription(
        key="score",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        value_fn=lambda c: c.result.score if c.result else None,
    ),
    CoachSensorDescription(
        key="confidence",
        state_class=SensorStateClass.MEASUREMENT,
        suggested_display_precision=0,
        value_fn=lambda c: c.result.confidence if c.result else None,
    ),
    CoachSensorDescription(
        key="summary",
        value_fn=_summary,
        attrs_fn=lambda c: {"text": c.result.summary} if c.result else None,
    ),
    CoachSensorDescription(
        key="tips",
        value_fn=lambda c: len(c.result.tips) if c.result else None,
        attrs_fn=lambda c: {"tips": list(c.result.tips)} if c.result else None,
    ),
    CoachSensorDescription(
        key="last_analysis",
        device_class=SensorDeviceClass.TIMESTAMP,
        entity_category=EntityCategory.DIAGNOSTIC,
        value_fn=_time,
        attrs_fn=lambda c: {"error": c.last_error, "duration": c.last_duration, "topic": c.topic},
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: AiCoachConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the sensors."""
    async_add_entities(CoachSensor(entry.runtime_data, description, "sensor") for description in SENSORS)


class CoachSensor(CoachEntity, SensorEntity):
    """An AI Coach sensor."""

    entity_description: CoachSensorDescription

    @property
    def native_value(self) -> Any:
        """Current value."""
        return self.entity_description.value_fn(self.coach)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Full summary text, list of tips, last error."""
        return self.entity_description.attrs_fn(self.coach)
