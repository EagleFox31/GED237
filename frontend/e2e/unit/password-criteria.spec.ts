import { test, expect } from '@playwright/test';
import { allPasswordCriteriaMet, passwordCriteria } from '../../lib/passwordCriteria';

test('mot de passe conforme : tous les critères sont remplis', () => {
  expect(allPasswordCriteriaMet('Abcdefghij12!')).toBe(true);
});

test('chaque critère manquant bloque la validation', () => {
  for (const pwd of ['Abcdef12!', 'abcdefghij12!', 'Abcdefghijkl!', 'Abcdefghij123']) {
    expect(allPasswordCriteriaMet(pwd), pwd).toBe(false);
  }
});

test('la garde et l\'affichage partagent la même source', () => {
  const pwd = 'Abcdef12!';
  const shown = passwordCriteria(pwd);
  expect(shown).toHaveLength(4);
  expect(allPasswordCriteriaMet(pwd)).toBe(shown.every((c) => c.ok));
});
