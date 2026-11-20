import { test, expect } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Garde-fou de LESSON-2026-067 : le runner Playwright transforme le JSX des .tsx importés en objets
// {__pw_type:'jsx'} que react-dom ne sait pas rendre. Aucun rendu React dans e2e/unit : ni react-dom,
// ni module .tsx importé. Le rendu se vérifie dans un spec navigateur (e2e/specs).
const IMPORT = /from\s+['"]([^'"]+)['"]/g;
const UNIT_DIR = dirname(fileURLToPath(import.meta.url));

function renderingImports(dir: string, source: string): string[] {
  return [...source.matchAll(IMPORT)]
    .map((match) => match[1] ?? '')
    .filter((spec) => {
      if (/^react-dom(\/|$)/.test(spec)) return true;
      if (!spec.startsWith('.')) return false;
      const target = resolve(dir, spec);
      return target.endsWith('.tsx') || existsSync(`${target}.tsx`) || existsSync(join(target, 'index.tsx'));
    });
}

test('aucun spec de e2e/unit ne rend de composant React', () => {
  const dir = UNIT_DIR;
  const offenders = readdirSync(dir)
    // Ce fichier est exclu : son propre test d'auto-contrôle cite les imports interdits.
    .filter((name) => /\.spec\.tsx?$/.test(name) && name !== 'unit-folder-guard.spec.ts')
    .flatMap((name) => renderingImports(dir, readFileSync(join(dir, name), 'utf8')).map((spec) => `${name} : ${spec}`));
  expect(offenders).toEqual([]);
});

test('le garde-fou repère bien un rendu React', () => {
  const source = "import { renderToStaticMarkup } from 'react-dom/server';\n"
    + "import { HighlightedExcerpt } from '../../components/HighlightedExcerpt';\n"
    + "import { parseHighlight } from '../../lib/searchHighlight';\n";
  expect(renderingImports(UNIT_DIR, source)).toEqual(['react-dom/server', '../../components/HighlightedExcerpt']);
});
