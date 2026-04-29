import * as Sentry from "@sentry/nextjs";

const enabled =
  process.env.NODE_ENV !== "development" ||
  process.env.NEXT_PUBLIC_SENTRY_ENABLED === "true";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled,
  tracesSampleRate: 1,
});
