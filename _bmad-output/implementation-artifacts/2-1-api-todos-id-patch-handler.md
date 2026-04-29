# Story 2.1: Build `PATCH /api/todos/[id]` Route Handler for completion state updates

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a client (web app or future mobile),
I want a `PATCH` endpoint to flip a todo's `completed` flag with strict validation, the canonical `{ code, message }` error contract, and proper `404` semantics,
So that the optimistic toggle in Story 2.2 has a reliable persistence target and any retry replays the same payload without producing inconsistent state.

## Acceptance Criteria

1. **`db/queries.ts` is extended with a parameterized `updateTodo` helper.**
   - Adds `export async function updateTodo(id: string, patch: { completed: boolean }, userId: string | null): Promise<Todo | null>`.
   - Implementation uses Drizzle's expression API end-to-end: `db.update(todos).set({ completed: patch.completed }).where(and(eq(todos.id, id), userIdFilter(userId))).returning()`. **No raw SQL.**
   - Returns the updated row, or `null` when no row matched (so the route handler can decide `404`).
   - Reuses the existing private `userIdFilter(userId)` helper (added in Story 1.3). Do not duplicate the `null`-vs-eq branch.
   - The function signature is fixed: `(id, patch, userId)`. v1 always passes `null` for `userId`. **Do not** "simplify" by removing the `userId` parameter — auth lands in a future epic and only the call sites should change.
   - Returns the freshly-updated row (`returning()` semantics); never re-selects after the update.

2. **`app/api/todos/[id]/route.ts` exists with a `PATCH` export that satisfies the contract.**
   - File path is exactly `app/api/todos/[id]/route.ts` — Next.js dynamic-segment convention. Route Handlers MUST live in `route.ts`, not a sibling file.
   - The handler signature uses Next.js 16's async-params convention: `export async function PATCH(req: Request, ctx: RouteContext<'/api/todos/[id]'>)` and reads the id via `const { id } = await ctx.params`. **`ctx.params` is a Promise in Next.js 16 — awaiting it is mandatory.**
   - Validates the route param: if `id` is not a valid UUID (use `z.string().uuid().safeParse(id)`), respond `400 { code: "validation_failed", message }` **without touching the DB**.
   - Parses the JSON body inside an inner `try/catch`; malformed JSON returns `400 { code: "validation_failed", message: "Request body is not valid JSON" }`. (Same pattern as `POST /api/todos` from Story 1.3 — keep it identical.)
   - Validates the parsed body with `TodoUpdateSchema` (already exported from `lib/validation.ts` since Story 1.3). On failure: `400 { code: "validation_failed", message: parsed.error.message }`. **Do not edit `lib/validation.ts`** — the schema is already there waiting for this story.
   - On valid input, calls `updateTodo(id, { completed: parsed.data.completed }, null)`:
     - When the helper returns the updated `todo`: respond `200 { todo: Todo }` with ISO 8601 `createdAt` and camelCase fields (matches the GET/POST response shape).
     - When the helper returns `null`: respond `404 { code: "not_found", message: "Todo not found" }`.
   - All paths run inside an outer `try/catch`. On any uncaught throw: `console.error(err)` and respond `500 { code: "internal_error", message: "Something went wrong" }`. **Raw error details (stack, PG error codes, Drizzle internals) never leak to the client.**
   - Reuses the same response-shape helpers from `app/api/todos/route.ts` (`validationFailed`, `internalError`) by extracting them into a shared module (`app/api/todos/_lib/responses.ts` is the recommended location — see Dev Notes for the rationale). Add a `notFound(message)` helper alongside them.
   - Uses Web `Request`/`Response` (no `NextRequest`/`NextResponse`). The handler does not import `NextRequest` or `NextResponse`. The `RouteContext` global type is fine.

3. **`app/api/todos/[id]/route.test.ts` covers the contract end-to-end against the same test DB used by `db/queries.test.ts` and `app/api/todos/route.test.ts`.**
   - File header: `// @vitest-environment node` — same as the other DB integration test files.
   - Setup: `beforeEach(() => db.execute(sql\`TRUNCATE TABLE todos\`))`, `afterEach(vi.restoreAllMocks)`, `afterAll` pool teardown — mirror the Story 1.3 test scaffolding exactly so a future reader sees one pattern.
   - Tests cover, **at minimum**:
     - PATCH flips `completed` from `false` → `true` (200, body matches updated row).
     - PATCH flips `completed` from `true` → `false` (200, body matches updated row).
     - PATCH with the **same** `{ completed: true }` payload sent twice on the same row returns `200` both times with **identical** bodies (idempotency: no `409`, no error, no state drift).
     - PATCH with an unknown `id` (valid UUID, no row) returns `404 { code: "not_found", message: "Todo not found" }`.
     - PATCH with a malformed `id` route param (not a UUID) returns `400 { code: "validation_failed", message }`. **The DB layer is not touched** — assert via `vi.spyOn(queries, "updateTodo")` that the spy was not called.
     - PATCH with a malformed body (`{ completed: "yes" }`, `{}`, `{ completed: 1 }`, missing fields) returns `400 { code: "validation_failed", message }`. At least one variant is asserted; ideally one per failure mode.
     - PATCH with non-JSON body returns `400 { code: "validation_failed", message }`.
     - PATCH where `updateTodo` throws returns `500 { code: "internal_error", message: "Something went wrong" }` — use `vi.spyOn(queries, "updateTodo").mockRejectedValueOnce(new Error("boom"))` and `vi.spyOn(console, "error").mockImplementation(() => {})` to keep stderr quiet.
   - All tests pass against the same `DATABASE_URL` setup that `db/queries.test.ts` uses (Neon dev branch via `.env.local`).

