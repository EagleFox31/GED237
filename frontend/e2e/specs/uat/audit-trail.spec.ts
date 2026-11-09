import { test, expect, apiAs } from '../../fixtures/uat.fixture';

/**
 * UAT — P7 « Journal d'audit : qui a fait quoi » (gestion-projet/innovateur/parcours-demo.md).
 * SC-AUD-01 (auditeur, /audit) et SC-ADM-09 (même écran, filtres par colonne).
 * SC-AUD-02 (export du journal) est hors périmètre : reporté en V1.1 (arbitrage D4 du 2026-11-09).
 *
 * La spec produit elle-même la trace qu'elle recherche (revue résolue par l'administrateur) :
 * elle ne dépend ni de l'ordre d'exécution ni des autres parcours.
 * Écran réel : /audit (AuditLogs) charge GET /audit/logs?limit=200 puis filtre côté client
 * via les en-têtes de DataTable (« Filtrer <colonne> » → cases à cocher).
 */

const D3_NOT_AUDITED =
  'Défaut D3 : ni la connexion, ni le dépôt, ni l’import ne créent d’entrée audit_logs ' +
  '(seuls review_resolved, content_viewed, dup_detected, corbeille et versions sont tracés). ' +
  'Correctif backend prévu le 2026-11-12 : réactiver ce test à sa livraison.';

test.describe('P7 — Journal d’audit (SC-AUD-01, SC-ADM-09)', () => {
  test('l’auditeur retrouve l’action de l’administrateur, avec auteur et date, et filtre par auteur et par action', async ({
    page,
    request,
    loginAs,
    adminApi,
    runId,
  }) => {
    // Trace produite : un document sans règle ouvre une revue, que l'administrateur résout.
    const domain = await adminApi.createDomain(`uat-aud-${runId}`, `Audit UAT ${runId}`);
    const activity = await adminApi.createActivity(domain.id, `uat-auda-${runId}`, `Contrôle UAT ${runId}`);
    const title = `Pièce auditée ${runId}`;
    const doc = await adminApi.uploadDocument(`zz-audit-${runId}.txt`, title, `Audit ${runId}`);
    const review = (await adminApi.listReviews()).find((r) => r.document_id === doc.id);
    expect(review, 'une revue est ouverte pour le document non classé').toBeTruthy();
    await adminApi.resolveReview(review!.id, {
      domainId: domain.id,
      activityId: activity.id,
      year: 2026,
      comment: `Recette P7 ${runId}`,
    });

    // Côté API, avec le jeton de l'auditeur : l'entrée existe, avec auteur et horodatage.
    const auditorApi = await apiAs(request, 'auditor');
    const entries = await auditorApi.auditLogs({ table_name: 'documents', action: 'review_resolved', limit: '500' });
    const entry = entries.find((e) => e.record_id === doc.id);
    expect(entry, 'entrée review_resolved pour le document').toBeTruthy();
    expect(entry!.user_name, 'auteur identifié').toBeTruthy();
    expect(entry!.created_at, 'horodatage présent').toBeTruthy();
    const actor = entry!.user_name!;

    const history = await auditorApi.documentAuditLogs(doc.id);
    expect(history.map((h) => h.action)).toContain('review_resolved');

    // Côté écran : /audit en auditeur.
    await loginAs('auditor');
    const logsLoaded = page.waitForResponse((r) => /\/audit\/logs/.test(r.url()) && r.request().method() === 'GET');
    await page.goto('audit');
    expect((await logsLoaded).status()).toBe(200);

    const rows = page.locator('tbody tr');
    const row = rows.filter({ hasText: title });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(actor);
    await expect(row).toContainText(entry!.action_label || 'review_resolved');

    // Filtre « Effectuée par » : seules les actions de cet auteur restent.
    await page.getByRole('button', { name: /^Filtrer Effectuée par/ }).click();
    await page.getByRole('checkbox', { name: actor, exact: true }).check();
    await page.keyboard.press('Escape');
    await expect(row).toHaveCount(1);
    await expect(rows.filter({ hasNotText: actor })).toHaveCount(0);

    // Filtre « Action » : l'arbitrage reste visible.
    await page.getByRole('button', { name: /^Filtrer Action/ }).click();
    await page.getByRole('checkbox', { name: entry!.action_label || 'review_resolved', exact: true }).check();
    await page.keyboard.press('Escape');
    await expect(row).toHaveCount(1);
  });

  test('lecture seule : un dépôt tenté par l’auditeur est refusé (403)', async ({ request, runId }) => {
    const auditorApi = await apiAs(request, 'auditor');
    const res = await auditorApi.tryUpload(`auditeur-${runId}.txt`, `Interdit ${runId}`, `Auditeur ${runId}`);
    expect(res.status()).toBe(403);
  });

  test('connexion et dépôt de document sont tracés avec leur auteur', async ({ request, adminApi, runId }) => {
    test.fixme(true, D3_NOT_AUDITED);
    const doc = await adminApi.uploadDocument(`depot-trace-${runId}.txt`, `Dépôt tracé ${runId}`, `Trace ${runId}`);
    const auditorApi = await apiAs(request, 'auditor');
    const entries = await auditorApi.auditLogs({ limit: '500' });
    expect(entries.some((e) => e.record_id === doc.id && e.user_name)).toBe(true);
    expect(entries.some((e) => /login/i.test(e.action))).toBe(true);
  });
});
