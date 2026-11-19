import { test, expect } from '@playwright/test';
import { loadRejectionReasons, needsCorrection } from '../../lib/rejectionReasons';

test.describe('rejectionReasons', () => {
  test('seuls « rejeté » et « renvoyé » demandent une correction', () => {
    expect(needsCorrection('rejected')).toBe(true);
    expect(needsCorrection('returned')).toBe(true);
    for (const s of ['draft', 'in_review', 'validated', 'signed', 'archived', undefined, null]) {
      expect(needsCorrection(s)).toBe(false);
    }
  });

  test('lit le motif des seuls documents renvoyés, sans faire échouer la page sur une erreur', async () => {
    const read: string[] = [];
    const reasons = await loadRejectionReasons(
      [
        { id: 'a', status: 'rejected' },
        { id: 'b', status: 'returned' },
        { id: 'c', status: 'draft' },
        { id: 'd', status: 'rejected' },
        { id: 'e', status: 'returned' },
      ],
      async (id) => {
        read.push(id);
        if (id === 'd') throw new Error('404');
        if (id === 'e') return { last_rejection_reason: '   ' };
        return { last_rejection_reason: id === 'a' ? ' Pièce jointe manquante. ' : 'Montant à revoir.' };
      },
    );
    expect(read.sort()).toEqual(['a', 'b', 'd', 'e']);
    expect(reasons).toEqual({ a: 'Pièce jointe manquante.', b: 'Montant à revoir.' });
  });
});
