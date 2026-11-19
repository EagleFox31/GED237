import { test, expect } from '@playwright/test';
import { WORKFLOW_STEP_STATUS_LABELS, workflowStepStatusLabel } from '../../lib/workflowStepStatus';

test.describe('workflowStepStatus', () => {
  test('« current » s’affiche « En cours »', () => {
    expect(workflowStepStatusLabel('current')).toBe('En cours');
  });
  test('aucun code anglais brut, même inconnu ou absent', () => {
    for (const [code, label] of Object.entries(WORKFLOW_STEP_STATUS_LABELS)) {
      expect(label).not.toBe(code);
      expect(label).not.toMatch(/_/);
    }
    expect(workflowStepStatusLabel('unexpected_code')).toBe('État inconnu');
    expect(workflowStepStatusLabel(undefined)).toBe('État inconnu');
  });
});
