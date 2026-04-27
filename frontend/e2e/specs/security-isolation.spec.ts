import { test, expect, TEST_USERS } from '../fixtures/auth.fixture';
import { LoginPage } from '../pages/login.page';

/**
 * SC-SEC-01..03 — Isolation multi-tenant et séparation des pouvoirs
 *
 *   - SC-SEC-01 : un rédacteur ne peut pas accéder aux endpoints admin (authz)
 *   - SC-SEC-02 : un lecteur ne voit ni upload ni suppression
 *   - SC-SEC-03 : un collaborateur d'un tenant ne peut pas lire les policies
 *                 globales (403 backend même en contournant l'UI)
 *
 * On teste via appels HTTP authentifiés en récupérant le token depuis
 * sessionStorage après login, puis en appelant directement l'API.
 */
test.describe('Feature: Isolation & Séparation des pouvoirs (SC-SEC-01..03)', () => {

  const API = process.env.VITE_API_URL || 'http://localhost:8000/api/v1';

  const getToken = async (page: any): Promise<string | null> => {
    return page.evaluate(() => sessionStorage.getItem('access_token'));
  };

  test('SC-SEC-01 — Given rédacteur, When GET /authz/policies, Then 403', async ({ loginAs, page, request }) => {
    await loginAs('collaborator');
    const token = await getToken(page);
    expect(token, 'Le token doit être présent après login').toBeTruthy();

    const res = await request.get(`${API}/authz/policies`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('SC-SEC-02 — Given lecteur, When /documents, Then aucun bouton d\'upload/suppression', async ({ loginAs, page }) => {
    await loginAs('reader');
    await page.goto('documents');
    await page.waitForLoadState('networkidle');

    // Pas de bouton d'import/upload visible
    const uploadVisible = await page.getByRole('button', { name: /importer|ajouter|téléverser|upload/i }).first().isVisible().catch(() => false);
    expect(uploadVisible).toBeFalsy();

    // Pas de bouton de suppression visible
    const deleteVisible = await page.getByRole('button', { name: /supprimer|delete/i }).first().isVisible().catch(() => false);
    expect(deleteVisible).toBeFalsy();
  });

  test('SC-SEC-03 — Given collaborateur, When POST /authz/policies, Then 403', async ({ loginAs, page, request }) => {
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

  test('SC-SEC-04 — Given auditor, When POST /documents (upload), Then 403', async ({ loginAs, page, request }) => {
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
