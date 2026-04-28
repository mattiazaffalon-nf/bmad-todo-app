---
stepsCompleted: [1, 2, 3, 4]
status: 'complete'
completedAt: '2026-04-28'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
project_name: 'bmad-todo-app'
user_name: 'Mattiazaffalon'
date: '2026-04-28'
---

# bmad-todo-app - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for bmad-todo-app, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Users can create a new task by typing a description into an always-focused input and committing via Enter (desktop) or send-tap / keyboard "Done" (mobile). The input clears on commit and stays focused for the next capture.
FR2: A soft 280-character limit on task descriptions is silently enforced — additional input is ignored without a visible counter or warning.
FR3: Users see a list of all their tasks immediately on opening the app, with the newest task first and no pagination.
FR4: Each task displays its description with completion state visually conveyed by both a filled-indigo checkbox and strikethrough + muted text (never color alone).
FR5: Users can mark a task complete or uncomplete by tapping/clicking the checkbox (desktop or mobile) or swiping right on the row (mobile only).
FR6: Completed tasks remain in their original list position (no reorder) and transition state with a 200ms fade-and-strikethrough animation.
FR7: Users can delete a task via a hover-reveal trash icon (desktop) or swipe-left gesture (mobile, threshold ≥40% row width or ≥80px velocity).
FR8: After every deletion, an `UndoToast` ("Task deleted · Undo") appears for ~5 seconds; tapping Undo restores the task to its original position; otherwise the deletion becomes permanent on timeout.
FR9: Each task has a stable identity defined by `id` (UUID, client-generated via `crypto.randomUUID()`), `description` (string, ≤280 chars), `completed` (boolean), `createdAt` (TIMESTAMPTZ), and a forward-compat nullable `userId` (UUID).
FR10: All UI mutations (create, toggle, delete) are optimistic — the local UI updates first; the server sync happens in the background; users never see loading spinners for routine operations.
FR11: When a per-task background sync fails, an inline `ErrorIndicator` (muted amber `AlertCircle` + "Couldn't save — tap to retry") appears on that task without blocking other interactions; tapping it retries the operation.
FR12: A failed task sync preserves the user's typed content and never causes data loss; the failed indicator persists until retry succeeds or the user deletes the task.
FR13: When the task list is empty, an `EmptyState` line of muted helper text appears adjacent to the input — "Type a task and press Enter" (desktop) or "Tap to add your first task" (mobile) — with no illustration, no CTA button.
FR14: All task data persists durably across sessions, browser refreshes, and deploys via PostgreSQL storage; reopening the app shows tasks exactly as the user left them with no re-authentication.
FR15: The backend exposes a REST API for CRUD: `GET /api/todos`, `POST /api/todos`, `PATCH /api/todos/[id]`, `DELETE /api/todos/[id]`; success responses return the resource directly (no envelope), `DELETE` returns `204`.
FR16: `POST /api/todos` is idempotent on client-supplied UUIDs — a retry of the same create returns `200` with the existing todo, never `409`; `DELETE` returns `204` even if the row is already gone.
FR17: All API error responses use the canonical `{ code, message }` shape (e.g., `validation_failed`, `not_found`, `internal_error`) with appropriate HTTP status codes.
FR18: Server-side input validation via Zod runs on every Route Handler regardless of client validation, rejecting malformed payloads with `400` before any DB access.
FR19: The app initial render fetches todos server-side in `app/page.tsx` and hydrates the TanStack Query client cache via `HydrationBoundary` so the client renders immediately with no loading UI.
FR20: The system supports a single-user v1 with no authentication, but the schema (nullable `user_id`), API parameterization, and Route Handler structure leave room to add auth later without rewrites.

### NonFunctional Requirements

NFR1: UI updates for routine operations (add, complete, delete) must appear instantaneous — no spinners, no loading states, no perceived network latency. Time-to-saved on capture: <2 seconds end-to-end on mobile, one-handed.
NFR2: Tasks persist durably across sessions, browser refreshes, and deploys via Postgres; a failed background sync must never lose the user's typed content.
NFR3: WCAG 2.1 Level AA conformance across the product; primary body text meets AAA contrast (~15:1); muted-foreground meets AA (≥4.5:1); accent on accent-foreground meets AA (~4.8:1).
NFR4: Full keyboard operability — every interactive element reachable in logical Tab order; Enter/Space activates; Escape dismisses the undo toast; no keyboard traps.
NFR5: All transitions and animations honor `prefers-reduced-motion` by collapsing to instantaneous state changes; no motion is ever load-bearing for meaning.
NFR6: Layout tolerates 200% browser zoom on desktop and 200% system text size on iOS without horizontal scroll at any breakpoint (≥320px).
NFR7: All interactive touch targets are ≥44×44px (WCAG 2.5.5 AAA, voluntarily adopted).
NFR8: Mobile-first responsive layout functional from 320px viewport width upward; bottom-anchored input on mobile (safe-area-aware via `env(safe-area-inset-bottom)`); top-anchored input on desktop; ~640px max content column width.
NFR9: Browser support — evergreen Chrome, Safari, Firefox, Edge (last 2 major versions); iOS Safari and Android Chrome (last 2 OS versions). Not supported: IE11, legacy Edge.
NFR10: Server-side input validation, parameterized SQL via Drizzle, React's default escaping, and security headers (CSP without `unsafe-inline`, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) cover the OWASP top-10 surface relevant to v1.
NFR11: Mobile input font-size ≥16px to prevent iOS Safari's auto-zoom on focus.
NFR12: One-command Vercel deploy via Git push — no orchestration, no manual pipelines, no staging environment in v1 (preview deployments serve that purpose).
NFR13: `tsc --noEmit`, ESLint, Vitest unit/integration tests, and Playwright E2E (against the Vercel preview URL) must all pass before any PR can merge.
NFR14: `prefers-reduced-motion`, `@axe-core/playwright`, and `eslint-plugin-jsx-a11y` are wired into CI so accessibility regressions cannot land silently.
NFR15: Architectural extensibility — nothing in the v1 implementation precludes later addition of authentication (NextAuth or equivalent), multi-user scoping, offline / PWA service worker, or dark theme.
NFR16: Logging — server-side `console.log`/`console.error` is acceptable for v1 (Vercel captures it); client-side errors flow through Sentry; no `console.log` in production client code.

### Additional Requirements

