# Story 1.2: Provision Postgres database with `todos` schema and migrations pipeline

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a Neon Postgres database provisioned with the `todos` table schema and a working migrations pipeline,
so that the application has durable storage with auth-forward-compat baked in.

## Acceptance Criteria

1. **Neon Postgres provisioned via Vercel-Neon Marketplace integration:** A production Neon project exists, with `DATABASE_URL` auto-populated as a Vercel environment variable across production and preview environments. Preview deployments use Neon branches (one per PR), torn down on PR close.

2. **`db/schema.ts` defines the `todos` table** matching the architecture's data model exactly:
   - `id uuid PRIMARY KEY` (no default — client-generated UUIDs)
   - `description varchar(280) NOT NULL`
   - `completed boolean NOT NULL DEFAULT false`
   - `created_at timestamptz NOT NULL DEFAULT now()`
   - `user_id uuid` (nullable, no default; populated when auth is added in a future epic)

3. **Migrations pipeline works locally and on Vercel:** `drizzle-kit generate` produces `db/migrations/0000_initial.sql`. `drizzle-kit migrate` applies it cleanly against a local dev DB and against an empty Neon production DB.

4. **`build` script runs migrations before Next.js build:** `package.json`'s `build` script is updated to `drizzle-kit migrate && next build`. Vercel runs both successfully on a fresh deploy. A migration failure aborts the build before serving traffic.

5. **Environment configuration:** `.env.example` is committed with placeholders for `DATABASE_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`. `.env.local` is gitignored (already established by Story 1.1). `DATABASE_URL` is set in Vercel for production and preview environments via the Neon integration.

6. **`db/client.ts` is server-only:** The file begins with `import 'server-only'` so importing it from a client component is a build-time error. It exports a configured Drizzle client backed by the `pg` driver, parameterized by `DATABASE_URL`.

7. **`db/queries.ts` exposes typed query helpers:**
   - `getTodos(userId: string | null): Promise<Todo[]>` — returns rows ordered by `created_at DESC`
   - `createTodo(input: TodoCreateInput, userId: string | null): Promise<Todo>` — inserts and returns the created row
   - Both accept `userId` defaulting to `null` in v1 (forward-compat for auth)
   - All queries use parameterized Drizzle expressions; **no raw SQL strings anywhere**

8. **Vitest infrastructure + `db/queries.test.ts`:** `vitest.config.ts` is in place. Integration tests verify `createTodo` inserts a row and `getTodos` returns it newest-first against an ephemeral test DB (each test gets a clean `todos` table). `pnpm test` runs the suite green.

## Tasks / Subtasks

