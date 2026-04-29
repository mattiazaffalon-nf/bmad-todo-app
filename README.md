# bmad-todo-app

A focused, fast todo app built with Next.js 16, shadcn/ui, and Postgres. Created via the BMad method as part of the AI Native Engineering (AINE) course.

## Local development

### Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | **22 LTS** | Pinned in `.nvmrc`. Use `nvm use` (or `fnm use`, `volta`, etc.). Vercel builds on 22 — reproduce CI failures locally on 22. |
| pnpm | **9.x** | Required. `npm` and `yarn` are not supported. Install once with `corepack enable && corepack prepare pnpm@9.0.0 --activate`. |
| Postgres 17 | optional (path B/C) | Either via the compose stack below, a local install, or a Neon branch. |
| Docker or Podman | optional (path A/B) | Only needed for the compose stack. `docker compose` and `podman compose` are interchangeable. |
| Vercel CLI | optional (path C) | Only needed to pull a Neon dev-branch `DATABASE_URL`. Install with `npm i -g vercel`. |

### Pick a setup path

| Path | When to use | DB | App runs on |
| --- | --- | --- | --- |
| **A. Full compose** | Fastest start; no Node install needed; matches the production-style runtime | Postgres in container | Container (built from `Dockerfile`) |
| **B. Hybrid** *(recommended for day-to-day dev)* | Get HMR + instant feedback while keeping the DB ephemeral and isolated | Postgres in container | `pnpm dev` on the host |
| **C. Vercel-linked Neon branch** | Working on something that touches Vercel preview / Neon-specific behavior | Neon branch (per-PR) | `pnpm dev` on the host |

### Path A — full compose (zero-config)

```bash
docker compose up --build       # or: podman compose up --build
# → http://localhost:3000
```

`compose.yml` builds the app from `Dockerfile` and points it at a Postgres 17 sidecar. The container's startup command runs `pnpm db:migrate` before serving (`Dockerfile:56`). Data persists in the `pgdata` named volume — `docker compose down -v` to wipe.

### Path B — hybrid (compose DB + local dev server)

```bash
# 1. Start only the database
docker compose up -d db

# 2. Pin Node + install
nvm use && pnpm install

# 3. Point the app at the compose DB
echo 'DATABASE_URL=postgresql://todo:todo@localhost:5432/todo' > .env.local
echo 'DATABASE_URL_UNPOOLED=postgresql://todo:todo@localhost:5432/todo' >> .env.local

# 4. Run migrations once, then start dev
pnpm db:migrate
pnpm dev
# → http://localhost:3000
```

> **Port 5432 already in use?** Another Postgres is bound on the host. Either stop it, or override the published port: `docker compose run --service-ports -p 5433:5432 db` and use `localhost:5433` in `.env.local`.

### Path C — Vercel-linked Neon dev branch

```bash
# 1. Link the local checkout to the Vercel project (one-time)
vercel link

# 2. Pull DATABASE_URL (and DATABASE_URL_UNPOOLED) into .env.local
pnpm dlx vercel env pull .env.local

# 3. Pin Node + install + run migrations + start dev
nvm use && pnpm install && pnpm db:migrate && pnpm dev
```

`vercel env pull` populates the Neon-managed connection strings via the Vercel-Neon Marketplace integration. Use this when you specifically need the Neon dev branch (e.g., debugging a preview-deploy issue).

## Scripts

- `pnpm dev` — Next.js dev server (Turbopack).
- `pnpm build` — production build (`drizzle-kit migrate && next build`; runs DB migrations before building).
- `pnpm start` — serve the production build locally.
- `pnpm lint` — ESLint (Next.js config + import-graph rules + jsx-a11y).
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm test` — Vitest run (unit + integration; integration tests require `DATABASE_URL` in `.env.local`).
- `pnpm test:watch` — Vitest watch mode.
- `pnpm test:e2e` — Playwright E2E suite (auto-starts `pnpm dev` if `BASE_URL` is unset; otherwise points at `BASE_URL`).
- `pnpm db:generate` — generate a migration SQL file from the latest `db/schema.ts`.
- `pnpm db:migrate` — apply pending migrations against `DATABASE_URL_UNPOOLED` (or `DATABASE_URL`).

## Running the tests

Unit + integration:

```bash
pnpm test                       # one-shot
pnpm test:watch                 # watch mode
pnpm exec vitest run --coverage # with coverage report
```

Integration tests run against the real Postgres reachable via `DATABASE_URL`. `beforeEach` truncates the affected tables — never point this at production.

End-to-end (Playwright):

```bash
pnpm exec playwright install     # one-time browser install
pnpm test:e2e                    # auto-starts pnpm dev if BASE_URL is unset
BASE_URL=http://localhost:3000 pnpm test:e2e   # use an already-running server
```

The standalone accessibility scan (`scripts/axe-scan.mjs`) is documented in [`docs/qa-report-2026-04-29.md`](./docs/qa-report-2026-04-29.md).

## Required environment variables

See `.env.example`. Values are configured per-environment in Vercel:

| Variable | Used by | Required for | Story |
| --- | --- | --- | --- |
| `DATABASE_URL` | Drizzle / Postgres | dev, build, tests | 1.2 |
| `DATABASE_URL_UNPOOLED` | Drizzle migrations | `pnpm db:migrate` (preferred) | 1.2 |
| `SENTRY_DSN` | Server-side error reporting | production | 4.3 |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser error reporting | production | 4.3 |
| `NEXT_PUBLIC_SENTRY_ENABLED` | Force-enable Sentry in dev | optional | 4.3 |

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Error: DATABASE_URL is required` at startup | `.env.local` missing or empty | Pick a path above (A/B/C) and populate `.env.local`. |
| `next build` fails with a connection error | `pnpm build` runs `drizzle-kit migrate` first; needs a reachable DB | Start the DB (path B/C) before running `pnpm build`. The Dockerfile build skips this step (`Dockerfile:25`). |
| Vitest integration tests hang or timeout | `DATABASE_URL` points at an unreachable host | Verify `psql "$DATABASE_URL" -c '\\l'` works. |
| `pnpm install` fails on `corepack` | Older Node version | `nvm use` to switch to 22 LTS. |
| ESLint flags `no-restricted-imports` | The import-graph rule in `AGENTS.md` was violated | Restructure the imports — do not silence the rule. |
| Playwright tests can't find browsers | Browsers not installed | `pnpm exec playwright install`. |

