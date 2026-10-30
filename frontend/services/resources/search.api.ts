// frontend/services/resources/search.api.ts
//
// Domaine : recherche de documents.
// SRP : change uniquement si le contrat /search/* évolue.

import { apiCall } from '../http/client';

export const searchApi = {
    searchDocuments: (query: string, filters: Record<string, string> = {}): Promise<any> => {
        const q = new URLSearchParams();
        if (query) q.append('q', query);
        Object.entries(filters).forEach(([key, value]) => {
            if (value) q.append(key, value);
        });
        return apiCall<any>(`/search?${q.toString()}`, {}, 'Recherche impossible');
    },
};
