import { test, expect } from '@playwright/test';
import { ApiError } from '../../lib/errors/ApiError';
import { bulkConfirmTitle, bulkDecide, bulkDoneLabel, bulkFailureMessage } from '../../lib/bulkDecide';

const TASKS = [
  { id: 'a', title: 'Note A' },
  { id: 'b', title: 'Note B' },
  { id: 'c', title: 'Note C' },
];

test.describe('bulkDecide', () => {
  test('une tâche en échec n’arrête pas les suivantes, et rien n’est rejoué', async () => {
    const calls: string[] = [];
    const progress: number[] = [];
    const outcome = await bulkDecide(
      TASKS,
      async (t) => {
        calls.push(t.id);
        if (t.id === 'b') throw new Error('Version absente.');
      },
      (n) => progress.push(n),
    );
    expect(calls).toEqual(['a', 'b', 'c']);
    expect(progress).toEqual([1, 2, 3]);
    expect(outcome.done).toEqual(['a', 'c']);
    expect(outcome.failed).toEqual([{ id: 'b', title: 'Note B', message: 'Version absente.' }]);
  });

  test('appels en série : la suivante attend la précédente', async () => {
    let running = 0;
    let peak = 0;
    await bulkDecide(TASKS, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
    });
    expect(peak).toBe(1);
  });

  test('message par tâche : celui du serveur, sinon un texte simple', () => {
    const apiErr = new ApiError({ status: 409, detail: 'Étape déjà traitée.' });
    expect(bulkFailureMessage(apiErr)).toBe('Étape déjà traitée.');
    expect(bulkFailureMessage('???')).toBe('Décision impossible sur ce document.');
  });

  test('libellés au singulier et au pluriel', () => {
    expect(bulkConfirmTitle(1)).toBe('Viser 1 tâche ?');
    expect(bulkConfirmTitle(3)).toBe('Viser 3 tâches ?');
    expect(bulkDoneLabel(1)).toBe('1 tâche visée.');
    expect(bulkDoneLabel(2)).toBe('2 tâches visées.');
  });
});
