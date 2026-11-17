import { test, expect } from '@playwright/test';

import {
  chainEntries,
  errorStatus,
  hierarchyErrorMessage,
  teamCountLabel,
  type HierarchyPerson,
} from '../../lib/hierarchy';

const person = (n: number): HierarchyPerson => ({ id: `id-${n}`, full_name: `Chef ${n}`, matricule: `M${n}` });

test.describe('Rattachement : chaîne des chefs', () => {
  test('jusqu’à 3 chefs, tout est visible, dans l’ordre N+1, N+2, N+3', () => {
    const entries = chainEntries([person(1), person(2), person(3)], false);
    expect(entries.map((e) => (e.kind === 'person' ? `${e.person.full_name}/N+${e.level}` : '…'))).toEqual([
      'Chef 1/N+1',
      'Chef 2/N+2',
      'Chef 3/N+3',
    ]);
  });

  test('au-delà de 3, les intermédiaires se replient, puis se déplient', () => {
    const chain = [person(1), person(2), person(3), person(4), person(5)];
    const folded = chainEntries(chain, false);
    expect(folded).toHaveLength(3);
    expect(folded[1]).toEqual({ kind: 'more', count: 3 });
    expect(folded[2]).toMatchObject({ kind: 'person', level: 5 });
    expect(chainEntries(chain, true)).toHaveLength(5);
  });

  test('aucune chaîne : aucune entrée', () => {
    expect(chainEntries([], false)).toEqual([]);
  });
});

test.describe('Rattachement : textes', () => {
  test('compteur de l’équipe', () => {
    expect(teamCountLabel(1)).toBe('1 personne');
    expect(teamCountLabel(4)).toBe('4 personnes');
  });

  test('message selon le code, jamais le texte du serveur', () => {
    expect(hierarchyErrorMessage(404)).toBe('Agent introuvable.');
    expect(hierarchyErrorMessage(500)).toBe('Rattachement indisponible pour le moment.');
    expect(hierarchyErrorMessage(undefined)).toBe('Rattachement indisponible pour le moment.');
    // « Mon équipe » : un 404 (rôle hors périmètre avant #285) ne parle pas d'« agent ».
    expect(hierarchyErrorMessage(404, 'self')).toBe('Rattachement indisponible pour le moment.');
    expect(errorStatus({ status: 404 })).toBe(404);
    expect(errorStatus(new Error('réseau'))).toBeUndefined();
  });
});
