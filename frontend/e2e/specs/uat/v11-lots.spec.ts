import { test, expect, apiAs, TEST_USERS } from '../../fixtures/uat.fixture';
import type { APIRequestContext } from '@playwright/test';
import { SEED } from '../../data/seed';

/**
 * Lots V1.1 reouverts avant le gel (DEC-2026-002, GO PO du 10/11) : un scenario court par lot.
 * Les cinq lots sont fusionnes ; seul SC-V11-05 reste en fixme (worker absent de la pile E2E).
 * Matrice : gestion-projet/innovateur/matrice-recette.md section 6.
 *
 * Joue par le projet `uat` (recette nocturne), pas par `smoke`.
 * Compteurs partages par le tenant : les comparaisons sont en « au moins », car d'autres specs
 * peuvent refuser des doublons en parallele en local (la CI joue un seul worker).
 */
test.describe('Feature: Lots V1.1 (SC-V11-01..05)', () => {
  // #77, #81, #99. Volet export de SC-V11-03 (#80, #87) : le journal exporte par l'auditeur,
  // filtre sur les doublons, ne contient que des doublons refuses, dont celui-ci.
  test('SC-V11-01 - Given un doublon refuse au depot, When l\'admin ouvre le tableau de bord, Then le compteur « Doublons refuses » a augmente ; l\'export filtre de l\'auditeur le contient', async ({
    page,
    request,
    loginAs,
    adminApi,
    runId,
  }) => {
    const before = (await adminApi.tenantMetrics()).duplicates;
    const content = `SC-V11-01 ${runId} : contenu unique de ce run`;
    const title = `Doublon V11 ${runId}`;
    await adminApi.uploadDocument(`v11-doublon-${runId}.txt`, title, content);
    const again = await adminApi.tryUpload(`v11-doublon-${runId}-copie.txt`, `${title} copie`, content);
    expect(again.status(), 'meme contenu : doublon refuse').toBe(409);

    const after = (await adminApi.tenantMetrics()).duplicates;
    expect(after.refused_upload, 'compteur des depots refuses').toBeGreaterThanOrEqual(before.refused_upload + 1);
    expect(after.refused).toBe(after.refused_upload + after.refused_import);

    const auditor = await apiAs(request, 'auditor');
    const csv = await auditor.exportAuditCsv({ action: 'dup_detected', table_name: 'documents' });
    const rows = csv.replace(/^﻿/, '').split(/\r?\n/).slice(1).filter(Boolean);
    expect(rows.length, 'une ligne par doublon refuse').toBeGreaterThanOrEqual(after.refused_upload);
    for (const row of rows) expect(row.split(';'), 'export = evenements du filtre').toContain('Doublon refusé');
    expect(rows.some((row) => row.split(';').includes(title)), 'le doublon de ce run est exporte').toBe(true);

    // The tile shows the counters read after this refusal (other specs may only add to them).
    await loginAs('tenant_admin');
    await page.goto('dashboard');
    await expect(page.getByText('Doublons refusés', { exact: true })).toBeVisible();
    const trend = page.getByText(/\d+ dépôts · \d+ imports/);
    await expect(trend).toBeVisible();
    const [shownUpload = -1, shownImport = -1] = ((await trend.textContent()) ?? '').match(/\d+/g)?.map(Number) ?? [];
    expect(shownUpload, 'depots refuses affiches').toBeGreaterThanOrEqual(after.refused_upload);
    expect(shownImport, 'imports refuses affiches').toBeGreaterThanOrEqual(after.refused_import);
  });

  // Contrat #79 : GET /classification-rules/rules/export, POST .../rules/import?dry_run&mode.
  // Les references sont des codes ; import tout-ou-rien ; un second import converge (0 ecriture).
  test.describe('SC-V11-02 - export / import des regles', () => {
    const API_URL = process.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const RULES = `${API_URL}/classification-rules/rules`;

    async function token(request: APIRequestContext, user: { matricule: string; password: string }) {
      const login = await request.post(`${API_URL}/auth/login`, {
        data: { institution: SEED.tenant, matricule: user.matricule, password: user.password },
      });
      expect(login.ok(), `login ${user.matricule}: ${login.status()}`).toBeTruthy();
      const { session_token, otp } = await login.json();
      const verified = await request.post(`${API_URL}/auth/verify-otp`, { data: { session_token, otp } });
      expect(verified.ok(), `verify-otp: ${verified.status()}`).toBeTruthy();
      return { Authorization: `Bearer ${(await verified.json()).access_token}` };
    }

    test('SC-V11-02 - Given des regles, When export puis import (dry_run, apply, rejeu), Then 0 ecriture au rejeu ; le lecteur recoit 403', async ({ request }) => {
      // Unique per run: a replay on a non-empty database creates its own rule (created = 1).
      const CODE = `e2e_v11_transfer_${Date.now().toString(36)}`;
      const admin = await token(request, { matricule: 'MINFI001', password: TEST_USERS.tenant_admin.password });
      const exported = async () => {
        const res = await request.get(`${RULES}/export`, { headers: admin });
        expect(res.status(), 'export').toBe(200);
        return res.json() as Promise<{ format: string; version: number; rules: Record<string, unknown>[] }>;
      };

      const base = await exported();
      expect(base.format).toBe('ged237-classification-rules');
      expect(base.version).toBe(1);
      expect(base.rules.length, 'le seed E2E porte des regles').toBeGreaterThan(0);

      // A new, inactive rule built from an exported one (references are codes, so the file stays valid).
      const added = { ...base.rules[0], code: CODE, is_active: false };
      // Only the new rule: the seed rule E2E-RULE-DEMO has a raw (non-normalized) code, so a full-file import would collide with its normalized twin (reported to the backend).
      const file = { ...base, rules: [added] };
      const post = async (query: string, body: unknown = file) => {
        const res = await request.post(`${RULES}/import?${query}`, { headers: admin, data: body });
        expect(res.status(), `import ${query}`).toBe(200);
        return res.json() as Promise<{ dry_run: boolean; applied: boolean; created: number; updated: number; skipped: number; rejected: number }>;
      };

      const dry = await post('dry_run=true');
      expect(dry).toMatchObject({ dry_run: true, applied: false, rejected: 0 });
      expect(dry.created).toBe(1);
      expect((await exported()).rules, 'dry_run n\'ecrit rien').toHaveLength(base.rules.length);

      const applied = await post('dry_run=false');
      expect(applied).toMatchObject({ applied: true, created: 1, rejected: 0 });
      const after = await exported();
      expect(after.rules.map((r) => r.code)).toContain(CODE);
      expect(after.rules.find((r) => r.code === CODE)?.is_active).toBe(false);

      const replay = await post('dry_run=false');
      expect(replay, 'second import = 0 ecriture').toMatchObject({ created: 0, updated: 0, rejected: 0 });
      expect(replay.skipped).toBe(1);
      expect((await exported()).rules).toHaveLength(after.rules.length);

      const reader = await token(request, { matricule: 'READ001', password: TEST_USERS.reader.password });
      const denied = await request.post(`${RULES}/import`, { headers: reader, data: { format: base.format, version: 1, rules: [] } });
      expect(denied.status(), 'lecteur : import interdit').toBe(403);
    });

    test('SC-V11-02b - Given les regles du seed (codes bruts), When export puis reimport du fichier complet, Then 0 ecriture et le re-export est accepte', async ({ request }) => {
      const admin = await token(request, { matricule: 'MINFI001', password: TEST_USERS.tenant_admin.password });
      const exp = await request.get(RULES + '/export', { headers: admin });
      expect(exp.status(), 'export').toBe(200);
      const file = await exp.json();
      const count = file.rules.length;
      const run = async (query: string) => {
        const res = await request.post(RULES + '/import?' + query, { headers: admin, data: file });
        expect(res.status(), 'import ' + query).toBe(200);
        return res.json() as Promise<{ created: number; updated: number; rejected: number }>;
      };
      for (const query of ['dry_run=true', 'dry_run=false', 'dry_run=false']) {
        expect(await run(query), 'reimport ' + query).toMatchObject({ created: 0, updated: 0, rejected: 0 });
      }
      const after = await request.get(RULES + '/export', { headers: admin });
      expect((await after.json()).rules, 'pas de jumeau cree').toHaveLength(count);
    });
  });

  // SC-V11-03 n'a pas de test propre ici (pas de doublon) :
  // - export filtre : SC-V11-01 ci-dessus ; bouton « Exporter (CSV) » : uat/audit-export.spec.ts ;
  // - verrou apres 3 OTP errones : uat/auth-2fa.spec.ts, SC-AUTH-01 E3 (compte jetable).

  // #92 (API), #95 (ecran). Prefixe de nom sans chiffre : l'annee lue dans le nom doit etre celle du test.
  test('SC-V11-04 - Given une regle « mots-cles du contenu » et une regle « annee », When la simulation puis le depot, Then le document est classe a la destination de la regle', async ({
    adminApi,
    runId,
  }) => {
    const key = `vonzequatre${runId.replace(/\d/g, (d) => String.fromCharCode(97 + Number(d)))}`;
    const domain = await adminApi.createDomain(`v11d_${runId}`, `Domaine V11-04 ${runId}`);
    const activity = await adminApi.createActivity(domain.id, `v11a_${runId}`, `Activite V11-04 ${runId}`);
    const target = { domainId: domain.id, activityId: activity.id, priority: 0 };
    await adminApi.createRule({
      ...target,
      code: `v11_mots_${runId}`,
      name: `V11-04 mots-cles ${runId}`,
      filenamePattern: `${key}mots`,
      contentPattern: `${key}contrat`,
    });
    await adminApi.createRule({
      ...target,
      code: `v11_annee_${runId}`,
      name: `V11-04 annee ${runId}`,
      filenamePattern: `${key}annee`,
      yearMin: 2020,
      yearMax: 2024,
    });

    // Simulation (« Tester ») : chaque critere decide seul, avant tout depot.
    const sim = async (filename: string, content?: string) => (await adminApi.simulate(filename, content)).rule_code;
    expect(await sim(`${key}mots-note.txt`, `objet : ${key}contrat signe`), 'mot-cle present').toBe(`v11_mots_${runId}`);
    expect(await sim(`${key}mots-note.txt`, 'aucun mot attendu'), 'mot-cle absent').not.toBe(`v11_mots_${runId}`);
    expect(await sim(`${key}annee-2022.txt`), 'annee dans la plage').toBe(`v11_annee_${runId}`);
    expect(await sim(`${key}annee-2018.txt`), 'annee hors plage').not.toBe(`v11_annee_${runId}`);
    expect(await sim(`${key}annee-sans-date.txt`), 'pas d\'annee dans le nom').not.toBe(`v11_annee_${runId}`);

    // Depot reel : la regle « annee » classe a sa destination. Le volet « mots-cles » au depot attend le texte
    // extrait par le worker OCR, absent de la pile E2E : il est joue a la main pendant la recette.
    const doc = await adminApi.uploadDocument(`${key}annee-2022.txt`, `V11-04 ${runId}`, `SC-V11-04 ${runId}`);
    expect(doc.classification_status).toBe('classified');
    expect(doc.classification_domain_id).toBe(domain.id);
    expect(doc.classification_activity_id).toBe(activity.id);
  });

  test.fixme('SC-V11-05 - Given un dossier surveille, When un fichier y est depose, Then il apparait importe/classe sans action de l\'utilisateur, et un fichier deja connu est refuse comme doublon', async () => {
    // #100, #101 livres. Le passage du dossier surveille est fait par le worker Celery, absent de la pile E2E
    // (docker-compose.e2e.yml : postgres, redis, api) : preuve a la main pendant la recette.
  });
});