- **Starter scaffold**: Project must be initialized via `pnpm create next-app@latest bmad-todo-app --yes` followed by `pnpm dlx shadcn@latest init -d` and `pnpm dlx shadcn@latest add button input textarea toast`. Initialization is the first implementation story.
- **Frontend stack (locked)**: Next.js 16 App Router (Turbopack default), React, TypeScript strict mode, Tailwind CSS, shadcn/ui (copy-owned in `components/ui/`), Radix primitives, Lucide React icons, `react-swipeable` for mobile gestures, Inter font via `next/font`.
- **Server / API**: REST Route Handlers in `app/api/todos/route.ts` (GET, POST) and `app/api/todos/[id]/route.ts` (PATCH, DELETE), Node.js runtime (not Edge). All handlers wrapped in `try/catch` translating throws to `500 { code: 'internal_error', ... }`.
- **Database**: PostgreSQL on Neon serverless, provisioned via the Vercel-Neon Marketplace integration. Per-PR Neon branches for isolated preview deployments. No connection pooling beyond Neon's built-in pooler.
- **ORM & migrations**: Drizzle ORM + `pg` driver + `drizzle-kit` for migration generation. Migrations run as a Vercel build-time step (`"build": "drizzle-kit migrate && next build"`).
- **Validation**: Zod schemas in `lib/validation.ts` are the single source of truth for input shapes, used by both client and server. `drizzle-zod` keeps DB and Zod schemas in sync. `TodoCreateSchema` (id UUID + description ≤280) and `TodoUpdateSchema` (completed boolean).
- **Client server-state**: TanStack Query v5 with `staleTime: Infinity` for `['todos']`, `retry: false` on mutations (user-initiated retry only), `retry: 1` on queries. Optimistic update protocol: `onMutate` snapshot+apply / `onError` restore+mark failed / `onSuccess` reconcile.
- **Per-task syncStatus state machine**: `'idle' | 'pending' | 'failed'` embedded in the cache entry, rendered by `TaskItem` + `ErrorIndicator`.
- **Deferred-delete pattern**: `useDeleteTodo` schedules the `DELETE` request via `setTimeout` with `UNDO_TIMEOUT_MS` constant (5000); Undo cancels the timeout; tab close before timeout means the task remains in DB (acceptable non-destructive failure mode).
- **Hosting & CI/CD**: Vercel for build + deploy + preview environments. GitHub Actions runs lint, typecheck, Vitest, Playwright (against Vercel preview URL). All five checks must pass to merge.
- **Error reporting**: Sentry for client and server (`@sentry/nextjs`); `sentry.{client,server,edge}.config.ts` initialization files. Sentry disabled in dev unless `NEXT_PUBLIC_SENTRY_ENABLED=true`.
- **Security headers**: configured in `next.config.ts` — CSP (strict, no `unsafe-inline`), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- **Environment variables**: `DATABASE_URL` (Neon pooled connection), `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` in Vercel; `.env.local` gitignored for local dev; `.env.example` committed as template.
- **Testing infra**: Vitest + `@testing-library/react` + `@vitejs/plugin-react` + `jsdom` for unit/integration (co-located `*.test.ts(x)` files); Playwright + `@axe-core/playwright` for E2E (`e2e/*.spec.ts`).
- **Project structure**: `app/`, `components/` (with `components/ui/` for shadcn copies), `hooks/`, `lib/`, `db/` (server-only via `import 'server-only'`), `e2e/`. No `src/`, no `services/`, no `repositories/`, no top-level `__tests__/`.
- **Import-graph enforcement**: ESLint `no-restricted-imports` blocks `components/**` from importing `db/**` or `app/api/**`; blocks `hooks/**` from `db/**` or `components/**`; blocks `app/api/**` from `components/**` or `hooks/**`.
- **Naming conventions**: snake_case plural DB tables, camelCase JSON fields, PascalCase React components (custom) and Zod schemas (`Schema` suffix), kebab-case non-component files, kebab-case shadcn `components/ui/` files (CLI-generated), SCREAMING_SNAKE_CASE for module-level constants (`UNDO_TIMEOUT_MS`, `MAX_DESCRIPTION_LENGTH`).
- **AI agent conventions**: `AGENTS.md` at repo root, edited from the Next.js 16 default to encode this project's conventions.

### UX Design Requirements

UX-DR1: Implement design-token system as CSS variables at `:root` in `app/globals.css`: `--bg` `#FAFAFA`, `--surface` `#FFFFFF`, `--foreground` `#18181B`, `--foreground-muted` `#71717A`, `--border-subtle` `#E4E4E7`, `--accent` `#4F46E5`, `--accent-foreground` `#FFFFFF`, `--error-foreground` `#B45309` (muted amber, never bright red). Tokens are wired to Tailwind theme in `tailwind.config.ts` so all utility classes resolve to variables — no hardcoded hex values in component source.
UX-DR2: Implement typography system: Inter font (self-hosted via `next/font`) with weights Regular 400 and Medium 500 only; type scale — task/input text 16px / 1.5 / 400, helper/empty-state 14px / 1.4 / 400, action label 14px / 1.2 / 500; system fallback stack `ui-sans-serif, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif`. No headings (no H1/H2/H3) in v1.
UX-DR3: Implement spacing tokens on a 4px base grid: `--space-1` 4px, `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-6` 24px, `--space-8` 32px. All component spacing consumes these tokens via Tailwind utilities.
UX-DR4: Build `TaskInput` component — auto-focused on mount; bottom-anchored on mobile (`position: fixed` with `env(safe-area-inset-bottom)` padding), top-anchored within ~640px column on desktop; single-line on mobile / auto-grow to 2 lines on desktop; soft 280-char limit silently enforced (no counter); send icon button (Lucide `Send`) appears only when input has non-whitespace content (muted → indigo when active); `aria-label="New task"` on input; commit via Enter (desktop), Return/Done (mobile keyboard), or send-tap.
UX-DR5: Build `TaskItem` component — full-width row, ~48px min-height, 12px vertical / 24px horizontal padding; circular Lucide `Circle` checkbox (24×24 icon in 44×44 hit target) on left, becomes `CheckCircle2` filled indigo when completed; task text 16px Inter Regular, single-line ellipsis on overflow; completed state shifts text to `--foreground-muted` with strikethrough and 200ms fade transition; hover-reveal `Trash2` icon on right (desktop only, `@media (hover: hover)`); 44×44 hit targets on all interactive children; `role="listitem"`, checkbox is `<button>` with `aria-pressed` and label "Mark task complete/incomplete", delete is `<button>` with `aria-label="Delete task"`.
UX-DR6: Build `TaskList` container — renders `TaskItem[]` or `EmptyState` based on task count; `role="list"` on the container; stable React keys per task so items don't remount across state changes; no dividers between rows (whitespace separation only).
UX-DR7: Build `UndoToast` component — pill-shaped container ~240–320px wide, 44px tall; label text "Task deleted" (muted-foreground) + "Undo" action button (accent-foreground text on transparent background); fade-in 200ms / fade-out 200ms; auto-dismiss after `UNDO_TIMEOUT_MS` (5000ms); replaces existing toast on new deletion (cross-fade, never stack); anchored above input on mobile, near deleted row on desktop; `role="status"` with `aria-live="polite"`; Escape dismisses without undoing; one instance at a time.
UX-DR8: Build `EmptyState` component — single line of muted helper text positioned adjacent to input; renders only when task count is zero, unmounts on first task; copy varies by viewport — desktop "Type a task and press Enter", mobile "Tap to add your first task"; `aria-live="polite"` so it announces when the list transitions to empty; associated with input via `aria-describedby`. No illustration, no icon, no CTA button.
UX-DR9: Build `ErrorIndicator` component — rendered inline in `TaskItem` when `syncStatus === 'failed'`; `AlertCircle` icon (16×16, muted amber `--error-foreground`) + helper text "Couldn't save — tap to retry"; entire indicator is a `<button>` with `aria-label="Couldn't save, tap to retry"` (icon `aria-hidden="true"`); 44×44 hit target; on retry-in-flight, icon swaps to `RotateCw` with rotation animation (static when `prefers-reduced-motion`); dismisses on retry success.
UX-DR10: Implement mobile swipe gestures on `TaskItem` via `react-swipeable` — swipe-left reveals muted-amber delete icon (no full-width red wipe); threshold ≥40% row width or ≥80px velocity triggers deletion, below threshold snaps back; swipe-right toggles completion; gestures disabled on desktop (no swipe behavior on pointer devices).
UX-DR11: Implement hover-reveal delete on desktop — `Trash2` icon in fixed position on right of `TaskItem`, hidden by default, revealed on row hover via Tailwind `hover:` utilities guarded by `@media (hover: hover)` so it does not appear on touch devices.
UX-DR12: Implement `prefers-reduced-motion` support across all transitions — completion fade+strikethrough, toast appearance/dismissal, focus ring fade-in, delete row slide-out, retry rotation icon all collapse to instantaneous state changes when the user has reduced-motion enabled. No motion is ever load-bearing for meaning (state is also conveyed by color, text, icon).
UX-DR13: Tolerate 200% browser zoom on desktop (1024px breakpoint) and 200% iOS system text size with no horizontal scroll at any breakpoint ≥320px; verify via DevTools and real-device manual test pre-release.
UX-DR14: Enforce 44×44px minimum touch targets on every interactive element — send button, complete checkbox, delete affordance, retry indicator, undo button, all `TaskItem` action buttons.
UX-DR15: Achieve WCAG 2.1 Level AA across the product; primary body foreground exceeds AAA (~15:1); never rely on color alone — completion = muted color + strikethrough; error = muted amber + icon + text; focus = visible 2px outline, not color shift.
UX-DR16: Implement keyboard operability — Tab order: input → first task checkbox → first task delete → next task checkbox → ... ; Enter/Space activates checkbox and buttons; Delete key on focused row triggers deletion (Phase 3); Cmd/Ctrl+Z within undo window restores last deletion (Phase 3); Escape dismisses undo toast without undoing.
UX-DR17: Implement ARIA semantics — `<html lang="en">` at root; `role="list"` on `TaskList`, `role="listitem"` per row; `aria-pressed` on checkbox button; `aria-live="polite"` regions for sync failures, undo availability, and empty-state transitions; `aria-label` on every icon-only button (never `title` as substitute); `aria-describedby` linking input to empty-state helper.
UX-DR18: Implement mobile bottom-anchored input with `padding-bottom: calc(<spacing> + env(safe-area-inset-bottom))` and `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` so the input clears the iOS home indicator and Android nav bar.
UX-DR19: Constrain content column to ~640px max-width centered on tablet (≥768px) and desktop (≥1024px); extra horizontal space remains intentionally unused neutral background; no side-by-side layouts, no split panes.
UX-DR20: Adopt Tailwind default breakpoints — base (mobile, 0px) / `md` 768px (tablet centered column) / `lg` 1024px (top-anchored input, hover-reveal delete, keyboard shortcuts, swipe disabled). Mobile-first authoring: base styles target mobile, breakpoint prefixes only override for larger viewports.
UX-DR21: Implement motion durations and easing — short transitions 200ms (completion fade+strike, toast in/out, focus ring), long transitions 300ms (row slide-out on deletion); Tailwind `ease-in-out` for symmetric, `ease-out` for appearances, `ease-in` for dismissals. No spring/bounce; no entrance animations on initial page load.
UX-DR22: Enforce "no modals / no confirmations / no banners / no red alerts" via `eslint-plugin` `no-restricted-imports` rule blocking imports of Radix `Dialog`, `AlertDialog`, and any non-`UndoToast` toast usage. Destructive actions use post-action undo toast, never pre-action confirmation.
UX-DR23: Implement automated accessibility verification — `@axe-core/playwright` runs on every E2E journey in `e2e/a11y.spec.ts` (zero violations); `eslint-plugin-jsx-a11y` runs in CI (zero warnings); manual color-blindness simulation (protanopia, deuteranopia, tritanopia) verified pre-release.
UX-DR24: Real-device testing pre-release — at least one iOS device (iPhone 13-class or newer) and one Android device (Pixel-class or equivalent) for swipe gestures, keyboard behavior, and safe-area handling. Emulators acceptable for breakpoint visual verification only.

