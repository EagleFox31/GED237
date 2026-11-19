// Actions groupées (corbeille d'une sélection, annulation) : logique pure, testée par
// `npm run test:unit` (e2e/unit/bulk.spec.ts).

/** Requêtes simultanées au plus : un Ctrl+A sur un grand dossier ne lance pas N requêtes d'un coup. */
export const BULK_CONCURRENCY = 4;

/**
 * Applique `run` à chaque élément, `limit` à la fois au plus. Un échec n'arrête pas les autres.
 * Les résultats sont dans l'ordre des éléments, comme Promise.allSettled.
 */
export async function settleLimited<T, R>(
  items: readonly T[],
  run: (item: T) => Promise<R>,
  limit = BULK_CONCURRENCY,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: 'fulfilled', value: await run(items[index] as T) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker));
  return results;
}

/** « a », « b », « c » et N autres : liste courte des titres pour un message. */
export function titleList(titles: readonly string[], max = 3): string {
  const shown = titles.slice(0, max).map((title) => `« ${title} »`).join(', ');
  const rest = titles.length - max;
  if (rest <= 0) return shown;
  return `${shown} et ${rest} ${rest === 1 ? 'autre' : 'autres'}`;
}
