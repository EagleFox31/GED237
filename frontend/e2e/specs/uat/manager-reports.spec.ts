import { test, expect, API_URL, apiLogin } from '../../fixtures/uat.fixture';

/**
 * Rapports du Manager : entrée de menu et données limitées à son service.
 * Les compteurs de toute l'institution (/analytics/tenant, /documents/stats, /workflows/stats)
 * et les revues de classement ne doivent jamais être demandés depuis le profil Manager.
 */
const TENANT_WIDE = /\/(analytics\/tenant|documents\/stats|workflows\/stats|classification-reviews)\/?$/;

type ServiceActivity = { services: Array<{ id: string }> };

test.describe('Rapports — profil Manager', () => {
  test('menu Rapports, aucun compteur de toute l’institution', async ({ page, loginAs }) => {
    const tenantWideCalls: string[] = [];
    page.on('request', (r) => {
      if (TENANT_WIDE.test(new URL(r.url()).pathname)) tenantWideCalls.push(r.url());
    });

    await loginAs('manager');
    const services = page.waitForResponse((r) => r.url().includes('/reports/service-activity') && r.ok());
    await page.getByRole('button', { name: 'Rapports' }).click();
    await expect(page).toHaveURL(/\/reports/);
    await services;

    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Synthèse/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Générer un rapport/ })).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    expect(tenantWideCalls).toEqual([]);
  });

  test('portée : le Manager ne voit que son service et ses sous-services', async ({ request }) => {
    const get = async (role: 'manager' | 'tenant_admin') => {
      const token = await apiLogin(request, role);
      const res = await request.get(`${API_URL}/reports/service-activity`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok(), `service-activity ${role}`).toBeTruthy();
      return ((await res.json()) as ServiceActivity).services.map((s) => s.id);
    };
    const manager = await get('manager');
    const admin = await get('tenant_admin');

    expect(manager.length).toBeGreaterThan(0);
    expect(manager.length).toBeLessThan(admin.length);
    for (const id of manager) expect(admin).toContain(id);
  });

  test('administrateur : synthèse et compteurs de l’institution inchangés', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    const tenantCall = page.waitForRequest((r) => new URL(r.url()).pathname.endsWith('/analytics/tenant'));
    await page.goto('reports');
    await tenantCall;
    await expect(page.getByRole('tab', { name: /Synthèse/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Générer un rapport/ })).toBeVisible();
  });
});
