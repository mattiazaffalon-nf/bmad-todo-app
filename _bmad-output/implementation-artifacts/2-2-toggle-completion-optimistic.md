# Story 2.2: Toggle completion via tap with optimistic update and quiet visual transition

Status: ready-for-dev

## Story

As a user,
I want to tap (or click) the circular checkbox on any task to mark it done or undone, seeing an instant fade-and-strikethrough that feels final without jumping the list,
So that completing tasks feels rewarding and stable.

## Acceptance Criteria

1. **`lib/api-client.ts` is extended with a `toggleTodo` method.**
   - Adds `toggleTodo(id: string, completed: boolean): Promise<Todo>` to the `apiClient` object.
   - PATCHes `/api/todos/${id}` with `{ completed }` via `fetch` (POST-style explicit call, **not** the `fetchJson` helper — same pattern as `createTodo`).
   - On non-2xx response: throws `ApiError(res.status, ...)`.
   - On 2xx: parses the response body with `z.object({ todo: TodoApiSchema })` and returns `body.todo`.
   - Uses the existing `ApiError` class and `TodoApiSchema` already in the file — **no new imports or types**.

2. **`hooks/use-toggle-todo.ts` is created with an optimistic mutation hook.**
   - Exports `useToggleTodo()` using TanStack Query's `useMutation`.
   - `mutationFn: ({ id, completed }: { id: string; completed: boolean }) => apiClient.toggleTodo(id, completed)`.
   - `onMutate`: cancel `['todos']` queries, snapshot the cache, update the matching entry in cache to `{ ...todo, completed, syncStatus: 'pending' }`. Return `{ previous }` as context.
   - `onError`: restore the cache snapshot from context (`ctx?.previous`).
   - `onSuccess`: call `queryClient.setQueryData<OptimisticTodo[]>` to replace the matching entry with the server response merged with `syncStatus: 'idle'`. **No `invalidateQueries`.**
   - `retry: false`.
   - Mirror the exact structure of `hooks/use-create-todo.ts` — same imports, same `queryClient` usage, same per-field cache manipulation.

