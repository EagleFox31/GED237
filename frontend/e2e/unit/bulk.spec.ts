import { test, expect } from '@playwright/test';
import { settleLimited, titleList } from '../../lib/bulk';

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

  test('liste des titres abrégée', () => {
    expect(titleList(['a'])).toBe('« a »');
    expect(titleList(['a', 'b', 'c'])).toBe('« a », « b », « c »');
    expect(titleList(['a', 'b', 'c', 'd'])).toBe('« a », « b », « c » et 1 autre');
    expect(titleList(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('« a », « b », « c » et 3 autres');
  });
});