### FR Coverage Map

| FR | Epic | Note |
|---|---|---|
| FR1 Create task | Epic 1 | Hero capture flow via TaskInput |
| FR2 280-char soft limit | Epic 1 | Silent enforcement in TaskInput |
| FR3 List newest-first | Epic 1 | TaskList rendering |
| FR4 Visual completion (checkbox + strikethrough) | Epic 2 | TaskItem completed state |
| FR5 Toggle complete | Epic 2 | Tap or swipe-right (mobile) |
| FR6 Fade in place, no reorder | Epic 2 | 200ms fade + strikethrough transition |
| FR7 Delete affordance | Epic 3 | Hover desktop / swipe-left mobile |
| FR8 UndoToast 5s window | Epic 3 | Deferred-delete pattern |
| FR9 Data model | Epic 1 | Drizzle schema + UUID id |
| FR10 Optimistic updates | Epic 1 (foundation), 2, 3 (extended) | Cross-cutting discipline; established with create, expanded with toggle and delete |
| FR11 ErrorIndicator inline retry | Epic 4 | Per-task surface across all mutations |
| FR12 No content loss on failure | Epic 4 | Sync state preservation, with foundation laid in Epic 1 |
| FR13 EmptyState | Epic 1 | Single muted helper line |
| FR14 Persistence across sessions | Epic 1 | Postgres durability |
| FR15 REST API | Epic 1 (GET/POST), Epic 2 (PATCH), Epic 3 (DELETE) | One endpoint per epic |
| FR16 Idempotent POST on client UUID | Epic 1 | Unblocks retry semantics |
| FR17 `{ code, message }` error contract | Epic 1 (foundation), Epic 4 (full polish) | Canonical response shape |
| FR18 Server-side Zod validation | Epic 1 | Single source of truth |
| FR19 Server-side initial render + hydration | Epic 1 | HydrationBoundary |
| FR20 Forward-compat for auth | Epic 1 | Nullable user_id, parameterized queries |

## Epic List

### Epic 1: Capture & Persist Tasks
A user can open the app, type a task, see it appear at the top of their list, and trust that it persists across sessions, refreshes, and deploys — with no signup, no setup, no friction. This epic establishes the project scaffold, design tokens, database schema, REST API foundation, optimistic-update pattern, and the capture-list-empty experience that everything else builds on.

**FRs covered:** FR1, FR2, FR3, FR9, FR10 (foundation), FR13, FR14, FR15 (GET + POST only), FR16, FR17 (foundation), FR18, FR19, FR20

**UX-DRs covered:** UX-DR1, UX-DR2, UX-DR3, UX-DR4, UX-DR6, UX-DR8, UX-DR13, UX-DR14, UX-DR15, UX-DR17, UX-DR18, UX-DR19, UX-DR20, UX-DR22

### Epic 2: Complete Tasks & See Progress
A user can mark tasks complete or uncomplete and gets a quiet, satisfying visual reward — without the list jumping, losing focus, or producing celebratory noise. This epic adds the toggle-complete capability across desktop tap and mobile swipe-right, with motion that respects accessibility preferences.

**FRs covered:** FR4, FR5, FR6, FR15 (PATCH only)

**UX-DRs covered:** UX-DR5 (completed state), UX-DR12 (motion respect), UX-DR21 (motion durations)

### Epic 3: Delete Tasks with Undo Safety
A user can remove tasks confidently — accidental deletes are forgivable for ~5 seconds without any confirmation dialog. This epic adds the destructive-action-with-undo pattern via swipe-left on mobile, hover-reveal on desktop, and a deferred DELETE that the user can cancel.

**FRs covered:** FR7, FR8, FR15 (DELETE only)

**UX-DRs covered:** UX-DR7 (UndoToast), UX-DR10 (mobile swipe), UX-DR11 (desktop hover-reveal)

### Epic 4: Resilient Sync & Production Readiness
The app stays calm and recoverable on flaky networks, never loses the user's typed content, and is safe and observable enough to be relied on in production. This epic adds the inline ErrorIndicator across all mutations, the per-task syncStatus state machine, manual user-initiated retry, Sentry instrumentation, security headers, the full a11y CI pipeline, and pre-release real-device testing.

**FRs covered:** FR10 (full discipline), FR11, FR12, FR17 (full polish)

**UX-DRs covered:** UX-DR9 (ErrorIndicator), UX-DR16 (keyboard polish), UX-DR23 (axe-core + jsx-a11y CI), UX-DR24 (real-device testing)

## Epic 1: Capture & Persist Tasks

A user opens the app, types a task, sees it appear at the top of their list, and trusts that it persists across sessions, refreshes, and deploys — with no signup, no setup, no friction. This epic establishes the project scaffold, design tokens, database schema, REST API foundation, optimistic-update pattern, and the capture-list-empty experience that everything else builds on.

### Story 1.1: Scaffold Next.js project with shadcn/ui, design tokens, and Vercel deploy

As a developer,
I want a Next.js 16 + shadcn/ui project scaffolded with our design tokens, type-checking, lint rules, and a working Vercel deploy pipeline,
So that future feature work has a solid foundation and a real production URL to develop against.

**Acceptance Criteria:**

**Given** the project is empty
**When** I run `pnpm create next-app@latest bmad-todo-app --yes`, then `pnpm dlx shadcn@latest init -d`, then `pnpm dlx shadcn@latest add button input textarea toast`
**Then** the project includes Next.js 16 App Router with TypeScript strict mode, Tailwind CSS, ESLint with the Next.js + jsx-a11y presets, and shadcn primitives in `components/ui/` (kebab-case files)
**And** `pnpm dev` starts a Turbopack dev server with sub-second hot reload

