# syntax=docker/dockerfile:1.7

# ---------- Builder ----------
FROM node:22-alpine AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=1

# `db/client.ts` throws if DATABASE_URL is unset at module load. The page is
# force-dynamic so no DB query runs at build, but the env var is still required
# for module evaluation during Next.js page-data collection.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Migrations require a live DB — skip them at build time. The runner stage
# applies them at container start. Call `next build` directly, NOT `pnpm build`
# (which is `drizzle-kit migrate && next build` for Vercel).
RUN pnpm exec next build

# ---------- Runner ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# pnpm is needed at runtime ONLY to invoke `pnpm db:migrate` before the server starts.
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Standalone Next.js server bundle (lean package.json + minimal runtime node_modules).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Overlay the full package.json (with `db:migrate` script) and migration deps on
# top of the standalone output so `pnpm db:migrate` works at startup.
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=node:node /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder --chown=node:node /app/db ./db
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

USER node

EXPOSE 3000

CMD ["sh", "-c", "pnpm db:migrate && node server.js"]
