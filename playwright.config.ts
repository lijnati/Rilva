import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys (Chromium only). Reuses a running dev server on :3100 or starts one.
 * Chain-dependent journeys run only with E2E_CHAIN=local (local Hardhat node seeded by pnpm chain:seed:local).
 * E2E_PORT selects the dev server port (default 3100).
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: `pnpm dev --port ${PORT}`, url: `http://localhost:${PORT}`, reuseExistingServer: true, timeout: 600_000 },
});
