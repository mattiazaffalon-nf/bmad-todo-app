# Story 4.2: Wire user-initiated retry across all three mutations + Journey 5 E2E

Status: ready-for-dev

## Story

As a user,
I want a one-tap retry on any failed sync that re-attempts the same operation without any blocking UI,
So that transient failures recover smoothly and my typed content never gets lost.

## Acceptance Criteria

**AC #1 — Create-retry path**

- Tapping the `ErrorIndicator` on a create-failed task calls `useCreateTodo().mutate({ id: todo.id, description: todo.description })` with the original UUID and description.
- Because `POST /api/todos` is idempotent on client UUID (FR16), a successful retry returns `200` or `201` — both reconciled by the existing `onSuccess` handler to `syncStatus: 'idle'`.
- During retry, `ErrorIndicator` shows `retrying: true` (spinning `RotateCw`).
- On success, `syncStatus` becomes `'idle'` and the indicator disappears.

**AC #2 — Toggle-retry path**

- Tapping `ErrorIndicator` on a toggle-failed task calls `useToggleTodo().mutate({ id: todo.id, completed: todo.completed })` with the intended (post-toggle) `completed` value that is already in the cache.
- `PATCH` is idempotent — retries are safe.
- During retry, `ErrorIndicator` shows `retrying: true`.
- On success, `syncStatus` becomes `'idle'` and indicator disappears.

**AC #3 — Delete-retry path**

