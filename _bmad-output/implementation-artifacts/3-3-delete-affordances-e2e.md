# Story 3.3: Add desktop hover-reveal trash icon and mobile swipe-left gesture (Journey 4 E2E)

Status: review

## Story

As a user,
I want to delete a task by swiping left on mobile or hovering and clicking a trash icon on desktop,
So that deletion is reachable without modal ceremony in either input modality.

## Acceptance Criteria

1. **Desktop hover-reveal trash icon (UX-DR11)**
   - `components/TaskItem.tsx` renders a `Trash2` icon (Lucide, 20px) in a 44×44px hit target on the right side of each row.
   - The button is hidden by default (`opacity-0`) and reveals (`opacity-100`) on row hover via `group-hover` utilities, strictly guarded with `[@media(hover:hover)]` so it never appears on touch devices.
   - The button has `aria-label="Delete task"` and is keyboard-focusable in tab order after the checkbox (natural DOM order, no special tabindex needed on the button itself).
   - Clicking it (or pressing Enter/Space when the button is focused) calls `onDelete(todo.id)`.
   - Hover reveal is an instant opacity change (`motion-reduce:transition-none`); optionally 200ms fade on hover devices (`transition-opacity duration-200`), always suppressed with `motion-reduce:transition-none`.

2. **Mobile swipe-left gesture (UX-DR10)**
   - Extending the existing `react-swipeable` handler, swipe-left on a touch device (`pointer: coarse`, `max-width: 1023.98px`) reveals a muted-amber `Trash2` icon panel on the right side of the row as the row content translates left.
   - Threshold: `Math.abs(deltaX) >= SWIPE_LEFT_THRESHOLD` where `SWIPE_LEFT_THRESHOLD = SWIPE_PX_THRESHOLD` (80px) — same constant as the right-swipe threshold in `lib/constants.ts`.
   - Below threshold: row snaps back without deleting (just reset `dragX` to 0).
   - Crossing the threshold on release: animate row fully off-screen left (`translateX(-clientWidth)`) over 300ms `ease-in`, then call `onDelete(todo.id)` once the animation completes.
   - `prefers-reduced-motion`: skip the 300ms wait; call `onDelete(todo.id)` immediately on release past threshold.
   - Swipe-left is disabled at the `lg+` breakpoint (same `enableSwipe` gate as swipe-right).
   - The revealed panel sits behind the row content (`absolute` positioned on the right), always visible behind sliding content, using `bg-surface` background and `text-error-foreground` for the icon.

3. **Keyboard Delete shortcut (UX-DR16 Phase 3)**
   - The `<li>` row gets `tabIndex={-1}` so Story 3.2's `target?.focus()` works correctly (currently the `<li>` has no `tabIndex` so the focus call silently fails).
   - `onKeyDown` on `<li>`: if `e.key === "Delete"` and `!e.isComposing`, call `onDelete(todo.id)`.
   - Does NOT trigger if focus is inside a child element that handles Delete itself (no conflict — no child handles Delete).

4. **Integration with deferred-delete pattern (Story 3.2)**
   - All three paths (hover-click, swipe-left, keyboard Delete) call the `onDelete` prop which is already wired from `TodoListClient` → `TaskList` → `TaskItem`.
   - The `UndoToast` appears automatically (no changes needed to `TodoListClient` or `UndoToast`).
   - `onDelete` is optional (`onDelete?: (id: string) => void`); guard all call sites with `onDelete?.(todo.id)`.

5. **`prefers-reduced-motion` (UX-DR12)**
   - Hover-reveal: no opacity transition (`motion-reduce:transition-none`).
   - Swipe-left exit animation: use `useMediaQuery("(prefers-reduced-motion: reduce)")` to detect; when true, call `onDelete` immediately on threshold crossing instead of after the 300ms animation.

