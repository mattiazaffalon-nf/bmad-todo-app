import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3000" },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
