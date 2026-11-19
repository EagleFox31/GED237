// frontend/services/resources/delegations.api.ts
//
// Domaine : délégation pendant une absence (L4).
// SRP : change uniquement si le contrat /delegations/* évolue.
// 403 / 409 / 422 : le `detail` du serveur est en français et s'affiche tel quel (bus global).

import { apiCall } from '../http/client';
import type { Delegation, DelegationCreate, DelegationStatus } from '../../types';
import type { DelegationCandidate } from '../../lib/delegation';

export const delegationsApi = {
    /**
     * Agents actifs d'un service, hors appelant (absent possible ; remplaçant si `can_stand_in`).
     * Sans `orgUnitId` : le service de l'appelant. Un autre service est réservé à l'institution (403 sinon).
     */
    getCandidates: (orgUnitId?: string): Promise<DelegationCandidate[]> =>
        apiCall<DelegationCandidate[]>(
            `/delegations/candidates${orgUnitId ? `?org_unit_id=${encodeURIComponent(orgUnitId)}` : ''}`,
            {},
            'Récupération des agents du service impossible',
        ),

    getDelegations: (
        params: { status?: DelegationStatus; delegator_id?: string; delegate_id?: string } = {},
    ): Promise<Delegation[]> => {
        const q = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value) q.append(key, value);
        });
        const qs = q.toString();
        return apiCall<Delegation[]>(
            `/delegations${qs ? `?${qs}` : ''}`,
            {},
            'Récupération des remplacements impossible',
        );
    },

    /**
     * Délégations en cours ou à venir qui me concernent (absent ou intérimaire).
     * Silencieux : sert d'enrichissement à « Mes tâches », qui reste utilisable sans.
     */
    getMyDelegations: (): Promise<Delegation[]> =>
        apiCall<Delegation[]>('/delegations/mine', {}, 'Récupération de vos remplacements impossible', { silent: true }),

    /** 201 si créée, 200 si la même demande est rejouée (aucun doublon). */
    createDelegation: (body: DelegationCreate): Promise<Delegation> =>
        apiCall<Delegation>(
            '/delegations',
            { method: 'POST', body: JSON.stringify(body) },
            'Création du remplacement impossible',
        ),

    /** Idempotent : une délégation déjà révoquée ou terminée répond 200 sans écriture. */
    revokeDelegation: (id: string): Promise<Delegation> =>
        apiCall<Delegation>(
            `/delegations/${id}/revoke`,
            { method: 'POST' },
            'Annulation du remplacement impossible',
        ),
};
