// frontend/services/resources/myDocuments.api.ts
//
// Mes documents (#165) : favoris, récemment ouverts, partagés avec moi. Les listes sont
// recalculées par le serveur selon ce que l'agent voit (un document en corbeille en sort).

import { API_URL } from '../../constants';
import { apiCallVoid, fetchWithRefresh, getHeaders } from '../http/client';
import { buildApiError } from '../http/errorAdapter';

export type MyDocumentsList = 'favorites' | 'recent' | 'shared';
export type SharedReason = 'assigned' | 'visible';

export interface MyDocument {
  id: string;
  title: string;
  status: string;
  org_unit_id?: string | null;
  document_category_id?: string | null;
  category_name?: string | null;
  owner_name?: string | null;
  created_at: string;
  updated_at: string;
  is_favorite: boolean;
  /** Date d'ajout aux favoris, ou de dernière ouverture (récents). */
  marked_at?: string | null;
  /** Partagés seulement : une étape en cours m'est assignée, ou je vois le document. */
  reason?: SharedReason | null;
}

export interface MyDocumentsPage {
  items: MyDocument[];
  /** Nombre total de lignes (en-tête X-Total-Count). */
  total: number;
}

const FAILURE: Record<MyDocumentsList, string> = {
  favorites: 'Récupération des favoris impossible',
  recent: 'Récupération des documents récents impossible',
  shared: 'Récupération des documents partagés impossible',
};

export const myDocumentsApi = {
  list: async (
    list: MyDocumentsList,
    skip = 0,
    limit = 20,
    reason?: SharedReason,
  ): Promise<MyDocumentsPage> => {
    const query = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (list === 'shared' && reason) query.set('reason', reason);
    const response = await fetchWithRefresh(`${API_URL}/me/${list}?${query.toString()}`, {
      headers: getHeaders(false),
    });
    if (!response.ok) throw await buildApiError(response, FAILURE[list]);
    const items = (await response.json()) as MyDocument[];
    const header = response.headers.get('X-Total-Count');
    const total = header === null ? NaN : Number(header);
    return { items, total: Number.isInteger(total) && total >= 0 ? total : items.length };
  },

  /** Idempotent côté serveur (204), comme le retrait. */
  addFavorite: (documentId: string): Promise<void> =>
    apiCallVoid(`/me/favorites/${documentId}`, { method: 'PUT' }, 'Ajout aux favoris impossible'),

  removeFavorite: (documentId: string): Promise<void> =>
    apiCallVoid(`/me/favorites/${documentId}`, { method: 'DELETE' }, 'Retrait des favoris impossible'),

  clearRecent: (): Promise<void> =>
    apiCallVoid('/me/recent', { method: 'DELETE' }, "Effacement de l'historique impossible"),
};
