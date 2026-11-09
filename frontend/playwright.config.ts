import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://127.0.0.1:5173/edossier/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/tenant_admin.storage.json',
      },
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: 'authed-chromium',
      testMatch: /(rules-setup|bulk-upload|needs-review)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: '.auth/tenant_admin.storage.json',
      },
      dependencies: ['setup'],
    },
    {
      // PR gate (docker-compose.e2e.yml): critical journeys against the real API + seeded demo data.
      // Keep it short; the full suite belongs to the nightly run.
      name: 'smoke',
      testMatch: /(auth|security-isolation|documents|full-cycle|a11y)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      // The seed check runs first: missing reference data fails there, listing what is absent.
      dependencies: ['seed'],
    },
    {
      // API-only check of e2e/data/seed-manifest.json against the running stack (e2e_reset.sh).
      name: 'seed',
      testMatch: /seed\.spec\.ts/,
    },
    {
      name: 'mocked-chromium',
      testMatch: /(classification-admin|classification-reviews|ingestion|spaces)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173/edossier/',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
