import { test, expect } from '@playwright/test';
import { offlineSentence, sentences, settleLimited, splitSettled, titleList } from '../../lib/bulk';

test.describe('actions groupées', () => {
  test('au plus 4 requêtes à la fois, résultats dans l’ordre, un échec n’arrête pas les autres', async () => {
    let running = 0;
    let peak = 0;
    const items = Array.from({ length: 10 }, (_, index) => index);
    const results = await settleLimited(items, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      if (n % 3 === 0) throw new Error(`refus ${n}`);
      return n * 10;
    });
    expect(peak).toBe(4);
    expect(results.map((r) => r.status)).toEqual(
      items.map((n) => (n % 3 === 0 ? 'rejected' : 'fulfilled')),
    );
    expect(results[1]).toEqual({ status: 'fulfilled', value: 10 });
  });

  test('liste vide ou limite plus grande que la liste', async () => {
    expect(await settleLimited([], async () => 1)).toEqual([]);
    expect(await settleLimited([1, 2], async (n) => n, 10)).toEqual([
      { status: 'fulfilled', value: 1 },
      { status: 'fulfilled', value: 2 },
    ]);
  });

  test('tri des résultats : réussis, refusés, perdus faute de connexion', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: true },
      { status: 'rejected', reason: { errorCode: 'NETWORK_UNREACHABLE', status: 0 } },
      { status: 'rejected', reason: { errorCode: 'HTTP_403', status: 403 } },
      { status: 'rejected', reason: new Error('inattendu') },
      { status: 'rejected', reason: { errorCode: 'NETWORK_UNREACHABLE', status: 0 } },
    ];
    expect(splitSettled(['a', 'b', 'c', 'd', 'e'], results)).toEqual({
      done: ['a'],
      refused: ['c', 'd'],
      offline: ['b', 'e'],
    });
  });

  test('coupure réseau : une seule phrase, accordée au nombre', () => {
    expect(offlineSentence(1, 'mis à la corbeille')).toBe(
      "Connexion perdue : 1 document n'a pas été mis à la corbeille. Réessayez.",
    );
    expect(offlineSentence(5, 'remis en place')).toBe(
      "Connexion perdue : 5 documents n'ont pas été remis en place. Réessayez.",
    );
    expect(sentences('Échec : « a ».', false, 'Réessayez.')).toBe('Échec : « a ». Réessayez.');
    expect(sentences(false, false)).toBe('');
  });

  test('liste des titres abrégée', () => {
    expect(titleList(['a'])).toBe('« a »');
    expect(titleList(['a', 'b', 'c'])).toBe('« a », « b », « c »');
    expect(titleList(['a', 'b', 'c', 'd'])).toBe('« a », « b », « c » et 1 autre');
    expect(titleList(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('« a », « b », « c » et 3 autres');
  });
});
