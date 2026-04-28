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
