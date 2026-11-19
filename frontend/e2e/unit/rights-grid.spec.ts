// Spec pur (npm run test:unit) : grille des droits (#280, lot 8b), une case = une règle `p`.
import { test, expect } from '@playwright/test';
import {
  MANAGE,
  applyChange,
  gridFor,
  resourceLabel,
  resourcesOf,
  rightsChangeError,
  roleLabel,
  RIGHTS_READ_ONLY_SERVER,
  type PolicyRow,
} from '../../lib/rightsGrid';

const p = (v0: string, v1: string, v2: string): PolicyRow => ({ ptype: 'p', v0, v1, v2 });

const POLICIES: PolicyRow[] = [
  p('reader', 'documents', 'read'),
  p('tenant_admin', 'documents', 'read'),
  p('tenant_admin', 'documents', 'archive'),
  p('super_admin', 'documents', MANAGE),
  p('super_admin', 'tenants', MANAGE),
  { ptype: 'g', v0: 'alice', v1: 'reader', v2: 'tenant-1' },
  { ptype: 'p', v0: 'reader', v1: 'spaces', v2: 'read', v3: 'extra' },
];

test.describe('Grille des droits', () => {
  test('les rôles suivent l’ordre hiérarchique, rôles en plus compris', () => {
    const grid = gridFor('documents', POLICIES, ['auditor']);
    expect(grid.roles).toEqual(['super_admin', 'tenant_admin', 'reader', 'auditor']);
  });

  test('colonnes : actions de base plus celles du domaine, dans l’ordre fixé', () => {
    expect(gridFor('documents', POLICIES).actions).toEqual(['read', 'create', 'update', 'delete', 'archive', MANAGE]);
    expect(gridFor('tenants', POLICIES).actions).toEqual(['read', 'create', 'update', 'delete', MANAGE]);
  });

  test('« Tout gérer » coche les autres actions sans règle propre', () => {
    const grid = gridFor('documents', POLICIES);
    expect(grid.cell('super_admin', MANAGE)).toBe('granted');
    expect(grid.cell('super_admin', 'delete')).toBe('implied');
    expect(grid.cell('tenant_admin', 'read')).toBe('granted');
    expect(grid.cell('tenant_admin', 'delete')).toBe('none');
    expect(grid.cell('reader', MANAGE)).toBe('none');
  });

  test('les règles g et à quatre valeurs restent hors grille', () => {
    expect(resourcesOf(POLICIES)).toEqual(['documents', 'tenants']);
    expect(gridFor('documents', POLICIES).roles).not.toContain('alice');
  });

  test('domaines triés par libellé français', () => {
    expect(resourcesOf([p('reader', 'users', 'read'), p('reader', 'categories', 'read')])).toEqual([
      'users',
      'categories',
    ]);
    expect(resourceLabel('users')).toBe('Agents');
  });

  test('code inconnu : affiché entre parenthèses, jamais vide', () => {
    expect(resourceLabel('nouveau')).toBe('(nouveau)');
    expect(roleLabel('collaborator')).toBe('Collaborateur');
    expect(roleLabel('stagiaire')).toBe('(stagiaire)');
  });

  test('ajout puis retrait : pas de doublon, retour à l’état initial', () => {
    const rule = p('reader', 'documents', 'create');
    const added = applyChange(POLICIES, rule, true);
    expect(applyChange(added, rule, true)).toHaveLength(added.length);
    expect(gridFor('documents', added).cell('reader', 'create')).toBe('granted');
    const removed = applyChange(added, rule, false);
    expect(removed).toHaveLength(POLICIES.length);
    expect(gridFor('documents', removed).cell('reader', 'create')).toBe('none');
  });

  test('message de refus choisi par le code HTTP', () => {
    expect(rightsChangeError(409)).toBe(RIGHTS_READ_ONLY_SERVER);
    expect(rightsChangeError(429)).toContain('minute');
    expect(rightsChangeError(undefined)).toBe('Changement impossible pour le moment.');
  });
});
