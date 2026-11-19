import { test, expect } from '@playwright/test';
import { canResubmit, loadRejectionReasons, needsCorrection } from '../../lib/rejectionReasons';

const ME = 'u-me';

test.describe('rejectionReasons', () => {
  test('seuls « rejeté » et « renvoyé » demandent une correction', () => {
    expect(needsCorrection('rejected')).toBe(true);
    expect(needsCorrection('returned')).toBe(true);
    for (const s of ['draft', 'in_review', 'validated', 'signed', 'archived', undefined, null]) {
      expect(needsCorrection(s)).toBe(false);
    }
  });

  test('seul le propriétaire peut corriger et resoumettre', () => {
    expect(canResubmit({ id: 'a', status: 'rejected', owner_id: ME }, ME)).toBe(true);
    expect(canResubmit({ id: 'a', status: 'rejected', owner_id: 'u-collegue' }, ME)).toBe(false);
    expect(canResubmit({ id: 'a', status: 'rejected', owner_id: ME }, undefined)).toBe(false);
    expect(canResubmit({ id: 'a', status: 'draft', owner_id: ME }, ME)).toBe(false);
  });

  test('lit le motif de mes seuls documents renvoyés, sans faire échouer la page sur une erreur', async () => {
    const read: string[] = [];
    const reasons = await loadRejectionReasons(
      [
        { id: 'a', status: 'rejected', owner_id: ME },
        { id: 'b', status: 'returned', owner_id: ME },
        { id: 'c', status: 'draft', owner_id: ME },
        { id: 'd', status: 'rejected', owner_id: ME },
        { id: 'e', status: 'returned', owner_id: ME },
        { id: 'f', status: 'rejected', owner_id: 'u-collegue' },
      ],
      ME,
      async (id) => {
        read.push(id);
        if (id === 'd') throw new Error('404');
        if (id === 'e') return { last_rejection_reason: '   ' };
        return { last_rejection_reason: id === 'a' ? ' Pièce jointe manquante. ' : 'Montant à revoir.' };
      },
    );
    // Aucune lecture pour le brouillon ni pour le document d'un collègue (403 évité).
    expect(read.sort()).toEqual(['a', 'b', 'd', 'e']);
    expect(reasons).toEqual({ a: 'Pièce jointe manquante.', b: 'Montant à revoir.' });
  });

  test('un motif déjà fourni par la liste évite la lecture du document', async () => {
    const read: string[] = [];
    const reasons = await loadRejectionReasons(
      [{ id: 'a', status: 'rejected', owner_id: ME, last_rejection_reason: 'Signature absente.' }],
      ME,
      async (id) => {
        read.push(id);
        return {};
      },
    );
    expect(read).toEqual([]);
    expect(reasons).toEqual({ a: 'Signature absente.' });
  });
});
