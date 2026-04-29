# Story 4.4: Pre-launch QA pass — desktop cross-browser, color-blindness, zoom, and keyboard verification

Status: in-progress

## Story

As a release owner,
I want a documented manual QA pass across all four major desktop browsers, color-blindness simulations, 200% zoom, keyboard-only navigation, and a screen-reader spot-check,
So that the v1 launch is verified beyond what automated CI tests cover.

## Scope decision: DESKTOP ONLY

Per `_bmad-output/implementation-artifacts/deferred-work.md` (2026-04-29 scope decision), this is a hobby project. Mobile browser support is **explicitly out of scope for v1**. The original epics.md draft for Story 4.4 (lines 815-866) was written before this decision and includes mobile/iOS/Android device testing — those AC blocks are dropped here.

**Dropped from original epics.md AC list:**
- Real-device iOS (iPhone 13+) and Android (Pixel-class) verification
- Swipe-left and swipe-right gesture testing in portrait/landscape
- iOS safe-area / home-indicator clearance verification
- iOS Safari auto-zoom-on-focus check
- Mobile keyboard Return/Done commit
- iOS system-text-size 200% verification (only desktop browser zoom)
- The Story 2.3 swipe-right gesture and Story 3.3 swipe-left gesture remain in the codebase but are NOT part of the launch QA matrix

**Retained:**
- Desktop cross-browser matrix (Chrome, Firefox, Safari, Edge — last 2 majors per NFR9)
- Color-blindness simulation (protanopia, deuteranopia, tritanopia)
- 200% browser zoom on desktop
- Keyboard-only journey
- VoiceOver spot-check (macOS)
- Documented launch-checklist as v1 launch evidence

## Acceptance Criteria

**AC #1 — Cross-browser desktop matrix (NFR9, UX-DR23)**
- All five user journeys are executed manually in the latest two major versions of: Chrome, Safari (macOS), Firefox, Edge.
- Journeys covered: Journey 1 (first-time capture), Journey 2 (returning capture), Journey 3 (toggle complete), Journey 4 (delete with undo), Journey 5 (error recovery via offline + retry).
- Pass criteria per browser: every journey completes; design tokens render correctly (calm aesthetic, no fallback Times New Roman, no broken layout); hover-reveal trash icon appears on row hover; focus rings are visible (2px accent outline, 2px offset); Inter font loads.

**AC #2 — Color-blindness verification (UX-DR23)**
- Use Chrome DevTools → Rendering panel → "Emulate vision deficiencies" to simulate **protanopia**, **deuteranopia**, and **tritanopia** in turn.
- Per simulation, verify:
  - Active vs. completed task states remain distinguishable (icon shape ✓ + strikethrough text + muted-foreground color all independently convey state — color is never the sole signal).
  - `ErrorIndicator` (Story 4.1) remains distinguishable (`AlertCircle` icon + "couldn't save" text are independent of the muted-amber color).
  - Focus rings remain visible against `--bg` and `--surface`.
  - Accent (`--accent: #4f46e5`) on send button / focus ring remains discernible from neutral grays.

**AC #3 — 200% zoom verification (UX-DR13, NFR6)**
- Set browser zoom to 200% on Chrome at a 1024px-wide viewport (resize window to 1024px first).
- Verify there is **no horizontal scroll** anywhere in the app — including with ≥3 todos, with the UndoToast visible, and with a failed-sync `ErrorIndicator` row.
- Verify all text remains readable; all interactive elements (checkbox button, delete button, retry button, Undo button, send button, input field) remain at ≥44×44px effective hit targets at 200% zoom.
- Verify the ~640px content column gracefully reflows; the bottom-anchored input remains usable; no clipped content at the viewport edges.

**AC #4 — Keyboard-only journey (UX-DR16, NFR4)**
- Disconnect/cover the mouse. Navigate every journey using only Tab, Shift+Tab, Enter, Space, Escape, Delete, Cmd/Ctrl+Z.
- Verify:
  - Focus order is logical: input → first task checkbox → first task delete button → next task checkbox → next task delete button → ... .
  - Focus is **always visible** (2px `--accent` ring with 2px offset). It never disappears during transitions or hovers.
  - No focus trap exists anywhere — focus can always advance with Tab.
  - Enter/Space activates the focused checkbox/button.
  - Tab away from a focused row does not trigger any swipe/touch handler.
  - Escape dismisses an active UndoToast WITHOUT undoing the deletion (UX-DR16 explicit behavior).
  - The Delete key on a focused task triggers deletion (Story 3.3 / UX-DR16 keyboard delete shortcut).
  - Cmd/Ctrl+Z within the 5s undo window restores the last deletion (UX-DR16; verify only if shortcut was wired — see Dev Notes).

