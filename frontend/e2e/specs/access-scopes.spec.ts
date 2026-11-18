import { test, expect } from '@playwright/test';
import {
  SCOPE_LABEL,
  accessScopeChangeError,
  applyScopeUpdate,
  parseAccessScopes,
  scopeOptions,
  type AccessScopeRow,
} from '../../lib/accessScopes';

const manager: AccessScopeRow = {
  role: 'manager',
  resource: 'documents',
  scope: 'unit',
  default: 'unit',
  ceiling: 'unit_tree',
  overridden: false,
};

test('quatre libellés en langage simple', () => {
  expect(Object.values(SCOPE_LABEL)).toEqual([
    'Ses documents',
    'Son unité',
    'Son unité et ses sous-unités',
    "Toute l'institution",
  ]);
});

test('la valeur par défaut est annotée et les niveaux au-dessus du plafond sont grisés', () => {
  const opts = scopeOptions(manager);
  expect(opts.map((o) => o.label)).toEqual([
    'Ses documents',
    'Son unité (par défaut)',
    'Son unité et ses sous-unités',
    "Toute l'institution",
  ]);
  expect(opts.map((o) => o.disabled)).toEqual([false, false, false, true]);
});

test('une ligne mal formée est écartée', () => {
  const rows = parseAccessScopes([manager, { role: 'x' }, null, { ...manager, scope: 'galaxie' }, 'texte']);
  expect(rows).toEqual([manager]);
  expect(parseAccessScopes({ detail: 'erreur' })).toEqual([]);
});

test('la mise à jour ne remplace que la ligne concernée', () => {
  const other: AccessScopeRow = { ...manager, role: 'reader' };
  const updated: AccessScopeRow = { ...manager, scope: 'unit_tree', overridden: true };
  expect(applyScopeUpdate([manager, other], updated)).toEqual([updated, other]);
});

test('messages choisis par le code HTTP, jamais par le texte du serveur', () => {
  expect(accessScopeChangeError(422)).toContain('trop large');
  expect(accessScopeChangeError(403)).toContain('pas le droit');
  expect(accessScopeChangeError(500)).toBe('Changement impossible pour le moment.');
});
