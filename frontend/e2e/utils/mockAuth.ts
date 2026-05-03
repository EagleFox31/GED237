import type { Page } from '@playwright/test';

const TENANT_ADMIN_PROFILE = {
  id: 'tenant',
  label: 'Admin Tenant',
  role: 'Organisation',
  icon: 'account_balance',
  color: 'bg-rdpc-blue',
  name: 'Admin Tenant',
  backendRole: 'TENANT_ADMIN',
  backendRoleLabel: 'Administrateur organisation',
  matricule: 'MINFI001',
  email: 'admin.tenant@example.gov.cm',
  tenantId: 'tenant-1',
  orgUnitId: 'org-1',
  mustChangePassword: false,
};

export async function bootstrapTenantAdminSession(page: Page) {
  await page.addInitScript((profile) => {
    sessionStorage.setItem('access_token', 'mock-access-token');
    sessionStorage.setItem('refresh_token', 'mock-refresh-token');
    sessionStorage.setItem('token', 'mock-access-token');
    sessionStorage.setItem('user_profile', JSON.stringify(profile));
  }, TENANT_ADMIN_PROFILE);

  await page.route('**/api/v1/tenants/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'tenant-1',
        name: 'Ministère des Finances',
        short_name: 'MINFI',
        domain: 'minfi.gov.cm',
      }),
    });
  });

  await page.route('**/api/v1/notifications/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}
