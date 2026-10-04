# Agent Guide

Read this before changing the repository.

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

## Planning

- Whenever the user asks for a plan or the agent decides to create or present
  one, load `.agents/skills/planner/SKILL.md`.
- Create every plan from `.agents/templates/implementation-plan.md` and save it
  under `.agents/plans`.

## Core Rules

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

## Skills

Skills are directories with a `SKILL.md` file. Use YAML frontmatter with `name`
and `description`. Keep skill bodies short and link to centralized rules and
workflows.
