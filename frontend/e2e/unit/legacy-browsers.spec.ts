import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BROWSER_TARGETS } from '../../browserTargets';

// Spec pur : exécuté par `npm run test:unit`.
// Garde-fous pour les navigateurs anciens (postes Windows 7 : Chrome 109, Firefox 115 ESR).
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SKIP = new Set(['node_modules', 'dist', 'e2e', 'test-results', 'playwright-report']);

function sourceFiles(dir = ROOT, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(p);
  }
  return out;
}

test.describe('Navigateurs anciens', () => {
  test('chaque hauteur en unité dvh a un repli en vh', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const text = readFileSync(file, 'utf8');
      const rel = relative(ROOT, file).replace(/\\/g, '/');
      // Mots de classe Tailwind (ou valeurs CSS) contenant une unité dvh.
      const tokens = new Set(text.split(/[\s'"`{};,]+/));
      for (const token of tokens) {
        if (!/\d+dvh/.test(token)) continue;
        const GUARD = 'supports-[height:100dvh]:';
        const rest = token.startsWith(GUARD) ? token.slice(GUARD.length) : null;
        const fallback = rest?.replace(/dvh/g, 'vh');
        if (!rest || !fallback || !tokens.has(fallback)) offenders.push(`${rel}: ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('index.html affiche un message clair quand le navigateur ne lit pas les modules', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const match = html.match(/<script nomodule>([\s\S]*?)<\/script>/);
    const code = match?.[1];
    expect(code, 'script nomodule absent').toBeDefined();
    if (code === undefined) return;
    // Le script doit tourner sous IE 8 (livré avec Windows 7) : ES5, sans les API arrivées après IE 8,
    // et des tailles en px (IE 8 ne lit pas rem).
    expect(code).not.toMatch(/=>|`|\b(let|const|class)\b/);
    expect(code).not.toMatch(/addEventListener|forEach|JSON\.|querySelector|textContent|classList/);
    expect(code).not.toMatch(/\d(rem|vh|vw)\b/);
    const root = { innerHTML: '' };
    new Function('document', code)({ getElementById: (id: string) => (id === 'root' ? root : null) });
    expect(root.innerHTML).toContain('navigateur');
    expect(root.innerHTML).toContain('Chrome');
  });

  test('la cible de build couvre Chrome 109 et Firefox 115 ESR (Windows 7)', () => {
    const floor = (name: string) => {
      const t = BROWSER_TARGETS.find((x) => x.startsWith(name));
      expect(t, `cible ${name} absente`).toBeDefined();
      return Number(t!.slice(name.length));
    };
    expect(floor('chrome')).toBeLessThanOrEqual(109);
    expect(floor('edge')).toBeLessThanOrEqual(109);
    expect(floor('firefox')).toBeLessThanOrEqual(115);
    const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    expect(vite).toMatch(/target:\s*BROWSER_TARGETS/);
  });

  test('.browserslistrc suit la même cible que le build', () => {
    const lines = readFileSync(join(ROOT, '.browserslistrc'), 'utf8')
      .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const fromTargets = BROWSER_TARGETS.map((t) => {
      const [, name, version] = t.match(/^([a-z]+)(\d+)$/)!;
      return `${name} >= ${version}`;
    });
    expect(lines.sort()).toEqual(fromTargets.sort());
  });
});
