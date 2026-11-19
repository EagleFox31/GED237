/**
 * Documents sent back to their author (rejected or returned for correction).
 * The server accepts both as workflow sources again and lets the owner upload a corrected version.
 */
export const NEEDS_CORRECTION = ['rejected', 'returned'] as const;

export const needsCorrection = (status: string | undefined | null): boolean =>
  (NEEDS_CORRECTION as readonly string[]).includes(status ?? '');

/**
 * The list endpoint does not carry the reason: read it from each sent-back document.
 * A failed read leaves that card without a reason instead of failing the whole page.
 */
export const loadRejectionReasons = async (
  docs: ReadonlyArray<{ id: string; status?: string | null }>,
  readOne: (id: string) => Promise<{ last_rejection_reason?: string | null }>,
): Promise<Record<string, string>> => {
  const targets = docs.filter((d) => needsCorrection(d.status));
  const entries = await Promise.all(
    targets.map(async (d) => {
      try {
        const reason = (await readOne(d.id)).last_rejection_reason?.trim();
        return reason ? ([d.id, reason] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
};
