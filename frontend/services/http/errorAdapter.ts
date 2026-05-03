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

/**
 * Construit une ApiError typée depuis une Response non-ok, la pousse au bus
 * global (sauf 401 déjà géré par le refresh interceptor), et la retourne pour
 * que le call site puisse aussi la gérer localement.
 */
export const buildApiError = async (response: Response, fallback: string): Promise<ApiError> => {
    let apiErr = await apiErrorFromResponse(response);
    // Si le backend n'a pas renvoyé de detail lisible, utiliser le fallback métier.
    if (!apiErr.userMessage || apiErr.userMessage === 'Erreur.') {
        apiErr = new ApiError({ ...apiErr.raw, detail: fallback });
    }
    // Les 401 sont gérés par fetchWithRefresh (refresh ou logout) :
    // pas de toast intermédiaire redondant.
    if (apiErr.status !== 401) {
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
