import { readFileSync } from 'node:fs';
import { test, expect, apiAs } from '../../fixtures/uat.fixture';

/**
 * V1.1 lot 3a — export du journal d'audit (SC-AUD-02), écran /audit.
 * Fichier CSV au format Excel FR : BOM UTF-8 et séparateur « ; ».
 */
test.describe('Journal d’audit — export CSV (V1.1 lot 3a)', () => {
  test('l’auditeur télécharge le journal au format CSV', async ({ page, loginAs }) => {
    await loginAs('auditor');
    await page.goto('audit');
    await expect(page.getByText('Registre Des Actions')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    const exportButton = page.getByRole('button', { name: 'Exporter (CSV)' });
    // Infobulle alignée sur le libellé : c'est un CSV, pas un classeur Excel.
    await expect(exportButton).toHaveAttribute('title', 'Télécharger le journal (fichier CSV)');
    await exportButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const bytes = readFileSync((await download.path())!);
    expect([...bytes.subarray(0, 3)], 'BOM UTF-8').toEqual([0xef, 0xbb, 0xbf]);
    const firstLine = bytes.toString('utf-8').replace(/^﻿/, '').split(/\r?\n/)[0];
    expect(firstLine, 'en-tête séparé par des points-virgules').toContain(';');
  });
});

test.describe('Journal d’audit — filtre « Effectuée par » côté serveur', () => {
  test('deux acteurs cochés : seulement leurs lignes, à l’écran et dans l’export', async ({ page, loginAs, request, runId }) => {
    // Chaque acteur laisse une trace récente : il figure dans la liste des acteurs proposés.
    const names: string[] = [];
    const auditor = await apiAs(request, 'auditor');
    for (const role of ['tenant_admin', 'collaborator'] as const) {
      const agent = await apiAs(request, role);
      const { id } = await agent.me();
      await agent.uploadDocument(`acteur-${role}-${runId}.txt`, `Acteur ${runId}`, `Trace acteur ${role} ${runId}`);
      const entry = (await auditor.auditLogs({ limit: '500' })).find((e) => e.user_id === id && e.user_name);
      expect(entry, `trace de ${role}`).toBeTruthy();
      names.push(entry!.user_name!);
    }
    const [first, second] = names as [string, string];

    await loginAs('auditor');
    await page.goto('audit');
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    await page.getByRole('button', { name: /^Filtrer Effectuée par/ }).click();
    await page.getByRole('checkbox', { name: first, exact: true }).check();
    const filtered = page.waitForResponse(
      (r) => /\/audit\/logs\?/.test(r.url()) && new URL(r.url()).searchParams.getAll('user_id').length === 2,
    );
    await page.getByRole('checkbox', { name: second, exact: true }).check();
    expect((await filtered).status(), 'le serveur reçoit les deux acteurs').toBe(200);
    await page.keyboard.press('Escape');

    await expect(rows.filter({ hasText: first }).first()).toBeVisible();
    await expect(rows.filter({ hasText: second }).first()).toBeVisible();
    await expect(rows.filter({ hasNotText: first }).filter({ hasNotText: second })).toHaveCount(0);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter (CSV)' }).click();
    const csv = readFileSync((await (await downloadPromise).path())!).toString('utf-8').replace(/^﻿/, '');
    const users = new Set(
      csv.split(/\r?\n/).slice(1).filter(Boolean).map((line) => line.split(';')[2]),
    );
    expect([...users].sort()).toEqual([first, second].sort());
  });
});
