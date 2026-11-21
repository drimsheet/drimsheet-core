# Agent Guide

Read this before changing the repository.

## Project Folder Boundary

Keep project file listings, searches, and reads within the folders explicitly
added to the current project, including the active worktree. If no project
folders are configured, use the current repository root. Resolve symlink
targets against the same boundary. If the task requires another folder, ask
the user to add it to the project before inspecting it.

## Start Here

1. Read `.agents/README.md`.
2. Load the skill for the task from `.agents/skills/<skill>/SKILL.md`.
3. For code changes, follow `.agents/workflow/implementation.md`.
4. Always follow `.agents/rules/folder-responsibility.md`.
5. Always follow `.agents/rules/import-paths.md`.
6. Always follow `.agents/rules/scope-and-simplicity.md`.
7. Follow `.agents/rules/service-ownership.md` and
   `.agents/rules/readability.md` for implementation changes.
8. Follow `.agents/rules/ioc.md` when changing dependency wiring.
9. Follow `.agents/rules/testing/general.md` when adding or renaming tests.
10. Follow `.agents/rules/observability.md` when creating or changing logger or
    reporter events.
11. Follow `.agents/rules/controller-ordering.md` when adding, changing, or
    reviewing controller endpoints.
12. Follow `.agents/rules/helpers.md` for helpers in every layer.

For reporting use-case work, load
`.agents/skills/reporting-usecase-creation/SKILL.md`.

## Pre-1.0 Changes

Use the `version` in `package.json` to determine release status. For versions
below `1.0.0`:

- Assume there are no existing records to preserve.
- Target the current API and data model. Skip backward-compatibility code and
  legacy data handling.
- Existing database migration files may be edited directly when changing the
  schema. Follow the [migration skill](.agents/skills/migration/SKILL.md) for
  generated Drizzle schemas.

## Planning

- Whenever the user asks for a plan or the agent decides to create or present
  one, load `.agents/skills/planner/SKILL.md`.
- Create every plan from `.agents/templates/implementation-plan.md` and save it
  under `.agents/plans`.

## Core Rules

- Follow [unchanged mutation rules](.agents/rules/domain-modeling.md#unchanged-mutations):
  valid no-op updates return the original state without errors, events, or audit.
- Put behavior in the folder that owns it.
- Keep repositories limited to data storage and retrieval.
- Only use cases initiate persistence. Dedicated persistence services may
  compose atomic repository-write bundles, but must be invoked directly by a
  use case; domain and other application services return prepared results.
- Keep controllers and middlewares delivery-only. Keep business decisions out
  of use cases; workflow transactions remain application orchestration.
- Use domain entities/values/services or app policies for decisions.
- Keep rules concise. Link to existing rules instead of duplicating them.
- Do not invent architecture when local rules or patterns already exist. Before
  introducing a pattern without precedent, follow
  `.agents/rules/precedent-and-deviation.md`.
- Treat saved plans as implementation artifacts, not architectural authority.
  Revalidate them against durable rules and current code before editing.

## AI Execution

- Use cases in `src/app/ai` may call structured LLMs directly. Use cases
  in other application modules must delegate AI work through background
  queue contracts. Keep tools, agents, and workflows out of use-case
  dependencies.
- Each tool wraps one use case or one structured LLM call.
- Background workers start or resume agents and workflows and can run standalone
  structured LLM calls. Agents select tools. Workflows follow predefined steps
  and can invoke an agent within the same worker.
- Save run progress through a use case before publishing a Redis Pub/Sub signal.
  The API reads saved state and sends SSE updates. When a run needs user input,
  save the pending request and resume state, then end the job. A use case
  records the validated reply or approval and queues the same run to resume.

See [ADR 0022](docs/adrs/0022-background-execution-for-agents-and-workflows.md)
for the decision and rationale.

## Skills

Skills are directories with a `SKILL.md` file. Use YAML frontmatter with `name`
and `description`. Keep skill bodies short and link to centralized rules and
workflows.
