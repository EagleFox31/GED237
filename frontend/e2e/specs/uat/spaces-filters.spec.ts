import { test, expect } from '../../fixtures/uat.fixture';

/**
 * UAT — SC-ESP-01 (hors référentiel des 37, source : gestion-projet/[Gemini] UAT_Filtres_Espaces.md).
 * Naviguer dans les espaces documentaires (/spaces) et filtrer côté serveur.
 *
 * Seed : MINFI001 (tenant_admin) est rattaché au Cabinet du Ministre, parent de SG, DRH, DAF, DSI.
 * La navigation est testable aujourd'hui. Les filtres serveur (domain_id, activity_id, year, status, q)
 * ne sont pas encore livrés : ces tests sont en `fixme` jusqu'au contrat de ged-dev-backend.
 */

const SPACES_FILTERS_PENDING = 'Filtres serveur GET /spaces/documents non livrés (contrat en cours avec ged-dev-backend).';

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
  test.fixme(true, SPACES_FILTERS_PENDING);

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

  test('q filtre côté serveur, et l’absence de filtre garde le comportement historique', async ({ adminApi, runId }) => {
    const doc = await adminApi.uploadDocument(`recherche-${runId}.txt`, `Recherche ${runId}`, `Q ${runId}`);

    const filtered = await adminApi.getSpaceDocuments({ recursive: 'true', q: runId });
    expect(filtered.status()).toBe(200);
    const filteredIds = ((await filtered.json()) as Array<{ id: string }>).map((d) => d.id);
    expect(filteredIds).toEqual([doc.id]);

    // Sans `limit` : comportement historique, liste complète non paginée.
    const legacy = await adminApi.getSpaceDocuments({ recursive: 'true' });
    expect(legacy.status()).toBe(200);
    const legacyCount = ((await legacy.json()) as unknown[]).length;
    expect(legacyCount).toBeGreaterThan(filteredIds.length);

    // Avec `limit` : page tronquée, total avant pagination dans X-Total-Count, exposé au navigateur (CORS).
    const paged = await adminApi.getSpaceDocuments({ recursive: 'true', limit: '1' });
    expect(paged.status()).toBe(200);
    expect(((await paged.json()) as unknown[]).length).toBe(1);
    expect(Number(paged.headers()['x-total-count'])).toBe(legacyCount);
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
