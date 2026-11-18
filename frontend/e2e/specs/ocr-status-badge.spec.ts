// Spec pur (npm run test:unit) : badge discret d'état OCR (Lot 4 / Démo point 1).
import { test, expect } from '@playwright/test';
import { resolveOcrStatusBadge } from '../../lib/ocrStatusBadge';

test.describe('Badge état OCR (Documents & DocumentDetailModal)', () => {
  test('affiche le badge discret pour processing et failed', () => {
    expect(resolveOcrStatusBadge('processing')).toEqual({
      label: 'Lecture du texte en cours',
      tone: 'processing',
    });
    expect(resolveOcrStatusBadge('failed')).toEqual({
      label: 'Texte non lu',
      tone: 'failed',
    });
  });

  test('n affiche aucun badge pour completed, not_processed ou champ absent', () => {
    expect(resolveOcrStatusBadge('completed')).toBeNull();
    expect(resolveOcrStatusBadge('not_processed')).toBeNull();
    expect(resolveOcrStatusBadge(undefined)).toBeNull();
    expect(resolveOcrStatusBadge(null)).toBeNull();
  });
});