3. **`components/TaskItem.tsx` is updated to make the checkbox interactive with the completion visual.**
   - The circular checkbox becomes a `<button>` element with:
     - `type="button"`
     - `aria-pressed={todo.completed}` (reflects completion state)
     - `aria-label="Mark task complete"` when `!todo.completed`, `"Mark task incomplete"` when `todo.completed`
     - `onClick` calls `toggleTodo.mutate({ id: todo.id, completed: !todo.completed })`
     - `className` includes focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`
   - The icon swaps based on `todo.completed`:
     - Active (not completed): Lucide `Circle` (unchanged from current)
     - Completed: Lucide `CheckCircle2` with `className="text-accent fill-accent"`
   - The description text `<p>` adds conditional classes for completed state:
     - `text-foreground-muted` and `line-through` when `todo.completed`
     - `text-foreground` when `!todo.completed`
   - Transitions on the description: `transition-colors duration-200 ease-in-out` — applied always; `prefers-reduced-motion` collapses it via Tailwind's `motion-reduce:transition-none` class.
   - The hit target stays 44×44px (`w-[44px] h-[44px]`) on the button wrapper.
   - The component receives `useToggleTodo()` internally (the hook is called inside `TaskItem`, not passed as prop).

4. **`hooks/use-toggle-todo.test.ts` is created covering the mutation lifecycle.**
   - Mock pattern: `vi.mock("@/lib/api-client", ...)` — mirrors `use-create-todo.test.ts` exactly (same mock factory, same wrapper factory).
   - Also mock `toggleTodo` in the factory: `toggleTodo: vi.fn()`.
   - Tests (at minimum):
     - `onMutate` optimistically flips `completed` to the new value and sets `syncStatus: 'pending'` on the matching cache entry.
     - `onError` restores the previous cache snapshot.
     - `onSuccess` replaces the cache entry with the server response and `syncStatus: 'idle'`.
   - Same `renderHook` + `QueryClientProvider` wrapper pattern as `use-create-todo.test.ts`.

5. **`components/TaskItem.test.tsx` is extended with interaction tests.**
   - Mock `useToggleTodo` at the module level: `vi.mock("@/hooks/use-toggle-todo", () => ({ useToggleTodo: () => ({ mutate: mockMutate }) }))`.
   - Tests to add (keep all existing 4 tests):
     - Clicking the checkbox button calls `mutate` with `{ id: todo.id, completed: true }` when todo is not completed.
     - Clicking the checkbox on a completed todo calls `mutate` with `{ id: todo.id, completed: false }`.
     - A completed todo renders with `line-through` on the description and `CheckCircle2` icon.
     - An active todo renders with no `line-through` and `Circle` icon.
     - Keyboard Enter/Space on the checkbox fires the same `mutate` call (use `fireEvent.keyDown` with `key: 'Enter'` on the button element — browsers fire `click` on Enter/Space for `<button>` by default, so this is a no-op test confirming the button element is correct).
     - The checkbox button has `aria-pressed={false}` for active and `aria-pressed={true}` for completed.

6. **No schema or DB changes.** This story is purely client-side + `lib/api-client.ts`. No edits to `db/**`, `app/api/**`, or `lib/validation.ts`.

7. **Lint, typecheck, and test gates are green.** `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass.

## Tasks / Subtasks

- [ ] **Task 1: Extend `lib/api-client.ts` with `toggleTodo` (AC: #1)**
  - [ ] Add `toggleTodo(id: string, completed: boolean): Promise<Todo>` to the `apiClient` object
  - [ ] Use `fetch` + explicit non-2xx check + Zod parse — mirror `createTodo` pattern exactly
  - [ ] Verify `pnpm typecheck` passes

- [ ] **Task 2: Create `hooks/use-toggle-todo.ts` (AC: #2)**
  - [ ] Export `useToggleTodo()` with `useMutation`, `onMutate`/`onError`/`onSuccess`, `retry: false`
  - [ ] `onMutate` cancels queries, snapshots, updates matching entry with `completed` + `syncStatus: 'pending'`
  - [ ] `onError` restores snapshot; `onSuccess` merges server response with `syncStatus: 'idle'`
  - [ ] Verify `pnpm typecheck` passes

- [ ] **Task 3: Update `components/TaskItem.tsx` (AC: #3)**
  - [ ] Replace static circle div with interactive `<button type="button">` with `aria-pressed` and `aria-label`
  - [ ] Wire `onClick` to `toggleTodo.mutate({ id: todo.id, completed: !todo.completed })`
  - [ ] Swap `Circle` / `CheckCircle2` icon based on `todo.completed`
  - [ ] Add conditional `text-foreground-muted line-through` + `transition-colors duration-200 ease-in-out motion-reduce:transition-none` to description
  - [ ] Add focus ring classes to the button
  - [ ] Verify the existing TaskItem tests still pass (they must not break)

- [ ] **Task 4: Write `hooks/use-toggle-todo.test.ts` (AC: #4)**
  - [ ] `vi.mock("@/lib/api-client")` with `toggleTodo: vi.fn()`
  - [ ] Three tests: onMutate flip + pending, onError restore, onSuccess idle

- [ ] **Task 5: Extend `components/TaskItem.test.tsx` (AC: #5)**
  - [ ] Add `vi.mock("@/hooks/use-toggle-todo")` at top
  - [ ] Add 6 new tests covering click, keyboard, completed visual state, aria-pressed
  - [ ] Keep all 4 existing tests green

- [ ] **Task 6: Verify all gates (AC: #7)**
  - [ ] `pnpm lint` — clean
  - [ ] `pnpm typecheck` — clean
  - [ ] `pnpm test` — all tests green (existing 78 + ~9 new = ~87)

## Dev Notes

### Architectural anchors (do not deviate)

- **No `invalidateQueries` on success.** Architecture §"Process Patterns" line 530 is explicit: avoid `invalidateQueries` on success — it triggers a refetch that fights optimistic state. `setQueryData` is the reconcile mechanism.
- **`staleTime: Infinity` on `useTodos`.** The query never automatically refetches. `setQueryData` is the only way to update the cache after a mutation — `invalidateQueries` would trigger a GET that races the optimistic state.
- **`retry: false`.** Matches `useCreateTodo`. The architecture says retry is manual via `ErrorIndicator` (Story 4.1), not automatic.
- **In-place stability.** When the toggle fires, the task stays in its list position. Do not reorder. Do not move it to a "completed" section. Architecture §"Stability" is emphatic: no reorder on toggle.
- **Import graph.** `components/TaskItem.tsx` may import from `hooks/use-toggle-todo.ts`. `hooks/` must not import from `components/`. `lib/api-client.ts` must not import from `db/**`.

### `toggleTodo` in `lib/api-client.ts` — target shape

```ts
async toggleTodo(id: string, completed: boolean): Promise<Todo> {
  const res = await fetch(`/api/todos/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ completed }),
  });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  const body = z.object({ todo: TodoApiSchema }).parse(await res.json());
  return body.todo;
},
```

This mirrors `createTodo` exactly — same `fetch` call, same `ApiError` throw, same Zod parse. Do not use the `fetchJson` helper (it only handles GET, no body).

### `useToggleTodo` hook — target shape

```ts
// hooks/use-toggle-todo.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { OptimisticTodo } from "@/lib/validation";

export function useToggleTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) =>
      apiClient.toggleTodo(id, completed),
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previous = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.map((t) => (t.id === id ? { ...t, completed, syncStatus: "pending" } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData<OptimisticTodo[]>(["todos"], ctx.previous);
      }
    },
    onSuccess: (serverTodo, { id }) => {
      queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
        old.map((t) => (t.id === id ? { ...serverTodo, syncStatus: "idle" } : t)),
      );
    },
    retry: false,
  });
}
```

Key differences from `useCreateTodo`:
- `mutationFn` takes `{ id, completed }` (not a full `TodoCreateInput`)
- `onMutate` maps over the cache to find the matching entry by `id` and updates it in place (no prepend)
- `onSuccess` also maps over the cache by `id` (same as `onMutate` but with server data)

### `TaskItem.tsx` — target shape

```tsx
// components/TaskItem.tsx
import { Circle, CheckCircle2 } from "lucide-react";
import type { OptimisticTodo } from "@/lib/validation";
import { useToggleTodo } from "@/hooks/use-toggle-todo";

export function TaskItem({ todo }: { todo: OptimisticTodo }) {
  const toggleTodo = useToggleTodo();

  return (
    <li role="listitem" className="min-h-[48px] py-3 px-6 flex items-center gap-3">
      <button
        type="button"
        aria-pressed={todo.completed}
        aria-label={todo.completed ? "Mark task incomplete" : "Mark task complete"}
        onClick={() => toggleTodo.mutate({ id: todo.id, completed: !todo.completed })}
        className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-full"
      >
        {todo.completed ? (
          <CheckCircle2 size={24} className="text-accent fill-accent" />
        ) : (
          <Circle size={24} />
        )}
      </button>
      <p
        className={[
          "flex-1 text-base truncate leading-normal",
          "transition-colors duration-200 ease-in-out motion-reduce:transition-none",
          todo.completed ? "text-foreground-muted line-through" : "text-foreground",
        ].join(" ")}
      >
        {todo.description}
      </p>
      <div className="w-[44px] flex-shrink-0" />
    </li>
  );
}
```

Notes on the shape:
- `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent` — Tailwind 4 uses `outline-accent` which maps to `--color-accent` via the CSS theme. Use `outline-[var(--accent)]` if the utility doesn't resolve.
- `rounded-full` on the button so the focus ring follows the circular shape.
- `motion-reduce:transition-none` collapses the 200ms transition to instant when `prefers-reduced-motion` is enabled. This is a Tailwind built-in responsive variant — no custom media query needed.
- The `line-through` Tailwind class maps to `text-decoration: line-through`.

### Test mock pattern for `TaskItem.test.tsx`

```tsx
// at the top of the file, after imports
const mockMutate = vi.fn();

vi.mock("@/hooks/use-toggle-todo", () => ({
  useToggleTodo: () => ({ mutate: mockMutate }),
}));

beforeEach(() => {
  mockMutate.mockReset();
});
```

The existing mock for `useCreateTodo` is already present in `TaskInput.test.tsx` — this is the same pattern applied to `TaskItem.test.tsx`.

Existing `TaskItem.test.tsx` already mocks nothing (reads the component directly). Adding the `useToggleTodo` mock at module level is safe — all 4 existing tests will still pass because they don't click the checkbox.

### Test pattern for `use-toggle-todo.test.ts`

Follow `use-create-todo.test.ts` exactly:
- Same `vi.mock("@/lib/api-client")` with `{ apiClient: { listTodos: vi.fn(), createTodo: vi.fn(), toggleTodo: vi.fn() } }`.
- Same `createWrapper` helper.
- Same `TEST_ID` + `SERVER_TODO` constants.
- Same `beforeEach(() => vi.mocked(apiClient.toggleTodo).mockReset())`.

Three tests:

```ts
it("onMutate optimistically flips completed and sets syncStatus pending", async () => {
  const existing: OptimisticTodo = { ...SERVER_TODO, completed: false };
  queryClient.setQueryData<OptimisticTodo[]>(["todos"], [existing]);
  vi.mocked(apiClient.toggleTodo).mockImplementation(() => new Promise(() => {})); // hang

  act(() => { result.current.mutate({ id: TEST_ID, completed: true }); });

  await waitFor(() => {
    const data = queryClient.getQueryData<OptimisticTodo[]>(["todos"]);
    expect(data?.[0]?.completed).toBe(true);
    expect(data?.[0]?.syncStatus).toBe("pending");
  });
});

it("onError restores previous cache snapshot", async () => { /* mirror createTodo onError test */ });

