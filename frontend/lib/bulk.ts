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

/** Résultats triés : réussis, refusés par le serveur, perdus faute de connexion. */
export interface SettledSplit<T> {
  done: T[];
  refused: T[];
  offline: T[];
}

// Code posé par apiErrorFromException quand le serveur est injoignable.
const isOffline = (reason: unknown): boolean =>
  (reason as { errorCode?: unknown } | null)?.errorCode === 'NETWORK_UNREACHABLE';

export function splitSettled<T>(items: readonly T[], results: readonly PromiseSettledResult<unknown>[]): SettledSplit<T> {
  const split: SettledSplit<T> = { done: [], refused: [], offline: [] };
  items.forEach((item, index) => {
    const result = results[index];
    if (result?.status === 'fulfilled') split.done.push(item);
    else if (isOffline(result?.reason)) split.offline.push(item);
    else split.refused.push(item);
  });
  return split;
}

/** Une seule phrase pour tous les documents perdus par une coupure, au lieu d'une notification chacun. */
export function offlineSentence(count: number, action: string): string {
  const subject = count === 1 ? "1 document n'a pas été" : `${count} documents n'ont pas été`;
  return `Connexion perdue : ${subject} ${action}. Réessayez.`;
}

/** Assemble les phrases retenues (les `false` sont ignorés) en un seul message. */
export function sentences(...parts: readonly (string | false)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** « a », « b », « c » et N autres : liste courte des titres pour un message. */
export function titleList(titles: readonly string[], max = 3): string {
  const shown = titles.slice(0, max).map((title) => `« ${title} »`).join(', ');
  const rest = titles.length - max;
  if (rest <= 0) return shown;
  return `${shown} et ${rest} ${rest === 1 ? 'autre' : 'autres'}`;
}
