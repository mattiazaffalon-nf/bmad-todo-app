# Story 1.3: Build `GET /api/todos` and idempotent `POST /api/todos` Route Handlers

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a client (web app or future mobile),
I want REST endpoints to list and create todos with strict validation and a stable error contract,
so that I can integrate with the backend reliably and recover from network retries safely.

## Acceptance Criteria

1. **`lib/validation.ts` is the single source of truth for input shape (AC source: epic).**
   - Exports `TodoCreateSchema = z.object({ id: z.string().uuid(), description: z.string().trim().min(1).max(280) })`.
   - Exports `TodoUpdateSchema = z.object({ completed: z.boolean() })` — used in Epic 2; included now so 2.1 does not edit this file.
   - Exports inferred types: `type TodoCreateInput = z.infer<typeof TodoCreateSchema>` and `type TodoUpdateInput = z.infer<typeof TodoUpdateSchema>`.
   - Exports a `Todo` shape used by the API client/hooks — derived from the Drizzle schema via `drizzle-zod`'s `createSelectSchema(todos)` so it stays in lockstep with `db/schema.ts`. The exported type is `type Todo = z.infer<typeof TodoSchema>` (or the equivalent — see Dev Notes for the exact pattern).
   - `zod` is promoted from a transitive dependency to a direct dependency in `package.json` (currently arrives via `drizzle-zod` peer at `4.3.6` — pin to that exact minor in `dependencies`).

2. **`db/queries.ts` is updated to consume the validation schema and to support idempotent insert.**
   - The local `TodoCreateInput = Pick<TodoInsert, "id" | "description">` is replaced by `import type { TodoCreateInput } from "@/lib/validation"`. Story 1.2 explicitly flagged this as Story 1.3's responsibility ("temporary alias — Story 1.3 should replace it").
   - `createTodo` is made idempotent: a re-insert with the same `id` returns the existing row instead of throwing a Postgres unique-violation. Recommended implementation: `db.insert(todos).values({...}).onConflictDoNothing({ target: todos.id }).returning()` — if `returning` yields no row (conflict path), follow up with a parameterized `SELECT … WHERE id = ?` and return that. **No raw SQL, no try/catch on `pg` error codes — use Drizzle's expression API.**
   - Existing `getTodos` is unchanged.
   - `db/queries.test.ts` is extended (or a new `it` block added) to cover: re-creating with the same `id` returns the existing row and does not throw; subsequent `getTodos` returns exactly one row, not two.

3. **`app/api/todos/route.ts` exists with `GET` and `POST` exports.**
   - `GET`: calls `getTodos(null)` and returns `200 { todos: Todo[] }`. Rows are ordered `created_at DESC` (already enforced in the query). All date fields serialize as ISO 8601 strings with timezone (e.g., `"2026-04-28T12:34:56.000Z"`); JSON field names are camelCase (`createdAt`, `userId`, `completed`, `description`, `id`). `JSON.stringify` over a JS `Date` object produces the correct ISO 8601 string by default — no manual formatting needed.
   - `POST`: parses `await req.json()` with `TodoCreateSchema.safeParse`. On `success: false`, returns `400 { code: "validation_failed", message }` **without touching the DB**. On `success: true`, calls `createTodo({ id, description }, null)` and returns `201 { todo: Todo }`.
   - **Idempotency:** when the same `id` is POSTed twice, the second response is `200 { todo: Todo }` (the existing row), **not `201`, not `409`**. The architecture's endpoint table mentions `409` but the prose ("idempotent via client-supplied UUIDs … returns 200 with the existing todo, not a 409") and the epic AC both override that — there is no `409` path in this story.
   - **Error contract:** every handler is wrapped in a top-level `try/catch`. On any unexpected throw: `console.error(err)` and return `500 { code: "internal_error", message: "Something went wrong" }`. Raw error details (stack, PG codes, Drizzle internals) **never leak** to the client.

