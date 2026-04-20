---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-04-20'
inputDocuments:
  - _bmad-output/planning-artifacts/prd.md
  - _bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
project_name: 'bmad-todo-app'
user_name: 'Mattiazaffalon'
date: '2026-04-19'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (from PRD + UX spec):**

- **Create a task** via always-focused input; commit on Enter (desktop) or send-tap (mobile).
- **List tasks** — newest-first, no pagination in v1 (task counts expected to remain small).
- **Mark a task complete / uncomplete** — single tap on the checkbox, or swipe-right on mobile.
- **Delete a task** — hover-reveal trash icon (desktop) or swipe-left (mobile), with a ~5-second inline `UndoToast` before permanent deletion.
- **Retry a failed sync** — per-task inline retry action when a background sync fails.
- **Task data model:** `id` (UUID), `description` (string, ≤280 chars), `completed` (boolean), `createdAt` (timestamp).

**Non-Functional Requirements:**

- **Performance:** UI updates must appear instantaneous. The user never waits for the network during routine operations — achieved via optimistic updates.
- **Reliability:** tasks persist across sessions and browser refreshes. A failed sync never loses the user's typed content.
- **Accessibility:** WCAG 2.1 Level AA across the product. Keyboard operability, screen-reader semantics, `prefers-reduced-motion`, 200% zoom tolerance, 44×44px touch targets.
- **Responsiveness:** mobile-first, functional from 320px up. Bottom-anchored input on mobile (safe-area-aware), top-anchored on desktop, ~640px content cap.
- **Browser support:** evergreen Chrome, Safari, Firefox, Edge; iOS Safari and Android Chrome; last 2 major versions.
- **Simplicity & maintainability:** minimum moving parts; the system should be deployable and understandable by a single developer.
- **Extensibility:** architecture must not preclude later addition of authentication, multi-user scoping, or offline/sync capability.

**Scale & Complexity:**

- **Complexity level:** low.
- **Primary domain:** full-stack web (React SPA frontend + small HTTP API + small database).
- **Expected architectural components:** ~5–7 at the service boundary — a client app, an HTTP API, a persistence layer, a task domain module, a deployment artifact, and thin cross-cutting concerns (logging, error reporting).

### Technical Constraints & Dependencies

**Prescribed by UX spec (hard constraints):**

- **Frontend framework:** React (dictated by the shadcn/ui + Radix + Lucide stack).
- **Styling:** Tailwind CSS with design tokens authored as CSS variables.
- **Component library:** shadcn/ui (copy-paste into repo) over Radix primitives.
- **Interaction utilities:** a lightweight swipe-gesture library (e.g., `react-swipeable`) for mobile swipe actions.
- **Icons:** Lucide React (inline SVG, tree-shaken).
- **Typography:** Inter self-hosted or via a privacy-respecting provider (no Google Fonts CDN that tracks users).

**Implied by PRD + UX constraints:**

- **Data persistence:** required server-side storage that survives session loss (rules out client-only `localStorage`-only v1).
- **Network resilience:** the client must handle brief network failures gracefully at the per-task level; a durable server-side write is the source of truth.
- **No authentication in v1**, but the data model and API shape must leave room to add a `userId` later without a rewrite.
- **No real-time collaboration or multi-device sync** — a single session at a time is sufficient; no WebSockets required in v1.

**Not constrained (open architectural choices):**

- Backend language and framework
- Database engine (SQL vs. document vs. embedded)
- Hosting target (serverless, containerized, PaaS)
- API style (REST vs. RPC-flavored like tRPC)
- Build tooling (Vite vs. Next.js vs. others)
- Monorepo vs. polyrepo

### Cross-Cutting Concerns Identified

- **Optimistic-update concurrency model.** Every mutating action (create, toggle complete, delete) must apply locally first, then reconcile with the server. Client needs a per-task `syncStatus` state machine and a replayable intent queue for retry.
- **Error surfaces that never block.** Failed syncs are surfaced inline at the affected task only; the global UI remains fully interactive. Retry is per-task, idempotent.
- **Design-token architecture.** Tailwind tokens wired to CSS variables at `:root`, enabling future dark mode as a single-switch change without touching component source.
- **Accessibility end-to-end.** Radix primitives handle low-level ARIA/keyboard; application-level a11y (focus management on state changes, live regions for sync failures and undo availability) must be designed into component contracts, not bolted on.
- **Data model forward-compatibility.** Task records should use UUIDs (not auto-incrementing ints) to allow future multi-user sharding and client-generated IDs (useful for optimistic creation). A nullable `userId` column or equivalent is cheap to include now.
- **Deployment simplicity.** The architecture should target one-command deploy; no orchestration overhead for a single-user app.

## Starter Template Evaluation

### Primary Technology Domain

**Full-stack web application** (React frontend + small HTTP API + PostgreSQL persistence), deployed as a single Next.js app on Vercel.

### Starter Options Considered

**Next.js 16 App Router (`create-next-app`) + shadcn/ui init** — selected

- React-native, first-class shadcn support, collapses API into Server Actions / Route Handlers, one-command deploy to Vercel.
- Next.js 16.2 ships with Turbopack by default and sub-second dev-server starts — valuable for the fast iteration loop this small project wants.

**Vite + React SPA + separate Node/Fastify API** — rejected

- More moving parts for the same outcome. Two deploys, hand-rolled fetch layer, no Server Actions equivalent. Only worthwhile if the backend needed to be independently deployable, which it doesn't.

**T3 Stack (`create-t3-app`)** — rejected

- Excellent ergonomics (tRPC + Zod + Prisma + NextAuth) but bundles authentication via NextAuth, which is explicitly out of scope for v1. Adds complexity we'd need to strip.

**Remix** — rejected

- Still viable, but smaller shadcn community and less aligned with where the React ecosystem's conventions (App Router, Server Actions) are consolidating. Also has no clear advantage for a single-user CRUD.

### Selected Starter: Next.js 16 App Router + shadcn/ui

**Rationale for Selection:**

- **Native to the dictated UX stack.** The UX spec prescribes shadcn/ui + Tailwind + Radix + Lucide. shadcn's CLI is first-class on Next.js, and most shadcn-based open-source apps run on it.
- **Single-codebase full stack.** Next.js App Router lets Server Actions handle the CRUD API without a separate backend project. For 4 endpoints, this is materially simpler than Vite-plus-separate-API.
- **One-command deploy.** Vercel's Git integration means `git push` = production deploy. No infrastructure work.
- **Forward-compatible with deferred concerns.** Adding NextAuth (authentication) or PWA/service-worker (offline) later is well-trodden in the Next.js ecosystem. Nothing we build now will close those doors.
- **Turbopack-by-default** in Next.js 16 delivers the fast dev loop the project expects to iterate in.

**Initialization Commands:**

```bash
# 1) Scaffold the Next.js app (App Router, TypeScript, Tailwind, ESLint, Turbopack — all defaults in Next.js 16)
pnpm create next-app@latest bmad-todo-app --yes

# 2) Initialize shadcn/ui (uses Next.js preset, App Router, @/* alias, Radix primitives, CSS variable theming)
cd bmad-todo-app
pnpm dlx shadcn@latest init -d

# 3) Add the shadcn components used by v1 (others are copy-paste additions as needed)
pnpm dlx shadcn@latest add button input textarea toast

# 4) Install Drizzle ORM + node-postgres driver + drizzle-kit (for migrations)
pnpm add drizzle-orm pg
pnpm add -D drizzle-kit @types/pg

# 5) Install Lucide icon set and the swipe-gesture library
pnpm add lucide-react react-swipeable
```

**Note on versions:** exact version numbers should be verified at the moment of project initialization. At the time of this document's authoring, Next.js 16.2 is current and `create-next-app` scaffolds TypeScript + Tailwind + App Router + Turbopack as defaults. shadcn/ui's `init -d` selects the `next` template automatically.

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**

- TypeScript (strict mode, enabled by default in `create-next-app`).
- Node.js runtime for Server Actions and Route Handlers. Edge Runtime is available but not required in v1 — the database driver choice dictates Node runtime.

**Styling Solution:**

- Tailwind CSS (latest, configured by `create-next-app` default flags).
- shadcn/ui init wires Tailwind design tokens to CSS variables at `:root` in `app/globals.css`, enabling the deferred-dark-mode architecture the UX spec requires.
- Component source owned in-repo under `components/ui/` after `shadcn add`.

**Build Tooling:**

- Turbopack (default dev + build in Next.js 16). ~400% faster dev startup and ~50% faster rendering vs. the legacy Webpack pipeline.
- Native ES modules, tree-shaking, automatic code splitting by route.
- `next build` for production builds; Vercel integrates these directly, no custom pipeline needed.

**Testing Framework:**

- **Not provided by the starter.** `create-next-app` ships without a test framework.
- **Added as Phase-1 architectural work** (not a starter decision): Vitest for unit/integration tests (chosen over Jest for speed and native ESM/TS support), Playwright for end-to-end flows. Details deferred to the testing strategy decision in a later step.