**AC #5 — VoiceOver spot-check (macOS Safari)**
- Enable VoiceOver (Cmd+F5). Run Journey 1 → Journey 3 → Journey 4 → Journey 5.
- Verify:
  - Task list is announced as "list, N items".
  - Each list item announces the task description plus its completion state.
  - Toggling completion announces via the live region (e.g., "Task marked complete" or equivalent — `aria-pressed` toggle should be voiced by VO).
  - The UndoToast announcement fires when it appears (`role="status"` + `aria-live="polite"` from `components/UndoToast.tsx`).
  - A failed sync announces ("Couldn't save" + retry button label).
  - Empty state hint announces.

**AC #6 — Launch checklist evidence (UX-DR24-equivalent for desktop)**
- Create `docs/launch-checklist.md` documenting the QA results.
- One row per assertion (per AC item × browser/setting combination), with columns: **Assertion**, **Setting** (browser/OS/zoom/etc.), **Result** (✅ Pass / ❌ Fail / ⚠️ N/A with reason), **Notes**.
- Any FAIL must be either fixed before merge (in a follow-up commit on this branch or a separate hotfix story) OR documented in `_bmad-output/implementation-artifacts/deferred-work.md` with a clear rationale and severity label (P0 = blocks launch, P1 = ship-with-known-issue).
- The checklist file is committed to the repo and serves as the v1 launch evidence.

**AC #7 — Quality gates (no regression)**
- `pnpm lint` clean.
- `pnpm typecheck` clean.
- `pnpm test` all green.
- `pnpm test:e2e` all green (locally — CI will re-run).
- No code changes outside `docs/launch-checklist.md` and `_bmad-output/implementation-artifacts/deferred-work.md` UNLESS a manual QA finding requires a fix (in which case the fix is part of this story and must include a regression test where feasible).

## Tasks / Subtasks

