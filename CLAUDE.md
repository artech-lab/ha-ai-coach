# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project: AI Coach

Home Assistant custom integration (`ai_coach`, HACS category Integration) with a bundled dashboard card.
Each config entry is a "coach": on a schedule it sends the values of a group of entities (list and/or label)
to Home Assistant's AI Task integration and exposes the structured answer (score, summary, tips, confidence)
as entities. It replaces the standalone card `artech-lab/ai-coach-card` and the automations that fed it.

Answer the maintainer in the language they write in. Code, comments, commit messages, entity IDs and the
English README stay in English.

## Commands

```bash
python3.13 -m venv .venv && . .venv/bin/activate && pip install -r requirements_test.txt
scripts/check.sh                         # everything CI runs: ruff, card syntax, card tests (node), pytest
pytest tests/test_coach.py -k schedule   # one Python test
node --test tests/js/card.test.mjs       # card unit tests only
npm install && npx playwright install chromium && npm run screenshots   # README images (demo data)
```

`CHROME_PATH=/path/to/chrome` makes the screenshot script use an installed browser.

Slash commands: `/publish` (first publication, release, HACS default store) and `/release X.Y.Z`.

## Layout

| Path | Content |
| --- | --- |
| `custom_components/ai_coach/coach.py` | `Coach`: sources, data block, prompt, `ai_task.generate_data` call, schedule, `Store` |
| `.../prompt.py` | Pure functions (no HA imports): default prompt, structure, result validation, data lines |
| `.../sensor.py`, `binary_sensor.py`, `button.py`, `entity.py` | Entities; `entity.py` fixes English entity IDs |
| `.../config_flow.py` | Setup form and options form (with the prompt template) |
| `.../__init__.py` | Card serving (`/ai_coach/ai-coach-card.js?v=<version>`), actions, entry setup |
| `.../frontend/ai-coach-card.js` | The card: one dependency-free ES module, ASCII only |
| `tests/` | pytest on a real HA core with a fake `ai_task.generate_data`; `tests/js/` card unit tests |
| `scripts/demo.cjs`, `scripts/screenshots.cjs` | Demo data and README images |

## Architecture notes

- Entity IDs: `<platform>.ai_coach_<slug(title)>_<key>`, set explicitly in `CoachEntity`, never translated.
  `translation_key` = description key; the card finds the sibling entities on the device by
  `translation_key` (`ACC_SIBLINGS`). A unit test keeps the two lists in sync.
- The prompt is English and asks for the answer in `hass.config.language`. The user's prompt template, when
  set, replaces it entirely (`coach_data`, `topic`, `language`, `instructions`); the structure never changes.
- Data line format `- Name [Area]: value unit` must stay identical in `prompt.data_line` and the card's
  `accDataText` (the card keeps a browser-only analysis for setups without the integration).
- Scheduling: `async_track_time_change` every hour at :00, runs when `hour % interval == 0` inside the window;
  optional daily time; one run `SETUP_DELAY_S` after start-up when nothing is stored yet.
- Failures keep the previous result, set `last_error` (problem binary sensor, `error` attribute) and are
  raised to the button / action caller.
- `ai_task` is an after-dependency, not a dependency: tests register a fake service.

## Rules

1. The card file is ASCII only: write non-ASCII as `\uXXXX`. Every user string goes in `ACC_I18N` (`en`, `it`).
2. Integration strings go in `translations/en.json` and `it.json` with the same keys (tested).
3. Version only in `manifest.json` (tested). Releasing = bump it on `main` with a `CHANGELOG.md` section; the
   Validate workflow tags and releases when every check is green.
4. No personal data in the repository: no names, places, real entity IDs or measurements. Examples and
   images use demo data only. Copyright holder: "The ha-ai-coach contributors".
5. Diagnostics must never include entity lists, instructions or prompt templates.
6. Keep every option of the former standalone card working (`entities`/`label` built-in mode, helper mode,
   `custom:ai-coach-lite-card`).
