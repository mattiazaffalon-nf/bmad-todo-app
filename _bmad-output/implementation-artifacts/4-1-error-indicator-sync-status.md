# Story 4.1: Implement ErrorIndicator component with per-task syncStatus surface

Status: review

## Story

As a user,
I want a calm, non-alarming inline indicator on any task whose background sync failed, with a clear retry affordance,
So that I know which actions need my attention without being interrupted by modals or red banners.

## Acceptance Criteria

**AC #1 — `components/ErrorIndicator.tsx` component**

- Renders a Lucide `AlertCircle` icon (16×16, `text-error-foreground` muted amber) followed by helper text `"Couldn't save — tap to retry"` (14px, same color).
- Entire indicator is a `<button>` (`type="button"`) with `aria-label="Couldn't save, tap to retry"` (note comma, not em-dash). Icon has `aria-hidden="true"`.
- 44×44 hit target (`min-w-[44px] min-h-[44px]`), content centered.
- Accepts props: `onRetry: () => void`, `retrying: boolean`.
- Color is muted amber `--error-foreground` — never bright red. Meaning conveyed by icon + text, not color alone.

**AC #2 — Retrying visual state**

- When `retrying` is `true`: icon swaps to Lucide `RotateCw` (same 16×16 size) with a CSS rotation animation — 1 full revolution per second, infinite.
- When `prefers-reduced-motion` is enabled: `RotateCw` icon still appears (swap still happens) but the rotation animation is suppressed (`motion-reduce:animate-none`).
- When `retrying` is `false`: static `AlertCircle` icon.

**AC #3 — Inline rendering in `TaskItem`**

- `TaskItem` renders `<ErrorIndicator onRetry={() => {}} retrying={false} />` inline when `todo.syncStatus === 'failed'`.
- Placed between the task description `<p>` and the hover-reveal delete button (i.e. inserted into the existing flex row, text still truncates naturally).
- Does not displace or restyle the rest of the row. The checkbox, hover-reveal trash button, and swipe gestures remain fully interactive.
- Story 4.2 will wire `onRetry` to actual mutation logic and wire `retrying` state; for this story both are placeholders.

**AC #4 — Hook `onError` handlers set `syncStatus: 'failed'`**

