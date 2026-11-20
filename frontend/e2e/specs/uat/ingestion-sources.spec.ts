import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures/uat.fixture';

/** F-NEXT-03 : écran d'administration des sources de collecte, sur l'API réelle de F-NEXT-01. */
test.describe('Sources de collecte — administration', () => {
  const SOURCES = /\/ingestion\/sources\/?$/;

  const openPage = async (page: Page) => {
    await page.goto('ingestion-sources');
    await expect(page.getByRole('heading', { name: 'Sources de collecte' })).toBeVisible();
  };

  const createSource = async (page: Page, input: { name: string; type: string; path?: string }) => {
    await page.getByRole('button', { name: 'Nouvelle source' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nouvelle source' });
    await dialog.getByLabel('Nom', { exact: true }).fill(input.name);
    await dialog.getByRole('radio', { name: input.type }).check();
    if (input.path !== undefined) await dialog.getByLabel('Dossier sur le serveur').fill(input.path);
    await dialog.getByRole('button', { name: 'Créer' }).click();
    return dialog;
  };

  test('agent : la clé s’affiche une seule fois, une nouvelle clé remplace l’ancienne', async ({ page, loginAs, runId }) => {
    const name = `Poste ${runId}`;
    await loginAs('tenant_admin');
    await openPage(page);

    await createSource(page, { name, type: 'Agent sur un poste' });
    const keyDialog = page.getByRole('dialog', { name: `Clé de l’agent « ${name} »` });
    const keyField = keyDialog.getByLabel('Clé de l’agent');
    await expect(keyField).toHaveValue(/^ged_src_/);
    const firstKey = await keyField.inputValue();
    await keyDialog.getByRole('button', { name: 'J’ai noté la clé' }).click();
    await expect(keyDialog).toHaveCount(0);

    const row = page.getByRole('listitem', { name });
    await expect(row).toContainText('Agent sur un poste');
    await expect(row.getByRole('button', { name: `Collecter ${name}` })).toHaveCount(0);
    // La clé ne reste nulle part dans la page, ni dans le stockage du navigateur.
    await expect(page.locator('body')).not.toContainText(firstKey);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain(firstKey);

    await row.getByRole('button', { name: `Nouvelle clé pour ${name}` }).click();
    await page.getByRole('button', { name: 'Créer la clé' }).click();
    await expect(keyField).toHaveValue(/^ged_src_/);
    expect(await keyField.inputValue()).not.toBe(firstKey);
  });

  test('dossier hors des emplacements autorisés : refus en clair, formulaire gardé', async ({ page, loginAs, runId }) => {
    await loginAs('tenant_admin');
    await openPage(page);
    const dialog = await createSource(page, { name: `Hors zone ${runId}`, type: 'Dossier du serveur', path: '/etc' });
    await expect(page.getByText('Dossier hors des emplacements autorisés')).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Dossier sur le serveur')).toHaveValue('/etc');
  });

  test('saisie incomplète : messages sous les champs, aucune requête', async ({ page, loginAs }) => {
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && SOURCES.test(request.url())) posts.push(request.url());
    });
    await loginAs('tenant_admin');
    await openPage(page);
    const dialog = await createSource(page, { name: '', type: 'Partage réseau' });
    await expect(dialog.getByText('Donnez un nom à la source.')).toBeVisible();
    await expect(dialog.getByText('Indiquez le dossier à collecter.')).toBeVisible();
    await dialog.getByLabel('Nom du secret de connexion (facultatif)').fill('../secret');
    await dialog.getByRole('button', { name: 'Créer' }).click();
    await expect(dialog.getByText(/sans « \.\. »/)).toBeVisible();
    expect(posts).toEqual([]);
  });

  test('collecte : résultat sur la ligne, refus 409 dit en clair', async ({ page, loginAs, runId }) => {
    const name = `Courrier ${runId}`;
    await loginAs('tenant_admin');
    await openPage(page);
    await createSource(page, { name, type: 'Dossier du serveur', path: '/data/ingest' });
    const row = page.getByRole('listitem', { name });
    await expect(row).toContainText('Jamais collectée');

    // Collecte simulée : le corpus réel de /data/ingest sert à d'autres parcours.
    let calls = 0;
    await page.route(/\/ingestion\/sources\/[^/]+\/run$/, async (route) => {
      calls += 1;
      if (calls === 1) {
        await route.fulfill({
          status: 200,
          json: {
            source_id: 'x',
            status: 'partial',
            ran_at: '2026-11-20T09:00:00Z',
            total_found: 4,
            imported: 3,
            skipped: 0,
            error_count: 1,
            errors: [],
            details: [],
          },
        });
      } else {
        await route.fulfill({ status: 409, json: { detail: 'This source is already being collected' } });
      }
    });

    await row.getByRole('button', { name: `Collecter ${name}` }).click();
    await expect(row.getByRole('status')).toHaveText('Collecte incomplète : 3 ajoutés, 0 ignoré, 1 erreur.');
    await row.getByRole('button', { name: `Collecter ${name}` }).click();
    await expect(row.getByRole('status')).toHaveText('Une collecte est déjà en cours pour cette source.');

    await row.getByRole('button', { name: `Désactiver ${name}` }).click();
    await expect(row).toContainText('Désactivée');
    await expect(row.getByRole('button', { name: `Collecter ${name}` })).toBeDisabled();
  });

  test('suppression : confirmation, les documents restent', async ({ page, loginAs, runId }) => {
    const name = `À supprimer ${runId}`;
    await loginAs('tenant_admin');
    await openPage(page);
    await createSource(page, { name, type: 'Agent sur un poste' });
    await page.getByRole('button', { name: 'J’ai noté la clé' }).click();
    const row = page.getByRole('listitem', { name });

    await row.getByRole('button', { name: `Supprimer ${name}` }).click();
    await expect(page.getByText('Les documents déjà collectés restent dans la GED.')).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: `Supprimer ${name}` }).click();
    await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(row).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Sources de collecte' })).toBeVisible();
    await expect(page.getByRole('listitem', { name })).toHaveCount(0);
  });
});
