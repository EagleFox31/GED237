import { test, expect } from '@playwright/test';
import { canArchiveDocument } from '../../lib/documentArchive';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Action « Archiver »', () => {
  test('proposée à l\'admin d\'institution et au super admin sur un document validé ou signé', () => {
    for (const profile of ['tenant', 'super']) {
      expect(canArchiveDocument(profile, 'validated')).toBe(true);
      expect(canArchiveDocument(profile, 'signed')).toBe(true);
    }
  });
  test('masquée pour les autres profils (l\'API répond 403)', () => {
    for (const profile of ['manager', 'unit', 'collaborator', 'reader']) {
      expect(canArchiveDocument(profile, 'validated')).toBe(false);
    }
  });
  test('masquée hors statut validé ou signé (l\'API répond 409)', () => {
    for (const status of ['draft', 'in_review', 'rejected', 'returned', 'archived']) {
      expect(canArchiveDocument('tenant', status)).toBe(false);
    }
  });
  test('masquée sans profil ou sans statut', () => {
    expect(canArchiveDocument(undefined, 'validated')).toBe(false);
    expect(canArchiveDocument('tenant', undefined)).toBe(false);
  });
});
