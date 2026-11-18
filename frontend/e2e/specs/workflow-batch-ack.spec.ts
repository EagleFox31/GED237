// Spec pur (npm run test:unit) : prise de connaissance groupée read_ack uniquement (Lot 4, point 3).
import { test, expect } from '@playwright/test';
import {
  countTasksByActionType,
  executeBatchReadAck,
  filterTasksByActionType,
  isBatchReadAckAvailable,
} from '../../lib/workflowBatch';

test.describe('Prise de connaissance groupée (read_ack uniquement)', () => {
  const tasks = [
    { id: 't1', expected_action_type: 'read_ack' },
    { id: 't2', expected_action_type: 'visa' },
    { id: 't3', expected_action_type: 'read_ack' },
    { id: 't4', expected_action_type: 'final_signature' },
  ];

  test('n autorise le bouton groupé que lorsque le filtre Prises de connaissance est actif', () => {
    expect(countTasksByActionType(tasks)).toEqual({
      all: 4,
      read_ack: 2,
      visa: 1,
      approval: 0,
      final_signature: 1,
    });

    const ackOnly = filterTasksByActionType(tasks, 'read_ack');
    expect(ackOnly.map((t) => t.id)).toEqual(['t1', 't3']);

    expect(isBatchReadAckAvailable('all', tasks)).toBe(false);
    expect(isBatchReadAckAvailable('visa', filterTasksByActionType(tasks, 'visa'))).toBe(false);
    expect(isBatchReadAckAvailable('read_ack', [])).toBe(false);
    expect(isBatchReadAckAvailable('read_ack', ackOnly)).toBe(true);
  });

  test('exécute un appel par tâche read_ack, continue en cas d échec partiel et remonte le compteur', async () => {
    const called: string[] = [];
    const mixed = [
      { id: 't1', expected_action_type: 'read_ack' },
      { id: 't2', expected_action_type: 'visa' }, // jamais appelé
      { id: 't3', expected_action_type: 'read_ack' },
      { id: 't4', expected_action_type: 'read_ack' },
    ];

    const result = await executeBatchReadAck(mixed, async (task) => {
      called.push(task.id);
      if (task.id === 't3') throw new Error('Network error');
    });

    expect(called).toEqual(['t1', 't3', 't4']);
    expect(result.succeededIds).toEqual(['t1', 't4']);
    expect(result.failedCount).toBe(1);
  });
});