**Code Organization:**

- `app/` — App Router routes, layouts, Server Actions (`actions.ts` conventions).
- `components/` — React components, with `components/ui/` reserved for shadcn copies.
- `lib/` — shared utilities, DB client, server-side helpers.
- `db/` — Drizzle schema and migration files (conventional location outside `app/`).
- `@/*` import alias wired automatically (to project root).

**Development Experience:**

- Hot module replacement via Turbopack, sub-second on typical edits.
- TypeScript strict mode, path alias resolution, auto-generated route types.
- ESLint configured by default with Next.js-tuned rules.
- Built-in error overlay, source maps, and browser log forwarding (Next.js 16 feature).
- AI assistance: `create-next-app` generates an `AGENTS.md` in Next.js 16; we'll edit it to reflect our conventions in a later step.

**Note:** Project initialization using these commands should be the first implementation story in the sprint plan.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (block implementation):**

- Data schema and validation strategy
- API design (REST Route Handlers) and error contract
- Client-side state management (TanStack Query) and optimistic-update integration
- Environment configuration and database provisioning

**Important Decisions (shape architecture):**

- Forward-compatibility for auth (nullable `user_id`, API parameterization)
- Migration workflow (`drizzle-kit`)
- CI strategy (Vercel build + GitHub Actions for Playwright)
- Error reporting (Sentry)

**Deferred Decisions (post-v1):**

- Authentication (NextAuth or equivalent) — scope-excluded in PRD.
- Offline / PWA support — UX spec deferred to a future version.
- Dark mode theme values — design-token architecture is present from v1, but theme switching UI and values ship later.
- Rate limiting / abuse protection — not needed for a single-user app, wired in alongside auth.
- Caching layer beyond Neon pooling and Next.js route cache.
- Full-text search, sort controls, filters, bulk actions (all excluded in the UX spec).

### Data Architecture

**Database:** PostgreSQL (Neon serverless, provisioned via the Vercel-Neon Marketplace integration). Neon free tier covers v1 comfortably; preview deployments use Neon branches for isolation.

**Schema — single `todos` table (Drizzle definition):**

```ts
// db/schema.ts
import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

export const todos = pgTable('todos', {
  id:          uuid('id').primaryKey(),
  description: varchar('description', { length: 280 }).notNull(),
  completed:   boolean('completed').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  userId:      uuid('user_id'), // nullable in v1; populated when auth is added
});
```

**Decisions:**

- **Primary key: client-generated UUIDs** via `crypto.randomUUID()`. Enables optimistic creation without a server round-trip for the ID, and aligns cleanly with the per-task `syncStatus` state machine.
- **Description length:** enforced at the DB layer (`VARCHAR(280)`), the API layer (Zod schema), and the UI layer (soft 280-char limit in `TaskInput`). Three layers of defense, each fail-safe.
- **Timestamps:** `TIMESTAMPTZ` with timezone. All application-level time handling uses UTC; presentation layer (not needed in v1) would format in the user's local zone.
- **Forward-compat `user_id`:** nullable from day one. API and queries accept a `userId` argument (defaults to `null` in v1). Adding auth later means populating this column and adding a `WHERE user_id = ?` clause.
- **No soft-delete.** Deletion is permanent after the UndoToast window expires — undo is client-side only (the mutation is deferred, not tombstoned server-side). Keeps the schema clean.
- **No indexes beyond the PK in v1.** Row counts stay small (single user, handful to low-hundreds of tasks). An index on `(user_id, created_at DESC)` is cheap to add alongside auth.

**Validation strategy:**

- **Zod schemas** are the single source of truth for input shape. One `TodoCreateInput` and one `TodoUpdateInput` schema live in `lib/validation.ts` and are imported by both client and server.
- Client validates *before* sending (for fast user feedback where applicable), server validates *always* as the security boundary.
- Drizzle types and Zod types are kept in sync via `drizzle-zod` (generates Zod schemas from Drizzle table definitions, preventing drift).

**Migrations:**

- `drizzle-kit generate` produces SQL migration files committed to `db/migrations/`.
- `drizzle-kit migrate` runs them. On Vercel, migrations run as a post-build step via a `package.json` script; the DB URL is the same pooled Neon connection.
- Neon preview branches are created per-PR via the Vercel integration, so migrations on PRs don't touch production data.

**Caching:** none in v1. Neon's connection pooler handles connection reuse; Next.js route caching handles server-rendered initial-list payloads where applicable. A cache layer would be premature.

### Authentication & Security

**v1 authentication:** none. Deployed as a single-instance single-user app. No user accounts, no login flow, no session handling.

**Forward-compatibility for future auth:**

- Nullable `user_id` column present on `todos` from day one.
- DB query helpers accept a `userId` argument (`null` in v1).
- Route Handlers are structured so that a future `getSessionUserId()` helper can be inserted at the top of each handler without restructuring.
- No hardcoded assumption of "single user" anywhere in the schema or API.

**Security:**

- **Security headers** via `next.config.ts` middleware: Content-Security-Policy (strict, no `unsafe-inline`), Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
- **Input validation** via Zod on every Route Handler. Reject malformed payloads with a 400 response before touching the DB.
- **SQL injection:** eliminated by Drizzle's parameterized queries. No raw SQL in application code.
- **XSS:** React's default escaping covers the rendered task text. No `dangerouslySetInnerHTML` anywhere. No user-supplied HTML ever rendered.
- **CSRF:** Route Handlers using standard `fetch` from the same-origin client are protected by SameSite cookie defaults (no cross-origin cookie sending). v1 has no cookies at all, so CSRF is moot. When auth lands, SameSite=Lax session cookies plus an origin check in the handler is sufficient for this threat model.
- **Secrets management:** `DATABASE_URL` and future secrets live in Vercel environment variables (production + preview). `.env.local` for local dev, gitignored. Never logged, never committed.

### API & Communication Patterns

**API style: REST Route Handlers** (`app/api/todos/route.ts`, `app/api/todos/[id]/route.ts`).

**Rationale for REST over Server Actions:**

- Easier unit testing (standard HTTP, portable fetch-based tests).
- Usable from a future native mobile app or third-party integration without changes.
- Framework-agnostic: the contract is HTTP + JSON, not Next.js internals.
- Observability is simpler (standard HTTP logs, middleware).

**Endpoint inventory (v1):**

| Method | Path | Purpose | Request body | Success | Error |
|---|---|---|---|---|---|
| `GET`    | `/api/todos`      | List all todos, newest-first | — | `200 { todos: Todo[] }` | `500 { code, message }` |
| `POST`   | `/api/todos`      | Create a todo | `{ id, description }` | `201 { todo: Todo }` | `400` (validation) / `409` (duplicate id) / `500` |
| `PATCH`  | `/api/todos/[id]` | Update completion state | `{ completed: boolean }` | `200 { todo: Todo }` | `400` / `404` / `500` |
| `DELETE` | `/api/todos/[id]` | Delete a todo | — | `204` | `404` / `500` |

**Idempotency:**

- `POST` is **idempotent via client-supplied UUIDs**. A retry of the same create request returns `200` with the existing todo, not a `409` — the client retry layer (TanStack Query) will replay the same payload on network failures, so this must be idempotent.
- `PATCH` is naturally idempotent (same `completed` value → same state).
- `DELETE` returns `204` on repeated calls even if the row is gone (treat "already deleted" as success).

**Error contract:**

- Success responses return the resource (or no body for 204).
- Error responses always return `{ code: string, message: string }` with an appropriate HTTP status. `code` is a stable machine-readable identifier (e.g., `validation_failed`, `not_found`, `internal_error`). `message` is a human-readable sentence suitable for developer logs but not user-facing UI (the UX spec dictates a single fixed error message at the UI layer).
- Handlers never throw raw errors to the client; all throws are caught and translated.

**API documentation:** OpenAPI spec generated from Zod schemas (`zod-to-openapi` or inline), stored at `/api/docs` for manual reference. Not a formal deliverable for v1; useful when auth lands.

**Rate limiting:** deferred. When added, Vercel's built-in Edge Middleware with an in-memory or Upstash-backed sliding window is the intended approach.

### Frontend Architecture

**Server state: TanStack Query v5.**

- **Why:** implements exactly the optimistic-update / retry / rollback state machine the UX spec requires, with battle-tested semantics. Integrates with Next.js App Router via `HydrationBoundary` for server-rendered initial data.
- **Query layer:**
  - `useTodos()` — `useQuery` keyed on `['todos']`, fetches `GET /api/todos`. Server Component hydrates the cache on initial render.
  - `useCreateTodo()` — `useMutation` with `onMutate` prepending the optimistic todo (with a `syncStatus: 'pending'` flag), `onSuccess` replacing it, `onError` marking it `syncStatus: 'failed'`. Retry via manual `mutate()` re-invocation from `ErrorIndicator`.
  - `useToggleTodo()` / `useDeleteTodo()` — analogous patterns.
