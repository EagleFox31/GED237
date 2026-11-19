// Spec pur (npm run test:unit) : prise de connaissance groupée read_ack uniquement (Lot 4, point 3).
import { test, expect } from '@playwright/test';
import {
  BATCH_READ_ACK_COMMENT,
  countTasksByActionType,
  executeBatchReadAck,
  filterTasksByActionType,
  formatBatchReadAckSummary,
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

  test('envoie le commentaire fixe Prise de connaissance groupée pour chaque appel et remonte le bilan', async () => {
    const called: Array<{ id: string; comment: string }> = [];
    const mixed = [
      { id: 't1', expected_action_type: 'read_ack' },
      { id: 't2', expected_action_type: 'visa' }, // jamais appelé
      { id: 't3', expected_action_type: 'read_ack' },
      { id: 't4', expected_action_type: 'read_ack' },
    ];

    const result = await executeBatchReadAck(mixed, async (task, comment) => {
      called.push({ id: task.id, comment });
      if (task.id === 't3') throw new Error('Network error');
    });

    expect(called).toEqual([
      { id: 't1', comment: BATCH_READ_ACK_COMMENT },
      { id: 't3', comment: BATCH_READ_ACK_COMMENT },
      { id: 't4', comment: BATCH_READ_ACK_COMMENT },
    ]);
    expect(result.succeededIds).toEqual(['t1', 't4']);
    expect(result.failedCount).toBe(1);
    expect(formatBatchReadAckSummary(8, 2)).toBe(
      '8 prises de connaissance enregistrées, 2 échouées.',
    );
    expect(formatBatchReadAckSummary(3, 0)).toBe(
      '3 prises de connaissance enregistrées.',
    );
  });
});