**Given** the design tokens spec
**When** I configure `app/globals.css`
**Then** all tokens are declared as CSS variables at `:root`: `--bg #FAFAFA`, `--surface #FFFFFF`, `--foreground #18181B`, `--foreground-muted #71717A`, `--border-subtle #E4E4E7`, `--accent #4F46E5`, `--accent-foreground #FFFFFF`, `--error-foreground #B45309`
**And** `tailwind.config.ts` maps these variables to theme utility classes (`bg-background`, `text-foreground`, etc.)
**And** spacing tokens (`--space-1` 4px through `--space-8` 32px) are defined and consumed by Tailwind utilities

**Given** the typography spec (UX-DR2)
**When** I configure fonts via `next/font`
**Then** Inter is self-hosted with weights 400 and 500 only, with system fallback `ui-sans-serif, -apple-system, system-ui, "Segoe UI", Roboto, sans-serif`
**And** the root layout applies the Inter font class to `<body>`
**And** `<html lang="en">` is declared and the viewport meta is `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`

**Given** the architectural import-graph
**When** I configure `eslint.config.mjs`
**Then** `no-restricted-imports` blocks `components/**` from `db/**` and `app/api/**`, blocks `hooks/**` from `db/**` and `components/**`, and blocks `app/api/**` from `components/**` and `hooks/**`
**And** the same rule blocks imports of Radix `Dialog` and `AlertDialog` (no-modals enforcement)

**Given** Vercel + GitHub are connected
**When** I push the scaffolded project to `main`
**Then** Vercel auto-deploys to a production URL that returns a 200 response with the empty page
**And** `pnpm lint` and `tsc --noEmit` pass with zero errors locally and in Vercel's build logs

**Given** the `AGENTS.md` file from `create-next-app`
**When** I edit it
**Then** it documents this project's naming conventions, import-graph rules, and "no modals / no confirmations" UI rule for AI agents

### Story 1.2: Provision Postgres database with `todos` schema and migrations pipeline

As a developer,
I want a Neon Postgres database provisioned with the `todos` table schema and a working migrations pipeline,
So that the application has durable storage with auth-forward-compat baked in.

**Acceptance Criteria:**

**Given** a Vercel project exists
**When** I provision Neon Postgres via the Vercel-Neon Marketplace integration
**Then** a production Neon project is created with `DATABASE_URL` auto-populated as a Vercel environment variable
**And** preview deployments use Neon branches (one per PR), torn down on PR close

**Given** the architecture's data model
**When** I write `db/schema.ts`
**Then** a `todos` table is defined with `id uuid PRIMARY KEY`, `description varchar(280) NOT NULL`, `completed boolean NOT NULL DEFAULT false`, `created_at timestamptz NOT NULL DEFAULT now()`, `user_id uuid` (nullable)

**Given** the schema definition
**When** I run `drizzle-kit generate`
**Then** an initial SQL migration is created at `db/migrations/0000_initial.sql`
**And** `drizzle-kit migrate` applies it successfully against a local dev DB and against an empty Neon production DB

**Given** the build pipeline
**When** I update `package.json`
**Then** the `build` script is `drizzle-kit migrate && next build` so deploys run migrations before serving traffic
**And** Vercel runs both successfully on a fresh deploy

**Given** environment configuration
**When** I set up env files
**Then** `.env.example` is committed with placeholders for `DATABASE_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`
**And** `.env.local` is gitignored
**And** `DATABASE_URL` is set in Vercel for production and preview environments

**Given** the data-access boundary
**When** I write `db/client.ts`
**Then** the file begins with `import 'server-only'` so importing it from client code is a build-time error
**And** it exports a configured Drizzle client using the `pg` driver

**Given** the queries module
**When** I write `db/queries.ts`
**Then** it exports `getTodos(userId: string | null)` returning rows ordered by `created_at DESC`, and `createTodo(input: TodoCreateInput, userId: string | null)`
**And** queries accept a `userId` argument that defaults to `null` in v1
**And** parameterized Drizzle queries are used throughout (no raw SQL strings)

**Given** test infrastructure
**When** I add Vitest config (`vitest.config.ts`) and write `db/queries.test.ts`
**Then** integration tests verify `createTodo` inserts a row and `getTodos` returns it newest-first against an ephemeral test DB

### Story 1.3: Build `GET /api/todos` and idempotent `POST /api/todos` Route Handlers

As a client (web app or future mobile),
I want REST endpoints to list and create todos with strict validation and a stable error contract,
So that I can integrate with the backend reliably and recover from network retries safely.

**Acceptance Criteria:**

**Given** the validation requirements
**When** I write `lib/validation.ts`
**Then** it exports `TodoCreateSchema` with `id: z.string().uuid()` and `description: z.string().trim().min(1).max(280)`
**And** `TodoUpdateSchema` with `completed: z.boolean()` is also exported (used in Epic 2)
**And** the inferred types `TodoCreateInput` and `Todo` are exported
**And** `drizzle-zod` keeps these schemas aligned with the Drizzle table definition

**Given** `app/api/todos/route.ts` is created
**When** a `GET` request is received
**Then** the handler calls `getTodos(null)` and returns `200 { todos: Todo[] }` with todos ordered by `created_at DESC`
**And** all date fields are serialized as ISO 8601 strings with timezone (e.g., `"2026-04-28T12:34:56.000Z"`)
**And** all field names in the JSON response are camelCase (`createdAt`, not `created_at`)

**Given** a `POST /api/todos` request
**When** the body matches `TodoCreateSchema`
**Then** the handler calls `createTodo({ id, description }, null)` and returns `201 { todo: Todo }`
**And** when the body fails Zod validation, it returns `400 { code: 'validation_failed', message }` without touching the DB

**Given** the idempotency requirement
**When** a `POST` is retried with the same `id` already in the DB
**Then** the handler returns `200 { todo: Todo }` (not `409`) with the existing row from the DB

**Given** uncaught exceptions
**When** any handler throws
**Then** the catch block logs `console.error(err)` and returns `500 { code: 'internal_error', message: 'Something went wrong' }`
**And** raw error details never leak to the client

**Given** Vitest test infrastructure
**When** I write `app/api/todos/route.test.ts`
**Then** tests cover: GET returns todos newest-first, POST creates with `201`, duplicate POST returns `200` with existing row, invalid POST returns `400`, server failure returns `500`
**And** all tests pass against an isolated test DB

### Story 1.4: Render existing todos on initial load with TaskList, TaskItem (read-only), and EmptyState

As a returning user,
I want to see my existing todos immediately when I open the app, with no spinner, no flash, and a clear empty state when I have none,
So that the app feels instant and dependable from the first paint.

**Acceptance Criteria:**

**Given** the architecture's hydration pattern
**When** I write `app/page.tsx` as a Server Component
**Then** it calls `getTodos(null)` server-side, prepares a TanStack `QueryClient` with the `['todos']` cache pre-populated, and wraps the client tree in `HydrationBoundary`
**And** no network request is fired from the client on initial render

**Given** the QueryProvider setup
**When** I write `app/providers.tsx`
**Then** it is a `'use client'` component wrapping children in `QueryClientProvider`
**And** the QueryClient is configured with `staleTime: Infinity` for `['todos']` and `retry: 1` for queries

**Given** the TaskList component (UX-DR6)
**When** I write `components/TaskList.tsx`
**Then** it consumes `useTodos()` and renders the rows inside a container with `role="list"`
**And** each task is rendered as a `TaskItem` keyed by `todo.id`
**And** the container is centered with `~640px` max-width on `md+` breakpoints; full-width on mobile (UX-DR19)
**And** when the list is empty, `EmptyState` is rendered instead

**Given** the TaskItem read-only state (UX-DR5, partial — completed state and toggle behavior come in Epic 2)
**When** I write `components/TaskItem.tsx`
**Then** the row is `role="listitem"`, ~48px min-height, with 12px vertical and 24px horizontal padding
**And** the row contains a Lucide `Circle` icon (24×24 inside a 44×44 hit target, non-interactive in this story), the description text (16px Inter Regular, single-line ellipsis on overflow), and a placeholder slot for the delete affordance (added in Epic 3)

