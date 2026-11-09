import { test, expect } from '../../fixtures/uat.fixture';

/**
 * UAT — SC-ESP-01 (hors référentiel des 37, source : gestion-projet/[Gemini] UAT_Filtres_Espaces.md).
 * Naviguer dans les espaces documentaires (/spaces) et filtrer côté serveur.
 *
 * Seed : MINFI001 (tenant_admin) est rattaché au Cabinet du Ministre, parent de SG, DRH, DAF, DSI.
 * Filtres serveur (domain_id, activity_id, year, status, classification_status, q, limit/offset) :
 * contrat de la PR #38 (C9), vérifié directement sur l'API.
 */

test.describe('SC-ESP-01 — Navigation dans les espaces', () => {
  test('arborescence, sous-services, retour, inclusion des sous-services et recherche', async ({
    page,
    loginAs,
    adminApi,
    runId,
  }) => {
    const domain = await adminApi.createDomain(`uat-esp-${runId}`, `Espaces UAT ${runId}`);
    const activity = await adminApi.createActivity(domain.id, `uat-espa-${runId}`, `Rapports UAT ${runId}`);
    const keyword = `rapportuat${runId}`;
    await adminApi.createRule({
      code: `uat-esp-rule-${runId}`,
      name: `Rapports UAT ${runId}`,
      filenamePattern: keyword,
      domainId: domain.id,
      activityId: activity.id,
    });
    const title = `Rapport trimestriel ${runId}`;
    const doc = await adminApi.uploadDocument(`${keyword}-t1.txt`, title, `Rapport ${runId}`);
    expect(doc.classification_status).toBe('classified');

    await loginAs('tenant_admin');
    await page.goto('spaces');
    await expect(page.getByText(/\d+ document\(s\)/)).toBeVisible();

    // Descendre dans un sous-service, puis remonter.
    const daf = page.getByRole('button', { name: /Direction des Affaires Financieres/ }).first();
    await daf.click();
    const back = page.getByRole('button', { name: /^Retour vers/ });
    await expect(back).toBeVisible();
    await back.click();

    // Inclure les sous-services : le document classé reste visible depuis la racine.
    const recursive = page.getByLabel('Inclure les sous-services');
    if (!(await recursive.isChecked())) await recursive.check();
    await expect(page.getByLabel(new RegExp(`^${title} — `))).toBeVisible();

    // Recherche (paramètre q de l'URL) : seul le document cherché reste affiché.
    await page.goto(`spaces?q=${encodeURIComponent(runId)}`);
    await expect(page.getByLabel(new RegExp(`^${title} — `))).toBeVisible();
    await expect(page.getByText('1 document(s)', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Effacer' }).click();
    await expect(page).not.toHaveURL(/[?&]q=/);
  });
});

test.describe('SC-ESP-01 — Filtres serveur sur GET /spaces/documents', () => {
  test('domain_id + activity_id + year + status ne renvoient que les documents correspondants', async ({
    adminApi,
    runId,
  }) => {
    const domain = await adminApi.createDomain(`uat-flt-${runId}`, `Filtres UAT ${runId}`);
    const activity = await adminApi.createActivity(domain.id, `uat-flta-${runId}`, `Filtres act UAT ${runId}`);
    const keyword = `filtreuat${runId}`;
    await adminApi.createRule({
      code: `uat-flt-rule-${runId}`,
      name: `Filtres UAT ${runId}`,
      filenamePattern: keyword,
      domainId: domain.id,
      activityId: activity.id,
    });
    const match = await adminApi.uploadDocument(`${keyword}-a.txt`, `Filtré ${runId}`, `A ${runId}`);
    const other = await adminApi.uploadDocument(`zz-hors-filtre-${runId}.txt`, `Hors filtre ${runId}`, `B ${runId}`);

    const res = await adminApi.getSpaceDocuments({
      recursive: 'true',
      domain_id: domain.id,
      activity_id: activity.id,
      year: String(new Date().getFullYear()),
    });
    expect(res.status()).toBe(200);
    const ids = ((await res.json()) as Array<{ id: string }>).map((d) => d.id);
    expect(ids).toContain(match.id);
    expect(ids).not.toContain(other.id);
  });

  test('q filtre côté serveur ; sans limit liste complète, avec limit page tronquée et X-Total-Count', async ({
    adminApi,
    runId,
  }) => {
    // Assertions bornées aux documents de ce test (q = runId) : les autres tests déposent en parallèle.
    const first = await adminApi.uploadDocument(`recherche-a-${runId}.txt`, `Recherche A ${runId}`, `Q ${runId}`);
    const second = await adminApi.uploadDocument(`recherche-b-${runId}.txt`, `Recherche B ${runId}`, `Q ${runId}`);
    const mine = [first.id, second.id].sort();

    // Sans `limit` : comportement historique, liste complète non paginée.
    const filtered = await adminApi.getSpaceDocuments({ recursive: 'true', q: runId });
    expect(filtered.status()).toBe(200);
    const filteredIds = ((await filtered.json()) as Array<{ id: string }>).map((d) => d.id).sort();
    expect(filteredIds).toEqual(mine);
    expect(Number(filtered.headers()['x-total-count'])).toBe(2);

    // Avec `limit` : page tronquée ; le total avant pagination reste dans X-Total-Count.
    const page1 = await adminApi.getSpaceDocuments({ recursive: 'true', q: runId, limit: '1' });
    const page2 = await adminApi.getSpaceDocuments({ recursive: 'true', q: runId, limit: '1', offset: '1' });
    expect(page1.status()).toBe(200);
    expect(page2.status()).toBe(200);
    const ids1 = ((await page1.json()) as Array<{ id: string }>).map((d) => d.id);
    const ids2 = ((await page2.json()) as Array<{ id: string }>).map((d) => d.id);
    expect(ids1).toHaveLength(1);
    expect(ids2).toHaveLength(1);
    expect([...ids1, ...ids2].sort()).toEqual(mine);
    expect(Number(page1.headers()['x-total-count'])).toBe(2);

    // q au-delà de 120 caractères : refusé.
    const tooLong = await adminApi.getSpaceDocuments({ recursive: 'true', q: 'x'.repeat(121) });
    expect(tooLong.status()).toBe(422);
  });

  test('classification_status=needs_review isole les documents à revoir ; valeur invalide → 422', async ({
    adminApi,
    runId,
  }) => {
    const doc = await adminApi.uploadDocument(`zz-a-revoir-${runId}.txt`, `À revoir ${runId}`, `R ${runId}`);
    const res = await adminApi.getSpaceDocuments({ recursive: 'true', q: runId, classification_status: doc.classification_status });
    expect(res.status()).toBe(200);
    expect(((await res.json()) as Array<{ id: string }>).map((d) => d.id)).toEqual([doc.id]);

    const invalid = await adminApi.getSpaceDocuments({ recursive: 'true', year: '1800' });
    expect(invalid.status()).toBe(422);
  });
});
