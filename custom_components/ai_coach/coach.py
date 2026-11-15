# SPDX-License-Identifier: GPL-3.0-or-later
"""Analysis engine for AI Coach.

One ``Coach`` per config entry:

    entities (and label) -> data block -> prompt (default or user template)
    -> ai_task.generate_data (structured output) -> result -> entities + event

It runs on a schedule (every N hours inside an optional window, and/or at a
fixed time), on demand (button or action), and once after setup when nothing
was stored yet. The last result survives restarts thanks to ``Store``.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, time
import logging
from time import monotonic
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import EVENT_HOMEASSISTANT_STARTED
from homeassistant.core import CALLBACK_TYPE, CoreState, Event, HomeAssistant, callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import area_registry as ar, device_registry as dr, entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_call_later, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.helpers.template import Template
from homeassistant.util import dt as dt_util

from .const import (
    CONF_ACTIVE_FROM,
    CONF_ACTIVE_UNTIL,
    CONF_AI_TASK_ENTITY,
    CONF_ENTITIES,
    CONF_INSTRUCTIONS,
    CONF_INTERVAL,
    CONF_LABEL,
    CONF_PROMPT_TEMPLATE,
    CONF_RUN_AT,
    CONF_TOPIC,
    DEFAULT_INTERVAL,
    DOMAIN,
    EVENT_ANALYSIS_COMPLETED,
    MAX_SOURCES,
    SETUP_DELAY_S,
    STORAGE_VERSION,
)
from .prompt import (
    STRUCTURE,
    THEME_EXAMPLE,
    CoachResult,
    data_line,
    data_text,
    default_prompt,
    language_name,
    normalize_result,
)

_LOGGER = logging.getLogger(__name__)


def parse_time(value: Any) -> time | None:
    """'08:00' / '08:00:00' -> time; anything else -> None."""
    if isinstance(value, time):
        return value
    if isinstance(value, str) and value:
        return dt_util.parse_time(value)
    return None


def in_window(now: time, start: time | None, end: time | None) -> bool:
    """True when ``now`` is inside [start, end], also across midnight; no window = always."""
    if start is None or end is None or start == end:
        return True
    if start < end:
        return start <= now <= end
    return now >= start or now <= end


class Coach:
    """Runs the analysis of one config entry and keeps its last result."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry, version: str) -> None:
        """Initialise from the config entry."""
        self.hass = hass
        self.entry = entry
        self.version = version
        self.signal = f"{DOMAIN}_{entry.entry_id}_update"
        config = {**entry.data, **entry.options}
        self.topic: str = (config.get(CONF_TOPIC) or entry.title).strip()
        self.entities: list[str] = list(config.get(CONF_ENTITIES) or [])
        self.label: str | None = config.get(CONF_LABEL) or None
        self.ai_task_entity: str | None = config.get(CONF_AI_TASK_ENTITY) or None
        self.interval = int(config.get(CONF_INTERVAL, DEFAULT_INTERVAL) or 0)
        self.run_at = parse_time(config.get(CONF_RUN_AT))
        self.active_from = parse_time(config.get(CONF_ACTIVE_FROM))
        self.active_until = parse_time(config.get(CONF_ACTIVE_UNTIL))
        self.instructions: str = config.get(CONF_INSTRUCTIONS) or ""
        self.prompt_template: str = config.get(CONF_PROMPT_TEMPLATE) or ""

        self.result: CoachResult | None = None
        self.running = False
        self.last_error: str | None = None
        self.last_duration: float | None = None
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, f"{DOMAIN}.{entry.entry_id}")
        self._unsubs: list[CALLBACK_TYPE] = []

    # ------------------------------------------------------------ lifecycle
    async def async_load(self) -> None:
        """Restore the last result."""
        stored = await self._store.async_load() or {}
        self.result = CoachResult.from_dict(stored.get("result") or {})
        self.last_error = stored.get("last_error")

    @callback
    def async_start(self) -> None:
        """Schedule the analyses."""
        if self.interval > 0:
            self._unsubs.append(async_track_time_change(self.hass, self._on_hour, minute=0, second=0))
        if self.run_at is not None:
            self._unsubs.append(
                async_track_time_change(
                    self.hass, self._on_time, hour=self.run_at.hour, minute=self.run_at.minute, second=0
                )
            )
        if self.result is None and (self.interval > 0 or self.run_at is not None):
            # First analysis without user action, once Home Assistant is up.
            if self.hass.state is CoreState.running:
                self._unsubs.append(async_call_later(self.hass, SETUP_DELAY_S, self._on_time))
            else:
                self._unsubs.append(self.hass.bus.async_listen_once(EVENT_HOMEASSISTANT_STARTED, self._on_started))

    async def async_stop(self) -> None:
        """Cancel the schedules."""
        while self._unsubs:
            self._unsubs.pop()()

    @callback
    def _on_started(self, _event: Event) -> None:
        self._unsubs.append(async_call_later(self.hass, SETUP_DELAY_S, self._on_time))

    @callback
    def _on_hour(self, now: datetime) -> None:
        """Every hour: run when the hour is a multiple of the interval, inside the window."""
        local = dt_util.as_local(now)
        if local.hour % self.interval == 0 and in_window(local.time(), self.active_from, self.active_until):
            self._spawn()

    @callback
    def _on_time(self, _now: Any = None) -> None:
        self._spawn()

    @callback
    def _spawn(self) -> None:
        if not self.running:
            self.entry.async_create_background_task(self.hass, self.async_run(), f"{DOMAIN} analysis {self.topic}")

    # ------------------------------------------------------------ data
    def source_ids(self) -> list[str]:
        """Entities to analyse: the list, then every entity and device sensor with the label."""
        ids: list[str] = []

        def add(entity_id: str) -> None:
            if entity_id not in ids and len(ids) < MAX_SOURCES:
                ids.append(entity_id)

        for entity_id in self.entities:
            add(entity_id)
        if self.label:
            ent_reg = er.async_get(self.hass)
            for entry in sorted(er.async_entries_for_label(ent_reg, self.label), key=lambda e: e.entity_id):
                add(entry.entity_id)
            for device in dr.async_entries_for_label(dr.async_get(self.hass), self.label):
                for entry in sorted(er.async_entries_for_device(ent_reg, device.id), key=lambda e: e.entity_id):
                    if entry.domain in ("sensor", "binary_sensor") and entry.entity_category is None:
                        add(entry.entity_id)
        return ids

    def _area_name(self, entity_id: str) -> str | None:
        ent = er.async_get(self.hass).async_get(entity_id)
        area_id = ent.area_id if ent else None
        if area_id is None and ent and ent.device_id:
            device = dr.async_get(self.hass).async_get(ent.device_id)
            area_id = device.area_id if device else None
        area = ar.async_get(self.hass).async_get_area(area_id) if area_id else None
        return area.name if area else None

    def data_block(self) -> str:
        """Current values of the source entities, one per line."""
        lines = []
        for entity_id in self.source_ids():
            state = self.hass.states.get(entity_id)
            if state is None:
                lines.append(data_line(entity_id, None, None, None))
                continue
            lines.append(
                data_line(
                    state.name,
                    self._area_name(entity_id),
                    state.state,
                    state.attributes.get("unit_of_measurement"),
                )
            )
        return data_text(lines)

    def resolve_ai_entity(self) -> str | None:
        """The configured AI Task entity, else the first available one."""
        if self.ai_task_entity and self.hass.states.get(self.ai_task_entity):
            return self.ai_task_entity
        ids = sorted(s.entity_id for s in self.hass.states.async_all("ai_task") if s.state != "unavailable")
        return ids[0] if ids else None

    def build_prompt(self) -> str:
        """Instructions for the AI task: the user's template, or the default prompt."""
        language = language_name(self.hass.config.language)
        data = self.data_block()
        when = dt_util.now().strftime("%A %d/%m/%Y %H:%M")
        if self.prompt_template.strip():
            template = Template(self.prompt_template, self.hass)
            return str(
                template.async_render(
                    {
                        "coach_data": data,
                        "topic": self.topic,
                        "language": language,
                        "instructions": self.instructions,
                    },
                    parse_result=False,
                )
            )
        base = (self.hass.config.language or "en").split("-")[0]
        return default_prompt(self.topic, data, when, language, THEME_EXAMPLE.get(base, "Energy"), self.instructions)

    # ------------------------------------------------------------ analysis
    async def async_run(self) -> CoachResult | None:
        """Run one analysis now. Errors are kept in ``last_error`` and raised to the caller."""
        if self.running:
            return self.result
        self.running = True
        self._notify()
        started = monotonic()
        try:
            prompt = self.build_prompt()
            data: dict[str, Any] = {
                "task_name": f"{DOMAIN}_{self.entry.title}",
                "instructions": prompt,
                "structure": STRUCTURE,
            }
            if ai_entity := self.resolve_ai_entity():
                data["entity_id"] = ai_entity
            response = await self.hass.services.async_call(
                "ai_task", "generate_data", data, blocking=True, return_response=True
            )
            payload = (response or {}).get("data")
            if not isinstance(payload, dict):
                raise HomeAssistantError("The AI task returned no structured data")
            result = normalize_result(payload, dt_util.utcnow().isoformat())
        except Exception as err:
            self.last_error = str(err) or type(err).__name__
            _LOGGER.warning("Analysis of %s failed: %s", self.entry.title, self.last_error)
            raise
        else:
            self.result = result
            self.last_error = None
            self.hass.bus.async_fire(
                EVENT_ANALYSIS_COMPLETED,
                {"config_entry_id": self.entry.entry_id, "name": self.entry.title, **result.as_dict()},
            )
            return result
        finally:
            self.running = False
            self.last_duration = round(monotonic() - started, 1)
            await self._async_save()
            self._notify()

    async def async_set_result(self, values: dict[str, Any]) -> CoachResult:
        """Write a result by hand (migration from helpers, or results produced elsewhere)."""
        self.result = normalize_result(values, dt_util.utcnow().isoformat())
        self.last_error = None
        await self._async_save()
        self._notify()
        return self.result

    async def _async_save(self) -> None:
        await self._store.async_save(
            {"result": self.result.as_dict() if self.result else None, "last_error": self.last_error}
        )

    @callback
    def _notify(self) -> None:
        async_dispatcher_send(self.hass, self.signal)

    @callback
    def add_listener(self, update: Callable[[], None]) -> CALLBACK_TYPE:
        """Used by the entities."""
        return async_dispatcher_connect(self.hass, self.signal, update)

    def diagnostics(self) -> dict[str, Any]:
        """State for the diagnostics download (no prompt contents)."""
        return {
            "sources": len(self.source_ids()),
            "ai_task_entity": self.resolve_ai_entity(),
            "interval": self.interval,
            "run_at": self.run_at.isoformat() if self.run_at else None,
            "window": [t.isoformat() if t else None for t in (self.active_from, self.active_until)],
            "custom_prompt": bool(self.prompt_template.strip()),
            "running": self.running,
            "last_error": self.last_error,
            "last_duration_s": self.last_duration,
            "result_time": self.result.time if self.result else None,
            "tips": len(self.result.tips) if self.result else 0,
        }
