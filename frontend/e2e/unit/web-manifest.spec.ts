import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Spec pur : exécuté par `npm run test:unit`. Le manifeste doit rester valable sous /edossier/.
const root = process.cwd(); // frontend/ : les scripts npm s'exécutent depuis ce dossier
const manifest = JSON.parse(readFileSync(join(root, 'public', 'manifest.webmanifest'), 'utf8'));

test.describe('Manifeste de l\'application installable', () => {
  test('start_url et scope sont relatifs (donc sous /edossier/), affichage fenêtre', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
  });

  test('icônes 192 et 512 présentes dans public/, sans adresse externe', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    manifest.icons.forEach((i: { src: string }) => {
      expect(i.src).not.toMatch(/^(https?:)?\/\//);
      expect(existsSync(join(root, 'public', i.src))).toBe(true);
    });
  });

  test('index.html déclare le manifeste et la couleur du thème', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="%BASE_URL%manifest.webmanifest">');
    expect(html).toContain('<meta name="theme-color"');
  });
});
