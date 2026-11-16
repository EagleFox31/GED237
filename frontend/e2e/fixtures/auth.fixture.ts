import { test as base, expect, type Browser } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

/**
 * Demo credentials matching DEMO_CREDENTIALS in LoginPage.tsx
 */
export const TEST_USERS = {
  super_admin:  { institution: 'Plateforme E-Dossier (PLATFORM)', matricule: 'SUPER001', password: 'Admin@2025', demoLabel: 'Super Admin' },
  tenant_admin: { institution: 'Ministère des Finances (MINFI)', matricule: 'MINFI001', password: 'Minfi@2025', demoLabel: 'Admin Institution' },
  unit_admin:   { institution: 'Ministère des Finances (MINFI)', matricule: 'UNIT001',  password: 'Unit@2025',  demoLabel: 'Admin Unité' },
  manager:      { institution: 'Ministère des Finances (MINFI)', matricule: 'MGR001',   password: 'Mgr@2025',   demoLabel: 'Manager' },
  collaborator: { institution: 'Ministère des Finances (MINFI)', matricule: 'MINFI002', password: 'User@2025',  demoLabel: 'Collaborateur' },
  reader:       { institution: 'Ministère des Finances (MINFI)', matricule: 'READ001',  password: 'Read@2025',  demoLabel: 'Lecteur' },
  auditor:      { institution: 'Ministère des Finances (MINFI)', matricule: 'AUDIT001', password: 'Audit@2025', demoLabel: 'Auditeur' },
} as const;

export type UserRole = keyof typeof TEST_USERS;

type SessionDump = Record<string, string>;

type AuthFixtures = {
  loginPage: LoginPage;
  loginAs: (role: UserRole) => Promise<void>;
  /** true = every loginAs goes through the real login form (specs that test the login itself). */
  freshLogin: boolean;
};

type WorkerFixtures = {
  /** One UI login per role per worker, then reused (fewer 429s, shorter runs). */
  roleSession: (role: UserRole) => Promise<SessionDump>;
};

async function uiLogin(page: import('@playwright/test').Page, role: UserRole) {
  const lp = new LoginPage(page);
  const creds = TEST_USERS[role];
  await lp.goto();
  await lp.fillCredentials(creds.institution, creds.matricule, creds.password);
  await lp.submitLogin();
  await lp.waitForOtpStep();
  // In dev mode OTP is pre-filled from response — wait for state update
  await lp.expectOtpPreFilled();
  await lp.submitOtp();
  await lp.expectDashboardVisible();
}

async function captureSession(browser: Browser, baseURL: string | undefined, role: UserRole): Promise<SessionDump> {
  const context = await browser.newContext({ baseURL });
  try {
    const page = await context.newPage();
    await uiLogin(page, role);
    return await page.evaluate(() => {
      const data: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)!;
        data[k] = sessionStorage.getItem(k)!;
      }
      return data;
    });
  } finally {
    await context.close();
  }
}

export const test = base.extend<AuthFixtures, WorkerFixtures>({
  freshLogin: [false, { option: true }],

  roleSession: [async ({ browser }, use, workerInfo) => {
    const baseURL = workerInfo.project.use.baseURL;
    // The cache is never invalidated by a logout or a lock: a spec that logs out (the token goes on the
    // blacklist) or locks an account MUST use test.use({ freshLogin: true }), or the cached session is dead
    // for the rest of the worker. The access token lives 30 min and the front does not refresh on 401, so a
    // capture older than MAX_AGE_MS is retaken.
    const MAX_AGE_MS = 20 * 60 * 1000;
    const cache = new Map<UserRole, { at: number; dump: Promise<SessionDump> }>();
    await use((role) => {
      const hit = cache.get(role);
      if (hit && Date.now() - hit.at < MAX_AGE_MS) return hit.dump;
      const dump = captureSession(browser, baseURL, role);
      cache.set(role, { at: Date.now(), dump });
      return dump;
    });
  }, { scope: 'worker' }],

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  loginAs: async ({ page, roleSession, freshLogin }, use) => {
    const login = async (role: UserRole) => {
      if (freshLogin) return uiLogin(page, role);
      const dump = await roleSession(role);
      // Replace any previous session of this page (a test may switch roles), then open the app.
      await page.goto('');
      await page.evaluate((d: SessionDump) => {
        sessionStorage.clear();
        for (const [k, v] of Object.entries(d)) sessionStorage.setItem(k, v);
      }, dump);
      await page.goto('dashboard');
      await new LoginPage(page).expectDashboardVisible();
    };
    await use(login);
  },
});

export { expect };
