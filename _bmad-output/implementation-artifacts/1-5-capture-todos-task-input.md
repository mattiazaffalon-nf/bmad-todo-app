# Story 1.5: Capture new todos via TaskInput with optimistic prepend and end-to-end persistence

Status: done

## Story

As a user,
I want to type a task into an always-focused input and see it appear instantly at the top of my list, persisted across reloads,
So that capturing a thought is instantaneous and dependable, with no save buttons and no loading states.

## Acceptance Criteria

1. **`components/TaskInput.tsx` is the hero capture component (AC: UX-DR4, NFR11).**
   - Auto-focused on mount via `autoFocus` prop (or `useEffect` with `ref.current.focus()`).
   - `aria-label="New task"` on the `<input>` element.
   - Font-size ≥ 16px on the input (`text-base`) to prevent iOS Safari auto-zoom on focus (NFR11).
   - On mobile (base breakpoint): container is `position: fixed` at the bottom, full-width, with `pb-[calc(var(--space-4)+env(safe-area-inset-bottom))]` (UX-DR18).
   - On desktop (`lg:` breakpoint): container is `static` (natural flow) within the ~640px content column, anchored at the top.
   - Input value is controlled state; `maxLength` is NOT used — the 280-char soft limit is enforced by slicing the value in the `onChange` handler (silent truncation, no counter, no error styling).
   - Pressing `Enter` (or tapping the send button) commits the task: calls `mutate()`, clears the input, and keeps focus on the input.
   - Pressing `Enter` when the input is empty or whitespace-only is a no-op.
   - `aria-describedby="empty-state-hint"` is wired on the input so screen readers read the EmptyState copy alongside the input label.
   - Send button (`aria-label="Add task"`) uses the Lucide `Send` icon (20px) inside a 44×44px hit-target `<button>`. It appears only when the trimmed input value has ≥ 1 character.
   - `prefers-reduced-motion`: the send button's appearance/disappearance transition is instantaneous when `(prefers-reduced-motion: reduce)` is active — use `motion-safe:transition-opacity` or equivalent.

2. **`components/TodoListClient.tsx` is a `'use client'` wrapper that co-locates `TaskInput` and `TaskList`.**
   - `app/page.tsx` is updated to render `<TodoListClient />` inside the `HydrationBoundary` instead of `<TaskList />` directly.
   - `TodoListClient` renders `TaskInput` and `TaskList` together. On mobile the TaskInput is fixed at the bottom (via its own CSS); on desktop it is rendered above `TaskList` in the natural flow.
   - The mobile layout adds `pb-20` (or equivalent) to the scroll area so the last `TaskItem` is never obscured by the fixed `TaskInput`.

3. **`hooks/use-create-todo.ts` implements the optimistic-update protocol.**
   - `mutationFn`: calls `apiClient.createTodo(input)`.
   - `onMutate`: (a) `await queryClient.cancelQueries({ queryKey: ['todos'] })`; (b) snapshot `previous = queryClient.getQueryData<OptimisticTodo[]>(['todos'])`; (c) prepend `{ ...input, completed: false, createdAt: new Date().toISOString(), userId: null, syncStatus: 'pending' }` to the cache via `setQueryData`; (d) return `{ previous }`.
   - `onError`: restore snapshot — `queryClient.setQueryData(['todos'], ctx.previous)`.
   - `onSuccess`: reconcile the optimistic entry with the server response — find the entry by `id` in the cache and replace it with `{ ...serverTodo, syncStatus: 'idle' }` via `setQueryData`. **Never call `invalidateQueries`**.
   - `retry: false` — no automatic retry.

4. **`lib/api-client.ts` is extended with `createTodo()`.**
   - `createTodo(input: TodoCreateInput): Promise<Todo>` POSTs to `/api/todos`, parses the response body `{ todo: TodoApiSchema }` with Zod, and returns the `todo` field.
   - Throws `ApiError` on non-2xx responses (same pattern as `listTodos`).
   - The POST body is `JSON.stringify(input)` with `content-type: application/json` header.

