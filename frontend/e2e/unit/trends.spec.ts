import { test, expect } from '@playwright/test';
import { isAllZero, isValidTrends, pointTitle, seriesSummary, shortDate, toPoints } from '../../lib/trends';

const weeks = ['2026-08-25', '2026-09-01', '2026-11-03', '2026-11-10'];

test('dates courtes en français', () => {
  expect(shortDate('2026-11-03')).toBe('3 nov.');
  expect(shortDate('2026-08-25')).toBe('25 août');
});

test('infobulle : semaine du ... ; la dernière est « en cours »', () => {
  expect(pointTitle(weeks, 2, 5)).toBe('Semaine du 3 nov. : 5');
  expect(pointTitle(weeks, 3, 1)).toBe('Semaine du 10 nov. : 1 (semaine en cours)');
});

test('résumé lecteur d\'écran', () => {
  expect(seriesSummary(weeks, [0, 1, 2, 5])).toBe('4 semaines, du 25 août au 10 nov. ; cette semaine : 5');
});

test('réponse valide ou non : séries alignées, nombres finis', () => {
  const ok = { scope: 'unit', weeks, series: { documents_created: [0, 0, 0, 0], visas_accepted: [0, 0, 0, 0], visas_rejected_or_returned: [0, 0, 0, 0] } };
  expect(isValidTrends(ok)).toBe(true);
  expect(isValidTrends(null)).toBe(false);
  expect(isValidTrends({ ...ok, series: { ...ok.series, visas_accepted: [1] } })).toBe(false);
  expect(isValidTrends({ ...ok, series: { ...ok.series, visas_accepted: [0, 0, 0, NaN] } })).toBe(false);
});

test('aucune courbe si tout est à zéro', () => {
  expect(isAllZero([{ values: [0, 0] }, { values: [0] }])).toBe(true);
  expect(isAllZero([{ values: [0, 1] }])).toBe(false);
});

test('points : y inversé, échelle commune, max nul sans division par zéro', () => {
  expect(toPoints([0, 5, 10], 100, 50, 10)).toEqual([[0, 50], [50, 25], [100, 0]]);
  expect(toPoints([0, 0], 100, 50, 0)).toEqual([[0, 50], [100, 50]]);
});
