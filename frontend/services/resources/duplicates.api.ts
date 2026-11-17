// frontend/services/resources/duplicates.api.ts
//
// Doublons (#171) : groupes de documents au contenu identique (même empreinte SHA-256),
// on en garde un, les autres partent à la corbeille. Rien n'est supprimé définitivement ici.

import { API_URL } from '../../constants';
import { apiCall, fetchWithRefresh, getHeaders } from '../http/client';
import { buildApiError } from '../http/errorAdapter';

export interface DuplicateMember {
  id: string;
  title: string;
  status: string;
  org_unit_id: string;
  org_unit_name?: string | null;
  owner_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  logical_space_path?: string | null;
  created_at: string;
}

export interface DuplicateGroup {
  checksum: string;
  count: number;
  /** Le plus ancien du groupe (l'original), proposé par défaut. */
  suggested_keep_id: string;
  /** Du plus ancien au plus récent. */
  documents: DuplicateMember[];
}

export interface DuplicateGroupsPage {
  groups: DuplicateGroup[];
  /** Nombre total de groupes visibles (en-tête X-Total-Count). */
  total: number;
}

export interface DuplicateResolution {
  kept_id: string;
  trashed: string[];
  already_trashed: string[];
}

export const duplicatesApi = {
  getDuplicateGroups: async (skip = 0, limit = 20): Promise<DuplicateGroupsPage> => {
    const response = await fetchWithRefresh(`${API_URL}/duplicates?skip=${skip}&limit=${limit}`, {
      headers: getHeaders(false),
    });
    if (!response.ok) throw await buildApiError(response, 'Récupération des doublons impossible');
    const groups = (await response.json()) as DuplicateGroup[];
    const header = response.headers.get('X-Total-Count');
    const total = header === null ? NaN : Number(header);
    return { groups, total: Number.isInteger(total) && total >= 0 ? total : groups.length };
  },

  /** Garde `keepId`, met `trashIds` à la corbeille (tout ou rien côté serveur). */
  resolveDuplicates: (keepId: string, trashIds: string[]): Promise<DuplicateResolution> =>
    apiCall<DuplicateResolution>(
      '/duplicates/resolve',
      { method: 'POST', body: JSON.stringify({ keep_id: keepId, trash_ids: trashIds }) },
      'Mise à la corbeille des doublons impossible',
      { 403: "Vous n'avez pas le droit de supprimer un de ces documents." },
    ),
};
