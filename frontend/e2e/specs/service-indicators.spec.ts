import { test, expect } from '@playwright/test';
import { serviceIndicators } from '../../profiles/unit-admin/pages/serviceIndicators';
import type { TenantMetrics } from '../../types';

const base: TenantMetrics = {
  users: { total: 4 },
  documents: { total: 12, storage_used_mb: 30, storage_quota_mb: 1000 },
  workflows: { pending: 2, completed: 5, rejected: 1 },
};

test.describe('Tableau de bord du service : indicateurs', () => {
  test('agents, documents et workflows du service, sans pourcentage de quota', () => {
    const rows = serviceIndicators(base);
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ['Agents', 4],
      ['Documents', 12],
      ['Workflows en attente', 2],
      ['Workflows complétés', 5],
    ]);
    expect(rows.some((r) => /quota|%/i.test(r.label))).toBe(false);
  });

  test('doublons refusés seulement quand l’API les fournit', () => {
    const rows = serviceIndicators({ ...base, duplicates: { refused: 3, refused_upload: 2, refused_import: 1 } });
    expect(rows[rows.length - 1]).toEqual({ label: 'Doublons refusés', value: 3, icon: 'content_copy' });
  });
});