4. **`app/api/todos/route.test.ts` covers the contract end-to-end against a real test DB.**
   - `GET` returns todos newest-first.
   - `POST` with a valid body creates the row and returns `201 { todo }`.
   - **Idempotent POST:** the same `id` posted twice yields a second response of `200` (not `201`, not `409`) with the existing row.
   - `POST` with an invalid body (missing `id`, non-uuid `id`, empty `description`, `description` > 280 chars, wrong types) returns `400 { code: "validation_failed", message }`. At least one variant per failure mode is asserted.
   - `POST` with a body that crashes the DB layer (simulated via a deliberately closed pool, monkey-patched `db.insert`, or any clean technique consistent with the existing test setup) returns `500 { code: "internal_error", message: "Something went wrong" }`.
   - All tests pass against the same `DATABASE_URL` setup that `db/queries.test.ts` uses (Neon dev branch via `.env.local` — Story 1.2's documented Option A).

5. **Lint, typecheck, build, and test gates are green.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all succeed locally before this story is merged. The `db/**` import-graph rule (added in Story 1.2) and the `app/api/**` rule (added in Story 1.1) both still pass — `app/api/todos/route.ts` may import from `db/queries.ts` (allowed) but **must not** import from `components/**` or `hooks/**`.

## Tasks / Subtasks

- [x] **Task 1: Promote `zod` to a direct dependency (AC: #1)**
  - [x] `pnpm add zod@4.3.6` ran clean; matches the existing transitive resolution
  - [x] `package.json` `dependencies` now includes `"zod": "4.3.6"` (exact pin); not in `devDependencies`
  - [x] `pnpm-lock.yaml` updated; the unrelated `zod@3.25.76` (MCP-SDK transitive) untouched as expected

- [x] **Task 2: Write `lib/validation.ts` (AC: #1)**
  - [x] `lib/validation.ts` exports `TodoCreateSchema`, `TodoUpdateSchema`, inferred `TodoCreateInput`/`TodoUpdateInput`, and re-exports `Todo` from `db/schema`
  - [x] Took the "or the equivalent" path from AC #1 + Dev Notes' "do not over-engineer" guidance: re-exporting `type Todo` (a Drizzle `$inferSelect` type alias) is zero-runtime-cost and keeps `lib/validation.ts` free of `drizzle-zod` runtime baggage. `drizzle-zod` remains installed-but-unused; Story 1.4 owns the wire-shape Zod schema if it ends up needing one
  - [x] Names match Architecture §"Naming Patterns" — `PascalCase` schemas ending in `Schema`, types drop the suffix
  - [x] `lib/validation.test.ts` covers 14 cases: valid payload, trimming, empty/whitespace-only/oversize/exact-280 description, non-uuid id, missing fields, wrong types, `TodoUpdateSchema` accept/reject

- [x] **Task 3: Update `db/queries.ts` to use the shared `TodoCreateInput` and to be idempotent (AC: #2)**
  - [x] Removed the local `TodoCreateInput`; now `import type { TodoCreateInput } from "@/lib/validation"`
  - [x] `createTodo` uses `.onConflictDoNothing({ target: todos.id }).returning()`. Conflict-path falls through to `getTodoById(input.id, userId)`. Throws an explicit error only if both insert and select return nothing (a true programmer-error case)
  - [x] Added `getTodoById(id, userId)` helper as the public API for the route handler to decide `201` vs `200`. Uses `and(eq(todos.id, id), userIdFilter(userId))` — fully parameterized
  - [x] Extracted a shared `userIdFilter(userId)` helper internally so `getTodos` and `getTodoById` use one expression
  - [x] No raw SQL anywhere except the existing `TRUNCATE TABLE todos` in test setup
  - [x] Four new tests added to `db/queries.test.ts`: idempotent on duplicate id (same body) · idempotent returns original row even when retry body differs · `getTodoById` happy path · `getTodoById` not-found returns null. All 6 query tests pass

- [x] **Task 4: Write `app/api/todos/route.ts` (AC: #3)**
  - [x] `app/api/todos/route.ts` exports `GET()` and `POST(req: Request)` using Web `Request`/`Response` (no `NextRequest`/`NextResponse`)
  - [x] `GET`: try/catch; calls `getTodos(null)`; returns `200 { todos }`. On any throw: `console.error` + `500 { code: "internal_error", message }`
  - [x] `POST`: try/catch; inner try/catch for `req.json()` (malformed JSON → `400 { code: "validation_failed", message: "Request body is not valid JSON" }`); `TodoCreateSchema.safeParse`; on parse failure → `400` with the Zod error message. On valid body, `getTodoById` first → existing returns `200 { todo }`; else `createTodo` returns `201 { todo }`
  - [x] No `dynamic = "force-static"`. `next build` confirms `/api/todos` is correctly classified `ƒ` (Dynamic / server-rendered on demand)
  - [x] No imports from `components/**` or `hooks/**`; ESLint `app/api/**` scope clean

- [x] **Task 5: Write `app/api/todos/route.test.ts` (AC: #4)**
  - [x] Test setup mirrors `db/queries.test.ts` — `beforeEach` TRUNCATE, `afterAll` pool teardown, plus an `afterEach(vi.restoreAllMocks)` to keep spies clean across tests
  - [x] Calls handlers directly via `new Request(...)`; no Next.js server spin-up
  - [x] 14 tests cover GET happy/empty/error paths and POST happy / idempotent same-body / idempotent different-body / 6 validation variants (non-uuid, empty, whitespace, oversize, missing fields, malformed JSON) / "DB untouched on validation failure" / 500 internal_error
  - [x] ISO 8601 + camelCase assertion: `body.todos[0].createdAt` is a string, parseable by `Date.parse`, ends in `Z` or a `±HH:MM` offset; `userId` field present as `null`
  - [x] 500 path uses `vi.spyOn(queries, "createTodo").mockRejectedValueOnce(...)` per the spec recommendation; the GET 500 path uses the same pattern on `getTodos`. `console.error` is also spied to keep the test output quiet

- [x] **Task 6: Verify gates and update docs**
  - [x] `pnpm lint` clean
  - [x] `pnpm typecheck` clean
  - [x] `pnpm test` green — 34/34 tests across 3 files (`lib/validation.test.ts` 14, `db/queries.test.ts` 6, `app/api/todos/route.test.ts` 14)
  - [x] `pnpm test:tokens` clean (token smoke from Story 1.1 retained)
  - [x] `pnpm build` green — `drizzle-kit migrate` (no-op) → `next build` 2.3s, `/api/todos` dynamic, no warnings on the new files
  - [x] No documentation updates required — `AGENTS.md` already encodes the relevant rules; adding the chosen `getTodoById` / `onConflictDoNothing` combination there would duplicate what is already in this story file's Dev Notes

## Dev Notes

### Architectural anchors (do not deviate)

- **API style:** REST Route Handlers in `app/api/todos/route.ts` (this story), `app/api/todos/[id]/route.ts` (Stories 2.1, 3.1). Architecture §"API & Communication Patterns" is binding.
- **Endpoint contract** (this story's two endpoints only):

  | Method | Path | Body | Success | Errors |
  |---|---|---|---|---|
  | `GET`  | `/api/todos` | — | `200 { todos: Todo[] }` (newest-first, ISO 8601 dates, camelCase fields) | `500 { code, message }` |
  | `POST` | `/api/todos` | `{ id: uuid, description: string(1..280) }` | `201 { todo }` (new) / `200 { todo }` (idempotent re-create) | `400 { code: "validation_failed", message }` / `500 { code: "internal_error", message }` |

- **Idempotency contract.** A retry of `POST /api/todos` with the same client-supplied UUID **must** return `200` with the existing row. **Not** `201`, **not** `409`. The architecture's endpoint table mentions `409` but the surrounding prose explicitly overrides ("returns 200 with the existing todo, not a 409"); the epic AC ("returns 200 { todo: Todo } (not 409)") is the binding spec. TanStack Query's mutation retry layer (Epic 1.5) will replay the same payload on transient network failures — the server **must** be idempotent or the client will show duplicate rows on every retry.
- **Error contract.** Errors always have shape `{ code: string, message: string }`. `code` is stable and machine-readable (`validation_failed`, `internal_error`). `message` is for developer logs, not user UI. Never include `data: ...` envelopes; never return partial resources on error; never throw raw to the client. Architecture §"Format Patterns" + §"Process Patterns".
- **Validation timing.** Server validates *every* input even though clients also validate (Story 1.4+). The server is the security boundary; never trust pre-validation. Reject malformed payloads with `400` *before* any DB call.
- **DB layer purity.** `db/queries.ts` stays UI-agnostic. The route handler imports from `db/queries.ts`; the queries module never imports from `app/api/**`, `components/**`, or `hooks/**`. The `db/**` ESLint scope (added in Story 1.2) enforces this; the `app/api/**` scope (added in Story 1.1) enforces the symmetric direction.
- **`server-only` boundary intact.** `db/client.ts` already starts with `import "server-only";` — do not remove it. The Route Handler runs server-side, so the import chain `app/api/todos/route.ts → db/queries.ts → db/client.ts` is fine.
- **`userId` parameter forward-compat.** Both `getTodos(null)` and `createTodo(input, null)` keep the trailing `userId` argument. v1 always passes `null`. Removing it to "simplify" v1 is a footgun — auth lands in a future epic and changes the call sites only, not the query helpers.

### Naming and structure

- **Zod schemas:** `PascalCase` ending in `Schema` (`TodoCreateSchema`, `TodoUpdateSchema`). The inferred type drops the suffix (`TodoCreateInput`, `TodoUpdateInput`).
- **Module file:** `lib/validation.ts` (kebab-case, non-component). Co-located test: `lib/validation.test.ts`.
- **Route file:** `app/api/todos/route.ts` — Next.js convention. Co-located test: `app/api/todos/route.test.ts`. Route Handlers MUST live in `route.ts`, never in a sibling file with custom export names.
- **JSON field naming:** camelCase in request and response bodies. The DB uses snake_case columns; Drizzle's JS-side property names are camelCase, and `JSON.stringify` over the resulting JS object naturally emits camelCase. No manual translation layer.
- **Dates:** ISO 8601 with timezone, e.g., `"2026-04-28T12:34:56.000Z"`. Returned automatically by `JSON.stringify` over a JS `Date`. Never Unix timestamps, never date-only strings.

### `drizzle-zod` v0.8 specifics for the `Todo` row schema

Story 1.2 installed `drizzle-zod@0.8.3`. Key API points for v0.8 (which targets Zod v4 — that is why `zod@4.3.6` resolved transitively):

- Import: `import { createSelectSchema, createInsertSchema } from "drizzle-zod";`
- Usage: `const TodoSchema = createSelectSchema(todos);` produces a Zod object schema mirroring the table's selectable shape (camelCase keys, correct types — `id: z.string().uuid()`-equivalent, `createdAt: z.date()`, `userId: z.string().uuid().nullable()`, etc.).
- Inferred row type: `type Todo = z.infer<typeof TodoSchema>;`
- For the API client (Story 1.4) to validate the wire response, you may want a *serialized* variant where `createdAt` is a string. Story 1.4 owns that (`apiClient.listTodos()` parses the JSON-side shape). For this story, the in-process `Todo` type from `db/schema.ts`'s `$inferSelect` is sufficient — re-export it from `lib/validation.ts` if convenient, or add the drizzle-zod schema and let Story 1.4 build on it. **Do not** over-engineer here; the goal is two solid endpoints, not a complete shared-types library.

### Idempotency implementation choice — pick one and stick with it

**Option A (recommended): `getTodoById` helper, decide status in the handler.**

```ts
// db/queries.ts
export async function getTodoById(id: string, userId: string | null): Promise<Todo | null> {
  const userMatch = userId === null ? isNull(todos.userId) : eq(todos.userId, userId);
  const [row] = await db.select().from(todos).where(and(eq(todos.id, id), userMatch));
  return row ?? null;
}

// app/api/todos/route.ts
const existing = await getTodoById(parsed.data.id, null);
const todo = existing ?? await createTodo(parsed.data, null);
return Response.json({ todo }, { status: existing ? 200 : 201 });
```

**Option B: `createTodo` returns `{ todo, created: boolean }`.** Cleaner single round-trip but changes the existing query signature, which 2.1 and 3.1 will not yet expect. Acceptable; adjust callers if used.

**Option C: `onConflictDoNothing` + select fallback inside `createTodo`.** Works, but loses the `201` vs. `200` distinction unless `createTodo` also returns a flag — collapsing into Option B.

Option A keeps `createTodo`'s signature stable (Story 2.1 will not need to learn a new shape) and makes the status-code decision explicit at the HTTP boundary, which is the conceptually correct place for it. Recommend Option A unless you have a specific reason otherwise. **Document the choice in the story's Completion Notes.**

A subtle race: between `getTodoById` and `createTodo`, two concurrent requests with the same `id` could both see "no existing" and both attempt insert; one will get a unique-violation throw. To harden against that, `createTodo` SHOULD still use `onConflictDoNothing()` (a defense-in-depth idempotency at the DB layer) and re-select on the empty-returning path. The HTTP status will always be `201` from the slower-loser request even though it was the second to "create" — that is fine; the client cannot tell, and the row state is correct. **The "always-201" race is acceptable; the "throws-500" outcome is not.**

### Validation: minimum viable schema

Per the architecture's good example (lines 596–602):

```ts
// lib/validation.ts
import { z } from "zod";

export const TodoCreateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(280),
});
export type TodoCreateInput = z.infer<typeof TodoCreateSchema>;

export const TodoUpdateSchema = z.object({
  completed: z.boolean(),
});
export type TodoUpdateInput = z.infer<typeof TodoUpdateSchema>;
```

**Zod v4 note.** The codebase resolves `zod@4.3.6`. In Zod v4, `z.string().uuid()` still works but `z.uuid()` (top-level) is the canonical form. **Stick with `z.string().uuid()`** since the epic AC and architecture example use that exact form — keeping spec and code in lockstep prevents documentation drift. If a future Zod v5 breaks the chained form, migrate then.

The `.trim()` before `.min(1)` is intentional: a description of `"   "` would otherwise pass `min(1)`. Trim first, then assert non-empty.

### Route Handler shape (Next.js 16 specifics)

This codebase uses Next.js 16 (the AGENTS.md warning is real — APIs differ from older training data). For Story 1.3, the relevant facts:

- Route Handlers live in `route.ts` only (not `route.js`, not co-located in any other filename).
- Methods are exported as named async functions (`export async function GET(req: Request) {...}`).
- Use the Web `Request` and `Response` APIs. `Response.json(body, { status })` is the idiomatic response.
- Route Handlers are **not cached by default for non-GET methods**; for `GET` they are dynamic by default unless you opt into static generation via `export const dynamic = 'force-static'`. **Do not** add that opt-in — the list endpoint is request-scoped and a fresh DB read per request is correct.
- No `NextRequest`/`NextResponse` import needed for this story (we don't use cookies, headers, or rewrites). Adding them is harmless but extra.
- For `[id]` dynamic routes (NOT this story; reserved for 2.1+), Next.js 16 makes `ctx.params` a Promise: `const { id } = await ctx.params`. Story 1.3 has no `[id]`, so this does not apply here. Mentioned only so you do not accidentally copy a 2.1 example into 1.3.
- Reference: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (Next.js 16's bundled docs).

### File contract (target end-state for this story)

```
lib/
├── validation.ts          # NEW — TodoCreateSchema, TodoUpdateSchema, types, optional Todo schema
└── validation.test.ts     # NEW — Zod schema tests
db/
├── queries.ts             # MODIFIED — TodoCreateInput now imported from lib/validation; createTodo idempotent; new getTodoById
└── queries.test.ts        # MODIFIED — added "idempotent on duplicate id" + getTodoById coverage
app/api/todos/
├── route.ts               # NEW — GET + POST handlers, try/catch + Zod + error contract
└── route.test.ts          # NEW — integration tests against the same test DB
package.json               # MODIFIED — zod promoted to dependencies (4.3.6)
pnpm-lock.yaml             # MODIFIED — resolution change for zod direct dep
```

`package.json` changes (deltas only):

- `dependencies` += `"zod": "4.3.6"` (no caret — pin to match the existing transitive resolution; `pnpm` will dedupe). If you need flexibility, `^4.3.6` is fine.
- No new `devDependencies`.
- No new scripts.

### Previous-story intelligence (Story 1.2 learnings)

1. **`zod@4.3.6` is already on disk** as a transitive of `drizzle-zod@0.8.3`. Promoting it via `pnpm add zod@4.3.6` will not change the installed version, only the `package.json` declaration and lockfile classification. Verify the lockfile has a single `zod@4.3.6` entry under direct `dependencies` after the change (the `zod@3.25.76` resolution that exists is for the unrelated `@modelcontextprotocol/sdk` and is fine to leave alone — it is in a separate version range).
2. **`drizzle-zod` is installed but unused** — Story 1.2 added it precisely so 1.3 could pick it up without a fresh install. Use `createSelectSchema(todos)` from `drizzle-zod` if you need a Zod schema for the row shape (see "drizzle-zod v0.8 specifics" above). If your design does not need it, that is fine — `drizzle-zod` will remain unused and that is acceptable.
3. **`createTodo` in `db/queries.ts` currently has a local `TodoCreateInput`** alias — the previous-story dev notes flagged it: "Local `TodoCreateInput = Pick<TodoInsert, "id" | "description">` will be replaced by Story 1.3's Zod-inferred type". Replace it; keep the call signature `createTodo(input, userId)`.
4. **Test infra is reusable.** `vitest.config.ts`'s `**/*.test.{ts,tsx}` glob already covers `app/api/todos/route.test.ts` and `lib/validation.test.ts`. No config edits required. The `test/stubs/server-only.ts` alias from 1.2 keeps `import "server-only"` resolvable in Vitest — relevant because `app/api/todos/route.ts` imports `db/queries.ts` which imports `db/client.ts` which imports `server-only`.
5. **`db/queries.test.ts` uses `beforeEach` TRUNCATE.** The new `app/api/todos/route.test.ts` should mirror this pattern — same truncate, same `afterAll` pool teardown. Keep the test setup symmetric so future stories reading both files see one pattern.
6. **`db/client.ts` exports the singleton `db`.** Mocking it directly is awkward; for the 500-path test in `route.test.ts`, prefer `vi.spyOn(queries, "createTodo").mockRejectedValueOnce(new Error("boom"))` (or `getTodoById`, depending on whether your idempotency implementation calls it first). **Do not** mock `db` itself.
7. **The build pipeline runs `drizzle-kit migrate && next build`.** No schema changes are made in this story, so the `migrate` step is a no-op. If `next build` fails, the Route Handler files have a TypeScript or import error — debug there.
8. **`AGENTS.md` already encodes the conventions** the dev needs (No modals, design tokens, import graph, Database & Migrations sections). Do not duplicate; reference.

### Git intelligence (recent commits)

```
4de3769 Merge pull request #6 from mattiazaffalon-nf/docs/readme-bmad-workflow
2941c7c claude instructions
13e5fd0 docs: add BMad workflow reconstruction to README
f21a118 Merge pull request #5 from mattiazaffalon-nf/story-1.2-dev
6b3bdeb bmad-story-1.2-postgres-schema
e832039 Merge pull request #4 from mattiazaffalon-nf/story-1.2-create-spec
```

Story 1.2's implementation merged on `f21a118` adds: `db/{schema,client,queries,queries.test}.ts`, `db/migrations/0000_*.sql`, `drizzle.config.ts`, `vitest.config.ts`, `test/stubs/server-only.ts`, plus the `db/**` ESLint scope and the AGENTS.md "Database"/"Migrations" sections. Story 1.3 builds *on top of* all of this — do not regenerate, do not patch. The single file you'll edit is `db/queries.ts` (the change scoped per Task 3).

Story 1.1's `eslint.config.mjs` (lines 78–99) already restricts `app/api/**` from importing `components/**` and `hooks/**`. Verify your new `route.ts` does not accidentally pull in either via auto-import suggestions from the IDE.

### Latest tech notes

- **Next.js 16.2.4** Route Handlers: see Next.js bundled docs (`15-route-handlers.md`). Key delta from older Next.js: `[id]` route params are now async (`await ctx.params`). Not relevant to this story but a footgun for Story 2.1 — record this for next time.
- **Zod 4.3.6**: chained `.uuid()` on string is still supported but `z.uuid()` is the canonical v4 form. We stick with the chained form for consistency with the architecture example.
- **drizzle-zod 0.8.3**: peer-deps Zod `^3.25 || ^4.0`; we are on Zod v4. `createSelectSchema` and `createInsertSchema` are the two exports you'll typically use.
- **`pg@8.20.0` + `drizzle-orm@0.45.2`**: `onConflictDoNothing({ target: column })` is supported and is the cleanest way to express "insert if absent" without a SELECT round-trip. For PG-side semantics, this generates `INSERT … ON CONFLICT (id) DO NOTHING RETURNING *`; an empty `returning` array indicates the conflict path was taken.

### Project context reference

This story implements the API entry point that all subsequent UI work in Epic 1 (1.4, 1.5) and the related backend stories (2.1, 3.1) will compose against. The `lib/validation.ts` it lands here is shared client-side from Story 1.4 onward (the `lib/api-client.ts` parses the wire response with the same schemas), so getting the schema shape right matters more than the immediate route plumbing.

The `TodoUpdateSchema` is included in this story (per the epic AC) specifically so Story 2.1 does not need to edit `lib/validation.ts` — single ownership of that file, single point of change.

### Out of scope for this story

- `app/api/todos/[id]/route.ts` (PATCH, DELETE) — Stories 2.1, 3.1.
- `lib/api-client.ts` (typed fetch wrapper) — Story 1.4.
- `app/page.tsx`, `app/providers.tsx`, `components/Task*` — Story 1.4.
- TanStack Query setup, hydration boundary — Story 1.4.
- `useCreateTodo` mutation hook with optimistic updates — Story 1.5.
- GitHub Actions CI workflow, security headers, Sentry — Story 4.3.
- Rate limiting, OpenAPI spec generation — deferred per architecture (line 305, 307).

### Project Structure Notes

- `app/api/todos/` is created fresh by this story; the directory does not yet exist.
- `lib/validation.ts` is also new; `lib/utils.ts` already exists from Story 1.1 (carries shadcn's `cn()` helper) and is untouched.
- No new top-level config files. `vitest.config.ts` continues to pick up tests via its existing glob.
- The architecture document (lines 696, 699, 712–725, 753–761) describes the directory shape this story produces — a verification mental-checklist, not a directive to add files outside the AC.

### References

- Story acceptance criteria source: [`_bmad-output/planning-artifacts/epics.md` §"Story 1.3"](../planning-artifacts/epics.md#story-13-build-getapitodos-and-idempotent-postapitodos-route-handlers)
- API & communication patterns: [`_bmad-output/planning-artifacts/architecture.md` §"API & Communication Patterns"](../planning-artifacts/architecture.md#api--communication-patterns) (lines 273–308)
- Validation strategy and Zod ownership: [`_bmad-output/planning-artifacts/architecture.md` §"Data Architecture / Validation strategy"](../planning-artifacts/architecture.md#data-architecture) (lines 239–244)
- Naming patterns (DB, API, code, Zod schemas): [`_bmad-output/planning-artifacts/architecture.md` §"Naming Patterns"](../planning-artifacts/architecture.md#naming-patterns) (lines 407–436)
- Format patterns (response envelopes, JSON field naming, dates, errors): [`_bmad-output/planning-artifacts/architecture.md` §"Format Patterns"](../planning-artifacts/architecture.md#format-patterns) (lines 503–519)
- Process patterns (error handling, validation timing): [`_bmad-output/planning-artifacts/architecture.md` §"Process Patterns"](../planning-artifacts/architecture.md#process-patterns) (lines 545–569)
- Pattern examples (Route Handler skeleton): [`_bmad-output/planning-artifacts/architecture.md` §"Pattern Examples"](../planning-artifacts/architecture.md#pattern-examples) (lines 590–648)
- Architectural boundaries (API + Data + import graph): [`_bmad-output/planning-artifacts/architecture.md` §"Architectural Boundaries"](../planning-artifacts/architecture.md#architectural-boundaries) (lines 796–851)
- Story 1.2 implementation record (deviations, file list, "next-story notes" for 1.3): [`1-2-postgres-schema-migrations-queries.md`](./1-2-postgres-schema-migrations-queries.md)
- Story dependency graph (1.3 unblocks 1.4, 1.5, 2.1, 3.1): [`_bmad-output/planning-artifacts/story-dependency-graph.md`](../planning-artifacts/story-dependency-graph.md)
- Project conventions summary (naming, import graph, no-modals, DB rules): [`AGENTS.md`](../../AGENTS.md)
- Next.js 16 Route Handlers: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`

### Review Findings

- [x] [Review][Patch] Missing test for wrong field types — added test sending `{ id: 123, description: true }` asserting 400 `validation_failed` [`app/api/todos/route.test.ts`]
- [x] [Review][Patch] 500-path test unintentionally hits real DB via getTodoById — added `vi.spyOn(queries, "getTodoById").mockResolvedValueOnce(null)` so the crash path is fully mocked [`app/api/todos/route.test.ts:193`]
- [x] [Review][Defer] No request body size limit or stream timeout on `req.json()` [`app/api/todos/route.ts:25`] — deferred, pre-existing infrastructure concern; mitigated by reverse proxy in production

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Opus 4.7, 1M context)

### Debug Log References

- `pnpm add zod@4.3.6` — clean install; lockfile resolution stable (single direct `zod@4.3.6`).
- `pnpm test lib/validation.test.ts` — 14/14 green in 0.4s.
- `pnpm test db/queries.test.ts` — 6/6 green in ~5s (4 new tests for idempotency + `getTodoById`).
- `pnpm test app/api/todos/route.test.ts` — 14/14 green in ~20s.
- `pnpm test` (full suite) — initially 7 failures (cross-file race on the shared dev-branch DB). Fixed by adding `fileParallelism: false` to `vitest.config.ts`. After fix: 34/34 green in ~26s.
- `pnpm lint`, `pnpm typecheck`, `pnpm test:tokens` — all green.
- `pnpm build` — `drizzle-kit migrate` no-op (no schema change), `next build` 2.3s. `/api/todos` correctly classified as `ƒ` (dynamic / server-rendered on demand); `/` and `/_not-found` remain static.

### Completion Notes List

**Done — all six tasks complete; all five ACs satisfied.**

**Idempotency implementation: Option A from the spec.** `db/queries.ts` exposes `getTodoById(id, userId)`; the POST handler calls it before `createTodo` and decides `200` vs `201` at the HTTP boundary. Defense-in-depth at the DB layer: `createTodo` itself uses `.onConflictDoNothing({ target: todos.id })` and falls back to `getTodoById` if `returning()` is empty — so a TOCTOU race between the route handler's existence check and its insert resolves cleanly to the existing row instead of throwing a unique-violation 500. The slower-loser request still returns `201` in that race (per spec: "always-201 race is acceptable; throws-500 outcome is not"). No `pg` error-code introspection needed.

**Deviations from the story spec (recorded — not surprises):**

1. **`Todo` type re-export instead of `drizzle-zod` `createSelectSchema`.** AC #1 suggested `createSelectSchema(todos)`; the parenthetical "or the equivalent" and Dev Notes' "do not over-engineer" both opened the door. I went with `import type { Todo } from "@/db/schema"; export type { Todo };` — zero-runtime-cost (TypeScript type aliases are erased) and avoids pulling `drizzle-zod` (which depends on `zod-validation-error`) into anything that imports `lib/validation.ts` from the client side later. Story 1.4 can add a wire-shape Zod schema (where `createdAt: z.string().datetime()`) if its API client needs runtime validation.
2. **`vitest.config.ts` gained two changes:**
   - `fileParallelism: false` — required because the project's test-DB strategy (Story 1.2 Option A: a single shared Neon dev branch) means `db/queries.test.ts` and `app/api/todos/route.test.ts` cannot safely run in parallel against the same `todos` table. Within a single file Vitest still runs `it` blocks sequentially, so `beforeEach` TRUNCATE is sufficient. Trade-off: full suite goes from ~12s parallel-but-flaky to ~26s serial-and-correct. Acceptable for an integration-test layer.
   - `resolve.alias["@"]` — Vitest does not honor tsconfig `paths` by default; the route test imports `@/db/client` and `@/db/queries`, and the route source imports `@/db/queries` and `@/lib/validation`. Mapping `@/*` → `./` in Vitest matches `tsconfig.json`'s alias. (Next.js's own bundler picks up the tsconfig path automatically — that's why `pnpm build` worked without it.)
3. **Malformed-JSON returns `400 validation_failed`, not `500`.** The spec's POST contract focused on Zod-failure 400s, but a body that is not valid JSON would otherwise throw inside `req.json()` and fall through to the 500 catch. Returning `400 { code: "validation_failed", message: "Request body is not valid JSON" }` is the more truthful HTTP semantics — the input is malformed, the server is not. Added a test for it. If a future reviewer prefers `500`, the change is a one-line move of the inner try/catch.
4. **Naming of helper functions in `route.ts`.** Two thin wrappers (`validationFailed(message)`, `internalError()`) — purely de-duplication of the response shape, no business logic. Three lines each.

**Notes for the next stories (1.4, 1.5, 2.1, 3.1):**

- `lib/validation.ts` is now the source of truth for `TodoCreateSchema`, `TodoUpdateSchema`, and the `Todo` type. Story 2.1 (`PATCH`) will import `TodoUpdateSchema` directly from here — no edit to this file needed.
- `db/queries.ts` now exports `getTodos`, `getTodoById`, `createTodo`. Story 2.1 should add `updateTodo`; Story 3.1 should add `deleteTodo` — each new function should follow the same `userIdFilter(userId)` shared helper pattern.
- The `vi.spyOn(queries, "fnName")` pattern works against the route handlers because they import named functions from `@/db/queries`. Story 2.1 / 3.1 tests should use the same pattern for their 500 paths.
- Next.js 16 makes `[id]` route params async (`const { id } = await ctx.params`). Story 2.1 / 3.1 will hit this — see the story spec's "Latest tech notes" section.

**Vercel verification still pending.** Local build + tests pass. Once this branch is pushed, Vercel will run the same `drizzle-kit migrate && next build` against an ephemeral Neon preview branch. Watch the preview-deploy logs in the PR before merging.

### File List

**New files:**
- `lib/validation.ts`
- `lib/validation.test.ts`
- `app/api/todos/route.ts`
- `app/api/todos/route.test.ts`

**Modified files:**
- `db/queries.ts` (idempotent `createTodo`, new `getTodoById`, `TodoCreateInput` now imported from `@/lib/validation`, shared `userIdFilter` helper)
- `db/queries.test.ts` (added 4 tests: idempotent same-body, idempotent different-body, `getTodoById` happy, `getTodoById` not-found)
- `vitest.config.ts` (added `test.fileParallelism: false`, added `resolve.alias["@"]`)
- `package.json` (`zod@4.3.6` promoted from transitive to direct dependency)
- `pnpm-lock.yaml` (resolution change)

**Story spec / planning artifact (not part of the runtime app):**
- `_bmad-output/implementation-artifacts/1-3-api-todos-routes-validation.md`

## Change Log

| Date       | Change                                                                                                                            | Author             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 2026-04-28 | Story spec created from epics.md §"Story 1.3", architecture.md §"API & Communication Patterns" + §"Validation strategy", with Story 1.2 learnings propagated and idempotency-implementation guidance | bmad-create-story  |
| 2026-04-28 | Implementation completed: `lib/validation.ts`, `app/api/todos/route.ts` with GET + idempotent POST, `getTodoById` query helper, 34 passing tests; `vitest.config.ts` gained `@` alias and `fileParallelism: false` | bmad-dev-story     |
