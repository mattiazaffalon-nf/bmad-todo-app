# v1 Launch Checklist

**Story:** 4.4 (Pre-launch QA pass — desktop)
**Scope:** Desktop-only per `_bmad-output/implementation-artifacts/deferred-work.md` (2026-04-29 decision). Mobile real-device verification dropped from v1.

**How to use this file:**
- Walk through each section in order; fill the **Result** column with `✅ Pass`, `❌ Fail`, or `⚠️ N/A` (with reason in Notes).
- For every ❌ Fail, decide: **P0** (blocks launch — fix before merge) or **P1** (ship-with-known-issue — append to `_bmad-output/implementation-artifacts/deferred-work.md`).
- Tester records exact browser+OS version in **Setting** (e.g., `Chrome 122.0 / macOS 14.5`).
- Commit this file with all rows resolved as the v1 launch evidence.

**Tester:** _________________
**Date completed:** _________________

---

## Pre-flight findings (already confirmed via grep — no manual check needed)

| Finding | Status |
|---|---|
| Delete key on focused row triggers deletion | ✅ Wired (`components/TaskItem.tsx:53`) |
| Cmd/Ctrl+Z within undo window restores deletion | ❌ NOT wired — mark related row below as ⚠️ N/A and add deferred-work entry |

---

## AC #1 — Cross-browser desktop matrix (NFR9, UX-DR23)

Run all five user journeys in each of the four browsers below. Use `pnpm dev` on `http://localhost:3000`.

**Journeys:**
- **J1**: First-time capture (empty → add task → reload → task persists)
- **J2**: Returning capture (existing task list → add new → prepended above)
- **J3**: Toggle complete (click checkbox → completed style applied → reload → state persists)
- **J4**: Delete with undo (click delete → toast → click Undo → task restored)
- **J5**: Error recovery (block POST → add task → ErrorIndicator → unblock → click retry → task persists)

**Per-browser pass criteria:** all journeys complete; design tokens render correctly (no fallback Times New Roman); hover-reveal trash icon works; focus rings visible (2px accent, 2px offset); Inter font loads.

| Assertion | Setting | Result | Notes |
|---|---|---|---|
| J1 first-time capture | Chrome (latest) | | |
| J1 first-time capture | Chrome (latest – 1) | | |
| J1 first-time capture | Safari (latest) / macOS | | |
| J1 first-time capture | Safari (latest – 1) / macOS | | |
| J1 first-time capture | Firefox (latest) | | |
| J1 first-time capture | Firefox (latest – 1) | | |
| J1 first-time capture | Edge (latest) | | |
| J1 first-time capture | Edge (latest – 1) | | |
| J2 returning capture | Chrome (latest) | | |
| J2 returning capture | Safari (latest) / macOS | | |
| J2 returning capture | Firefox (latest) | | |
| J2 returning capture | Edge (latest) | | |
| J3 toggle complete | Chrome (latest) | | |
| J3 toggle complete | Safari (latest) / macOS | | |
| J3 toggle complete | Firefox (latest) | | |
| J3 toggle complete | Edge (latest) | | |
| J4 delete with undo | Chrome (latest) | | |
| J4 delete with undo | Safari (latest) / macOS | | |
| J4 delete with undo | Firefox (latest) | | |
| J4 delete with undo | Edge (latest) | | |
| J5 error recovery + retry | Chrome (latest) | | |
| J5 error recovery + retry | Safari (latest) / macOS | | |
| J5 error recovery + retry | Firefox (latest) | | |
| J5 error recovery + retry | Edge (latest) | | |
| Inter font loads (no fallback) | Chrome (latest) | | |
| Inter font loads (no fallback) | Safari (latest) / macOS | | |
| Inter font loads (no fallback) | Firefox (latest) | | |
| Inter font loads (no fallback) | Edge (latest) | | |
| Hover-reveal trash icon on row hover | Chrome (latest) | | |
| Hover-reveal trash icon on row hover | Safari (latest) / macOS | | |
| Hover-reveal trash icon on row hover | Firefox (latest) | | |
| Hover-reveal trash icon on row hover | Edge (latest) | | |
| Focus ring (2px accent, 2px offset) renders correctly | Chrome (latest) | | |
| Focus ring (2px accent, 2px offset) renders correctly | Safari (latest) / macOS | | Known risk: Safari ≤16 may render rectangular outline on `rounded-full` (deferred-work note from Story 2.2 review) |
| Focus ring (2px accent, 2px offset) renders correctly | Firefox (latest) | | |
| Focus ring (2px accent, 2px offset) renders correctly | Edge (latest) | | |

---

## AC #2 — Color-blindness verification (UX-DR23)

In Chrome DevTools → Rendering panel → "Emulate vision deficiencies", cycle through three CVD types. For each, verify the four sub-criteria.

**Watch out for:** `--foreground-muted #71717a` on `--surface #ffffff` is exactly 4.5:1 — minimum WCAG AA. CVD simulation may push perceptual contrast below comfortable.

| Assertion | Setting | Result | Notes |
|---|---|---|---|
| Active vs. completed task distinguishable (icon + strikethrough + color) | Chrome + protanopia | | |
| Active vs. completed task distinguishable (icon + strikethrough + color) | Chrome + deuteranopia | | |
| Active vs. completed task distinguishable (icon + strikethrough + color) | Chrome + tritanopia | | |
| ErrorIndicator distinguishable (AlertCircle icon + text label) | Chrome + protanopia | | Trigger by blocking POST `/api/todos` then adding a task |
| ErrorIndicator distinguishable (AlertCircle icon + text label) | Chrome + deuteranopia | | |
| ErrorIndicator distinguishable (AlertCircle icon + text label) | Chrome + tritanopia | | |
| Focus rings visible against `--bg` and `--surface` | Chrome + protanopia | | |
| Focus rings visible against `--bg` and `--surface` | Chrome + deuteranopia | | |
| Focus rings visible against `--bg` and `--surface` | Chrome + tritanopia | | |
| Accent (`#4f46e5`) discernible from neutral grays | Chrome + protanopia | | Send button when input has text, focus ring color |
| Accent (`#4f46e5`) discernible from neutral grays | Chrome + deuteranopia | | |
| Accent (`#4f46e5`) discernible from neutral grays | Chrome + tritanopia | | |

