# Agent Learnings

Patterns and gotchas discovered during task processing. Update this file whenever you encounter something reusable.

## tasks.json

- Tasks are objects with `id`, `createdAt`, and `prompts[]`.
- Priority is determined per-prompt (`priority: true`), not per-task. A task is high-priority if any of its prompts has `priority: true`.
- After completing a task, remove it from the array entirely — do not add a status field.
- Write `[]` to `tasks.json` if the last task is completed.

## Skill Usage

- Always run `/connect` first to load credentials from `.eventmodelers/config.json` before calling any other skill.
- `/place-element` requires an existing column — create one via the timeline API if the target column does not exist yet.
- `/timeline` is the right skill for any prompt that describes adding, renaming, or reordering events on a swimlane.
- `/wdyt` posts QUESTION comments directly onto nodes — use it for review/analysis prompts, not for modifications.

## Board API

- The `board_id`, `timeline_id`, and `organization_id` from each prompt provide full context — pass them to skills that need them.
- Node events use `node:created`, `node:changed`, `node:deleted` — always POST to `/api/boards/:boardId/nodes/events`.