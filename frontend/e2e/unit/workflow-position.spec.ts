// Spec pur (npm run test:unit) : « Chez X (étape n/N) » sur un document en validation (L12-7).
import { test, expect } from '@playwright/test';
import { getWorkflowPositionLabel } from '../../types';

test.describe('Position dans le circuit', () => {
  test('nomme le valideur et l\'étape', () => {
    expect(getWorkflowPositionLabel({
      status: 'in_review', workflow_step_order: 2, workflow_step_count: 3, workflow_assignee_name: 'Awa Mbarga',
    })).toBe('Chez Awa Mbarga (étape 2/3)');
  });

  test('étape sans valideur attribué', () => {
    expect(getWorkflowPositionLabel({
      status: 'in_review', workflow_step_order: 1, workflow_step_count: 2, workflow_assignee_name: null,
    })).toBe("En attente d'un valideur (étape 1/2)");
  });

  test('rien hors validation ou sans données', () => {
    expect(getWorkflowPositionLabel({
      status: 'returned', workflow_step_order: 1, workflow_step_count: 1, workflow_assignee_name: 'X',
    })).toBeNull();
    expect(getWorkflowPositionLabel({ status: 'in_review' })).toBeNull();
  });
});
