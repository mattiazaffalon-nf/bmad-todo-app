# Story Dependency Graph

**Source:** `_bmad-output/planning-artifacts/epics.md`
**Generated:** 2026-04-28
**Purpose:** Identify which stories can be implemented in parallel by independent agents.

## Methodology

Two kinds of edges are tracked separately:

- **Logical dependency** (`requires`): story B cannot start until story A's behavior, schema, or module is present. Hard blocker.
- **File-edit overlap** (`touches`): story B edits the same file(s) story A creates/edits. Not a hard blocker, but a merge hazard if run truly concurrently. Two agents writing to the same file in parallel will conflict on commit.

A wave can run in parallel only when stories within it share no logical edge **and** no file-edit overlap (or the overlap is benign — e.g., only adding a new export that does not collide with another story's new export).

## Per-story dependencies

| ID  | Title (short)                                         | Requires (logical)              | Touches (file overlap warnings)                                  |
| --- | ----------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------- |
| 1.1 | Scaffold Next.js + tokens + Vercel                    | —                               | (creates everything)                                             |
| 1.2 | Postgres schema + migrations + queries                | 1.1                             | —                                                                |
| 1.3 | `GET` + `POST /api/todos` + Zod validation            | 1.2                             | —                                                                |
| 1.4 | TaskList/TaskItem (read-only) + EmptyState + hydration | 1.3                            | creates `components/TaskItem.tsx`, `lib/api-client.ts`           |
| 1.5 | TaskInput + optimistic create                          | 1.3, 1.4                       | extends `lib/api-client.ts`, creates `hooks/use-create-todo.ts`  |
| 2.1 | `PATCH /api/todos/[id]`                                | 1.2, 1.3                       | creates `app/api/todos/[id]/route.ts`                            |
| 2.2 | Tap-to-toggle + optimistic update                      | 1.4, 2.1                       | extends `components/TaskItem.tsx`, `lib/api-client.ts`           |
| 2.3 | Swipe-right gesture (mobile)                           | 2.2                            | extends `components/TaskItem.tsx`                                |
| 3.1 | `DELETE /api/todos/[id]` (idempotent)                  | 1.2, 2.1                       | extends `app/api/todos/[id]/route.ts`                            |
| 3.2 | Deferred-delete + UndoToast                            | 1.4, 3.1                       | extends `lib/api-client.ts`, page-level reducer                  |
| 3.3 | Hover-reveal trash + swipe-left                        | 2.3, 3.2                       | extends `components/TaskItem.tsx`                                |
| 4.1 | ErrorIndicator + per-task syncStatus surface           | 1.4                            | extends `components/TaskItem.tsx`                                |
| 4.2 | Wire user-initiated retry across all 3 mutations       | 4.1, 1.5, 2.2, 3.2             | extends all three `hooks/use-*-todo.ts`                          |
| 4.3 | Sentry + security headers + CI a11y pipeline           | 1.1, 3.1, 4.1, 4.2             | `next.config.ts`, eslint, `.github/workflows/ci.yml`             |
| 4.4 | Pre-launch QA pass (real device, cross-browser)        | all of the above               | new `docs/launch-checklist.md`                                   |

### Notes on edges

- `1.4 → 1.5`: Story 1.5 wires the optimistic prepend into `useTodos()` cache, so TaskList must already be reading from it.
- `2.1 → 3.1`: Both edit `app/api/todos/[id]/route.ts`. 3.1 is described as "extending" 2.1's file. Sequential.
- `2.3 → 3.3`: Story 3.3 explicitly says "extend the `react-swipeable` wrapper from Story 2.3."
- `4.3 → 1.1` is a soft dep (the scaffold + ESLint config exists) but the canonical-error-contract pass needs all routes (`3.1`) and the a11y CI scan needs the failure state (`4.1`) and the retry path (`4.2`).
- `4.4` is intentionally last — it's the manual QA pass over everything.

## Parallelism waves

Each wave can be executed with one agent per story, fanned out concurrently. Move to the next wave only when the prior wave is fully merged.

```
Wave A (sequential, foundation):
  └─ 1.1   Scaffold

Wave B (sequential):
  └─ 1.2   DB schema + queries

Wave C (sequential):
  └─ 1.3   GET/POST + validation schemas

Wave D (parallel × 2):
  ├─ 1.4   Read-only TaskList/TaskItem/EmptyState
  └─ 2.1   PATCH endpoint

Wave E (parallel × 4 — all touch api-client.ts; coordinate merges):
  ├─ 1.5   TaskInput + optimistic create
  ├─ 2.2   Tap-to-toggle UI + use-toggle-todo
  ├─ 3.1   DELETE endpoint (idempotent)
  └─ 4.1   ErrorIndicator component (still needs 1.4 only)

Wave F (parallel × 2):
  ├─ 2.3   Swipe-right gesture
  └─ 3.2   Deferred-delete + UndoToast

Wave G (sequential):
  └─ 3.3   Hover-reveal trash + swipe-left

Wave H (sequential):
  └─ 4.2   Wire retry across all 3 mutations

Wave I (sequential):
  └─ 4.3   Sentry + security headers + CI a11y

Wave J (sequential, manual):
  └─ 4.4   Pre-launch QA pass
```

## Merge-hazard map

When running stories in parallel, watch for these shared files:

- **`components/TaskItem.tsx`** — created in 1.4, extended in 2.2, 2.3, 3.3, 4.1. **Never run two TaskItem stories in the same wave.** (The plan above respects this.)
- **`lib/api-client.ts`** — created in 1.4, extended in 1.5, 2.2, 3.2. In Wave E, three stories add new exports to this file (`createTodo`, `toggleTodo`, neither yet `deleteTodo` until 3.2). Each adds a distinct named export, so merges are usually trivial but require coordination.
- **`hooks/use-*-todo.ts`** — 1.5, 2.2, 3.2 each create a different file (`use-create-todo`, `use-toggle-todo`, `use-delete-todo`). No conflict. 4.2 extends all three — must run after they exist.
- **`app/api/todos/[id]/route.ts`** — created in 2.1, extended in 3.1. Sequential by design.
- **`db/queries.ts`** — created in 1.2, extended in 2.1 (updateTodo) and 3.1 (deleteTodo). Each adds a distinct function — mergeable but coordinate.
- **`lib/validation.ts`** — created in 1.3 with both `TodoCreateSchema` and `TodoUpdateSchema` already exported, so 2.1 does not edit it.
- **`app/api/todos/route.ts`** — created in 1.3 only.

## Critical path

The longest chain governs total wall-clock:

```
1.1 → 1.2 → 1.3 → 1.4 → 2.2 → 2.3 → 3.3 → 4.2 → 4.3 → 4.4
```

10 stories deep. Stories outside this chain (1.5, 2.1, 3.1, 3.2, 4.1) can be folded into parallel waves and do not extend the critical path if executed within their wave.

## Recommended execution shape

- Waves A–C: single agent (foundation, no parallelism available).
- Waves D–F: 2–4 agents fanned out per wave, each on its own branch off `main`. Re-merge to `main` between waves to keep conflict surface bounded.
- Waves G–J: single agent each (sequential by structure).

This planning artifact is the input the next session uses to dispatch parallel sub-agents per wave.
