// frontend/services/resources/users.api.ts
//
// Domaine : gestion des utilisateurs (CRUD, liste plateforme).
// SRP : change uniquement si le contrat /users/* évolue.

import { apiCall, apiCallVoid } from '../http/client';

export const usersApi = {
    getUsers: (): Promise<any[]> =>
        apiCall<any[]>('/users', {}, 'Récupération des utilisateurs impossible'),

    // Promise<any> volontaire : certains backends retournent {items, results, total}
    // tandis que d'autres renvoient un tableau brut.
    getPlatformUsers: (params?: { tenant_id?: string; limit?: number }): Promise<any> => {
        const q = new URLSearchParams();
        if (params?.tenant_id) q.set('tenant_id', params.tenant_id);
        if (params?.limit) q.set('limit', String(params.limit));
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiCall<any>(`/users${qs}`, {}, 'Récupération des utilisateurs plateforme impossible');
    },

    createUser: (data: any): Promise<any> =>
        apiCall<any>(
            '/users',
            { method: 'POST', body: JSON.stringify(data) },
            'Création de l\'utilisateur impossible',
        ),

    updateUser: (id: string, data: any): Promise<any> =>
        apiCall<any>(
            `/users/${id}`,
            { method: 'PATCH', body: JSON.stringify(data) },
            'Mise à jour de l\'utilisateur impossible',
        ),

    deleteUser: async (id: string): Promise<true> => {
        await apiCallVoid(`/users/${id}`, { method: 'DELETE' }, 'Suppression de l\'utilisateur impossible');
        return true;
    },
};