**Given** the EmptyState component (UX-DR8)
**When** I write `components/EmptyState.tsx`
**Then** it renders a single line of muted helper text adjacent to the input area
**And** desktop variant text is `"Type a task and press Enter"`; mobile variant is `"Tap to add your first task"`
**And** the component has `aria-live="polite"` and is associated with the input via `aria-describedby`
**And** no illustration, no icon, no CTA button is rendered

**Given** the `useTodos` hook
**When** I write `hooks/use-todos.ts`
**Then** it returns `useQuery({ queryKey: ['todos'], queryFn: () => apiClient.listTodos(), staleTime: Infinity })`
**And** `lib/api-client.ts` exposes `listTodos(): Promise<Todo[]>` parsing the response with the Zod schema

**Given** Vitest tests
**When** I write `components/TaskList.test.tsx`, `components/TaskItem.test.tsx`, and `components/EmptyState.test.tsx`
**Then** rendering an empty list shows `EmptyState` with the correct viewport-appropriate copy
**And** rendering with seeded todos shows them in newest-first order matching the input
**And** layout passes 200% browser zoom verification with no horizontal scroll (UX-DR13)

### Story 1.5: Capture new todos via TaskInput with optimistic prepend and end-to-end persistence

As a user,
I want to type a task into an always-focused input and see it appear instantly at the top of my list, persisted across reloads,
So that capturing a thought is instantaneous and dependable, with no save buttons and no loading states.

**Acceptance Criteria:**

**Given** the TaskInput component (UX-DR4)
**When** I write `components/TaskInput.tsx`
**Then** the input is auto-focused on mount
**And** on mobile (base) the container is `position: fixed` at the bottom with `padding-bottom: calc(var(--space-4) + env(safe-area-inset-bottom))` (UX-DR18)
**And** on `lg+` (desktop) the container is anchored to the top of the ~640px content column
**And** the input has `aria-label="New task"`
**And** input font-size is ≥16px so iOS Safari does not auto-zoom on focus (NFR11)

**Given** the soft 280-char limit (FR2)
**When** the user types beyond 280 characters
**Then** input beyond the limit is silently ignored — no counter, no warning, no error styling

**Given** the send affordance
**When** the input has at least one non-whitespace character
**Then** a Lucide `Send` icon button (20px in a 44×44 hit target) appears to the right of the input with `aria-label="Add task"`
**And** when input is empty/whitespace-only, the send button is hidden

**Given** the commit interactions
**When** the user presses `Enter` (desktop), taps the send button, or presses Return on the mobile keyboard
**Then** the task is committed
**And** the input clears and remains focused, ready for the next capture

**Given** the optimistic-update protocol (FR10, FR16)
**When** I write `hooks/use-create-todo.ts`
**Then** the mutation calls `apiClient.createTodo({ id: crypto.randomUUID(), description })`
**And** `onMutate` cancels in-flight `['todos']` queries, snapshots the cache, and prepends `{ ...input, completed: false, createdAt: <now ISO>, syncStatus: 'pending' }`
**And** `onError` restores the snapshot from the context returned by `onMutate`
**And** `onSuccess` reconciles the optimistic entry with the server's authoritative response via `setQueryData`, marking `syncStatus: 'idle'`
**And** `retry: false` (no automatic retry — user-initiated retry comes in Epic 4)
**And** `invalidateQueries` is never called on success

**Given** the API client
**When** I extend `lib/api-client.ts`
**Then** `createTodo(input: TodoCreateInput): Promise<Todo>` POSTs to `/api/todos`, parses the response with Zod, and throws a typed error on non-2xx responses

**Given** the captured task
**When** the user reloads the page
**Then** the task appears in the list at the position dictated by `created_at DESC` (FR14)

**Given** Vitest tests
**When** I write `components/TaskInput.test.tsx` and `hooks/use-create-todo.test.ts`
**Then** the input renders auto-focused, the soft-limit silently truncates input beyond 280 chars, and Enter triggers a mutation with a UUID
**And** the optimistic mutation prepends the entry, restores on error, and reconciles on success

**Given** Playwright E2E tests
**When** I write `e2e/capture.spec.ts`
**Then** Journey 1 (first-time capture) is covered: open app → see EmptyState → type → press Enter → task appears at top → reload → task still present
**And** Journey 2 (returning-user capture) is covered: open app with existing tasks → type → Enter → new task prepends → existing tasks unchanged in order
**And** the test runs against a Vercel preview URL with an isolated Neon branch DB

**Given** `prefers-reduced-motion` (UX-DR12)
**When** the OS setting is enabled
**Then** the send button's appearance is instantaneous (no fade transition)

## Epic 2: Complete Tasks & See Progress

A user can mark tasks complete or uncomplete and gets a quiet, satisfying visual reward — without the list jumping, losing focus, or producing celebratory noise. This epic adds the toggle-complete capability across desktop tap and mobile swipe-right, with motion that respects accessibility preferences.

### Story 2.1: Build `PATCH /api/todos/[id]` Route Handler for completion state updates

As a client,
I want a PATCH endpoint to flip a todo's completion state with strict validation and the canonical error contract,
So that client-side toggle actions can be persisted reliably.

**Acceptance Criteria:**

**Given** the queries module is extended
**When** I add `updateTodo(id: string, patch: { completed: boolean }, userId: string | null)` to `db/queries.ts`
**Then** the function executes a parameterized `UPDATE todos SET completed = $1 WHERE id = $2 AND (user_id IS NULL AND $3 IS NULL OR user_id = $3) RETURNING *`
**And** it returns the updated row, or `null` when no row matched

**Given** `app/api/todos/[id]/route.ts` is created
**When** a `PATCH` request arrives with a valid body matching `TodoUpdateSchema`
**Then** the handler calls `updateTodo(id, { completed }, null)` and returns `200 { todo: Todo }`
**And** when `updateTodo` returns `null`, the handler returns `404 { code: 'not_found', message }`
**And** when the body fails validation, it returns `400 { code: 'validation_failed', message }`
**And** when the route param `id` is not a valid UUID, it returns `400 { code: 'validation_failed', message }`

**Given** uncaught exceptions
**When** any handler throws
**Then** the catch block logs `console.error(err)` and returns `500 { code: 'internal_error', message: 'Something went wrong' }`

**Given** the natural idempotency of PATCH
**When** the same `{ completed: true }` payload is sent twice
**Then** both responses are `200` with identical bodies (no `409`, no error)

**Given** Vitest tests
**When** I write `app/api/todos/[id]/route.test.ts`
**Then** tests cover: PATCH flips completion (true → false, false → true), unknown `id` returns `404`, malformed `id` returns `400`, malformed body returns `400`, server failure returns `500`
**And** all tests pass against an isolated test DB

### Story 2.2: Toggle completion via tap with optimistic update and quiet visual transition

As a user,
I want to tap (or click) the circular checkbox on any task to mark it done or undone, seeing an instant fade-and-strikethrough that feels final without jumping the list,
So that completing tasks feels rewarding and stable.

**Acceptance Criteria:**

**Given** the TaskItem checkbox
**When** I update `components/TaskItem.tsx` to make the circular checkbox interactive
**Then** the checkbox is a `<button>` element with `aria-pressed` reflecting `todo.completed`
**And** its `aria-label` is `"Mark task complete"` when active, `"Mark task incomplete"` when completed
**And** the icon swaps from Lucide `Circle` (active) to `CheckCircle2` filled with `--accent` indigo (completed)
**And** the hit target remains 44×44px (UX-DR14)
**And** focus state shows a 2px `--accent` outline with 2px offset (UX-DR15, UX-DR16)

**Given** the completion visual state (UX-DR5, FR4)
**When** a task transitions to completed
**Then** the description text shifts to `--foreground-muted` and gains a `line-through` decoration
**And** the transition is a 200ms fade for color and a 200ms transform for the strikethrough (UX-DR21)
**And** Tailwind's `ease-in-out` easing is applied
**And** when transitioning back to active, the same 200ms transition runs in reverse

**Given** the in-place stability rule (FR6)
**When** a task is marked completed
**Then** the task remains in its current list position — no reorder, no animation that moves it
**And** other rows do not shift

**Given** `prefers-reduced-motion` (UX-DR12)
**When** the OS setting is enabled
**Then** the fade and strikethrough are applied instantaneously with no transition
**And** state is still distinguishable by color, strikethrough, and the filled-checkbox icon — never by motion alone (UX-DR15)

