// Spec pur (npm run test:unit) : tuiles du manager (#278), chiffres et messages.
import { test, expect } from '@playwright/test';
import {
  NO_UNIT_MESSAGE,
  formatCount,
  formatStorage,
  managerMetricsError,
  managerTiles,
  toMegabytes,
} from '../../lib/managerDashboard';

test.describe('Tuiles du manager', () => {
  test('réponse complète : quatre chiffres', () => {
    expect(
      managerTiles({ documents: { total: 12, needs_review: 3, storage_used_mb: 42.5 }, active_workflows: 4 }),
    ).toEqual({ total: 12, needsReview: 3, activeWorkflows: 4, storageMb: 42.5 });
  });

  test('champs absents : zéro, jamais NaN', () => {
    expect(managerTiles({})).toEqual({ total: 0, needsReview: 0, activeWorkflows: 0, storageMb: 0 });
  });

  test('espace utilisé en chaîne ou invalide', () => {
    expect(toMegabytes('12.75')).toBe(12.75);
    expect(toMegabytes('abc')).toBe(0);
    expect(toMegabytes(-3)).toBe(0);
    expect(toMegabytes(null)).toBe(0);
  });

  test('format français', () => {
    expect(formatCount(1234)).toMatch(/^1\s234$/);
    expect(formatStorage(350)).toBe('350 Mo');
    expect(formatStorage(1536)).toBe('1,5 Go');
  });

  test('erreurs : 403 masque, le reste affiche un message court', () => {
    expect(managerMetricsError(403)).toBeNull();
    expect(managerMetricsError(500)).toBe('Chiffres indisponibles pour le moment.');
    expect(managerMetricsError(undefined)).toBe('Chiffres indisponibles pour le moment.');
    expect(NO_UNIT_MESSAGE).toContain('aucun service');
  });
});
