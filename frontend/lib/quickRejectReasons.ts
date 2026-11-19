export const QUICK_REJECT_REASONS = [
  'Pièce justificative manquante',
  'Document illisible ou incomplet',
  'Erreur de destinataire',
  'À reformuler',
] as const;

/** A quick reason adds to what is already typed (one reason per line) and is never added twice. */
export function appendQuickReason(current: string, quickReason: string): string {
  const typed = current.trimEnd();
  if (!typed) return quickReason;
  if (typed.split('\n').some((line) => line.trim() === quickReason)) return current;
  return `${typed}\n${quickReason}`;
}
