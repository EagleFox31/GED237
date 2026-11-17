import { test, expect, API_URL } from '../../fixtures/uat.fixture';

/**
 * #162 : onglet Qualité des rapports (documents incomplets par indicateur).
 * #183 : alertes de qualité ; un 409 (alertes désactivées sur le serveur) s'affiche tel quel dans le formulaire.
 */
test.describe('Rapports — qualité documentaire', () => {
  test('un document sans catégorie apparaît sous « Sans catégorie »', async ({ page, loginAs, adminApi, runId }) => {
    const title = `Qualité ${runId}`;
    await adminApi.uploadDocument(`qualite-${runId}.txt`, title, `Qualité ${runId}`);

    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();
    await expect(page.getByText('Documents complets')).toBeVisible();

    await page.getByRole('button', { name: /Sans catégorie/ }).click();
    const list = page.getByRole('list', { name: 'Documents : Sans catégorie' });
    await expect(list.getByText(title, { exact: true })).toBeVisible();
  });

  test('alerte refusée (409) : message du serveur dans le formulaire', async ({ page, loginAs }) => {
    const detail = 'Les alertes qualité sont désactivées sur ce serveur.';
    await page.route('**/analytics/quality/alerts', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 409, json: { detail } })
        : route.fallback(),
    );
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();

    const form = page.getByRole('form', { name: 'Nouvelle alerte' });
    await form.getByLabel("Nom de l'alerte").fill('Refusée');
    await form.getByLabel('Indicateur').selectOption('missing_category');
    await form.getByLabel('Seuil', { exact: true }).fill('5');
    await form.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByRole('alert').filter({ hasText: detail })).toBeVisible();
  });

  test('créer puis arrêter une alerte', async ({ page, request, loginAs, adminToken, runId }) => {
    // Sonde : le corps est validé avant le contrôle d'activation, il doit donc être valide ; supprimée aussitôt.
    const headers = { Authorization: `Bearer ${adminToken}` };
    const probe = await request.post(`${API_URL}/analytics/quality/alerts`, {
      headers,
      data: { name: `sonde ${runId}`, indicator: 'missing_year', measure: 'count', threshold: 1 },
    });
    if (probe.status() === 201) {
      await request.delete(`${API_URL}/analytics/quality/alerts/${(await probe.json()).id}`, { headers });
    }
    test.skip(probe.status() === 409, 'alertes qualité désactivées sur ce serveur (QUALITY_ALERTS_ENABLED=false)');

    const name = `Alerte ${runId}`;
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('tab', { name: /Qualité/ }).click();

    const form = page.getByRole('form', { name: 'Nouvelle alerte' });
    await form.getByLabel("Nom de l'alerte").fill(name);
    await form.getByLabel('Indicateur').selectOption('missing_year');
    await form.getByLabel('Seuil', { exact: true }).fill('50');
    await form.getByLabel('Unité du seuil').selectOption('rate');
    await form.getByRole('button', { name: 'Créer' }).click();

    const row = page.getByRole('list', { name: 'Mes alertes' }).getByLabel(name, { exact: true });
    await expect(row).toContainText('Sans année ≥ 50 %');
    await row.getByRole('button', { name: 'Arrêter' }).click();
    await expect(row).toHaveCount(0);
  });
});
