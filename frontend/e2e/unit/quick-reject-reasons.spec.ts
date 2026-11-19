// Spec pur (npm run test:unit) : motifs rapides de rejet.
import { test, expect } from '@playwright/test';
import { QUICK_REJECT_REASONS, appendQuickReason } from '../../lib/quickRejectReasons';

test.describe('Motifs de rejet rapides (RejectReasonDialog)', () => {
  test('propose 3 ou 4 motifs courts et non vides', () => {
    expect(QUICK_REJECT_REASONS.length).toBeGreaterThanOrEqual(3);
    expect(QUICK_REJECT_REASONS.length).toBeLessThanOrEqual(4);
    for (const reason of QUICK_REJECT_REASONS) {
      expect(reason.trim().length).toBeGreaterThan(3);
    }
  });

  test('un motif rapide complète le texte saisi sans l écraser', () => {
    const [first, second] = QUICK_REJECT_REASONS;
    expect(appendQuickReason('', first)).toBe(first);
    expect(appendQuickReason('   ', first)).toBe(first);
    expect(appendQuickReason('Page 3 manquante', first)).toBe(`Page 3 manquante\n${first}`);
    expect(appendQuickReason(first, second)).toBe(`${first}\n${second}`);
  });

  test('un motif déjà présent n est pas ajouté deux fois', () => {
    const [first, second] = QUICK_REJECT_REASONS;
    const typed = `${first}\n${second}`;
    expect(appendQuickReason(typed, first)).toBe(typed);
  });
});