4. **`db/queries.test.ts` is extended with `updateTodo` coverage.**
   - `updateTodo` flips `completed` and returns the updated row (assert `row.completed === true` after `false`-to-`true` flip).
   - `updateTodo` returns `null` when no row matches the supplied id.
   - `updateTodo` is idempotent: calling twice with `{ completed: true }` on the same row returns the same `completed: true` row both times — no throw, no `null` on the second call (because the row still matches).
   - The query helper does not modify other rows (insert two rows, update one, assert the second is unchanged).

5. **Lint, typecheck, build, and test gates are green.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all succeed locally before this story is merged. The `app/api/**` and `db/**` ESLint scopes both still pass — `app/api/todos/[id]/route.ts` may import from `db/queries.ts` (allowed) but **must not** import from `components/**` or `hooks/**`. The PATCH route must classify as `ƒ` (Dynamic) in the build output, not `○` (Static).

## Tasks / Subtasks

- [x] **Task 1: Add `updateTodo` to `db/queries.ts` (AC: #1)**
  - [x] Add `import { ... }` updates if needed (only `eq` and `and` are already imported)
  - [x] Implement `updateTodo(id, patch, userId)` with Drizzle's update + where + returning chain; reuse `userIdFilter`
  - [x] Return `Todo | null` (destructure first row from the `returning()` array)
  - [x] Verify `pnpm typecheck` passes

- [x] **Task 2: Extend `db/queries.test.ts` with `updateTodo` coverage (AC: #4)**
  - [x] Add `import { updateTodo }` to the existing import line
  - [x] Add four `it` blocks: happy-path flip, returns-null on missing id, idempotent twice-true, does-not-affect-other-rows
  - [x] Confirm all existing 6 tests still pass + 4 new tests = 10 total

- [x] **Task 3: Extract shared response helpers (AC: #2)**
  - [x] Create `app/api/todos/_lib/responses.ts` exporting `validationFailed(message)`, `notFound(message)`, `internalError()` — three thin wrappers around `Response.json` with the canonical error shapes
  - [x] Update `app/api/todos/route.ts` to import these from `./_lib/responses` (delete the local versions)
  - [x] Run the existing `app/api/todos/route.test.ts` — must remain green with no test edits

- [x] **Task 4: Implement `app/api/todos/[id]/route.ts` (AC: #2)**
  - [x] Create the directory `app/api/todos/[id]/` and the file `route.ts`
  - [x] Export `async function PATCH(req: Request, ctx: RouteContext<'/api/todos/[id]'>)` — note the global `RouteContext` type generated by `next dev`/`next build`/`next typegen`
  - [x] Implement the handler in this order: (1) await ctx.params + UUID validate → 400 on fail; (2) inner try/catch req.json() → 400 on parse fail; (3) `TodoUpdateSchema.safeParse(body)` → 400 on fail; (4) `updateTodo(id, ..., null)` → 200 on hit, 404 on null; (5) outer try/catch → 500 on throw
  - [x] No `dynamic = "force-static"` and no `revalidate` — the route is dynamic by default since it does a DB write

- [x] **Task 5: Write `app/api/todos/[id]/route.test.ts` (AC: #3)**
  - [x] File header: `// @vitest-environment node`
  - [x] Mirror the test scaffolding from `app/api/todos/route.test.ts` (TRUNCATE in `beforeEach`, `vi.restoreAllMocks` in `afterEach`, pool `end()` in `afterAll`)
  - [x] Helper: `const patch = (id: string, body: unknown) => PATCH(new Request(\`http://localhost/api/todos/\${id}\`, { method: "PATCH", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }), { params: Promise.resolve({ id }) })` — note `params` is a Promise per Next.js 16
  - [x] All test cases listed in AC #3
  - [x] Confirm green: `pnpm test app/api/todos/[id]/route.test.ts`

- [x] **Task 6: Verify gates and update Story 2.2 expectations (AC: #5)**
  - [x] `pnpm lint` — clean
  - [x] `pnpm typecheck` — clean
  - [x] `pnpm test` — all existing tests + new tests green (target: 34 + 4 (queries) + ~10 (route) = ~48 total)
  - [x] `pnpm build` — succeeds; build output classifies `/api/todos/[id]` as `ƒ` (Dynamic), `/api/todos` remains `ƒ`, `/` remains `ƒ`
  - [x] No edits to `lib/validation.ts` (the schema is already there from Story 1.3)
  - [x] Confirm `_bmad-output/implementation-artifacts/deferred-work.md` is unchanged (no new deferrals expected from this story; if any arise during implementation, follow the existing format)

## Dev Notes

### Architectural anchors (do not deviate)

- **API style:** REST Route Handlers in `app/api/todos/[id]/route.ts`. Architecture §"API & Communication Patterns" is binding (lines 273–308).
- **Endpoint contract** (this story's single endpoint):

  | Method | Path | Body | Success | Errors |
  |---|---|---|---|---|
  | `PATCH` | `/api/todos/[id]` | `{ completed: boolean }` | `200 { todo: Todo }` | `400 { code: "validation_failed", message }` (bad UUID, bad body, malformed JSON) / `404 { code: "not_found", message }` (no matching row) / `500 { code: "internal_error", message }` |

- **Idempotency contract.** `PATCH` is naturally idempotent: same `{ completed }` payload → same final state. The architecture explicitly says "PATCH is naturally idempotent (same `completed` value → same state)" (line 296). The Story 2.2 mutation hook will retry on transient failures (the **client** does not retry by default — `retry: false` per the optimistic-mutation contract — but human-initiated retry via the future `ErrorIndicator` is the same payload), so this server endpoint must produce the same 200 response on a repeat. **Never `409`, never error.**
- **Error contract.** Errors always have shape `{ code: string, message: string }`. `code` is stable and machine-readable (`validation_failed`, `not_found`, `internal_error`). `message` is for developer logs, not user-facing UI (UX policy already says the UI shows a single fixed error message regardless of `message` content). Architecture §"Format Patterns" + §"Process Patterns".
- **Validation timing.** Server validates *every* input — both the `id` route param (must be a UUID) and the body (must match `TodoUpdateSchema`). **Reject malformed inputs with 400 *before* any DB call.** The server is the security boundary; never trust the client.
- **DB layer purity.** `db/queries.ts` stays UI-agnostic. The Route Handler imports from `db/queries.ts`; the queries module never imports from `app/api/**`, `components/**`, or `hooks/**`. The `db/**` ESLint scope (Story 1.2) and the `app/api/**` scope (Story 1.1) enforce this.
- **`server-only` boundary intact.** `db/client.ts` starts with `import "server-only";`. The route handler runs server-side, so `app/api/todos/[id]/route.ts → db/queries.ts → db/client.ts` is fine.
- **`userId` parameter forward-compat.** `updateTodo(id, patch, null)`. Same convention as `getTodos`, `getTodoById`, `createTodo`. Do not collapse it.

### Naming and structure

- **File path:** `app/api/todos/[id]/route.ts` (Next.js dynamic-segment convention). Co-located test: `app/api/todos/[id]/route.test.ts`. **Route Handlers must live in `route.ts`** — no `route.js`, no sibling file with custom export names.
- **Shared response helpers location:** `app/api/todos/_lib/responses.ts`. The leading underscore on `_lib` keeps the directory out of Next.js's route-detection (Next.js ignores `_`-prefixed segments — see [Project Organization](https://nextjs.org/docs/app/getting-started/project-structure)). Local convention: directory-level helpers go in `_lib/`. `app/api/_lib/` would also work and is fine if you prefer to share across multiple resources later — but for v1, only `/api/todos/*` exists, so `app/api/todos/_lib/responses.ts` is closer to the call sites.
- **Method export naming:** `export async function PATCH(req, ctx) {...}`. The exported names are HTTP verbs in uppercase — Next.js's contract.
- **Body shape:** request `{ completed: boolean }`, response `{ todo: Todo }` on success, `{ code, message }` on error. **No envelopes** like `{ data: ..., error: ... }`. **No** snake_case field names — always camelCase.
- **Dates:** ISO 8601 with timezone (`"2026-04-29T12:34:56.000Z"`). Returned automatically by `JSON.stringify` over a JS `Date` (Drizzle's `createdAt` is a `Date` object; the response handler hands the row to `Response.json` which serializes it).

### Next.js 16 specifics for `[id]` Route Handlers

This codebase uses Next.js 16 (the `AGENTS.md` warning is real — APIs differ from older training data). The relevant facts for **dynamic** Route Handlers:

- **`ctx.params` is a Promise.** You must `await` it: `const { id } = await ctx.params`. In older Next.js (≤14), `params` was a synchronous object; in 16 it is async. Do not destructure the params synchronously — TypeScript will complain, and the runtime will hand you a `Promise` object instead of the parsed param.
- **`RouteContext<'/api/todos/[id]'>` is a global type** generated by `next dev`, `next build`, or `next typegen`. Use it on the `ctx` parameter for full typing — `ctx.params` will be typed as `Promise<{ id: string }>`. If the type is missing locally (cold checkout), run `pnpm dev` once or `pnpm dlx next typegen` to generate it.
- **The handler signature is `(req: Request, ctx: RouteContext<'/api/todos/[id]'>)`.** The first arg is fine to type as `Request` (Web standard) — same convention as `app/api/todos/route.ts` from Story 1.3. **No `NextRequest` import is needed** for this story; we don't use cookies, headers, or rewrites.
- **`Response.json(body, { status })`** is the canonical response helper. Use it everywhere. No `NextResponse` import needed.
- **Dynamic by default.** Route Handlers with non-GET methods are dynamic by default. Do **not** add `export const dynamic = 'force-static'`. Confirm via `pnpm build`'s output table — the route should appear as `ƒ /api/todos/[id]`.
- Reference: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (lines 187–198 — Route Context Helper). Quote:
  > In TypeScript, you can type the `context` parameter for Route Handlers with the globally available `RouteContext` helper:
  > ```ts
  > export async function GET(_req: NextRequest, ctx: RouteContext<'/users/[id]'>) {
  >   const { id } = await ctx.params
  >   return Response.json({ id })
  > }
  > ```

### `updateTodo` query implementation (recommended shape)

```ts
// db/queries.ts (additions)
export async function updateTodo(
  id: string,
  patch: { completed: boolean },
  userId: string | null,
): Promise<Todo | null> {
  const [row] = await db
    .update(todos)
    .set({ completed: patch.completed })
    .where(and(eq(todos.id, id), userIdFilter(userId)))
    .returning();
  return row ?? null;
}
```

Notes:
- **No raw SQL.** Drizzle's expression API is binding (per AGENTS.md "Database" section).
- **`returning()`** returns the post-update row; we pluck the first via destructuring and coalesce to `null` when the array is empty (Drizzle returns `[]` for "no rows matched", not an error).
- **Composite where clause.** `and(eq(todos.id, id), userIdFilter(userId))` is the same shape as `getTodoById`. The `userId` mismatch path (when auth lands) will return `null` even if a row with that `id` exists for a different user — which is exactly what we want (response: 404, not 403, to avoid leaking the existence of other users' rows).
- **`set({ completed: patch.completed })`** intentionally only updates `completed`. **Do not** update `description` or `createdAt` here — `PATCH` is partial by definition and the spec restricts the body to `{ completed }`. If a future story adds editable descriptions, that's a separate `updateTodoDescription` helper or an extension to `updateTodo` with a wider `patch` type.
- **Type the `patch` parameter narrowly: `{ completed: boolean }`.** Do not type it as `Partial<TodoInsert>` — too broad, lets future callers accidentally pass disallowed fields. The narrow type is the contract.

### Route Handler shape (target end-state)

```ts
// app/api/todos/[id]/route.ts
import { z } from "zod";
import { updateTodo } from "@/db/queries";
import { TodoUpdateSchema } from "@/lib/validation";
import { internalError, notFound, validationFailed } from "../_lib/responses";

const IdSchema = z.string().uuid();

export async function PATCH(req: Request, ctx: RouteContext<'/api/todos/[id]'>) {
  try {
    const { id } = await ctx.params;
    if (!IdSchema.safeParse(id).success) {
      return validationFailed("id route param must be a UUID");
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return validationFailed("Request body is not valid JSON");
    }

    const parsed = TodoUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return validationFailed(parsed.error.message);
    }

    const todo = await updateTodo(id, { completed: parsed.data.completed }, null);
    if (!todo) {
      return notFound("Todo not found");
    }

    return Response.json({ todo }, { status: 200 });
  } catch (err) {
    console.error(err);
    return internalError();
  }
}
```

This is the recommended shape, not a directive — minor stylistic variations (e.g., handling param validation outside the outer try/catch, since param parsing cannot throw) are fine. The contract that must hold is the response shapes and status codes, not the exact code layout.

### Shared response helpers

`app/api/todos/route.ts` currently has private `validationFailed` and `internalError` helpers. Story 2.1 adds a `notFound` helper, and the PATCH handler benefits from sharing all three. The right move is:

```ts
// app/api/todos/_lib/responses.ts
export const validationFailed = (message: string) =>
  Response.json({ code: "validation_failed", message }, { status: 400 });

export const notFound = (message: string) =>
  Response.json({ code: "not_found", message }, { status: 404 });

export const internalError = () =>
  Response.json(
    { code: "internal_error", message: "Something went wrong" },
    { status: 500 },
  );
```

Then `app/api/todos/route.ts` and `app/api/todos/[id]/route.ts` both `import { validationFailed, internalError } from "../_lib/responses"` (or `"./_lib/responses"` from the parent file).

The `_lib/` directory naming uses the Next.js convention that **underscore-prefixed directories are excluded from the route tree**. So `_lib/responses.ts` does not become an accidental `/api/todos/_lib/responses` route. (Without the underscore, Next.js would still ignore a non-`route.ts` filename — but the underscore is the explicit convention; prefer it.)

The existing `app/api/todos/route.test.ts` should still be green after the helpers are extracted because the runtime behavior is identical. **Do not edit the existing tests** as part of Task 3 — if they break, the extraction is wrong.

### Test scaffolding (target shape for `app/api/todos/[id]/route.test.ts`)

```ts
// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";
import * as queries from "@/db/queries";
import { PATCH } from "./route";

const uuid = () => crypto.randomUUID();

const patch = (id: string, body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/todos/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    // ctx — Next.js 16 makes `params` a Promise.
    // Note: the second arg is typed as `RouteContext<'/api/todos/[id]'>` in the route handler
    // signature, but in tests we just pass a structurally-compatible object.
    { params: Promise.resolve({ id }) } as never,
  );

describe("app/api/todos/[id] route handlers", () => {
  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE todos`);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    const client = (db as unknown as { $client: { end?: () => Promise<void> } }).$client;
    await client.end?.();
  });

  // ... tests per AC #3
});
```

The `as never` cast on the ctx object is a deliberate, narrowly-scoped escape hatch: at runtime the route handler only reads `ctx.params`, but TypeScript wants the full `RouteContext<'/api/todos/[id]'>` shape. Casting at the call site keeps the production handler fully typed without forcing every test to construct a synthetic `RouteContext`. (Alternative: `ctx as Parameters<typeof PATCH>[1]` works too — pick one and stay consistent.)

### Idempotency notes — what is and isn't true here

- **PATCH naturally idempotent.** Two `PATCH /api/todos/abc { completed: true }` calls both succeed and return `200 { todo }` with the same body. This requires no special server logic: the second `UPDATE … SET completed = true` against an already-`true` row updates zero columns but **still returns the row** via `RETURNING *` (Postgres semantics). Verify this in the query test (Task 2 includes this check explicitly).
- **`completed = true` then `completed = false` is NOT idempotent in the broader sense — it's a different operation.** The two responses differ. That's expected and fine; the idempotency claim is "same payload → same final state", not "any-payload → same".
- **No 409 path.** The architecture endpoint table mentions `409` for `POST` conflicts (Story 1.3 already overrode that to `200`). For PATCH, there is no `409` consideration at all — there's no resource-conflict failure mode. Just `200`, `400`, `404`, `500`.

### Validation: leveraging the schema already in place

`lib/validation.ts` already exports:
```ts
export const TodoUpdateSchema = z.object({ completed: z.boolean() });
export type TodoUpdateInput = z.infer<typeof TodoUpdateSchema>;
```
Story 1.3 explicitly added this schema **for Story 2.1's benefit** — quote from Story 1.3's Dev Notes: *"The `TodoUpdateSchema` is included in this story (per the epic AC) specifically so Story 2.1 does not need to edit `lib/validation.ts` — single ownership of that file, single point of change."* So **do not edit `lib/validation.ts` in this story** — the schema is already there.

For the route param: a one-line `z.string().uuid().safeParse(id)` is the right fit. **Do not** add a separate exported `IdParamSchema` to `lib/validation.ts` for this — the route param is HTTP-layer concern, and inlining the schema in the route file keeps `lib/validation.ts` focused on body schemas. (Counterargument: future stories 3.1 will also need a UUID param check on `DELETE /api/todos/[id]`. If you want to extract `IdParamSchema` to `lib/validation.ts`, that's defensible. But for v1's two route handlers, inline-and-DRY-later is the lighter-weight call.)

### Forbidden patterns (do not reintroduce these)

- **`NextRequest` / `NextResponse`** — not needed for this story; do not import.
- **Raw SQL** in `updateTodo` — Drizzle expression API only.
- **`try/catch` on `pg` error codes** — there's nothing to catch here that isn't already covered by the outer try/catch + 500 fallback.
- **`409` response** — there is no conflict path in PATCH.
- **`{ data: ..., error: null }` envelopes** — flat `{ todo }` on success, flat `{ code, message }` on error.
- **`snake_case` JSON fields** — camelCase only.
- **Returning the request body verbatim** on success — return the **fresh row from the DB** (which has `createdAt`, the canonical `id`, etc.). The client-supplied body has no `createdAt` and could be tampered.
- **Cache invalidation hints, ETags, `Cache-Control` headers, etc.** — out of scope; v1 is fully dynamic and does not cache PATCH responses.

### Previous-story intelligence (Story 1.3 + Story 1.5 learnings to apply here)

1. **`vi.spyOn(queries, "fnName")` is the established pattern** for mocking the DB layer in route tests. Story 1.3 used it for `getTodos`, `getTodoById`, `createTodo`. Story 2.1 uses the same approach for `updateTodo` (500-path test) and to assert "DB untouched on validation failure".
2. **`fileParallelism: false` is set in `vitest.config.ts`** (Story 1.3 deviation), so the new `app/api/todos/[id]/route.test.ts` will run sequentially with the other DB-touching tests. No further config changes needed.
3. **`@`-alias is mapped in `vitest.config.ts`** (Story 1.3 deviation). `@/db/client`, `@/db/queries`, `@/lib/validation` all resolve in tests.
4. **Test header `// @vitest-environment node` is required** for DB integration tests. The default Vitest environment is `jsdom` (set in 1.4 for the React component tests). Without the header, `pg` will not work.
5. **The `TRUNCATE TABLE todos` in `beforeEach`** is the test-isolation pattern. With `fileParallelism: false`, no cross-file interference is possible.
6. **`afterAll` pool teardown** prevents Vitest from hanging at the end of the run (Drizzle holds an internal `pg.Pool`):
   ```ts
   const client = (db as unknown as { $client: { end?: () => Promise<void> } }).$client;
   await client.end?.();
   ```
7. **Story 1.5 introduced `OptimisticTodo` with `syncStatus: 'idle' | 'pending' | 'failed'`.** This is a **client-side** type only; do not reference it from the route handler or query helper. The server returns plain `Todo` rows. Story 2.2's mutation hook will overlay `syncStatus` in the cache.

### Git intelligence (last 5 commits — for context)

```
c3d6d24 Merge pull request #9 from mattiazaffalon-nf/story-1.5-dev (Story 1.5)
9fcd60a bmad-story-1.5-code-review-patches
eb82d01 bmad-story-1.5-task-input-optimistic-prepend
a5f92e9 Merge pull request #8 from mattiazaffalon-nf/story-1.4-dev (Story 1.4)
2941c7c claude instructions
```

Story 1.5 merged on `c3d6d24` and shipped: `TaskInput`, `useCreateTodo`, `TodoListClient`, Playwright E2E suite (`pnpm test:e2e` script). Epic 1 is now complete. Story 2.1 is the **first story of Epic 2** and the only API-layer change in this story. **No frontend changes** in this story — the consumer (Story 2.2's `useToggleTodo`) is the next story in the chain.

### File contract (target end-state for this story)

```
db/
├── queries.ts             # MODIFIED — added updateTodo
└── queries.test.ts        # MODIFIED — added 4 tests for updateTodo
app/api/todos/
├── _lib/
│   └── responses.ts       # NEW — shared validationFailed/notFound/internalError helpers
├── route.ts               # MODIFIED — imports helpers from _lib/responses (no behavioral change)
├── route.test.ts          # UNCHANGED — must remain green
└── [id]/
    ├── route.ts           # NEW — PATCH handler
    └── route.test.ts      # NEW — integration tests
```

`package.json` and `pnpm-lock.yaml` are NOT modified by this story. No new dependencies; no new scripts.

### Latest tech notes

- **Next.js 16.2.4** — `[id]` Route Handlers: `ctx.params` is `Promise<{ id: string }>`. `RouteContext<'/api/todos/[id]'>` global helper types it. See `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` lines 187–198.
- **Drizzle ORM 0.45.2** — `db.update(table).set(values).where(condition).returning()` returns `Todo[]`; empty array on no-match is the "not found" signal. PG-side semantics: `UPDATE … RETURNING *` returns the post-update row(s).
- **Zod 4.3.6** — `z.string().uuid()` validates a UUID string; `safeParse(input).success` is the type-narrowing boolean. The chained form is intentionally consistent with the rest of the codebase (don't switch to `z.uuid()` here).
- **`pg` 8.20.0** — no specific note; the unpooled connection (`DATABASE_URL_UNPOOLED`) is for migrations only, not runtime queries. Tests use the pooled `DATABASE_URL`.

### Project context reference

This story is the **server contract for Story 2.2's optimistic toggle**. Story 2.2 (`hooks/use-toggle-todo.ts` + `apiClient.toggleTodo` + `TaskItem` checkbox interactivity) will:
- Call `apiClient.toggleTodo(id, completed)` which fetches `PATCH /api/todos/[id]`.
- Optimistically flip `completed` and set `syncStatus: 'pending'` in the cache.
- On `200`, `setQueryData` to overlay the server response with `syncStatus: 'idle'`.
- On `400`/`404`/`500`, restore the snapshot.

So the success contract (`200 { todo }`) and error contract (`{ code, message }`) returned by **this** story directly shape the client-side reconcile logic in **2.2**. Mismatches between the two are the most likely source of bugs across the epic boundary — keep the response shapes and field names in lockstep with `TodoApiSchema` (already verified by the existing `TodoApiSchema = z.object({ id, description, completed, createdAt: string, userId })` in `lib/validation.ts`).

### Out of scope for this story

- `apiClient.toggleTodo()` in `lib/api-client.ts` — **Story 2.2**.
- `hooks/use-toggle-todo.ts` (optimistic mutation) — **Story 2.2**.
- `components/TaskItem.tsx` becoming an interactive checkbox button — **Story 2.2**.
- `app/api/todos/[id]/route.ts` `DELETE` handler — **Story 3.1**.
- `db/queries.ts::deleteTodo` — **Story 3.1**.
- `IdParamSchema` extracted to `lib/validation.ts` — defer until 3.1 needs it (see "Validation" Dev Note above).
- Rate limiting, ETags, OpenAPI emission — deferred per architecture (lines 305, 307).

### Project Structure Notes

- `app/api/todos/[id]/` is created fresh by this story. `app/api/todos/_lib/` is also new.
- No `tailwind.config.ts` (project uses Tailwind 4 CSS-first config; AGENTS.md "Deviations from the architecture document"). Not relevant to this server-only story but flagged for completeness.
- The architecture document (lines 723–725) describes the directory shape this story produces — verification mental-checklist, not a directive to add files outside the AC.

### References

- Story acceptance criteria source: [`_bmad-output/planning-artifacts/epics.md` §"Story 2.1"](../planning-artifacts/epics.md#story-21-build-patchapitodosid-route-handler-for-completion-state-updates) (lines 412–443)
- Endpoint contract & idempotency: [`_bmad-output/planning-artifacts/architecture.md` §"API & Communication Patterns"](../planning-artifacts/architecture.md#api--communication-patterns) (lines 273–308, esp. line 290 for the PATCH row and line 296 for natural idempotency)
- Format patterns (response envelopes, JSON field naming, dates, errors): [`_bmad-output/planning-artifacts/architecture.md` §"Format Patterns"](../planning-artifacts/architecture.md#format-patterns) (lines 503–519)
- Process patterns (error handling, validation timing): [`_bmad-output/planning-artifacts/architecture.md` §"Process Patterns"](../planning-artifacts/architecture.md#process-patterns) (lines 545–569)
- Pattern examples (Route Handler skeleton): [`_bmad-output/planning-artifacts/architecture.md` §"Pattern Examples"](../planning-artifacts/architecture.md#pattern-examples) (lines 590–648)
- Architectural boundaries (API + Data + import graph): [`_bmad-output/planning-artifacts/architecture.md` §"Architectural Boundaries"](../planning-artifacts/architecture.md#architectural-boundaries) (lines 796–851)
- Story 1.3 implementation record (response helpers, Zod usage, test scaffolding): [`1-3-api-todos-routes-validation.md`](./1-3-api-todos-routes-validation.md)
- Story 1.5 implementation record (last shipped story; for `OptimisticTodo` and the client-side mutation pattern that 2.2 will mirror): [`1-5-capture-todos-task-input.md`](./1-5-capture-todos-task-input.md)
- Project conventions summary (naming, import graph, no-modals, DB rules): [`AGENTS.md`](../../AGENTS.md)
- Next.js 16 Route Handlers (RouteContext + async params): `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (lines 187–198)
- Story dependency graph (2.1 unblocks 2.2; 3.1 reuses the `[id]/route.ts` directory): [`_bmad-output/planning-artifacts/story-dependency-graph.md`](../planning-artifacts/story-dependency-graph.md)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Opus 4.7, 1M context)

### Debug Log References

- `pnpm test db/queries.test.ts` — 10/10 green (6 prior + 4 new for `updateTodo`).
- `pnpm test app/api/todos/route.test.ts` — 15/15 green after the helper extract; no test edits needed.
- `pnpm test app/api/todos/[id]/route.test.ts` — 10/10 green (PATCH happy paths, idempotency, 404, 400×5, 500).
- `pnpm typecheck` — initially failed: `RouteContext<'/api/todos/[id]'>` global type was not yet generated for the new dynamic route. Fixed by running `pnpm exec next typegen` (Next.js 16 generates `RouteContext` types from the route tree on dev/build/typegen).
- `pnpm lint` — clean.
- `pnpm test` (full suite) — 78/78 green across 10 files.
- `pnpm build` — `drizzle-kit migrate` no-op, `next build` 1.5s. Route table shows `/api/todos/[id]` correctly classified as `ƒ` (Dynamic).

### Completion Notes List

**Done — all six tasks complete; all five ACs satisfied.**

**Implementation followed the story spec exactly.** No deviations from the recommended shapes:

- `db/queries.ts::updateTodo(id, patch, userId)` — Drizzle's `update().set().where(and(eq, userIdFilter)).returning()` chain, returns `Todo | null`. Reuses the existing `userIdFilter` helper from Story 1.3.
- `app/api/todos/_lib/responses.ts` — three thin wrappers: `validationFailed`, `notFound`, `internalError`. Underscore-prefixed directory keeps it out of Next.js's route tree.
- `app/api/todos/route.ts` — refactored to import from `./_lib/responses`; existing 15 tests stayed green with zero edits, confirming the extract was behaviorally identical.
- `app/api/todos/[id]/route.ts` — `PATCH(req, ctx: RouteContext<'/api/todos/[id]'>)`. Awaits `ctx.params`, validates the `id` UUID, parses JSON inside an inner try/catch, validates the body via `TodoUpdateSchema`, calls `updateTodo(id, ..., null)`, then 200/404 split on the helper's return value. Outer try/catch maps any throw to `500 internal_error`.

**Footgun encountered: Next.js 16 type generation.** When a new dynamic route directory is added (`app/api/todos/[id]/`), the global `RouteContext<'/api/todos/[id]'>` type is not in `.next/types/` until `next dev`, `next build`, or `next typegen` runs. The story spec called this out explicitly — confirmed in practice. `pnpm exec next typegen` is the fast fix; running `pnpm build` would also work but takes longer.

**No edits to `lib/validation.ts`.** As the spec instructed: `TodoUpdateSchema` was pre-shipped by Story 1.3 specifically for this story.

**No new dependencies.** `package.json` and `pnpm-lock.yaml` are unchanged.

**Notes for Story 2.2 (next in chain):**

- The PATCH endpoint returns `200 { todo: Todo }` on success. The `todo` shape matches `TodoApiSchema` (already in `lib/validation.ts` since Story 1.4): `{ id, description, completed, createdAt: string, userId }`. Story 2.2's `apiClient.toggleTodo` should parse this with `z.object({ todo: TodoApiSchema })`.
- 404/400/500 errors return `{ code, message }` — Story 2.2's `useToggleTodo` `onError` should restore the snapshot on **any** non-2xx (don't try to differentiate 404 from 500 in v1; the UX policy is a single fixed error message).
- The PATCH endpoint is fully idempotent — Story 2.2 can rely on this. A retry of the same `{ completed }` payload returns the same row.
- Shared response helpers in `app/api/todos/_lib/responses.ts` are now ready for Story 3.1's DELETE handler to reuse (`notFound` + `internalError`).

**Notes for Story 3.1 (DELETE handler):**

- The `[id]/route.ts` file already exists. Story 3.1 should add `export async function DELETE(req, ctx: RouteContext<'/api/todos/[id]'>)` to that **same file** (Next.js convention: all method handlers for a route in one `route.ts`).
- The `IdSchema = z.string().uuid()` constant in this file is local to the PATCH handler. Story 3.1 should either reuse it (keep it as a top-level export in this file) or extract it. Either approach is fine.
- If Story 3.1 also needs UUID validation on the `id` route param, consider extracting `IdSchema` to `lib/validation.ts` as `IdParamSchema` at that point. For v1 with a single PATCH handler, inline-and-DRY-later was the right call.

**Vercel verification still pending.** Local build + tests pass. Push the branch; Vercel will run the same `drizzle-kit migrate && next build` against an ephemeral Neon preview branch.

### File List

**New files:**
- `app/api/todos/_lib/responses.ts` (shared `validationFailed`, `notFound`, `internalError`)
- `app/api/todos/[id]/route.ts` (PATCH handler)
- `app/api/todos/[id]/route.test.ts` (10 integration tests)
- `_bmad-output/implementation-artifacts/2-1-api-todos-id-patch-handler.md` (this story spec)

**Modified files:**
- `db/queries.ts` (added `updateTodo(id, patch, userId)`)
- `db/queries.test.ts` (added 4 tests for `updateTodo`)
- `app/api/todos/route.ts` (refactored: imports helpers from `./_lib/responses` instead of defining them locally)

### Review Findings

- [x] [Review][Defer] `validationFailed` sends raw Zod `.message` (JSON blob of all issues) [app/api/todos/[id]/route.ts] — deferred, pre-existing pattern from `route.ts`; consistent across routes
- [x] [Review][Defer] `_lib/responses.ts` scoped under `todos/`, not reusable across other API resources — deferred, explicit v1 design decision; DRY-later when a second resource is added
- [x] [Review][Defer] 404 returned instead of 403 when `userId` mismatches after auth is wired — deferred, intentional per spec to avoid leaking resource existence
- [x] [Review][Defer] `completed` field required (not optional) in PATCH body; full partial-update semantics unsupported — deferred, intentional per story spec and `TodoUpdateSchema`; revisit when description editing lands

## Change Log

| Date       | Change                        |
| ---------- | ----------------------------- |
| 2026-04-29 | Story 2.1 spec created        |
| 2026-04-29 | Implementation complete: `db/queries.ts::updateTodo`, `app/api/todos/_lib/responses.ts`, `app/api/todos/[id]/route.ts` PATCH handler, 14 new tests (4 query + 10 route). 78/78 tests green. |