- [x] **Task 1: Provision Neon via Vercel-Neon Marketplace (AC: #1, #5)** — completed by user
  - [x] Vercel-Neon Marketplace integration installed for `bmad-todo-app` with Custom Prefix `DATABASE` (so the env var lands as `DATABASE_URL`, not `STORAGE_URL`)
  - [x] `DATABASE_URL` (and the full sibling family — `DATABASE_URL_UNPOOLED`, `DATABASE_PG*`, `DATABASE_POSTGRES_*`) set in Vercel for Production, Preview, and Development scopes
  - [x] Branch-per-PR is enabled (Preview-environment branching ticked during integration install)
  - [x] `.env.local` populated locally (gitignored). `DATABASE_URL` reachable from the working tree
  - [x] Production-scope branch creation **not** enabled (correct — production hits the main DB branch always)

- [x] **Task 2: Install Drizzle + pg driver (AC: #2, #3, #6, #7)**
  - [x] `pnpm add drizzle-orm@0.45.2 pg@8.20.0`
  - [x] `pnpm add -D drizzle-kit@0.31.10 @types/pg@8.20.0 drizzle-zod@0.8.3 vitest@4.1.5 @vitest/coverage-v8@4.1.5 dotenv@17.4.2` (combined Vitest install for Task 9)
  - [x] Versions pinned via `pnpm-lock.yaml`. `pg-native` not installed (pure-JS path).  `zod@4.3.6` arrived transitively via `drizzle-zod` peer dep — Story 1.3 will promote it to a direct dep
  - [x] `drizzle.config.ts` written at repo root with `schema`, `out`, `dialect: 'postgresql'`, `dbCredentials: { url }`, `strict: true`, `verbose: true`. **Reads `DATABASE_URL_UNPOOLED` first, falls back to `DATABASE_URL`** (Neon best practice — the unpooled endpoint avoids pgbouncer-transaction-mode complications during migration DDL)

- [x] **Task 3: Write `db/schema.ts` (AC: #2)**
  - [x] `db/schema.ts` written exactly matching the architecture's data model — 5 columns, snake_case names, types and constraints as specified
  - [x] Inferred row types exported: `Todo` (= `typeof todos.$inferSelect`) and `TodoInsert` (= `typeof todos.$inferInsert`)
  - [x] Drizzle handles the snake_case ↔ camelCase property mapping automatically

- [x] **Task 4: Generate and apply the initial migration (AC: #3)**
  - [x] `pnpm db:generate` produced `db/migrations/0000_outgoing_silhouette.sql` (drizzle-kit auto-generates the suffix; the `0000_` prefix is the ordering anchor — substantively equivalent to the spec's `0000_initial.sql`). `meta/_journal.json` + snapshot also generated
  - [x] Generated SQL verified: `CREATE TABLE "todos"` with `uuid PRIMARY KEY NOT NULL`, `varchar(280) NOT NULL`, `boolean DEFAULT false NOT NULL`, `timestamp with time zone DEFAULT now() NOT NULL`, nullable `uuid` for `user_id`. All five columns present with correct types and constraints
  - [x] `pnpm db:migrate` applied against the Neon dev branch successfully (`migrations applied successfully!`)
  - [x] `db:generate` and `db:migrate` scripts added to `package.json`

- [x] **Task 5: Update build pipeline to run migrations (AC: #4)**
  - [x] `package.json` `build` script updated to `drizzle-kit migrate && next build`
  - [x] `pnpm build` runs cleanly locally: migration applies (idempotent), then `next build` produces 4 prerendered routes in 6.5s
  - [ ] **Vercel preview verification deferred to PR** — once this branch is pushed, Vercel will run the new build pipeline against an ephemeral Neon preview branch. Confirm both phases succeed in the build logs before merging
  - [x] `drizzle-kit` is in `devDependencies`; Vercel's default build does install dev deps, so this is fine. If Vercel's build logs show `drizzle-kit: command not found`, promote it to `dependencies`

- [x] **Task 6: Verify `.env.example` and `.env.local` (AC: #5)**
  - [x] `.env.example` from Story 1.1 verified intact with `DATABASE_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`. No edits required
  - [x] `.env.local` confirmed gitignored (`.env*` + `!.env.example` exception still in place)
  - [x] `DATABASE_URL` confirmed in Vercel via Task 1 (Production + Preview + Development scopes)

- [x] **Task 7: Write `db/client.ts` with `server-only` enforcement (AC: #6)**
  - [x] `db/client.ts` written with `import "server-only";` as the literal first line
  - [x] `pg.Pool` over `process.env.DATABASE_URL`, wrapped by `drizzle(pool, { schema })`. Throws on missing env var
  - [x] Pooled endpoint used at runtime (matches Vercel-Neon integration default). `drizzle-orm/neon-http` is NOT used — `node-postgres` driver per architecture
  - [x] `@types/pg` installed (Task 2)

- [x] **Task 8: Write `db/queries.ts` with `getTodos` and `createTodo` (AC: #7)**
  - [x] `db/queries.ts` exports `getTodos(userId)` and `createTodo(input, userId)`. Both fully parameterized via `eq`, `isNull`, `desc` Drizzle helpers
  - [x] No raw SQL templates in application code
  - [x] Local `TodoCreateInput = Pick<TodoInsert, "id" | "description">` will be replaced by Story 1.3's Zod-inferred type
  - [x] No idempotency handling on duplicate UUID — Story 1.3's POST handler owns that

- [x] **Task 9: Set up Vitest (AC: #8)**
  - [x] Vitest deps installed in Task 2 (combined install)
  - [x] `vitest.config.ts` written at repo root:
    ```ts
    import { defineConfig } from 'vitest/config';
    import { config } from 'dotenv';

    config({ path: '.env.test' });
    config({ path: '.env.local' });

    export default defineConfig({
      test: {
        environment: 'node',
        include: ['**/*.test.{ts,tsx}'],
        exclude: ['node_modules/**', '.next/**', 'e2e/**'],
        globals: false,
      },
    });
    ```
  - [x] No `tsconfig.json` change needed (`globals: false` keeps imports explicit)
  - [x] `test` and `test:watch` scripts added to `package.json`. `test:tokens` retained — migration to Vitest deferred (small win, kept out of scope here)
  - [x] **Test-DB strategy = Option A (Neon dev branch).** Documented in `AGENTS.md` "Database" section. CI strategy (Story 4.3) deferred
  - [x] **Extra:** added `test/stubs/server-only.ts` + a `resolve.alias` entry in `vitest.config.ts` to stub the `server-only` package during Vitest runs. `server-only` errors at bundle time in Next.js production but is harmless in Node — the stub keeps the import resolvable in case a future bundler-condition change makes it stricter

- [x] **Task 10: Write `db/queries.test.ts` (AC: #8)**
  - [x] Two integration tests: (1) `createTodo inserts a row that getTodos returns` (asserts id/description/completed/userId/createdAt-recency); (2) `getTodos returns rows newest-first` (3 inserts with 10ms delay, asserts reverse order)
  - [x] `beforeEach` TRUNCATEs `todos`; `afterAll` ends the underlying `pg.Pool` via `db.$client.end()` so Vitest exits cleanly
    ```ts
    import { afterAll, beforeEach, describe, expect, it } from 'vitest';
    import { sql } from 'drizzle-orm';
    import { db } from './client';
    import { createTodo, getTodos } from './queries';

    beforeEach(async () => {
      await db.execute(sql`TRUNCATE TABLE todos`);
    });

    afterAll(async () => {
      // pool teardown if needed — see Drizzle docs
    });
    ```
  - [x] `pnpm test` runs both tests green: `Test Files  1 passed (1)`, `Tests  2 passed (2)` in 3.01s

- [x] **Task 11: Update `AGENTS.md` with DB conventions**
  - [x] Added a "Database" section documenting schema-as-source-of-truth, parameterized queries, `server-only` boundary, test-DB strategy (Option A — Neon dev branch), and the `pg` driver mandate
  - [x] Added a "Migrations" section documenting `pnpm db:generate` / `pnpm db:migrate` / build-pipeline integration / `DATABASE_URL_UNPOOLED` precedence

## Dev Notes

### Architectural anchors (do not deviate)

- **Database:** PostgreSQL via **Neon serverless**, provisioned **only** via the Vercel-Neon Marketplace integration. No raw `neon-cli`, no Render, no Supabase. The integration handles per-PR branch provisioning automatically.
- **ORM:** **Drizzle** with the **`pg` (node-postgres) driver**, not `drizzle-orm/neon-http`. The HTTP driver is suitable for Edge runtime; the architecture targets the Node runtime for Route Handlers, so `pg` is the right choice.
- **Schema source of truth:** `db/schema.ts`. Every column type, constraint, and default goes there. **Migrations are generated, never hand-written.** A drift between `schema.ts` and the produced SQL is a bug — regenerate, don't patch.
- **Migration timing:** migrations run **before** `next build` on every deploy. Vercel runs the unified `build` script. A failed migration aborts the deploy before any new code serves traffic. This is why the script is `drizzle-kit migrate && next build`, not the reverse.
- **`server-only` boundary:** `db/client.ts` MUST start with `import 'server-only';` (literally the first line). Next.js's `server-only` package errors at build time if a module that imports it is reachable from a client bundle. This is the architectural defense against accidentally bundling `pg` to the browser.
- **No connection layer in tests:** tests import `db` from `db/client.ts` and run real queries. There is no mocking layer. The architecture is explicit: integration tests are the contract; unit-mocking the DB layer hides bugs that only surface against a real Postgres.
- **`userId` parameter:** every query helper accepts `userId: string | null` even though v1 always passes `null`. This is a forward-compat hedge: when auth lands, the call sites change but the query helpers do not. Removing this parameter to "simplify" v1 is a footgun.

### Naming and structure (from architecture.md)

- **Tables:** `snake_case`, plural — `todos`. Never `todo` or `Todo`.
- **Columns:** `snake_case`, singular — `description`, `completed`, `created_at`, `user_id`.
- **Primary keys:** always named `id`, always `uuid`.
- **Timestamps:** `TIMESTAMPTZ`, not `TIMESTAMP`. UTC at the application layer; the DB stores with offset.
- **Drizzle JS property names:** camelCase (`createdAt`, `userId`). Drizzle handles the snake_case ↔ camelCase mapping; do not write a manual translation layer.
- **No raw SQL strings** in application code. The only place a `sql\`...\`` template is acceptable is in tests (e.g., `TRUNCATE TABLE todos`) where Drizzle's expression API has no helper.

### File contract (target end-state for this story)

```
db/
├── client.ts          # NEW — server-only Drizzle client over pg.Pool
├── schema.ts          # NEW — todos table definition + inferred types
├── queries.ts         # NEW — getTodos, createTodo (parameterized)
├── queries.test.ts    # NEW — Vitest integration tests
└── migrations/
    ├── 0000_initial.sql   # NEW — drizzle-kit generated, do not hand-edit
    └── meta/
        └── _journal.json  # NEW — drizzle-kit metadata
drizzle.config.ts      # NEW — schema/out/dialect config
vitest.config.ts       # NEW — node env + glob include
```

`package.json` changes:
- New deps: `drizzle-orm`, `pg`
- New devDeps: `drizzle-kit`, `@types/pg`, `drizzle-zod`, `vitest`, `@vitest/coverage-v8`, optionally `dotenv`
- Updated `build` script: `drizzle-kit migrate && next build`
- New scripts: `db:generate`, `db:migrate`, `test`, `test:watch`

### Previous-story intelligence (Story 1.1 learnings)

1. **Tailwind 4 / shadcn-on-base-ui** deviations from Story 1.1 are **not relevant** to this story (DB-only). Don't touch `globals.css`, `tailwind.config.ts` (it doesn't exist), or any UI files.
2. **`pnpm-workspace.yaml`** exists with `ignoredBuiltDependencies: [sharp, unrs-resolver]`. The pure-JS `pg` package does not need to be added to that list. **Do not install `pg-native`** — it requires libpq build steps and would extend the ignored-builds list.
3. **`.env.example` already exists** from Story 1.1 with the three required keys. Verify it's intact; do not duplicate.
4. **`.gitignore`** has `.env*` with a `!.env.example` exception. Do not regress that pattern.
5. **ESLint flat-config** in `eslint.config.mjs` enforces directory-scoped import-graph rules. `db/**` is not yet a source-of-restriction (only `components/**`, `hooks/**`, `app/api/**` are scoped). Story 1.2 should consider whether to add a `db/**` scope that forbids importing from `components/**`, `hooks/**`, `app/api/**` (since `db/` should be independent of those layers). Recommended: add it for symmetry with the architecture's unidirectional-import diagram.
6. **Node v25 locally** is fine for build/lint/typecheck on Story 1.1; `.nvmrc` pins Vercel to Node 22. The `pg` driver supports both.
7. **pnpm 10.33.2** is installed globally on the dev machine.
8. **Story 1.1 had a token-smoke test** at `scripts/check-tokens.mjs` invoked via `pnpm test:tokens`. With Vitest landing in this story, the recommendation is to migrate that check into a Vitest test file (e.g., `scripts/check-tokens.test.ts` or `app/globals.css.test.ts`) so there's one test runner. The migration is small; defer if it expands scope.

### Test-DB strategy decision

The story spec leaves the choice of test-DB strategy open (Option A: personal Neon dev branch, Option B: local Docker Postgres). **Recommend Option A** for Story 1.2:

- Zero local infrastructure to maintain (no Docker daemon dependency).
- Real Neon Postgres semantics — same connection pooler, same SSL, same SQL flavor as production.
- Free; Neon branches don't cost anything in the free tier.
- The downside (network dependency for tests) is acceptable for an integration-test layer that runs occasionally during dev.

Document the chosen strategy in `AGENTS.md` so Story 1.3+ test authors know what to reproduce.

### Out of scope for this story

- Zod schemas / `lib/validation.ts` — Story 1.3.
- Route Handlers (`app/api/todos/route.ts` GET + POST) — Story 1.3.
- `updateTodo` query — Story 2.1.
- `deleteTodo` query — Story 3.1.
- API client (`lib/api-client.ts`) — Story 1.4.
- Any UI work (TaskList, TaskItem, etc.) — Stories 1.4+.
- GitHub Actions CI workflow — Story 4.3 (this story leaves CI configuration to that story; local Vitest runs are sufficient evidence here).

### What to do if the Vercel-Neon integration is unavailable

If the user's Vercel free tier or region temporarily lacks the Neon Marketplace integration: fall back to creating a Neon project directly via [neon.tech](https://neon.tech), then manually adding `DATABASE_URL` to Vercel's environment variables (Production + Preview scopes). Per-PR branching can be re-enabled later via the integration. Document the fallback in Completion Notes if used.

### Project Structure Notes

- The `db/` directory is created fresh by this story; Story 1.1 did not pre-create it.
- `drizzle.config.ts` lives at the repo root alongside `next.config.ts`, `tsconfig.json`, etc. — consistent with the architecture's "all config files at repo root" rule.
- `vitest.config.ts` at the repo root is also consistent.
- No `__tests__/` directory; tests are co-located (`db/queries.test.ts` next to `db/queries.ts`).

### References

- Story acceptance criteria source: [_bmad-output/planning-artifacts/epics.md §"Story 1.2"](../planning-artifacts/epics.md#story-12-provision-postgres-database-with-todos-schema-and-migrations-pipeline)
- Data architecture (schema, decisions, migrations): [_bmad-output/planning-artifacts/architecture.md §"Data Architecture"](../planning-artifacts/architecture.md#data-architecture)
- DB naming patterns: [_bmad-output/planning-artifacts/architecture.md §"Naming Patterns"](../planning-artifacts/architecture.md#naming-patterns)
- Architectural boundaries (data boundary, server-only): [_bmad-output/planning-artifacts/architecture.md §"Architectural Boundaries"](../planning-artifacts/architecture.md#architectural-boundaries)
- Build process (drizzle-kit migrate before next build): [_bmad-output/planning-artifacts/architecture.md §"Development Workflow Integration"](../planning-artifacts/architecture.md#development-workflow-integration)
- Story 1.1 implementation record (deviations, file list): [1-1-scaffold-nextjs-shadcn-vercel.md](./1-1-scaffold-nextjs-shadcn-vercel.md)
- Story dependency graph (1.2 unblocks 1.3, 2.1, 3.1): [_bmad-output/planning-artifacts/story-dependency-graph.md](../planning-artifacts/story-dependency-graph.md)

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (Opus 4.7, 1M context)

### Debug Log References

- `pnpm db:generate`: produced `db/migrations/0000_outgoing_silhouette.sql` (1 table, 5 columns, 0 indexes, 0 fks)
- `pnpm db:migrate`: applied successfully against the Neon dev branch
- `pnpm test`: 2/2 tests passed in 3.01s
- `pnpm build`: `drizzle-kit migrate` (no-op, idempotent) → `next build` succeeded; 4 prerendered routes in 6.5s
- `pnpm typecheck`, `pnpm lint`, `pnpm test:tokens`: all green

### Completion Notes List

**Done — all tasks complete**
- All 11 tasks (Task 1 was completed by the user; Tasks 2–11 by the dev agent)
- All gates green: lint, typecheck, build (with migration step), Vitest (2 tests), token smoke test

**Deviations from the spec (recorded — not surprises)**

1. **Migration filename suffix differs from spec.** Spec said `0000_initial.sql`; drizzle-kit auto-generated `0000_outgoing_silhouette.sql`. The `0000_` ordering prefix is what matters and is correct. Renaming would fight the tool's defaults — keep as-is.
2. **`drizzle.config.ts` reads `DATABASE_URL_UNPOOLED` first, falls back to `DATABASE_URL`.** Spec said `DATABASE_URL` only. The Vercel-Neon Marketplace integration provides both vars; using the unpooled (direct) endpoint for migrations is Neon's documented best practice — the pooled (pgbouncer) endpoint can have transaction-mode quirks for DDL. Runtime `db/client.ts` still uses pooled `DATABASE_URL` per spec.
3. **`server-only` test stub.** `db/client.ts` imports `server-only`, which is a Next.js bundle-time guard. In Node-based Vitest it's currently harmless, but I added an explicit alias (`vitest.config.ts` → `test/stubs/server-only.ts`) to insulate tests against future Next.js condition changes. Defensive; zero runtime cost.
4. **`zod` arrived transitively** (peer dep of `drizzle-zod`, version `4.3.6`). Story 1.3 will promote it to a direct dependency.
5. **`drizzle-zod` installed but unused in this story.** Story 1.3 will derive Zod schemas via `drizzle-zod`. Installing it now means the package is ready when 1.3 starts.
6. **ESLint scope for `db/**` added** beyond the spec. The flat-config now blocks `db/**` from importing `components/**`, `hooks/**`, `app/api/**` — symmetry with the architecture's unidirectional import diagram. `db/**/*.test.{ts,tsx}` is exempt (tests can import production code).
7. **`scripts/check-tokens.mjs` migration to Vitest deferred.** Spec recommended consolidating into Vitest; doing so would expand scope without strong benefit. Kept the standalone script + `pnpm test:tokens`.

**Notes for the next story (1.3)**

- `lib/validation.ts` (Zod schemas) is greenfield. The local `TodoCreateInput = Pick<TodoInsert, "id" | "description">` in `db/queries.ts` is a temporary alias — Story 1.3 should replace it by importing the Zod-inferred type and update `db/queries.ts` accordingly.
- `zod` is installed transitively but should be promoted to a direct dependency in Story 1.3.
- `drizzle-zod` is installed and ready (uses Zod v4, matches the transitive zod version).
- The `pg.Pool` in `db/client.ts` will be reused across all routes; no per-route connection setup needed.

**Vercel verification still pending**

- The build pipeline (`drizzle-kit migrate && next build`) has been verified locally. Vercel will run the same pipeline against an ephemeral Neon preview branch when this story's PR is opened. **Watch the preview-deploy logs in the PR review** to confirm both phases succeed there before merging.

### File List

**New files:**
- `db/schema.ts`
- `db/client.ts`
- `db/queries.ts`
- `db/queries.test.ts`
- `db/migrations/0000_outgoing_silhouette.sql`
- `db/migrations/meta/_journal.json`
- `db/migrations/meta/0000_snapshot.json`
- `drizzle.config.ts`
- `vitest.config.ts`
- `test/stubs/server-only.ts`

**Modified files:**
- `package.json` (deps + scripts: `build`, `test`, `test:watch`, `db:generate`, `db:migrate`)
- `pnpm-lock.yaml` (resolutions for new deps)
- `eslint.config.mjs` (added `db/**` import-graph scope)
- `AGENTS.md` (added "Database" and "Migrations" sections)
- `README.md` (documented new scripts)

**Story spec / planning artifact (not part of the runtime app):**
- `_bmad-output/implementation-artifacts/1-2-postgres-schema-migrations-queries.md`

## Change Log

| Date       | Change                                              | Author |
| ---------- | --------------------------------------------------- | ------ |
| 2026-04-28 | Story spec created from epics.md §"Story 1.2" plus context from architecture.md §"Data Architecture", with Story 1.1 learnings propagated | bmad-create-story |
| 2026-04-28 | Implementation completed: `db/{schema,client,queries}.ts`, migration generated + applied, Vitest set up with 2 passing integration tests, build pipeline runs migrations | bmad-dev-story |
