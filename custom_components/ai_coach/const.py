# SPDX-License-Identifier: GPL-3.0-or-later
"""Constants for the AI Coach integration."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "ai_coach"
DEFAULT_NAME: Final = "AI Coach"
# Every entity ID starts with this prefix, followed by the slug of the coach name.
ENTITY_PREFIX: Final = "ai_coach"

# Bundled dashboard card
CARD_FILENAME: Final = "ai-coach-card.js"
CARD_URL: Final = f"/{DOMAIN}/{CARD_FILENAME}"

# Config entry keys
CONF_TOPIC: Final = "topic"
CONF_ENTITIES: Final = "entities"
CONF_LABEL: Final = "label"
CONF_AI_TASK_ENTITY: Final = "ai_task_entity"
CONF_INTERVAL: Final = "update_interval"
CONF_RUN_AT: Final = "run_at"
CONF_ACTIVE_FROM: Final = "active_from"
CONF_ACTIVE_UNTIL: Final = "active_until"
CONF_INSTRUCTIONS: Final = "instructions"
CONF_PROMPT_TEMPLATE: Final = "prompt_template"

DEFAULT_INTERVAL: Final = 6  # hours; 0 = no periodic analysis

# Analysis limits
MAX_SOURCES: Final = 60
MAX_TIPS: Final = 5
SUMMARY_MAX: Final = 500
STATE_MAX: Final = 255  # Home Assistant state length limit
SETUP_DELAY_S: Final = 30  # first analysis after start-up, when there is no stored result

# Actions and events
SERVICE_RUN_ANALYSIS: Final = "run_analysis"
SERVICE_SET_RESULT: Final = "set_result"
ATTR_CONFIG_ENTRY_ID: Final = "config_entry_id"
ATTR_SUMMARY: Final = "summary"
ATTR_SCORE: Final = "score"
ATTR_CONFIDENCE: Final = "confidence"
ATTR_TIPS: Final = "tips"
EVENT_ANALYSIS_COMPLETED: Final = f"{DOMAIN}_analysis_completed"

STORAGE_VERSION: Final = 1
