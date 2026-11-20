// frontend/services/resources/ingestionSources.api.ts
//
// Sources de collecte (F-NEXT-01/03) : dossiers du serveur (local, partage réseau) ou agent
// installé sur un poste, collectés vers la GED. Réservé aux administrateurs (API : ingestion_sources).

import { apiCall, apiCallVoid } from '../http/client';
import type { StatusMessages } from '../http/errorAdapter';
import type { ImportProcessingMode } from '../../types';

export type IngestionSourceType = 'local' | 'smb' | 'agent';
export type IngestionRunStatus = 'success' | 'partial' | 'failed';

export interface IngestionRunReport {
  total_found: number;
  imported: number;
  skipped: number;
  error_count: number;
  duplicate_count?: number;
}

export interface IngestionSource {
  id: string;
  name: string;
  source_type: IngestionSourceType;
  path: string | null;
  /** Nom du secret serveur qui monte le partage (smb), jamais le secret lui-même. */
  credentials_ref: string | null;
  /** Début de la clé d'un agent, pour distinguer les clés ; la clé n'est lisible qu'une fois. */
  agent_key_prefix: string | null;
  org_unit_id: string;
  owner_id: string;
  document_category_id: string | null;
  recursive: boolean;
  processing_mode: ImportProcessingMode;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: IngestionRunStatus | null;
  last_run_report: IngestionRunReport | null;
  created_at: string;
  updated_at: string;
}

/** Réponse de création ou de nouvelle clé : seul moment où la clé d'un agent est lisible. */
export interface IngestionSourceWithKey extends IngestionSource {
  agent_key: string | null;
}

export interface IngestionSourceCreate {
  name: string;
  source_type: IngestionSourceType;
  path?: string | null;
  credentials_ref?: string | null;
  org_unit_id?: string | null;
  recursive: boolean;
  processing_mode: ImportProcessingMode;
  enabled: boolean;
}

export type IngestionSourceUpdate = Partial<Omit<IngestionSourceCreate, 'source_type'>>;

export interface IngestionRunResult extends IngestionRunReport {
  source_id: string;
  status: IngestionRunStatus;
  ran_at: string;
}

const BASE = '/ingestion/sources';

/** Messages courts des erreurs du formulaire ; le 403 « dossier hors des emplacements autorisés » vient du serveur. */
const FORM_MESSAGES: StatusMessages = {
  400: 'Service ou propriétaire introuvable ou désactivé.',
  409: 'Une source porte déjà ce nom.',
  422: 'Vérifiez les champs du formulaire.',
};

export const ingestionSourcesApi = {
  list: (): Promise<IngestionSource[]> =>
    apiCall<IngestionSource[]>(`${BASE}/`, {}, 'Récupération des sources impossible'),

  create: (payload: IngestionSourceCreate): Promise<IngestionSourceWithKey> =>
    apiCall<IngestionSourceWithKey>(
      `${BASE}/`,
      { method: 'POST', body: JSON.stringify(payload) },
      'Création de la source impossible',
      { statusMessages: FORM_MESSAGES },
    ),

  update: (id: string, payload: IngestionSourceUpdate): Promise<IngestionSource> =>
    apiCall<IngestionSource>(
      `${BASE}/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      'Modification de la source impossible',
      { statusMessages: FORM_MESSAGES },
    ),

  remove: (id: string): Promise<void> =>
    apiCallVoid(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' }, 'Suppression de la source impossible', {
      statusMessages: { 404: 'Cette source n’existe plus.' },
    }),

  rotateKey: (id: string): Promise<IngestionSourceWithKey> =>
    apiCall<IngestionSourceWithKey>(
      `${BASE}/${encodeURIComponent(id)}/rotate-key`,
      { method: 'POST' },
      'Nouvelle clé impossible',
    ),

  /**
   * Collecte immédiate (synchrone). Le 409 (agent, source désactivée, propriétaire désactivé,
   * collecte déjà en cours) est affiché par la page, sur la ligne de la source.
   */
  run: (id: string): Promise<IngestionRunResult> =>
    apiCall<IngestionRunResult>(
      `${BASE}/${encodeURIComponent(id)}/run`,
      { method: 'POST' },
      'Collecte impossible',
      { handledStatuses: [409] },
    ),
};
