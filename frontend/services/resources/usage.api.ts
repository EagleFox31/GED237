// frontend/services/resources/usage.api.ts
//
// Domaine : usage telemetry léger (compteurs pour /reports) + dernier manifeste
// de rangement local par utilisateur (bibliothèque synchronisée).
// SRP : change uniquement si /usage/* évolue.

import { apiCall, apiCallVoid } from '../http/client';

export interface LocalOrganizeEventPayload {
  file_count: number;
  folders_created: number;
  files_unranged: number;
  strategy: 'by_type' | 'by_year' | 'by_type_year' | 'by_business_rules';
  mode: 'fsa' | 'zip';
}

export interface LocalOrganizeEventResponse {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  file_count: number;
  folders_created: number;
  files_unranged: number;
  strategy: string;
  mode: string;
  created_at: string;
}

/** Aligné sur `LocalLibraryRun` — dernier rangement stocké en JSONB côté serveur. */
export interface LocalArrangementSnapshotPayload {
  id: string;
  created_at: number;
  destination: string;
  wrapper: string | null;
  strategy: string;
  mode: 'fsa' | 'zip';
  files: Array<{ name: string; folder_path: string; size: number; last_modified: number }>;
  total_files: number;
  total_folders: number;
  files_unranged: number;
}

export interface LocalArrangementSnapshotEnvelope {
  snapshot: LocalArrangementSnapshotPayload | null;
}

export const usageApi = {
  recordLocalOrganize: (
    payload: LocalOrganizeEventPayload,
  ): Promise<LocalOrganizeEventResponse> =>
    apiCall<LocalOrganizeEventResponse>(
      '/usage/local-organize',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
      'Enregistrement du rangement local impossible',
    ),

  getLocalArrangementSnapshot: (): Promise<LocalArrangementSnapshotEnvelope> =>
    apiCall<LocalArrangementSnapshotEnvelope>(
      '/usage/local-arrangement-snapshot',
      {},
      'Lecture du dernier rangement impossible',
    ),

  putLocalArrangementSnapshot: (
    payload: LocalArrangementSnapshotPayload,
  ): Promise<LocalArrangementSnapshotEnvelope> =>
    apiCall<LocalArrangementSnapshotEnvelope>(
      '/usage/local-arrangement-snapshot',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      },
      'Synchronisation du dernier rangement impossible',
    ),

  deleteLocalArrangementSnapshot: (): Promise<void> =>
    apiCallVoid(
      '/usage/local-arrangement-snapshot',
      { method: 'DELETE' },
      'Suppression du dernier rangement impossible',
    ),
};