- [x] **Task 1: Set up the launch checklist scaffold (AC #6)**
  - [x] Create `docs/launch-checklist.md` with the table headers and one section per AC (Cross-browser, Color-blindness, Zoom, Keyboard, VoiceOver).
  - [x] Pre-populate the rows with the assertions from each AC so the QA pass becomes a checkbox exercise rather than free-form note-taking.
  - [x] Pre-flight grep for Cmd/Ctrl+Z (per Dev Notes guidance): NOT wired in `components/`, `hooks/`, `app/`. Pre-marked AC #4 row as ⚠️ N/A in the checklist.
  - [x] Pre-flight grep for Delete-key shortcut: wired at `components/TaskItem.tsx:53`. AC #4 row noted accordingly.

- [ ] **Task 2: Cross-browser desktop matrix (AC #1)**
  - [ ] Pull the latest `main` (or this story's branch) and run `pnpm dev` locally on `http://localhost:3000`.
  - [ ] In each of Chrome, Safari, Firefox, Edge: walk through Journey 1, 2, 3, 4, 5. Mark each row in the checklist.
  - [ ] For Journey 5, simulate failure via DevTools Network → Offline mode (or Block request URL → `/api/todos`).
  - [ ] Record any layout/styling differences (e.g., focus ring rendering on Safari ≤16 — see deferred-work.md note from Story 2.2 review).

- [ ] **Task 3: Color-blindness simulation (AC #2)**
  - [ ] In Chrome DevTools → Rendering, sequentially enable protanopia, deuteranopia, tritanopia.
  - [ ] For each, verify the four sub-criteria (active/completed distinguishable, ErrorIndicator distinguishable, focus rings visible, accent vs. neutrals).
  - [ ] To trigger an `ErrorIndicator`, use the Network panel to block `POST /api/todos` then add a task; the failed task should render with the indicator.

- [ ] **Task 4: 200% zoom verification (AC #3)**
  - [ ] Resize Chrome to 1024px width (use `Cmd+Shift+M` device toolbar or manual resize).
  - [ ] Set zoom to 200% (`Cmd+= ` four times, or DevTools settings).
  - [ ] Verify with the page in three states: empty, 3+ todos, UndoToast visible (delete one task), failed-sync row (block POST and add).

- [ ] **Task 5: Keyboard-only journey (AC #4)**
  - [ ] Run through all five journeys keyboard-only.
  - [ ] Confirm Escape-on-UndoToast does NOT undo (verify the toast disappears AND the task stays removed; Story 3.2 wired `onDismiss`, not `onUndo`, to Escape).
  - [ ] Confirm Delete-on-focused-row deletes (Story 3.3 wired this).
  - [ ] **If** Cmd/Ctrl+Z within the undo window is NOT wired, mark that row as ⚠️ N/A and add a deferred-work entry: "UX-DR16 Cmd/Ctrl+Z undo shortcut not wired in v1; deferred to post-launch." (See Dev Notes — verify before assuming.)

- [ ] **Task 6: VoiceOver spot-check (AC #5)**
  - [ ] Cmd+F5 to enable VoiceOver. Use the VO+arrow keys to navigate.
  - [ ] Run Journeys 1, 3, 4, 5. Note exact VO announcements in the checklist Notes column.

- [ ] **Task 7: Triage findings and final commit (AC #6, AC #7)**
  - [ ] Any P0 (launch-blocking) failure → fix in this branch with a regression test where feasible.
  - [ ] Any P1 (known-issue) failure → add to `deferred-work.md` with severity, rationale, and proposed follow-up story.
  - [ ] Run `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e` — confirm green.
  - [ ] Commit `docs/launch-checklist.md` (and any fixes / deferred-work additions) with message referencing this story.

## Dev Notes

### Why this story is mostly documentation, not code

Stories 1.1 through 4.3 implemented the entire app and its automated quality gates. Story 4.4 is the **manual verification pass** that catches things automation cannot:
- Cross-browser rendering bugs (font rendering, CSS Grid quirks, focus-ring shapes — Safari ≤16 outline rendering on `rounded-full` is a known historical risk).
- Visual a11y (color contrast under simulated CVD, focus visibility under unusual viewports).
- Screen-reader experience (axe-core checks DOM structure but cannot verify announcement quality).
- Real human keyboard flow.

The deliverable is `docs/launch-checklist.md` — a single source of truth that future maintainers can re-run and that proves v1 was QA'd before launch.

### What about the original epics.md mobile-device requirements?

The original AC list in `_bmad-output/planning-artifacts/epics.md` lines 823-829 requires real iOS and Android device verification. **Skip these.** The 2026-04-29 scope decision in `deferred-work.md` (top of file) explicitly drops mobile from v1. The Story 2.3 (swipe-right) and Story 3.3 (swipe-left mobile gesture) tests still exist in `e2e/` and CI will run them, but they are **not** part of the launch evidence.

### Verifying Cmd/Ctrl+Z undo shortcut (AC #4)

UX-DR16 specifies Cmd/Ctrl+Z within the undo window as a keyboard shortcut to restore the last deletion. **Before testing**, grep the codebase to confirm whether this was actually wired:

```bash
grep -rn "metaKey\|ctrlKey" components/ hooks/
```

- If wired (likely in Story 3.3 with the keyboard delete shortcut), verify it works.
- If not wired, mark the row as ⚠️ N/A and add a deferred-work entry. **Do not** spec the shortcut implementation in this story — that is a separate ticket.

### Where to simulate "offline" / network failure for Journey 5

Two reliable approaches in DevTools:
1. **Network → Offline checkbox**: blocks all network. Useful for full Journey 5 (capture fails → see ErrorIndicator → re-enable network → click retry → task persists). Note: also blocks the `pnpm dev` HMR socket; refresh after re-enabling.
2. **Network → Block request URL**: pattern `*/api/todos` to block POSTs only without touching HMR. Cleaner for repeated runs.

Per Story 4.2 wiring, the retry UI persists `failedMutation: "create"|"toggle"|"delete"` so a manual retry click after re-enabling network resends the appropriate request. Verify this end-to-end in at least Chrome.

### How to capture VoiceOver announcements for the checklist

Use the VoiceOver Utility → Activity panel to log spoken text, OR open the Caption Panel via VO+Cmd+F10 to see real-time captions. Copy/paste into the checklist Notes column. Don't paraphrase — exact strings matter for future regression checks.

### Checklist row template

```markdown
| Assertion | Setting | Result | Notes |
|---|---|---|---|
| Journey 1 first-time capture completes | Chrome 122 / macOS 14.5 | ✅ Pass | — |
| Journey 1 first-time capture completes | Safari 17.4 / macOS 14.5 | ✅ Pass | Focus ring on send button renders rectangular instead of pill on Safari (cosmetic; tracked in deferred-work.md from 2-2 review) |
| Journey 5 retry restores task | Firefox 124 | ✅ Pass | — |
| Color independence — completed task | Chrome 122 + protanopia | ✅ Pass | Strikethrough + checkmark icon both visible without color |
| 200% zoom — UndoToast visible | Chrome 122 / 1024×768 | ⚠️ N/A | Toast overlaps last task row at 200% but still readable; logged P1 follow-up |
```

### Regression-fix flow if a manual finding surfaces

If a manual QA fix is required:
1. Reproduce in an automated test FIRST (extend `e2e/a11y.spec.ts` or unit test).
2. Apply the fix.
3. Verify the test fails before the fix and passes after.
4. Bundle into this story's commit.

This is consistent with the project's existing pattern (Stories 4.1, 4.2 used this flow for ErrorIndicator + retry).

### Files changed in this story

```
docs/launch-checklist.md                          # NEW — v1 launch evidence (PRIMARY DELIVERABLE)
_bmad-output/implementation-artifacts/deferred-work.md  # MODIFIED — append any P1 findings
```

Possibly modified IF QA finds a launch blocker (depends on findings):
```
components/<...>.tsx                              # bug fix scoped to QA finding
e2e/<...>.spec.ts                                 # regression coverage for the fix
```

No changes to: `db/**`, `app/api/**`, `hooks/**`, `lib/**`, `next.config.ts`, `eslint.config.mjs`, `.github/workflows/**` UNLESS a finding directly touches them.

### Previous story learnings

- **Story 4.3**: Wired axe-core CI scans (`e2e/a11y.spec.ts`) covering empty / populated / completed / UndoToast-visible / post-deletion / failed-sync states. CI also runs `eslint-plugin-jsx-a11y` at error level. Story 4.4 picks up where automation ends — visual CVD, real keyboard flow, real screen reader.
- **Story 4.3 review surfaced** an axe color-contrast failure on the muted "Task deleted" toast text that was caught only by removing the opacity fade-in. Lesson: color contrast at full opacity is exactly 4.5:1 (the minimum). At 200% zoom the same text size remains readable, but verify contrast still holds under the CVD simulations — `--foreground-muted #71717a` on `--surface #ffffff` is the at-risk pair.
- **Story 4.2**: Retry routing works via `failedMutation: "create"|"toggle"|"delete"` — useful for Journey 5 testing across all three mutation types, not just create.
- **Story 3.2**: UndoToast keyboard handling — Escape calls `onDismiss` (clears toast, keeps deletion), NOT `onUndo`. AC #4 verifies this.
- **Story 3.3**: Keyboard delete shortcut wired — Delete key on focused row triggers deletion. AC #4 verifies this.
- **Story 1.1**: Inter font loaded via `next/font` with subsetting — verify in Safari (occasional CSP / `unsafe-inline` interactions with `next/font` blob URLs were a Story 4.3 risk; should be clean now).

### Verification of CI on this branch

Story 4.3 introduced GitHub Actions CI. Before opening the QA pass PR, confirm CI is green on the parent branch (4.3 PR #18 must be merged first). If CI is flaky on the QA-pass PR, that is itself a 4.4 finding — log it as P0 if it blocks merge.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-4.4]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#Scope-decision-2026-04-29-Desktop-only]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] (UX-DR13, UX-DR16, UX-DR23 details)
- [Source: _bmad-output/planning-artifacts/prd.md] (NFR4, NFR6, NFR9 wording)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Pre-flight grep `metaKey|ctrlKey|key.*[zZ]|KeyZ` over `components/`, `hooks/`, `app/` (excluding test files): zero results → Cmd/Ctrl+Z undo shortcut is NOT implemented. Captured in checklist as ⚠️ N/A.
- Pre-flight grep `Delete|key.*[Dd]elete|onKeyDown` over same paths: hit at `components/TaskItem.tsx:53` (`if (e.key === "Delete" && !e.nativeEvent.isComposing) onDelete?.(todo.id)`). Confirmed Delete-key shortcut is wired.

### Completion Notes List

- **Task 1 ✅ complete (AI-executable)**: `docs/launch-checklist.md` created with 70+ pre-populated assertion rows organized by AC. Table-driven format — tester fills in **Result** + **Notes** columns per row; AC #6 triage table and AC #7 quality-gate table are left at the bottom for post-QA work.
- **Tasks 2–7 ⏸️ blocked on human tester**: these tasks require driving real browsers, simulating CVD via DevTools, using a physical keyboard, running VoiceOver, and triaging visual findings. None of these are AI-executable — proceeding further would mean fabricating QA results, which violates the workflow's "NEVER lie about completion" rule.
- **Pre-flight findings handed to tester**: Cmd/Ctrl+Z undo NOT wired (mark AC #4 row ⚠️ N/A and add deferred-work entry); Delete-key shortcut IS wired (`TaskItem.tsx:53`).
- **At-risk contrast pair to watch under CVD**: `--foreground-muted #71717a` on `--surface #ffffff` is exactly 4.5:1 (minimum WCAG AA) — surfaced during Story 4.3 review. Tester should pay attention to this pair under all three CVD simulations.
- **Story status remains `in-progress`**: it is NOT yet ready for review. Status flips to `review` only after the human tester has filled in the checklist, triaged findings, and run the AC #7 quality gates.

### File List

- `docs/launch-checklist.md` — NEW (primary deliverable; tester to fill in)
- `_bmad-output/implementation-artifacts/4-4-pre-launch-qa-checklist.md` — MODIFIED (story file: status, Task 1 checkboxes, Dev Agent Record)
