// Spec pur (npm run test:unit) : logique de sélection multiple et bilan d'action groupée (#150).
import { test, expect } from '@playwright/test';
import {
  applyExplorerSelection,
  formatBulkSummaryMessage,
  formatSelectionCount,
  runBulkExplorerAction,
  selectAllExplorerIds,
} from '../../lib/explorerSelection';

test.describe('Sélection multiple dans l explorateur (#150)', () => {
  const ordered = ['d1', 'd2', 'd3', 'd4', 'd5'];

  test('gère clic simple, Ctrl+clic (ajout/retrait), Maj+clic et Ctrl+A', () => {
    const first = applyExplorerSelection({
      currentIds: [],
      orderedIds: ordered,
      anchorId: null,
      targetId: 'd2',
      ctrlKey: false,
      shiftKey: false,
    });
    expect(first).toEqual({ selectedIds: ['d2'], anchorId: 'd2' });

    const shiftRange = applyExplorerSelection({
      currentIds: first.selectedIds,
      orderedIds: ordered,
      anchorId: first.anchorId,
      targetId: 'd4',
      ctrlKey: false,
      shiftKey: true,
    });
    expect(shiftRange).toEqual({ selectedIds: ['d2', 'd3', 'd4'], anchorId: 'd2' });

    const ctrlRemove = applyExplorerSelection({
      currentIds: shiftRange.selectedIds,
      orderedIds: ordered,
      anchorId: shiftRange.anchorId,
      targetId: 'd3',
      ctrlKey: true,
      shiftKey: false,
    });
    expect(ctrlRemove).toEqual({ selectedIds: ['d2', 'd4'], anchorId: 'd3' });

    const ctrlAdd = applyExplorerSelection({
      currentIds: ctrlRemove.selectedIds,
      orderedIds: ordered,
      anchorId: ctrlRemove.anchorId,
      targetId: 'd1',
      ctrlKey: true,
      shiftKey: false,
    });
    expect(ctrlAdd).toEqual({ selectedIds: ['d2', 'd4', 'd1'], anchorId: 'd1' });

    const all = selectAllExplorerIds(ordered);
    expect(all).toEqual({ selectedIds: ordered, anchorId: 'd1' });
  });

  test('formate le compteur de sélection et le bilan avec réussites et échecs', async () => {
    expect(formatSelectionCount(1)).toBe('1 sélectionné');
    expect(formatSelectionCount(3)).toBe('3 sélectionnés');

    const docs = [
      { id: '1', title: 'Note A' },
      { id: '2', title: 'Brouillon B', status: 'brouillon' },
      { id: '3', title: 'Note C' },
      { id: '4', title: 'Note D' },
    ];
    const called: string[] = [];
    const summary = await runBulkExplorerAction(
      docs,
      (d) => d.title,
      async (d) => {
        called.push(d.id);
        if (d.id === '4') throw new Error('Internal Server Error: stack trace');
      },
      (d) => d.status ?? null,
    );
    // A set-aside item never reaches the server.
    expect(called).toEqual(['1', '3', '4']);
    expect(summary.succeededIds).toEqual(['1', '3']);
    expect(summary.failures).toEqual([
      { id: '2', label: 'Brouillon B', reason: 'brouillon' },
      { id: '4', label: 'Note D', reason: 'refusé' },
    ]);
    // Plain French only: the raw server message never shows.
    const message = formatBulkSummaryMessage('archivé', summary);
    expect(message).toBe('2 archivés, 2 impossibles : Brouillon B (brouillon), Note D (refusé)');
    expect(message).not.toContain('Internal');
  });
});
