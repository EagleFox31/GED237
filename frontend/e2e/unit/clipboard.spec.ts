import { test, expect } from '@playwright/test';
import { copyText } from '../../lib/clipboard';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Copie dans le presse-papiers', () => {
  test('utilise l\'ancienne commande quand elle réussit, sans appeler l\'API moderne', async () => {
    const ok = await copyText('abc', {
      writeText: async () => { throw new Error('ne doit pas servir'); },
      legacyCopy: (t) => t === 'abc',
    });
    expect(ok).toBe(true);
  });

  test('utilise l\'API moderne quand l\'ancienne commande échoue', async () => {
    const copied: string[] = [];
    const ok = await copyText('abc', {
      writeText: async (t) => { copied.push(t); },
      legacyCopy: () => false,
    });
    expect(ok).toBe(true);
    expect(copied).toEqual(['abc']);
  });

  test('les deux tentatives partent dans le geste de clic, avant toute attente (Firefox)', () => {
    const calls: string[] = [];
    // Aucun `await` ici : ce qui n'est pas appelé de façon synchrone n'apparaît pas dans `calls`.
    void copyText('abc', {
      legacyCopy: () => { calls.push('legacy'); return false; },
      writeText: () => { calls.push('writeText'); return Promise.resolve(); },
    });
    expect(calls).toEqual(['legacy', 'writeText']);
  });

  test('ancienne commande seule (page en HTTP, sans API moderne)', async () => {
    expect(await copyText('abc', { legacyCopy: () => true })).toBe(true);
  });

  test('renvoie false quand aucune méthode ne marche, sans lever', async () => {
    expect(await copyText('abc', {})).toBe(false);
    expect(await copyText('abc', { legacyCopy: () => false })).toBe(false);
    expect(await copyText('abc', { legacyCopy: () => { throw new Error('x'); } })).toBe(false);
    expect(await copyText('abc', { legacyCopy: () => false, writeText: async () => { throw new Error('refusé'); } })).toBe(false);
    expect(await copyText('abc', { writeText: () => { throw new Error('synchrone'); } })).toBe(false);
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
