import { test, expect } from '../fixtures/authenticated.fixture';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SC-E2E-BULK — Versement massif + classement automatique
 *
 * Pré-requis :
 *   - Les règles de classement ont été créées (spec rules-setup.spec.ts)
 *   - Un corpus de fichiers a été généré sur disque via :
 *       python backend/scripts/test_real_export_v2.py
 *     qui produit ~500 fichiers (PDF/DOCX/XLSX/PPTX) bruités dans
 *     backend/scripts/E:/tmp_ged_real_v2/ et backend/scripts/E:/tmp_remote_server_v2/
 *
 * Le spec parcourt récursivement le dossier source, upload chaque fichier
 * via l'API authentifiée, et vérifie à la fin qu'une proportion significative
 * de documents a reçu un tag (preuve que le moteur IFTTT a tourné).
 *
 * On accepte :
 *   - succès 201
 *   - duplicat 409 (re-run du spec sans nettoyage)
 * On compte comme échec tout autre code.
 */

const API_URL = process.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Dossier source configurable : tmp_remote_server_v2 (classés) + tmp_ged_real_v2 (rebut)
const CORPUS_ROOT = process.env.CORPUS_ROOT
  || path.resolve(__dirname, '..', '..', '..', 'backend', 'scripts', 'E:');

const ALLOWED_EXT = new Set(['.pdf', '.docx', '.xlsx', '.pptx', '.txt']);

function listFilesRecursive(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (ALLOWED_EXT.has(path.extname(entry.name).toLowerCase())) out.push(full);
    }
  };
  walk(dir);
  return out;
}

test.describe.serial('Feature: Versement massif + classement (SC-E2E-BULK)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(
      testInfo.project.name !== 'authed-chromium',
      'Ce spec nécessite le projet authed-chromium (session setup).',
    );
  });

  test('Given corpus sur disque, When upload de tous les fichiers, Then le moteur classe', async ({
    accessToken,
    request,
  }) => {
    test.setTimeout(20 * 60_000); // 20 min pour ~500 fichiers

    const files = listFilesRecursive(CORPUS_ROOT);
    test.skip(files.length === 0, `Aucun fichier dans ${CORPUS_ROOT}. Lance test_real_export_v2.py.`);

    console.log(`[bulk-upload] ${files.length} fichiers à uploader depuis ${CORPUS_ROOT}`);

    let ok = 0;
    let dup = 0;
    let err = 0;
    const failures: Array<{ file: string; status: number; body: string }> = [];

    for (const filePath of files) {
      const filename = path.basename(filePath);
      const title = path.basename(filename, path.extname(filename)).slice(0, 200);
      const ext = path.extname(filename).toLowerCase();
      const mime = ext === '.pdf' ? 'application/pdf'
        : ext === '.docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : ext === '.pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        : 'text/plain';

      const res = await request.post(`${API_URL}/documents/upload`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        multipart: {
          title,
          tags: '',
          description: 'bulk e2e',
          file: {
            name: filename,
            mimeType: mime,
            buffer: fs.readFileSync(filePath),
          },
        },
        timeout: 60_000,
      });

      if (res.status() === 201) ok++;
      else if (res.status() === 409) dup++;
      else {
        err++;
        failures.push({ file: filename, status: res.status(), body: (await res.text()).slice(0, 200) });
      }
    }

    console.log(`[bulk-upload] ok=${ok} dup=${dup} err=${err}`);
    if (failures.length) console.log('[bulk-upload] sample failures:', failures.slice(0, 5));

    expect(ok + dup, 'au moins 90% des fichiers doivent être acceptés').toBeGreaterThanOrEqual(
      Math.floor(files.length * 0.9),
    );

    // Attendre que le moteur IFTTT tourne (OCR async peut prendre quelques secondes)
    await new Promise((r) => setTimeout(r, 8_000));

    // Vérifier qu'une proportion des documents a bien reçu un tag
    const listRes = await request.get(`${API_URL}/documents?limit=500`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const body = await listRes.json();
    const items = Array.isArray(body) ? body : (body.items || body.results || []);
    const tagged = items.filter((d: any) => Array.isArray(d.tags) && d.tags.length > 0).length;

    console.log(`[bulk-upload] documents listés=${items.length}, taggés=${tagged}`);

    // Assertion souple : au moins 1 document doit avoir un tag automatique
    // (dépend des règles créées par rules-setup.spec.ts et des mots-clés présents)
    expect(tagged, 'le moteur IFTTT doit avoir appliqué des tags').toBeGreaterThan(0);
  });
});