it("onSuccess replaces cache entry with server response and syncStatus idle", async () => { /* mirror createTodo onSuccess test */ });
```

### Tailwind 4 specifics

- `motion-reduce:transition-none` is the Tailwind 4 variant for `@media (prefers-reduced-motion: reduce)`. It is built in — no plugin needed.
- `outline-accent` maps to `outline-color: var(--color-accent)` via the `@theme` block in `globals.css`. If this doesn't resolve during `pnpm typecheck`/`pnpm build`, fall back to `outline-[color:var(--accent)]` or `[outline-color:var(--accent)]`.
- `fill-accent` maps to `fill: var(--color-accent)` — same theme mapping. Verify it resolves; fall back to `[fill:var(--accent)]` if needed.
- `text-foreground-muted` maps to `color: var(--color-foreground-muted)` — this is already used in `EmptyState.tsx`, confirmed working.

### `CheckCircle2` import

`lucide-react` is already a dependency (`TaskItem.tsx` imports `Circle` from it). `CheckCircle2` is in the same package — add it to the import:

```ts
import { Circle, CheckCircle2 } from "lucide-react";
```

No `pnpm add` needed.

### Keyboard operability note

`<button type="button">` handles Enter and Space natively in browsers — pressing either key fires the `click` event. No `onKeyDown` handler is needed. The test for keyboard operability can use `fireEvent.click` (or `userEvent.keyboard`) since the browser behavior is standard and JSDOM replicates it for button elements. If you want to verify it explicitly, use `fireEvent.keyDown(button, { key: 'Enter' })` — note JSDOM does NOT automatically fire `click` on keydown; use `fireEvent.click` for the click simulation and trust that the element is a button for the a11y guarantee.

### File contract (target end-state)

```
lib/
└── api-client.ts          # MODIFIED — added toggleTodo method

