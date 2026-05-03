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
