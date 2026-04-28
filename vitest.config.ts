import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test", quiet: true });
loadEnv({ path: ".env.local", quiet: true });

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
    globals: false,
    // Tests share a single dev-branch DB; run files serially so per-file TRUNCATE
    // semantics hold. Within a file Vitest still runs `it` blocks sequentially.
    fileParallelism: false,
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
      "@": new URL("./", import.meta.url).pathname.replace(/\/$/, ""),
    },
  },
});
