import { test, expect, apiAs } from '../fixtures/uat.fixture';

/**
 * #262 (#250) et #179 (#151) — Renommer puis reclasser un document écrit deux entrées d'audit,
 * « Modification du document » et « Reclassement ». Ces entrées s'affichent en français, sans code
 * d'action, sans identifiant et sans JSON, sur les deux écrans qui les montrent :
 * - le journal d'audit (/audit, auditeur) ;
 * - la frise « Historique du document » de la revue de classement (admin institution).
 * Les deux modifications passent par PATCH /documents/{id}, comme les écrans de rangement.
 * La frise de revue dépend de #309 (libellés de ces deux actions).
 */

const RAW_CODES = /\b(reclassify|document_updated|classification_[a-z_]+|logical_space_path)\b/;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const JSON_DUMP = /\{"|":\s*[[{"]/;

test.describe('Journal : renommage et reclassement en français (#262, #179)', () => {
  test('deux entrées lisibles, au journal d’audit et dans la frise de revue', async ({
    page, request, loginAs, adminApi, runId,
  }) => {
    // Données propres au passage : un document sans règle reste « à classer », donc en revue.
    const domain = await adminApi.createDomain(`aud-upd-${runId}`, `Courrier ${runId}`);
    const activity = await adminApi.createActivity(domain.id, `aud-upda-${runId}`, `Arrivée ${runId}`);
    const doc = await adminApi.uploadDocument(`zz-renomme-${runId}.txt`, `Brouillon ${runId}`, `Audit ${runId}`);
    expect(doc.org_unit_id, 'le document est rattaché au service du déposant').toBeTruthy();

    const newTitle = `Courrier reçu ${runId}`;
    await adminApi.updateDocument(doc.id, { title: newTitle });
    await adminApi.updateDocument(doc.id, {
      classification_domain_id: domain.id,
      classification_activity_id: activity.id,
      classification_year: 2026,
      classification_scope: 'service',
      classification_target_org_unit_id: doc.org_unit_id,
    });

    // API : une entrée par modification, avec son libellé français.
    const auditorApi = await apiAs(request, 'auditor');
    const entries = (await auditorApi.auditLogs({ table_name: 'documents', limit: '500' }))
      .filter((e) => e.record_id === doc.id);
    const byAction = (action: string) => entries.filter((e) => e.action === action);
    expect(byAction('document_updated'), 'une entrée pour le renommage').toHaveLength(1);
    expect(byAction('reclassify'), 'une entrée pour le reclassement').toHaveLength(1);
    expect(byAction('document_updated')[0].action_label).toBe('Modification du document');
    expect(byAction('reclassify')[0].action_label).toBe('Reclassement');

    // Journal d'audit (/audit) : les deux lignes du document, lisibles.
    await loginAs('auditor');
    const logsLoaded = page.waitForResponse((r) => /\/audit\/logs/.test(r.url()) && r.request().method() === 'GET');
    await page.goto('audit');
    expect((await logsLoaded).status()).toBe(200);
    const docRows = page.locator('tbody tr').filter({ hasText: newTitle });
    await expect(docRows.filter({ hasText: 'Modification du document' })).toHaveCount(1);
    await expect(docRows.filter({ hasText: 'Reclassement' })).toHaveCount(1);
    for (const text of await docRows.allInnerTexts()) {
      expect(text, 'ligne du journal').not.toMatch(RAW_CODES);
      expect(text, 'ligne du journal').not.toMatch(UUID);
      expect(text, 'ligne du journal').not.toMatch(JSON_DUMP);
    }

    // Frise de la revue de classement : mêmes actions, détail lisible.
    await loginAs('tenant_admin');
    await page.goto('classification-reviews');
    await page.getByRole('button', { name: new RegExp(newTitle) }).click();
    await expect(page.getByText('Historique du document')).toBeVisible();
    await expect(page.getByText('Modification du document', { exact: true })).toBeVisible();
    await expect(page.getByText(`renommé en « ${newTitle} »`)).toBeVisible();
    await expect(page.getByText('Reclassement', { exact: true })).toBeVisible();
    const pageText = await page.locator('body').innerText();
    expect(pageText, 'page de revue').not.toMatch(RAW_CODES);
    expect(pageText, 'page de revue').not.toMatch(JSON_DUMP);
  });
});