- **Cache semantics:** `staleTime: Infinity` for `['todos']` (the client cache IS the UI state; background refetch is not needed in v1 with no multi-device sync). Invalidation only on user-visible mutations, never on focus.

**Local UI state: React primitives.** `useState` for input text, `useReducer` where a small state machine makes sense (e.g., the `UndoToast` dismissal timer). No Zustand, no Redux, no Jotai — the app has almost no global UI state.

**Form handling:** no `react-hook-form` for v1. A single `<input>` with an `onSubmit` handler is not worth the dependency. If a future form needs multiple fields or complex validation UI, we can add it then.

**Routing:** single `/` route. The app is a single page. No nested routes, no parallel routes, no intercepting routes. `app/page.tsx` is a Server Component that fetches initial data and hydrates the client `TodoListClient`.

**Data flow:**

```
 Server Component (app/page.tsx)
        │
        ├── Fetches initial todos via a server-side DB call
        │   (NOT via fetch to /api/todos — direct DB read is faster on the server)
        │
        └── Renders HydrationBoundary with pre-populated TanStack Query cache
                │
                └── Client Component (TodoListClient)
                        │
                        ├── useTodos() — reads from hydrated cache, no initial network
                        ├── useCreateTodo/useToggleTodo/useDeleteTodo — mutations via /api/todos
                        └── Components: TaskInput, TaskList, TaskItem, UndoToast, ErrorIndicator
```

**Bundle optimization:** Next.js 16 defaults — automatic code splitting by route, tree shaking, SWC minification. Nothing manual to configure. Inter font preloaded via `next/font`.

### Infrastructure & Deployment

**Hosting:** Vercel.

- Git-connected Vercel project: `main` branch → production deploy, every PR → isolated preview deploy with its own URL.
- Vercel Functions handle Route Handlers; region set to the same region as the Neon database to minimize latency (default `iad1`/US East is fine for v1; selectable if user base is elsewhere).

**Database provisioning:** Neon via Vercel Marketplace.

- One production Neon project, auto-created via the Vercel integration.
- Preview deployments use Neon branches — each PR gets an ephemeral DB branch, torn down when the PR closes. Enables schema migrations to be tested in preview before merging.

**CI/CD:**

- **Vercel** — builds on every push, deploys previews and production automatically. No custom pipeline.
- **GitHub Actions** — runs Vitest (unit/integration) and Playwright (E2E) on every PR against the Vercel preview URL. Merging blocked on green checks. Lint + typecheck in the same workflow.
- Migrations run as a Vercel build step (`"build": "drizzle-kit migrate && next build"`) so deploy-time schema changes are applied before the new code serves traffic.

**Environment configuration:**

- **Production:** `DATABASE_URL` (pooled Neon connection), `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`. All set via Vercel dashboard.
- **Preview:** same shape, with preview-branch `DATABASE_URL` auto-injected by the Neon integration.
- **Local:** `.env.local` (gitignored) with a local DATABASE_URL pointing to either a local Postgres or a personal Neon branch.

**Monitoring & logging:**

- **Vercel built-in logs** for request + function execution. Sufficient for v1 triage.
- **Sentry** for client and server error reporting (`@sentry/nextjs`). Captures unhandled exceptions, traces, and release tracking. Free tier is adequate.
- No custom APM, no custom dashboards in v1.

**Scaling:**

- Not a concern. Neon scales to zero and back; Vercel Functions are serverless-elastic. For a single-user app, the cold-start on first morning visit is the only theoretical concern, and it's sub-second for a Next.js-on-Vercel stack with a Neon pooled connection.

### Decision Impact Analysis

**Implementation sequence (ordered):**

1. **Project scaffold** — `create-next-app` + `shadcn init` + dependency installs (from step 3).
2. **DB provisioning** — Neon via Vercel Marketplace; `DATABASE_URL` configured locally and in Vercel.
3. **Schema + migrations** — define `db/schema.ts`, generate + run the initial migration.
4. **Validation schemas** — `lib/validation.ts` with Zod + drizzle-zod.
5. **Route Handlers** — `app/api/todos/route.ts` (GET, POST) + `app/api/todos/[id]/route.ts` (PATCH, DELETE). Idempotent POST via client UUID.
6. **TanStack Query wiring** — `QueryProvider` in `app/providers.tsx`, initial hydration from Server Component.
7. **Component implementation** — per the UX spec's phase order (TaskInput, TaskItem, TaskList, then UndoToast, delete, ErrorIndicator).
8. **Testing** — Vitest for Route Handlers and mutation hooks, Playwright for the five user journeys.
9. **Sentry + security headers** — wire in before first production deploy.
10. **First production deploy** — push to `main`, verify preview + production URLs.

**Cross-component dependencies:**

- The **optimistic-update state machine** is load-bearing and cross-cutting. Route Handler idempotency, TanStack Query cache semantics, Zod validation at both boundaries, and the per-task `syncStatus` rendering all have to agree on the same error/retry contract. This is the one area where "gets it right first" vs. "patched together" shows up most in the final product.
- The **client-generated UUID** decision links DB schema, API idempotency, and client optimistic-creation. Changing it later would require a coordinated refactor of all three layers.
- **Nullable `user_id`** is a small, cheap forward-compatibility hedge. Dropping it would make future auth harder but not impossible.
- **Zod schemas shared client/server** via drizzle-zod — if the DB schema changes, the Zod schema and TypeScript types update in one place.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

This section locks down conventions where AI agents (and humans) could otherwise make inconsistent choices. Every pattern below is **mandatory** — deviations should be raised for discussion, not silently introduced.

### Naming Patterns

**Database naming (PostgreSQL conventions):**

- **Tables:** `snake_case`, **plural** (e.g., `todos`, never `todo` or `Todos`).
- **Columns:** `snake_case`, singular (e.g., `user_id`, `created_at`, `is_completed` if a boolean is not past-participle-ish — in our case, `completed`).
- **Primary keys:** always named `id`, always `uuid` type.
- **Foreign keys:** `<referenced_table_singular>_id` (e.g., `user_id` refers to `users.id`).
- **Timestamps:** `created_at`, `updated_at`, `deleted_at` (all `TIMESTAMPTZ`).
- **Indexes:** `idx_<table>_<columns>` (e.g., `idx_todos_user_id_created_at`).

**API naming:**

- **Endpoints:** plural resource names, lowercase kebab-case when multi-word. Our inventory is `/api/todos`, `/api/todos/[id]`. No `/api/todo` (singular).
- **Route parameters:** Next.js dynamic-segment format `[id]`, always lowercase, always the resource's primary key.
- **Query parameters:** camelCase (`?includeCompleted=true`), not snake_case.
- **Headers:** standard IANA-registered names where possible (`Content-Type`, `Authorization`); custom headers use `X-Prefix` only when absolutely necessary (none in v1).
- **HTTP methods:** `GET` (list/fetch), `POST` (create), `PATCH` (partial update — used for toggle-complete), `DELETE` (remove). No `PUT` in v1 (we have no full-replacement update).

**Code naming (TypeScript / React):**

- **React components:** `PascalCase` both for the exported identifier and the file name (e.g., `TaskItem.tsx` exports `TaskItem`). Exception: shadcn `components/ui/` files use kebab-case filenames (e.g., `button.tsx`) because that's what the shadcn CLI generates — we do not rename them.
- **React hooks:** `camelCase`, prefixed with `use` (e.g., `useTodos`, `useCreateTodo`).
- **Non-component modules:** kebab-case filenames (e.g., `db/client.ts`, `lib/validation.ts`).
- **Functions and variables:** `camelCase` (e.g., `createTodo`, `todoList`).
- **Constants:** `SCREAMING_SNAKE_CASE` for module-level constants exported as configuration (e.g., `UNDO_TIMEOUT_MS`). `camelCase` for local constants inside functions.
- **Types and interfaces:** `PascalCase`, no `I` prefix (e.g., `Todo`, `TodoCreateInput`, not `ITodo`). Use `type` for aliases/unions; `interface` only when declaration merging or `implements` is needed (rare in this codebase).
- **Zod schemas:** `PascalCase` ending in `Schema` (e.g., `TodoCreateSchema`). The inferred type drops the suffix: `type TodoCreateInput = z.infer<typeof TodoCreateSchema>`.
- **Boolean variables:** affirmative, prefixed with `is`, `has`, or `should` (e.g., `isCompleted`, `hasError`, `shouldRetry`). Never double-negative (`isNotCompleted`).

### Structure Patterns

**Project organization (at the repo root):**

