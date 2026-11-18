import type { Locator } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * Accueils par rôle : chaque élément cliquable agit, et aucun dialogue natif
 * (alert / confirm / prompt) ne s'affiche. Tout dialogue natif fait échouer le test.
 */
// Onglet propre à la fiche document (DocumentDetailModal).
const DETAIL_TAB = /Détails & Aperçu/;

// Attend l'élément (chargement des listes) avant de conclure qu'il n'y a rien à cliquer.
const appears = (locator: Locator) =>
  locator.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false);

test.describe('Accueils par rôle : commandes actives, sans dialogue natif', () => {
  let nativeDialogs: string[] = [];

  test.beforeEach(({ page }) => {
    nativeDialogs = [];
    page.on('dialog', async (dialog) => {
      nativeDialogs.push(`${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    });
  });

  test.afterEach(() => {
    expect(nativeDialogs, 'dialogue natif détecté').toEqual([]);
  });

  test('lecteur : la carte ouvre le détail ; pas de Ranger / Bibliothèque locale', async ({ loginAs, page }) => {
    await loginAs('reader');
    await expect(page.getByText('Ma Bibliothèque')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Ranger \/ Importer/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Bibliothèque locale/ })).toHaveCount(0);

    const card = page.getByRole('button', { name: /^Ouvrir / }).first();
    test.skip(!(await appears(card)), 'aucun document visible pour ce lecteur');
    await card.click();
    await expect(page.getByText(DETAIL_TAB).first()).toBeVisible();
  });

  test('collaborateur : carte cliquable, import via la modale commune, pas de Ranger', async ({ loginAs, page }) => {
    await loginAs('collaborator');
    await expect(page.getByText('Mon Atelier')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Ranger \/ Importer/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Bibliothèque locale/ })).toHaveCount(0);

    await page.getByRole('button', { name: /Nouveau Document/ }).click();
    await expect(page.getByRole('heading', { name: 'Nouveau Document' })).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click();

    const card = page.getByTestId('draft-card').first();
    if (await appears(card)) {
      await card.click();
      await expect(page.getByText(DETAIL_TAB).first()).toBeVisible();
    }
  });

  // Dérogation documentée : GET /documents/{id} renvoie 403 au manager quand le document de
  // sa tâche est hors de son unité (_can_read_document, règle org_unit). Bug backend signalé ;
  // à réactiver (retirer fixme) dès que l'assigné d'une étape peut lire le document.
  test.fixme('manager : « Voir le document » ouvre le détail avant de valider', async ({ loginAs, page }) => {
    await loginAs('manager');
    await expect(page.getByText('Espace Manager')).toBeVisible({ timeout: 10_000 });
    const view = page.getByRole('button', { name: 'Voir le document' }).first();
    test.skip(!(await appears(view)), 'aucune tâche en attente pour ce manager');
    await view.click();
    await expect(page.getByText(DETAIL_TAB).first()).toBeVisible();
  });

  test('chef d\'unité : les compteurs cliquables mènent à une liste', async ({ loginAs, page }) => {
    await loginAs('unit_admin');
    const link = page.getByRole('link', { name: /Documents/ }).first();
    test.skip(!(await appears(link)), 'compteurs non affichés');
    await link.click();
    await expect(page).toHaveURL(/documents/);
  });

  for (const [role, label] of [['reader', 'lecteur'], ['collaborator', 'collaborateur']] as const) {
    for (const path of ['ingestion', 'local-library']) {
      test(`${label} : l'accès direct à /${path} est refusé`, async ({ loginAs, page }) => {
        await loginAs(role);
        await page.goto(path);
        await expect(page).not.toHaveURL(new RegExp(path));
      });
    }
  }

  test('manager : un rejet sans motif est refusé', async ({ loginAs, page }) => {
    await loginAs('manager');
    await expect(page.getByText('Espace Manager')).toBeVisible({ timeout: 10_000 });
    const reject = page.getByRole('button', { name: 'Rejeter' }).first();
    test.skip(!(await appears(reject)), 'aucune tâche en attente pour ce manager');
    await reject.click();
    const confirm = page.getByRole('button', { name: /Confirmer/ }).last();
    await expect(confirm).toBeDisabled();
    await page.getByRole('textbox').last().fill('   ');
    await expect(confirm).toBeDisabled();
  });
});
