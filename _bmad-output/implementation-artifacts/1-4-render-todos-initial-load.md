# Story 1.4: Render existing todos on initial load with TaskList, TaskItem (read-only), and EmptyState

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a returning user,
I want to see my existing todos immediately when I open the app, with no spinner, no flash, and a clear empty state when I have none,
so that the app feels instant and dependable from the first paint.

## Acceptance Criteria

1. **`app/page.tsx` is a Server Component that hydrates the TanStack Query client cache.**
   - Calls `getTodos(null)` directly (not via fetch) to get the initial list.
   - Creates a `QueryClient` (fresh per request — not a module-level singleton), calls `queryClient.prefetchQuery({ queryKey: ['todos'], queryFn: () => todos })`, and wraps the client subtree in `<HydrationBoundary state={dehydrate(queryClient)}>`.
   - No network request is fired from the client on initial render — the cache is already populated.

2. **`app/providers.tsx` is a `'use client'` component that wraps children in `QueryClientProvider`.**
   - Uses a `useRef`-based singleton so the same `QueryClient` instance persists across re-renders without recreating it on every render.
   - The `QueryClient` is configured with `defaultOptions: { queries: { staleTime: Infinity, retry: 1 } }`.
   - `app/layout.tsx` is updated to wrap `{children}` with `<Providers>`.

3. **`components/TaskList.tsx` renders the todo list or `EmptyState`.**
   - Imports `useTodos` and renders the results in a `<ul role="list">`.
   - Each todo is rendered as `<TaskItem key={todo.id} todo={todo} />`.
   - The container is `max-w-[640px] mx-auto w-full` on `md+` breakpoints, full-width on mobile (UX-DR19).
   - When the list is empty (`todos.length === 0`), renders `<EmptyState />` instead of the list.

4. **`components/TaskItem.tsx` renders a single todo row (read-only in this story).**
   - The row is `role="listitem"`, `min-h-[48px]`, with `py-3 px-6` padding.
   - Left: Lucide `Circle` icon (24×24) inside a 44×44px hit-target `<div>` — **non-interactive in this story** (no `<button>` yet; that comes in Story 2.2). The icon slot has a fixed `w-[44px] h-[44px]` with flex centering.
   - Center: description text, `text-base` (16px), Inter Regular, `truncate` (single-line ellipsis on overflow).
   - Right: placeholder `<div className="w-[44px]" />` to reserve space for the future delete affordance (Story 3.3).
   - No completed state in this story (completed state + toggle come in Story 2.2).

5. **`components/EmptyState.tsx` renders viewport-appropriate helper text.**
   - A single line of muted text, no illustration, no icon, no CTA button.
   - Desktop (`lg:` breakpoint): `"Type a task and press Enter"`.
   - Mobile (base): `"Tap to add your first task"`.
   - Has `aria-live="polite"` so screen readers announce when the list becomes empty.
   - Has an `id` prop or stable `id="empty-state-hint"` so `TaskInput` (Story 1.5) can reference it via `aria-describedby`.

6. **`hooks/use-todos.ts` wraps TanStack Query `useQuery`.**
   - Returns `useQuery({ queryKey: ['todos'], queryFn: () => apiClient.listTodos(), staleTime: Infinity })`.
   - Exports: `function useTodos(): UseQueryResult<Todo[]>`.

7. **`lib/api-client.ts` is created with `listTodos()`.**
   - Calls `fetch('/api/todos')` and parses the response body.
   - Uses `TodoApiSchema` (array variant) for runtime Zod validation so type errors in the API response surface early.
   - Returns `Promise<Todo[]>` (where `Todo` is the wire-shape type from `lib/validation.ts` with `createdAt: string`).
   - Throws a typed `ApiError` on non-2xx responses.

8. **`lib/validation.ts` is updated to export `TodoApiSchema` (wire shape).**
   - Adds `export const TodoApiSchema = z.object({ id: z.string().uuid(), description: z.string(), completed: z.boolean(), createdAt: z.string(), userId: z.string().uuid().nullable() })`.
   - The existing `export type { Todo }` re-export from `@/db/schema` is **replaced** by `export type Todo = z.infer<typeof TodoApiSchema>`.
   - The server-side Drizzle `Todo` type (with `createdAt: Date`) stays in `db/schema.ts` for server use only; `lib/validation.ts`'s `Todo` is now the client-facing wire-shape type (`createdAt: string`).

