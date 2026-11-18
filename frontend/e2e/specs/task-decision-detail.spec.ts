// Spec pur (npm run test:unit) : Viser et Rejeter depuis la fiche document (Lot 4, point 4).
import { test, expect } from '@playwright/test';
import { triggerDetailDecision } from '../../lib/taskDecisionFromDetail';

test.describe('Décision depuis la fiche document (DocumentDetailModal)', () => {
  test('ferme la fiche et appelle le gestionnaire d approbation du parent', () => {
    const events: string[] = [];
    triggerDetailDecision(
      'approve',
      {
        approveLabel: 'Viser',
        onApprove: () => events.push('approve'),
        onReject: () => events.push('reject'),
      },
      () => events.push('close'),
    );
    expect(events).toEqual(['close', 'approve']);
  });

  test('ferme la fiche et appelle le gestionnaire de rejet du parent (RejectReasonDialog)', () => {
    const events: string[] = [];
    triggerDetailDecision(
      'reject',
      {
        approveLabel: 'Viser',
        onApprove: () => events.push('approve'),
        onReject: () => events.push('reject'),
      },
      () => events.push('close'),
    );
    expect(events).toEqual(['close', 'reject']);
  });
});
