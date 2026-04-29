# Story 4.5: Docker Compose local development environment

Status: ready-for-dev

## Story

As a developer,
I want to run the full application stack locally with a single `docker compose up` command,
so that the app and its Postgres database start together without any manual environment setup.

## Acceptance Criteria

**AC #1 — Dockerfile**
- `Dockerfile` at project root builds the Next.js app using a multi-stage build (builder + runner).
- Builder stage: Node 22 LTS alpine, installs pnpm via corepack, copies `package.json`/`pnpm-lock.yaml`, runs `pnpm install --frozen-lockfile`, copies source, runs `next build` (migrations are NOT run at build time — DB is not available during image build).
- `next.config.ts` sets `output: 'standalone'` so the runner stage only ships the minimal server bundle.
- Runner stage: copies `.next/standalone`, `.next/static`, and `public` from builder; runs as non-root user (`node`); exposes port 3000.
- `NEXT_TELEMETRY_DISABLED=1` set in both stages.

**AC #2 — .dockerignore**
- `.dockerignore` at project root excludes: `node_modules`, `.next`, `.env*`, `*.md`, `_bmad*`, `e2e`, `.git`.

**AC #3 — compose.yml**
- `compose.yml` at project root defines two services: `db` and `app`.
- `db` service: `postgres:17-alpine` image; volume `pgdata` for persistence; env vars `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` set to `todo`/`todo`/`todo`; healthcheck using `pg_isready`.
- `app` service: built from `Dockerfile`; `depends_on: db: condition: service_healthy`; port `3000:3000`; runs migrations via `entrypoint` or `command` before starting the server (see tasks for detail).
- Named volume `pgdata` declared at top-level.

**AC #4 — Environment wiring**
- `app` service receives `DATABASE_URL=postgresql://todo:todo@db:5432/todo` and `DATABASE_URL_UNPOOLED=postgresql://todo:todo@db:5432/todo` (same value — direct Postgres, no pooler needed locally).
- No `.env` file is committed. Values are hardcoded in `compose.yml` for the local-only dev DB (non-secret dummy credentials).
- `NEXT_PUBLIC_SENTRY_ENABLED` is NOT set in compose (Sentry stays disabled locally per Story 4.3 conventions).

**AC #5 — Migration-then-start entrypoint**
- The `app` service runs `pnpm db:migrate && node server.js` as its startup command so migrations always apply before the server accepts traffic.
- `pnpm` must be available in the runner stage (install via corepack or copy from builder stage's `node_modules/.bin`).
- `server.js` is the Next.js standalone server at `.next/standalone/server.js`.

**AC #6 — `pnpm build` unchanged**
- `package.json` `build` script (`drizzle-kit migrate && next build`) remains unchanged — it still handles Vercel deploys.
- The `next.config.ts` `output: 'standalone'` addition is additive and does not break the Vercel build.

**AC #7 — Manual verification**
- `docker compose up --build` succeeds from a clean checkout (no `.env.local` present).
- App is reachable at `http://localhost:3000`.
- Creating, completing, and deleting a task persists across `docker compose restart`.
- `docker compose down -v` removes the volume cleanly.

## Tasks / Subtasks

- [ ] Add `output: 'standalone'` to `next.config.ts` (AC: #1, #6)
  - [ ] Confirm Vercel build still passes (`pnpm build` locally or CI)

- [ ] Create `.dockerignore` (AC: #2)

- [ ] Write `Dockerfile` multi-stage build (AC: #1, #5)
  - [ ] Builder stage: Node 22 alpine, corepack enable, pnpm install, next build
  - [ ] Runner stage: copy standalone output, set non-root user, expose 3000
  - [ ] Entrypoint: `pnpm db:migrate && node .next/standalone/server.js`
  - [ ] Ensure `pnpm` is available in runner (copy `node_modules/.bin/pnpm` or install via corepack in runner stage)

- [ ] Write `compose.yml` (AC: #3, #4)
  - [ ] `db` service with healthcheck
  - [ ] `app` service with `depends_on: db: condition: service_healthy`
  - [ ] Named volume `pgdata`

- [ ] Manual smoke test (AC: #7)
  - [ ] `docker compose up --build` from clean state
  - [ ] Verify app at localhost:3000
  - [ ] Verify task persistence across restart
  - [ ] `docker compose down -v` clean teardown

## Dev Notes

### Critical: `next.config.ts` wrapping

`next.config.ts` is already wrapped with `withSentryConfig`. The `output: 'standalone'` must be added to the **inner** `nextConfig` object, not the Sentry wrapper options:

```ts
const nextConfig: NextConfig = {
  output: 'standalone',   // ← add here
  async headers() { ... },
};
export default withSentryConfig(nextConfig, { silent: true });
```

### Migration in runner, not builder

`drizzle-kit migrate` requires a live database. The builder stage has no DB, so migrations must run at container startup in the runner stage, not during `next build`. The `build` script in `package.json` is NOT invoked inside Docker — the Dockerfile calls `pnpm next build` directly (bypassing `drizzle-kit migrate`).

### Standalone output paths

After `next build` with `output: 'standalone'`, the relevant paths are:
- Server entry: `.next/standalone/server.js`
- Static assets: `.next/static/` → copy to `.next/standalone/.next/static/`
- Public assets: `public/` → copy to `.next/standalone/public/`

Both copies are required for the standalone server to serve static files correctly.

### pnpm in runner stage

The standalone runner image needs `pnpm` only to run `db:migrate`. Options (pick one):
- **Recommended:** `RUN corepack enable && corepack prepare pnpm@<version> --activate` in the runner stage (matches builder).
- Alternative: copy `node_modules/.bin/pnpm` and `node_modules/pnpm` from builder — heavier image.

Get the exact pnpm version from `package.json` `"packageManager"` field.

### DATABASE_URL for migrations in Docker

`drizzle.config.ts` reads `DATABASE_URL_UNPOOLED ?? DATABASE_URL`. In Docker Compose, both env vars point to the same direct Postgres connection (`postgresql://todo:todo@db:5432/todo`). No pooler — this is correct and intentional (same pattern as Neon's unpooled endpoint for migrations).

### Port and hostname

The standalone server binds to `0.0.0.0` by default in Next.js 16. No `--hostname` flag needed.

### Project Structure Notes

| File | Location |
|---|---|
| `Dockerfile` | project root |
| `.dockerignore` | project root |
| `compose.yml` | project root |
| `next.config.ts` | project root (existing file, add `output: 'standalone'`) |

Do NOT create `docker-compose.yml` (legacy name) — use `compose.yml` (Compose v2 canonical name).

### References

- `next.config.ts` — existing Sentry wrapper pattern [Source: project root/next.config.ts]
- `drizzle.config.ts` — `DATABASE_URL_UNPOOLED ?? DATABASE_URL` lookup [Source: project root/drizzle.config.ts]
- `package.json` `scripts.build` — do NOT replicate inside Dockerfile [Source: project root/package.json]
- AGENTS.md — pnpm is the only allowed package manager; Node 22 LTS

## Dev Agent Record

### Agent Model Used

<!-- filled by dev agent -->

### Debug Log References

### Completion Notes List

### File List