- `hooks/use-create-todo.ts` `onError`: instead of restoring the full previous snapshot (which drops the task from the list), update the cache entry's `syncStatus` to `'failed'` so the task remains visible with `ErrorIndicator`.
- `hooks/use-toggle-todo.ts` `onError`: same pattern — keep the task in the list, set `syncStatus: 'failed'` on the matching entry (the entry's `completed` field should reflect the *intended* (failed) value, not rolled back, so the user sees what they tried to do). Retain the previous snapshot as fallback if the entry is not found.
- `hooks/use-delete-todo.ts` already sets `syncStatus: 'failed'` on error — **no change needed**.
- `hooks/use-create-todo.ts` `onSuccess` + `hooks/use-toggle-todo.ts` `onSuccess`: ensure the cache entry's `syncStatus` is set to `'idle'` when the mutation succeeds (reconcile from server response).

**AC #5 — Desktop-only scope**

- No mobile-specific ACs, no touch-specific hit-target adjustments beyond what is already in place.
- `prefers-reduced-motion` and keyboard accessibility are in scope (desktop-relevant).
- The ErrorIndicator is desktop-first: always keyboard-focusable, hover states follow existing patterns.

**AC #6 — Vitest tests in `components/ErrorIndicator.test.tsx`**

- Renders `AlertCircle` and static copy when `retrying: false`.
- Renders `RotateCw` when `retrying: true` (and rotation animation class is applied unless `matchMedia` mocks `prefers-reduced-motion`).
- Clicking the button calls `onRetry`.
- Pressing Enter/Space on the focused button calls `onRetry` (keyboard contract).
- `aria-label` is `"Couldn't save, tap to retry"` and icon has `aria-hidden`.

**AC #7 — All quality gates pass**

- `pnpm lint` clean.
- `pnpm typecheck` clean.
- `pnpm test` — all prior tests green + new tests.
- `pnpm build` clean.
- No changes to `db/**`, `app/api/**`, `lib/validation.ts`, `lib/constants.ts`.

## Tasks / Subtasks

- [x] **Task 1: Create `components/ErrorIndicator.tsx` (AC #1, #2)**
  - [x] New file: `components/ErrorIndicator.tsx` (PascalCase component, `"use client"`)
  - [x] Import `AlertCircle`, `RotateCw` from `lucide-react`
  - [x] Props: `interface ErrorIndicatorProps { onRetry: () => void; retrying: boolean; }`
  - [x] When `retrying=false`: render `AlertCircle size={16}` + `<span>Couldn't save — tap to retry</span>` (14px text)
  - [x] When `retrying=true`: render `RotateCw size={16}` with `animate-spin motion-reduce:animate-none`
  - [x] Button wrapper: `type="button"`, `aria-label="Couldn't save, tap to retry"`, `onClick={onRetry}`, min 44×44 hit target
  - [x] Both icons: `aria-hidden="true"`, `text-error-foreground`, `flex-shrink-0`
  - [x] Text: `text-sm text-error-foreground` (14px = Tailwind `text-sm`)
  - [x] `pnpm typecheck` passes

- [x] **Task 2: Write `components/ErrorIndicator.test.tsx` (AC #6)**
  - [x] `// @vitest-environment jsdom`
  - [x] Test: `retrying=false` shows AlertCircle and "Couldn't save" text
  - [x] Test: `retrying=true` shows RotateCw icon
  - [x] Test: `retrying=true` with `prefers-reduced-motion` mocked — RotateCw still shown, but `animate-spin` class absent (check `motion-reduce:animate-none` is on the element)
  - [x] Test: clicking button invokes `onRetry`
  - [x] Test: `aria-label="Couldn't save, tap to retry"` on the button
  - [x] Test: icon has `aria-hidden="true"`
  - [x] `pnpm test` passes

- [x] **Task 3: Render `ErrorIndicator` in `TaskItem` (AC #3)**
  - [x] Import `ErrorIndicator` from `./ErrorIndicator`
  - [x] In the flex row, after the `<p>` description and before the delete button, add:
    `{todo.syncStatus === 'failed' && <ErrorIndicator onRetry={() => {}} retrying={false} />}`
  - [x] Verify the `<p>` description still has `flex-1 truncate` so long text doesn't overflow
  - [x] `pnpm typecheck` and `pnpm lint` pass

- [x] **Task 4: Update `use-create-todo.ts` `onError` to set `syncStatus: 'failed'` (AC #4)**
  - [x] In `onError`: instead of restoring `ctx.previous` wholesale, update only the matching cache entry's `syncStatus` to `'failed'`:
    ```ts
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
      old.map((t) => (t.id === variables.id ? { ...t, syncStatus: "failed" as const } : t))
    );
    ```
  - [x] Keep `ctx.previous` fallback if the entry is not found in the current cache (defensive)
  - [x] In `onSuccess`: call `setQueryData` to reconcile the todo from the server response and set `syncStatus: 'idle'` (the current pattern should already do this; verify and explicitly add `syncStatus: 'idle'` to the reconciled entry)
  - [x] `pnpm typecheck` passes

- [x] **Task 5: Update `use-toggle-todo.ts` `onError` to set `syncStatus: 'failed'` (AC #4)**
  - [x] In `onError`: update the matching entry's `syncStatus` to `'failed'`; keep its `completed` field at the *intended* (post-toggle) value so the visual state reflects what the user tried to do:
    ```ts
    queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
      old.map((t) => (t.id === variables.id ? { ...t, syncStatus: "failed" as const } : t))
    );
    ```
  - [x] In `onSuccess`: ensure `syncStatus: 'idle'` is set when the mutation reconciles
  - [x] `pnpm typecheck` passes

- [x] **Task 6: Verify quality gates (AC #7)**
  - [x] `pnpm lint` — clean
  - [x] `pnpm typecheck` — clean
  - [x] `pnpm test` — all tests green
  - [x] `pnpm build` — clean

## Dev Notes

### Scope boundary: Story 4.1 vs Story 4.2

**Story 4.1 (this story):**
- Build and render `ErrorIndicator` component (visual states: idle alert + retrying spinner).
- Hook mutation errors surface to UI: `syncStatus: 'failed'` → `ErrorIndicator` appears.
- `onRetry={() => {}}` is a no-op placeholder in `TaskItem`; `retrying={false}` is hardcoded.

**Story 4.2 (next story):**
- Wire `onRetry` to re-fire the correct mutation (create / toggle / delete).
- Wire `retrying` state (track when a retry is in flight).
- Journey 5 E2E (failure → indicator → retry → success).

**Do NOT implement retry logic in this story.**

### Desktop-only scope (from `_bmad-output/implementation-artifacts/deferred-work.md`)

This is a hobby project. Mobile browser support is out of scope for v1. For Epic 4:
- No mobile-specific ACs.
- Keep `prefers-reduced-motion`, keyboard accessibility — desktop-relevant.
- No mobile sub-journeys in E2E.

### `OptimisticTodo` and `syncStatus`

From `lib/validation.ts`:
```ts
export type SyncStatus = "idle" | "pending" | "failed";
export type OptimisticTodo = Todo & { syncStatus?: SyncStatus };
```

`syncStatus` is optional — it can be `undefined` (equivalent to `'idle'` for rendering purposes). Only check for `=== 'failed'` when deciding to show `ErrorIndicator`.

### ErrorIndicator anatomy

```tsx
// components/ErrorIndicator.tsx
"use client";
import { AlertCircle, RotateCw } from "lucide-react";

interface ErrorIndicatorProps {
  onRetry: () => void;
  retrying: boolean;
}

export function ErrorIndicator({ onRetry, retrying }: ErrorIndicatorProps) {
  return (
    <button
      type="button"
      aria-label="Couldn't save, tap to retry"
      onClick={onRetry}
      className="flex items-center gap-1.5 min-w-[44px] min-h-[44px] px-1 text-error-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {retrying ? (
        <RotateCw size={16} aria-hidden="true" className="flex-shrink-0 animate-spin motion-reduce:animate-none" />
      ) : (
        <AlertCircle size={16} aria-hidden="true" className="flex-shrink-0" />
      )}
      <span className="text-sm whitespace-nowrap">Couldn't save — tap to retry</span>
    </button>
  );
}
```

Note: `animate-spin` is a Tailwind built-in utility (1 revolution/second, infinite). `motion-reduce:animate-none` suppresses it for reduced-motion users while keeping the icon swap.

### TaskItem integration point

The inner flex row currently looks like:
```
[checkbox btn] [<p> description flex-1 truncate] [delete btn opacity-0]
```

After this story:
```
[checkbox btn] [<p> description flex-1 truncate] [ErrorIndicator?] [delete btn opacity-0]
```

The description `<p>` keeps `flex-1 truncate` so it naturally compresses. `ErrorIndicator` is `whitespace-nowrap` so it doesn't wrap; it appears/disappears atomically.

### Mutation hook `onError` pattern

`use-delete-todo.ts` already has the correct pattern — mark the restored entry as `syncStatus: 'failed'`:
```ts
return [...old, { ...restoredTodo, syncStatus: "failed" as const }];
```

Match this for `use-create-todo.ts` and `use-toggle-todo.ts`:
- For `use-toggle-todo`: on error, the entry is already in the cache with the optimistic (intended) `completed` value. Just set `syncStatus: 'failed'` on it — do NOT roll back `completed`. The user sees the UI state they intended, with an error indicator.
- For `use-create-todo`: on error, the entry is in the cache with `syncStatus: 'pending'`. Just update its `syncStatus` to `'failed'` — do NOT remove the entry from the list.

**Why not roll back?** Rolling back removes the task from the UI entirely, which is more disorienting than showing an inline error. The deferred-work.md already flags the rollback approach as suboptimal.

### CSS animation: `animate-spin`

Tailwind 4 includes `animate-spin` as a built-in:
```css
/* built-in */
@keyframes spin { to { transform: rotate(360deg); } }
.animate-spin { animation: spin 1s linear infinite; }
```

`motion-reduce:animate-none` suppresses it when `prefers-reduced-motion: reduce`. No custom keyframes needed.

### `onSuccess` `syncStatus` reconciliation

Currently `use-create-todo.ts`:
```ts
onSuccess: (serverTodo, variables) => {
  queryClient.setQueryData<OptimisticTodo[]>(["todos"], (old = []) =>
    old.map((t) => (t.id === variables.id ? { ...serverTodo, syncStatus: "idle" } : t))
  );
},
```
Verify this pattern exists (or add it) for both `use-create-todo` and `use-toggle-todo`. The server response does not include `syncStatus` (it's a synthetic client field), so it must be explicitly set to `'idle'` in `onSuccess`.

### Files changed in this story

```
components/
├── ErrorIndicator.tsx           # NEW
└── ErrorIndicator.test.tsx      # NEW
components/TaskItem.tsx          # MODIFIED — render ErrorIndicator when syncStatus==='failed'
hooks/
├── use-create-todo.ts           # MODIFIED — onError: set syncStatus:'failed', not rollback
└── use-toggle-todo.ts           # MODIFIED — onError: set syncStatus:'failed', not rollback
```

No changes to: `db/**`, `app/api/**`, `lib/validation.ts`, `lib/constants.ts`, `hooks/use-delete-todo.ts` (already correct), `components/UndoToast.tsx`, `components/TodoListClient.tsx`, `components/TaskList.tsx`, `app/page.tsx`, `app/globals.css`.

### Previous story learnings

- **Story 3.3**: established the `TaskItem` inner-flex anatomy. `ErrorIndicator` slots between `<p>` and delete button.
- **Story 3.2**: `use-delete-todo.ts` already implements `syncStatus: 'failed'` on error — copy this pattern.
- **Story 2.2 / 2.3**: `useToggleTodo` and `useCreateTodo` follow the `onMutate` / `onSuccess` / `onError` TanStack Query v5 pattern. Keep the same shape.
- **No modals ever** — `ErrorIndicator` is inline, no Dialog/AlertDialog. AGENTS.md policy.
- **Import graph**: `components/` may import from `hooks/` only indirectly via props (not directly calling hooks). `ErrorIndicator` receives `onRetry` as a prop — no direct hook import in the component. `TaskItem` already imports `useToggleTodo` and `useMediaQuery` from `hooks/`; it can pass a no-op `onRetry` for now.

### References

- Story requirements: [`_bmad-output/planning-artifacts/epics.md` §"Story 4.1"](../planning-artifacts/epics.md)
- UX-DR9 (ErrorIndicator spec): [`_bmad-output/planning-artifacts/ux-design-specification.md` §"ErrorIndicator"](../planning-artifacts/ux-design-specification.md)
- UX-DR12 (reduced-motion): same doc
- UX-DR14 (44×44 hit target): same doc
- UX-DR15 (non-alarming color): same doc
- Architecture (`syncStatus` state machine): [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md)
- Desktop-only scope: [`_bmad-output/implementation-artifacts/deferred-work.md` §"Scope decision"](./deferred-work.md)
- Existing retry pattern: [`hooks/use-delete-todo.ts`](../../hooks/use-delete-todo.ts) lines 32–42
- `OptimisticTodo` type: [`lib/validation.ts`](../../lib/validation.ts)
- Story 4.2 (retry wiring): [`_bmad-output/planning-artifacts/epics.md` §"Story 4.2"](../planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 6 tasks complete. 129 Vitest tests pass (15 files). Lint, typecheck, and build clean.
- `use-create-todo.ts` and `use-toggle-todo.ts` `onError` handlers now set `syncStatus:'failed'` instead of rolling back — task stays visible with `ErrorIndicator`. Updated corresponding tests to assert new behavior.
- `animate-spin` is Tailwind 4 built-in; `motion-reduce:animate-none` suppresses it for reduced-motion users while still swapping the icon.
- SVG `className` is an `SVGAnimatedString` in jsdom — test uses `getAttribute("class")` to inspect class list.

### File List

- `components/ErrorIndicator.tsx` — NEW
- `components/ErrorIndicator.test.tsx` — NEW
- `components/TaskItem.tsx` — MODIFIED (renders ErrorIndicator when syncStatus==='failed')
- `hooks/use-create-todo.ts` — MODIFIED (onError: syncStatus:'failed' instead of rollback)
- `hooks/use-toggle-todo.ts` — MODIFIED (onError: syncStatus:'failed' instead of rollback)
- `hooks/use-create-todo.test.ts` — MODIFIED (updated onError test)
- `hooks/use-toggle-todo.test.ts` — MODIFIED (updated onError test)
