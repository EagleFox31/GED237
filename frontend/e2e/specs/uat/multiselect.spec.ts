import { test, expect } from '../../fixtures/uat.fixture';

/**
 * #150 : sélection multiple dans l'explorateur (Ctrl+clic, Maj+clic, Ctrl+A, Échap),
 * corbeille groupée et « Annuler » qui restaure tout le lot.
 */
test.describe('Explorateur : sélection multiple', () => {
  test('Ctrl+clic puis corbeille groupée, « Annuler » restaure le lot', async ({ page, loginAs, adminApi, runId }) => {
    const titles = [`Lot A ${runId}`, `Lot B ${runId}`, `Lot C ${runId}`];
    for (const [index, title] of titles.entries()) {
      await adminApi.uploadDocument(`lot-${index}-${runId}.txt`, title, `Lot ${index} ${runId}`);
    }

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    const item = (title: string) => page.getByLabel(new RegExp(`^${title} — `));
    await expect(item(titles[2]!)).toBeVisible();

    await item(titles[0]!).click({ modifiers: ['ControlOrMeta'] });
    await item(titles[2]!).click({ modifiers: ['ControlOrMeta'] });
    const bar = page.getByRole('toolbar', { name: 'Sélection' });
    await expect(bar.getByRole('status')).toHaveText('2 sélectionnés');
    await expect(item(titles[0]!)).toHaveAccessibleName(/ — sélectionné$/);
    // Ctrl+clic ne doit pas ouvrir l'aperçu.
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await bar.getByRole('button', { name: 'Mettre à la corbeille' }).click();
    await expect(item(titles[0]!)).toHaveCount(0);
    await expect(item(titles[2]!)).toHaveCount(0);
    await expect(item(titles[1]!)).toBeVisible();
    await expect(bar).toHaveCount(0);

    const toast = page.getByRole('status').filter({ hasText: '2 documents mis à la corbeille' });
    await toast.getByRole('button', { name: 'Annuler' }).click();
    await expect(item(titles[0]!)).toBeVisible();
    await expect(item(titles[2]!)).toBeVisible();
  });

  test('clavier : Ctrl+A, Échap, Ctrl+Espace puis Suppr', async ({ page, loginAs, adminApi, runId }) => {
    const titles = [`Clavier A ${runId}`, `Clavier B ${runId}`];
    for (const [index, title] of titles.entries()) {
      await adminApi.uploadDocument(`clavier-${index}-${runId}.txt`, title, `Clavier ${index} ${runId}`);
    }

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    const item = (title: string) => page.getByLabel(new RegExp(`^${title} — `));
    const status = page.getByRole('toolbar', { name: 'Sélection' }).getByRole('status');

    await item(titles[0]!).focus();
    await page.keyboard.press('ControlOrMeta+a');
    await expect(status).toHaveText('2 sélectionnés');
    await page.keyboard.press('Escape');
    await expect(status).toHaveCount(0);

    await page.keyboard.press('ControlOrMeta+Space');
    await expect(status).toHaveText('1 sélectionné');
    await page.keyboard.press('Delete');
    await expect(item(titles[0]!)).toHaveCount(0);
    await expect(item(titles[1]!)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: `« ${titles[0]} » mis à la corbeille` })).toBeVisible();
  });

  test('Maj+clic sélectionne la plage affichée', async ({ page, loginAs, adminApi, runId }) => {
    const titles = [`Plage A ${runId}`, `Plage B ${runId}`, `Plage C ${runId}`];
    for (const [index, title] of titles.entries()) {
      await adminApi.uploadDocument(`plage-${index}-${runId}.txt`, title, `Plage ${index} ${runId}`);
    }

    await loginAs('tenant_admin');
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    const items = page.getByLabel(new RegExp(`^Plage [ABC] ${runId} — `));
    await expect(items).toHaveCount(3);

    // L'ordre affiché (plus récent d'abord) fait foi : on clique le premier puis le dernier.
    await items.first().click({ modifiers: ['ControlOrMeta'] });
    await items.last().click({ modifiers: ['Shift'] });
    await expect(page.getByRole('toolbar', { name: 'Sélection' }).getByRole('status')).toHaveText('3 sélectionnés');

    await page.getByRole('button', { name: 'Désélectionner' }).click();
    await expect(page.getByRole('toolbar', { name: 'Sélection' })).toHaveCount(0);
  });
});
