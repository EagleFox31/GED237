import { test, expect } from '../../fixtures/auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { SEED } from '../../data/seed';

/**
 * Lots V1.1 reouverts avant le gel (DEC-2026-002, GO PO du 10/11) : un scenario court par lot,
 * en fixme jusqu'a la PR du lot. Lever le fixme = remplacer le corps et supprimer test.fixme.
 * Matrice : gestion-projet/innovateur/matrice-recette.md section 6. Livre si fusionne le 19/11 18:00, sinon V1.1.
 *
 * Le projet Playwright `smoke` ne cite pas ce fichier : a ajouter au testMatch quand un lot est livre.
 */
test.describe('Feature: Lots V1.1 (SC-V11-01..05)', () => {
  test.fixme('SC-V11-01 - Given un doublon refuse a l\'upload ou a l\'import, When l\'admin ouvre le tableau de bord, Then le compteur de doublons detectes a augmente de 1', async () => {});

  // Contrat #79 : GET /classification-rules/rules/export, POST .../rules/import?dry_run&mode.
  // Les references sont des codes ; import tout-ou-rien ; un second import converge (0 ecriture).
  test.describe('SC-V11-02 - export / import des regles', () => {
    const API_URL = process.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const RULES = `${API_URL}/classification-rules/rules`;
    const CODE = 'e2e_v11_transfer';

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
      const admin = await token(request, { matricule: 'MINFI001', password: 'Minfi@2025' });
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

      const reader = await token(request, { matricule: 'READ001', password: 'Read@2025' });
      const denied = await request.post(`${RULES}/import`, { headers: reader, data: { format: base.format, version: 1, rules: [] } });
      expect(denied.status(), 'lecteur : import interdit').toBe(403);
    });
  });

  test.fixme('SC-V11-03 - Given un journal d\'audit avec des evenements, When l\'auditeur l\'exporte, Then le fichier contient les evenements du filtre ; Given 3 OTP errones, When un 4e essai, Then le compte est verrouille avec un message explicite', async () => {});

  test.fixme('SC-V11-04 - Given une regle "mots-cles dans le texte OCR" ou "date", When un document correspondant est importe, Then il est classe a la destination de la regle et la simulation le montre avant activation', async () => {});

  test.fixme('SC-V11-05 - Given un dossier surveille, When un fichier y est depose, Then il apparait importe/classe sans action de l\'utilisateur, et un fichier deja connu est refuse comme doublon', async () => {});
});
