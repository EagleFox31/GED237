import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Lot 8, point 4 (WCAG AA, 4.5:1 for text): the document list, the document card and the
 * validation hub no longer use slate-300/400 for text, and status badges use the -800 shades.
 * Icons (svg, material-symbols) are decorative and are not checked.
 */
const FILES = [
  'components/Documents.tsx',
  'components/DocumentDetailModal.tsx',
  'profiles/manager/pages/ValidationHub.tsx',
];

// Tailwind 3 palette values used by these screens.
const HEX: Record<string, string> = {
  white: '#ffffff',
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-400': '#94a3b8',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-800': '#166534',
  'blue-50': '#eff6ff',
  'blue-100': '#dbeafe',
  'blue-800': '#1e40af',
  'red-50': '#fef2f2',
  'red-100': '#fee2e2',
  'red-800': '#991b1b',
  'yellow-50': '#fefce8',
  'amber-800': '#92400e',
};

function channel(hex: string, start: number): number {
  const c = parseInt(hex.slice(start, start + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(color: string): number {
  const hex = HEX[color];
  if (!hex) throw new Error(`couleur inconnue : ${color}`);
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(text: string, background: string): number {
  const lighter = Math.max(luminance(text), luminance(background));
  const darker = Math.min(luminance(text), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

test('the text and badge pairs of these screens reach 4.5:1', () => {
  const pairs: [string, string][] = [
    ['slate-500', 'white'],
    ['slate-600', 'slate-50'],
    ['slate-600', 'slate-100'],
    ['green-800', 'green-50'],
    ['green-800', 'green-100'],
    ['blue-800', 'blue-50'],
    ['blue-800', 'blue-100'],
    ['red-800', 'red-50'],
    ['red-800', 'red-100'],
    ['amber-800', 'yellow-50'],
  ];
  for (const [text, background] of pairs) {
    expect(contrast(text, background), `${text} on ${background}`).toBeGreaterThanOrEqual(4.5);
  }
  // The shade that was replaced fails, so the check above means something.
  expect(contrast('slate-400', 'white')).toBeLessThan(4.5);
});

test('no slate-300/400 text and no -600 badge left in these screens', () => {
  for (const file of FILES) {
    const source = readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');
    source.split('\n').forEach((line, index) => {
      if (/<svg|material-symbols/.test(line)) return;
      expect(line, `${file}:${index + 1}`).not.toMatch(/\btext-slate-(300|400)\b/);
      expect(line, `${file}:${index + 1}`).not.toMatch(/bg-(green|blue|red|yellow)-(50|100) text-\w+-600\b/);
    });
  }
});

test('no opacity on a line that carries text (it lowers the real contrast)', () => {
  // Limit of this spec: it reads class strings only. A parent's opacity on another line, or a
  // hover: state, is not seen; disabled: states are exempt from WCAG contrast.
  for (const file of FILES) {
    const source = readFileSync(fileURLToPath(new URL(`../../${file}`, import.meta.url)), 'utf8');
    source.split('\n').forEach((line, index) => {
      if (/<svg|material-symbols|Icons\./.test(line)) return;
      if (!/\btext-(slate|white|blue|red|green|yellow|amber)/.test(line)) return;
      const withoutDisabled = line.replace(/disabled:opacity-\d+/g, '');
      expect(withoutDisabled, `${file}:${index + 1}`).not.toMatch(/(^|[\s"'`])opacity-\d+\b/);
    });
  }
});
