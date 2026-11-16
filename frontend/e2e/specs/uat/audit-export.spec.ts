import { readFileSync } from 'node:fs';
import { test, expect } from '../../fixtures/uat.fixture';

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
    await page.getByRole('button', { name: 'Exporter (CSV)' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    const bytes = readFileSync((await download.path())!);
    expect([...bytes.subarray(0, 3)], 'BOM UTF-8').toEqual([0xef, 0xbb, 0xbf]);
    const firstLine = bytes.toString('utf-8').replace(/^﻿/, '').split(/\r?\n/)[0];
    expect(firstLine, 'en-tête séparé par des points-virgules').toContain(';');
  });
});