---

## AC #3 — 200% zoom verification (UX-DR13, NFR6)

Resize Chrome window to 1024px wide, then `Cmd+= ` four times to reach 200%. Test in three states.

| Assertion | Setting | Result | Notes |
|---|---|---|---|
| No horizontal scroll — empty state | Chrome / 1024×768 / 200% zoom | | |
| No horizontal scroll — 3+ todos | Chrome / 1024×768 / 200% zoom | | |
| No horizontal scroll — UndoToast visible | Chrome / 1024×768 / 200% zoom | | |
| No horizontal scroll — failed-sync ErrorIndicator row | Chrome / 1024×768 / 200% zoom | | |
| All text remains readable | Chrome / 1024×768 / 200% zoom | | |
| Checkbox button ≥44×44px effective hit target | Chrome / 1024×768 / 200% zoom | | |
| Delete button ≥44×44px effective hit target | Chrome / 1024×768 / 200% zoom | | |
| Retry button ≥44×44px effective hit target | Chrome / 1024×768 / 200% zoom | | |
| Undo button ≥44×44px effective hit target | Chrome / 1024×768 / 200% zoom | | |
| Send button ≥44×44px effective hit target | Chrome / 1024×768 / 200% zoom | | |
| Input field ≥44×44px effective hit target | Chrome / 1024×768 / 200% zoom | | |
| Bottom-anchored input remains usable (not clipped, no overflow) | Chrome / 1024×768 / 200% zoom | | |
| ~640px content column reflows gracefully | Chrome / 1024×768 / 200% zoom | | |

---

## AC #4 — Keyboard-only journey (UX-DR16, NFR4)

Disconnect/cover the mouse. Use only Tab, Shift+Tab, Enter, Space, Escape, Delete.

| Assertion | Setting | Result | Notes |
|---|---|---|---|
| Tab focus order: input → first task checkbox → first task delete → next task checkbox → ... | Chrome (latest) | | |
| Focus is always visible (2px accent ring) — never disappears | Chrome (latest) | | |
| No focus trap anywhere — Tab always advances | Chrome (latest) | | |
| Enter/Space activates focused checkbox | Chrome (latest) | | |
| Enter/Space activates focused button (send / Undo / retry / delete) | Chrome (latest) | | |
| Escape on UndoToast → toast dismisses, deletion is **kept** (NOT undone) | Chrome (latest) | | Story 3.2 wired Escape to `onDismiss`, not `onUndo` |
| Delete key on focused row triggers deletion | Chrome (latest) | | Pre-confirmed wired at `components/TaskItem.tsx:53` |
| Cmd/Ctrl+Z within undo window restores deletion | Chrome (latest) | ⚠️ N/A | Pre-confirmed NOT wired anywhere in `components/`, `hooks/`, `app/`. Add deferred-work entry: "UX-DR16 Cmd/Ctrl+Z undo shortcut not implemented in v1; deferred." |
| Tab away from a focused row does not trigger any swipe/touch handler | Chrome (latest) | | |
| Run J1 entirely keyboard-only | Chrome (latest) | | |
| Run J3 entirely keyboard-only | Chrome (latest) | | |
| Run J4 entirely keyboard-only | Chrome (latest) | | |
| Run J5 entirely keyboard-only | Chrome (latest) | | |

---

## AC #5 — VoiceOver spot-check (macOS Safari)

Cmd+F5 to enable VoiceOver. Use VO+arrow keys. Open the **Caption Panel** (VO+Cmd+F10) to capture exact spoken strings.

| Assertion | Setting | Result | Notes (paste exact VO announcement) |
|---|---|---|---|
| Task list announced as "list, N items" | VO + Safari (latest) / macOS | | |
| Each task item announces description + completion state | VO + Safari | | |
| Toggling completion announces state change via live region | VO + Safari | | |
| Toggling un-completion announces state change | VO + Safari | | |
| UndoToast announces when it appears (`role="status"` + `aria-live="polite"`) | VO + Safari | | |
| Failed-sync row announces ("Couldn't save" + retry button) | VO + Safari | | |
| Empty-state hint announces | VO + Safari | | |

---

## AC #6 — Findings triage

After all sections above are filled in, triage every ❌ Fail row.

| Finding (copy from above) | Severity | Resolution |
|---|---|---|
| _(example)_ Safari ≤16 focus ring renders square on `rounded-full` button | P1 | Append to `deferred-work.md`; cosmetic only, not blocking |
| | | |
| | | |

**P0 items**: must be fixed before merge. Add a code commit + regression test in this same story branch.
**P1 items**: append to `_bmad-output/implementation-artifacts/deferred-work.md` under a new section dated today.

---

## AC #7 — Quality gates (post-QA)

Run after any code fixes from triage are applied. All must be green before marking the story done.

| Gate | Result | Notes |
|---|---|---|
| `pnpm lint` | | |
| `pnpm typecheck` | | |
| `pnpm test` | | |
| `pnpm test:e2e` | | |
| GitHub Actions CI green on this branch's PR | | |

---

## Sign-off

By committing this file with all rows filled in, the tester certifies that v1 has been verified against the desktop QA matrix above.

**Tester signature:** _________________
**Commit SHA:** _________________
