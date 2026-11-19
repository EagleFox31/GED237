// frontend/services/http/errorAdapter.ts
//
// Mapping centralisé HTTPResponse → ApiError (RFC 9457).
// Plus aucun `if (!response.ok) throw new Error('...')` inline dans les
// resource modules — ils appellent tous buildApiError(), qui pousse au bus
// global pour le rendu UX.
//
// SRP : ce module a UNE seule raison de changer — l'évolution du contrat
// d'erreur entre le backend et le bus d'erreur frontend.

import { ApiError, apiErrorFromResponse, apiErrorFromException, pushApiError } from '../../lib/errors';

export type { ApiError };

/** Message court à afficher pour un code HTTP donné, à la place du détail technique du serveur. */
export type StatusMessages = Partial<Record<number, string>>;

export interface ApiErrorOptions {
    /** Statuts que l'appelant affiche lui-même : l'erreur est levée sans toast global. */
    handledStatuses?: readonly number[];
    /** Message court par code HTTP, affiché par le bus au lieu du détail du serveur. */
    statusMessages?: StatusMessages;
    /** L'appelant résume lui-même les échecs (action groupée) : aucun toast global, quel que soit le statut. */
    silent?: boolean;
}

/**
 * Construit une ApiError typée depuis une Response non-ok, la pousse au bus
 * global (sauf 401 déjà géré par le refresh interceptor), et la retourne pour
 * que le call site puisse aussi la gérer localement.
 */
export const buildApiError = async (
    response: Response,
    fallback: string,
    { handledStatuses = [], statusMessages, silent = false }: ApiErrorOptions = {},
): Promise<ApiError> => {
    let apiErr = await apiErrorFromResponse(response);
    const override = statusMessages?.[apiErr.status];
    if (override) {
        apiErr = new ApiError({ ...apiErr.raw, detail: override });
    } else if (!apiErr.userMessage || apiErr.userMessage === 'Erreur.') {
        // Si le backend n'a pas renvoyé de detail lisible, utiliser le fallback métier.
        apiErr = new ApiError({ ...apiErr.raw, detail: fallback });
    }
    // Les 401 sont gérés par fetchWithRefresh (refresh ou logout) :
    // pas de toast intermédiaire redondant. Les statuts « handled » sont
    // affichés par l'appelant avec son propre message : pas de toast non plus.
    if (!silent && apiErr.status !== 401 && !handledStatuses.includes(apiErr.status)) {
        pushApiError(apiErr);
    }
    return apiErr;
};

/**
 * Pousse une erreur réseau (TypeError "Failed to fetch", abort, DNS…) au bus
 * et retourne l'ApiError pour un éventuel re-throw local.
 */
export const buildNetworkError = (err: unknown): ApiError => {
    const apiErr = apiErrorFromException(err);
    pushApiError(apiErr);
    return apiErr;
};
