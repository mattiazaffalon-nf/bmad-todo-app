# Story 3.2: Implement deferred-delete with UndoToast and optimistic removal

Status: done

## Story

As a user,
I want a deleted task to disappear from my list immediately and be recoverable for ~5 seconds via an inline Undo, without any confirmation dialog,
So that I can remove tasks confidently and recover from accidental deletions without ceremony.

## Acceptance Criteria

1. **`lib/constants.ts` is created** exporting `UNDO_TIMEOUT_MS = 5000` and re-exporting `MAX_DESCRIPTION_LENGTH = 280` (currently a magic number in `validation.ts`). All future magic numbers live here.

2. **`lib/api-client.ts` is extended** with `deleteTodo(id: string): Promise<void>` that sends `DELETE /api/todos/${id}`, resolves on `204`, and throws `ApiError` on any other status.

3. **`hooks/use-delete-todo.ts` is created** exporting `useDeleteTodo()`:
   - Returns `{ mutate, undo, pendingId, previousSnapshot }`.
   - `mutate(id)`: cancels queries, snapshots the cache, filters out the todo with `id` (optimistic remove), schedules `setTimeout(UNDO_TIMEOUT_MS)`. When the timer fires, calls `apiClient.deleteTodo(id)`; on failure, re-adds the todo to cache with `syncStatus: 'failed'`. Stores the timer handle in a ref. Stores `id` and the snapshot in state so callers can read them.
   - `undo()`: clears the timer ref, restores the cache to `previousSnapshot`, resets `pendingId` to `null`.
   - One active delete at a time: calling `mutate(id2)` while a timer is in flight does NOT cancel the in-flight timer — see AC#7 (cross-fade behaviour handled at the UI layer).

4. **`components/UndoToast.tsx` is created** with props `{ visible: boolean; onUndo: () => void; onDismiss: () => void }`:
   - Renders a pill-shaped container ~240–320px wide, 44px tall.
   - Label: `"Task deleted"` in `text-foreground-muted`.
   - Button: `"Undo"` with `text-accent-foreground` on a transparent background; keyboard-accessible (Enter/Space triggers).
   - `role="status"` with `aria-live="polite"`.
   - Fade in 200ms `ease-out` when `visible` transitions `false → true`; fade out 200ms `ease-in` on dismiss. Both transitions suppressed by `motion-reduce:transition-none`.
   - Escape key on the document dismisses (calls `onDismiss`, NOT `onUndo`).
   - The component does NOT own a timer; that lives in `TodoListClient`.

5. **`components/TodoListClient.tsx` is extended** to own all delete + toast orchestration:
   - Calls `useDeleteTodo()` at the `TodoListClient` level and passes an `onDelete` callback down to `TaskList` → `TaskItem`.
   - Uses `useReducer` with state `{ status: 'idle' | 'visible' | 'dismissing'; pendingId: string | null; previousSnapshot: OptimisticTodo[] | null }` and actions `SHOW`, `DISMISS`, `UNDO`.
   - On `SHOW`: stores snapshot + pendingId in reducer state, shows `UndoToast`.
   - On `UNDO` (user taps Undo): calls `useDeleteTodo().undo()` which restores the cache, then dispatches `DISMISS`.
   - On auto-dismiss after `UNDO_TIMEOUT_MS`: dispatches `DISMISS`.
   - On `DISMISS`: fades out toast (sets `status: 'dismissing'`), then transitions to `idle` after animation (200ms).
   - Renders `<UndoToast>` anchored above the task list (above `TaskInput` on mobile; effectively above the content area on desktop).
   - At most one toast visible at a time: a new delete while `status !== 'idle'` cross-fades — the previous timer is allowed to complete normally (previous task is permanently deleted), a fresh SHOW is dispatched for the new deletion.

6. **Focus management** (UX-DR16):
   - After `mutate(id)` fires, focus moves to the next `TaskItem` row in DOM order; if the deleted row was the last item, focus moves to the previous row; if the list is now empty, focus moves to the `TaskInput`.
   - Implementation: collect `document.querySelectorAll('[data-task-id]')` before removal, find the index, focus the appropriate target after the optimistic update renders.

