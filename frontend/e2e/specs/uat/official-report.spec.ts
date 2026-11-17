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

  test('programmation désactivée : onglet masqué, onglets au clavier, Échap ferme', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('button', { name: 'Copie officielle' }).click();
    const dialog = page.getByRole('dialog', { name: 'Copie officielle' });

    // SCHEDULED_REPORTS_ENABLED vaut false par défaut : le serveur l'annonce, l'onglet n'apparaît pas.
    const tabs = dialog.getByRole('tab');
    await expect(tabs).toHaveText(['Émettre', 'Registre']);

    const issueTab = dialog.getByRole('tab', { name: 'Émettre' });
    await issueTab.focus();
    await page.keyboard.press('ArrowRight');
    const registerTab = dialog.getByRole('tab', { name: 'Registre' });
    await expect(registerTab).toBeFocused();
    await expect(registerTab).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('tabpanel', { name: 'Registre' })).toBeVisible();
    await expect(dialog.getByText('Chargement…')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});
