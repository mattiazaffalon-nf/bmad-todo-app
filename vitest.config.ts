import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test", quiet: true });
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    globals: false,
    // server-only is a Next.js runtime guard. In Vitest's Node env it is harmless,
    // but stub it explicitly so a future bundler-condition change cannot break tests.
    server: {
      deps: {
        inline: ["drizzle-orm"],
      },
    },
  },
  resolve: {
    alias: {
      "server-only": new URL("./test/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
});
