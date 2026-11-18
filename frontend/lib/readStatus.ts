// État de la lecture du texte d'un document, en langage simple (le mot « OCR » n'est jamais montré).
// Contrat : ocr_status = not_processed | processing | completed | failed. Une valeur inconnue
// ne casse rien : elle est présentée comme « en cours ».

export type ReadState = 'none' | 'processing' | 'failed';

const NO_BADGE = new Set(['', 'not_processed', 'completed']);

export function readStateOf(ocrStatus: string | null | undefined): ReadState {
  const value = (ocrStatus ?? '').trim().toLowerCase();
  if (value === 'failed') return 'failed';
  if (NO_BADGE.has(value)) return 'none';
  return 'processing';
}

export const READ_STATE_LABEL: Record<Exclude<ReadState, 'none'>, string> = {
  processing: 'Lecture en cours',
  failed: 'Lecture en échec',
};

export const RETRY_READ_LABEL = 'Relancer la lecture';
export const RETRY_READ_STARTED = 'Lecture relancée.';
export const RETRY_READ_BUSY = 'Lecture déjà en cours, réessayez dans quelques minutes';

// Droit de relancer = document.can_update (serveur : même règle que PATCH et retry, droit et périmètre).
// Absent ou non booléen vrai → bouton masqué (sûr par défaut).
export function canRetryRead(ocrStatus: string | null | undefined, canUpdate: boolean | null | undefined): boolean {
  return readStateOf(ocrStatus) === 'failed' && canUpdate === true;
}
