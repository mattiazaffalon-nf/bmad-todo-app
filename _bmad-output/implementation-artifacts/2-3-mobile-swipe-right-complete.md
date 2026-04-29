# Story 2.3: Add swipe-right gesture on mobile to complete tasks (Journey 3 E2E)

Status: ready-for-dev

## Story

As a mobile user,
I want to swipe right on a task to mark it complete without precisely tapping the small checkbox,
So that I can complete tasks one-handed in the thumb zone.

## Acceptance Criteria

1. **`react-swipeable` is installed and `@axe-core/playwright` is installed (dev).**
   - `pnpm add react-swipeable` — adds to `dependencies` (it ships at runtime in `TaskItem`).
   - `pnpm add -D @axe-core/playwright` — adds to `devDependencies` (used only by `e2e/a11y.spec.ts`).
   - `package.json` and `pnpm-lock.yaml` are committed together. **No other dep changes** in this story.

2. **`components/TaskItem.tsx` is wrapped with a swipe-right handler that fires the same toggle.**
   - Imports `useSwipeable` from `react-swipeable`.
   - Calls `useToggleTodo()` once at component scope (already does — no duplicate hook calls).
   - The swipe handler dispatches **the same** `toggleTodo.mutate({ id: todo.id, completed: !todo.completed })` call the checkbox tap dispatches. Use a single shared `handleToggle` reference; do not duplicate the call site.
   - On swipe-right past the threshold, `handleToggle` fires.
   - During an in-progress swipe-right, the row's content translates horizontally with the finger via a `transform: translateX(...)` style derived from the swipeable's delta (capped at row width).
   - On release past threshold: the toggle fires AND the row settles back to `translateX(0)` over 200ms with `ease-in-out` — `motion-reduce:transition-none` collapses the settle to instant.
   - On release below threshold: the row snaps back to `translateX(0)` over 200ms (or instant under `motion-reduce`); no toggle.
   - Threshold: **≥40% of row width OR ≥80px velocity-based delta** (whichever fires first). Use `useSwipeable`'s `delta` numeric option for px threshold (`80`) and compute the 40%-width threshold dynamically inside the handler using a ref to the row element.
   - **Swipe-left does nothing in this story.** Story 3.x will wire delete to swipe-left. The `react-swipeable` config disables left/up/down handlers (or no-ops them).
   - The 44×44px tap target on the circular checkbox stays exactly as Story 2.2 left it. The keyboard contract stays. The `aria-pressed` and `aria-label` toggling stays.

3. **Swipe gestures are disabled at the `lg+` breakpoint (≥1024px) and on pointer devices.**
   - The swipe handler is gated by a `useMediaQuery`-style check that reads `window.matchMedia('(max-width: 1023.98px) and (pointer: coarse)')`.
   - When the media query does not match (desktop, mouse-only), the swipeable handlers are not attached — `useSwipeable` is conditionally invoked or its returned handlers are spread only when the media-query-driven `enableSwipe` flag is `true`. Never attach swipe handlers on a viewport ≥`lg` (1024px).
   - The media query result is read on mount and updates on resize / orientation change (subscribe to `matchMedia.addEventListener('change', ...)`). The component re-renders when the breakpoint crosses.
   - Below `lg`: swipe enabled. At/above `lg`: swipe disabled (tap-only).

4. **In-place stability is preserved (FR6).**
   - When swipe-right triggers completion, the row stays in its current list position. No reorder. Other rows do not shift.
   - The translate-while-dragging is purely visual within the row — it does not affect siblings (no margin/padding shifts on the parent).
   - `useTodos` order is preserved by `setQueryData` in `useToggleTodo` (already correct from Story 2.2).

5. **`prefers-reduced-motion` honored.**
   - The drag itself remains user-driven (the finger drives the translate; we do not animate during the drag).
   - The post-release **settle** transition (`translateX(0)` over 200ms) collapses to instant when `prefers-reduced-motion: reduce` is set. Achieved via Tailwind's `motion-reduce:transition-none` modifier on the wrapper element that carries the transform.
   - The completion fade+strikethrough on the description text (Story 2.2) already honors `motion-reduce:transition-none` — that branch is untouched.