5. **`lib/validation.ts` is extended with `OptimisticTodo` type.**
   - Add: `export type SyncStatus = 'idle' | 'pending' | 'failed';`
   - Add: `export type OptimisticTodo = Todo & { syncStatus?: SyncStatus };`
   - `useTodos` and `useCreateTodo` use `OptimisticTodo[]` as the cache type.
   - `TaskItem` is updated to accept `OptimisticTodo` instead of `Todo` (no visual change in this story — `syncStatus` is stored but not rendered until Story 4.1).

6. **Layout scrollability on mobile.**
   - The `<main>` in `app/page.tsx` (or the scroll container in `TodoListClient`) gains bottom padding on mobile so the last todo is not permanently hidden behind the fixed `TaskInput`.
   - The `TaskList` `<ul>` does NOT change its max-width or structure.

7. **Unit tests cover `TaskInput` and `useCreateTodo`.**
   - `components/TaskInput.test.tsx`:
     - Renders with auto-focus (`document.activeElement` is the input after render).
     - Send button hidden when input is empty; visible when input has non-whitespace content.
     - Input beyond 280 chars is silently truncated (type 300 chars → value is 280).
     - Pressing Enter calls the mutation with a UUID and description; input clears after.
     - Pressing Enter on empty/whitespace input does NOT call mutation.
   - `hooks/use-create-todo.test.ts`:
     - `onMutate` prepends a `syncStatus: 'pending'` entry to the cache.
     - `onError` restores the previous cache snapshot.
     - `onSuccess` replaces the optimistic entry with the server response + `syncStatus: 'idle'`.

8. **Playwright E2E tests cover the two core capture journeys.**
   - `e2e/capture.spec.ts`:
     - Journey 1 (first-time capture): open app → EmptyState visible → type a task → press Enter → task appears at top of list → reload → task still present.
     - Journey 2 (returning-user capture): seed an existing todo → open app → type a new task → Enter → new task prepends above existing → existing tasks remain in order.
   - Playwright is configured in `playwright.config.ts` to run against `http://localhost:3000` by default (CI URL override via `BASE_URL` env var).
   - DB setup/teardown: `e2e/fixtures/test-db.ts` exports a `testDb` fixture that inserts/deletes test rows via direct DB calls using the same `db/client.ts` connection.
   - GitHub Actions integration is **deferred** to a dedicated infrastructure story (no `.github/workflows` file in this story).

9. **All gates pass.**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all succeed.
   - Vitest: all existing 53 tests pass plus new TaskInput and useCreateTodo tests.
   - Playwright: `pnpm test:e2e` passes locally against `pnpm dev` (manual verification, not required to be automated in CI yet).

## Tasks / Subtasks