- Tapping `ErrorIndicator` on a delete-failed task immediately calls `apiClient.deleteTodo(id)` — **no second 5-second undo window**.
- `DELETE` is idempotent (Story 3.1 returns `204` even if already gone).
- During retry, `ErrorIndicator` shows `retrying: true` (cache entry's `syncStatus` set to `'pending'` immediately).
- On success, the task is removed from the cache entirely (no UndoToast — the undo opportunity already passed).
- On repeated failure, `syncStatus` remains `'failed'` and the indicator reappears.

**AC #4 — Content-preservation (FR12)**

- A create-failure does NOT re-populate `TaskInput` — the failed task lives in the list with its `ErrorIndicator`.
- The user can continue typing new tasks while one or more failures are visible.
- All other interactions (toggle, delete, new create) remain fully interactive during a failure.

**AC #5 — `failedMutation` field in cache**

- `OptimisticTodo` is extended with `failedMutation?: 'create' | 'toggle' | 'delete'`.
- Each hook's `onError` / error path sets both `syncStatus: 'failed'` and `failedMutation` so `TodoListClient` can route retries correctly.
- `use-delete-todo.ts` already sets `syncStatus: 'failed'` in its catch block — extend to also set `failedMutation: 'delete'`.

**AC #6 — Vitest tests**

- `hooks/use-create-todo.test.ts`: add test — failure sets `syncStatus: 'failed', failedMutation: 'create'`; calling `mutate` again with same args clears `syncStatus` to `'idle'` on success.
- `hooks/use-toggle-todo.test.ts`: add test — failure sets `failedMutation: 'toggle'`; retry succeeds and clears.
- `hooks/use-delete-todo.test.ts`: add test — `retryDelete(id)` sets `syncStatus: 'pending'`, then removes the entry on success; on failure, restores `syncStatus: 'failed', failedMutation: 'delete'`.
- `components/TaskItem.test.tsx`: add test — when `todo.syncStatus === 'failed'`, `ErrorIndicator` is rendered; clicking it calls the threaded `onRetry` prop.

**AC #7 — Playwright E2E `e2e/error-recovery.spec.ts`**

- Desktop-only (per scope decision in `deferred-work.md`).
- Journey 5: open app → type task → submit → intercept `POST /api/todos` with `route.abort()` → `ErrorIndicator` appears inline → restore network (`route.continue()`) → tap retry → indicator disappears → reload → task is persisted.
- During the failure the user can continue typing additional tasks; they capture independently.
- `e2e/a11y.spec.ts`: add one axe-core scan with a task in `syncStatus: 'failed'` state (seed directly or trigger via route interception) → zero violations.

**AC #8 — All quality gates pass**

- `pnpm lint` clean.
- `pnpm typecheck` clean.
- `pnpm test` — all prior tests green + new tests.
- `pnpm build` clean.
- No changes to `db/**`, `app/api/**`, `lib/constants.ts`.

## Tasks / Subtasks

- [ ] **Task 1: Extend `OptimisticTodo` with `failedMutation` (AC #5)**
  - [ ] In `lib/validation.ts`, update `OptimisticTodo`:
    ```ts
    export type FailedMutation = "create" | "toggle" | "delete";
    export type OptimisticTodo = Todo & { syncStatus?: SyncStatus; failedMutation?: FailedMutation };
    ```
  - [ ] `pnpm typecheck` passes

- [ ] **Task 2: Set `failedMutation` in hook error paths (AC #5)**
  - [ ] `hooks/use-create-todo.ts` `onError`: add `failedMutation: "create" as const` alongside `syncStatus: "failed"`:
    ```ts
    old.map((t) => (t.id === input.id ? { ...t, syncStatus: "failed" as const, failedMutation: "create" as const } : t))
    ```
  - [ ] `hooks/use-toggle-todo.ts` `onError`: add `failedMutation: "toggle" as const`
  - [ ] `hooks/use-delete-todo.ts` catch block: add `failedMutation: "delete" as const` to the restored entry
  - [ ] `pnpm typecheck` passes

- [ ] **Task 3: Add `retryDelete` to `useDeleteTodo` (AC #3)**
  - [ ] In `hooks/use-delete-todo.ts`, add a `retryDelete` method returned from the hook:
    ```ts
    const retryDelete = useCallback(async (id: string) => {
      // Show spinner immediately
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.map((t) => (t.id === id ? { ...t, syncStatus: "pending" as const } : t))
      );
      try {
        await apiClient.deleteTodo(id);
        // Remove from cache on success (no UndoToast — undo window already passed)
        queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
          old.filter((t) => t.id !== id)
        );
      } catch {
        // Restore failed state so user can retry again
        queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
          old.map((t) =>
            t.id === id
              ? { ...t, syncStatus: "failed" as const, failedMutation: "delete" as const }
              : t
          )
        );
      }
    }, [queryClient]);
    ```
  - [ ] Return `{ mutate, undo, retryDelete }` from the hook
  - [ ] `pnpm typecheck` passes

- [ ] **Task 4: Wire retry routing in `TodoListClient` (AC #1–3)**
  - [ ] Import `useCreateTodo`, `useToggleTodo`, `useQueryClient` in `TodoListClient.tsx`
  - [ ] Instantiate `createTodo = useCreateTodo()` and `toggleTodo = useToggleTodo()` (for retry only; the primary create lives in `TaskInput` and primary toggle in `TaskItem`)
  - [ ] Implement `handleRetry`:
    ```ts
    const handleRetry = useCallback((id: string) => {
      const todos = queryClient.getQueryData<OptimisticTodo[]>(["todos"]) ?? [];
      const todo = todos.find((t) => t.id === id && t.syncStatus === "failed");
      if (!todo) return;
      switch (todo.failedMutation) {
        case "create":
          createTodo.mutate({ id: todo.id, description: todo.description });
          break;
        case "toggle":
          toggleTodo.mutate({ id: todo.id, completed: todo.completed });
          break;
        case "delete":
          void deleteTodo.retryDelete(todo.id);
          break;
      }
    }, [createTodo, deleteTodo, queryClient, toggleTodo]);
    ```
  - [ ] Pass `onRetry={handleRetry}` to `<TaskList>`
  - [ ] `pnpm typecheck` passes

- [ ] **Task 5: Thread `onRetry` through `TaskList` and `TaskItem` with local `retrying` state (AC #1–3)**
  - [ ] `components/TaskList.tsx`: add `onRetry?: (id: string) => void` to props and thread to each `<TaskItem>`
  - [ ] `components/TaskItem.tsx`:
    - Add `onRetry?: (id: string) => void` to `TaskItemProps`
    - Add local `retrying` state:
      ```ts
      const [retrying, setRetrying] = useState(false);
      ```
    - Add effect to reset `retrying` when the sync status resolves:
      ```ts
      const prevSyncStatusRef = useRef(todo.syncStatus);
      useEffect(() => {
        const prev = prevSyncStatusRef.current;
        prevSyncStatusRef.current = todo.syncStatus;
        // Reset spinner when: retry succeeded (pending→idle) or retry failed again (pending→failed)
        if (prev === "pending" && todo.syncStatus !== "pending") {
          setRetrying(false);
        }
      }, [todo.syncStatus]);
      ```
    - Replace placeholder `ErrorIndicator` with the wired version:
      ```tsx
      {todo.syncStatus === "failed" && (
        <ErrorIndicator
          onRetry={() => { setRetrying(true); onRetry?.(todo.id); }}
          retrying={retrying}
        />
      )}
      ```
  - [ ] `pnpm typecheck` and `pnpm lint` pass

- [ ] **Task 6: Update and add Vitest tests (AC #6)**
  - [ ] `hooks/use-create-todo.test.ts`: add test for `failedMutation: 'create'` set on error; add retry test (second `mutate` call with same args succeeds → `syncStatus: 'idle'`)
  - [ ] `hooks/use-toggle-todo.test.ts`: add test for `failedMutation: 'toggle'`; add retry test
  - [ ] `hooks/use-delete-todo.test.ts`: add test for `retryDelete` — sets `syncStatus: 'pending'`, removes on success; sets `syncStatus: 'failed'` on repeated failure
  - [ ] `components/TaskItem.test.tsx`: add test — `syncStatus: 'failed'` renders `ErrorIndicator`; clicking it calls `onRetry` with `todo.id`
  - [ ] `pnpm test` passes

- [ ] **Task 7: Write E2E `e2e/error-recovery.spec.ts` (AC #7)**
  - [ ] `test.beforeEach`: `cleanupTodos()`
  - [ ] Journey 5 — create failure + retry:
    - Seed no tasks; `page.goto("/")`
    - `await page.route("**/api/todos", route => route.abort(), { times: 1 })` to abort the next POST
    - Type task + press Enter in `TaskInput`
    - Assert `getByText("Couldn't save")` (ErrorIndicator) is visible
    - `await page.unroute("**/api/todos")` to restore network
    - Click the ErrorIndicator button
    - Assert `getByText("Couldn't save")` not visible (indicator gone after success)
    - `page.reload()` → assert task is visible
  - [ ] Bonus: during failure, type another task → assert it persists independently (no ErrorIndicator for the second task)
  - [ ] `pnpm test` (unit only) still green

- [ ] **Task 8: Extend `e2e/a11y.spec.ts` with failed-task scan (AC #7)**
  - [ ] Add test: `page.route` to abort POST → submit task → `ErrorIndicator` visible → axe-core scan → zero violations
  - [ ] Use `page.unroute` to clean up after the test

- [ ] **Task 9: Verify all quality gates (AC #8)**
  - [ ] `pnpm lint` — clean
  - [ ] `pnpm typecheck` — clean
  - [ ] `pnpm test` — all green
  - [ ] `pnpm build` — clean

## Dev Notes

### Desktop-only scope (from `deferred-work.md`)

Mobile browser support is out of scope for v1. For this story:
- No mobile sub-journeys in E2E.
- `e2e/error-recovery.spec.ts` is desktop only (no `test.use({ ...devices["iPhone 14"] })`).
- Keep `prefers-reduced-motion` support — already handled by `ErrorIndicator` component.

### Retry routing architecture

```
TodoListClient
  ├── useCreateTodo()   → createTodo.mutate()     for failedMutation === 'create'
  ├── useToggleTodo()   → toggleTodo.mutate()     for failedMutation === 'toggle'
  └── useDeleteTodo()   → deleteTodo.retryDelete() for failedMutation === 'delete'
           │
           ▼ onRetry prop
        TaskList
           │
           ▼ onRetry prop
        TaskItem
           │
           ▼ onClick
        ErrorIndicator.onRetry → setRetrying(true) → onRetry(todo.id)
```

`TodoListClient` already instantiates `useDeleteTodo`. It gains two more hook calls for retry routing: `useCreateTodo` and `useToggleTodo`. These are independent mutation instances — their lifecycle callbacks (`onMutate`/`onSuccess`/`onError`) still fire correctly and update the shared TanStack Query cache.

### `failedMutation` field usage

Only read in `TodoListClient.handleRetry` to route. Never rendered in the UI. `TaskItem` does not need to read it — it just calls `onRetry(todo.id)`.

### `retrying` local state in `TaskItem`

Track `retrying` locally in `TaskItem` using a `useState<boolean>(false)`:
- Set `true` when user clicks (before calling `onRetry`)
- Reset when `syncStatus` transitions away from `'pending'` (both `→ 'idle'` on success and `→ 'failed'` on retry failure)
- Use a `useRef` to track previous `syncStatus` in the effect so the transition is detected reliably

The `prevSyncStatusRef` approach is necessary because `useEffect` with `[todo.syncStatus]` only fires when the value changes — when a retry fails and `syncStatus` goes back to `'failed'` from `'pending'`, the dependency changes and we can detect the `pending → failed` transition.

### `retryDelete` — no UndoToast, no undo window

The delete retry does NOT go through the `UNDO_TIMEOUT_MS` window. The user already had 5 seconds to undo before the first delete attempt fired. A retry fires `apiClient.deleteTodo(id)` immediately and removes the entry from cache on success. No `dispatch({ type: "SHOW" })` for a new toast.

`retryDelete` lives in `use-delete-todo.ts` because it needs `queryClient` and `apiClient` — both already imported there. It is NOT a TanStack Query `useMutation` — it is a plain `useCallback` async function. This keeps it simple and avoids creating a fourth mutation instance.

### E2E network interception

Playwright's `page.route()` with `route.abort()` is the standard approach for simulating network failures without a server flag:

```ts
// Abort only the next POST to /api/todos
await page.route("**/api/todos", (route) => route.abort(), { times: 1 });

// ... submit task ...

// Restore (explicit unroute or times:1 auto-removes after one intercept)
await page.unroute("**/api/todos");
```

`times: 1` means the handler fires once and auto-unregisters. Use it to simulate a single failure then let subsequent requests through.

After aborting, the `fetch` in `apiClient.createTodo` will throw (the `!res.ok` path), which triggers `onError` → `syncStatus: 'failed'`. The `ErrorIndicator` becomes visible.

After unrouting, clicking the indicator calls `handleRetry` → `createTodo.mutate(...)` → the real POST goes through → `onSuccess` → `syncStatus: 'idle'` → indicator disappears.

### `TodoListClient` additions

Currently `TodoListClient` only imports `useDeleteTodo`. After this story it will also import `useCreateTodo`, `useToggleTodo`, and `useQueryClient` from TanStack Query. This is consistent with the component's role as the orchestrator of all mutations.

`useCreateTodo` and `useToggleTodo` instances in `TodoListClient` are separate from the ones in `TaskInput` and `TaskItem`. This is fine — TanStack Query mutations are not singletons. When `createTodo.mutate()` is called from `TodoListClient` during retry, it fires `onMutate`/`onSuccess`/`onError` on the mutation's definition (shared callbacks), updating the cache exactly as expected.

### `onMutate` during retry — `cancelQueries` concern

When retry calls `createTodo.mutate(...)`, `onMutate` fires and calls `queryClient.cancelQueries({ queryKey: ["todos"] })`. This is safe — it cancels any in-flight `['todos']` queries but the optimistic update applied in `onMutate` transitions the entry from `syncStatus: 'failed'` to `syncStatus: 'pending'`, which naturally shows the spinner.

### Files changed in this story

```
lib/validation.ts                             # MODIFIED — failedMutation type + OptimisticTodo
hooks/
├── use-create-todo.ts                        # MODIFIED — failedMutation:'create' in onError
├── use-toggle-todo.ts                        # MODIFIED — failedMutation:'toggle' in onError
├── use-delete-todo.ts                        # MODIFIED — failedMutation:'delete' + retryDelete
├── use-create-todo.test.ts                   # MODIFIED — failedMutation + retry tests
├── use-toggle-todo.test.ts                   # MODIFIED — failedMutation + retry tests
└── use-delete-todo.test.ts                   # MODIFIED — retryDelete tests
components/
├── TaskItem.tsx                              # MODIFIED — onRetry prop + retrying local state
├── TaskItem.test.tsx                         # MODIFIED — retry UI tests
├── TaskList.tsx                              # MODIFIED — thread onRetry prop
└── TodoListClient.tsx                        # MODIFIED — handleRetry routing, 2 new hooks
e2e/
├── error-recovery.spec.ts                    # NEW — Journey 5
└── a11y.spec.ts                              # MODIFIED — failed-task axe scan
```

No changes to: `db/**`, `app/api/**`, `lib/constants.ts`, `lib/api-client.ts`, `components/ErrorIndicator.tsx`, `components/UndoToast.tsx`, `app/page.tsx`, `app/globals.css`.

### Previous story learnings

- **Story 4.1**: `ErrorIndicator` already built with `onRetry: () => void` and `retrying: boolean` props. `TaskItem` renders it with a no-op `onRetry` and `retrying={false}` — both get replaced in this story.
- **Story 3.2**: `useDeleteTodo` follows a custom hook pattern (not `useMutation`) — `retryDelete` follows the same `useCallback` + `queryClient.setQueryData` pattern.
- **Story 2.2 / 2.1**: `useToggleTodo` and `useCreateTodo` are standard TanStack Query `useMutation`. The `onMutate/onSuccess/onError` lifecycle is already wired for `syncStatus` transitions.
- **Import graph**: `components/` → `hooks/` ✓; `hooks/` → `lib/api-client.ts` ✓. `TodoListClient` may import `useCreateTodo`, `useToggleTodo`, `useDeleteTodo` freely.
- **No modals**: `retryDelete` on success just removes from cache — no UndoToast for a retry-delete.
- **E2E `beforeEach`**: always `cleanupTodos()`. Use stable UUIDs when seeding. `page.route` / `page.unroute` for network interception — no server flag required.
- **`page.route` timing**: register the route handler BEFORE performing the action that triggers the request.

### References

- Story 4.2 requirements: [`_bmad-output/planning-artifacts/epics.md` §"Story 4.2"](../planning-artifacts/epics.md)
- FR12 (content preservation): same doc §"FR12"
- FR16 (idempotent POST): same doc §"FR16"
- Story 4.1 implementation: [`_bmad-output/implementation-artifacts/4-1-error-indicator-sync-status.md`](./4-1-error-indicator-sync-status.md)
- Desktop-only scope decision: [`_bmad-output/implementation-artifacts/deferred-work.md` §"Scope decision"](./deferred-work.md)
- `useDeleteTodo` pattern: [`hooks/use-delete-todo.ts`](../../hooks/use-delete-todo.ts)
- Playwright route interception: [Playwright docs — network](https://playwright.dev/docs/network)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
