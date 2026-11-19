import { test, expect } from '@playwright/test';
import { deltaLabel, isEmpty, linePath, summarize } from '../../lib/trend';

// Spec pur : exécuté par `npm run test:unit`.
const pts = (...v: number[]) => v.map((value, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, value }));

test.describe('Tendance : calculs', () => {
  test('résumé : dernière valeur et sens', () => {
    expect(summarize([])).toEqual({ latest: null, delta: null, direction: 'none' });
    expect(summarize(pts(4)).direction).toBe('none');
    expect(summarize(pts(3, 5))).toEqual({ latest: 5, delta: 2, direction: 'up' });
    expect(summarize(pts(5, 3)).direction).toBe('down');
    expect(summarize(pts(5, 5)).direction).toBe('flat');
  });

  test('vide : aucun point ou que des zéros', () => {
    expect(isEmpty([])).toBe(true);
    expect(isEmpty(pts(0, 0))).toBe(true);
    expect(isEmpty(pts(0, 1))).toBe(false);
  });

  test('tracé : part de 0, bornes respectées', () => {
    expect(linePath([], 100, 40)).toBe('');
    expect(linePath(pts(0, 10), 100, 40, 2)).toBe('M2.0 38.0 L98.0 2.0');
    expect(linePath(pts(7), 100, 40, 2)).toBe('M50.0 2.0');
  });

  test('libellé : français simple', () => {
    expect(deltaLabel(summarize(pts(3, 5)))).toBe('+2 sur la période précédente');
    expect(deltaLabel(summarize(pts(5, 3)))).toBe('−2 sur la période précédente');
    expect(deltaLabel(summarize(pts(5, 5)))).toBe('Stable');
    expect(deltaLabel(summarize(pts(5)))).toBe('Pas assez de recul');
  });
});
