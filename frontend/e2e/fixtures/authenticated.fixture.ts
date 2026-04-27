import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fixture for specs that depend on the `setup` project.
 * - Loads cookies+localStorage automatically via playwright.config `storageState`.
 * - Re-injects sessionStorage (where the JWT lives) before each test.
 * - Exposes `accessToken` for specs that need to call the API directly.
 */

const SESSION_FILE = path.resolve(__dirname, '..', '..', '.auth', 'tenant_admin.session.json');

function readSession(): Record<string, string> {
  if (!fs.existsSync(SESSION_FILE)) {
    throw new Error(`Missing ${SESSION_FILE} — run the "setup" project first.`);
  }
  return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
}

type AuthedFixtures = {
  accessToken: string;
  sessionDump: Record<string, string>;
};

export const test = base.extend<AuthedFixtures>({
  sessionDump: async ({}, use) => {
    const session = readSession();
    await use(session);
  },

  // Auto-inject sessionStorage for every test using this fixture,
  // even if `accessToken` is not requested in the test signature.
  page: async ({ page, sessionDump }, use) => {
    await page.addInitScript((dump: Record<string, string>) => {
      for (const [k, v] of Object.entries(dump)) {
        sessionStorage.setItem(k, v);
      }
    }, sessionDump);
    await use(page);
  },

  accessToken: async ({ sessionDump }, use) => {
    const token = sessionDump['access_token'];
    await use(token);
  },
});

export { expect };
