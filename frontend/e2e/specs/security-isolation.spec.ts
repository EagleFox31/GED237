import { test, expect } from '../fixtures/auth.fixture';

/**
 * SC-SEC-03/04 — Séparation des pouvoirs (SC-SEC-01/02 = cloisonnement service / tenant, P5)
 *
 *   - SC-SEC-03a : un rédacteur ne peut pas lire les policies (GET /authz/policies → 403)
 *   - SC-SEC-03b : un collaborateur ne peut pas écrire les policies (403 backend même en contournant l'UI)
 *   - SC-SEC-04a : un lecteur ne voit ni upload ni suppression
 *   - SC-SEC-04b : un auditeur ne peut pas déposer de document (403)
 *
 * On teste via appels HTTP authentifiés en récupérant le token depuis
 * sessionStorage après login, puis en appelant directement l'API.
 */
test.describe('Feature: Isolation & Séparation des pouvoirs (SC-SEC-03/04)', () => {

  const API = process.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  const getToken = async (page: any): Promise<string | null> => {
    return page.evaluate(() => sessionStorage.getItem('access_token'));
  };

  test('SC-SEC-03a — Given rédacteur, When GET /authz/policies, Then 403', async ({ loginAs, page, request }) => {
    await loginAs('collaborator');
    const token = await getToken(page);
    expect(token, 'Le token doit être présent après login').toBeTruthy();

    const res = await request.get(`${API}/authz/policies`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('SC-SEC-04a — Given lecteur, When /documents, Then aucun bouton d\'upload/suppression', async ({ loginAs, page }) => {
    await loginAs('reader');
    await page.goto('documents');
    await page.waitForLoadState('networkidle');

    // Pas de bouton de dépôt visible. Le menu « Ranger / Importer » (rangement local, aucun envoi
    // au serveur) est de la navigation, pas un dépôt : le sélecteur vise donc le bouton de dépôt.
    const uploadVisible = await page.getByRole('button', { name: /nouveau document|téléverser|upload/i }).first().isVisible().catch(() => false);
    expect(uploadVisible).toBeFalsy();

    // Pas de bouton de suppression visible
    const deleteVisible = await page.getByRole('button', { name: /supprimer|delete/i }).first().isVisible().catch(() => false);
    expect(deleteVisible).toBeFalsy();
  });

  test('SC-SEC-03b — Given collaborateur, When POST /authz/policies, Then 403', async ({ loginAs, page, request }) => {
    await loginAs('collaborator');
    const token = await getToken(page);
    expect(token).toBeTruthy();

    const res = await request.post(`${API}/authz/policies`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        ptype: 'p',
        v0: 'collaborator',
        v1: 'tenants',
        v2: 'delete',
      },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('SC-SEC-04b — Given auditor, When POST /documents (upload), Then 403', async ({ loginAs, page, request }) => {
    await loginAs('auditor');
    const token = await getToken(page);
    expect(token).toBeTruthy();

    const res = await request.post(`${API}/documents`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: {
        title: 'Tentative auditeur',
        doc_type: 'Note',
        file: { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
      },
    });
    expect([401, 403, 405]).toContain(res.status());
  });
});
