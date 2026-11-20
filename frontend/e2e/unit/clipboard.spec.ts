import { test, expect } from '@playwright/test';
import { copyText } from '../../lib/clipboard';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Copie dans le presse-papiers', () => {
  test('utilise l\'API moderne quand elle répond', async () => {
    const copied: string[] = [];
    const ok = await copyText('abc', {
      writeText: async (t) => { copied.push(t); },
      legacyCopy: () => { throw new Error('ne doit pas servir'); },
    });
    expect(ok).toBe(true);
    expect(copied).toEqual(['abc']);
  });

  test('retombe sur l\'ancienne commande quand l\'API moderne refuse', async () => {
    const ok = await copyText('abc', {
      writeText: async () => { throw new Error('refusé'); },
      legacyCopy: (t) => t === 'abc',
    });
    expect(ok).toBe(true);
  });

  test('retombe sur l\'ancienne commande quand l\'API moderne manque (page en HTTP)', async () => {
    expect(await copyText('abc', { legacyCopy: () => true })).toBe(true);
  });

  test('renvoie false quand aucune méthode ne marche, sans lever', async () => {
    expect(await copyText('abc', {})).toBe(false);
    expect(await copyText('abc', { legacyCopy: () => false })).toBe(false);
    expect(await copyText('abc', { legacyCopy: () => { throw new Error('x'); } })).toBe(false);
  });

  test('aucun appel direct à navigator.clipboard hors du helper', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { dirname, join, relative } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const skip = new Set(['node_modules', 'dist', 'e2e', 'test-results', 'playwright-report']);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (skip.has(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        const rel = relative(root, p).replace(/\\/g, '/');
        if (rel === 'lib/clipboard.ts') continue;
        if (/navigator\.clipboard/.test(readFileSync(p, 'utf8'))) offenders.push(rel);
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
