import type { APIRequestContext, Locator, Page, TestInfo } from '@playwright/test';

import { test, expect } from '../fixtures/auth.fixture';
import { UatApi } from '../fixtures/uat.fixture';

// V1.2, élément 20 : fichiers glissés depuis Windows sur le dossier ouvert (PR #320).
// Hypothèse à confirmer au premier passage : /spaces sélectionne un service d'office et expose « Contenu du dossier ».

const runIdOf = (info: TestInfo) => `${Date.now().toString(36)}${info.workerIndex}${info.retry}`;

async function sessionApi(page: Page, request: APIRequestContext): Promise<UatApi> {
  const token = await page.evaluate(() => sessionStorage.getItem('access_token'));
  if (!token) throw new Error('access_token absent from sessionStorage after loginAs');
  return new UatApi(request, token);
}

type Payload = { name: string; content: string; type: string };

/** Simule un dépôt venant de l'Explorateur Windows : un DataTransfer avec de vrais File. */
async function dropFiles(zone: Locator, files: Payload[]): Promise<void> {
  const dataTransfer = await zone.evaluateHandle((_node, items) => {
    const dt = new DataTransfer();
    items.forEach((f) => dt.items.add(new File([f.content], f.name, { type: f.type })));
    return dt;
  }, files);
  await zone.dispatchEvent('dragover', { dataTransfer });
  await zone.dispatchEvent('drop', { dataTransfer });
}

test.describe('Explorateur : fichiers glissés depuis Windows (V1.2, élément 20)', () => {
  /**
   * SCENARIO: 1 puis 3 fichiers déposés sur le dossier ouvert
   *
   *   GIVEN  un admin sur l'explorateur des espaces
   *   WHEN   il dépose 1 fichier
   *   THEN   l'import existant s'ouvre, fichier et titre déjà remplis, rien n'est envoyé
   *   WHEN   il ferme puis dépose 3 fichiers
   *   THEN   la liste de 3 fichiers s'affiche avec un bouton « Envoyer 3 fichiers »
   */
  test('Given un admin, When il dépose 1 puis 3 fichiers, Then l\'import s\'ouvre pré-rempli', async ({ page, loginAs }) => {
    const runId = runIdOf(test.info());
    await loginAs('tenant_admin');
    await page.goto('spaces');
    const zone = page.getByLabel('Contenu du dossier');
    await expect(zone).toBeVisible();

    // WHEN — un fichier
    await dropFiles(zone, [{ name: `depot-${runId}.txt`, content: `un ${runId}`, type: 'text/plain' }]);

    // THEN
    await expect(page.getByRole('heading', { name: 'Nouveau Document' })).toBeVisible();
    await expect(page.getByText(`depot-${runId}.txt`)).toBeVisible();
    await page.getByRole('button', { name: 'Annuler' }).click().catch(() => page.keyboard.press('Escape'));

    // WHEN — trois fichiers
    await dropFiles(zone, [1, 2, 3].map((n) => ({ name: `lot-${runId}-${n}.txt`, content: `n${n} ${runId}`, type: 'text/plain' })));

    // THEN
    await expect(page.getByTestId('dropped-file')).toHaveCount(3);
    await expect(page.getByRole('button', { name: 'Envoyer 3 fichiers' })).toBeVisible();
  });

  /**
   * SCENARIO: un doublon est refusé fichier par fichier
   *
   *   GIVEN  un document déjà importé
   *   WHEN   l'agent dépose ce même contenu avec un nouveau fichier, puis confirme
   *   THEN   le doublon est marqué « refusé », l'autre fichier est envoyé
   */
  test('Given un doublon, When il confirme l\'import, Then le doublon est refusé et l\'autre envoyé', async ({ page, request, loginAs }) => {
    const runId = runIdOf(test.info());
    await loginAs('tenant_admin');
    const admin = await sessionApi(page, request);
    await admin.uploadDocument(`deja-${runId}.txt`, `Déjà ${runId}`, `contenu identique ${runId}`);
    await page.goto('spaces');
    const zone = page.getByLabel('Contenu du dossier');
    await expect(zone).toBeVisible();

    await dropFiles(zone, [
      { name: `copie-${runId}.txt`, content: `contenu identique ${runId}`, type: 'text/plain' },
      { name: `neuf-${runId}.txt`, content: `contenu neuf ${runId}`, type: 'text/plain' },
    ]);
    await page.getByRole('button', { name: 'Envoyer 2 fichiers' }).click();

    await expect(page.getByTestId('dropped-file').first()).toHaveAttribute('data-result', 'duplicate', { timeout: 15_000 });
    await expect(page.getByTestId('dropped-file').nth(1)).toHaveAttribute('data-result', 'done', { timeout: 15_000 });
  });

  /**
   * SCENARIO: refus sans droit d'import, et collaborateur un fichier à la fois
   *
   *   GIVEN  un lecteur sur l'explorateur
   *   WHEN   il dépose un fichier
   *   THEN   « Vous ne pouvez pas déposer ici. » et aucun import ne s'ouvre
   */
  test('Given un lecteur, When il dépose un fichier, Then le dépôt est refusé', async ({ page, loginAs }) => {
    await loginAs('reader');
    await page.goto('spaces');
    const zone = page.getByLabel('Contenu du dossier');
    await expect(zone).toBeVisible();

    await dropFiles(zone, [{ name: 'refus.txt', content: 'x', type: 'text/plain' }]);

    await expect(page.getByTestId('drop-notice')).toHaveText(/Vous ne pouvez pas déposer ici\./);
    await expect(page.getByRole('heading', { name: 'Nouveau Document' })).toHaveCount(0);
  });

  test('Given un collaborateur, When il dépose 2 fichiers, Then « Un fichier à la fois. »', async ({ page, loginAs }) => {
    await loginAs('collaborator');
    await page.goto('spaces');
    const zone = page.getByLabel('Contenu du dossier');
    await expect(zone).toBeVisible();

    await dropFiles(zone, [
      { name: 'a.txt', content: 'a', type: 'text/plain' },
      { name: 'b.txt', content: 'b', type: 'text/plain' },
    ]);

    await expect(page.getByTestId('drop-notice')).toHaveText(/Un fichier à la fois\./);
  });

  /**
   * SCENARIO: le reclassement interne n'est pas pris pour un import
   *
   *   WHEN   un glisser interne (type application/x-ged-document) est lâché sur le dossier ouvert
   *   THEN   aucun écran d'import ne s'ouvre
   */
  test('Given un glisser interne, When il est lâché, Then aucun import ne s\'ouvre', async ({ page, loginAs }) => {
    await loginAs('tenant_admin');
    await page.goto('spaces');
    const zone = page.getByLabel('Contenu du dossier');
    await expect(zone).toBeVisible();

    const dataTransfer = await zone.evaluateHandle(() => {
      const dt = new DataTransfer();
      dt.setData('application/x-ged-document', 'inconnu');
      return dt;
    });
    await zone.dispatchEvent('drop', { dataTransfer });

    await expect(page.getByRole('heading', { name: 'Nouveau Document' })).toHaveCount(0);
    await expect(page.getByTestId('dropped-file')).toHaveCount(0);
  });
});
