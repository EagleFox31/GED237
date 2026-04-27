import { test as base, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

/**
 * Demo credentials matching DEMO_CREDENTIALS in LoginPage.tsx
 */
export const TEST_USERS = {
  super_admin:  { institution: 'Plateforme E-Dossier (PLATFORM)', matricule: 'SUPER001', password: 'Admin@2025', demoLabel: 'Super Admin' },
  tenant_admin: { institution: 'Ministère des Finances (MINFI)', matricule: 'MINFI001', password: 'Minfi@2025', demoLabel: 'Admin Tenant' },
  unit_admin:   { institution: 'Ministère des Finances (MINFI)', matricule: 'UNIT001',  password: 'Unit@2025',  demoLabel: 'Admin Unité' },
  manager:      { institution: 'Ministère des Finances (MINFI)', matricule: 'MGR001',   password: 'Mgr@2025',   demoLabel: 'Manager' },
  collaborator: { institution: 'Ministère des Finances (MINFI)', matricule: 'MINFI002', password: 'User@2025',  demoLabel: 'Collaborateur' },
  reader:       { institution: 'Ministère des Finances (MINFI)', matricule: 'READ001',  password: 'Read@2025',  demoLabel: 'Lecteur' },
  auditor:      { institution: 'Ministère des Finances (MINFI)', matricule: 'AUDIT001', password: 'Audit@2025', demoLabel: 'Auditeur' },
} as const;

export type UserRole = keyof typeof TEST_USERS;

type AuthFixtures = {
  loginPage: LoginPage;
  loginAs: (role: UserRole) => Promise<void>;
};

export const test = base.extend<AuthFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  loginAs: async ({ page }, use) => {
    const login = async (role: UserRole) => {
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
    };
    await use(login);
  },
});

export { expect };