6. **`components/TaskItem.test.tsx` is extended with swipe coverage.**
   - Mock `react-swipeable` so unit tests can drive the handler synchronously without DOM gesture simulation:
     ```ts
     vi.mock("react-swipeable", () => ({
       useSwipeable: vi.fn(),
     }));
     ```
   - Tests to add (preserve all 11 existing tests from Story 2.2):
     - **Swipe-right below `lg` invokes `mutate`** with `{ id: todo.id, completed: !todo.completed }`. Assert by capturing the `onSwipedRight` callback passed to the mocked `useSwipeable`, then calling it manually.
     - **Swipe-left below `lg` does NOT invoke mutate** (the swipe-left handler is unwired or no-op).
     - **At `lg+` viewport (mock `window.matchMedia` to return `matches: false` for `(max-width: 1023.98px) and (pointer: coarse)`), `useSwipeable` is NOT called** (or its handlers are not attached / `onSwipedRight` is `undefined`).
     - **At mobile viewport (mock `matches: true`), `useSwipeable` IS called.**
   - The mock for `useSwipeable` returns an empty handler-spread object `{ ref: vi.fn() }` (or whatever shape the component spreads). The test asserts on the configuration object the component passes to `useSwipeable` — specifically `onSwipedRight` and the `delta` threshold.

7. **`e2e/complete.spec.ts` is created with Playwright Journey 3.**
   - File location: `e2e/complete.spec.ts`.
   - Two test cases:
     1. **Tap-to-complete on mobile viewport.** Set viewport to a mobile preset (e.g., 390×844 — iPhone 14). Seed a todo via API. Tap the checkbox. Wait for `PATCH /api/todos/[id]` response. Assert the description has `line-through`. Tap the checkbox again. Wait for the second PATCH response. Assert the description does NOT have `line-through` (state restored).
     2. **Swipe-right-to-complete on mobile viewport.** Same viewport. Seed a todo. Use Playwright's `page.touchscreen` API to dispatch a left-edge → right-edge swipe across the row at sufficient distance to cross the 40% threshold. Wait for the PATCH response. Assert the description has `line-through`.
   - Use `cleanupTodos` in `test.beforeEach` (mirror `capture.spec.ts`).
   - Use `seedTodo(id, description)` to create the row before the test action.
   - Wait for the PATCH response with `page.waitForResponse(r => r.url().match(/\/api\/todos\/[^/]+$/) && r.request().method() === 'PATCH')` before asserting the visual state — same pattern as Story 1.5's POST wait.
   - Configure Playwright's mobile context: `use: { ...devices['iPhone 14'] }` per-test or via project config. Either approach works — keep it co-located in the spec file if simpler.

8. **`e2e/a11y.spec.ts` is created with axe-core scans.**
   - File location: `e2e/a11y.spec.ts`.
   - Imports: `import AxeBuilder from "@axe-core/playwright";`.
   - Two scan cases (minimum):
     - **Empty state:** open `/`, wait for `#empty-state-hint` visible, run AxeBuilder scan, assert zero violations.
     - **Completed-task state:** seed a todo, navigate, click the checkbox to complete it, wait for the PATCH response, run AxeBuilder scan against the now-completed task state, assert zero violations.
   - Each scan: `const results = await new AxeBuilder({ page }).analyze(); expect(results.violations).toEqual([]);`.
   - Use `cleanupTodos` in `test.beforeEach`.
   - The scan tags should include WCAG 2.1 AA at minimum: `.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])`.

9. **Lint, typecheck, build, unit-test, and E2E-test gates are green.**
   - `pnpm lint` clean.
   - `pnpm typecheck` clean.
   - `pnpm test` — all unit/integration tests green (target: 88 existing + ~4 new = ~92).
   - `pnpm build` clean.
   - `pnpm test:e2e` — all Playwright tests green (existing 2 capture journeys + 2 new complete journeys + 2 new a11y scans = 6 total).
   - No edits to: `lib/api-client.ts`, `hooks/use-toggle-todo.ts` (already correct from Story 2.2), `db/**`, `app/api/**`, `lib/validation.ts`.

## Tasks / Subtasks