## Deployment

- Vercel auto-deploys `main` → production and every PR → preview.
- Neon Postgres branches per PR (Story 1.2 sets up the integration).
- Production URL: _to be assigned after the GitHub→Vercel link is wired (Task 5 of Story 1.1)_.

## Conventions

See [`AGENTS.md`](./AGENTS.md) for naming, the import-graph rules, the no-modals UX policy, and the design-token contract. Authoritative specs live in `_bmad-output/planning-artifacts/` (PRD, architecture, UX, epics, dependency graph).

## Documentation

Long-form reports and checklists live under [`docs/`](./docs/):

| Document | Purpose |
| --- | --- |
| [`docs/launch-checklist.md`](./docs/launch-checklist.md) | Pre-launch manual QA pass — cross-browser, color-blindness, 200 % zoom, keyboard-only journey, VoiceOver spot-check (Story 4.4). |
| [`docs/qa-report-2026-04-29.md`](./docs/qa-report-2026-04-29.md) | Dated QA snapshot — Vitest results, coverage, performance trace (Core Web Vitals), Lighthouse audits, axe-core WCAG AA scans, manual security review. |
| [`docs/success-criteria-report.md`](./docs/success-criteria-report.md) | Maps each course success criterion to the actual repo state with file/PR evidence and run-it-yourself commands. |
| [`docs/ai-collaboration-retrospective.md`](./docs/ai-collaboration-retrospective.md) | Reflection on AI usage — agent tasks, MCP servers, test generation, debugging cases, limitations encountered. |

## BMad workflow used on this project

This is a reconstruction of the BMad skills invoked, in order, mapped to the artifacts and commits each one produced. Useful as a reference for repeating the workflow on a new project.

### Planning phase

| # | Skill | Output(s) | Commit |
| --- | --- | --- | --- |
| 1 | `/bmad-create-prd` | `_bmad-output/planning-artifacts/prd.md` | `35d11f2` |
| 2 | `/bmad-create-ux-design` | `ux-design-specification.md` | `35d11f2` |
| 3 | `/bmad-create-architecture` | `architecture.md` | `35d11f2` |
| 4 | `/bmad-create-epics-and-stories` | `epics.md` | `6384fa4` |
| 5 | `/bmad-check-implementation-readiness` | `implementation-readiness-report-2026-04-28.md` + `story-dependency-graph.md` | `aa46e77` |

Steps 1–3 were committed together (single PR #1), so they were run back-to-back before the first commit. PR #2 landed epics; PR was skipped for the readiness check (committed straight to main).

### Implementation phase (Epic 1)

| # | Skill | Output(s) | Commit / PR |
| --- | --- | --- | --- |
| 6 | `/bmad-create-story` (story 1.1) | `_bmad-output/implementation-artifacts/1-1-scaffold-nextjs-shadcn-vercel.md` | bundled into `9f967ad` |
| 7 | `/bmad-dev-story` (story 1.1) | Next.js + shadcn + Vercel scaffold | `9f967ad`, PR #3 |
| 8 | `/bmad-create-story` (story 1.2) | `1-2-postgres-schema-migrations-queries.md` | `af8d3c4`, PR #4 |
| 9 | `/bmad-dev-story` (story 1.2) | `db/schema.ts`, migrations, `db/queries.ts`, Drizzle + Vitest config, integration tests | `6b3bdeb`, PR #5 |

### Workflow notes

- **Process change between stories 1.1 and 1.2.** Story 1.1 was a single commit covering both spec and dev (`bmad-story-1.1-scaffold`). Story 1.2 split this into two PRs — spec first (PR #4: `bmad-create-story-1.2-spec`), then dev (PR #5: `bmad-story-1.2-postgres-schema`). The split makes the spec reviewable in isolation before code lands against it.
- **Skills not used (and why).**
  - No `/bmad-product-brief` — went straight to PRD; for a small scoped app the brief would have been redundant.
  - No `/bmad-sprint-planning` — `story-dependency-graph.md` from the readiness check served as the sequencing reference.
  - No `/bmad-validate-prd` as a separate step — the readiness check covered cross-document validation across PRD, UX, architecture, and epics in one pass.
  - No `/bmad-shard-doc` — planning docs were small enough to leave whole.