```
bmad-todo-app/
├── app/                    # Next.js App Router
│   ├── api/todos/
│   │   ├── route.ts        # GET, POST /api/todos
│   │   └── [id]/route.ts   # PATCH, DELETE /api/todos/[id]
│   ├── layout.tsx
│   ├── page.tsx            # Server Component, hydrates client
│   ├── providers.tsx       # QueryProvider wrapper
│   └── globals.css         # CSS variable token definitions
├── components/
│   ├── ui/                 # shadcn primitives (copy-owned, kebab-case files)
│   ├── TaskInput.tsx
│   ├── TaskItem.tsx
│   ├── TaskList.tsx
│   ├── UndoToast.tsx
│   ├── EmptyState.tsx
│   └── ErrorIndicator.tsx
├── lib/
│   ├── api-client.ts       # Typed fetch wrapper
│   ├── validation.ts       # Zod schemas (shared client/server)
│   └── utils.ts            # shadcn's cn() + other shared helpers
├── hooks/
│   ├── use-todos.ts
│   ├── use-create-todo.ts
│   ├── use-toggle-todo.ts
│   └── use-delete-todo.ts
├── db/
│   ├── client.ts           # Drizzle client (server-only)
│   ├── schema.ts           # Table definitions
│   └── migrations/         # drizzle-kit generated SQL
├── e2e/                    # Playwright tests
│   ├── capture.spec.ts
│   ├── complete.spec.ts
│   └── delete-undo.spec.ts
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── AGENTS.md               # AI agent conventions (edited from Next.js default)
```

**Test file locations:**

- **Unit & integration tests:** `*.test.ts(x)` files co-located next to the module under test (e.g., `components/TaskItem.tsx` + `components/TaskItem.test.tsx`). Vitest discovers them automatically.
- **End-to-end tests:** `e2e/*.spec.ts`, Playwright-only. Never co-located with source.
- **Never** use a top-level `__tests__/` directory; never mix unit and E2E tests in the same folder.

**Component organization:**

- **By type**, not by feature — feasible because the app has one feature. Components live directly under `components/`, not in per-feature subdirectories.
- **shadcn primitives** are strictly in `components/ui/`. Never mix custom components into that directory.
- **One component per file.** If two components are tightly coupled, they can share a file only if the second is not exported.

**File structure patterns:**

- **Configuration files** (`*.config.ts`) at repo root. No `config/` subdirectory.
- **Environment files:** `.env.local` (local dev, gitignored), `.env.example` (committed template, no real values). Never `.env` directly; never commit real secrets.
- **Static assets:** `public/` for anything served directly (favicon, robots.txt, og images). No binary assets committed for v1 — the app has no images.
- **Documentation:** `README.md` at root (setup + deploy instructions). `AGENTS.md` for AI agent-specific conventions. No `docs/` directory in v1.

### Format Patterns

**API response formats:**

- **Success responses** return the resource directly, not wrapped: `{ todo: Todo }` or `{ todos: Todo[] }`. The resource key is always the singular or plural noun matching the resource. Never wrap in `{ data: ..., error: null }` — the HTTP status + body shape carries the outcome.
- **Error responses** always use the same shape: `{ code: string, message: string }`. `code` is a stable identifier (e.g., `validation_failed`, `not_found`, `internal_error`). Never return partial resources on error, never mix success and error fields.
- **No response envelope versioning in v1.** If the shape changes, introduce a new endpoint path (e.g., `/api/v2/todos`).
- **Success with no body:** `204 No Content` (used for `DELETE`). Never return `200` with `{ ok: true }` and no data.

**Data exchange formats:**

- **JSON field naming:** `camelCase` in request and response bodies. The DB uses snake_case internally; the API layer translates. (Drizzle returns camelCase by default when the column is accessed as a JS property — no manual mapping needed.)
- **Dates:** ISO 8601 strings with timezone (`"2026-04-20T12:34:56.000Z"`). Never Unix timestamps, never date-only strings.
- **Booleans:** native JSON `true` / `false`. Never `1/0`, never `"yes"/"no"`.
- **Nullable fields:** `null`, not `undefined` or missing key. The API contract explicitly includes the key with a null value (e.g., `"userId": null` for unauthenticated v1 records).
- **IDs in URLs and bodies:** string representations of UUIDs. Never integers. The client generates them, the server validates the format.

### Communication Patterns

**Client-side state:**

- **TanStack Query owns server state.** Any data derived from the API lives in the Query cache. No parallel copy in local React state.
- **Cache key convention:** array literals, resource-first. `['todos']` for the list, `['todos', todoId]` for a single item (not used in v1 but reserved).
- **Mutations always use `useMutation` with the optimistic pattern:**
  1. `onMutate` — snapshot current cache, apply optimistic update, return snapshot as context.
  2. `onError` — restore snapshot from context.
  3. `onSuccess` — no cache invalidation needed (optimistic update already correct); for GETs that would change, call `queryClient.setQueryData` with the server's authoritative response.
  4. `onSettled` — no-op in v1; avoid calling `invalidateQueries` on success (it triggers a refetch that fights optimistic state).
- **Per-task sync status:** tracked in the optimistic cache entry itself as a synthetic field `syncStatus: 'idle' | 'pending' | 'failed'`. Set in `onMutate`/`onError`/`onSuccess`. Components read it via the Query cache, never via a separate store.

**State update patterns:**

- **Always immutable.** Use spread (`{ ...todo, completed: true }`) or Immer (`produce`) where spread gets unwieldy. Never mutate in place.
- **No global event bus, no pub/sub.** TanStack Query cache invalidation and React state are sufficient.
- **React `useReducer` for local state machines** (e.g., the UndoToast has states `idle → visible → dismissing`). Reducer action names are `SCREAMING_SNAKE_CASE` constants: `SHOW`, `DISMISS`, `UNDO`.

**Logging:**

- **Server-side:** `console.log`/`console.error` is acceptable in v1 (Vercel captures it). Structured logging is deferred. Every caught error must be logged before being translated to the API error response.
- **Client-side:** no `console.log` in production code. Use a thin `logger` wrapper in `lib/logger.ts` that no-ops in production and forwards to the console in development. Errors are captured by Sentry automatically via the `@sentry/nextjs` client.
- **Log levels:** `error` (caught exceptions, 5xx responses), `warn` (unexpected but recoverable), `info` (notable events, minimal). No `debug` or `trace` in v1.

### Process Patterns

**Error handling:**

- **Server-side (Route Handlers):** every handler is wrapped in a `try/catch` that translates unexpected throws to `500 { code: 'internal_error', message }`. Zod validation failures become `400 { code: 'validation_failed', message }`. `not_found` is explicit, never implicit. The client never sees an uncaught throw.
- **Client-side (mutations):** TanStack Query's `onError` sets the per-task `syncStatus: 'failed'`. The `ErrorIndicator` component renders from this state. **No global error boundary is used for mutation failures** — mutation errors are always non-fatal and scoped to the affected task.
- **React error boundary:** one top-level boundary in `app/layout.tsx` catches render-time errors. It renders a minimal fallback ("Something went wrong") and reports to Sentry. This is the last line of defense, not the primary error path.
- **Never use `alert()` or `confirm()`.** The UX spec forbids both; the implementation must never reach for them.

**Loading states:**

- **Routine operations (add/complete/delete) never show a loading state to the user.** Optimistic updates bypass the loading phase entirely.
- **Initial hydration:** if the Server Component's data is in place, the client renders immediately with no loading UI. If for some reason the client must fetch without a hydrated cache (shouldn't happen in v1), TanStack Query's `isPending` is handled at the route level and shown as a blank list area — no spinner.
- **Retry in progress:** the only visible "loading" state. `ErrorIndicator` swaps its icon to a rotating `RotateCw` while a retry mutation is in flight.

**Retry patterns:**

- **TanStack Query's built-in retry is disabled for mutations** (`retry: false`) — retries are user-initiated via the `ErrorIndicator`, not automatic. Automatic retries on a POST would defeat the UX intent of surfacing the failure to the user.
- **Queries (GETs) retry once** (`retry: 1`) on transient failures with exponential backoff. A permanent GET failure shows a blank list with no error UI in v1 (extremely unlikely for a working database).

**Validation timing:**

- **Client:** validates before calling `mutate`. Invalid input (e.g., empty string) short-circuits without hitting the API. Errors from client validation never reach the server.
- **Server:** validates every input even if the client already did. Security boundary, never trusted to be pre-validated.
- **DB:** column constraints (length, NOT NULL) are the final line of defense. Should never trigger if client + server validation are correct.

### Enforcement Guidelines

**All AI agents and developers MUST:**

- Run `tsc --noEmit` and `eslint` before proposing any change. No warnings acceptable.
- Run `vitest run` before claiming a feature complete. Unit tests for Route Handlers and mutation hooks are mandatory.
- Match existing naming conventions exactly. If a convention isn't documented here, match the closest existing code.
- Use only the approved dependencies (see `package.json`). Introducing a new dependency requires updating this document in the same PR.
- Never call `fetch` directly from components. Always go through a typed hook in `hooks/` that wraps TanStack Query.
- Never hardcode color hex values, font sizes, or spacing in component source. Use Tailwind utility classes that resolve to CSS variables.
- Follow the error contract: success = resource body, failure = `{ code, message }` with appropriate HTTP status.