**Given** the optimistic toggle hook
**When** I write `hooks/use-toggle-todo.ts`
**Then** the mutation calls `apiClient.toggleTodo(id, completed)`
**And** `onMutate` cancels `['todos']` queries, snapshots the cache, and updates the matching entry's `completed` field plus `syncStatus: 'pending'`
**And** `onError` restores the snapshot
**And** `onSuccess` reconciles with the server response via `setQueryData`, marking `syncStatus: 'idle'`
**And** `retry: false`

**Given** the API client
**When** I extend `lib/api-client.ts`
**Then** `toggleTodo(id: string, completed: boolean): Promise<Todo>` PATCHes `/api/todos/[id]` with `{ completed }`, parses the response with Zod, throws a typed error on non-2xx

**Given** keyboard operability (UX-DR16)
**When** the user Tabs to a task's checkbox and presses Enter or Space
**Then** the toggle fires identically to a tap

**Given** Vitest tests
**When** I write `components/TaskItem.test.tsx` (extended) and `hooks/use-toggle-todo.test.ts`
**Then** clicking the checkbox optimistically flips `completed` and renders the muted-strikethrough state
**And** an API failure rolls back the visual state (the snapshot is restored)
**And** keyboard Enter/Space on the checkbox produces the same toggle behavior

### Story 2.3: Add swipe-right gesture on mobile to complete tasks (Journey 3 E2E)

As a mobile user,
I want to swipe right on a task to mark it complete without precisely tapping the small checkbox,
So that I can complete tasks one-handed in the thumb zone.

**Acceptance Criteria:**

**Given** the swipe gesture wiring on mobile (UX-DR10)
**When** I extend `components/TaskItem.tsx` to wrap the row in a `react-swipeable` handler
**Then** swipe-right on a touch device triggers the same `useToggleTodo().mutate` call that the checkbox tap triggers
**And** the swipe threshold is ≥40% of row width or ≥80px velocity; below threshold the row snaps back
**And** during the swipe, the row translates horizontally with the finger; on release past threshold, the toggle fires and the row settles back to position with the new completed state
**And** swipe gestures are disabled at the `lg+` breakpoint (no swipe on pointer devices) — verified via media query and pointer detection

**Given** the in-place stability rule (FR6)
**When** swipe-right triggers completion
**Then** the row stays in its position; only the completion visual state changes
**And** no other rows shift

**Given** `prefers-reduced-motion`
**When** the OS setting is enabled
**Then** the swipe still works (motion is user-driven, not animated), but the post-swipe settle is instantaneous instead of a 200ms transition

**Given** Vitest tests
**When** I write `components/TaskItem.test.tsx` (extended for swipe)
**Then** the swipe handler is invoked with the correct task `id` on a swipe-right event simulated via `react-swipeable`'s test utilities (or a mock)
**And** swipe events at `lg+` viewport are ignored

**Given** Playwright E2E tests
**When** I write `e2e/complete.spec.ts`
**Then** Journey 3 is covered on a mobile viewport: open app → seed a task via API → tap checkbox → see completed state → tap again to uncomplete → see active state restored
**And** the same journey is covered with swipe-right on a touch-emulated mobile viewport
**And** `e2e/a11y.spec.ts` adds an axe-core scan of the completed-task state to assert zero violations

## Epic 3: Delete Tasks with Undo Safety

A user can remove tasks confidently — accidental deletes are forgivable for ~5 seconds without any confirmation dialog. This epic adds the destructive-action-with-undo pattern via swipe-left on mobile, hover-reveal on desktop, and a deferred DELETE that the user can cancel.

### Story 3.1: Build idempotent `DELETE /api/todos/[id]` Route Handler

As a client,
I want a DELETE endpoint that removes a todo by id and treats already-deleted as success,
So that delete retries are safe even when the network is flaky and the server has already processed a previous request.

**Acceptance Criteria:**

**Given** the queries module is extended
**When** I add `deleteTodo(id: string, userId: string | null)` to `db/queries.ts`
**Then** the function executes a parameterized `DELETE FROM todos WHERE id = $1 AND (user_id IS NULL AND $2 IS NULL OR user_id = $2)`
**And** it returns the number of rows deleted (0 or 1)
**And** no exception is thrown when no rows match — return `0` instead

**Given** `app/api/todos/[id]/route.ts` is extended
**When** a `DELETE` request arrives for a known `id`
**Then** the handler calls `deleteTodo(id, null)` and returns `204` with no response body

**Given** the idempotency requirement (FR16, applied to DELETE)
**When** a `DELETE` is retried for an `id` that no longer exists in the DB
**Then** the handler still returns `204` (treats already-deleted as success — never `404` for delete retries)

**Given** validation
**When** the route param `id` is not a valid UUID
**Then** the handler returns `400 { code: 'validation_failed', message }`

**Given** uncaught exceptions
**When** any handler throws
**Then** the catch block logs `console.error(err)` and returns `500 { code: 'internal_error', message: 'Something went wrong' }`

**Given** Vitest tests
**When** I extend `app/api/todos/[id]/route.test.ts`
**Then** tests cover: DELETE removes a row and returns `204`, DELETE on already-deleted `id` returns `204`, malformed `id` returns `400`, server failure returns `500`
**And** all tests pass against an isolated test DB

### Story 3.2: Implement deferred-delete with UndoToast and optimistic removal

As a user,
I want a deleted task to disappear from my list immediately and be recoverable for ~5 seconds via an inline Undo, without any confirmation dialog,
So that I can remove tasks confidently and recover from accidental deletions without ceremony.

**Acceptance Criteria:**

**Given** the deferred-delete pattern (FR8)
**When** I write `hooks/use-delete-todo.ts`
**Then** calling `mutate(id)` immediately removes the matching todo from the `['todos']` cache (optimistic removal) and snapshots the prior cache
**And** the actual `DELETE` HTTP request is **not** fired immediately — instead a `setTimeout(UNDO_TIMEOUT_MS)` is scheduled
**And** `UNDO_TIMEOUT_MS` is exported as `5000` from `lib/constants.ts`
**And** when the timeout elapses, `apiClient.deleteTodo(id)` fires
**And** if the user invokes "undo" before the timeout, the timeout is cancelled and the cache snapshot is restored
**And** if the DELETE request fails after the timeout, the todo is re-added to the cache with `syncStatus: 'failed'` (the failed-state UI is wired in Epic 4; for now the cache state is correct)

**Given** the API client
**When** I extend `lib/api-client.ts`
**Then** `deleteTodo(id: string): Promise<void>` DELETEs `/api/todos/[id]` and resolves on `204`, throwing a typed error on non-2xx other than `204`

**Given** the UndoToast component (UX-DR7)
**When** I write `components/UndoToast.tsx`
**Then** it renders a pill-shaped container ~240–320px wide, 44px tall, with label `"Task deleted"` (in `--foreground-muted`) and an `"Undo"` button (in `--accent-foreground` text on transparent background)
**And** the component has `role="status"` with `aria-live="polite"`
**And** it fades in over 200ms (UX-DR21) with `ease-out` and fades out over 200ms with `ease-in`
**And** auto-dismisses after `UNDO_TIMEOUT_MS` (5000ms)
**And** Escape key dismisses without undoing
**And** at most one toast is visible at a time — a new deletion within the window cross-fades to a new toast and the previous deletion's timeout completes (the previous task is permanently deleted as the new toast appears)
**And** anchored above the TaskInput on mobile, near the deleted row on desktop

**Given** `prefers-reduced-motion` (UX-DR12)
**When** the OS setting is enabled
**Then** the toast fade-in and fade-out are instantaneous (no opacity transition)

**Given** the page-level integration
**When** I extend `TodoListClient` to manage toast state via a `useReducer` with actions `SHOW`, `DISMISS`, `UNDO`
**Then** the reducer holds `{ status: 'idle' | 'visible' | 'dismissing', pendingTodo: Todo | null }`
**And** invoking `useDeleteTodo().mutate(id)` from any TaskItem dispatches `SHOW` with the snapshot
**And** tapping `Undo` dispatches `UNDO`, which cancels the timeout, restores the cache, and dispatches `DISMISS`
**And** auto-dismiss after timeout dispatches `DISMISS`
**And** focus returns to the next (or previous if last) task after a delete; or to the input if the list is now empty (UX-DR16)

