import { test, expect } from '@playwright/test';
import { auditExportActors } from '../../lib/auditExport';

// Spec pur : exécuté par `npm run test:unit`.
const logs = [
  { user_id: 'u-1', user_name: 'Alice Nga' },
  { user_id: 'u-2', user_name: null, user_matricule: 'MAT-02' },
  { user_id: 'u-1', user_name: 'Alice Nga' },
  { user_id: null },
];

test.describe('Export du journal : acteurs cochés', () => {
  test('aucun acteur coché : pas de filtre, export possible', () => {
    expect(auditExportActors(logs, [])).toEqual({ userIds: [], blocked: false });
  });

  test('plusieurs acteurs cochés : tous envoyés, sans doublon', () => {
    expect(auditExportActors(logs, ['Alice Nga', 'MAT-02'])).toEqual({ userIds: ['u-1', 'u-2'], blocked: false });
  });

  test('« Système » coché : export bloqué (aucun identifiant à filtrer)', () => {
    expect(auditExportActors(logs, ['Alice Nga', 'Système']).blocked).toBe(true);
  });
});
