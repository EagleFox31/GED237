import { readFileSync } from 'node:fs';

import { test, expect } from '../../fixtures/uat.fixture';

/** Copie officielle numérotée, registre et réimpression (#161), programmation (#180). */
test.describe('Copie officielle', () => {
  test('émettre une copie HTML puis la réimprimer depuis le registre', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('button', { name: 'Copie officielle' }).click();
    const dialog = page.getByRole('dialog', { name: 'Copie officielle' });

    await dialog.getByRole('button', { name: 'html' }).click();
    await expect(dialog.getByRole('button', { name: 'html' })).toHaveAttribute('aria-pressed', 'true');
    const issued = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Émettre la copie' }).click();
    const first = await issued;
    expect(first.suggestedFilename()).toMatch(/\.html$/);

    const status = dialog.getByRole('status');
    await expect(status).toContainText('Copie émise : N°');
    const number = (await status.textContent())?.replace('Copie émise : ', '').trim() ?? '';
    expect(number).toMatch(/^N° \d{4}\/\d{4}\/\S+/);
    expect(readFileSync((await first.path())!).toString('utf-8')).toContain(number);

    await dialog.getByRole('tab', { name: 'Registre' }).click();
    const row = dialog.getByRole('list', { name: 'Registre' }).getByRole('listitem', { name: number });
    await expect(row).toBeVisible();
    const reprinted = page.waitForEvent('download');
    await row.getByRole('button', { name: `Réimprimer ${number}` }).click();
    expect((await reprinted).suggestedFilename()).toBe(first.suggestedFilename());
    await expect(status).toHaveText(`Copie réimprimée : ${number}`);
  });

  test('programmation désactivée : le refus du serveur est affiché tel quel', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('button', { name: 'Copie officielle' }).click();
    const dialog = page.getByRole('dialog', { name: 'Copie officielle' });

    await dialog.getByRole('tab', { name: 'Programmés' }).click();
    const submit = dialog.getByRole('button', { name: 'Programmer' });
    await expect(submit).toBeDisabled();
    await dialog.getByLabel('Nom').fill('Bilan mensuel');
    await submit.click();
    // SCHEDULED_REPORTS_ENABLED vaut false par défaut : 409 avec ce detail.
    await expect(page.getByText('Les rapports programmés sont désactivés sur ce serveur.')).toBeVisible();
    await expect(dialog.getByRole('list', { name: 'Rapports programmés' })).toHaveCount(0);
  });
});