6. **Vitest tests — extend `components/TaskItem.test.tsx`**
   - Trash button is rendered and calling it invokes `onDelete` at lg+ viewport (`mockMatchMedia(false)` for swipe gate, but trash button is always in DOM).
   - Trash button has `aria-label="Delete task"`.
   - Swipe-left past threshold at base viewport (`mockMatchMedia(true)`) calls `onDelete`.
   - Swipe-left below threshold does NOT call `onDelete`.
   - Swipe-left at lg+ viewport (`mockMatchMedia(false)` for swipe gate) does NOT call `onDelete`.
   - Keyboard Delete on focused `<li>` row calls `onDelete`.

7. **Playwright E2E — new `e2e/delete-undo.spec.ts`**
   - Journey 4 desktop: create task → hover row → click trash → `UndoToast` appears with "Task deleted" → click "Undo" → task restored (no DELETE fired to server).
   - Journey 4 mobile (iPhone 14 device preset): create task → swipe-left → `UndoToast` appears → let 5s pass (use `page.clock.fastForward`) → reload → task is gone.
   - Journey 4 delete-confirm: create task → delete → wait 5s → DELETE API fires → reload → task gone.
   - a11y scan (append to `e2e/a11y.spec.ts`): with UndoToast visible → axe-core → zero violations; after deletion + focus → axe-core → zero violations.

8. **All quality gates pass**
   - `pnpm lint` clean.
   - `pnpm typecheck` clean.
   - `pnpm test` — all 114 existing tests green + new tests.
   - `pnpm build` clean.
   - No changes to `db/**`, `app/api/**`, `lib/validation.ts`, `lib/constants.ts`.

## Tasks / Subtasks

