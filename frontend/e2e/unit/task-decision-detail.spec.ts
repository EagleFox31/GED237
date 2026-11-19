// Spec pur (npm run test:unit) : Viser et Rejeter depuis la fiche document (Lot 4, point 4).
import { test, expect } from '@playwright/test';
import {
  taskWithDetailVersion,
  triggerDetailDecision,
} from '../../lib/taskDecisionFromDetail';

test.describe('Décision depuis la fiche document (DocumentDetailModal)', () => {
  test('ferme la fiche et transmet la version de la fiche affichée au gestionnaire d approbation', () => {
    const events: string[] = [];
    triggerDetailDecision(
      'approve',
      {
        approveLabel: 'Viser',
        onApprove: (ver) => events.push(`approve:${ver}`),
        onReject: (ver) => events.push(`reject:${ver}`),
      },
      () => events.push('close'),
      'ver-detail-99',
    );
    expect(events).toEqual(['close', 'approve:ver-detail-99']);
  });

  test('ferme la fiche et transmet la version de la fiche affichée au gestionnaire de rejet', () => {
    const events: string[] = [];
    triggerDetailDecision(
      'reject',
      {
        approveLabel: 'Viser',
        onApprove: (ver) => events.push(`approve:${ver}`),
        onReject: (ver) => events.push(`reject:${ver}`),
      },
      () => events.push('close'),
      'ver-detail-42',
    );
    expect(events).toEqual(['close', 'reject:ver-detail-42']);
  });

  test('remplace la version de la carte par la version rechargée de la fiche', () => {
    const cardTask = {
      id: 'task-1',
      document: { current_version_id: 'ver-card-stale' },
    };
    const updated = taskWithDetailVersion(cardTask, 'ver-detail-fresh');
    expect(updated.document?.current_version_id).toBe('ver-detail-fresh');
    expect(cardTask.document.current_version_id).toBe('ver-card-stale');
  });
});
