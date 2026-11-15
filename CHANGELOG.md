# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-11-15

First release. It replaces the standalone dashboard card `artech-lab/ai-coach-card` and the automations
that used to feed it.

### Added

- Config flow: one entry per coach with name, topic, entities and/or label, extra instructions, AI Task
  entity and schedule (every N hours with an optional time window, and/or a fixed daily time).
- Options flow with an advanced Jinja prompt template (`coach_data`, `topic`, `language`, `instructions`).
- Analysis through `ai_task.generate_data` with a structured output (summary, score, tips, confidence); first
  analysis right after setup; the last result is stored and restored after a restart.
- Entities: score and confidence (long-term statistics), summary, tips, last analysis, analysing, problem,
  *Run analysis* button; English entity IDs `<platform>.ai_coach_<name>_<key>`.
- Actions `ai_coach.run_analysis` (returns the result) and `ai_coach.set_result`; event
  `ai_coach_analysis_completed`.
- Diagnostics without entity lists and prompts.
- Bundled card loaded automatically, with the new `entity` option (any sensor of a coach); the former
  helper and built-in sources and `custom:ai-coach-lite-card` keep working.
- English and Italian translations.

[Unreleased]: https://github.com/artech-lab/ha-ai-coach/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/artech-lab/ha-ai-coach/releases/tag/v1.0.0