- [x] **Task 1: Add `tabIndex={-1}` and keyboard Delete to `<li>` in `TaskItem` (AC: #3)**
  - [x] Add `tabIndex={-1}` to the `<li>` element so Story 3.2's `queueMicrotask` focus works
  - [x] Add `onKeyDown` handler: `if (e.key === "Delete" && !e.isComposing) onDelete?.(todo.id)`
  - [x] Destructure `onDelete` from props (currently `{ todo }` only)
  - [x] `pnpm typecheck` passes

- [x] **Task 2: Add desktop hover-reveal trash button (AC: #1, #5)**
  - [x] Replace the placeholder `<div className="w-[44px] flex-shrink-0" />` with an actual `<button>`
  - [x] Import `Trash2` from `lucide-react`
  - [x] Button classes: `w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 opacity-0 [@media(hover:hover)]:group-hover:opacity-100 transition-opacity duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`
  - [x] Add `group` class to the outer `<li>` element
  - [x] `aria-label="Delete task"`, `type="button"`, `onClick={() => onDelete?.(todo.id)}`
  - [x] `pnpm typecheck` and `pnpm lint` pass

- [x] **Task 3: Add muted-amber trash panel behind row for swipe-left reveal (AC: #2)**
  - [x] Add absolute-positioned div inside `<li>` (before the translating content div): `<div className="absolute inset-y-0 right-0 flex items-center px-6"><Trash2 size={20} className="text-error-foreground" /></div>`
  - [x] This panel is always visible behind the sliding content; it shows naturally as the content slides left
  - [x] `pnpm typecheck` passes

- [x] **Task 4: Extend swipeable handlers for swipe-left delete (AC: #2, #5)**
  - [x] Add `reduceMotion` using `useMediaQuery("(prefers-reduced-motion: reduce)")`
  - [x] In `onSwiping`: handle `e.deltaX < 0` symmetrically to right swipe — `setIsDragging(true)`, `setDragX(Math.max(e.deltaX, -(rowRef.current?.clientWidth ?? 0)))`
  - [x] In `onSwiped`: handle `dir === "Left"` (enabled only when `enableSwipe`): check `Math.abs(e.deltaX) >= SWIPE_PX_THRESHOLD`; if true → trigger exit animation (or immediate delete for `reduceMotion`); if false → snap back (`setDragX(0)`)
  - [x] Exit animation: `setIsDragging(false)`, `setDragX(-(rowRef.current?.clientWidth ?? 300))`, then `setTimeout(() => onDelete?.(todo.id), reduceMotion ? 0 : 300)`
  - [x] Transition class: update the existing transition to use `duration-300 ease-in` when exiting left; keep `duration-200 ease-in-out` for normal snap-back. Or use a single class: the existing `transition-transform duration-200 ease-in-out motion-reduce:transition-none` can stay for snap-back; the `isDragging ? "transition-none" : "transition-transform duration-300 ease-in motion-reduce:transition-none"` can be used when `dragX < 0` and not dragging (exit)
  - [x] `pnpm typecheck` passes

- [x] **Task 5: Write Vitest tests for new behaviors (AC: #6)**
  - [x] In `components/TaskItem.test.tsx`, add `mockDeleteFn = vi.fn()` and pass `onDelete={mockDeleteFn}` in all existing tests (update renders to avoid test drift)
  - [x] Add: trash button renders with `aria-label="Delete task"`
  - [x] Add: clicking trash button calls `onDelete` with todo.id
  - [x] Add: keyboard Delete on the `<li>` row calls `onDelete`
  - [x] Add: swipe-left past threshold calls `onDelete` (need `vi.useFakeTimers()` for the 300ms delay)
  - [x] Add: swipe-left below threshold does NOT call `onDelete`
  - [x] Add: swipe-left at lg+ viewport does NOT call `onDelete`
  - [x] `pnpm test` passes (all 114 existing + new)

- [x] **Task 6: Write E2E `e2e/delete-undo.spec.ts` (AC: #7)**
  - [x] Desktop Journey 4: seed task → `page.goto("/")` → hover row → click trash button (`getByRole("button", { name: /delete task/i })`) → assert UndoToast visible → click "Undo" → assert task visible again; intercept DELETE request and assert it was NOT made
  - [x] Mobile Journey 4 (with `test.use({ ...devices["iPhone 14"] })`): seed task → goto → swipe-left gesture → assert UndoToast → `await page.clock.fastForward(6000)` → reload → assert task gone
  - [x] Delete-confirm journey: seed → delete (desktop) → `page.clock.fastForward(6000)` → intercept DELETE and verify it fired → reload → assert task gone
  - [x] Use `cleanupTodos()` in `beforeEach`
  - [x] Use stable UUIDs for seeded tasks (different per test to avoid cross-contamination)
  - [x] `pnpm test` (unit only) still green

- [x] **Task 7: Extend `e2e/a11y.spec.ts` with delete-state scans (AC: #7)**
  - [x] Add test: seed task → delete → while UndoToast visible → axe-core scan → zero violations
  - [x] Add test: seed task → delete → post-deletion focus state → axe-core scan → zero violations
  - [x] `pnpm lint` clean

- [x] **Task 8: Verify all gates (AC: #8)**
  - [x] `pnpm lint` — clean
  - [x] `pnpm typecheck` — clean
  - [x] `pnpm test` — all prior tests green + new Vitest tests
  - [x] `pnpm build` — clean

## Dev Notes

### Architecture: Three delete paths all funnel to `onDelete` prop

```
TaskItem
  ├── Hover-click trash button   → onClick={() => onDelete?.(todo.id)}
  ├── Swipe-left gesture (mobile) → setTimeout(() => onDelete?.(todo.id), 300)
  └── Keyboard Delete on <li>    → onKeyDown: e.key === "Delete" → onDelete?.(todo.id)
                  │
                  ▼
TaskList.onDelete → TodoListClient.handleDelete(id)  [wired in Story 3.2]
  └── useDeleteTodo().mutate(id)   ← optimistic remove + deferred HTTP DELETE
  └── dispatch({ type: "SHOW" })  ← shows UndoToast
```

No changes needed to `TodoListClient`, `TaskList`, `useDeleteTodo`, or `UndoToast`. All orchestration is already in place from Story 3.2.

### `TaskItem` updated anatomy

```tsx
<li
  role="listitem"
  ref={setRefs}
  tabIndex={-1}                           // NEW: enables programmatic focus + keyboard events
  data-task-id={todo.id}
  onKeyDown={handleKeyDown}               // NEW: Delete key handler
  className="group min-h-[48px] py-3 px-6 flex items-center gap-3 overflow-hidden relative"
  //         ^^^^^                                                                   ^^^^^^^^
  //         NEW: `group` for hover-reveal    NEW: `relative` for absolute trash panel
>
  {/* NEW: trash icon panel behind sliding content */}
  <div className="absolute inset-y-0 right-0 flex items-center px-6">
    <Trash2 size={20} className="text-error-foreground" aria-hidden="true" />
  </div>

  {/* existing sliding content wrapper — dragX can now be negative (left swipe) */}
  <div
    style={{ transform: `translateX(${dragX}px)` }}
    className={[
      "flex items-center gap-3 flex-1",
      isDragging
        ? "transition-none"
        : dragX < 0 && !isDragging
          ? "transition-transform duration-300 ease-in motion-reduce:transition-none"
          : "transition-transform duration-200 ease-in-out motion-reduce:transition-none",
    ].join(" ")}
  >
    <button /* checkbox, unchanged */ />
    <p /* text, unchanged */ />
    {/* Replace placeholder div with delete button */}
    <button
      type="button"
      aria-label="Delete task"
      onClick={() => onDelete?.(todo.id)}
      className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 opacity-0
                 [@media(hover:hover)]:group-hover:opacity-100
                 transition-opacity duration-200 motion-reduce:transition-none
                 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Trash2 size={20} />
    </button>
  </div>
</li>
```

### Swipe-left handler additions

```ts
const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

// In onSwiping:
onSwiping: (e) => {
  if (!enableSwipe) return;
  if (e.deltaX > 0) {
    // right swipe: existing logic
    setIsDragging(true);
    const max = rowRef.current?.clientWidth ?? 0;
    setDragX(Math.min(e.deltaX, max));
  } else if (e.deltaX < 0) {
    // left swipe: mirror of right
    setIsDragging(true);
    const max = rowRef.current?.clientWidth ?? 0;
    setDragX(Math.max(e.deltaX, -max));
  }
},

// In onSwiped:
onSwiped: (e) => {
  setIsDragging(false);
  if (!enableSwipe) {
    setDragX(0);
    return;
  }
  if (e.deltaX >= SWIPE_PX_THRESHOLD && e.dir === "Right") {
    handleToggle();  // existing
  } else if (e.dir === "Left" && Math.abs(e.deltaX) >= SWIPE_PX_THRESHOLD) {
    // Left swipe past threshold: animate out then delete
    const clientWidth = rowRef.current?.clientWidth ?? 300;
    if (!reduceMotion) {
      setDragX(-clientWidth);  // triggers the 300ms ease-in transition
    }
    setTimeout(() => {
      onDelete?.(todo.id);
    }, reduceMotion ? 0 : 300);
    return;  // don't reset dragX — the row is about to be removed from DOM
  }
  setDragX(0);
},
```

Key: after triggering the delete animation, do NOT reset `dragX` to 0 (the row is about to be removed from the cache and unmounted).

### Keyboard Delete handler

```ts
const handleKeyDown = (e: React.KeyboardEvent<HTMLLIElement>) => {
  if (e.key === "Delete" && !e.isComposing) {
    onDelete?.(todo.id);
  }
};
```

Attach to `<li onKeyDown={handleKeyDown}>`.

### Desktop hover-reveal: CSS mechanics

`group` class on `<li>` + `[@media(hover:hover)]:group-hover:opacity-100` on the trash button.

Why `[@media(hover:hover)]`? Tailwind's `hover:` modifier fires on any pointer including stylus and touch-to-hover. The `@media (hover: hover)` guard ensures the hover styles only activate on devices with a true hover pointer (mouse), never on touch devices (where the hover state can "stick" after touch). This is the same guard that the UX spec requires (UX-DR11).

Tailwind 4 arbitrary variant syntax: `[@media(hover:hover)]:group-hover:opacity-100`.

### E2E: Clock manipulation for 5s timer

The deferred DELETE fires after `UNDO_TIMEOUT_MS = 5000ms`. In E2E tests, use Playwright's built-in clock API:

```ts
// Freeze time before page load so the clock is controllable from the start
await page.clock.install();
// ... perform delete action ...
// Fast-forward past the 5s undo window
await page.clock.fastForward(6000);
// Wait for the DELETE request to fire
const deleteResponse = await page.waitForResponse(
  (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "DELETE",
  { timeout: 2000 }
);
expect(deleteResponse.status()).toBe(204);
```

Note: `page.clock.install()` must be called BEFORE `page.goto()` to intercept `setTimeout` from the initial render.

### E2E: Mobile swipe-left gesture simulation

Use the same touch-event approach from `e2e/complete.spec.ts`:

```ts
test.use({ ...devices["iPhone 14"] });

const box = await row.boundingBox();
const startX = box.x + box.width - 20;  // start near right edge
const startY = box.y + box.height / 2;
const endX = box.x + 10;               // end near left edge (full left swipe)

await page.touchscreen.tap(startX, startY);
// react-swipeable requires touch events; use evaluate for swipe:
await page.evaluate(
  ({ startX, startY, endX }) => {
    const el = document.querySelector("[data-task-id]");
    if (!el) return;
    el.dispatchEvent(new TouchEvent("touchstart", {
      bubbles: true,
      touches: [new Touch({ identifier: 1, target: el, clientX: startX, clientY: startY })],
    }));
    el.dispatchEvent(new TouchEvent("touchmove", {
      bubbles: true,
      touches: [new Touch({ identifier: 1, target: el, clientX: endX, clientY: startY })],
    }));
    el.dispatchEvent(new TouchEvent("touchend", {
      bubbles: true,
      changedTouches: [new Touch({ identifier: 1, target: el, clientX: endX, clientY: startY })],
    }));
  },
  { startX, startY, endX },
);
```

This mirrors the swipe-right pattern from Story 2.3's E2E tests.

### `useSwipeable` mock in Vitest for swipe-left

The existing tests mock `react-swipeable` and invoke the config callbacks directly:

```ts
// For swipe-left tests:
const config = vi.mocked(useSwipeable).mock.calls[0][0];
// Simulate swiping left past threshold:
config.onSwiped?.({ deltaX: -200, dir: "Left" } as never);
// After the 300ms timer, onDelete should be called:
vi.useFakeTimers();
config.onSwiped?.({ deltaX: -200, dir: "Left" } as never);
vi.advanceTimersByTime(300);
expect(mockDeleteFn).toHaveBeenCalledWith(todo.id);
```

For `prefers-reduced-motion` test: mock `matchMedia` to return `true` for `(prefers-reduced-motion: reduce)` and `false` for the swipe-enable query, then verify `onDelete` is called WITHOUT advancing timers.

### Design tokens — delete icon color

| Element | Token | Tailwind |
|---|---|---|
| Trash icon (behind panel, revealed on swipe) | `--error-foreground` | `text-error-foreground` |
| Trash icon (hover button, desktop) | `--foreground` | `text-foreground` (default, no class needed) |

The UX spec says: "muted amber icon, never bright red" — `--error-foreground` is the muted amber token already used for sync failures. The trash icon in the hover button can be default foreground (subtle reveal).

### Previous story learnings (Stories 2.3, 3.1, 3.2)

- **`react-swipeable` pattern** — Story 2.3 established: `useSwipeable` config, `enableSwipe` media query gate, `rowRef` + `setRefs` ref composition, `isDragging` state, `dragX` state, `touchcancel` reset. Story 3.3 extends all of these — do NOT create a second `useSwipeable` call; extend the existing one.
- **`SWIPE_PX_THRESHOLD = 80`** — defined in `lib/constants.ts` (added in Story 3.2) but NOT currently exported from there; check if it's in constants or local to the file. Currently it's `const SWIPE_PX_THRESHOLD = 80` at the top of `TaskItem.tsx` — keep it local, or move to `lib/constants.ts`. Moving to constants is a nice-to-have, not required.
- **`useDeleteTodo().mutate(id)` is called via `onDelete` prop** — do NOT call `useDeleteTodo()` directly in `TaskItem`. The hook is instantiated in `TodoListClient` and the callback is threaded down as `onDelete`. This preserves the single-source-of-toast design.
- **`"use client"` on `TaskItem.tsx`** — already has it (uses hooks).
- **Test isolation** — existing `TaskItem.test.tsx` mocks `useSwipeable` with `vi.mock("react-swipeable")` and `vi.mocked(useSwipeable).mockReturnValue(...)`. New tests extend this mock; do NOT add a second `vi.mock` for the same module.
- **E2E uses stable UUIDs** — all seeded tasks use a specific UUID to avoid cross-test interference. Each test should use a unique UUID.
- **`page.clock.install()` before `page.goto()`** — required for fake timers to control `setTimeout` in the running app.
- **No `Dialog`/`Modal`** — AGENTS.md lint rule. No new primitives from Radix or similar.
- **Import graph** — `TaskItem` may import from `hooks/` for `use-delete-todo` only if needed; but since we're using the `onDelete` prop, no new hook import is needed in `TaskItem`.

### Checklist: Files changed in this story

```
components/
├── TaskItem.tsx                          # MODIFIED — group class, tabIndex, onKeyDown, trash button, swipe-left, trash panel
└── TaskItem.test.tsx                     # MODIFIED — new tests for trash, keyboard Delete, swipe-left
e2e/
├── delete-undo.spec.ts                   # NEW — Journey 4 desktop, mobile, delete-confirm
└── a11y.spec.ts                          # MODIFIED — add toast-visible and post-deletion a11y scans
```

No changes to: `db/**`, `app/api/**`, `lib/validation.ts`, `lib/constants.ts`, `hooks/**`, `components/TodoListClient.tsx`, `components/TaskList.tsx`, `components/UndoToast.tsx`, `components/UndoToast.test.tsx`, `app/page.tsx`, `app/globals.css`.

### Known out-of-scope items (do NOT implement)

- **`ErrorIndicator`** for `syncStatus: 'failed'` visual — Story 4.1.
- **`MAX_DESCRIPTION_LENGTH` refactor in `validation.ts`** — deferred from Story 3.2.
- **`prefers-reduced-motion` CI enforcement** — Story 4.3.
- **`useSwipeable` config object memoization** (currently re-created each render) — pre-existing, not this story's concern.

### References

- Story requirements: [`_bmad-output/planning-artifacts/epics.md` §"Story 3.3"](../planning-artifacts/epics.md) (lines 623–671)
- TaskItem anatomy + states: [`_bmad-output/planning-artifacts/ux-design-specification.md` §"TaskItem"](../planning-artifacts/ux-design-specification.md) (lines 643–678)
- Motion & Transitions: [`_bmad-output/planning-artifacts/ux-design-specification.md` §"Motion"](../planning-artifacts/ux-design-specification.md) (lines 940–948)
- Swipe gesture specification: [`_bmad-output/planning-artifacts/ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) (lines 684, 986)
- Delete flow: [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md) (lines 939–944)
- Story 3.2 (deferred-delete hook + toast): [`3-2-deferred-delete-undo-toast.md`](./3-2-deferred-delete-undo-toast.md)
- Existing swipe-right implementation: [`components/TaskItem.tsx`](../../components/TaskItem.tsx)
- Existing E2E swipe pattern: [`e2e/complete.spec.ts`](../../e2e/complete.spec.ts)
- Import graph: [`AGENTS.md`](../../AGENTS.md) §"Import graph"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- All 8 tasks complete. 122 Vitest tests pass. Build clean.
- `e.nativeEvent.isComposing` used instead of `e.isComposing` on the React synthetic event (TypeScript requires accessing it via nativeEvent).
- Swipe-left E2E uses synchronous touch dispatch (no await inside loop) so fake clock doesn't block gesture.

### File List

- `components/TaskItem.tsx` — MODIFIED
- `components/TaskItem.test.tsx` — MODIFIED
- `e2e/delete-undo.spec.ts` — NEW
- `e2e/a11y.spec.ts` — MODIFIED
