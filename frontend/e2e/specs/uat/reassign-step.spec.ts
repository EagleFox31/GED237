import { test, expect, apiAs } from '../../fixtures/uat.fixture';

/**
 * L12-5 (V1.1) — le valideur prévu est absent sans l'avoir annoncé : l'admin confie
 * l'étape en cours à un autre valideur depuis la fiche du document.
 * Données propres à chaque passage : le collaborateur dépose un document et le soumet au manager.
 */
test.describe('Réassigner une étape en cours', () => {
  test.slow(); // dépôt, soumission et deux connexions

  test('l\'admin confie l\'étape du manager à un autre valideur', async ({ page, loginAs, playwright }, testInfo) => {
    const request = await playwright.request.newContext();
    try {
      const admin = await apiAs(request, 'tenant_admin');
      const owner = await apiAs(request, 'collaborator');
      const managerId = (await (await apiAs(request, 'manager')).me()).id;
      const adminId = (await admin.me()).id;
      const run = `${Date.now().toString(36)}${testInfo.workerIndex}${testInfo.retry}`;
      const doc = await owner.uploadDocument(`reassign-${run}.txt`, `[E2E ${run}] Note à réassigner`, `Réassignation ${run}`);
      await owner.submitForVisa(doc.id, managerId, 'Visa du manager');
      const documentId = doc.id;

      await loginAs('tenant_admin');
      await page.goto(`documents?open=${documentId}`);
      await page.getByRole('button', { name: 'Circuit de Validation' }).click();

      await page.getByRole('button', { name: 'Réassigner' }).click();
      const dialog = page.getByRole('dialog', { name: /Confier à quelqu.un d.autre/ });
      await expect(dialog).toContainText('Visa du manager');
      const field = dialog.getByLabel('Nouveau valideur');
      await expect(field.locator(`option[value="${managerId}"]`), 'le valideur actuel n\'est pas proposé').toHaveCount(0);
      await field.selectOption(adminId);
      await dialog.getByRole('button', { name: 'Confier l’étape' }).click();
      await expect(dialog).toHaveCount(0);

      const steps = await admin.workflowSteps(documentId);
      expect(steps).toHaveLength(1);
      expect(steps[0]?.assigned_to).toBe(adminId);
      expect(steps[0]?.status, 'l\'étape reste en cours').toBe('current');
    } finally {
      await request.dispose();
    }
  });

  test('le collaborateur ne voit pas le bouton', async ({ page, loginAs, playwright }, testInfo) => {
    const request = await playwright.request.newContext();
    let documentId = '';
    try {
      const owner = await apiAs(request, 'collaborator');
      const managerId = (await (await apiAs(request, 'manager')).me()).id;
      const run = `${Date.now().toString(36)}${testInfo.workerIndex}${testInfo.retry}`;
      const doc = await owner.uploadDocument(`reassign-no-${run}.txt`, `[E2E ${run}] Note sans réassignation`, `Sans ${run}`);
      await owner.submitForVisa(doc.id, managerId, 'Visa du manager');
      documentId = doc.id;
    } finally {
      await request.dispose();
    }

    await loginAs('collaborator');
    await page.goto(`documents?open=${documentId}`);
    await page.getByRole('button', { name: 'Circuit de Validation' }).click();
    await expect(page.getByRole('heading', { name: 'Visa du manager' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Réassigner' })).toHaveCount(0);
  });
});