9. **Vitest is extended for React component tests.**
   - New packages installed (devDependencies): `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`, `jsdom`.
   - `vitest.config.ts` gains a `plugins: [react()]` entry and a per-file environment override: component tests (`components/*.test.tsx`) run under `environment: 'jsdom'`; DB/API tests stay in `environment: 'node'`.
   - A `test/setup.ts` file is created with `import '@testing-library/jest-dom'` and referenced in `vitest.config.ts`'s `setupFiles`.

10. **Tests cover all three components + the hook.**
    - `components/TaskList.test.tsx`: empty list renders `EmptyState`, non-empty list renders a `<ul role="list">` with N `TaskItem`s in the correct newest-first order.
    - `components/TaskItem.test.tsx`: renders description text; has `role="listitem"`; Circle icon is present; description truncates with ellipsis class.
    - `components/EmptyState.test.tsx`: renders the correct copy per viewport (mock `window.matchMedia` or use a `data-testid` approach for each variant); has `aria-live="polite"`.
    - `hooks/use-todos.test.ts`: mocks `apiClient.listTodos`, confirms `useQuery` is called with key `['todos']`, and returns parsed todos.

11. **All gates pass.** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` all succeed after this story. `app/page.tsx` must be classified as `○` (static) or `ƒ` (dynamic) in the build output — dynamic is expected because it fetches from the DB on every request.

## Tasks / Subtasks

- [x] **Task 1: Install TanStack Query v5 and React testing deps (AC: #2, #6, #9)**
  - [x] Run `pnpm add @tanstack/react-query @tanstack/react-query-devtools`
  - [x] Run `pnpm add -D @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom`
  - [x] Confirm no peer-dep conflicts (`pnpm install` exits cleanly)

- [x] **Task 2: Add `TodoApiSchema` wire shape to `lib/validation.ts` and update `lib/api-client.ts` (AC: #7, #8)**
  - [x] In `lib/validation.ts`: add `TodoApiSchema` (z.object with string `createdAt`) and replace `export type { Todo }` with `export type Todo = z.infer<typeof TodoApiSchema>`
  - [x] Update `lib/validation.test.ts` to add tests for `TodoApiSchema`: valid response object parses, invalid `createdAt` type fails, nullable `userId` passes
  - [x] Create `lib/api-client.ts` exporting `listTodos(): Promise<Todo[]>`; uses `z.array(TodoApiSchema).parse(body.todos)`; throws `ApiError` on non-2xx
  - [x] `lib/api-client.ts` is **not** `server-only` — it uses `fetch` and is client-safe
  - [x] Verify no import graph violations (`lib/api-client.ts` must NOT import from `db/**` or `app/api/**`)

- [x] **Task 3: Create `hooks/use-todos.ts` (AC: #6)**
  - [x] `hooks/use-todos.ts` exports `useTodos()` wrapping `useQuery({ queryKey: ['todos'], queryFn: apiClient.listTodos, staleTime: Infinity })`
  - [x] Verify no import graph violations (`hooks/**` must NOT import from `db/**` or `components/**`)

- [x] **Task 4: Create `app/providers.tsx` and update `app/layout.tsx` (AC: #2)**
  - [x] `app/providers.tsx`: `'use client'`, creates `QueryClient` via official TanStack v5 `isServer` pattern (per-request on server, browser-singleton in browser); wraps `{children}` in `<QueryClientProvider>` — see Completion Notes for the deviation from `useRef`
  - [x] `app/layout.tsx`: import `Providers` from `./providers`, wrap `{children}` with `<Providers>`

- [x] **Task 5: Create `components/EmptyState.tsx` (AC: #5)**
  - [x] Renders single line of muted helper text: `lg:` shows "Type a task and press Enter", base shows "Tap to add your first task"
  - [x] Use `hidden lg:block` / `lg:hidden` Tailwind pattern (pure CSS, no JS)
  - [x] `aria-live="polite"`, `id="empty-state-hint"` (stable, used by `aria-describedby` in Story 1.5)
  - [x] No illustration, no icon, no CTA

- [x] **Task 6: Create `components/TaskItem.tsx` (read-only) (AC: #4)**
  - [x] `role="listitem"`, `min-h-[48px] py-3 px-6 flex items-center gap-3`
  - [x] Left slot: `Circle` icon (Lucide, 24×24) centered in a `w-[44px] h-[44px] flex items-center justify-center flex-shrink-0` div — **not a button** in this story
  - [x] Center: `<p className="flex-1 text-base text-foreground truncate leading-normal">{todo.description}</p>`
  - [x] Right: `<div className="w-[44px] flex-shrink-0" />` (placeholder for delete affordance)
  - [x] Accept `todo: Todo` prop (the wire-shape `Todo` from `lib/validation.ts`)

- [x] **Task 7: Create `components/TaskList.tsx` (AC: #3)**
  - [x] Calls `useTodos()` and renders `<ul role="list" className="w-full max-w-[640px] mx-auto">` with a `<TaskItem>` per todo
  - [x] When `todos.length === 0` (`isSuccess && !todos.length`), render `<EmptyState />` instead of the `<ul>`
  - [x] Handle `isLoading`/`isError` gracefully: render nothing while data is undefined (no spinner, no error banner)

- [x] **Task 8: Update `app/page.tsx` to Server Component with HydrationBoundary (AC: #1)**
  - [x] Import `{ QueryClient, dehydrate, HydrationBoundary }` from `@tanstack/react-query`
  - [x] Import `getTodos` from `@/db/queries`
  - [x] Create `queryClient = new QueryClient()` inside the component (fresh per request)
  - [x] `await queryClient.prefetchQuery({ queryKey: ['todos'], queryFn: () => getTodos(null) })`
  - [x] Render `<HydrationBoundary state={dehydrate(queryClient)}><TaskList /></HydrationBoundary>`
  - [x] `app/page.tsx` remains a Server Component — no `'use client'` directive
  - [x] Added `export const dynamic = 'force-dynamic'` to ensure DB is queried on every request (page is `ƒ` in build output)

- [x] **Task 9: Configure Vitest for React component tests (AC: #9)**
  - [x] Add `plugins: [react()]` to `vitest.config.ts`; import `react` from `@vitejs/plugin-react`
  - [x] Add `setupFiles: ['./test/setup.ts']` to `vitest.config.ts`
  - [x] Create `test/setup.ts` with `import '@testing-library/jest-dom/vitest'` (the `/vitest` subpath wires matchers without needing `globals: true`) plus an `afterEach(cleanup)` (auto-cleanup needs explicit registration when `globals: false`)
  - [x] Switch global environment to `jsdom`; add `// @vitest-environment node` headers to `db/queries.test.ts` and `app/api/todos/route.test.ts`

- [x] **Task 10: Write component + hook tests (AC: #10)**
  - [x] `components/TaskList.test.tsx`: mocks `@/hooks/use-todos`; tests empty → EmptyState; populated → `role="list"` with N items in array order; loading → renders nothing
  - [x] `components/TaskItem.test.tsx`: renders fixture todo; asserts `role="listitem"`, description text visible, Circle SVG present, `truncate` class on description
  - [x] `components/EmptyState.test.tsx`: asserts `aria-live="polite"`, stable `id="empty-state-hint"`, both mobile and desktop copies present in DOM
  - [x] `hooks/use-todos.test.ts`: mocks `apiClient.listTodos`; wraps in `QueryClientProvider`; verifies cache key `['todos']` populated with mocked data

- [x] **Task 11: Verify all gates (AC: #11)**
  - [x] `pnpm lint` clean
  - [x] `pnpm typecheck` clean
  - [x] `pnpm test` green — 53/53 (35 pre-existing + 18 new)
  - [x] `pnpm build` succeeds; `app/page.tsx` is `ƒ` (dynamic) in build output

### Review Findings

- [x] [Review][Patch] Inconsistent indentation inside `<body>` in `app/layout.tsx` [app/layout.tsx:29-32]

## Dev Notes

### Dependency Installation (Critical — not in project yet)

TanStack Query and React testing libraries are **not yet installed**. Task 1 must run first:

```bash
pnpm add @tanstack/react-query @tanstack/react-query-devtools
pnpm add -D @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
```

Verify version compatibility: `@tanstack/react-query` at v5+ is required (v5 ships with App Router integration built in). The `@tanstack/react-query-devtools` is optional but recommended for local dev.

### TanStack Query v5 API (Breaking changes vs v4)

This codebase uses **TanStack Query v5**. Key v5 API differences to avoid v4 regressions:

- `HydrationBoundary` and `dehydrate` import from `'@tanstack/react-query'`, not a separate `/ssr` subpackage.
- `useQuery` `isLoading` is now `isPending` in v5 for mutations (queries: `isLoading` still works but prefer `isPending`).
- `cacheTime` is now `gcTime` in v5.
- `QueryClientProvider` + `HydrationBoundary` composition (App Router pattern):
  ```tsx
  // app/layout.tsx
  <Providers>{children}</Providers>  // QueryClientProvider (client)

  // app/page.tsx (Server Component)
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({ queryKey: ['todos'], queryFn: () => getTodos(null) });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TaskList />
    </HydrationBoundary>
  );
  ```

- `QueryClient` in `providers.tsx` must use `useRef` pattern (not `useState` or module-level singleton) to prevent the client from being shared across server requests:
  ```tsx
  'use client';
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
  import { useRef } from 'react';

  export function Providers({ children }: { children: React.ReactNode }) {
    const queryClientRef = useRef<QueryClient>(null);
    if (!queryClientRef.current) {
      queryClientRef.current = new QueryClient({
        defaultOptions: { queries: { staleTime: Infinity, retry: 1 } },
      });
    }
    return (
      <QueryClientProvider client={queryClientRef.current}>
        {children}
      </QueryClientProvider>
    );
  }
  ```

### `Todo` Type — Wire Shape vs Server Shape

**This story introduces a wire-shape `Todo` type that replaces the Drizzle type re-export in `lib/validation.ts`.**

- **Server-side** (`db/queries.ts`, route handlers): uses `Todo` from `@/db/schema` — has `createdAt: Date`.
- **Client-side / API wire** (`lib/api-client.ts`, `hooks/*`, `components/*`): uses `Todo` from `@/lib/validation` — has `createdAt: string` (ISO 8601 string from JSON serialization).

`JSON.stringify` on a `Date` produces an ISO 8601 string automatically. `JSON.parse` produces a string. Never transform strings to `Date` on the client in v1 — components display the string directly or format it as needed in future stories.

```ts
// lib/validation.ts — add this, replace `export type { Todo }` re-export:
export const TodoApiSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  completed: z.boolean(),
  createdAt: z.string(),       // ISO string from JSON, not a Date
  userId: z.string().uuid().nullable(),
});
export type Todo = z.infer<typeof TodoApiSchema>;
```

All existing tests use `Todo` from `db/schema.ts` directly (the query tests) — they are unaffected. The only place that re-exported `Todo` from `lib/validation.ts` was documentation; now the type gets a real Zod schema.

### `lib/api-client.ts` Shape

```ts
// lib/api-client.ts
import { z } from 'zod';
import { TodoApiSchema, type Todo } from './validation';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function fetchJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`);
  }
  return schema.parse(await res.json());
}

export const apiClient = {
  async listTodos(): Promise<Todo[]> {
    const body = await fetchJson('/api/todos', z.object({ todos: z.array(TodoApiSchema) }));
    return body.todos;
  },
};
```

- `apiClient` is a plain object (not a class). This matches the architecture's pattern for later adding `createTodo`, `toggleTodo`, `deleteTodo`.
- No `server-only` import — this file is safe to import from `hooks/` and components.

### Vitest Config Update for React Tests

Current `vitest.config.ts` uses `environment: 'node'`. Component tests need `jsdom`. Recommended approach — switch global environment to `jsdom` and annotate the two existing DB/integration test files with `// @vitest-environment node`:

```ts
// vitest.config.ts changes:
plugins: [react()],  // add react() import from @vitejs/plugin-react
setupFiles: ['./test/setup.ts'],
// environment: 'node' → 'jsdom' (global change)
environment: 'jsdom',
```

Then at the top of `db/queries.test.ts` and `app/api/todos/route.test.ts`, add:
```ts
// @vitest-environment node
```

And create `test/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

### Components — UX Spec Anchors

**`TaskItem` (read-only, this story):**
- Row height ≥48px: `min-h-[48px]` — do NOT use `h-12` (fixed height would clip longer descriptions)
- Padding: `py-3 px-6` (12px vertical = `space-3`, 24px horizontal = `space-6`)
- Circle icon: `Circle` from `lucide-react`, `size={24}`. Placed in a `44×44` non-interactive div (hit target reserved for Story 2.2's button)
- Description: `text-foreground` color, `text-base` size, `leading-normal`, `truncate` for overflow
- Right placeholder: `<div className="w-[44px] flex-shrink-0" />` — exact `w-[44px]` preserves layout when delete button is added in Story 3.3

**`TaskList`:**
- `<ul role="list">` (not `<div>`) — the `role` attribute is necessary when semantic list styling is reset via Tailwind
- Container: `w-full max-w-[640px] mx-auto` — Tailwind default max-w-xl is 576px; use `max-w-[640px]` exactly (UX-DR19 specifies ~640px)
- No dividers between items (whitespace separation only per UX-DR6)

**`EmptyState`:**
- Mobile copy: "Tap to add your first task"
- Desktop copy: "Type a task and press Enter"
- CSS-only responsive: `<p className="text-sm text-foreground-muted"><span className="lg:hidden">Tap to add your first task</span><span className="hidden lg:block">Type a task and press Enter</span></p>`
- Container: centered, adjacent to where the task list would appear
- `id="empty-state-hint"` — for `aria-describedby` wiring in Story 1.5 TaskInput

### `app/page.tsx` — Server Component Pattern

```tsx
// app/page.tsx (Server Component)
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTodos } from '@/db/queries';
import { TaskList } from '@/components/TaskList';

export default async function Home() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['todos'],
    queryFn: () => getTodos(null),
  });

  return (
    <main className="flex flex-1 flex-col items-center bg-background">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TaskList />
      </HydrationBoundary>
    </main>
  );
}
```

**Important:** `getTodos(null)` returns `Todo[]` where `Todo` is the Drizzle type (with `createdAt: Date`). TanStack Query's `dehydrate` serializes the cache — Date objects are handled by the dehydration protocol and rehydrated as-is on the client. However, since the client-side `Todo` type uses `createdAt: string`, there will be a mismatch between the hydrated cache entry type and the TypeScript type. To avoid this, cast the result in `prefetchQuery` to match the wire shape, OR accept that `dehydrate` serializes `Date` as ISO string anyway (which it does — dates are serialized to strings during dehydration). The TypeScript types just need to be consistent on the client side.

**Practical approach:** The hydrated cache stores the dehydrated form (dates become strings). The client-side `useTodos()` returns data typed as `Todo[]` (with `createdAt: string`). This works at runtime because dehydrated dates are already strings. TypeScript needs the `Todo` type from `lib/validation.ts` (string createdAt) on the client.

### Import Graph Compliance

This story introduces client-side files. Import rules to enforce:
- `components/TaskList.tsx` → imports `hooks/use-todos.ts` ✅
- `hooks/use-todos.ts` → imports `lib/api-client.ts` ✅
- `lib/api-client.ts` → imports `lib/validation.ts` ✅
- `lib/api-client.ts` → **MUST NOT** import from `db/**` or `app/api/**` ✅
- `components/**` → **MUST NOT** import from `db/**` or `app/api/**` ✅
- `app/page.tsx` → imports `db/queries.ts` directly (Server Component only) ✅

### Testing Patterns for Components

Use `@testing-library/react`'s `render` and `screen`:

```tsx
// Wrapper with QueryClientProvider for hook tests:
const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
```

For `TaskList.test.tsx`, mock `@/lib/api-client` to avoid real fetch calls:
```ts
vi.mock('@/lib/api-client', () => ({ apiClient: { listTodos: vi.fn() } }));
```

Stub `@/hooks/use-todos` directly in `TaskList.test.tsx` to avoid full hook wiring:
```ts
vi.mock('@/hooks/use-todos', () => ({
  useTodos: () => ({ data: mockTodos, isSuccess: true, isPending: false })
}));
```

### Previous Story Intelligence (from 1.3)

Key decisions from Story 1.3 that affect this story:
- `lib/validation.ts` currently exports `TodoCreateSchema`, `TodoUpdateSchema`, and `export type { Todo }` (re-export from `db/schema`). The `Todo` type re-export will be **replaced** in Task 2 with the wire-shape Zod schema.
- `vitest.config.ts` already has `fileParallelism: false` and `resolve.alias["@"]` — both are preserved. The new `plugins: [react()]` is added alongside.
- The `test/stubs/server-only.ts` stub already exists — component tests do not import server-only modules, so no new stubs needed.
- `db/queries.ts` exports `getTodoById` and `createTodo` with `userId: string | null` — `getTodos(null)` is already the pattern for `app/page.tsx`.

### Next-Story Notes (for 1.5, 2.2)

- Story 1.5 adds `TaskInput` with optimistic create. It will need `useCreateTodo` hook and the full `TodoListClient` client wrapper. The `TaskList` created here should be importable from a `TodoListClient` without modification.
- Story 2.2 makes `TaskItem`'s Circle icon interactive — the left slot div created here should be easily promoted to a `<button>`. Do not put the icon directly in the row; keep the slot div pattern.
- The `syncStatus: 'idle' | 'pending' | 'failed'` field (architecture requirement for optimistic updates) is a synthetic client-side field. It is NOT in `TodoApiSchema`. Story 1.5 introduces it as part of the optimistic cache entry. For now, components need not accept or render `syncStatus`.
- `ApiError` class in `lib/api-client.ts` will be used by `createTodo`, `toggleTodo`, `deleteTodo` in subsequent stories. Ensure it is exported from `lib/api-client.ts`.

### Project Structure Notes

**New files this story creates:**
```
lib/
└── api-client.ts             # NEW — listTodos() fetch wrapper
hooks/
└── use-todos.ts              # NEW
app/
├── providers.tsx             # NEW — QueryClientProvider ('use client')
└── page.tsx                  # MODIFIED — Server Component with HydrationBoundary
components/
├── TaskList.tsx              # NEW
├── TaskList.test.tsx         # NEW
├── TaskItem.tsx              # NEW
├── TaskItem.test.tsx         # NEW
├── EmptyState.tsx            # NEW
└── EmptyState.test.tsx       # NEW
test/
└── setup.ts                  # NEW — @testing-library/jest-dom import
```

**Modified files:**
```
lib/validation.ts             # MODIFIED — add TodoApiSchema, replace Todo type re-export
lib/validation.test.ts        # MODIFIED — add TodoApiSchema tests
app/layout.tsx                # MODIFIED — add <Providers> wrapper
vitest.config.ts              # MODIFIED — jsdom environment, react plugin, setupFiles
package.json                  # MODIFIED — new deps
pnpm-lock.yaml                # MODIFIED
db/queries.test.ts            # MODIFIED — add // @vitest-environment node header
app/api/todos/route.test.ts   # MODIFIED — add // @vitest-environment node header
```

### References

- Story acceptance criteria source: [`_bmad-output/planning-artifacts/epics.md` §"Story 1.4"](../planning-artifacts/epics.md#story-14-render-existing-todos-on-initial-load-with-tasklist-taskitem-read-only-and-emptystate)
- TanStack Query App Router pattern: architecture.md §"Frontend Architecture" (lines 311–344)
- Component specs: architecture.md §"Structure Patterns" + ux-design-specification.md §"Custom Components"
- UX empty state: ux-design-specification.md §"EmptyState", UX-DR8
- UX TaskItem read-only state: ux-design-specification.md §"TaskItem", UX-DR5 (partial)
- UX layout / breakpoints: ux-design-specification.md §"Responsive Design", UX-DR19, UX-DR20
- Import graph rules: AGENTS.md §"Import graph"
- No modals policy: AGENTS.md §"No modals, ever (UX policy)"
- Design tokens: AGENTS.md §"Design tokens"
- Previous story learnings: `1-3-api-todos-routes-validation.md` §"Completion Notes List"

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (initial implementation) → Claude Opus 4.7 (1M context) (lint resolution + final gates)

### Debug Log References

- `pnpm test` after first wiring failed with `expect is not defined`. Cause: `globals: false` in `vitest.config.ts` means `@testing-library/jest-dom`'s top-level `expect` extension can't find Vitest's expect. Fix: import `@testing-library/jest-dom/vitest` (Vitest-specific entry point that registers matchers via `expect.extend` from `vitest`).
- Second test run: 4 component tests failed because the JSDOM document accumulated nodes across test cases (every previous render's output stayed in `document.body`). Cause: `@testing-library/react`'s auto-cleanup hook requires Vitest's `afterEach` to be globally registered, which `globals: false` disables. Fix: explicitly register `afterEach(cleanup)` in `test/setup.ts`.
- `pnpm lint` first pass: 3 errors. Two were the React 19 `react-hooks/refs` rule rejecting the spec's `useRef`-based `QueryClient` pattern (rule disallows reading `.current` during render even after a null-init guard). Switched to TanStack Query's official `isServer` pattern (per-request `QueryClient` on server, module-level singleton in browser). The remaining errors were a missing `displayName` on a test wrapper component and an unused destructured variable in a Zod missing-fields test — both fixed without rule suppression.
- `pnpm build` first pass: page classified as `○` (static) because Next.js prerendered it during build using a live DB connection. AC #11 accepts both `○` and `ƒ` but the rationale states dynamic is expected (fresh data per request). Added `export const dynamic = 'force-dynamic'` to `app/page.tsx`; rebuild produced `ƒ /`.

### Completion Notes List

- **Spec deviation — `app/providers.tsx` uses `isServer` instead of `useRef`.** The story spec (AC #2 + Dev Notes) prescribed a `useRef`-based singleton. React 19's `react-hooks/refs` lint rule disallows reading `ref.current` during render (even after the documented `if (ref.current == null)` init guard) when that value is then passed as a prop. The TanStack Query v5 official Next.js App Router pattern uses `isServer` from `@tanstack/react-query` to return a fresh `QueryClient` per server request and a module-level singleton in the browser — this satisfies the spec's *intent* (no cross-request server-state sharing, stable client across re-renders) without violating the lint rule. No `eslint-disable` comments were added.
- **Wire shape `Todo` introduced.** `lib/validation.ts` now defines `TodoApiSchema` (with `createdAt: string`) and exports `Todo = z.infer<typeof TodoApiSchema>`. The Drizzle row type from `db/schema.ts` (with `createdAt: Date`) remains in use by `db/queries.ts` and the API route handlers. `dehydrate` serializes the cache (Date → ISO string) before HydrationBoundary embeds it in HTML, so the wire shape is correct on the client.
- **Vitest environment switch.** Global `environment` is now `jsdom`. Two integration test files (`db/queries.test.ts`, `app/api/todos/route.test.ts`) carry a `// @vitest-environment node` header to keep the `pg` driver and Node-only `Request`/`Response` semantics intact.
- **Smoke test.** Started `pnpm dev`, hit `GET /` while DB was empty → response HTML contains `id="empty-state-hint"` plus both EmptyState copies (mobile/desktop, gated by Tailwind classes). Inserted a row via `POST /api/todos`, refreshed `/` → response HTML contains `role="list"` and a `listitem` with the todo description. Confirms the HydrationBoundary path is wired correctly.
- **`force-dynamic` chosen over `revalidate = 0`.** Both work; `force-dynamic` is explicit about the intent and matches the spec rationale ("fetches from the DB on every request").

### File List

**New:**
- `lib/api-client.ts`
- `hooks/use-todos.ts`
- `hooks/use-todos.test.ts`
- `app/providers.tsx`
- `components/TaskList.tsx`
- `components/TaskList.test.tsx`
- `components/TaskItem.tsx`
- `components/TaskItem.test.tsx`
- `components/EmptyState.tsx`
- `components/EmptyState.test.tsx`
- `test/setup.ts`

**Modified:**
- `lib/validation.ts` — added `TodoApiSchema`, replaced `Todo` re-export from `db/schema` with `z.infer<typeof TodoApiSchema>`
- `lib/validation.test.ts` — added `TodoApiSchema` test suite
- `app/layout.tsx` — wrapped `{children}` with `<Providers>`
- `app/page.tsx` — converted to async Server Component with `prefetchQuery` + `HydrationBoundary`; added `export const dynamic = "force-dynamic"`
- `vitest.config.ts` — added `plugins: [react()]`, `setupFiles: ['./test/setup.ts']`, switched `environment` from `node` to `jsdom`
- `db/queries.test.ts` — added `// @vitest-environment node` header
- `app/api/todos/route.test.ts` — added `// @vitest-environment node` header
- `package.json`, `pnpm-lock.yaml` — new deps: `@tanstack/react-query`, `@tanstack/react-query-devtools`, `@testing-library/react`, `@testing-library/jest-dom`, `@vitejs/plugin-react`, `jsdom`

## Change Log

| Date       | Change                                                                                  |
| ---------- | --------------------------------------------------------------------------------------- |
| 2026-04-28 | Story 1.4 implemented: TanStack Query v5 hydration, TaskList/TaskItem/EmptyState, wire-shape `Todo`, Vitest jsdom config. 53/53 tests pass. |