7. **`prefers-reduced-motion`** (UX-DR12): `motion-reduce:transition-none` on the UndoToast opacity transitions collapses them to instant state changes.

8. **`hooks/use-delete-todo.test.ts` and `components/UndoToast.test.tsx` are created** covering:
   - `useDeleteTodo`: optimistic remove fires synchronously; timer is scheduled; `undo()` restores cache and clears timer; after timeout fires, `apiClient.deleteTodo` is called; on DELETE failure, todo is re-added with `syncStatus: 'failed'`.
   - `UndoToast`: renders "Task deleted" and "Undo" when `visible=true`; Undo click calls `onUndo`; Escape calls `onDismiss`; invisible when `visible=false`.

9. **All quality gates pass:**
   - `pnpm lint` clean.
   - `pnpm typecheck` clean.
   - `pnpm test` — all 103 existing tests green + new tests.
   - `pnpm build` clean.
   - No changes to `db/**`, `app/api/**`, `db/schema.ts`.

## Tasks / Subtasks

- [x] **Task 1: Create `lib/constants.ts` (AC: #1)**
  - [x] Export `UNDO_TIMEOUT_MS = 5000`
  - [x] Export `MAX_DESCRIPTION_LENGTH = 280`
  - [x] (Do NOT import in `lib/validation.ts` yet — scoped to this story; hook and toast will import from here)
  - [x] Confirm `pnpm typecheck` passes

- [x] **Task 2: Add `deleteTodo` to `lib/api-client.ts` (AC: #2)**
  - [x] Add `deleteTodo(id: string): Promise<void>` to the `apiClient` object
  - [x] `DELETE /api/todos/${id}`, resolve on `204`, throw `ApiError` on anything else
  - [x] Pattern mirrors existing `toggleTodo` but no response body to parse
  - [x] Confirm `pnpm typecheck` passes

- [x] **Task 3: Create `hooks/use-delete-todo.ts` (AC: #3)**
  - [x] Implement `useDeleteTodo()` returning `{ mutate, undo, pendingId, previousSnapshot }`
  - [x] `mutate(id)`: cancel queries → snapshot → filter → setState → schedule timer (fires `apiClient.deleteTodo`; on failure re-adds with `syncStatus: 'failed'`)
  - [x] `undo()`: clearTimeout, restore cache via `setQueryData`, reset state
  - [x] Import `UNDO_TIMEOUT_MS` from `@/lib/constants`
  - [x] `pnpm typecheck` passes

- [x] **Task 4: Write `hooks/use-delete-todo.test.ts` (AC: #8)**
  - [x] Use `vi.useFakeTimers()` to control the 5s delay
  - [x] Mock `apiClient` so no real HTTP in unit tests
  - [x] 5 tests: optimistic remove, undo cancels timer + restores, timer fires DELETE, server error re-adds with failed syncStatus, second `mutate` while first is pending (cross-fade — previous timer still fires)
  - [x] All pass with `pnpm test`

- [x] **Task 5: Create `components/UndoToast.tsx` (AC: #4, #7)**
  - [x] Props: `{ visible: boolean; onUndo: () => void; onDismiss: () => void }`
  - [x] Anatomy: pill container, "Task deleted" label, "Undo" button
  - [x] `role="status"` with `aria-live="polite"`
  - [x] Opacity fade via Tailwind transition classes + `motion-reduce:transition-none`
  - [x] Escape key listener on `document` (add/remove in `useEffect`)
  - [x] No internal timer — driven by props
  - [x] `pnpm typecheck` passes

- [x] **Task 6: Write `components/UndoToast.test.tsx` (AC: #8)**
  - [x] Renders correctly when `visible=true`
  - [x] Does not render content when `visible=false`
  - [x] "Undo" button click calls `onUndo`
  - [x] Escape keydown calls `onDismiss` (not `onUndo`)
  - [x] All pass with `pnpm test`

- [x] **Task 7: Extend `components/TodoListClient.tsx` (AC: #5, #6)**
  - [x] Add `useReducer` for `{ status, pendingId, previousSnapshot }` with `SHOW`/`DISMISS`/`UNDO`/`IDLE` actions
  - [x] Call `useDeleteTodo()` at this level; define `handleDelete(id)` that calls `mutate(id)`, dispatches `SHOW`
  - [x] Set up auto-dismiss `setTimeout` after `UNDO_TIMEOUT_MS` (separate from the DELETE timer in the hook)
  - [x] Handle `UNDO`: call `deleteTodo.undo()`, dispatch `UNDO` → `DISMISS`
  - [x] Handle `DISMISS`: set `status: 'dismissing'`, after 200ms animation dispatch `IDLE`
  - [x] Render `<UndoToast>` above the content (placed before `TaskList` in the JSX)
  - [x] Pass `onDelete={handleDelete}` down to `TaskList` → `TaskItem` via props
  - [x] Focus management after delete (AC: #6)
  - [x] Cross-fade: cancel previous dismiss timer on new delete; fresh SHOW dispatched
  - [x] `pnpm typecheck` and `pnpm lint` pass

- [x] **Task 8: Update `TaskList` and `TaskItem` to accept `onDelete` prop**
  - [x] `TaskList` receives and forwards `onDelete?: (id: string) => void` prop to each `TaskItem`
  - [x] `TaskItem` accepts `onDelete` in its Props interface but does NOT call it yet (Story 3.3 wires the affordances); added `data-task-id` attribute for focus management
  - [x] Added `id="task-input"` to `TaskInput` for focus-after-delete
  - [x] Existing tests in `TaskList.test.tsx` and `TaskItem.test.tsx` still pass (prop is optional)
  - [x] `pnpm typecheck` passes

- [x] **Task 9: Verify all gates (AC: #9)**
  - [x] `pnpm lint` — clean
  - [x] `pnpm typecheck` — clean
  - [x] `pnpm test` — 114/114 green (103 existing + 11 new)
  - [x] `pnpm build` — clean

## Dev Notes

### Architecture: deferred-delete flow

```
TaskItem
  └── calls onDelete(id) [prop from TodoListClient via TaskList]
         │
         ▼
TodoListClient.handleDelete(id)
  ├── useDeleteTodo().mutate(id)   ← optimistic remove from cache; schedules DELETE via setTimeout
  ├── dispatch({ type: 'SHOW', pendingId: id, previousSnapshot })
  └── schedules auto-dismiss setTimeout(UNDO_TIMEOUT_MS)

User taps "Undo" within 5s:
  ├── useDeleteTodo().undo()       ← clearTimeout(deleteTimer); restores cache
  └── dispatch({ type: 'UNDO' })  ← dispatches DISMISS

Timer elapses (no undo):
  ├── DELETE fires via apiClient.deleteTodo(id)
  ├── On success: nothing (row already removed from cache)
  └── On failure: re-adds todo with syncStatus: 'failed'
  Auto-dismiss toast: dispatch({ type: 'DISMISS' })
```

### `lib/constants.ts` — shape

```ts
// lib/constants.ts
export const UNDO_TIMEOUT_MS = 5000;
export const MAX_DESCRIPTION_LENGTH = 280;
```

### `apiClient.deleteTodo` — recommended shape

```ts
// lib/api-client.ts addition
async deleteTodo(id: string): Promise<void> {
  const res = await fetch(`/api/todos/${id}`, { method: "DELETE" });
  if (res.status !== 204) throw new ApiError(res.status, `HTTP ${res.status}`);
},
```

Note: check `res.status === 204` explicitly (not `res.ok`, which is true for 200-299 — but 204 with no body is the expected shape from Story 3.1's DELETE handler).

### `useDeleteTodo` — recommended shape

```ts
// hooks/use-delete-todo.ts
"use client";

import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { OptimisticTodo } from "@/lib/validation";
import { UNDO_TIMEOUT_MS } from "@/lib/constants";

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [previousSnapshot, setPreviousSnapshot] = useState<OptimisticTodo[] | null>(null);

  const mutate = useCallback(
    (id: string) => {
      queryClient.cancelQueries({ queryKey: ["todos"] });
      const previous = queryClient.getQueryData<OptimisticTodo[]>(["todos"]) ?? [];
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.filter((t) => t.id !== id),
      );
      setPendingId(id);
      setPreviousSnapshot(previous);

      timerRef.current = setTimeout(async () => {
        timerRef.current = null;
        try {
          await apiClient.deleteTodo(id);
        } catch {
          // Server failed — restore the specific todo with syncStatus: 'failed'
          queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) => {
            const restoredTodo = previous.find((t) => t.id === id);
            if (!restoredTodo) return old;
            return [...old, { ...restoredTodo, syncStatus: "failed" as const }];
          });
        }
      }, UNDO_TIMEOUT_MS);
    },
    [queryClient],
  );

  const undo = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (previousSnapshot !== null) {
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], previousSnapshot);
    }
    setPendingId(null);
    setPreviousSnapshot(null);
  }, [queryClient, previousSnapshot]);

  return { mutate, undo, pendingId, previousSnapshot };
}
```

Key decisions:
- `cancelQueries` is called but `await`-less here since we don't need to block the optimistic update (it's in a client hook, not an async TanStack `onMutate`). If `cancelQueries` is needed strictly, wrap in an IIFE or use `void`.
- The failure path re-inserts the todo at the end of the list rather than at the original position. Positional restoration with TanStack Query is complex (cache is sorted newest-first by server). Accepted behavior: failed-delete todos reappear at bottom of list for v1. Story 4.1 (ErrorIndicator) handles the failed UX.
- `previousSnapshot` state (not ref) so the `undo` callback has the value visible to React.

### `UndoToast` — recommended shape

```tsx
// components/UndoToast.tsx
"use client";

import { useEffect } from "react";

interface UndoToastProps {
  visible: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export function UndoToast({ visible, onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={[
        "flex items-center justify-between gap-4",
        "min-w-[240px] max-w-[320px] h-11 px-4 rounded-full",
        "bg-surface border border-border-subtle",
        "transition-opacity duration-200 motion-reduce:transition-none",
        visible ? "opacity-100 ease-out" : "opacity-0 ease-in pointer-events-none",
      ].join(" ")}
    >
      <span className="text-sm text-foreground-muted">Task deleted</span>
      <button
        type="button"
        onClick={onUndo}
        className="text-sm text-accent-foreground font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Undo
      </button>
    </div>
  );
}
```

Notes:
- The component is always mounted; `visible` drives the opacity. This avoids re-mount flash and keeps `aria-live` stable. Screen readers get a polite announcement when content changes from empty to "Task deleted / Undo".
- `pointer-events-none` when invisible prevents phantom clicks.
- The Escape listener is scoped to `visible === true` so it doesn't capture global Escape presses when the toast is not shown.
- No internal timer — `TodoListClient` owns auto-dismiss so it can cancel it on undo.
- `aria-atomic="true"`: when label changes (cross-fade), the region is re-announced as a unit.

### `TodoListClient` reducer — recommended shape

```ts
type ToastState = {
  status: "idle" | "visible" | "dismissing";
  pendingId: string | null;
  previousSnapshot: OptimisticTodo[] | null;
};

type ToastAction =
  | { type: "SHOW"; pendingId: string; previousSnapshot: OptimisticTodo[] }
  | { type: "UNDO" }
  | { type: "DISMISS" };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case "SHOW":
      return { status: "visible", pendingId: action.pendingId, previousSnapshot: action.previousSnapshot };
    case "UNDO":
    case "DISMISS":
      return { status: "dismissing", pendingId: null, previousSnapshot: null };
    default:
      return state;
  }
}
```

`TodoListClient.handleDelete(id)`:
```ts
// inside TodoListClient
const deleteTodo = useDeleteTodo();
const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleDelete = useCallback((id: string) => {
  const previous = queryClient.getQueryData<OptimisticTodo[]>(["todos"]) ?? [];
  deleteTodo.mutate(id);
  // Cancel any existing dismiss timer if a cross-fade is in progress
  if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  dispatch({ type: "SHOW", pendingId: id, previousSnapshot: previous });
  // Auto-dismiss after UNDO_TIMEOUT_MS (synchronized with the DELETE timer)
  dismissTimerRef.current = setTimeout(() => {
    dispatch({ type: "DISMISS" });
  }, UNDO_TIMEOUT_MS);
}, [deleteTodo, queryClient]);

const handleUndo = useCallback(() => {
  if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
  deleteTodo.undo();
  dispatch({ type: "UNDO" });
}, [deleteTodo]);
```

After `DISMISS` sets `status: 'dismissing'`, a `useEffect` watching `status` transitions to `'idle'` after 200ms:
```ts
useEffect(() => {
  if (toastState.status !== "dismissing") return;
  const id = setTimeout(() => dispatch({ type: "DISMISS" }), 200);
  // ... but DISMISS already sets dismissing; need a separate RESET action or handle in reducer
  return () => clearTimeout(id);
}, [toastState.status]);
```

Simpler alternative — add an `IDLE` action to the reducer that only transitions from `dismissing → idle`.

### Focus management (AC: #6)

```ts
// Before calling deleteTodo.mutate(id):
const rows = Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"));
const idx = rows.findIndex((el) => el.dataset.taskId === id);

// After optimistic update settles (use queueMicrotask or a short setTimeout(0)):
queueMicrotask(() => {
  const updated = Array.from(document.querySelectorAll<HTMLElement>("[data-task-id]"));
  const target = updated[idx] ?? updated[idx - 1] ?? document.querySelector<HTMLElement>("#task-input");
  target?.focus();
});
```

Add `data-task-id={todo.id}` to the `<li>` in `TaskItem` and `id="task-input"` to the `<input>` in `TaskInput`.

### Import graph compliance (AGENTS.md)

```
components/TodoListClient.tsx  → hooks/use-delete-todo.ts
components/UndoToast.tsx       → (no hooks imports; pure props)
hooks/use-delete-todo.ts       → lib/api-client.ts, lib/constants.ts, lib/validation.ts
lib/api-client.ts              → lib/validation.ts
lib/constants.ts               → (no imports)
```

No `components/*` importing from `db/**` or `app/api/**`. No `hooks/**` importing from `components/**`.

### Design tokens for UndoToast

| Element | Token | Tailwind |
|---|---|---|
| Container bg | `--surface` | `bg-surface` |
| Container border | `--border-subtle` | `border-border-subtle` |
| Label | `--foreground-muted` | `text-foreground-muted` |
| Undo button | `--accent-foreground` | `text-accent-foreground` |

### Previous story learnings (Stories 2.x, 3.1)

- **`useToggleTodo` and `useCreateTodo` pattern** — both use TanStack `useMutation` with `onMutate` snapshot + `onError` rollback. `useDeleteTodo` does NOT follow this pattern because the mutation is intentionally deferred. Do NOT wrap it in `useMutation` with a timer-based `mutationFn` — the timer management is simpler as a `useRef` + imperative `setTimeout`.
- **`"use client"` directive** — any hook using `useState`/`useRef`/`useEffect` must have `"use client"` at the top. `lib/constants.ts` is isomorphic (no directive needed).
- **`motion-reduce:transition-none`** — already established in `TaskItem.tsx` (Story 2.2/2.3). Same pattern for UndoToast.
- **`data-testid` vs semantic queries** — existing tests use `getByRole`, `getByText`, `getByLabelText`. Prefer semantic queries in new tests; avoid `data-testid` unless no semantic alternative exists.
- **103 existing tests** — all must stay green. `TaskList.test.tsx` and `TaskItem.test.tsx` will need minor updates to pass the new `onDelete` prop (can be a no-op `vi.fn()` in tests that don't test deletion).
- **No `alert`/`Dialog`/`Modal`** — `UndoToast` must NOT use Radix Dialog or any modal primitive. It's a simple div with ARIA live region. AGENTS.md enforces this at lint level.
- **`cancelQueries` in hooks** — `useCreateTodo` and `useToggleTodo` both `await queryClient.cancelQueries`. In `useDeleteTodo`, the cancel is inside an async `mutate` — either await it or accept the race (in practice the timing is fine for v1; the optimistic remove immediately follows).

### Git intelligence (last commits)

```
0d1d8aa bmad-story-3.1-code-review-patches
77c9784 bmad-story-3.1-delete-api-route-handler
8f7004a bmad-story-3.1-spec-delete-api-route-handler
```

Story 3.1 just shipped the `DELETE /api/todos/[id]` endpoint and `deleteTodo` in `db/queries.ts`. Story 3.2 builds the client-side deferred-delete layer on top of that endpoint. No server-side changes in this story.

### Known out-of-scope items (do NOT implement in this story)

- **UI affordance to trigger deletion** (trash icon, swipe-left) — Story 3.3. The `onDelete` prop is wired through `TaskItem` but no button/gesture triggers it yet.
- **`ErrorIndicator` component** for failed delete UI — Story 4.1. The `syncStatus: 'failed'` state will be set correctly; the visual is deferred.
- **E2E tests for delete+undo journey** — Story 3.3 (Journey 4 spec in `e2e/delete-undo.spec.ts`).
- **`prefers-reduced-motion` CI enforcement** — Story 4.3.
- **`MAX_DESCRIPTION_LENGTH` usage in `validation.ts`** — low-risk refactor; defer to avoid test churn.

### File contract (target end-state)

```
lib/
├── constants.ts                            # NEW — UNDO_TIMEOUT_MS, MAX_DESCRIPTION_LENGTH
├── api-client.ts                           # MODIFIED — +deleteTodo
hooks/
├── use-delete-todo.ts                      # NEW
└── use-delete-todo.test.ts                 # NEW
components/
├── UndoToast.tsx                           # NEW
├── UndoToast.test.tsx                      # NEW
├── TodoListClient.tsx                      # MODIFIED — useReducer + UndoToast + handleDelete
├── TaskList.tsx                            # MODIFIED — forwards onDelete prop
├── TaskList.test.tsx                       # MODIFIED — pass vi.fn() for onDelete
├── TaskItem.tsx                            # MODIFIED — accepts onDelete prop; adds data-task-id
└── TaskItem.test.tsx                       # MODIFIED — pass vi.fn() for onDelete
```

No changes to: `db/**`, `app/api/**`, `lib/validation.ts`, `app/page.tsx`, `app/globals.css`, `e2e/**`.

### References

- Story requirements: [`_bmad-output/planning-artifacts/epics.md` §"Story 3.2"](../planning-artifacts/epics.md) (lines 574–622)
- UndoToast anatomy + states: [`_bmad-output/planning-artifacts/ux-design-specification.md` §"UndoToast"](../planning-artifacts/ux-design-specification.md) (lines 687–716)
- Motion/transitions: [`_bmad-output/planning-artifacts/ux-design-specification.md` §"Motion & Transitions"](../planning-artifacts/ux-design-specification.md) (lines 940–948)
- Delete flow walkthrough: [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md) (lines 939–944)
- Focus management: [`_bmad-output/planning-artifacts/ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) (line 1099)
- Import graph: [`AGENTS.md`](../../AGENTS.md) §"Import graph"
- Delete-during-tab-close known limitation: [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md) (line 1108)
- Story 3.1 (DELETE endpoint): [`3-1-delete-api-route-handler.md`](./3-1-delete-api-route-handler.md)
- Existing hooks for pattern reference: [`hooks/use-toggle-todo.ts`](../../hooks/use-toggle-todo.ts), [`hooks/use-create-todo.ts`](../../hooks/use-create-todo.ts)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

### Review Findings

_Code review run on 2026-04-29 (Opus 4.7, three-layer parallel: blind hunter + edge-case hunter + acceptance auditor)._

- [x] [Review][Patch] DELETE timer leaks on unmount in `useDeleteTodo` [hooks/use-delete-todo.ts] — no cleanup effect clears `timerRef.current` on unmount; an unmount mid-window fires DELETE against a torn-down cache and may warn "setState on unmounted".
- [x] [Review][Patch] `dismissTimerRef` leaks on unmount in `TodoListClient` [components/TodoListClient.tsx:72] — auto-dismiss `setTimeout` is never cleared on unmount; orphaned `dispatch` runs on a torn-down reducer.
- [x] [Review][Patch] `apiClient.deleteTodo` treats 404 as failure [lib/api-client.ts:50-53] — DELETE is idempotent on the server (Story 3.1 returns 204 for already-deleted ids), but a real 404 (different cause) would re-add the row with `syncStatus: 'failed'`. Treat 404 as success and only throw on other non-204 statuses.
- [x] [Review][Patch] Network rejection in `apiClient.deleteTodo` throws `TypeError`, not `ApiError` [lib/api-client.ts:50-53] — offline / DNS failures bypass the `ApiError` contract used by the rest of the client. Wrap `fetch` in `try { ... } catch { throw new ApiError(0, 'network') }`.
- [x] [Review][Patch] Reducer's `previousSnapshot` and `pendingId` fields are dead state [components/TodoListClient.tsx:14-18, 28-29] — set on `SHOW` but never read; `handleUndo` uses the hook's internal snapshot, not the reducer's. Duplicated source-of-truth invites drift. Drop both fields from `ToastState`.
- [x] [Review][Patch] `useDeleteTodo` returns unused `pendingId` and `previousSnapshot` [hooks/use-delete-todo.ts] — `TodoListClient` consumes only `mutate` and `undo`. Drop the unused returns and their backing `useState` to keep the hook surface minimal.
- [x] [Review][Patch] `data-task-id` focus-management query is unscoped [components/TodoListClient.tsx:59, 78] — `document.querySelectorAll("[data-task-id]")` is a global query; any future component reusing the attribute pollutes results. Scope to the list (`<ul id="task-list">` + scoped query, or a ref).
- [x] [Review][Patch] Escape handler in `UndoToast` fires on input/textarea and IME composition [components/UndoToast.tsx:11-15] — typing Escape in `TaskInput` (clear-input reflex) silently dismisses the toast; Escape during IME composition cancels both. Guard with `if (e.isComposing || e.target.matches('input,textarea,[contenteditable]')) return;`.

- [x] [Review][Defer] `queueMicrotask` for post-delete focus may fire before React commits [components/TodoListClient.tsx:77-84] — both blind + edge layers flagged a possible race (DOM not yet updated when the microtask runs). The spec's Dev Notes explicitly suggest `queueMicrotask`, and the implementation matches; tests pass empirically. Revisit if focus regressions surface in Story 3.3 E2E.
- [x] [Review][Defer] No `AbortController` / fetch timeout on `apiClient.deleteTodo` (or any api-client method) [lib/api-client.ts] — a hung DELETE blocks indefinitely with no UX. This is a cross-cutting concern affecting all api-client methods, not specific to this story. Address as part of api-client hardening epic.
- [x] [Review][Defer] Tab-close mid-DELETE drops the request [hooks/use-delete-todo.ts] — known v1 limitation explicitly called out in `architecture.md` line 1108. `navigator.sendBeacon` or `keepalive: true` is the eventual fix; out of scope for v1.
- [x] [Review][Defer] Test gaps: no unmount-during-pending test, cross-fade test asserts call counts not cache integrity, `fireEvent.keyDown(document, ...)` doesn't simulate input-focused Escape [hooks/use-delete-todo.test.ts:818-952; components/UndoToast.test.tsx:702-710] — once the patches above land (timer cleanup, Escape input-guard) the tests should also assert these behaviors. Track as a test-hardening follow-up.
