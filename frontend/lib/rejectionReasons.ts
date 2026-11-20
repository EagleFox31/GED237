/**
 * Documents sent back to their author (rejected or returned for correction).
 * The server accepts both as workflow sources again and lets the owner upload a corrected version.
 */
export const NEEDS_CORRECTION = ['rejected', 'returned'] as const;

export const needsCorrection = (status: string | undefined | null): boolean =>
  (NEEDS_CORRECTION as readonly string[]).includes(status ?? '');

/** 409 on a corrected version: the chosen file is the same as a version already on the document. */
export const IDENTICAL_VERSION_MESSAGE =
  'Ce fichier est identique à une version déjà envoyée. Choisissez le fichier corrigé.';

/** Beyond this length the card shows the start of the reason and a « Lire tout » toggle. */
export const LONG_REASON_CHARS = 120;

interface CorrectableDoc {
  id: string;
  status?: string | null;
  owner_id?: string | null;
  last_rejection_reason?: string | null;
}

/** Only the owner can upload a corrected version and resubmit (the server answers 403 to anyone else). */
export const canResubmit = (doc: CorrectableDoc, userId: string | undefined | null): boolean =>
  needsCorrection(doc.status) && !!userId && doc.owner_id === userId;

/**
 * Reasons for the cards the current user can fix. A reason already in the list item is used as is;
 * otherwise the document is read once (the caller passes a silent read: a failure leaves that card
 * without a reason, with no error message and no failed page).
 */
export const loadRejectionReasons = async (
  docs: ReadonlyArray<CorrectableDoc>,
  userId: string | undefined | null,
  readOne: (id: string) => Promise<{ last_rejection_reason?: string | null }>,
): Promise<Record<string, string>> => {
  const targets = docs.filter((d) => canResubmit(d, userId));
  const entries = await Promise.all(
    targets.map(async (d) => {
      try {
        const listed = d.last_rejection_reason?.trim();
        const reason = listed || (await readOne(d.id)).last_rejection_reason?.trim();
        return reason ? ([d.id, reason] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => e !== null));
};
