# Story 3.1: Build idempotent `DELETE /api/todos/[id]` Route Handler

Status: done

## Story

As a client,
I want a DELETE endpoint that removes a todo by id and treats already-deleted as success,
So that delete retries are safe even when the network is flaky and the server has already processed a previous request.

## Acceptance Criteria

1. **`deleteTodo(id: string, userId: string | null)` is added to `db/queries.ts`.**
   - Executes a parameterized Drizzle DELETE: `WHERE id = $1 AND (userId IS NULL)` using the existing `userIdFilter` helper.
   - Returns the number of rows deleted (`0` or `1`) — use `.returning()` and return `result.length`.
   - Never throws when no rows match — return `0` instead.

2. **`DELETE` handler is added to `app/api/todos/[id]/route.ts`.**
   - Validates `id` param with `IdSchema` (already defined in that file); returns `400` on failure.
   - Calls `deleteTodo(id, null)` — ignores the row count (both `0` and `1` are success).
   - Returns `204` with no response body (`new Response(null, { status: 204 })`).
   - Wraps everything in the same try/catch pattern as `PATCH`: `console.error(err)` + `internalError()` on any exception.

3. **Idempotency: repeated DELETE returns `204` regardless of whether the row exists.**
   - No `404` for "already deleted" — this is intentional (FR16 + architecture §"API Contracts").

4. **`app/api/todos/[id]/route.test.ts` is extended** with a `describe("DELETE /api/todos/[id]", ...)` block covering:
   - DELETE removes a row and returns `204`.
   - DELETE on an already-deleted `id` returns `204` (idempotency).
   - Malformed `id` (non-UUID) returns `400 { code: "validation_failed" }`.
   - DB layer throws → returns `500 { code: "internal_error", message: "Something went wrong" }`.

5. **All quality gates pass:**
   - `pnpm lint` clean.
   - `pnpm typecheck` clean.
   - `pnpm test` — all existing tests green plus ~4 new DELETE tests.
   - `pnpm build` clean.
   - **No changes** to `components/**`, `hooks/**`, `lib/**`, `app/page.tsx`, `db/schema.ts`, or any E2E spec.

## Tasks / Subtasks

