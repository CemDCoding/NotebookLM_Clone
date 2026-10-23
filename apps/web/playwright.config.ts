import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Playwright does not read Next.js env files, so the E2E credentials are loaded here. Variables
// that are already set (e.g. in the shell) win over the file.
const envFile = fileURLToPath(new URL('./.env.local', import.meta.url));
if (existsSync(envFile)) {
  process.loadEnvFile(envFile);
}

/**
 * One E2E test for the main flow against the development environment. The app (web and API) must
 * already be running, e.g. via `pnpm dev`: starting it here would hide a broken setup behind a
 * second, differently configured server.
 */
export default defineConfig({
  testDir: './e2e',
  // Ingestion and the streamed answer call the real Mistral API, so one run takes a while.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'de-DE',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