hooks/
├── use-toggle-todo.ts     # NEW — optimistic PATCH mutation
└── use-toggle-todo.test.ts # NEW — 3 lifecycle tests

components/
├── TaskItem.tsx            # MODIFIED — interactive checkbox, completion visual
└── TaskItem.test.tsx       # MODIFIED — +6 interaction tests (4 existing preserved)
```

No DB, no API routes, no `lib/validation.ts`, no `package.json` changes.

### Previous-story intelligence (Story 2.1 learnings)

- **Story 2.1 ships the `PATCH /api/todos/[id]` endpoint** this story consumes. Response shape: `200 { todo: Todo }` on success, `{ code, message }` on errors. `toggleTodo` should throw `ApiError` on any non-2xx — do not try to differentiate 404 from 500.
- **`TodoApiSchema` is in `lib/validation.ts`** since Story 1.4. Use `z.object({ todo: TodoApiSchema }).parse(await res.json())` — same as `createTodo`.
- **`useCreateTodo`'s `onMutate` prepends** — `useToggleTodo`'s `onMutate` maps/replaces in place. Different cache update strategy, same TanStack Query primitives.
- **`pnpm exec next typegen` was needed in Story 2.1** when a new dynamic route directory was added. Story 2.2 adds no new routes — `next typegen` should not be needed.
- **`fileParallelism: false` in `vitest.config.ts`** — the new hook test runs sequentially with existing tests. No config changes needed.
- **Test environment is `jsdom`** for React component tests (set as default in `vitest.config.ts` since Story 1.4). `use-toggle-todo.test.ts` and `TaskItem.test.tsx` use `jsdom` — **no `// @vitest-environment node` header**.