**Pattern enforcement:**

- **Static enforcement:** TypeScript strict mode + ESLint + the Next.js-tuned `@typescript-eslint` preset cover most violations.
- **Lint rules to enable (in `.eslintrc` or `eslint.config.js`):** `no-console` (error in production builds, warn in dev), `no-restricted-imports` (forbid importing from `db/*` in `components/*`), import sorting (alphabetical within groups).
- **Manual review:** pull request reviewers check naming, file organization, and cross-cutting patterns (optimistic-update invariants, error contract).
- **Violations:** tracked in PR review comments; persistent violations indicate a pattern that needs revisiting (update this document, don't let drift accumulate).

### Pattern Examples

**Good examples:**

```ts
// Good: Zod schema as single source of truth
// lib/validation.ts
import { z } from 'zod';
export const TodoCreateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(280),
});
export type TodoCreateInput = z.infer<typeof TodoCreateSchema>;

// Good: Route Handler with try/catch + Zod + error contract
// app/api/todos/route.ts
export async function POST(req: Request) {
  try {
    const parsed = TodoCreateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json(
        { code: 'validation_failed', message: parsed.error.message },
        { status: 400 }
      );
    }
    const todo = await createTodo(parsed.data);
    return Response.json({ todo }, { status: 201 });
  } catch (err) {
    console.error(err);
    return Response.json(
      { code: 'internal_error', message: 'Something went wrong' },
      { status: 500 }
    );
  }
}

// Good: optimistic mutation hook
// hooks/use-create-todo.ts
export function useCreateTodo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TodoCreateInput) => apiClient.createTodo(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previous = queryClient.getQueryData<Todo[]>(['todos']);
      queryClient.setQueryData<Todo[]>(['todos'], (old = []) => [
        { ...input, completed: false, createdAt: new Date().toISOString(), syncStatus: 'pending' },
        ...old,
      ]);
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['todos'], ctx.previous);
      // ... then re-add with syncStatus: 'failed' in the UI layer
    },
    retry: false,
  });
}
```

**Anti-patterns (do not do):**

```ts
// BAD: wrapping response in envelope
return Response.json({ data: todo, error: null }, { status: 201 });

// BAD: throwing to the client
throw new Error('Todo not found'); // Crashes the handler, returns 500 instead of 404

// BAD: snake_case in API payloads
return Response.json({ todos: [{ id: '...', created_at: '...', is_completed: false }] });

// BAD: fetch directly in a component
function TaskList() {
  useEffect(() => { fetch('/api/todos').then(...) }, []); // Should use useTodos() hook
}

// BAD: hardcoded style values
<div style={{ color: '#18181B', padding: '12px' }}>Task</div>
// Correct: use Tailwind utility classes that resolve to design tokens
<div className="text-foreground py-3">Task</div>

// BAD: mutation with automatic retry on a POST
useMutation({ mutationFn: createTodo, retry: 3 });
// Correct: retry: false, user-initiated via ErrorIndicator

// BAD: cache invalidation on mutation success (fights optimistic state)
onSuccess: () => queryClient.invalidateQueries({ queryKey: ['todos'] });
// Correct: setQueryData with the server response, no invalidation
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
bmad-todo-app/
├── README.md                          # Setup + deploy + local dev instructions
├── AGENTS.md                          # AI agent conventions (edited from Next.js default)
├── LICENSE                            # (if publishing as open source)
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts                     # Security headers, Sentry integration
├── tailwind.config.ts
├── postcss.config.mjs
├── drizzle.config.ts                  # drizzle-kit configuration (DB URL, migrations path)
├── vitest.config.ts                   # Unit/integration test configuration
├── playwright.config.ts               # E2E test configuration
├── eslint.config.mjs                  # ESLint flat config (Next.js + typescript-eslint + a11y)
├── components.json                    # shadcn/ui CLI configuration
├── sentry.client.config.ts            # Sentry browser SDK initialization
├── sentry.server.config.ts            # Sentry Node SDK initialization
├── sentry.edge.config.ts              # Sentry Edge runtime initialization (if used)
├── .env.example                       # Committed template, no real values
├── .env.local                         # Gitignored, local dev only
├── .gitignore
├── .nvmrc                             # Pin Node version (LTS matching Vercel runtime)
├── .github/
│   └── workflows/
│       ├── ci.yml                     # lint + typecheck + vitest + Playwright (on PR)
│       └── codeql.yml                 # (optional) GitHub security scanning
├── app/
│   ├── layout.tsx                     # Root layout, <html lang="en">, font, error boundary
│   ├── page.tsx                       # Server Component: fetches todos, hydrates client
│   ├── providers.tsx                  # 'use client': QueryClientProvider wrapper
│   ├── globals.css                    # CSS variable tokens for light (and later dark) theme
│   ├── error.tsx                      # Top-level error boundary fallback
│   ├── not-found.tsx                  # 404 page (simple, consistent with minimalist UI)
│   └── api/
│       └── todos/
│           ├── route.ts               # GET /api/todos, POST /api/todos
│           ├── route.test.ts          # Vitest integration tests for GET/POST handlers
│           └── [id]/
│               ├── route.ts           # PATCH, DELETE /api/todos/[id]
│               └── route.test.ts      # Vitest integration tests for PATCH/DELETE handlers
├── components/
│   ├── ui/                            # shadcn primitives (kebab-case, copy-owned)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── textarea.tsx
│   │   └── toast.tsx
│   ├── TaskInput.tsx                  # Hero capture input (bottom-mobile / top-desktop)
│   ├── TaskInput.test.tsx
│   ├── TaskList.tsx                   # Renders TaskItem[] or EmptyState
│   ├── TaskList.test.tsx
│   ├── TaskItem.tsx                   # Row: checkbox + text + delete + (optional) ErrorIndicator
│   ├── TaskItem.test.tsx
│   ├── UndoToast.tsx                  # Short-lived undo affordance
│   ├── UndoToast.test.tsx
│   ├── EmptyState.tsx                 # Single-line helper text
│   ├── EmptyState.test.tsx
│   ├── ErrorIndicator.tsx             # Inline muted-amber retry affordance
│   └── ErrorIndicator.test.tsx
├── hooks/
│   ├── use-todos.ts                   # useQuery(['todos'])
│   ├── use-todos.test.ts
│   ├── use-create-todo.ts             # Optimistic POST /api/todos
│   ├── use-create-todo.test.ts
│   ├── use-toggle-todo.ts             # Optimistic PATCH /api/todos/[id]
│   ├── use-toggle-todo.test.ts
│   ├── use-delete-todo.ts             # Optimistic DELETE /api/todos/[id] + undo queue
│   └── use-delete-todo.test.ts
├── lib/
│   ├── api-client.ts                  # Typed fetch wrapper (uses Zod schemas for parsing)
│   ├── api-client.test.ts
│   ├── validation.ts                  # TodoCreateSchema, TodoUpdateSchema, Todo type
│   ├── validation.test.ts
│   ├── utils.ts                       # cn() (shadcn), date helpers, guards
│   ├── utils.test.ts
│   ├── logger.ts                      # Thin client/server logger wrapper
│   └── constants.ts                   # UNDO_TIMEOUT_MS, MAX_DESCRIPTION_LENGTH, etc.
├── db/
│   ├── client.ts                      # 'server-only': Drizzle client + Neon pool
│   ├── schema.ts                      # pgTable definitions
│   ├── queries.ts                     # getTodos(userId), createTodo(input, userId), etc.
│   ├── queries.test.ts                # Integration tests against a test DB
│   └── migrations/
│       ├── 0000_initial.sql           # drizzle-kit generated
│       └── meta/                      # drizzle-kit internal snapshot files
├── e2e/
│   ├── capture.spec.ts                # Journey 1 + 2: first-time + returning capture
│   ├── complete.spec.ts               # Journey 3: complete a task
│   ├── delete-undo.spec.ts            # Journey 4: delete with undo
│   ├── error-recovery.spec.ts         # Journey 5: failed sync + retry
│   ├── a11y.spec.ts                   # Keyboard + axe scans on every journey
│   └── fixtures/
│       └── test-db.ts                 # Shared setup/teardown for ephemeral DB
├── public/
│   ├── favicon.ico
│   ├── favicon.svg
│   └── robots.txt
└── scripts/
    ├── seed.ts                        # (optional) local dev seed data
    └── reset-db.ts                    # (optional) dev convenience
```

**Files intentionally absent:**

- No `docs/` directory — `README.md` + `AGENTS.md` at root are sufficient.
- No `config/` directory — configuration files live at the repo root.
- No `src/` wrapper — Next.js App Router convention is to keep `app/`, `components/`, `lib/`, etc. at the repo root.
- No `types/` directory — types colocate with the module that defines them (`lib/validation.ts` exports `Todo`, `TodoCreateInput`).
- No `services/`, `repositories/`, `decorators/` — these belong to a NestJS-style layered architecture, not an App Router app. Data access lives in `db/queries.ts`; HTTP handlers live in `app/api/`; there is no service layer worth introducing.
- No `middleware.ts` at the root in v1 — no auth, no locale routing, no redirects needed. Security headers are applied via `next.config.ts`.

### Architectural Boundaries

**API boundary** — `app/api/todos/**/route.ts`

- Only layer that accepts HTTP input and emits HTTP responses.
- Validates input via Zod, translates errors into the standard `{ code, message }` contract.
- Never contains business logic — delegates to `db/queries.ts` for all data operations.
- Never imports from `components/` or `hooks/`.

**Data boundary** — `db/`

- Only layer that holds a direct DB connection (Drizzle client in `db/client.ts`).
- `db/client.ts` starts with `import 'server-only'` to enforce server-only usage at the bundler level.
- `db/queries.ts` exposes typed async functions: `getTodos(userId)`, `createTodo(input, userId)`, `updateTodo(id, patch, userId)`, `deleteTodo(id, userId)`.
- Never throws; returns result objects or throws only on programmer errors (which the Route Handler's try/catch surfaces as 500).
- Never imports from `app/api/`, `components/`, or `hooks/` (unidirectional import graph).

**Component boundary** — `components/`

- Presentational React components. Pure with respect to server state — they read from TanStack Query via hooks, they never `fetch` directly.
- `components/ui/` is reserved for shadcn-generated primitives. Custom components live directly in `components/`.
- Never imports from `db/` or `app/api/` (would cross server/client boundary).
- Never hardcodes strings that represent user-facing copy that might be localized later — for v1 copy is inline, but a future i18n change will be a focused rename.

**Hook boundary** — `hooks/`

- Thin wrappers around TanStack Query's `useQuery` / `useMutation`.
- Own the optimistic update / rollback / error state logic.
- Import from `lib/api-client.ts` for the HTTP call; never `fetch` directly.
- Never imports from `components/` or `db/`.

**Shared-code boundary** — `lib/`

- Isomorphic utilities safe to import from both client and server.
- `lib/validation.ts` is the single source of truth for input shapes (Zod + inferred types).
- `lib/api-client.ts` is client-only (uses `fetch`), but the module itself has no server-only imports.
- `lib/constants.ts` holds all magic numbers (timeouts, limits) as named exports.

**Import graph (unidirectional):**

```
         app/api/* ─────────► db/queries.ts ─────► db/client.ts
              │                    │
              ▼                    ▼
       lib/validation.ts ◄── lib/constants.ts

     app/page.tsx ──► components/* ──► hooks/* ──► lib/api-client.ts
                          │                              │
                          └──────► lib/validation.ts ◄──┘
```

Enforced via ESLint `no-restricted-imports`:

- `components/**` cannot import from `db/**` or `app/api/**`.
- `hooks/**` cannot import from `db/**` or `components/**`.
- `app/api/**` cannot import from `components/**` or `hooks/**`.

### Requirements to Structure Mapping

**UX-spec components → files:**

| UX component | File |
|---|---|
| `TaskInput` | `components/TaskInput.tsx` |
| `TaskItem` | `components/TaskItem.tsx` |
| `TaskList` (container; added in architecture) | `components/TaskList.tsx` |
| `UndoToast` | `components/UndoToast.tsx` |
| `EmptyState` | `components/EmptyState.tsx` |
| `ErrorIndicator` | `components/ErrorIndicator.tsx` |

**UX-spec user journeys → E2E tests:**

| Journey | Test |
|---|---|
| 1: First-time capture | `e2e/capture.spec.ts` (first-visit flow) |
| 2: Returning-user capture | `e2e/capture.spec.ts` (second-visit flow) |
| 3: Complete a task | `e2e/complete.spec.ts` |
| 4: Delete with undo | `e2e/delete-undo.spec.ts` |
| 5: Error recovery | `e2e/error-recovery.spec.ts` |

**PRD functional requirements → code locations:**

| Requirement | Location |
|---|---|
| Create a task (CRUD) | `db/queries.ts::createTodo` → `app/api/todos/route.ts` POST → `hooks/use-create-todo.ts` → `components/TaskInput.tsx` |
| List tasks | `db/queries.ts::getTodos` → `app/page.tsx` (server fetch) + `app/api/todos/route.ts` GET → `hooks/use-todos.ts` → `components/TaskList.tsx` |
| Mark complete/uncomplete | `db/queries.ts::updateTodo` → `app/api/todos/[id]/route.ts` PATCH → `hooks/use-toggle-todo.ts` → `components/TaskItem.tsx` |
| Delete a task | `db/queries.ts::deleteTodo` → `app/api/todos/[id]/route.ts` DELETE → `hooks/use-delete-todo.ts` → `components/TaskItem.tsx` + `components/UndoToast.tsx` |
| Data persistence | `db/schema.ts` + Neon Postgres |
| Responsive layout | `app/globals.css` + Tailwind utility classes across components |
| Accessibility (WCAG AA) | Radix primitives + application a11y in component files; verified in `e2e/a11y.spec.ts` |
| Design tokens (dark-mode-ready) | `app/globals.css` CSS variables + `tailwind.config.ts` consumers |

**Cross-cutting concerns → locations:**

| Concern | Location |
|---|---|
| Error contract `{ code, message }` | Defined in `lib/validation.ts`, enforced in every `app/api/**/route.ts` |
| Zod schemas shared client/server | `lib/validation.ts` (the only source) |
| Security headers | `next.config.ts` |
| Error reporting | `sentry.{client,server,edge}.config.ts` + automatic instrumentation |
| Optimistic-update logic | `hooks/use-create-todo.ts`, `use-toggle-todo.ts`, `use-delete-todo.ts` |
| Per-task `syncStatus` state | Embedded in the Query cache entry; rendered by `components/TaskItem.tsx` + `ErrorIndicator.tsx` |
| Design tokens | `app/globals.css` + `tailwind.config.ts` |

### Integration Points

**Internal communication:**

- **Server Component → Client Components:** `app/page.tsx` fetches initial todos via `db/queries.ts::getTodos` and passes them as a dehydrated Query state to `providers.tsx` via `HydrationBoundary`. Client components read from the hydrated cache with zero network round-trip.
- **Client Components → API:** via hooks only. `components/*` imports `hooks/*`; `hooks/*` imports `lib/api-client.ts`; `lib/api-client.ts` calls `fetch('/api/todos/...')`. No direct `fetch` in components.
- **API → DB:** `app/api/**/route.ts` imports from `db/queries.ts` only. No direct Drizzle client usage in handlers.
- **Components ↔ Components:** no direct cross-component communication in v1. Shared state is the Query cache. `UndoToast` is rendered at the page level (not nested inside `TaskItem`) and communicates via a small local reducer in `TodoListClient`.

**External integrations:**

- **Neon Postgres** — via `DATABASE_URL` env var and `pg` driver. The only external data store.
- **Sentry** — automatic instrumentation via `@sentry/nextjs`. Captures unhandled errors, traces, and releases. No application code directly interacts with the Sentry SDK except initialization files.
- **Vercel** — build + deploy only. No Vercel runtime APIs used in application code.
- **No third-party APIs** (no analytics SDK, no feature flag service, no auth provider, no email, no SMS). Added later alongside the features that need them.

**Data flow:**

1. **Page load (initial render):**
   - Browser requests `/`. Vercel runs `app/layout.tsx` + `app/page.tsx` on the server.
   - `page.tsx` calls `getTodos(null)` from `db/queries.ts`, which runs a SQL query through the pooled Neon connection.
   - `page.tsx` pre-populates a `QueryClient` and wraps the `TodoListClient` in `HydrationBoundary`.
   - HTML is streamed to the browser. React hydrates, `TodoListClient` mounts with its cache already populated.

2. **User captures a task:**
   - User types + presses Enter in `TaskInput`.
   - `onSubmit` calls `useCreateTodo().mutate({ id: crypto.randomUUID(), description })`.
   - `onMutate` optimistically prepends the todo to the `['todos']` cache with `syncStatus: 'pending'`.
   - `TaskInput` clears and stays focused.
   - `lib/api-client.ts` POSTs to `/api/todos`. The Route Handler validates, calls `db/queries.ts::createTodo`, returns the created todo.
   - `onSuccess` updates the cache entry's `syncStatus` to `'idle'` (and reconciles any server-normalized fields).
   - If the POST fails, `onError` sets `syncStatus: 'failed'` on the cached entry. The cache mutation rerenders the row with `ErrorIndicator` visible.

3. **User retries a failed task:**
   - User taps `ErrorIndicator`. The component calls `useCreateTodo().mutate(...)` again with the same UUID.
   - The server's idempotent POST recognizes the existing UUID and returns the existing record with `200` (not `409`).
   - `onSuccess` clears the `syncStatus: 'failed'` flag.

4. **User deletes a task:**
   - User swipes-left (mobile) or hovers + clicks trash (desktop). `useDeleteTodo().mutate(id)` is called.
   - `onMutate` removes the todo from cache and triggers `UndoToast` via a local reducer.
   - The DELETE request is **not fired immediately**. Instead, it's scheduled via a setTimeout of 5 seconds.
   - If the user taps Undo, the scheduled DELETE is cancelled and the cache is restored.
   - Otherwise, the DELETE fires. On failure, the todo is re-added to the cache with `syncStatus: 'failed'`.

### File Organization Patterns

**Configuration files:** all at repo root. One config per tool. No config nesting, no `config/` directory.

**Source organization:**

- Top-level folders are role-based: `app/` (routes + handlers), `components/` (React UI), `hooks/` (client data hooks), `lib/` (isomorphic utilities), `db/` (server-only data access), `e2e/` (Playwright).
- One component/hook/module per file.
- Imports use the `@/*` path alias (resolves to project root) for all internal imports. No relative imports that cross more than one directory (`../*` is acceptable; `../../*` is a smell that suggests the alias should be used instead).

**Test organization:**

- **Unit + integration** (`*.test.ts(x)`) co-located with source. Vitest globs `**/*.test.{ts,tsx}`.
- **E2E** (`*.spec.ts`) in `e2e/`. Playwright globs `e2e/**/*.spec.ts`.
- Test files are never exported; test-only helpers live in `*.test.ts` or in a colocated `__test-helpers__.ts` if shared (naming starts with underscore to signal non-production).

**Asset organization:**

- `public/` for runtime-served static files (favicon, robots.txt).
- No image assets in v1. If added, SVG preferred; raster images go in `public/images/` with descriptive filenames.
- Fonts via `next/font` (`google` or `local`) — never placed in `public/`.

### Development Workflow Integration

**Development server:**

- `pnpm dev` → `next dev` with Turbopack. Sub-second hot reload on typical edits.
- `DATABASE_URL` in `.env.local` points to a dev Neon branch (one per developer).
- Sentry is disabled in dev unless explicitly enabled via env var (`NEXT_PUBLIC_SENTRY_ENABLED=true`).

**Build process:**

- `pnpm build` → `drizzle-kit migrate && next build`. Migrations run first so the new code never deploys against an outdated schema.
- Vercel executes this via its standard `build` command hook.
- Fails loudly on TypeScript errors, ESLint errors, or migration failures.

**Deployment:**

- `main` branch pushes → Vercel production build → `bmad-todo-app.vercel.app` (or custom domain).
- PR pushes → Vercel preview build → isolated URL with isolated Neon DB branch.
- No manual deploy steps. No staging environment in v1 (preview deployments serve that purpose).

**CI (GitHub Actions, `.github/workflows/ci.yml`):**

1. Install dependencies.
2. `pnpm lint` (ESLint + Prettier check).
3. `pnpm typecheck` (`tsc --noEmit`).
4. `pnpm test` (Vitest, unit + integration).
5. `pnpm test:e2e` (Playwright against the Vercel preview URL; requires GitHub Actions to wait for the Vercel preview deployment to be ready).

All five must pass before a PR can merge. No skipping, no force-merging.

## Architecture Validation Results

### Coherence Validation ✅

**Decision compatibility:**

- **Stack harmony:** React 19 + Next.js 16 App Router + Tailwind + shadcn/ui + Radix + Lucide + react-swipeable is a mainstream, battle-tested combination in 2026. No version or API conflicts.
- **Server stack:** Drizzle ORM + `pg` driver + Neon Postgres works cleanly on the Node.js runtime. No Edge-runtime mismatch because the UX spec doesn't require Edge execution.
- **Client stack:** TanStack Query v5 + Next.js App Router integrates via `HydrationBoundary`, enabling server-rendered initial cache state. No conflicts with Server Components.
- **Testing stack:** Vitest handles unit/integration (including Route Handlers via the Web Fetch API they expose). Playwright handles E2E against the Vercel preview URL. `@axe-core/playwright` integrates at the E2E layer for a11y assertions.
- **No contradictions:** every architectural decision reinforces the others. Client-generated UUIDs → idempotent POST → retry-safe mutations. Nullable `user_id` → API parameterization → forward-compatible without refactor. CSS variables at `:root` → Tailwind token mapping → dark-mode-ready.

**Pattern consistency:**

- Naming conventions (snake_case DB, camelCase JSON, PascalCase components, kebab-case non-component files) are internally consistent and aligned with each layer's ecosystem defaults.
- The error contract `{ code, message }` is defined once in `lib/validation.ts` and referenced from every Route Handler, client mutation hook, and component that renders failures.
- The optimistic-update pattern is specified identically across all three mutation hooks (`onMutate` → snapshot + apply; `onError` → restore + mark failed; `onSuccess` → reconcile).
- Import graph rules (`components/**` cannot import `db/**`, etc.) are expressible as ESLint rules and match the physical directory layout.

**Structure alignment:**

- Project tree maps 1:1 to the UX spec's component inventory. No orphaned directories, no missing files.
- Each PRD functional requirement has an explicit path through DB → API → hook → component, documented in the Requirements-to-Structure mapping.
- Import graph (`app/api → db/queries → db/client`; `components → hooks → lib/api-client`) is unidirectional and enforceable.

### Requirements Coverage Validation ✅

**PRD functional requirements — coverage:**

| PRD requirement | Architectural support |
|---|---|
| Create a task | `db/queries.ts::createTodo` + `app/api/todos/route.ts` POST + `hooks/use-create-todo.ts` + `components/TaskInput.tsx` |
| View a list of tasks | `db/queries.ts::getTodos` + server-side fetch in `app/page.tsx` + `hooks/use-todos.ts` + `components/TaskList.tsx` |
| Mark task complete | `db/queries.ts::updateTodo` + PATCH handler + `hooks/use-toggle-todo.ts` + `components/TaskItem.tsx` |
| Delete a task | `db/queries.ts::deleteTodo` + DELETE handler + `hooks/use-delete-todo.ts` + `components/UndoToast.tsx` |
| Data persistence across sessions | Neon Postgres (durable) + Drizzle; no localStorage dependence |
| Task has description + completion state + creation time | `db/schema.ts` columns: `description`, `completed`, `created_at` |
| No auth/multi-user in v1 but extensible | Nullable `user_id` column + parameterized queries |
| Instantaneous UI | Optimistic updates via TanStack Query |
| Responsive desktop/mobile | Tailwind responsive utilities + mobile-first breakpoints |
| Empty/loading/error states | `EmptyState` component; loading invisible by design; `ErrorIndicator` inline |
| Basic client + server error handling | Route Handler try/catch with typed error responses + per-task `syncStatus` on the client |
| Simple, deployable, maintainable | Single Next.js codebase, one-command Vercel deploy |

**PRD explicitly excluded in v1 — respected:**

- No user accounts / auth — no NextAuth; nullable `user_id` is the only trace, and it's cheap.
- No collaboration / multi-user — schema scoped by nullable `user_id`; no sharing, no live updates.
- No priority, deadlines, notifications — not in the schema, not in the API, not in the UI.

**UX specification — coverage:**

| UX requirement | Architectural support |
|---|---|
| Mobile-first, ≥320px, bottom-anchored input with safe-area | `TaskInput` component spec + Tailwind utilities + `viewport-fit=cover` meta tag documented |
| Thumb-zone ergonomics, 44×44px touch targets | Documented in `TaskInput`, `TaskItem`, `ErrorIndicator` specs |
| Swipe gestures on mobile | `react-swipeable` dependency + `TaskItem` swipe wrapper |
| Hover-reveal delete on desktop | Tailwind `hover:` utilities + `@media (hover: hover)` guard |
| Optimistic updates end-to-end | TanStack Query mutations with `onMutate`/`onError` pattern |
| 280-char soft limit, silently enforced | Three-layer enforcement: Zod `.max(280)`, DB `VARCHAR(280)`, UI input maxlength |
| Empty state: single muted helper text, no illustration | `EmptyState` component spec |
| UndoToast: 5s window, auto-dismiss | `UndoToast` component + `UNDO_TIMEOUT_MS` constant + deferred DELETE pattern in `use-delete-todo` |
| ErrorIndicator: muted amber, retry | `ErrorIndicator` component + `use-create-todo` failure state |
| No modals, confirmations, banners, red alerts | No `Dialog`/`AlertDialog` primitives imported; `no-restricted-imports` can enforce |
| Calm motion, 200–300ms transitions | Tailwind `duration-200`/`duration-300` utilities + documented motion tokens |
| `prefers-reduced-motion` support | Via Tailwind's `motion-reduce:` modifier and `@media (prefers-reduced-motion)` |
| WCAG 2.1 Level AA | Radix primitives + `@axe-core/playwright` in `e2e/a11y.spec.ts` + `eslint-plugin-jsx-a11y` |
| Keyboard operability | Radix focus management + explicit keyboard tests in `e2e/a11y.spec.ts` |
| Inter font, self-hosted / privacy-respecting | `next/font/google` with local rendering (subset, no external request at runtime) |
| Lucide icons | `lucide-react` dependency |
| Design tokens as CSS variables, dark-mode-ready | `app/globals.css` `:root` CSS variables + Tailwind theme mapping |
| Browser matrix (evergreen, last 2 versions) | Playwright runs against Chromium, Firefox, WebKit; Vercel edge handles feature detection |

**Non-functional requirements — coverage:**

- **Performance:** Turbopack dev, Next.js 16 SSR + static generation where possible, Neon pooled connection, optimistic UI eliminates perceived latency. No measurable performance risk at v1 scale.
- **Reliability:** durable Postgres storage, automatic Vercel redeploys on failure, Sentry captures unhandled errors. Data survives refreshes, sessions, and deploys.
- **Security:** CSP + HSTS + SameSite cookie defaults (when cookies exist) + Zod validation at every HTTP boundary + parameterized Drizzle queries. OWASP top-10 coverage for the v1 surface.
- **Accessibility (WCAG 2.1 AA):** enforced at three layers — component contracts (explicit `aria-*` and keyboard behavior), automated testing (axe-core in CI, `eslint-plugin-jsx-a11y` at lint time), and pre-release manual verification (keyboard-only walkthrough + VoiceOver/NVDA spot checks).
- **Responsiveness:** mobile-first Tailwind utilities, breakpoints at `md` (768px) and `lg` (1024px), no horizontal scroll at 320px or at 200% zoom.
- **Extensibility:** nullable `user_id` + API parameterization leave the auth door open; CSS-variable-based tokens leave dark mode trivial to add; REST + OpenAPI-ready schemas leave mobile/third-party integration open.

### Implementation Readiness Validation ✅

**Decision completeness:**

- Every critical decision is documented with its chosen technology, version/ecosystem-default, rationale, and cross-cutting implications.
- Deferred decisions (auth, offline, rate limiting) are explicitly listed with the rationale for deferral and the forward-compat hooks already in place.

**Structure completeness:**

- Complete project tree is specified, down to individual filenames and responsibilities.
- Every UX component, user journey, and PRD requirement has a named destination file.
- Unidirectional import graph is documented and ESLint-enforceable.

**Pattern completeness:**

- Naming conventions cover database, API, code, and files. No layer is under-specified.
- Error contract is canonical and unambiguous.
- Optimistic-update protocol is documented with concrete code examples at `onMutate`, `onError`, and `onSuccess`.
- Anti-patterns section calls out the five most likely mistakes an AI agent could make.

### Gap Analysis Results

**Critical gaps:** none.

**Important gaps:** none. All critical decisions are made and documented.

**Minor flags (not blocking — documented as known limitations):**

1. **Delete-during-tab-close edge case.** The delete-with-undo pattern defers the actual DELETE request by 5 seconds client-side. If the user closes the tab within that window, the server never receives the DELETE and the todo remains in the database — the user sees it again on next open. This is acceptable behavior (non-destructive failure mode is safer than aggressive immediate deletion), but worth documenting. Mitigation option, if desired later: fire the DELETE immediately and implement server-side undo with a short TTL, at the cost of complexity. Not recommended for v1.

2. **No CSRF protection in v1.** Because v1 has no cookies and no auth, CSRF is moot. **When authentication is added** (deferred), the session cookie must be SameSite=Lax (or Strict) and the Route Handlers should check the `Origin` header. Documented here so it's not forgotten.

3. **Single Neon region.** The architecture doesn't specify a Neon region explicitly; Vercel defaults to `iad1` (US East). For users in other geographies, latency on the initial server-render could be noticeable. Not a v1 issue for a single-user app, but worth reviewing if the product is ever opened to public use in non-US markets.

**Nice-to-have enhancements (deferred, not critical):**

- **OpenAPI spec auto-generated** from Zod schemas — not needed in v1, will become valuable when auth + third-party integration land.
- **Request tracing** (distributed tracing across client → server → DB) via Sentry performance or OpenTelemetry — out of scope for single-user v1, but the Sentry baseline is already in place to enable it later.
- **Preview-deployment smoke tests** beyond Playwright — e.g., Lighthouse CI for performance regression. Can be added incrementally.

### Validation Issues Addressed

No issues required resolution in this pass. The three items in "Minor flags" above are intentional trade-offs documented for future reference, not gaps.

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (PRD + UX spec, step 2)
- [x] Scale and complexity assessed (low complexity, single-user)
- [x] Technical constraints identified (UX stack dictates React + shadcn + Tailwind)
- [x] Cross-cutting concerns mapped (optimistic updates, error model, design tokens, a11y, forward-compat)

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions (Next.js 16, shadcn latest, Drizzle, Neon, TanStack Query v5)
- [x] Technology stack fully specified
- [x] Integration patterns defined (REST Route Handlers, TanStack Query, Server Component hydration)
- [x] Performance considerations addressed (optimistic UI, Turbopack, pooled connections)

**✅ Implementation Patterns**
- [x] Naming conventions established (DB, API, code, files)
- [x] Structure patterns defined (role-based folders, unidirectional imports)
- [x] Communication patterns specified (TanStack Query cache + per-task syncStatus)
- [x] Process patterns documented (error handling, loading, retry, validation)
- [x] Anti-patterns explicitly listed

**✅ Project Structure**
- [x] Complete directory structure defined (every file and directory named)
- [x] Component boundaries established (API/data/component/hook/shared layers)
- [x] Integration points mapped (internal and external)
- [x] Requirements to structure mapping complete (PRD FRs + UX components + user journeys)

### Architecture Readiness Assessment

**Overall Status:** **READY FOR IMPLEMENTATION**

**Confidence Level:** **High.**

- The product surface is small and well-bounded.
- The UX spec is unusually prescriptive, leaving the architecture's creative space narrow — which is exactly where architectural discipline shines.
- Every decision has a documented rationale and every forward-compat hedge has a documented cost.

**Key strengths:**

- **Minimalism.** The architecture has the smallest moving-part count that satisfies every PRD and UX requirement. No speculative service boundaries, no premature microservices, no over-engineered abstractions.
- **Optimistic-update discipline.** The cross-cutting optimistic pattern is specified end-to-end (UUID generation → idempotent POST → per-task syncStatus → inline error → user-initiated retry). This is the single most load-bearing architectural decision and it's complete.
- **Forward-compatibility without cost.** Nullable `user_id`, CSS-variable design tokens, and REST API (vs. Server Actions) each leave a deferred capability trivially addable without rework.
- **AI-agent-friendly consistency.** Naming, structure, error contract, and anti-patterns are explicit enough that an AI agent can write new code without needing human judgment calls on style.
- **One-command deploy.** No infrastructure orchestration, no manual pipelines. `git push` is the deploy action.

**Areas for future enhancement:**

- Formal authentication layer (NextAuth or equivalent) with session cookies, CSRF protection, and a `users` table — deferred.
- Offline / PWA support with service worker + IndexedDB cache for queued mutations — deferred.
- Dark theme color values and a user-facing theme toggle — architecture ready, values deferred.
- Rate limiting / abuse protection via edge middleware — deferred until needed.
- Observability beyond Sentry errors (performance traces, user-journey analytics) — deferred.
- Distributed testing across multiple Neon regions if the product is internationalized — deferred.

### Implementation Handoff

**AI Agent Guidelines:**

- Follow the architectural decisions in this document exactly. If a decision isn't documented, match the nearest existing convention and raise a question rather than improvising.
- Use the naming patterns in "Implementation Patterns & Consistency Rules" verbatim.
- Never cross the import-graph boundaries (`components` ↛ `db`; `hooks` ↛ `components`; `app/api` ↛ `components`/`hooks`). ESLint will enforce most of these; the rest require discipline.
- Implement the optimistic-update pattern per the code examples in step 5. Do not deviate from `onMutate` → `onError` → `onSuccess` semantics.
- All mutation hooks use `retry: false`. Retries are user-initiated.
- All Route Handlers use the `{ code, message }` error contract. No envelope wrapping on success responses.
- Every new dependency added requires updating this document in the same PR.

**First Implementation Priority:**

```bash
# 1. Scaffold the project
pnpm create next-app@latest bmad-todo-app --yes

# 2. Initialize shadcn/ui
cd bmad-todo-app
pnpm dlx shadcn@latest init -d

# 3. Add the shadcn components used by v1
pnpm dlx shadcn@latest add button input textarea toast

# 4. Install Drizzle, icons, and swipe gesture library
pnpm add drizzle-orm pg lucide-react react-swipeable
pnpm add -D drizzle-kit @types/pg

# 5. Install TanStack Query, Zod, Sentry, Vitest, Playwright
pnpm add @tanstack/react-query @tanstack/react-query-devtools zod @sentry/nextjs drizzle-zod
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test @axe-core/playwright
```

Commit the scaffold as the first implementation story. All subsequent work branches from there in the order documented in "Decision Impact Analysis → Implementation sequence."