**Given** Vitest tests
**When** I write `components/UndoToast.test.tsx` and `hooks/use-delete-todo.test.ts`
**Then** the toast renders with correct copy, fades in/out, auto-dismisses after 5s, and Escape dismisses without undoing
**And** the hook optimistically removes from cache, schedules a delayed DELETE, cancels on undo, and fires the DELETE on timeout
**And** a server error after timeout re-adds the todo to the cache with `syncStatus: 'failed'`

### Story 3.3: Add desktop hover-reveal trash icon and mobile swipe-left gesture (Journey 4 E2E)

As a user,
I want to delete a task by swiping left on mobile or hovering and clicking a trash icon on desktop,
So that deletion is reachable without modal ceremony in either input modality.

**Acceptance Criteria:**

**Given** the desktop hover-reveal affordance (UX-DR11)
**When** I extend `components/TaskItem.tsx` to add a delete button on the right side
**Then** the `Trash2` icon (Lucide, 20px in a 44×44 hit target) is hidden by default
**And** it becomes visible on row hover via Tailwind `group-hover:opacity-100` utilities guarded by `@media (hover: hover)` so it never appears on touch devices
**And** the button has `aria-label="Delete task"` and is keyboard-focusable in tab order after the checkbox
**And** clicking it (or pressing Enter/Space when focused) calls `useDeleteTodo().mutate(todo.id)`

**Given** the mobile swipe-left affordance (UX-DR10)
**When** I extend the `react-swipeable` wrapper from Story 2.3
**Then** swipe-left on a touch device reveals a muted-amber `Trash2` icon panel (using `--error-foreground` for the icon, never bright red)
**And** the threshold is ≥40% of row width or ≥80px velocity; below threshold the row snaps back without deleting
**And** crossing the threshold and releasing triggers `useDeleteTodo().mutate(todo.id)` and animates the row out over 300ms (UX-DR21) with `ease-in`
**And** swipe-left is disabled at the `lg+` breakpoint

**Given** the keyboard delete shortcut (UX-DR16, Phase 3)
**When** a TaskItem row is focused and the user presses the Delete key
**Then** the delete is triggered identically to the trash-icon click

**Given** `prefers-reduced-motion`
**When** the OS setting is enabled
**Then** the hover-reveal is instantaneous (no opacity transition) and the swipe-out animation is replaced by an immediate row removal

**Given** the integration with the deferred-delete pattern from Story 3.2
**When** the user completes any of the three deletion paths (hover-click, swipe-left, keyboard Delete)
**Then** the task is optimistically removed, the UndoToast appears, and the DELETE is deferred 5 seconds
**And** tapping Undo restores the task in its original position with no visible flicker

**Given** Vitest tests
**When** I extend `components/TaskItem.test.tsx`
**Then** clicking the trash icon at `lg+` viewport calls the delete mutation
**And** the trash icon is not rendered (or has `opacity: 0`) at base viewport
**And** swipe-left at base viewport simulates the delete trigger; swipe-left at `lg+` is ignored
**And** keyboard Delete on a focused row calls the delete mutation

**Given** Playwright E2E tests
**When** I write `e2e/delete-undo.spec.ts`
**Then** Journey 4 is covered on desktop: hover task → click trash → see UndoToast → tap Undo within 5s → task restored
**And** Journey 4 is covered on mobile: swipe-left task → see UndoToast → wait 5s → reload page → task is permanently deleted from server
**And** a third sub-journey verifies: delete task → wait 5s → DELETE request fires → reload → task is gone
**And** `e2e/a11y.spec.ts` adds an axe-core scan of the toast-visible state and the post-deletion focus state to assert zero violations

## Epic 4: Resilient Sync & Production Readiness

The app stays calm and recoverable on flaky networks, never loses the user's typed content, and is safe and observable enough to be relied on in production. This epic adds the inline ErrorIndicator across all mutations, the per-task syncStatus state machine, manual user-initiated retry, Sentry instrumentation, security headers, the full a11y CI pipeline, and pre-release real-device testing.

### Story 4.1: Implement ErrorIndicator component with per-task syncStatus surface

As a user,
I want a calm, non-alarming inline indicator on any task whose background sync failed, with a clear retry affordance,
So that I know which actions need my attention without being interrupted by modals or red banners.

**Acceptance Criteria:**

**Given** the ErrorIndicator component (UX-DR9)
**When** I write `components/ErrorIndicator.tsx`
**Then** the component renders a Lucide `AlertCircle` icon (16×16, color `--error-foreground` muted amber) followed by helper text `"Couldn't save — tap to retry"` (14px, also `--error-foreground`)
**And** the entire indicator is a `<button>` with `aria-label="Couldn't save, tap to retry"` and the icon is `aria-hidden="true"`
**And** the button has a 44×44 hit target (UX-DR14)
**And** color is muted amber, never bright red — the meaning is also conveyed by the icon and the text (UX-DR15)
**And** the component accepts an `onRetry: () => void` prop and a `retrying: boolean` prop

**Given** the retrying visual state
**When** `retrying` is `true`
**Then** the icon swaps to Lucide `RotateCw` with a subtle 1-rotation-per-second CSS rotation animation
**And** when `prefers-reduced-motion` is enabled, the icon is shown as static (no rotation) but the swap from `AlertCircle` to `RotateCw` still happens (UX-DR12)

**Given** the inline rendering in TaskItem
**When** I extend `components/TaskItem.tsx` to render `ErrorIndicator` inline next to the task description when `todo.syncStatus === 'failed'`
**Then** the indicator does not displace or restyle the rest of the row — only adds itself as an inline element
**And** the row's other affordances (checkbox, hover-reveal trash, swipe gestures) remain fully interactive while a failure is visible

**Given** the cache shape consistency
**When** any of the three mutation hooks (`use-create-todo`, `use-toggle-todo`, `use-delete-todo`) sets `syncStatus: 'failed'` on a cache entry on `onError`
**Then** the same `Todo` shape is preserved (the `syncStatus` field is added to the entry, not as a sibling outside the entry)
**And** successful mutations clear the field back to `'idle'` via `setQueryData`

**Given** Vitest tests
**When** I write `components/ErrorIndicator.test.tsx`
**Then** rendering with `retrying: false` shows `AlertCircle` and the static "tap to retry" copy
**And** rendering with `retrying: true` shows `RotateCw` (and the rotation class is applied unless `prefers-reduced-motion` is set in the test environment)
**And** clicking the indicator invokes `onRetry`
**And** keyboard Enter/Space on the focused indicator invokes `onRetry`

### Story 4.2: Wire user-initiated retry across all three mutations + Journey 5 E2E

As a user,
I want a one-tap retry on any failed sync that re-attempts the same operation without any blocking UI,
So that transient failures recover smoothly and my typed content never gets lost.

**Acceptance Criteria:**

**Given** the create-retry path
**When** a `useCreateTodo` mutation fails and the cache entry is re-added with `syncStatus: 'failed'`
**Then** tapping the `ErrorIndicator` on that task invokes `useCreateTodo().mutate(input)` again with the **same** UUID and description
**And** because the server's `POST` is idempotent on UUID (FR16), a successful retry returns either `201` (if the original never reached the server) or `200` (if it did) — both are reconciled identically by `onSuccess`
**And** during the retry, the `ErrorIndicator` shows the `retrying: true` state
**And** on success, the indicator is removed and `syncStatus` becomes `'idle'`

**Given** the toggle-retry path
**When** a `useToggleTodo` mutation fails and the cache entry is restored with `syncStatus: 'failed'`
**Then** tapping the `ErrorIndicator` invokes `useToggleTodo().mutate({ id, completed })` again with the most recent intended `completed` value
**And** since `PATCH` is naturally idempotent, retries are safe
**And** on success, `syncStatus` becomes `'idle'`

