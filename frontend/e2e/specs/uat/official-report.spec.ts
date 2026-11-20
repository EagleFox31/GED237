import { readFileSync } from 'node:fs';

import { test, expect } from '../../fixtures/uat.fixture';

/** Copie officielle numérotée, registre et réimpression (#161), programmation (#180). */
test.describe('Copie officielle', () => {
  test('émettre une copie HTML puis la réimprimer depuis le registre', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('button', { name: 'Copie officielle', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Copie officielle' });

    await dialog.getByRole('button', { name: 'Page web' }).click();
    await expect(dialog.getByRole('button', { name: 'Page web' })).toHaveAttribute('aria-pressed', 'true');
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
    await expect(row).toContainText('Page web');
    const reprinted = page.waitForEvent('download');
    await row.getByRole('button', { name: `Réimprimer ${number}` }).click();
    expect((await reprinted).suggestedFilename()).toBe(first.suggestedFilename());
    await expect(status).toHaveText(`Copie réimprimée : ${number}`);
  });

  test('programmation désactivée : onglet masqué, onglets au clavier, focus gardé, Échap ferme', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('reports');
    const opener = page.getByRole('button', { name: 'Copie officielle', exact: true });
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Copie officielle' });

    // Le focus entre dans le dialogue et Tab ne le fait pas sortir.
    await expect(dialog.locator(':focus')).toHaveCount(1);
    for (let i = 0; i < 12; i += 1) await page.keyboard.press('Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);

    // La pile e2e laisse SCHEDULED_REPORTS_ENABLED à false (défaut) : GET /schedules répond
    // `X-Scheduled-Reports-Enabled: false`, donc l'onglet « Programmés » n'apparaît pas.
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
    await expect(opener).toBeFocused();
  });

  test('double clic sur « Émettre la copie » : une seule copie demandée', async ({ page, loginAs }) => {
    let posts = 0;
    await page.route(/\/api\/v1\/reports\/official\/?(\?|$)/, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      posts += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: {
          'Content-Disposition': 'attachment; filename="copie.csv"',
          'X-Report-Number': encodeURIComponent('N° 0001/2026/TEST'),
          'Access-Control-Expose-Headers': 'Content-Disposition, X-Report-Number',
        },
        body: 'a;b\n',
      });
    });
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('button', { name: 'Copie officielle', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Copie officielle' });

    await dialog.getByRole('button', { name: 'Émettre la copie' }).dblclick();
    await expect(dialog.getByRole('status')).toHaveText('Copie émise : N° 0001/2026/TEST');
    expect(posts).toBe(1);
  });

  test('programmation active : « Arrêter » demande une confirmation sur la ligne', async ({ page, loginAs }) => {
    const deleted: string[] = [];
    await page.route(/\/api\/v1\/reports\/official\/schedules(\/[^/?]+)?\/?(\?|$)/, async (route) => {
      const request = route.request();
      if (request.method() === 'DELETE') {
        deleted.push(request.url());
        return route.fulfill({ status: 204 });
      }
      if (request.method() !== 'GET') return route.fallback();
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Scheduled-Reports-Enabled': 'true',
          'Access-Control-Expose-Headers': 'X-Scheduled-Reports-Enabled',
        },
        body: JSON.stringify([
          {
            id: 'sch-1',
            name: 'Bilan mensuel',
            frequency: 'monthly',
            request: { kind: 'evolution', format: 'pdf' },
            is_active: true,
            created_at: '2026-11-01T08:00:00Z',
          },
        ]),
      });
    });
    await loginAs('tenant_admin');
    await page.goto('reports');
    await page.getByRole('button', { name: 'Copie officielle', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Copie officielle' });

    await dialog.getByRole('tab', { name: 'Programmés' }).click();
    const row = dialog.getByRole('list', { name: 'Rapports programmés' }).getByRole('listitem', { name: 'Bilan mensuel' });
    await expect(row).toContainText('Chaque mois · Évolution · PDF');

    // Premier clic : rien n'est supprimé, la ligne demande confirmation ; « Non » annule.
    await row.getByRole('button', { name: 'Arrêter Bilan mensuel' }).click();
    await expect(row).toContainText('Arrêter ce rapport ?');
    await row.getByRole('button', { name: 'Non' }).click();
    expect(deleted).toEqual([]);

    await row.getByRole('button', { name: 'Arrêter Bilan mensuel' }).click();
    await row.getByRole('button', { name: 'Confirmer l’arrêt de Bilan mensuel' }).click();
    await expect(dialog.getByRole('status')).toHaveText('Arrêté : Bilan mensuel');
    await expect(row).toHaveCount(0);
    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toMatch(/\/schedules\/sch-1$/);
  });
});