### Story 1.5 patterns to reuse

- `use-create-todo.ts` is the exact blueprint for `use-toggle-todo.ts`. Read it before writing.
- `TaskInput.test.tsx` shows how to mock a hook (`vi.mock("@/hooks/use-create-todo")`) — same pattern for mocking `useToggleTodo` in `TaskItem.test.tsx`.
- `use-create-todo.test.ts` shows the `createWrapper`, `renderHook`, `act`/`waitFor` pattern — mirror it verbatim.

### Git intelligence (last 5 commits)

```
524f3b2 Merge pull request #10 from mattiazaffalon-nf/story-2.1-dev
c0e2ec2 bmad-story-2.1-patch-api-todos-id
c3d6d24 Merge pull request #9 from mattiazaffalon-nf/story-1.5-dev
9fcd60a bmad-story-1.5-code-review-patches
eb82d01 bmad-story-1.5-task-input-optimistic-prepend
```

Story 2.1 is merged. This story is the first client-side story of Epic 2. No new deps, no new routes — pure UI + hook work.

### Out of scope for this story

- Mobile swipe-right gesture — **Story 2.3**.
- `ErrorIndicator` on the checkbox (failed syncStatus visual) — **Story 4.1**.
- Hover-reveal delete button — **Story 3.x**.
- `useDeleteTodo` — **Story 3.2**.
- Playwright E2E for the toggle journey — **Story 2.3** (the E2E suite covers swipe + tap together).

### Project context

This story connects `PATCH /api/todos/[id]` (Story 2.1) to the UI. After this story, a user can click any checkbox in the list and see it instantly flip with a fade-and-strikethrough, persisted to the DB in the background. Story 2.3 then adds the swipe-right mobile gesture that calls the same `useToggleTodo` hook.

## Dev Agent Record

### Agent Model Used

(to be filled)

### Debug Log References

(to be filled)

### Completion Notes List

(to be filled)

### File List

(to be filled)

## Change Log

| Date       | Change                        |
| ---------- | ----------------------------- |
| 2026-04-29 | Story 2.2 spec created        |