**Given** the delete-retry path (extending Story 3.2's deferred-delete)
**When** a deferred `useDeleteTodo` request fires after the undo window and fails, and the task is re-added with `syncStatus: 'failed'`
**Then** tapping the `ErrorIndicator` immediately re-fires `apiClient.deleteTodo(id)` (no second 5-second window — the user has already passed the undo opportunity)
**And** since `DELETE` is idempotent (Story 3.1), retries are safe
**And** on success, the task is removed from the cache and the indicator with it

**Given** the content-preservation guarantee (FR12)
**When** a `useCreateTodo` mutation fails
**Then** the `TaskInput` is **not** re-populated with the failed content — the failed task lives in the list with its `ErrorIndicator`, not in the input
**And** the user can continue typing new tasks in the input while one or more failures are visible

**Given** the no-blocking guarantee (FR11)
**When** any number of tasks have `syncStatus: 'failed'`
**Then** the rest of the UI remains fully interactive — the user can capture, complete, delete, and retry other tasks freely

**Given** Vitest tests
**When** I extend `hooks/use-create-todo.test.ts`, `hooks/use-toggle-todo.test.ts`, and `hooks/use-delete-todo.test.ts`
**Then** each test simulates a failure (mocked `apiClient` throws), verifies the cache entry's `syncStatus` is `'failed'`, then simulates a retry tap and verifies the second mutation fires with the same arguments
**And** a successful retry clears `syncStatus` to `'idle'`

**Given** Playwright E2E tests
**When** I write `e2e/error-recovery.spec.ts`
**Then** Journey 5 is covered: open app → type task → submit → mock the network to fail (via Playwright's `route.abort` or a flag in the server) → see ErrorIndicator inline on the failed task → restore the network → tap retry → see indicator disappear → reload → task is persisted
**And** during the failure, the user can continue typing additional tasks in the input and they all persist independently
**And** `e2e/a11y.spec.ts` adds an axe-core scan with a failed task visible to assert zero violations

### Story 4.3: Wire Sentry, security headers, and the full CI accessibility pipeline

As a maintainer,
I want production error reporting, security headers, and automated accessibility checks gating every PR,
So that the app is observable, safe to expose to the internet, and protected from accessibility regressions.

**Acceptance Criteria:**

**Given** Sentry initialization
**When** I add `@sentry/nextjs` and create `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`
**Then** each config file initializes Sentry with `SENTRY_DSN` (server) or `NEXT_PUBLIC_SENTRY_DSN` (client) environment variables
**And** Sentry is **disabled in development** unless the env var `NEXT_PUBLIC_SENTRY_ENABLED=true` is set
**And** the production DSN values are configured in Vercel for production and preview environments

**Given** the top-level error boundary
**When** I write `app/error.tsx`
**Then** it catches render-time errors anywhere in the React tree
**And** it renders a minimal fallback ("Something went wrong") consistent with the muted, non-alarming UI tone
**And** it reports the error to Sentry automatically via the SDK's instrumentation

**Given** security headers (NFR10)
**When** I configure `next.config.ts`
**Then** the response headers include:
  - `Content-Security-Policy` (strict, no `unsafe-inline`, allowing only same-origin scripts and styles plus the Sentry CDN domain),
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`,
  - `X-Frame-Options: DENY`,
  - `X-Content-Type-Options: nosniff`,
  - `Referrer-Policy: strict-origin-when-cross-origin`
**And** the headers are verified via curl against the deployed Vercel preview

**Given** the accessibility CI gate (UX-DR23, NFR14)
**When** I configure `eslint.config.mjs` with `eslint-plugin-jsx-a11y`
**Then** the plugin runs in the lint step and warnings are treated as errors (CI fails on any a11y warning)
**And** I write/extend `e2e/a11y.spec.ts` to run an `@axe-core/playwright` scan on every user journey state (empty, populated, mid-toast, with-failure, post-completion)
**And** all axe-core scans must report zero violations (CI fails on any violation)

**Given** GitHub Actions CI
**When** I write `.github/workflows/ci.yml`
**Then** the workflow runs on every PR with: install dependencies → `pnpm lint` → `pnpm typecheck` → `pnpm test` (Vitest) → `pnpm test:e2e` (Playwright against the Vercel preview URL after waiting for the preview to be ready)
**And** all five steps must pass for a PR to be mergeable
**And** the workflow caches dependencies between runs

**Given** the canonical error contract polish (FR17)
**When** I review every Route Handler in `app/api/todos/**`
**Then** every handler returns one of the canonical shapes: `200/201 { todo|todos }`, `204` (no body, DELETE only), `400 { code: 'validation_failed', message }`, `404 { code: 'not_found', message }`, `500 { code: 'internal_error', message }`
**And** no handler ever returns an envelope (`{ data: ..., error: null }`) or partial fields on error
**And** a shared `lib/api-errors.ts` helper exports typed error-response builders to enforce the shape

**Given** the manual verification
**When** I curl the production URL
**Then** all security headers are present
**And** `/api/todos` returns the expected shapes for valid and invalid requests
**And** the production deploy URL loads, fonts render correctly, and tokens resolve to the documented colors

### Story 4.4: Pre-launch QA pass — real-device, cross-browser, and color-blindness verification

As a release owner,
I want a documented manual QA pass across real iOS and Android devices, all four major browsers, color-blindness simulations, and 200% zoom,
So that the v1 launch is verified beyond what automated tests can cover.

**Acceptance Criteria:**

**Given** the real-device test matrix (UX-DR24, NFR9)
**When** I run a manual QA pass on at least one iOS device (iPhone 13-class or newer) and one Android device (Pixel-class or equivalent)
**Then** every user journey (Journey 1 first-time capture, Journey 2 returning capture, Journey 3 complete, Journey 4 delete with undo, Journey 5 error recovery) completes successfully
**And** swipe-left and swipe-right gestures behave correctly in both portrait and landscape orientations
**And** the bottom-anchored input clears the iOS home indicator and Android nav bar via safe-area handling
**And** iOS Safari does not auto-zoom on input focus
**And** the keyboard's Return/Done key commits a task

**Given** the cross-browser desktop matrix
**When** I manually verify the app on the latest two major versions of Chrome, Safari, Firefox, and Edge
**Then** all journeys complete; design tokens render correctly; hover-reveal delete works; keyboard navigation works; focus rings are visible

**Given** the color-blindness verification (UX-DR23)
**When** I enable Chrome DevTools Rendering → Emulate vision deficiencies for protanopia, deuteranopia, and tritanopia
**Then** task active vs. completed states remain distinguishable (icon shape + strikethrough + color independently convey state)
**And** the ErrorIndicator remains distinguishable (icon + text independently convey error state)
**And** focus rings remain visible

**Given** the 200% zoom verification (UX-DR13, NFR6)
**When** I set browser zoom to 200% on a 1024px-wide viewport (desktop) and the iOS system text size to its maximum
**Then** there is no horizontal scroll anywhere
**And** all text remains readable; all interactive elements remain at ≥44×44px effective hit targets
**And** the layout adapts gracefully — the ~640px content column still fits, the input remains usable

**Given** the keyboard-only journey (UX-DR16, NFR4)
**When** I navigate every journey using only the keyboard (Tab, Shift+Tab, Enter, Space, Escape, Delete, Cmd/Ctrl+Z)
**Then** every action is reachable and triggerable
**And** focus order is logical (input → first task checkbox → first task delete → next task checkbox → ...)
**And** focus visibly moves and never disappears or traps
**And** the Escape key dismisses the UndoToast without undoing
**And** the Delete key on a focused task triggers deletion

**Given** the screen-reader spot-check
**When** I run a journey with VoiceOver on macOS Safari
**Then** the task list is announced as a list with N items
**And** completion state changes announce via the live region (e.g., "Task marked complete")
**And** sync failures announce ("Couldn't save, tap to retry")
**And** the undo-toast appearance announces

**Given** the launch-readiness checklist
**When** the QA pass is complete
**Then** I document the results in `docs/launch-checklist.md` with one row per assertion, including the device/browser/setting tested and the pass/fail outcome
**And** any failure is filed as a blocking issue before launch
**And** the checklist is committed to the repo as the v1 launch evidence
