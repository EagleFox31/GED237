import { test, expect } from '@playwright/test';
import { diffText, textDiffSummary } from '../../lib/versionTextDiff';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Diff de texte entre versions', () => {
  test('lignes ajoutées, retirées et communes dans l\'ordre', async () => {
    const lines = await diffText('a\nb\nc', 'a\nc\nd');
    expect(lines).toEqual([
      { kind: 'same', text: 'a' }, { kind: 'removed', text: 'b' }, { kind: 'same', text: 'c' }, { kind: 'added', text: 'd' },
    ]);
    expect(textDiffSummary(lines)).toBe('1 ligne ajoutée, 1 ligne retirée.');
  });

  test('textes identiques, vides et fins de ligne Windows', async () => {
    expect(textDiffSummary(await diffText('x\ny', 'x\r\ny'))).toBe('Le texte est identique.');
    expect(await diffText('', '')).toEqual([]);
    expect(await diffText('', 'a')).toEqual([{ kind: 'added', text: 'a' }]);
  });
});
