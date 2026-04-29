# Deferred Work

## Deferred from: code review of 1-3-api-todos-routes-validation (2026-04-28)

- No request body size limit or stream timeout on `req.json()` in `app/api/todos/route.ts` — a slow/large payload could cause the handler to hang or OOM. Mitigated by reverse proxy in production (Vercel). Revisit if the endpoint is exposed to untrusted clients without a gateway.

## Deferred from: code review of 1-5-capture-todos-task-input (2026-04-29)

- `onError` rollback in `useCreateTodo` writes back the snapshot taken in its own `onMutate` — if a second mutation begins between the first's `onMutate` and `onError`, the rollback will clobber the second's optimistic entry. Requires per-id removal pattern instead of blanket snapshot restore.
- Server's id-collision path returns the existing row (via `onConflictDoNothing`) — `useCreateTodo.onSuccess` then replaces the optimistic row with the existing description, silently overwriting the user's typed text. Vanishingly improbable with `crypto.randomUUID`, but a real contract gap.
- `value.slice(0, 280)` in `TaskInput` operates on UTF-16 code units; pasting 280+ chars of emoji/CJK can cut mid-surrogate and yield a malformed string. Low impact for v1 English/Italian users.
- Fixed-position bottom input on iOS Safari may sit behind the virtual keyboard. Needs `visualViewport` listener or `interactive-widget=resizes-content` viewport meta to verify behavior across iOS versions.
- `aria-describedby="empty-state-hint"` on the input dangles when the list is non-empty (EmptyState is unmounted). Screen readers ignore gracefully but jsx-a11y / axe-core will flag it.
- `crypto.randomUUID()` is undefined in non-secure contexts (HTTP) and older Safari (<15.4). Production is HTTPS on Vercel; revisit if app is ever served over HTTP on a LAN.
- `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` in `TaskInput.tsx` hardcodes a `rem` literal instead of `var(--space-3)`. AGENTS.md token discipline. Also: the spec itself is inconsistent (AC #1 says `--space-4`, Task 5 says `--space-3`) — needs a spec clarification before patching.
- `apiClient.createTodo` error path (4xx/5xx → `ApiError`) is not exercised by `useCreateTodo` tests. Test gap, not a bug.
