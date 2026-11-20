import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Spec pur : exécuté par `npm run test:unit`.
// Garde-fou : une API plus récente que le plancher de .browserslistrc doit faire échouer le lint.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

type LintMessage = { ruleId: string | null; message: string };
type LinterLike = {
  defineRule: (name: string, rule: unknown) => void;
  verify: (code: string, config: object, options: { filename: string }) => LintMessage[];
};
const { Linter } = require('eslint') as { Linter: new () => LinterLike };
const compat = require('eslint-plugin-compat') as { rules: Record<string, unknown> };

function lint(code: string): LintMessage[] {
  const linter = new Linter();
  linter.defineRule('compat/compat', compat.rules.compat);
  // Le nom de fichier sous ROOT fait lire le .browserslistrc réel, sans réglage en double.
  return linter.verify(
    code,
    { env: { browser: true, es2022: true }, parserOptions: { ecmaVersion: 2022 }, rules: { 'compat/compat': 'error' } },
    { filename: join(ROOT, 'src', 'probe.js') },
  ).filter((m) => m.ruleId === 'compat/compat');
}

test.describe('eslint-plugin-compat', () => {
  test('la règle est active et bloquante dans .eslintrc.json', () => {
    const config = readFileSync(join(ROOT, '.eslintrc.json'), 'utf8');
    expect(config).toContain('"plugin:compat/recommended"');
    expect(config).toMatch(/"compat\/compat":\s*"error"/);
  });

  test('signale une API plus récente que le plancher (structuredClone)', () => {
    const messages = lint('structuredClone({ a: 1 });');
    expect(messages.map((m) => m.message).join('\n')).toContain('structuredClone');
  });

  test("laisse passer une API présente au plancher (fetch)", () => {
    expect(lint("fetch('/api');")).toEqual([]);
  });

  test("laisse passer une API récente gardée par if (typeof … === 'function')", () => {
    const guarded = "if (typeof crypto.randomUUID === 'function') { crypto.randomUUID(); }";
    expect(lint(guarded)).toEqual([]);
    expect(lint('crypto.randomUUID();')).not.toEqual([]);
  });
});
