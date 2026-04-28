# Story 1.2: Provision Postgres database with `todos` schema and migrations pipeline

Status: ready-for-dev

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

- [ ] **Task 1: Provision Neon via Vercel-Neon Marketplace (AC: #1, #5)** — **manual coordination**
  - [ ] In the Vercel dashboard for the `bmad-todo-app` project, open the **Storage** tab → **Create Database** → **Neon Postgres**. Accept the free-tier defaults; pick the same region as the Vercel project's compute region (default `iad1`/US East is fine)
  - [ ] Confirm Vercel auto-populates `DATABASE_URL` as a Vercel environment variable in **Production** and **Preview** scopes (the integration writes both automatically). Verify by checking **Project → Settings → Environment Variables**
  - [ ] In the Neon dashboard, confirm a **branch-per-PR** configuration: when a PR opens, the Vercel-Neon integration creates a database branch and updates the preview deployment's `DATABASE_URL` to point at it. When the PR closes, the branch is torn down. Default-on for the integration; verify it's not disabled
  - [ ] Pull the connection string for local development by running `vercel env pull .env.local` (after running `pnpm dlx vercel link` to associate the working tree with the project). This creates a gitignored `.env.local` with `DATABASE_URL` pointing at a personal Neon dev branch. **Alternative**: from the Neon dashboard, create a personal dev branch and copy its connection string into `.env.local` manually
  - [ ] **Coordination note:** the dev agent cannot do the Vercel/Neon dashboard steps autonomously — pause here and request the user perform them, then resume once `DATABASE_URL` is reachable from the working tree

- [ ] **Task 2: Install Drizzle + pg driver (AC: #2, #3, #6, #7)**
  - [ ] `pnpm add drizzle-orm pg` (production deps)
  - [ ] `pnpm add -D drizzle-kit @types/pg drizzle-zod` (dev deps; `drizzle-zod` keeps Story 1.3's Zod schemas in lockstep with the Drizzle types)
  - [ ] Confirm versions are pinned in `pnpm-lock.yaml`. Do **not** use `pg-native` — the pure-JS `pg` package avoids native build steps that would require updating `pnpm-workspace.yaml`'s `ignoredBuiltDependencies`
  - [ ] Add `drizzle.config.ts` at repo root with: `schema: './db/schema.ts'`, `out: './db/migrations'`, `dialect: 'postgresql'`, `dbCredentials: { url: process.env.DATABASE_URL! }`. The `verbose` and `strict` flags are recommended for a clearer migration diff

- [ ] **Task 3: Write `db/schema.ts` (AC: #2)**
  - [ ] Create `db/schema.ts` exactly matching the architecture's data model:
    ```ts
    import { pgTable, uuid, varchar, boolean, timestamp } from 'drizzle-orm/pg-core';

    export const todos = pgTable('todos', {
      id:          uuid('id').primaryKey(),
      description: varchar('description', { length: 280 }).notNull(),
      completed:   boolean('completed').notNull().default(false),
      createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      userId:      uuid('user_id'),
    });
    ```
  - [ ] Export inferred row types: `export type Todo = typeof todos.$inferSelect;` and `export type TodoInsert = typeof todos.$inferInsert;`. Story 1.3's Zod schemas will derive from these via `drizzle-zod`
  - [ ] Note: snake_case column names (`created_at`, `user_id`) are mandated by the architecture's DB naming conventions; Drizzle's mapping puts them on JS-friendly camelCase property names (`createdAt`, `userId`) automatically — **no manual mapping needed in API responses**

- [ ] **Task 4: Generate and apply the initial migration (AC: #3)**
  - [ ] Run `pnpm drizzle-kit generate` — produces `db/migrations/0000_initial.sql` plus a `meta/` snapshot directory
  - [ ] Inspect the generated SQL: confirm it creates `todos` with all five columns, the right types (`UUID`, `VARCHAR(280)`, `BOOLEAN`, `TIMESTAMPTZ`, `UUID`), and the correct constraints (PK, NOT NULLs, defaults). Commit the generated files unmodified — drizzle-kit owns this artifact, do not hand-edit
  - [ ] Run `pnpm drizzle-kit migrate` against `DATABASE_URL` (your personal Neon dev branch). Verify the table exists by querying `SELECT * FROM todos;` (empty result expected) via the Neon SQL editor or `psql`
  - [ ] Add a `db:generate` and `db:migrate` script to `package.json` for ergonomic local use:
    ```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
    ```

- [ ] **Task 5: Update build pipeline to run migrations (AC: #4)**
  - [ ] Edit `package.json`: change `"build": "next build"` to `"build": "drizzle-kit migrate && next build"`
  - [ ] Run `pnpm build` locally to verify both phases run cleanly (migration is idempotent — re-running on an already-migrated DB is a no-op)
  - [ ] **Vercel verification:** push the branch, observe the preview deploy logs, confirm both `drizzle-kit migrate` and `next build` succeed in sequence. The preview deploy uses an ephemeral Neon branch, so the migration runs against an empty DB on first apply
  - [ ] If `drizzle-kit migrate` fails on Vercel because `drizzle-kit` is in `devDependencies` and the Vercel build prunes them: move it to `dependencies` (drizzle's recommendation for build-time use) or set Vercel's "Install Dev Dependencies" toggle. Default Vercel behavior installs both — verify before changing

- [ ] **Task 6: Verify `.env.example` and `.env.local` (AC: #5)**
  - [ ] Story 1.1 already created `.env.example` with placeholders for `DATABASE_URL`, `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — verify the file is intact and the keys are present. No edits expected unless something is missing
  - [ ] Confirm `.env.local` is gitignored (Story 1.1 set `.env*` with a `!.env.example` exception in `.gitignore` — verify this is unchanged)
  - [ ] Confirm `DATABASE_URL` is set in Vercel **Production** and **Preview** scopes (Task 1 should have populated this via the integration; double-check)

- [ ] **Task 7: Write `db/client.ts` with `server-only` enforcement (AC: #6)**
  - [ ] Create `db/client.ts` starting with the literal first line: `import 'server-only';`
  - [ ] Build a Drizzle client over a `pg.Pool`:
    ```ts
    import 'server-only';
    import { Pool } from 'pg';
    import { drizzle } from 'drizzle-orm/node-postgres';
    import * as schema from './schema';

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required');
    }

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    export const db = drizzle(pool, { schema });
    ```
  - [ ] Vercel functions are short-lived; the `Pool` is created per cold start. For Neon specifically, the connection string from the integration uses the **pooled** endpoint (`*.pooler.neon.tech`), so application-level pooling is layered on top of Neon's pooler — both are fine. Do not use `drizzle-orm/neon-http` (HTTP-driver) in v1; the architecture chose the `pg` Node driver for richer query support and easier local Postgres development
  - [ ] Add `pnpm add @types/pg --save-dev` if not yet installed (Task 2 should have done it; verify)

- [ ] **Task 8: Write `db/queries.ts` with `getTodos` and `createTodo` (AC: #7)**
  - [ ] Create `db/queries.ts` with two exported async functions:
    ```ts
    import { eq, isNull, and, desc, or } from 'drizzle-orm';
    import { db } from './client';
    import { todos, type Todo, type TodoInsert } from './schema';

    export async function getTodos(userId: string | null): Promise<Todo[]> {
      const userIdMatch = userId === null
        ? isNull(todos.userId)
        : eq(todos.userId, userId);
      return db
        .select()
        .from(todos)
        .where(userIdMatch)
        .orderBy(desc(todos.createdAt));
    }

    export type TodoCreateInput = Pick<TodoInsert, 'id' | 'description'>;

    export async function createTodo(
      input: TodoCreateInput,
      userId: string | null,
    ): Promise<Todo> {
      const [row] = await db
        .insert(todos)
        .values({ ...input, userId: userId ?? null })
        .returning();
      return row;
    }
    ```
  - [ ] Both functions use parameterized Drizzle expressions exclusively. **Forbidden:** any `sql` template literal interpolating user input, any `db.execute` with a string. Use `eq`, `isNull`, `and`, `desc` helpers
  - [ ] Story 1.3 will introduce a richer `TodoCreateInput` type from `lib/validation.ts` (Zod-derived). For now, the local `TodoCreateInput` aliases the relevant fields off Drizzle's `$inferInsert`. Story 1.3 will swap this import to the canonical Zod-inferred type
  - [ ] **Idempotency on duplicate UUID** is **not** part of this story — Story 1.3's POST handler implements the "retry returns 200 with the existing row" semantics. For now, `createTodo` will throw a `unique_violation` if called twice with the same `id`; that's acceptable

- [ ] **Task 9: Set up Vitest (AC: #8)**
  - [ ] `pnpm add -D vitest @vitest/coverage-v8 dotenv`. (`dotenv` lets the test setup read `.env.local` / `.env.test`. If you prefer Vitest's built-in `loadEnv`, skip dotenv.)
  - [ ] Add `vitest.config.ts` at repo root:
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
  - [ ] Add `tsconfig.json` `compilerOptions.types: ["vitest/globals"]` only if `globals: true` is used (we don't, to keep imports explicit)
  - [ ] Add scripts to `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"`. **Note:** Story 1.1 has `pnpm test:tokens` for the token-mapping smoke test (`scripts/check-tokens.mjs`). Either keep both scripts or migrate the token check into Vitest as `scripts/check-tokens.test.ts`. Recommend migrating: removes one ad-hoc script and unifies on Vitest
  - [ ] Decide test-DB strategy and document it in `AGENTS.md`:
    - **Option A (recommended):** developers create a personal Neon dev branch via the Neon dashboard, set `DATABASE_URL` in `.env.local` to that branch. Tests TRUNCATE `todos` between tests and operate on the live dev branch. Cheap; Neon branches are free.
    - **Option B:** spin up a local Postgres via Docker for tests (`postgres:16`). Tests run against `localhost:5432`. More setup, no network dependency, faster.
    - For CI (Story 4.3): GitHub Actions will use the Vercel preview's Neon branch URL, which is per-PR and ephemeral.

- [ ] **Task 10: Write `db/queries.test.ts` (AC: #8)**
  - [ ] Create `db/queries.test.ts` with two integration tests:
    1. `createTodo inserts a row that getTodos returns` — call `createTodo` with a UUID + description, then call `getTodos(null)`, assert exactly one row, assert `description` and `id` match, assert `completed === false` and `createdAt` is recent (within ~5s of now), assert `userId === null`
    2. `getTodos returns rows newest-first` — call `createTodo` three times with a small delay (e.g., `await new Promise(r => setTimeout(r, 10))`) between them, assert the returned array is in reverse insertion order
  - [ ] In `beforeEach`, `TRUNCATE todos` to reset state. In `afterAll`, end the pool gracefully so Vitest doesn't hang on open connections:
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
  - [ ] Run `pnpm test` and confirm both tests pass against the dev DB

- [ ] **Task 11: Update `AGENTS.md` with DB conventions**
  - [ ] Add a "Database" section documenting:
    - Schema is in `db/schema.ts`; never raw-edit migration SQL
    - All queries use Drizzle parameterized expressions; raw SQL strings are forbidden in application code
    - `db/client.ts` is `server-only`; never import it from `components/`, `hooks/`, or `lib/api-client.ts`
    - The chosen test-DB strategy (Option A or B from Task 9)
    - The `pg` driver (not `neon-http`) is canonical for v1
  - [ ] Add a "Migrations" section documenting:
    - `pnpm db:generate` to create a migration after schema edits
    - `pnpm db:migrate` to apply locally
    - The build pipeline runs migrations automatically on Vercel via `pnpm build`

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

(populated by dev agent during implementation)

### Completion Notes List

(populated by dev agent on completion)

### File List

(populated by dev agent on completion — list every new/modified/deleted file as a path relative to repo root)

## Change Log

| Date       | Change                                              | Author |
| ---------- | --------------------------------------------------- | ------ |
| 2026-04-28 | Story spec created from epics.md §"Story 1.2" plus context from architecture.md §"Data Architecture", with Story 1.1 learnings propagated | bmad-create-story |
