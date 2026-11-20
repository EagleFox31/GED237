// Règles d'affichage et de saisie des sources de collecte, sans React, testées par `npm run test:unit`.

import type { ImportProcessingMode } from '../../../../types';
import type {
  IngestionRunStatus,
  IngestionSource,
  IngestionSourceCreate,
  IngestionSourceType,
  IngestionSourceUpdate,
} from '../../../../services/resources/ingestionSources.api';

export const SOURCE_TYPE_LABELS: Record<IngestionSourceType, string> = {
  local: 'Dossier du serveur',
  smb: 'Partage réseau',
  agent: 'Agent sur un poste',
};

export const PROCESSING_MODE_LABELS: Record<ImportProcessingMode, string> = {
  archive: 'Juste les ranger',
  process: 'Les ranger et lancer le circuit',
};

export const RUN_STATUS_LABELS: Record<IngestionRunStatus, string> = {
  success: 'Réussie',
  partial: 'Incomplète',
  failed: 'Échouée',
};

/** Même motif que l'API : un nom simple, jamais un chemin. */
export const CREDENTIALS_REF_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/;

/** Collecte lancée depuis l'écran : seulement les dossiers du serveur (un agent envoie lui-même). */
export const canRunNow = (source: Pick<IngestionSource, 'source_type' | 'enabled'>): boolean =>
  source.source_type !== 'agent' && source.enabled;

/**
 * Message en clair d'un refus de collecte (409). Le serveur répond en anglais technique ;
 * un motif inconnu garde un message générique plutôt que le texte brut.
 */
export const runConflictMessage = (detail: string | undefined): string => {
  const text = (detail ?? '').toLowerCase();
  if (text.includes('already being collected')) return 'Une collecte est déjà en cours pour cette source.';
  if (text.includes('owner')) return 'Le propriétaire de cette source est désactivé. Choisissez-en un autre.';
  if (text.includes('disabled')) return 'Cette source est désactivée.';
  if (text.includes('agent')) return 'Cette source est alimentée par son agent.';
  return 'Collecte impossible pour le moment.';
};

export interface SourceForm {
  name: string;
  source_type: IngestionSourceType;
  path: string;
  credentials_ref: string;
  org_unit_id: string;
  recursive: boolean;
  processing_mode: ImportProcessingMode;
  enabled: boolean;
}

export const emptySourceForm = (): SourceForm => ({
  name: '',
  source_type: 'local',
  path: '',
  credentials_ref: '',
  org_unit_id: '',
  recursive: true,
  processing_mode: 'archive',
  enabled: true,
});

export const formFromSource = (source: IngestionSource): SourceForm => ({
  name: source.name,
  source_type: source.source_type,
  path: source.path ?? '',
  credentials_ref: source.credentials_ref ?? '',
  org_unit_id: source.org_unit_id,
  recursive: source.recursive,
  processing_mode: source.processing_mode,
  enabled: source.enabled,
});

export type SourceFormErrors = Partial<Record<'name' | 'path' | 'credentials_ref', string>>;

export const validateSourceForm = (form: SourceForm): SourceFormErrors => {
  const errors: SourceFormErrors = {};
  if (!form.name.trim()) errors.name = 'Donnez un nom à la source.';
  if (form.source_type !== 'agent' && !form.path.trim()) errors.path = 'Indiquez le dossier à collecter.';
  const ref = form.credentials_ref.trim();
  if (form.source_type === 'smb' && ref && (!CREDENTIALS_REF_PATTERN.test(ref) || ref.includes('..'))) {
    errors.credentials_ref = 'Lettres, chiffres, « _ », « - » ou « . » seulement, sans « .. ».';
  }
  return errors;
};

/** Corps de création : seuls les champs du type choisi ; service vide = celui de l'administrateur. */
export const toCreatePayload = (form: SourceForm): IngestionSourceCreate => {
  const payload: IngestionSourceCreate = {
    name: form.name.trim(),
    source_type: form.source_type,
    recursive: form.recursive,
    processing_mode: form.processing_mode,
    enabled: form.enabled,
  };
  if (form.source_type !== 'agent') payload.path = form.path.trim();
  if (form.source_type === 'smb' && form.credentials_ref.trim()) payload.credentials_ref = form.credentials_ref.trim();
  if (form.org_unit_id) payload.org_unit_id = form.org_unit_id;
  return payload;
};

/** Corps de modification : seulement ce qui a changé (`null` si rien, pas de requête). */
export const toUpdatePayload = (form: SourceForm, source: IngestionSource): IngestionSourceUpdate | null => {
  const next = toCreatePayload(form);
  const payload: IngestionSourceUpdate = {};
  if (next.name !== source.name) payload.name = next.name;
  if (source.source_type !== 'agent' && next.path !== (source.path ?? undefined)) payload.path = next.path;
  if (source.source_type === 'smb') {
    const ref = next.credentials_ref ?? null;
    if (ref !== source.credentials_ref) payload.credentials_ref = ref;
  }
  if (form.org_unit_id && form.org_unit_id !== source.org_unit_id) payload.org_unit_id = form.org_unit_id;
  if (next.recursive !== source.recursive) payload.recursive = next.recursive;
  if (next.processing_mode !== source.processing_mode) payload.processing_mode = next.processing_mode;
  if (next.enabled !== source.enabled) payload.enabled = next.enabled;
  return Object.keys(payload).length ? payload : null;
};

/** Date et heure d'une collecte : « 20/11/2026 10:32 ». */
export const formatRunAt = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Résumé d'une collecte : « 12 ajoutés, 3 ignorés, 1 erreur ». */
export const runSummary = (report: { imported: number; skipped: number; error_count: number }): string => {
  const plural = (n: number, one: string, many: string) => `${n.toLocaleString('fr-FR')} ${n > 1 ? many : one}`;
  return [
    plural(report.imported, 'ajouté', 'ajoutés'),
    plural(report.skipped, 'ignoré', 'ignorés'),
    plural(report.error_count, 'erreur', 'erreurs'),
  ].join(', ');
};
