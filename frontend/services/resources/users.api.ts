// frontend/services/resources/users.api.ts
//
// Domaine : gestion des utilisateurs (CRUD, liste plateforme).
// SRP : change uniquement si le contrat /users/* évolue.

import { apiCall, apiCallVoid, type ApiCallOptions } from '../http/client';
import type { BackendUser } from './auth.api';
import type { HierarchyPerson } from '../../lib/hierarchy';

// 404 (hors périmètre, autre institution) : message affiché dans le bloc, pas dans le bandeau global.
const HIERARCHY_OPTIONS = { handledStatuses: [404] } as const;

export const usersApi = {
    /** Profil de la personne connectée (nom, rôle à jour). */
    getMe: (options: ApiCallOptions = {}): Promise<BackendUser> =>
        apiCall<BackendUser>('/users/me', {}, 'Lecture du profil impossible', options),

    /** Chefs de la personne, du N+1 au plus haut. */
    getHierarchyUp: (id: string): Promise<HierarchyPerson[]> =>
        apiCall<HierarchyPerson[]>(`/users/${id}/hierarchy-up`, {}, 'Lecture du rattachement impossible', HIERARCHY_OPTIONS),

    /** Personnes qui lui rendent compte directement (un seul niveau). */
    getHierarchyDown: (id: string): Promise<HierarchyPerson[]> =>
        apiCall<HierarchyPerson[]>(`/users/${id}/hierarchy-down`, {}, 'Lecture du rattachement impossible', HIERARCHY_OPTIONS),

    getUsers: (): Promise<any[]> =>
        // Trailing slash : la route FastAPI est déclarée `/users/` ; sans le
        // slash le serveur répond 307 (redirect) → 2 round-trips au lieu d'un.
        apiCall<any[]>('/users/', {}, 'Récupération des utilisateurs impossible'),

    // Promise<any> volontaire : certains backends retournent {items, results, total}
    // tandis que d'autres renvoient un tableau brut.
    getPlatformUsers: (params?: { tenant_id?: string; limit?: number }): Promise<any> => {
        const q = new URLSearchParams();
        if (params?.tenant_id) q.set('tenant_id', params.tenant_id);
        if (params?.limit) q.set('limit', String(params.limit));
        const qs = q.toString() ? `?${q.toString()}` : '';
        return apiCall<any>(`/users/${qs}`, {}, 'Récupération des utilisateurs plateforme impossible');
    },

    createUser: (data: any): Promise<any> =>
        apiCall<any>(
            '/users/',
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

    // ── Actions admin (cf. backend/app/api/v1/endpoints/users.py)
    //    Conçues pour la page Agents & Rôles : reset password, soft-delete, reset MFA.

    getAssignableRoles: (): Promise<Array<{ id: number; code: string; name: string; hierarchy_level: number }>> =>
        apiCall(
            '/users/assignable-roles',
            {},
            'Récupération des rôles assignables impossible',
        ),

    resetUserPassword: (id: string): Promise<{ temporary_password: string; message: string }> =>
        apiCall(
            `/users/${id}/reset-password`,
            { method: 'POST' },
            'Réinitialisation du mot de passe impossible',
        ),

    toggleUserActive: (id: string): Promise<any> =>
        apiCall(
            `/users/${id}/toggle-active`,
            { method: 'POST' },
            'Changement de statut impossible',
        ),

    disableUserMfa: (id: string): Promise<any> =>
        apiCall(
            `/users/${id}/disable-mfa`,
            { method: 'POST' },
            'Réinitialisation du 2FA impossible',
        ),
};