- [x] **Task 1: Add `deleteTodo` to `db/queries.ts` (AC: #1)**
  - [x] Use `userIdFilter` (already defined at top of file) for the WHERE clause
  - [x] Use Drizzle's `.delete(todos).where(...).returning()` — return `result.length`
  - [x] Confirm `pnpm typecheck` still passes

- [x] **Task 2: Add `DELETE` handler to `app/api/todos/[id]/route.ts` (AC: #2, #3)**
  - [x] Import `deleteTodo` from `@/db/queries`
  - [x] Reuse existing `IdSchema` and `internalError` / `validationFailed` — do NOT redefine them
  - [x] Return `new Response(null, { status: 204 })` — not `Response.json(...)` (no body on 204)
  - [x] Confirm `pnpm typecheck` passes

- [x] **Task 3: Extend `app/api/todos/[id]/route.test.ts` (AC: #4)**
  - [x] Add `DELETE` helper mirroring the existing `patch` helper
  - [x] Import the new `DELETE` export alongside `PATCH`
  - [x] Add 4 test cases in a new `describe("DELETE /api/todos/[id]", ...)` block
  - [x] Confirm all existing PATCH tests still pass

- [x] **Task 4: Verify all gates (AC: #5)**
  - [x] `pnpm lint` — clean
  - [x] `pnpm typecheck` — clean
  - [x] `pnpm test` — all tests green (99/99: 95 existing + 4 new DELETE)
  - [x] `pnpm build` — clean

## Dev Notes

### Exact files to touch — nothing else

```
db/queries.ts                           # ADD deleteTodo
app/api/todos/[id]/route.ts             # ADD DELETE handler
app/api/todos/[id]/route.test.ts        # ADD DELETE describe block
```

No other file changes. Do NOT touch `db/schema.ts`, `lib/api-client.ts`, `lib/validation.ts`, `components/**`, or `hooks/**`.

### `deleteTodo` — recommended implementation

```ts
// db/queries.ts — add after updateTodo
export async function deleteTodo(id: string, userId: string | null): Promise<number> {
  const result = await db
    .delete(todos)
    .where(and(eq(todos.id, id), userIdFilter(userId)))
    .returning();
  return result.length;
}
```

- `userIdFilter` is already defined at the top of `db/queries.ts` — reuse it, don't duplicate the `isNull`/`eq` logic.
- `.returning()` gives back the deleted rows array; `.length` is `0` or `1`.
- No try/catch here — the route handler owns error handling.

### `DELETE` handler — recommended implementation

```ts
// app/api/todos/[id]/route.ts — add after PATCH
import { deleteTodo } from "@/db/queries";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/todos/[id]">) {
  try {
    const { id } = await ctx.params;
    if (!IdSchema.safeParse(id).success) {
      return validationFailed("id route param must be a UUID");
    }
    await deleteTodo(id, null);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error(err);
    return internalError();
  }
}
```

- `IdSchema` is already defined in this file — do NOT redefine it.
- `validationFailed` and `internalError` are already imported from `../_lib/responses` — reuse them.
- `204 No Content` must have no body — use `new Response(null, { status: 204 })`, NOT `Response.json(...)`.
- `deleteTodo` returns a row count; ignore it — both `0` (already deleted) and `1` (just deleted) are success.

### Test helper pattern — mirror existing `patch` helper

```ts
// app/api/todos/[id]/route.test.ts additions

import { DELETE } from "./route"; // add alongside existing PATCH import

const del = (id: string) =>
  DELETE(
    new Request(`http://localhost/api/todos/${id}`, { method: "DELETE" }),
    { params: Promise.resolve({ id }) } as never,
  );

describe("DELETE /api/todos/[id]", () => {
  it("removes a row and returns 204", async () => {
    const id = uuid();
    await queries.createTodo({ id, description: "to delete" }, null);
    const res = await del(id);
    expect(res.status).toBe(204);
  });

  it("returns 204 for an already-deleted id (idempotent)", async () => {
    const id = uuid();
    await queries.createTodo({ id, description: "to delete" }, null);
    await del(id); // first delete
    const res = await del(id); // second delete — must still be 204
    expect(res.status).toBe(204);
  });

  it("returns 400 validation_failed for a malformed id", async () => {
    const deleteSpy = vi.spyOn(queries, "deleteTodo");
    const res = await del("not-a-uuid");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("validation_failed");
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("returns 500 internal_error when the DB layer throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(queries, "deleteTodo").mockRejectedValueOnce(new Error("boom"));
    const res = await del(uuid());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ code: "internal_error", message: "Something went wrong" });
    expect(errorSpy).toHaveBeenCalled();
  });
});
```

### Key constraints and forbidden patterns

- **No `404` for DELETE** — "already deleted" returns `204`. This differs from `PATCH` (which returns `404` when the row doesn't exist). The architecture is explicit: "DELETE returns `204` on repeated calls even if the row is gone." [Architecture §"API Contracts", line 297]
- **No body on `204`** — `Response.json(null, { status: 204 })` would emit `Content-Type: application/json` with a null body; use `new Response(null, { status: 204 })` to produce a clean no-body response.
- **No new imports in tests** — the test file already imports `db`, `queries`, `PATCH`, and Vitest helpers. Just add `DELETE` to the import line and the `del` helper.
- **No schema changes** — `db/schema.ts` is NOT touched; `deleteTodo` is a query, not a schema change.
- **`userId: null` only** — v1 always passes `null`. Do not omit the parameter (forward-compat rule from architecture).

### Architecture alignment

| Concern | What to follow |
|---|---|
| Import graph | `app/api/[id]/route.ts` → `db/queries.ts` → `db/client.ts`. The handler imports from `@/db/queries` only. |
| Error shape | `{ code, message }` via `internalError()` / `validationFailed()` from `../_lib/responses`. Consistent with PATCH. |
| Test environment | `// @vitest-environment node` already at top of test file. DB truncated in `beforeEach`. Do not change test setup. |
| No raw SQL | Drizzle expression API only. The only allowed `sql\`...\`` is for DDL in tests — `TRUNCATE TABLE todos` already there. |

### Previous story learnings (Stories 2.x)

- The `PATCH` handler in `route.ts` and its tests are the exact template. Match its structure: `IdSchema` validation → query call → return, same try/catch shape, same `internalError()` import.
- The test file uses `vi.spyOn(queries, ...)` to mock DB calls for the 500 case — do the same for DELETE.
- `afterAll` closes the DB pool — this is already in the test file; do NOT add another one.
- `pnpm test` runs against the real DB (`.env.local` `DATABASE_URL`). `beforeEach` truncates `todos` — all tests start from a clean slate.

### Project context

Story 3.1 is the API foundation for Epic 3 (Delete with Undo). It is deliberately narrow: server-side only. No UI, no hooks, no client changes. Stories 3.2 and 3.3 build the UI layer on top of this endpoint. The `apiClient.deleteTodo(id)` call in Story 3.2 will hit this endpoint; Story 3.1 just needs to exist and be correct.

### References

- Story requirements: [`_bmad-output/planning-artifacts/epics.md` §"Story 3.1"](../planning-artifacts/epics.md) (lines 539–572)
- DELETE idempotency rule: [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md) (line 297)
- API contracts table: [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md) (line 291)
- Existing PATCH handler (template): [`app/api/todos/[id]/route.ts`](../../app/api/todos/%5Bid%5D/route.ts)
- Existing route tests (template): [`app/api/todos/[id]/route.test.ts`](../../app/api/todos/%5Bid%5D/route.test.ts)
- Query helpers (template): [`db/queries.ts`](../../db/queries.ts)
- Responses helper: [`app/api/todos/_lib/responses.ts`](../../app/api/todos/_lib/responses.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `pnpm typecheck` — clean after each task.
- `pnpm lint` — clean.
- `pnpm test` — 99/99 green initially (95 prior + 4 new DELETE tests); 103/103 green after addressing review findings (+3 query-layer `deleteTodo` tests + 1 route isolation test).
- `pnpm build` — clean; migrations applied, Next.js compiled successfully.

### Completion Notes List

- `db/queries.ts`: added `deleteTodo(id, userId)` using existing `userIdFilter` + Drizzle `.delete().where().returning()`. Returns `result.length` (0 or 1); never throws on missing row.
- `app/api/todos/[id]/route.ts`: added `DELETE` handler reusing existing `IdSchema`, `validationFailed`, `internalError`. Returns `new Response(null, { status: 204 })` — no body. Row count ignored for idempotency.
- `app/api/todos/[id]/route.test.ts`: added `del` helper + 4-test `describe("DELETE /api/todos/[id]")` block covering: 204 on delete, 204 on re-delete (idempotency), 400 on bad UUID, 500 on DB throw.

### File List

- `db/queries.ts` — added `deleteTodo`; projects `{ id: todos.id }` in `.returning()` to avoid materializing full rows.
- `db/queries.test.ts` — added 3 `deleteTodo` tests (removes-and-returns-1, returns-0-on-miss, only-deletes-targeted-row).
- `app/api/todos/[id]/route.ts` — added `DELETE` handler.
- `app/api/todos/[id]/route.test.ts` — extended with DELETE describe block (4 initial tests + 1 isolation test, plus body/header assertions on the 204 path).
- `_bmad-output/implementation-artifacts/3-1-delete-api-route-handler.md` — this story spec.
- `_bmad-output/implementation-artifacts/deferred-work.md` — appended 6 deferred items from the code review.

### Review Findings

- [x] [Review][Patch] **F1 (Major): `db/queries.test.ts` has zero coverage for `deleteTodo`** [`db/queries.test.ts`] — Every other query helper (`createTodo`, `getTodos`, `getTodoById`, `updateTodo`) has direct DB-layer tests; the architecture mandates this pattern (Test-DB strategy). `deleteTodo` ships untested at the query layer. Fix: add three tests mirroring `updateTodo` coverage — `deleteTodo` returns `1` and removes the row; returns `0` for a never-existed id; only deletes the targeted row when two rows are seeded.
- [x] [Review][Patch] **F2 (Major): "removes a row and returns 204" test does not assert the row is actually gone** [`app/api/todos/[id]/route.test.ts:158-163`] — A regression that replaces `deleteTodo` with a no-op or soft-delete would still pass this test. Fix: after `del(id)`, assert `expect(await queries.getTodoById(id, null)).toBeNull()`.
- [x] [Review][Patch] **F3 (Major): No route test pinning that DELETE only removes the targeted row** [`app/api/todos/[id]/route.test.ts`] — A `WHERE` clause regression that drops `eq(todos.id, id)` (since v1's `userIdFilter(null)` matches every row) would pass current tests by deleting all rows. Fix: add a test that seeds two rows, deletes one, asserts the other survives — same shape as `db/queries.test.ts:123` `updateTodo only mutates the targeted row`.
- [x] [Review][Patch] **F4 (Minor): `.returning()` materializes full row payloads when only a count is needed** [`db/queries.ts:35-39`] — `deleteTodo` runs `.delete().where().returning()` and reads `.length`. The full row data is fetched and discarded. Fix: `.returning({ id: todos.id })` to project a single column.
- [x] [Review][Patch] **F5 (Minor): 204 response contract is not pinned by tests** [`app/api/todos/[id]/route.test.ts:158-191`] — `new Response(null, { status: 204 })` is correct, but no test asserts the body is empty or that no `Content-Type`/`Content-Length` headers leak. A future refactor through `Response.json(...)` would silently violate RFC 9110 §15.3.5. Fix: in the 204 tests, add `expect(await res.text()).toBe("")` and `expect(res.headers.get("content-type")).toBeNull()`.
- [x] [Review][Defer] **F6 (Major): User-isolation differentiation when auth lands** [`app/api/todos/[id]/route.ts:45`] — deferred, forward-compat. When `userId` becomes non-null, `deleteTodo` returning `0` for "owned by another user" still answers `204` — indistinguishable from a real delete; future contributors must decide whether to surface `404` for cross-user attempts when auth is wired. v1 always passes `null`, so the call site is benign today.
- [x] [Review][Defer] **F7 (Major): Concurrent DELETE under row lock can surface as 500 instead of 204** [`app/api/todos/[id]/route.ts:47-50`] — deferred, pre-existing. Pattern is shared with PATCH/POST; the `internalError()` catch maps deadlock victim (SQLSTATE `40001`/`40P01`/`55P03`) to a generic 500. Cross-handler concern, not introduced here.
- [x] [Review][Defer] **F8 (Major): Future foreign keys without `ON DELETE CASCADE` will turn DELETE into a 500** [`db/queries.ts:34-40`] — deferred, no FKs reference `todos` today. When a future epic adds a child table (drafts, audit, subtasks), Postgres SQLSTATE `23503` will surface as `500 internal_error`. Address when the first FK is introduced.
- [x] [Review][Defer] **F9 (Major): `internalError()` discards DB error context** [`app/api/todos/[id]/route.ts:47-50`] — deferred, pre-existing pattern shared with PATCH/POST/GET. `console.error(err)` logs the raw error but the response body has no diagnostic. Cross-handler concern; needs structured-logging epic, not a per-story patch.
- [x] [Review][Defer] **F10 (Minor): No explicit test for valid-but-nonexistent UUID** [`app/api/todos/[id]/route.test.ts`] — deferred, covered indirectly by the "already-deleted id (idempotent)" test, which exercises the same "0 rows affected → 204" code path. A dedicated test is low marginal value today.
- [x] [Review][Defer] **F11 (Minor): Edge inputs not pinned (null byte in id, params Promise rejection)** [`app/api/todos/[id]/route.ts:41`] — deferred. `IdSchema = z.string().uuid()` rejects `\0`-bearing strings before the query layer; `ctx.params` rejection is theoretical and would still produce a 500 (correct status, slightly misleading message). Both pre-existing patterns shared with PATCH.

## Change Log

| Date       | Change                        |
| ---------- | ----------------------------- |
| 2026-04-29 | Story 3.1 spec created        |
| 2026-04-29 | Implementation complete: `deleteTodo` query helper + idempotent `DELETE /api/todos/[id]` route handler. 99/99 unit/integration tests green. |
| 2026-04-29 | Code review applied: 5 patches (db-layer `deleteTodo` coverage, behavioral row-gone assertion, isolation test, `.returning()` projection, 204 body/header pinning). 6 deferred items recorded in `deferred-work.md`. 103/103 tests green. |
