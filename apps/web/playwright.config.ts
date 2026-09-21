import { defineConfig, devices } from "@playwright/test";

// Corre contra el stack de desarrollo real (server + web + Postgres), igual
// que se prueba a mano: `pnpm db:up` + `pnpm dev` desde la raíz del repo.
// `reuseExistingServer` en true siempre — en CI conviene levantar el stack
// en un paso previo (con la base ya migrada/sembrada) en vez de que
// Playwright intente orquestar Postgres, que no maneja.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev",
    cwd: "../..",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
