// Spec pur (npm run test:unit) : motifs rapides de rejet.
import { test, expect } from '@playwright/test';
import { QUICK_REJECT_REASONS } from '../../components/workflow/RejectReasonDialog';

test.describe('Motifs de rejet rapides (RejectReasonDialog)', () => {
  test('propose 3 ou 4 motifs courts et non vides', () => {
    expect(QUICK_REJECT_REASONS.length).toBeGreaterThanOrEqual(3);
    expect(QUICK_REJECT_REASONS.length).toBeLessThanOrEqual(4);
    for (const reason of QUICK_REJECT_REASONS) {
      expect(reason.trim().length).toBeGreaterThan(3);
    }
  });
});
