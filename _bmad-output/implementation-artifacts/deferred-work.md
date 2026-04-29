# Deferred Work

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
