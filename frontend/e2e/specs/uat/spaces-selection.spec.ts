import { test, expect } from '../../fixtures/uat.fixture';

test.describe('Explorateur — sélection multiple (#150)', () => {
  test('Ctrl+clic, Maj+clic, Ctrl+A sélectionnent plusieurs documents et affichent le compteur et le bilan', async ({
    page,
    loginAs,
    adminApi,
    runId,
  }) => {
    const t1 = `Sel-1-${runId}`;
    const t2 = `Sel-2-${runId}`;
    const t3 = `Sel-3-${runId}`;
    await adminApi.uploadDocument(`sel1-${runId}.txt`, t1, `A ${runId}`);
    await adminApi.uploadDocument(`sel2-${runId}.txt`, t2, `B ${runId}`);
    await adminApi.uploadDocument(`sel3-${runId}.txt`, t3, `C ${runId}`);

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);

    const r1 = page.getByRole('row', { name: new RegExp(t1) });
    const r2 = page.getByRole('row', { name: new RegExp(t2) });
    const r3 = page.getByRole('row', { name: new RegExp(t3) });
    await expect(r1).toBeVisible();
    await expect(r2).toBeVisible();
    await expect(r3).toBeVisible();

    await r1.click();
    await expect(page.getByText('1 sélectionné')).toBeVisible();

    await r3.click({ modifiers: ['Shift'] });
    await expect(page.getByText('3 sélectionnés')).toBeVisible();

    await r2.click({ modifiers: ['Control'] });
    await expect(page.getByText('2 sélectionnés')).toBeVisible();

    await r1.focus();
    await page.keyboard.press('Control+a');
    await expect(page.getByText('3 sélectionnés')).toBeVisible();

    // Les brouillons ne peuvent pas être archivés : l'action groupée doit afficher le bilan des échecs.
    await page.getByRole('button', { name: 'Archiver la sélection' }).click();
    await expect(page.getByTestId('explorer-bulk-summary')).toContainText('échec');
  });
});
