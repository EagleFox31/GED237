// Spec pur (npm run test:unit) : persistance de l'onglet actif dans l'URL sur `/rules` (`?tab=`).
import { test, expect } from '@playwright/test';
import {
  DEFAULT_GED_RULES_TAB,
  needsGedRulesTabCorrection,
  readGedRulesTab,
  writeGedRulesTab,
} from '../../lib/gedRulesTab';

test.describe('Onglet actif dans l URL (/rules)', () => {
  test('ouvre l onglet par défaut quand ?tab= est absent ou inconnu', () => {
    expect(readGedRulesTab(new URLSearchParams(''))).toBe(DEFAULT_GED_RULES_TAB);
    expect(readGedRulesTab(new URLSearchParams('tab='))).toBe(DEFAULT_GED_RULES_TAB);
    expect(readGedRulesTab(new URLSearchParams('tab=inconnu'))).toBe(DEFAULT_GED_RULES_TAB);
  });

  test('détecte les URL sans ?tab= ou avec une valeur inconnue à corriger en replace', () => {
    expect(needsGedRulesTabCorrection(new URLSearchParams(''))).toBe(true);
    expect(needsGedRulesTabCorrection(new URLSearchParams('tab='))).toBe(true);
    expect(needsGedRulesTabCorrection(new URLSearchParams('tab=inconnu'))).toBe(true);

    expect(needsGedRulesTabCorrection(new URLSearchParams('tab=categories'))).toBe(false);
    expect(needsGedRulesTabCorrection(new URLSearchParams('tab=rules'))).toBe(false);
    expect(needsGedRulesTabCorrection(new URLSearchParams('tab=simulator'))).toBe(false);
  });

  test('lit et valide chaque onglet reconnu', () => {
    expect(readGedRulesTab(new URLSearchParams('tab=categories'))).toBe('categories');
    expect(readGedRulesTab(new URLSearchParams('tab=templates'))).toBe('templates');
    expect(readGedRulesTab(new URLSearchParams('tab=rules'))).toBe('rules');
    expect(readGedRulesTab(new URLSearchParams('tab=simulator'))).toBe('simulator');
  });

  test('écrit ?tab= tout en préservant les autres paramètres', () => {
    const step1 = writeGedRulesTab(new URLSearchParams('foo=1'), 'rules');
    expect(step1.get('tab')).toBe('rules');
    expect(step1.get('foo')).toBe('1');

    const step2 = writeGedRulesTab(step1, 'simulator');
    expect(step2.get('tab')).toBe('simulator');
    expect(step2.get('foo')).toBe('1');

    const backDefault = writeGedRulesTab(step2, 'categories');
    expect(backDefault.get('tab')).toBe('categories');
    expect(backDefault.get('foo')).toBe('1');
  });
});
