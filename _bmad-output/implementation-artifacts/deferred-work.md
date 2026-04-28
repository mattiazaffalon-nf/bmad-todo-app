# Deferred Work

## Deferred from: code review of 1-3-api-todos-routes-validation (2026-04-28)

- No request body size limit or stream timeout on `req.json()` in `app/api/todos/route.ts` — a slow/large payload could cause the handler to hang or OOM. Mitigated by reverse proxy in production (Vercel). Revisit if the endpoint is exposed to untrusted clients without a gateway.
