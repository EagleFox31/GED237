import { test, expect, API_URL, apiAs } from '../../fixtures/uat.fixture';

/**
 * #153 : une seule file de validation, lue par /tasks (onglets), l'accueil Manager et les assignations.
 * La pile e2e active WORKFLOW_INBOX_ENABLED ; le mode repli (route 404) est forcé par un stub réseau.
 */
test.describe('File de validation unifiée', () => {
  test('« À moi » : l’étape confiée au manager est dans sa file', async ({ page, request, loginAs, adminApi, runId }) => {
    const manager = await (await apiAs(request, 'manager')).me();
    const title = `Visa file ${runId}`;
    const doc = await adminApi.uploadDocument(`visa-file-${runId}.txt`, title, `Visa ${runId}`);
    await adminApi.submitForVisa(doc.id, manager.id, `Visa ${runId}`);

    await loginAs('manager');
    await page.goto('tasks');
    await expect(page.getByRole('tab', { name: /À moi/ })).toHaveAttribute('aria-selected', 'true');
    const card = page.getByLabel(title, { exact: true });
    await expect(card).toBeVisible();
    await expect(card.getByRole('button', { name: 'Valider' })).toBeVisible();
  });

  test('« Mon unité » et « Sans validateur » selon les droits', async ({ page, request, loginAs, adminApi, adminToken, runId }) => {
    const probe = await request.get(`${API_URL}/workflows/inbox?scope=mine`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    test.skip(probe.status() === 404, 'file unifiée désactivée sur ce serveur (WORKFLOW_INBOX_ENABLED=false)');

    const manager = await (await apiAs(request, 'manager')).me();
    const title = `Unité file ${runId}`;
    const doc = await adminApi.uploadDocument(`unite-file-${runId}.txt`, title, `Unité ${runId}`);
    await adminApi.submitForVisa(doc.id, manager.id, `Visa unité ${runId}`);

    await loginAs('tenant_admin');
    await page.goto('tasks?file=unit');
    await expect(page.getByRole('tab', { name: /Mon unité/ })).toHaveAttribute('aria-selected', 'true');
    const card = page.getByLabel(title, { exact: true });
    await expect(card).toBeVisible();
    // Étape d'un autre : visible, sans décision possible ici.
    await expect(card.getByText('En attente')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Valider' })).toHaveCount(0);

    await page.getByRole('tab', { name: /Sans validateur/ }).click();
    await expect(page).toHaveURL(/[?&]file=unassigned/);
    await expect(card).toHaveCount(0);
  });

  test('repli : file unifiée absente (404), anciennes routes sans erreur', async ({ page, request, loginAs, adminApi, runId }) => {
    const manager = await (await apiAs(request, 'manager')).me();
    const title = `Repli file ${runId}`;
    const doc = await adminApi.uploadDocument(`repli-file-${runId}.txt`, title, `Repli ${runId}`);
    await adminApi.submitForVisa(doc.id, manager.id, `Visa repli ${runId}`);

    // Simule un serveur où WORKFLOW_INBOX_ENABLED=false.
    await page.route('**/workflows/inbox?**', (route) => route.fulfill({ status: 404, json: { detail: 'Not Found' } }));
    await loginAs('manager');
    await page.goto('tasks?file=unit');
    await expect(page.getByRole('tab', { name: /À moi/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: /Mon unité/ })).toHaveCount(0);
    const card = page.getByLabel(title, { exact: true });
    await expect(card.getByRole('button', { name: 'Valider' })).toBeVisible();
    await expect(page.getByText('Impossible de charger cette file.')).toHaveCount(0);
  });

  test('collaborateur : seulement « À moi »', async ({ page, loginAs }) => {
    await loginAs('collaborator');
    await page.goto('tasks?file=unassigned');
    await expect(page.getByRole('tab', { name: /À moi/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Mon unité/ })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Sans validateur/ })).toHaveCount(0);
  });
});
