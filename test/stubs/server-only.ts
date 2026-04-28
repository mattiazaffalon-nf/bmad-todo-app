// No-op stub for the Next.js `server-only` package, used by Vitest.
// In production builds, the real `server-only` errors at bundle time if a module
// importing it is reachable from a client component. In tests we run in Node,
// so it has no behavior to mock — the empty stub keeps the import resolvable.
export {};
