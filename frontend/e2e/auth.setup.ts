import { test as setup, expect } from '@playwright/test';
import { LoginPage } from './pages/login.page';
import { TEST_USERS } from './fixtures/auth.fixture';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Playwright "setup" project — runs ONCE before the dependent specs.
 * Logs in as tenant_admin and persists:
 *   - cookies + localStorage → .auth/tenant_admin.storage.json (Playwright standard)
 *   - sessionStorage (where JWT lives) → .auth/tenant_admin.session.json (custom)
 *
 * Specs that depend on this project load storageState via playwright.config
 * and re-inject sessionStorage via a beforeEach hook.
 */

const AUTH_DIR = path.resolve(__dirname, '..', '.auth');
const STORAGE_FILE = path.join(AUTH_DIR, 'tenant_admin.storage.json');
const SESSION_FILE = path.join(AUTH_DIR, 'tenant_admin.session.json');

setup('authenticate tenant_admin', async ({ page }) => {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const lp = new LoginPage(page);
  const creds = TEST_USERS.tenant_admin;

  await lp.goto();
  await lp.fillCredentials(creds.institution, creds.matricule, creds.password);
  await lp.submitLogin();
  await lp.waitForOtpStep();
  await lp.expectOtpPreFilled();
  await lp.submitOtp();
  await lp.expectDashboardVisible();

  const sessionDump = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)!;
      data[k] = sessionStorage.getItem(k)!;
    }
    return data;
  });

  expect(sessionDump['access_token'], 'access_token must be in sessionStorage').toBeTruthy();

  fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionDump, null, 2));
  await page.context().storageState({ path: STORAGE_FILE });
});
