// Spec pur (npm run test:unit) : constante et fonction pure des motifs de rejet en 1 clic.
import { test, expect } from '@playwright/test';
import {
  QUICK_REJECT_REASONS,
  applyQuickRejectReason,
} from '../../components/workflow/RejectReasonDialog';

test.describe('Motifs de rejet en 1 clic', () => {
  test('expose les 4 motifs fréquents attendus', () => {
    expect(QUICK_REJECT_REASONS).toEqual([
      'Pièce manquante',
      'Erreur de saisie ou de montant',
      'Visa préalable manquant',
      'À reformuler',
    ]);
  });

  test('remplit le champ vide ou ne contenant que des espaces', () => {
    expect(applyQuickRejectReason('', QUICK_REJECT_REASONS[0])).toBe('Pièce manquante');
    expect(applyQuickRejectReason('   ', QUICK_REJECT_REASONS[1])).toBe(
      'Erreur de saisie ou de montant',
    );
  });

  test('complète un texte existant et reste idempotent au second clic', () => {
    const first = applyQuickRejectReason('Montant HT incohérent', QUICK_REJECT_REASONS[2]);
    expect(first).toBe('Montant HT incohérent · Visa préalable manquant');

    const duplicate = applyQuickRejectReason(first, QUICK_REJECT_REASONS[2]);
    expect(duplicate).toBe(first);
  });
});
