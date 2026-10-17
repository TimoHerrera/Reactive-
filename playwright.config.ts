import { defineConfig, devices } from "@playwright/test";

// E2E en modo mock (sin Supabase), contra el build de producción, a 390 px (mobile-first).
const PORT = Number(process.env.E2E_PORT) || 3200;
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Cada test levanta su propio Chromium contra un solo `next start`: con más de 3 en paralelo,
  // en una notebook cargada se ahogan y vencen por tiempo (no por bugs).
  workers: 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
    },
  ],
  // Con E2E_BASE_URL (ej. un preview de Vercel) no levanta servidor local.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run build && npx next start -p ${PORT}`,
        url: `${baseURL}/login`,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        env: { NEXT_PUBLIC_DATA_SOURCE: "mock", NEXT_TELEMETRY_DISABLED: "1" },
      },
});
