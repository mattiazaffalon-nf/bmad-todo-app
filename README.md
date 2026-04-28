# bmad-todo-app

A focused, fast todo app built with Next.js 16, shadcn/ui, and Postgres. Created via the BMad method as part of the AI Native Engineering (AINE) course.

## Local development

```bash
# 1. Use the pinned Node version (22 LTS)
nvm use   # reads .nvmrc

# 2. Install dependencies
pnpm install

# 3. Configure environment (Story 1.2 onward needs DATABASE_URL)
cp .env.example .env.local
# fill in DATABASE_URL when the database is provisioned in Story 1.2

# 4. Start the dev server
pnpm dev
# Local: http://localhost:3000
```

## Scripts

- `pnpm dev` — Next.js dev server (Turbopack).
- `pnpm build` — production build (`drizzle-kit migrate && next build`; runs DB migrations before building).
- `pnpm start` — serve the production build locally.
- `pnpm lint` — ESLint (Next.js config + import-graph rules + jsx-a11y).
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm test` — Vitest run (unit + integration; integration tests require `DATABASE_URL` in `.env.local`).
- `pnpm test:watch` — Vitest watch mode.
- `pnpm db:generate` — generate a migration SQL file from the latest `db/schema.ts`.
- `pnpm db:migrate` — apply pending migrations against `DATABASE_URL_UNPOOLED` (or `DATABASE_URL`).

## Required environment variables

See `.env.example`. Values are configured per-environment in Vercel:

| Variable | Used by | Story |
| --- | --- | --- |
| `DATABASE_URL` | Drizzle / Postgres | 1.2 |
| `SENTRY_DSN` | Server-side error reporting | 4.3 |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser error reporting | 4.3 |

## Deployment

- Vercel auto-deploys `main` → production and every PR → preview.
- Neon Postgres branches per PR (Story 1.2 sets up the integration).
- Production URL: _to be assigned after the GitHub→Vercel link is wired (Task 5 of Story 1.1)_.

## Conventions

See [`AGENTS.md`](./AGENTS.md) for naming, the import-graph rules, the no-modals UX policy, and the design-token contract. Authoritative specs live in `_bmad-output/planning-artifacts/` (PRD, architecture, UX, epics, dependency graph).

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
