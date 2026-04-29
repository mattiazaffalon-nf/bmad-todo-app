# Deferred Work

## Scope decision (2026-04-29): Desktop-only

This is a hobby project. Mobile browser support is explicitly out of scope for v1.

**Impact on Epic 4 stories:**
- Drop all mobile-specific ACs (swipe gestures, touch hit-target sizing beyond what's already in place, iOS/Android-specific workarounds)
- Drop real-device testing from Story 4.4 QA pass — desktop Chrome/Firefox/Safari only
- Drop mobile sub-journeys from Playwright E2E specs
- Keep `prefers-reduced-motion`, keyboard a11y, and color-blindness simulation — these are desktop-relevant

Story 3.3 was implemented with the mobile swipe-left affordance already included; it is intentionally left as-is (harmless on desktop, useful if mobile is revisited).

## Deferred from: code review of 1-3-api-todos-routes-validation (2026-04-28)

- No request body size limit or stream timeout on `req.json()` in `app/api/todos/route.ts` — a slow/large payload could cause the handler to hang or OOM. Mitigated by reverse proxy in production (Vercel). Revisit if the endpoint is exposed to untrusted clients without a gateway.

## Deferred from: code review of 1-5-capture-todos-task-input (2026-04-29)

- `onError` rollback in `useCreateTodo` writes back the snapshot taken in its own `onMutate` — if a second mutation begins between the first's `onMutate` and `onError`, the rollback will clobber the second's optimistic entry. Requires per-id removal pattern instead of blanket snapshot restore.
- Server's id-collision path returns the existing row (via `onConflictDoNothing`) — `useCreateTodo.onSuccess` then replaces the optimistic row with the existing description, silently overwriting the user's typed text. Vanishingly improbable with `crypto.randomUUID`, but a real contract gap.

## Deferred from: code review of 2-1-api-todos-id-patch-handler (2026-04-29)

- `validationFailed` sends raw Zod `.message` (JSON-serialised array of all issues) — not human-readable. Pre-existing pattern across all routes; clean up when adding an API error format standard.
- `_lib/responses.ts` scoped under `app/api/todos/` — not reusable by future non-todos routes without moving or duplicating. Revisit when a second top-level resource is added.
- 404 returned (not 403) when `userId` mismatches after auth is wired in — intentional per spec to avoid leaking resource existence; document the decision in the auth epic.
- PATCH body requires `completed` (not optional) — full partial-update semantics unsupported. Revisit when description editing is added (likely a separate `updateTodoDescription` helper).
- `value.slice(0, 280)` in `TaskInput` operates on UTF-16 code units; pasting 280+ chars of emoji/CJK can cut mid-surrogate and yield a malformed string. Low impact for v1 English/Italian users.
- Fixed-position bottom input on iOS Safari may sit behind the virtual keyboard. Needs `visualViewport` listener or `interactive-widget=resizes-content` viewport meta to verify behavior across iOS versions.
- `aria-describedby="empty-state-hint"` on the input dangles when the list is non-empty (EmptyState is unmounted). Screen readers ignore gracefully but jsx-a11y / axe-core will flag it.
- `crypto.randomUUID()` is undefined in non-secure contexts (HTTP) and older Safari (<15.4). Production is HTTPS on Vercel; revisit if app is ever served over HTTP on a LAN.
- `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` in `TaskInput.tsx` hardcodes a `rem` literal instead of `var(--space-3)`. AGENTS.md token discipline. Also: the spec itself is inconsistent (AC #1 says `--space-4`, Task 5 says `--space-3`) — needs a spec clarification before patching.
- `apiClient.createTodo` error path (4xx/5xx → `ApiError`) is not exercised by `useCreateTodo` tests. Test gap, not a bug.

## Deferred from: code review of 2-2-toggle-completion-optimistic (2026-04-29)

- `useToggleTodo` snapshot/restore concurrency: parallel toggles or rapid double-clicks can clobber peer optimistic state. Same root cause as the `useCreateTodo` deferred item; spec mandates "mirror useCreateTodo" structure. Per-id update + per-id rollback would fix both hooks.
- `apiClient.toggleTodo` error path (non-2xx → `ApiError`) is not exercised by `useToggleTodo` tests. Test gap, mirrors `createTodo`.
- Generic `HTTP ${status}` error message in `toggleTodo`/`createTodo`/`fetchJson` discards server-supplied detail (`{ code, message }` from API). Revisit when adding an API error format standard.
- No `AbortSignal` plumbed into `fetch` for any apiClient method. Mutations on unmounted components keep running.
- `syncStatus: 'pending'` is written to the cache by `useToggleTodo`/`useCreateTodo` but never visually surfaced (no spinner, no `aria-busy`, no opacity hint). Story 4.1 covers failed-state visualization; pending visualization is unspec'd.
- `<button aria-pressed>` inside `<li role="listitem">` ARIA-tree behavior unverified by axe-core. Revisit in Story 4.3 (axe CI).
- Focus-ring on `rounded-full` button uses `outline-2 outline-offset-2 outline-accent` — Safari ≤16 may render as a square frame. Verify in Story 4.3 cross-browser a11y.
- `components/TaskList.test.tsx` mocks `useToggleTodo` with an inline `() => ({ mutate: vi.fn() })` factory instead of a hoisted `mockMutate`. Test-reliability nitpick; future tests cannot observe the spy.
- No integration test for clicking the checkbox through `<TaskList>` (only isolated `<TaskItem>` and hook-level coverage). Story 2.3's Playwright E2E will cover end-to-end.
- No disabled-while-pending state on the checkbox button — optimistic-update pattern intentionally doesn't disable, but worth documenting if accessibility reviewers question rapid-click UX.

## Deferred from: code review of 2-3-mobile-swipe-right-complete (2026-04-29)

- E2E swipe test uses `page.evaluate` synthetic touch events instead of `page.touchscreen` (AC#7 specifies the latter). WebKit blocks `new TouchEvent(...)` ("Illegal constructor") and `page.touchscreen` only exposes `tap()`. The workaround is documented in the spec file; tests are green. Revisit if Playwright adds a native swipe API for WebKit.
- Swipe-right on an already-completed task un-completes it (bidirectional toggle, same as tap). Story 3.x may add directional-intent semantics (swipe-right = complete only, swipe-left = delete). Product decision.

## Deferred from: code review of 3-1-delete-api-route-handler (2026-04-29)

- User-isolation differentiation in `DELETE /api/todos/[id]`: when auth lands and `userId` becomes non-null, `deleteTodo` returning `0` for "row owned by another user" still answers `204` — indistinguishable from a real delete. Decide whether to surface `404` for cross-user attempts when wiring auth, or accept the existence-leak avoidance.
- DB lock contention surfaces as `500 internal_error` instead of `204` when DELETE races a concurrent UPDATE/DELETE on the same row (deadlock victim, SQLSTATE `40001`/`40P01`/`55P03`). Pre-existing pattern shared with PATCH/POST. Address with a structured DB-error-mapping epic.
- Future foreign-key references to `todos.id` without `ON DELETE CASCADE`/`SET NULL` will turn DELETE into a `500` (Postgres SQLSTATE `23503`). No FKs today; address when the first child table is introduced (e.g., subtasks, audit, drafts).
- `internalError()` discards DB error context (no structured logging beyond `console.error(err)`). Pre-existing pattern across all route handlers; needs a logging-standardization epic.
- No explicit test for "valid UUID that never existed" — covered indirectly by the "already-deleted (idempotent)" test which exercises the same `0 rows affected → 204` code path. Add a dedicated test if a future refactor splits the two paths.
- Edge-input pinning (null-byte in id, `ctx.params` Promise rejection) — `IdSchema = z.string().uuid()` rejects `\0` strings before the query layer; `ctx.params` rejection is theoretical. Both pre-existing patterns shared with PATCH.

## Deferred from: code review of 3-2-deferred-delete-undo-toast (2026-04-29)

- `queueMicrotask` for post-delete focus may fire before React commits the optimistic-remove render. Spec dev notes recommend `queueMicrotask`; implementation matches and tests pass. If focus regressions surface in Story 3.3's delete-undo Playwright spec, switch to `requestAnimationFrame` or `flushSync`.
- No `AbortController` / fetch timeout on any api-client method (only `deleteTodo` is touched in this story; the gap is repo-wide). A hung DELETE blocks indefinitely with no UX. Track as api-client hardening epic.
- Tab-close mid-DELETE drops the request — known v1 limitation per `architecture.md` line 1108. `navigator.sendBeacon` or `fetch({ keepalive: true })` is the eventual fix.
- Test hardening for the deferred-delete pattern: (a) add a test that unmounts the hook mid-window and asserts no timer fires; (b) cross-fade test should assert cache integrity between the two deletions, not just DELETE call counts; (c) `UndoToast` Escape test should originate from a focused `<input>` to verify the input-guard once it lands.

## Deferred from: code review of 3-3-delete-affordances-e2e (2026-04-29)

- SSR/hydration mismatch: `useMediaQuery("(prefers-reduced-motion: reduce)")` returns `false` on the server; users with the reduced-motion preference may briefly see the 300ms swipe-left exit animation between first paint and hydration. Pre-existing pattern (the same hook backs swipe-right since Story 2.3). Revisit when the project adopts a `data-reduce-motion` SSR cookie or hydration-stable media-query strategy.
- Diagonal swipe with dominant `deltaY` and small `deltaX` causes `dragX` jitter during vertical scroll. `react-swipeable` fires `onSwiping` for any direction; the current handler reacts to any non-zero `deltaX`. Pre-existing pattern from swipe-right (Story 2.3). Revisit if vertical-scroll jitter becomes user-visible.
- All e2e specs use hardcoded UUIDs and `cleanupTodos()` in `beforeEach` truncates the entire table. Playwright workers running in parallel would clobber each other's seed data. Pre-existing project pattern across `complete.spec.ts`, `a11y.spec.ts`, and now `delete-undo.spec.ts`. Either pin Playwright to single-worker mode (current default) or scope cleanup by id-prefix when parallelism is enabled.
