# SPDX-License-Identifier: GPL-3.0-or-later
"""Config and options flow for AI Coach."""

from __future__ import annotations

from typing import Any

from homeassistant.config_entries import ConfigEntry, ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers import selector
import voluptuous as vol

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
    DEFAULT_NAME,
    DOMAIN,
)

OPTIONAL_KEYS = (
    CONF_LABEL,
    CONF_AI_TASK_ENTITY,
    CONF_RUN_AT,
    CONF_ACTIVE_FROM,
    CONF_ACTIVE_UNTIL,
    CONF_INSTRUCTIONS,
    CONF_PROMPT_TEMPLATE,
)


def _suggested(current: dict[str, Any], key: str) -> dict[str, Any]:
    return {"suggested_value": current.get(key)}


def _what(current: dict[str, Any]) -> dict[Any, Any]:
    """What to analyse: shared by the setup and the options form."""
    return {
        vol.Required(CONF_TOPIC, default=current.get(CONF_TOPIC, "")): selector.TextSelector(),
        vol.Optional(CONF_ENTITIES, default=current.get(CONF_ENTITIES, [])): selector.EntitySelector(
            selector.EntitySelectorConfig(multiple=True)
        ),
        vol.Optional(CONF_LABEL, description=_suggested(current, CONF_LABEL)): selector.LabelSelector(),
        vol.Optional(CONF_INSTRUCTIONS, description=_suggested(current, CONF_INSTRUCTIONS)): selector.TextSelector(
            selector.TextSelectorConfig(multiline=True)
        ),
        vol.Optional(
            CONF_AI_TASK_ENTITY, description=_suggested(current, CONF_AI_TASK_ENTITY)
        ): selector.EntitySelector(selector.EntitySelectorConfig(domain="ai_task")),
    }


def _when(current: dict[str, Any]) -> dict[Any, Any]:
    """When to analyse."""
    return {
        vol.Required(CONF_INTERVAL, default=current.get(CONF_INTERVAL, DEFAULT_INTERVAL)): selector.NumberSelector(
            selector.NumberSelectorConfig(
                min=0, max=24, step=1, mode=selector.NumberSelectorMode.BOX, unit_of_measurement="h"
            )
        ),
        vol.Optional(CONF_ACTIVE_FROM, description=_suggested(current, CONF_ACTIVE_FROM)): selector.TimeSelector(),
        vol.Optional(CONF_ACTIVE_UNTIL, description=_suggested(current, CONF_ACTIVE_UNTIL)): selector.TimeSelector(),
        vol.Optional(CONF_RUN_AT, description=_suggested(current, CONF_RUN_AT)): selector.TimeSelector(),
    }


def _validate(user_input: dict[str, Any]) -> dict[str, str]:
    errors: dict[str, str] = {}
    if (
        not user_input.get(CONF_ENTITIES)
        and not user_input.get(CONF_LABEL)
        and not (user_input.get(CONF_PROMPT_TEMPLATE) or "").strip()
    ):
        errors["base"] = "no_data"
    if bool(user_input.get(CONF_ACTIVE_FROM)) != bool(user_input.get(CONF_ACTIVE_UNTIL)):
        errors[CONF_ACTIVE_UNTIL] = "window_incomplete"
    if CONF_INTERVAL in user_input:
        user_input[CONF_INTERVAL] = int(user_input[CONF_INTERVAL])
    return errors


class AiCoachConfigFlow(ConfigFlow, domain=DOMAIN):
    """Initial setup: name, data, AI model and schedule."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Single setup form."""
        errors: dict[str, str] = {}
        if user_input is not None and not (errors := _validate(user_input)):
            return self.async_create_entry(title=user_input.pop(CONF_NAME), data=user_input)

        current = user_input or {}
        schema = vol.Schema(
            {
                vol.Required(CONF_NAME, default=current.get(CONF_NAME, DEFAULT_NAME)): selector.TextSelector(),
                **_what(current),
                **_when(current),
            }
        )
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> AiCoachOptionsFlow:
        """Return the options flow."""
        return AiCoachOptionsFlow()


class AiCoachOptionsFlow(OptionsFlow):
    """Change data, schedule and prompt."""

    async def async_step_init(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        """Single options form, with the advanced prompt template."""
        errors: dict[str, str] = {}
        if user_input is not None and not (errors := _validate(user_input)):
            # Optional fields cleared in the form must be removed explicitly.
            for key in OPTIONAL_KEYS:
                user_input.setdefault(key, None)
            return self.async_create_entry(data=user_input)

        current = {**self.config_entry.data, **self.config_entry.options, **(user_input or {})}
        schema = vol.Schema(
            {
                **_what(current),
                **_when(current),
                vol.Optional(
                    CONF_PROMPT_TEMPLATE, description=_suggested(current, CONF_PROMPT_TEMPLATE)
                ): selector.TemplateSelector(),
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema, errors=errors)