- [ ] **Task 1: Install Playwright (AC: #8)**
  - [ ] `pnpm add -D @playwright/test`
  - [ ] `npx playwright install chromium` (installs only the Chromium browser — sufficient for Journey 1 + 2 in this story)
  - [ ] Add `"test:e2e": "playwright test"` script to `package.json`
  - [ ] Confirm `pnpm test:e2e --list` exits cleanly after creating the config

- [ ] **Task 2: Extend `lib/validation.ts` with `OptimisticTodo`; update `useTodos` and `TaskItem` (AC: #5)**
  - [ ] Add `export type SyncStatus = 'idle' | 'pending' | 'failed';` and `export type OptimisticTodo = Todo & { syncStatus?: SyncStatus };`
  - [ ] Update `hooks/use-todos.ts`: change return type to `UseQueryResult<OptimisticTodo[]>`
  - [ ] Update `components/TaskItem.tsx`: change prop type from `Todo` to `OptimisticTodo` (no visual change — just future-proofs the prop)
  - [ ] Update `components/TaskList.tsx`: adjust type references if needed (TaskItem now accepts OptimisticTodo)
  - [ ] Verify `pnpm typecheck` passes

- [ ] **Task 3: Extend `lib/api-client.ts` with `createTodo()` (AC: #4)**
  - [ ] Add `createTodo(input: TodoCreateInput): Promise<Todo>` to `apiClient` object
  - [ ] POSTs to `/api/todos` with `content-type: application/json`; parses `{ todo: TodoApiSchema }` response with Zod
  - [ ] Throws `ApiError` on non-2xx (same pattern as `listTodos` via `fetchJson`)

- [ ] **Task 4: Create `hooks/use-create-todo.ts` (AC: #3)**
  - [ ] `useCreateTodo()` returns `useMutation` with `mutationFn: apiClient.createTodo`
  - [ ] `onMutate`: cancel queries, snapshot cache, prepend optimistic entry `{ ...input, completed: false, createdAt: new Date().toISOString(), userId: null, syncStatus: 'pending' }`, return `{ previous }`
  - [ ] `onError`: restore `ctx.previous` via `setQueryData`
  - [ ] `onSuccess`: replace optimistic entry by `id` with `{ ...serverTodo, syncStatus: 'idle' }` via `setQueryData`; **no `invalidateQueries`**
  - [ ] `retry: false`

- [ ] **Task 5: Create `components/TaskInput.tsx` (AC: #1)**
  - [ ] Controlled `<input>` with `value` / `onChange` (trim+slice to 280 chars in onChange handler)
  - [ ] `autoFocus` attribute on the `<input>` element (React handles focus-on-mount)
  - [ ] `aria-label="New task"`, `aria-describedby="empty-state-hint"`, `className` includes `text-base` (16px)
  - [ ] Mobile container: `fixed bottom-0 left-0 right-0 z-10 bg-surface px-4 py-3 pb-[calc(var(--space-3)+env(safe-area-inset-bottom))] lg:static lg:px-0 lg:py-0 lg:bg-transparent`
  - [ ] Desktop: same element, `lg:static` overrides `fixed`; rendered above `TaskList` in `TodoListClient`
  - [ ] `onKeyDown`: if `key === 'Enter'` and trimmed value is non-empty → call `mutate({ id: crypto.randomUUID(), description: value.trim() })`, clear input
  - [ ] `onSubmit` (for send button click): same commit logic
  - [ ] Send button: `<button aria-label="Add task" onClick={handleSubmit}>`; contains `<Send size={20} />`; hidden when `value.trim().length === 0` via `className` toggle; `motion-safe:transition-opacity duration-150` for the show/hide

- [ ] **Task 6: Create `components/TodoListClient.tsx` and update `app/page.tsx` (AC: #2, #6)**
  - [ ] `components/TodoListClient.tsx`: `"use client"`, renders `<TaskInput />` and `<TaskList />` together; adds `pb-24 lg:pb-0` to the scroll container to prevent content being hidden behind fixed TaskInput on mobile
  - [ ] `app/page.tsx`: import `TodoListClient` instead of `TaskList`; replace `<TaskList />` with `<TodoListClient />` inside `HydrationBoundary`

- [ ] **Task 7: Write unit tests (AC: #7)**
  - [ ] `components/TaskInput.test.tsx` (jsdom):
    - Input is auto-focused after render
    - Send button hidden when input is empty; visible with non-empty input
    - Typing 300 chars results in value capped at 280
    - Enter with valid input calls mock mutation with `{ id: <uuid>, description: <trimmed value> }`; input clears
    - Enter with empty/whitespace does NOT call mutation
  - [ ] `hooks/use-create-todo.test.ts` (jsdom):
    - `onMutate` prepends optimistic entry with `syncStatus: 'pending'` to cache
    - `onError` restores cache snapshot
    - `onSuccess` replaces optimistic entry (found by id) with server response + `syncStatus: 'idle'`

- [ ] **Task 8: Configure Playwright and write E2E tests (AC: #8)**
  - [ ] Create `playwright.config.ts` at project root:
    - `baseURL: process.env.BASE_URL || 'http://localhost:3000'`
    - `use: { browserName: 'chromium' }`
    - `testDir: './e2e'`
    - Ensure `webServer` block starts `pnpm dev` when `BASE_URL` is not set
  - [ ] Create `e2e/fixtures/test-db.ts`: exports `cleanupTodos()` function that truncates the `todos` table via the project's `db/client.ts` for test isolation
  - [ ] Create `e2e/capture.spec.ts`:
    - `beforeEach`: call `cleanupTodos()` to reset DB state
    - Journey 1: navigate to `/` → assert EmptyState visible → fill input → press Enter → assert todo text appears in list → `page.reload()` → assert todo still visible
    - Journey 2: insert a seed todo via DB directly → navigate to `/` → assert seed todo visible → fill input with new task → press Enter → assert new task is first in list, seed todo is second
  - [ ] Add `pnpm test:e2e` script to `package.json`

- [ ] **Task 9: Verify all gates (AC: #9)**
  - [ ] `pnpm lint` clean
  - [ ] `pnpm typecheck` clean
  - [ ] `pnpm test` green (all existing 53 + new Vitest tests)
  - [ ] `pnpm build` succeeds
  - [ ] `pnpm test:e2e` passes locally (run with `pnpm dev` active in another terminal, or use the `webServer` config)

## Dev Notes

### `OptimisticTodo` — wire-shape vs cache-shape type split

The TanStack Query cache holds entries that start as `OptimisticTodo` (with `syncStatus: 'pending'`) and transition to `{ ...serverTodo, syncStatus: 'idle' }` on success. The `TodoApiSchema` (Zod) never validates `syncStatus` — it's a synthetic client-only field. Add `OptimisticTodo` to `lib/validation.ts` next to `Todo`:

```ts
// lib/validation.ts — additions
export type SyncStatus = 'idle' | 'pending' | 'failed';
export type OptimisticTodo = Todo & { syncStatus?: SyncStatus };
```

Update `useTodos` and the cache `setQueryData` calls in `useCreateTodo` to use `OptimisticTodo[]`. `TaskItem` accepts `OptimisticTodo` but does not render `syncStatus` yet (Story 4.1 adds `ErrorIndicator`).

### `useCreateTodo` — full implementation

```ts
// hooks/use-create-todo.ts
'use client'; // not needed for hooks — hooks are always client code, but no directive needed
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { TodoCreateInput } from '@/lib/validation';
import type { OptimisticTodo } from '@/lib/validation';

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TodoCreateInput) => apiClient.createTodo(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previous = queryClient.getQueryData<OptimisticTodo[]>(['todos']);
      queryClient.setQueryData<OptimisticTodo[]>(['todos'], (old = []) => [
        {
          ...input,
          completed: false,
          createdAt: new Date().toISOString(),
          userId: null,
          syncStatus: 'pending',
        },
        ...old,
      ]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData<OptimisticTodo[]>(['todos'], ctx.previous);
      }
    },
    onSuccess: (serverTodo, input) => {
      queryClient.setQueryData<OptimisticTodo[]>(['todos'], (old = []) =>
        old.map((t) =>
          t.id === input.id ? { ...serverTodo, syncStatus: 'idle' } : t,
        ),
      );
    },
    retry: false,
  });
}
```

**Critical invariant: never call `invalidateQueries` on success.** This would trigger a refetch that fights the optimistic state. The `setQueryData` in `onSuccess` is the authoritative reconcile.

### `apiClient.createTodo` — implementation

Add to the `apiClient` object in `lib/api-client.ts`:

```ts
import type { TodoCreateInput } from './validation';

// Inside the apiClient object:
async createTodo(input: TodoCreateInput): Promise<Todo> {
  const res = await fetch('/api/todos', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
  const body = z.object({ todo: TodoApiSchema }).parse(await res.json());
  return body.todo;
},
```

Note: `createTodo` doesn't use the shared `fetchJson` helper because it needs a `POST` with a body. `fetchJson` only does `GET`. Either extend `fetchJson` to accept options, or implement `createTodo` inline as shown above.

### `TaskInput` — CSS positioning strategy

Single `<div>` container with Tailwind classes that flip from `fixed` (mobile) to `static` (desktop):

```tsx
<div className="
  fixed bottom-0 left-0 right-0 z-10
  bg-surface border-t border-border-subtle
  px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]
  lg:static lg:border-none lg:bg-transparent lg:px-0 lg:py-0 lg:pb-0
  w-full max-w-[640px] lg:mx-auto
">
  <div className="relative flex items-center gap-2">
    <input
      ref={inputRef}
      autoFocus
      aria-label="New task"
      aria-describedby="empty-state-hint"
      className="flex-1 text-base text-foreground bg-surface outline-none placeholder-foreground-muted"
      value={value}
      onChange={(e) => setValue(e.target.value.slice(0, 280))}
      onKeyDown={handleKeyDown}
    />
    {value.trim().length > 0 && (
      <button
        aria-label="Add task"
        onClick={handleSubmit}
        className="w-[44px] h-[44px] flex items-center justify-center text-accent motion-safe:transition-opacity"
      >
        <Send size={20} />
      </button>
    )}
  </div>
</div>
```

Important: On mobile, `fixed` positions the element relative to the viewport. The `TodoListClient`'s scroll container must add `pb-24 lg:pb-0` so the last todo isn't hidden behind the fixed bar.

On desktop, `lg:static` removes `position: fixed`. The container is placed above `<TaskList />` in `TodoListClient` and constrained to the same `max-w-[640px]` column.

### `TodoListClient` — layout structure

```tsx
// components/TodoListClient.tsx
'use client';
import { TaskInput } from './TaskInput';
import { TaskList } from './TaskList';

export function TodoListClient() {
  return (
    // pb-24 reserves space for the fixed TaskInput on mobile; lg:pb-0 removes it on desktop
    <div className="w-full flex flex-col flex-1 pb-24 lg:pb-0">
      {/* On desktop, TaskInput renders here (natural flow, top of column) */}
      {/* On mobile, TaskInput uses position:fixed so its DOM position doesn't matter */}
      <TaskInput />
      <TaskList />
    </div>
  );
}
```

`app/page.tsx` change:
```tsx
// Replace <TaskList /> with <TodoListClient />
import { TodoListClient } from '@/components/TodoListClient';
// ...
<HydrationBoundary state={dehydrate(queryClient)}>
  <TodoListClient />
</HydrationBoundary>
```

### `TaskInput` send-button visibility — CSS vs conditional render

Two valid approaches:
1. **Conditional render** (used in code above): `{value.trim().length > 0 && <button>}` — simple, no transition needed.
2. **CSS opacity**: always render the button, toggle `opacity-0 pointer-events-none` → `opacity-100`. Supports `motion-safe:transition-opacity`.

Prefer approach 2 if you want the `motion-safe:transition-opacity` effect. Prefer approach 1 if keeping the DOM minimal is preferred (the spec allows either — "appears" is intentionally vague about implementation).

Either way: `prefers-reduced-motion` should make the appearance instant — with approach 1 this is free (no transition exists); with approach 2 use `motion-safe:transition-opacity` (not `transition-opacity` globally).

### Playwright config

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000' },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
```

The `webServer` block auto-starts `pnpm dev` when running tests locally without `BASE_URL`. With `BASE_URL` set (CI), it skips the dev server.

### E2E test DB fixture

The `e2e/fixtures/test-db.ts` fixture uses the same `db/client.ts` and `db/queries.ts` as the app. **This imports `server-only` modules** — E2E tests run in Node (not Vitest's jsdom), so the `server-only` guard is fine. But Playwright runs in its own process, not through Vitest, so the `server-only` stub in `vitest.config.ts` doesn't apply. The real `server-only` guard should pass in Node/Playwright.

```ts
// e2e/fixtures/test-db.ts
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';

export async function cleanupTodos() {
  await db.execute(sql`TRUNCATE TABLE todos`);
}

export async function seedTodo(id: string, description: string) {
  const { createTodo } = await import('@/db/queries');
  await createTodo({ id, description }, null);
}
```

Note: Playwright needs the `@` alias to resolve. Add a `tsconfig.json` path alias or configure Playwright's `require` to resolve `@`. Alternatively, use relative imports in `e2e/` to avoid the alias.

**Simpler approach** for E2E fixtures: use the actual REST API (`fetch('/api/todos', { method: 'POST', ... })`) instead of direct DB calls. This avoids the `@` alias issue and `server-only` constraints entirely:

```ts
// e2e/fixtures/test-db.ts — HTTP approach (no direct DB import)
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

export async function seedTodo(id: string, description: string) {
  await fetch(`${BASE}/api/todos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, description }),
  });
}

export async function cleanupTodos() {
  // No direct TRUNCATE via API — instead, track seeded IDs and clean up
  // Or: expose a test-only endpoint (deferred)
  // For now: use a separate DB call via pg directly (not via drizzle/server-only)
}
```

**Recommended approach**: Use the HTTP API for seeding (already idempotent), and for cleanup use a raw `pg` connection (no `server-only` concern):

```ts
// e2e/fixtures/test-db.ts
import pg from 'pg';
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

export async function withCleanDb<T>(fn: () => Promise<T>): Promise<T> {
  await client.connect();
  await client.query('TRUNCATE TABLE todos');
  try {
    return await fn();
  } finally {
    await client.query('TRUNCATE TABLE todos');
    await client.end();
  }
}
```

This avoids importing `server-only` in E2E test files.

### `useCreateTodo` test pattern

Use `renderHook` with a `QueryClientProvider` wrapper (same pattern as `use-todos.test.ts`). Mock `apiClient.createTodo` with `vi.fn()`. Check `queryClient.getQueryData(['todos'])` directly to verify cache mutations.

```ts
// hooks/use-create-todo.test.ts
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    listTodos: vi.fn(),
    createTodo: vi.fn(),
  },
}));

it('onMutate prepends optimistic entry with syncStatus pending', async () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData<OptimisticTodo[]>(['todos'], []);

  // Stall the mutation to inspect mid-flight state
  vi.mocked(apiClient.createTodo).mockImplementation(() => new Promise(() => {}));

  const wrapper = createWrapper(queryClient);
  const { result } = renderHook(() => useCreateTodo(), { wrapper });

  act(() => {
    result.current.mutate({ id: '11111111-1111-4111-8111-111111111111', description: 'test' });
  });

  await waitFor(() => {
    const data = queryClient.getQueryData<OptimisticTodo[]>(['todos']);
    expect(data?.[0]?.syncStatus).toBe('pending');
  });
});
```

### `TaskInput` test — auto-focus

```tsx
// components/TaskInput.test.tsx
it('is auto-focused on mount', () => {
  render(<TaskInput />);
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: /new task/i }));
});
```

Note: `autoFocus` on an `<input>` is respected by jsdom via Testing Library's `render`. No `act()` or `await` needed for the focus assertion.

### Previous story learnings (from Story 1.4)

- `// @vitest-environment node` header is required on DB integration test files — do NOT add it to new component/hook tests (they run under jsdom by default).
- `test/setup.ts` registers `afterEach(cleanup)` — no manual cleanup needed in new test files.
- `as unknown as ReturnType<typeof useXxx>` cast is required when mocking hooks with partial return types.
- The `isServer` pattern in `app/providers.tsx` is the canonical TanStack v5 pattern — don't change it.
- `app/page.tsx` has `export const dynamic = "force-dynamic"` — preserve this.
- Import graph: `components/**` MUST NOT import from `db/**` or `app/api/**`. `hooks/**` MUST NOT import from `db/**` or `components/**`. `app/page.tsx` → `db/queries` is the only allowed Server-Component DB import.

### Files this story creates/modifies

**New files:**
```
hooks/
└── use-create-todo.ts
└── use-create-todo.test.ts
components/
├── TaskInput.tsx
├── TaskInput.test.tsx
└── TodoListClient.tsx
e2e/
├── capture.spec.ts
└── fixtures/
    └── test-db.ts
playwright.config.ts
```

**Modified files:**
```
lib/validation.ts           — add SyncStatus, OptimisticTodo types
hooks/use-todos.ts          — update return type to OptimisticTodo[]
components/TaskItem.tsx     — update prop type to OptimisticTodo
components/TaskList.tsx     — update types to OptimisticTodo
lib/api-client.ts           — add createTodo()
app/page.tsx                — replace <TaskList /> with <TodoListClient />
package.json                — add test:e2e script, @playwright/test devDep
```

### References

- Story acceptance criteria source: `_bmad-output/planning-artifacts/epics.md` §"Story 1.5"
- Architecture optimistic mutation pattern: `architecture.md` lines 625–648
- Architecture TodoListClient pattern: `architecture.md` lines 324–341
- UX TaskInput spec: `ux-design-specification.md` §"TaskInput", UX-DR4, UX-DR18
- UX responsive positioning: `ux-design-specification.md` §"Responsive Design", UX-DR19
- UX motion: `ux-design-specification.md` §"Motion & Transitions", UX-DR12
- NFR11 iOS font-size: `prd.md` NFR11
- Import graph rules: `AGENTS.md` §"Import graph"
- Design tokens: `AGENTS.md` §"Design tokens"
- No modals policy: `AGENTS.md` §"No modals, ever"

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

### Review Findings

- [x] [Review][Patch] IME composition Enter submits incomplete CJK text [components/TaskInput.tsx:18-22] — guard with `e.nativeEvent.isComposing`
- [x] [Review][Patch] Playwright runs tests with default parallelism, races TRUNCATE [playwright.config.ts] — set `workers: 1`
- [x] [Review][Patch] `cleanupTodos` will TRUNCATE any DB pointed to by `DATABASE_URL` with no guard [e2e/fixtures/test-db.ts:5-10] — add a safety check (refuse if URL doesn't look like a dev/test branch)
- [x] [Review][Patch] `cleanupTodos` connection leak on error [e2e/fixtures/test-db.ts:5-10] — wrap in `try/finally` to always call `client.end()`
- [x] [Review][Patch] `seedTodo` swallows non-2xx HTTP responses [e2e/fixtures/test-db.ts:12-18] — throw if `!res.ok`
- [x] [Review][Patch] Journey 2 lacks `waitForResponse` before list-order assertion [e2e/capture.spec.ts:33-38] — wait for POST before reading items
- [x] [Review][Patch] Send `<button>` has no `type` attribute [components/TaskInput.tsx:39-45] — add `type="button"` to prevent accidental form submission if ever wrapped in `<form>`
- [x] [Review][Patch] Send button focusable via Tab when hidden [components/TaskInput.tsx:42] — add `tabIndex={-1}` when `!hasContent`
- [x] [Review][Patch] `useCreateTodo` onError test does not assert optimistic insert occurred before rollback [hooks/use-create-todo.test.ts:56-74] — assert intermediate cache state contains the optimistic row before awaiting `isError`

- [x] [Review][Defer] `onError` rollback can clobber concurrent in-flight optimistic entries [hooks/use-create-todo.ts:25-29] — deferred, requires concurrent-mutation design decision; v1 UX rarely produces concurrent submissions
- [x] [Review][Defer] Server may return existing row on id collision; optimistic description silently overwritten [hooks/use-create-todo.ts:30-34] — deferred, vanishingly improbable with `crypto.randomUUID`
- [x] [Review][Defer] `value.slice(0, 280)` cuts inside Unicode surrogate pair / grapheme cluster [components/TaskInput.tsx:36] — deferred, low impact for v1
- [x] [Review][Defer] iOS Safari fixed-bottom input may be hidden behind virtual keyboard [components/TaskInput.tsx:27] — deferred, requires `visualViewport` listener
- [x] [Review][Defer] `aria-describedby="empty-state-hint"` dangles when EmptyState is unmounted [components/TaskInput.tsx:32] — deferred, screen readers gracefully ignore
- [x] [Review][Defer] `crypto.randomUUID()` undefined on insecure contexts (HTTP / older Safari) [components/TaskInput.tsx:14] — deferred, production is HTTPS on Vercel
- [x] [Review][Defer] `pb-[calc(0.75rem+env(safe-area-inset-bottom))]` hardcodes literal instead of `var(--space-3)` token [components/TaskInput.tsx:27] — deferred, also spec is internally inconsistent (AC says `--space-4`, Task says `--space-3`)
- [x] [Review][Defer] `apiClient.createTodo` 4xx/5xx error path is not unit-tested [hooks/use-create-todo.test.ts] — deferred, test gap not bug

## Change Log

| Date       | Change                        |
| ---------- | ----------------------------- |
| 2026-04-29 | Story 1.5 spec created        |
| 2026-04-29 | Code review — 9 patches, 8 deferrals |