- [ ] **Task 1: Install dependencies (AC: #1)**
  - [ ] `pnpm add react-swipeable`
  - [ ] `pnpm add -D @axe-core/playwright`
  - [ ] Confirm both appear in `package.json` with reasonable versions; `pnpm-lock.yaml` is committed
  - [ ] Verify `pnpm typecheck` still passes

- [ ] **Task 2: Add a small `useMediaQuery` hook (AC: #3)**
  - [ ] Create `hooks/use-media-query.ts` exporting `useMediaQuery(query: string): boolean`
  - [ ] Implementation: `useState` initialized from `window.matchMedia(query).matches` (guarded for SSR — return `false` if `typeof window === "undefined"`); `useEffect` subscribes to `matchMedia.addEventListener('change', ...)` and updates state; cleanup unsubscribes
  - [ ] Co-located test `hooks/use-media-query.test.ts`: assert state matches `matches`, assert subscription is added on mount and removed on unmount, assert state updates on a simulated `change` event

- [ ] **Task 3: Wire swipe-right into `TaskItem.tsx` (AC: #2, #3, #4, #5)**
  - [ ] Import `useSwipeable` from `react-swipeable` and `useMediaQuery` from `@/hooks/use-media-query`
  - [ ] Compute `enableSwipe = useMediaQuery('(max-width: 1023.98px) and (pointer: coarse)')`
  - [ ] Extract a single `handleToggle = () => toggleTodo.mutate({ id: todo.id, completed: !todo.completed })` reference; use it for both `<button onClick>` and the swipe-right callback
  - [ ] Pass `useSwipeable` config: `{ onSwipedRight: handleToggle, delta: 80, trackMouse: false }` (gates the px-velocity threshold)
  - [ ] Implement the 40%-width fallback threshold inside `onSwiping` by reading the row's clientWidth via a ref and only firing on release if `Math.abs(deltaX) > clientWidth * 0.4` (one approach: `onSwiped` reads `event.deltaX` and `ref.current.clientWidth`)
  - [ ] Apply `transform: translateX(${deltaX}px)` to a wrapper inside the `<li>` during swipe (track `deltaX` in component state via `onSwiping`); reset to `0` on release; the wrapper has `transition-transform duration-200 ease-in-out motion-reduce:transition-none`
  - [ ] When `enableSwipe === false`, do not spread the swipeable handlers and do not track `deltaX` (or short-circuit `onSwiping` to no-op)
  - [ ] Verify `pnpm typecheck` passes
  - [ ] Confirm the existing tap toggle, `aria-pressed`, `aria-label`, focus ring, and completion visual all still work (no regressions in Story 2.2 behavior)

- [ ] **Task 4: Extend `components/TaskItem.test.tsx` (AC: #6)**
  - [ ] Add `vi.mock("react-swipeable", () => ({ useSwipeable: vi.fn() }))` at module level
  - [ ] Add a `mockMatchMedia(matches: boolean)` helper that stubs `window.matchMedia` for the test
  - [ ] Add 4 new tests as listed in AC #6
  - [ ] Confirm all 11 existing tests from Story 2.2 still pass

- [ ] **Task 5: Author `e2e/complete.spec.ts` (AC: #7)**
  - [ ] Mirror the structure of `e2e/capture.spec.ts` (imports, `beforeEach`, `seedTodo`/`cleanupTodos` use)
  - [ ] Two tests: tap-to-complete + swipe-right-to-complete on a mobile viewport
  - [ ] Use `page.waitForResponse` for the PATCH response before asserting visual state
  - [ ] Run `pnpm test:e2e` locally to confirm green (start the dev server first or rely on the auto-spawned `webServer` from `playwright.config.ts`)

- [ ] **Task 6: Author `e2e/a11y.spec.ts` (AC: #8)**
  - [ ] Import `AxeBuilder` from `@axe-core/playwright`
  - [ ] Two scans: empty state + completed-task state
  - [ ] Both scans must report zero violations
  - [ ] Run `pnpm test:e2e` to confirm green

- [ ] **Task 7: Verify all gates (AC: #9)**
  - [ ] `pnpm lint` — clean
  - [ ] `pnpm typecheck` — clean
  - [ ] `pnpm test` — all unit tests green (88 existing + ~4 new ≈ 92)
  - [ ] `pnpm build` — clean
  - [ ] `pnpm test:e2e` — all 6 e2e tests green
  - [ ] No edits to `lib/api-client.ts`, `hooks/use-toggle-todo.ts`, `db/**`, `app/api/**`, `lib/validation.ts`

## Dev Notes

### Architectural anchors (do not deviate)

- **The same toggle code path on tap and swipe-right.** The architecture and UX spec are explicit: swipe-right is a gesture-equivalent of the tap. There must be **one** `handleToggle` reference shared between the `<button onClick>` and the swipeable's `onSwipedRight`. Do not call `toggleTodo.mutate` from two places. (Architecture §"API & Communication Patterns" + UX-DR10.)
- **Swipe disabled on desktop / pointer devices.** UX-DR10 is explicit: "gestures disabled on desktop (no swipe behavior on pointer devices)". The architecture's responsiveness section says: "Swipe gestures disabled on desktop (pointer devices don't generate meaningful swipes)." Use `(max-width: 1023.98px) and (pointer: coarse)` — **both** the viewport breakpoint AND `pointer: coarse` — to avoid attaching swipe handlers to a tablet plugged into a mouse, or a desktop in DevTools mobile mode at 800px width.
- **In-place stability (FR6).** The list does not reorder when a task is toggled. The drag-translate is a purely-visual effect on a single row's inner content; it does not affect the row's height, position in the list, or any sibling. Settle the translate to 0 on release.
- **`prefers-reduced-motion`.** The drag itself is user-driven (motion follows the finger); we do not animate it. The **release settle** (translateX → 0 over 200ms) collapses to instant via `motion-reduce:transition-none`. Architecture §"Cross-Cutting Concerns" + UX-DR12.
- **No new schema, no new API, no new validation.** The PATCH endpoint and `useToggleTodo` are reused as-is from Stories 2.1 and 2.2. The "single point of mutation" pattern (one hook call per component) is preserved.

### Swipe-right plumbing — recommended shape

```tsx
// components/TaskItem.tsx
"use client";

import { useRef, useState } from "react";
import { Circle, CheckCircle2 } from "lucide-react";
import { useSwipeable } from "react-swipeable";
import type { OptimisticTodo } from "@/lib/validation";
import { useToggleTodo } from "@/hooks/use-toggle-todo";
import { useMediaQuery } from "@/hooks/use-media-query";

const SWIPE_PX_THRESHOLD = 80;
const SWIPE_WIDTH_RATIO = 0.4;

export function TaskItem({ todo }: { todo: OptimisticTodo }) {
  const toggleTodo = useToggleTodo();
  const enableSwipe = useMediaQuery("(max-width: 1023.98px) and (pointer: coarse)");
  const rowRef = useRef<HTMLLIElement | null>(null);
  const [dragX, setDragX] = useState(0);

  const handleToggle = () =>
    toggleTodo.mutate({ id: todo.id, completed: !todo.completed });

  const swipeHandlers = useSwipeable({
    onSwiping: (e) => {
      if (!enableSwipe) return;
      // Only track right-direction translation; clamp to row width.
      if (e.deltaX > 0) setDragX(Math.min(e.deltaX, rowRef.current?.clientWidth ?? 0));
    },
    onSwiped: (e) => {
      if (!enableSwipe) {
        setDragX(0);
        return;
      }
      const width = rowRef.current?.clientWidth ?? 0;
      const passedThreshold =
        e.deltaX >= SWIPE_PX_THRESHOLD || e.deltaX >= width * SWIPE_WIDTH_RATIO;
      if (passedThreshold && e.dir === "Right") {
        handleToggle();
      }
      setDragX(0);
    },
    delta: SWIPE_PX_THRESHOLD,
    trackMouse: false,
  });

  // When swipe is disabled, don't spread the handlers (no-op cost is fine if we do, but
  // explicitly omitting is clearer and prevents trackpad-on-iPad-with-mouse edge cases).
  const swipeProps = enableSwipe ? swipeHandlers : {};

  return (
    <li
      role="listitem"
      ref={rowRef}
      {...swipeProps}
      className="min-h-[48px] py-3 px-6 flex items-center gap-3 overflow-hidden"
    >
      <div
        style={{ transform: `translateX(${dragX}px)` }}
        className="flex items-center gap-3 flex-1 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
      >
        <button
          type="button"
          aria-pressed={todo.completed}
          aria-label={todo.completed ? "Mark task incomplete" : "Mark task complete"}
          onClick={handleToggle}
          className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
      </div>
    </li>
  );
}
```

Notes on the shape:
- The `<li>` carries the swipeable handlers (so `react-swipeable`'s pointer events bind to the row). The inner `<div>` carries the `translateX` transform — this keeps the row's bounding box stable while the visible content tracks the finger.
- `overflow-hidden` on the `<li>` clips the dragged content if it would exceed the row's bounds. Without it, a long drag could overflow into adjacent rows.
- The `transition-transform` on the **inner div** drives the settle-to-zero animation on release. While dragging, we set inline `style={{ transform: ... }}` per swipe event — that overrides the Tailwind `transition-transform` to apply the new value instantly (CSS transitions only animate when the property *changes via the cascade*, not when set repeatedly via inline style during continuous motion). On release, `setDragX(0)` triggers the transition.
- "use client" is needed because of `useState`/`useRef` + the `react-swipeable` hook. The file currently does not have that directive — Story 2.2 was server-component-compatible because `useToggleTodo` was the only hook (and TanStack Query Provider lives in `TodoListClient`, which is already `"use client"`). Adding swipe state + media-query state pushes `TaskItem` into a client component. Since `TaskList` already renders inside `TodoListClient`, this is a no-op for the render tree.
- **Alternative:** the architecture guide and UX spec mention `react-swipeable`'s test utilities exist. Verify in the docs once installed; mocking `useSwipeable` is the safer test approach (covered below).

### `useMediaQuery` hook — recommended shape

```ts
// hooks/use-media-query.ts
"use client";

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    setMatches(mql.matches); // resync on mount in case query changed since first render
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
```

Notes:
- SSR-safe initial state: returns `false` when `window` is undefined. The `useEffect` resync on mount ensures the correct value lands on the client right away.
- One subscription per query string. The `useEffect` dependency on `query` re-subscribes if the query string changes (it won't in our use, but the hook stays general).
- Returns a plain boolean. Callers branch on it.

### Test mocks — `react-swipeable` + `matchMedia`

```ts
// components/TaskItem.test.tsx (additions)
import { useSwipeable } from "react-swipeable";

vi.mock("react-swipeable", () => ({
  useSwipeable: vi.fn(() => ({})),
}));

beforeEach(() => {
  vi.mocked(useSwipeable).mockClear();
});

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Test: swipe-right invokes mutate
it("swipe-right below lg invokes mutate with the toggled completed value", () => {
  mockMatchMedia(true); // mobile
  render(<ul><TaskItem todo={todo} /></ul>);
  const config = vi.mocked(useSwipeable).mock.calls[0][0];
  // Simulate a swipe-right with deltaX past threshold
  config.onSwiped?.({ deltaX: 200, dir: "Right" } as never);
  expect(mockMutate).toHaveBeenCalledWith({ id: todo.id, completed: true });
});

// Test: swipe disabled at lg+
it("does not attach swipe handlers at lg+ viewport", () => {
  mockMatchMedia(false); // desktop
  render(<ul><TaskItem todo={todo} /></ul>);
  // Either useSwipeable wasn't called, or its handlers aren't spread —
  // the simplest assertion: when the row is rendered at lg+, dispatching
  // a swipe via the mocked config does not invoke mutate.
  const config = vi.mocked(useSwipeable).mock.calls[0]?.[0];
  config?.onSwiped?.({ deltaX: 200, dir: "Right" } as never);
  expect(mockMutate).not.toHaveBeenCalled();
});
```

The second test depends on the `enableSwipe` short-circuit inside `onSwiped`. If you implement disabling by *not calling `useSwipeable` at all* on desktop (alternative pattern), assert `expect(useSwipeable).not.toHaveBeenCalled()` instead.

### Playwright `e2e/complete.spec.ts` — target shape

```ts
import { test, expect, devices } from "@playwright/test";
import { cleanupTodos, seedTodo } from "./fixtures/test-db";

test.use({ ...devices["iPhone 14"] });

test.beforeEach(async () => {
  await cleanupTodos();
});

test("Journey 3: tap-to-complete on mobile viewport", async ({ page }) => {
  const id = "44444444-4444-4444-8444-444444444444";
  await seedTodo(id, "tap me");
  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "tap me" });
  await expect(row).toBeVisible();

  const checkbox = row.getByRole("button", { name: /mark task complete/i });
  const patchPromise = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await checkbox.click();
  await patchPromise;

  await expect(row.locator("p")).toHaveClass(/line-through/);

  // Tap again — uncomplete
  const patchPromise2 = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await row.getByRole("button", { name: /mark task incomplete/i }).click();
  await patchPromise2;

  await expect(row.locator("p")).not.toHaveClass(/line-through/);
});

test("Journey 3: swipe-right-to-complete on mobile viewport", async ({ page }) => {
  const id = "55555555-5555-4555-8555-555555555555";
  await seedTodo(id, "swipe me");
  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "swipe me" });
  await expect(row).toBeVisible();

  const box = await row.boundingBox();
  if (!box) throw new Error("row has no bounding box");

  const startX = box.x + 8;
  const startY = box.y + box.height / 2;
  const endX = box.x + box.width * 0.85;

  // Simulate touch swipe
  await page.touchscreen.tap(startX, startY); // ensure the row is the touch target
  // Some Playwright versions require dispatching pointer events for swipe simulation.
  // The cleanest cross-version approach is page.mouse with `hasTouch` enabled by the device preset
  // — `iPhone 14` preset sets `hasTouch: true` so pointer events become touch events.
  const patchPromise = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, startY, { steps: 10 });
  await page.mouse.up();
  await patchPromise;

  await expect(row.locator("p")).toHaveClass(/line-through/);
});
```

Notes:
- `devices['iPhone 14']` preset enables `hasTouch: true`, so `page.mouse` events are dispatched as touch events. `react-swipeable` listens to pointer events by default, which works with both.
- If the swipe simulation flakes (timing-dependent), increase `steps` in `page.mouse.move` or fall back to `page.evaluate(() => { /* dispatch synthetic touchstart/move/end events */ })` — but try the simpler `page.mouse` approach first.
- The `waitForResponse` regex uses `/\/api\/todos\/[^/]+$/` to match the dynamic-segment PATCH (one path segment after `/api/todos/`).

### Playwright `e2e/a11y.spec.ts` — target shape

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { cleanupTodos, seedTodo } from "./fixtures/test-db";

test.beforeEach(async () => {
  await cleanupTodos();
});

test("a11y: empty state has zero axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#empty-state-hint")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("a11y: completed-task state has zero axe violations", async ({ page }) => {
  const id = "66666666-6666-4666-8666-666666666666";
  await seedTodo(id, "axe scan target");
  await page.goto("/");

  const row = page.getByRole("listitem").filter({ hasText: "axe scan target" });
  const patchPromise = page.waitForResponse(
    (r) => /\/api\/todos\/[^/]+$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await row.getByRole("button", { name: /mark task complete/i }).click();
  await patchPromise;

  await expect(row.locator("p")).toHaveClass(/line-through/);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
```

Notes:
- The empty-state scan is a baseline — if it has violations, every other scan will too.
- The completed-task scan covers the new visual state introduced by Story 2.2 (line-through + `aria-pressed=true`). UX-DR23's epic-level requirement is "axe-core scan on every E2E journey state" — Stories 3.x and 4.x will extend this file with toast-visible and failed-state scans.

### Why a `useMediaQuery` hook (and not just CSS)

CSS can hide swipe affordances on desktop, but it cannot prevent `react-swipeable` from attaching pointer event listeners or firing handlers. Even with `pointer-events: none` on a parent, `react-swipeable` binds at the host element. The cleanest gate is at the JS level: don't spread the handlers when the breakpoint says "desktop".

Tailwind's `lg:` modifier applies utility classes by viewport, but doesn't toggle JS-level event handlers. We need both: Tailwind for visuals (already in place from Story 2.2's no-swipe state) and the media-query hook for behavior.

### `(pointer: coarse)` — why both width and pointer

A bare `(max-width: 1023.98px)` matches DevTools' mobile preview on a desktop, where the user has a mouse, not a finger. Swipe via mouse is a poor UX (it conflicts with text selection) — `react-swipeable`'s `trackMouse: false` already disables that, but we belt-and-suspenders by also requiring `(pointer: coarse)` (touch as the primary input).

Conversely, an iPad in landscape (1024×768) has `pointer: coarse` but is wider than `lg`. We disable swipe at that width — the architecture treats tablets at landscape ≥1024px as desktop layouts (UX spec line 992: "switches to top-anchored on landscape tablets if the viewport width exceeds 1024px"). This is intentional.

### Forbidden patterns (do not reintroduce these)

- **Confirmation dialogs** — UX policy (AGENTS.md): no `Dialog`, `AlertDialog`, `Modal`, `confirm()`, etc. ESLint's `no-restricted-imports` enforces this.
- **List reordering on toggle** — FR6 stability rule. The row stays put. Do not call `setQueryData` to move the entry to the bottom of the list "because it's done".
- **Swipe-left wiring** — out of scope. Story 3.x will wire delete to swipe-left. Do not attach an `onSwipedLeft` handler in this story (or make it explicitly a no-op).
- **Drag animation on the row's bounding box** — only the inner content translates. The `<li>`'s width/height are stable; only its child's `transform: translateX(...)` changes.
- **`trackMouse: true`** — would enable swipe via mouse on desktop, fighting with text selection and click. Always `false`.
- **Multiple `useToggleTodo()` calls** — one per component, shared via `handleToggle`. Two calls would create two independent mutation states.

### Previous-story intelligence (Stories 2.1 + 2.2 learnings)

- **Story 2.2 introduced `useToggleTodo`** — Story 2.3 reuses it as-is. The hook's `onMutate`/`onError`/`onSuccess` already handle optimistic flip + rollback. Swipe-right calling `mutate({ id, completed: !completed })` is a drop-in caller.
- **Story 2.2's deferred items still apply** — concurrency footgun (rapid clicks/swipes can clobber peer optimistic state). Story 2.3 makes this slightly more reachable (swipe is faster than tap-tap), but the fix lives in the hook, not the component. **Do not patch the concurrency issue in this story** — it's tracked in `deferred-work.md`.
- **Story 1.5's E2E pattern** — `cleanupTodos` in `beforeEach`, `seedTodo` to populate, `page.waitForResponse` to gate visual assertions. Mirror that pattern in `complete.spec.ts` and `a11y.spec.ts`.
- **Story 1.5's Playwright config sets `workers: 1`** — preserved. The DB is shared; tests must run sequentially.
- **Story 2.2 shipped 88 unit tests and confirmed `pnpm build` was clean.** Swipe-right adds ~4 unit tests (target ≈92) and 4 e2e tests (target ≈6 total).
- **`TaskItem` is currently a server-rendered component** (no `"use client"` directive in Story 2.2). Adding `useState` + `useRef` + `useSwipeable` requires `"use client"`. The render tree already wraps it in a client boundary (`TodoListClient`), so this is a one-line directive — no architectural shift.

### Git intelligence (last 5 commits)

```
e894bed Merge pull request #11 from mattiazaffalon-nf/story-2.2-dev (Story 2.2)
6dfd953 bmad-story-2.2-toggle-completion-optimistic
524f3b2 Merge pull request #10 from mattiazaffalon-nf/story-2.1-dev (Story 2.1)
c0e2ec2 bmad-story-2.1-patch-api-todos-id
c3d6d24 Merge pull request #9 from mattiazaffalon-nf/story-1.5-dev (Story 1.5)
```

Story 2.2 just merged. Story 2.3 is the third and final story of Epic 2. After this, Epic 2 is done; Epic 3 (delete + undo) is next.

### Latest tech notes

- **`react-swipeable` 7.x** — current major. `useSwipeable(config)` returns an object you spread onto the host element. Config keys we use: `onSwipedRight`, `onSwiping`, `onSwiped`, `delta` (px velocity threshold), `trackMouse` (default `false`). The `event.deltaX` is the cumulative horizontal delta; `event.dir` is `'Left' | 'Right' | 'Up' | 'Down'`. Reference: https://github.com/FormidableLabs/react-swipeable
- **`@axe-core/playwright` 4.x** — `AxeBuilder` is the entry. `.withTags([...])` filters rule sets; `.analyze()` returns `{ violations: [], ... }`. Reference: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
- **Playwright 1.59.x** — `devices['iPhone 14']` preset includes `hasTouch: true`, `viewport: { width: 390, height: 844 }`, mobile user agent. `page.touchscreen` and `page.mouse` work; mouse events become touch under `hasTouch`. Reference: https://playwright.dev/docs/api/class-devices
- **TanStack Query 5.x** — `useMutation` already covered by Story 2.2. Nothing new here.

### File contract (target end-state for this story)

```
package.json                                    # MODIFIED — added react-swipeable + @axe-core/playwright
pnpm-lock.yaml                                  # MODIFIED — by pnpm install
hooks/
├── use-media-query.ts                          # NEW
├── use-media-query.test.ts                     # NEW
components/
├── TaskItem.tsx                                # MODIFIED — swipeable wrapper + translateX drag
└── TaskItem.test.tsx                           # MODIFIED — +4 swipe tests, +matchMedia mock
e2e/
├── complete.spec.ts                            # NEW — Journey 3 (tap + swipe)
└── a11y.spec.ts                                # NEW — empty + completed axe scans
```

No changes to: `lib/api-client.ts`, `hooks/use-toggle-todo.ts`, `hooks/use-create-todo.ts`, `db/**`, `app/api/**`, `lib/validation.ts`, `app/globals.css`, `playwright.config.ts` (the existing `webServer` + `workers: 1` config is fine for the new tests).

### Project context reference

This is the **last story of Epic 2**. After Story 2.3 ships, the toggle-completion experience is feature-complete on all platforms (tap on desktop, tap or swipe on mobile), with E2E coverage and axe-core a11y verification of the new state. Epic 3 begins with Story 3.1 (DELETE route handler) and Story 3.2 (UndoToast deferred-delete pattern), which will add a swipe-left handler to `TaskItem` (the symmetric counterpart of swipe-right shipped here).

### Out of scope for this story

- **Swipe-left for delete** — Story 3.x.
- **`UndoToast` component** — Story 3.2.
- **`ErrorIndicator` for failed toggles** — Story 4.1.
- **Concurrency hardening on `useToggleTodo`** — already in `deferred-work.md`.
- **Real-device manual testing** — UX-DR24, deferred to pre-release.
- **`prefers-reduced-motion` CI test** — UX-DR12 enforcement is already partial via the Tailwind classes; full coverage (axe + visual diff) is Story 4.3.

### References

- Story acceptance criteria source: [`_bmad-output/planning-artifacts/epics.md` §"Story 2.3"](../planning-artifacts/epics.md) (lines 500–533)
- Swipe interaction spec: [`_bmad-output/planning-artifacts/ux-design-specification.md` §"Mobile gestures"](../planning-artifacts/ux-design-specification.md) (UX-DR10, lines 96, 1054)
- Reduced-motion contract: [`_bmad-output/planning-artifacts/ux-design-specification.md`](../planning-artifacts/ux-design-specification.md) (UX-DR12, line 98)
- Stack-harmony note for `react-swipeable`: [`_bmad-output/planning-artifacts/architecture.md`](../planning-artifacts/architecture.md) (lines 55, 137, 1004, 1054, 1204)
- `@axe-core/playwright` requirement: [`_bmad-output/planning-artifacts/epics.md`](../planning-artifacts/epics.md) (UX-DR23, line 109; AC line 533)
- Story 2.2 implementation record (the `useToggleTodo` hook this story consumes): [`2-2-toggle-completion-optimistic.md`](./2-2-toggle-completion-optimistic.md)
- Story 1.5 E2E patterns (capture journey, fixtures): [`1-5-capture-todos-task-input.md`](./1-5-capture-todos-task-input.md)
- Project conventions (no modals, import graph, design tokens): [`AGENTS.md`](../../AGENTS.md)

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
| 2026-04-29 | Story 2.3 spec created        |
