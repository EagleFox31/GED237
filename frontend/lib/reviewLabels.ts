// Libellés de la fiche « Revue de classement » : aucun code ni JSON du serveur à l'écran.
import { getStatusLabel } from '../types';

/** Valeur inconnue : on n'affiche jamais le code brut. */
export const UNKNOWN_LABEL = '—';

/** État de classement d'un document ou d'un fichier importé. */
export const CLASSIFICATION_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'En attente de classement',
  classified: 'Classé',
  needs_review: 'À vérifier',
  rejected: 'Rejeté',
  duplicate: 'Doublon refusé',
  ignored: 'Ignoré',
  imported: 'Importé',
  failed: 'Échec de l’import',
};

/** Mêmes mots que l'assistant d'import (DirectoryIngestion). */
export const PROCESSING_MODE_LABELS: Readonly<Record<string, string>> = {
  archive: 'Juste les ranger',
  process: 'Ranger et lancer le circuit',
};

const pick = (labels: Readonly<Record<string, string>>, code: string | null | undefined): string =>
  (code && labels[code]) || UNKNOWN_LABEL;

export const classificationStatusLabel = (code: string | null | undefined): string =>
  pick(CLASSIFICATION_STATUS_LABELS, code);

export const processingModeLabel = (code: string | null | undefined): string => pick(PROCESSING_MODE_LABELS, code);

/** Statut du document : libellés partagés de `getStatusLabel`, sans retomber sur le code. */
export function documentStatusLabel(code: string | null | undefined): string {
  if (!code) return UNKNOWN_LABEL;
  const label = getStatusLabel(code);
  return label === code ? UNKNOWN_LABEL : label;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

/**
 * Une ligne lisible pour une entrée d'historique : seules les clés connues sont reprises,
 * les identifiants et les autres champs techniques ne sont jamais affichés.
 */
export function auditDetailsLine(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const title = text(data.title);
  const version = text(data.version) ?? (typeof data.version === 'number' ? String(data.version) : null);
  const filename = text(data.filename);
  const path = text(data.logical_space_path);
  const note = text(data.comment) ?? text(data.resolution_reason) ?? text(data.reason);
  const parts = [
    title,
    version && `version ${version}`,
    filename && `fichier ${filename}`,
    path && `rangé dans ${path}`,
    data.workflow_relaunch_requested === true ? 'circuit relancé' : null,
    note && `« ${note} »`,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' · ') : null;
}
