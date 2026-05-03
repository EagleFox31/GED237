// frontend/services/http/client.ts
//
// Transport HTTP centralisé.
// Responsabilités UNIQUES : intercepteur de refresh token + wrapper générique
// apiCall<T> qui élimine le pattern `if (!response.ok) throw new Error()`
// répété 60+ fois dans api.ts.
//
// SRP : ce module a UNE seule raison de changer — l'évolution de la
// stratégie de transport / refresh token.

import { API_URL } from '../../constants';
import {
    getHeaders,
    persistAuthTokens,
    clearAuthSession,
    isAuthEndpoint,
} from './session';
import { buildApiError, buildNetworkError } from './errorAdapter';

export { getHeaders };

/**
 * Wrapper fetch avec refresh automatique sur 401.
 * Point d'entrée unique pour tous les appels authentifiés.
 */
export const fetchWithRefresh = async (url: string, options: RequestInit = {}): Promise<Response> => {
    let response: Response;
    try {
        response = await fetch(url, options);
    } catch (err) {
        // Erreur réseau (TypeError "Failed to fetch", abort, DNS…).
        // Pousse au bus ET rejette pour que le call site puisse aussi gérer.
        throw buildNetworkError(err);
    }

    if (response.status !== 401 || isAuthEndpoint(url)) {
        return response;
    }

    const refreshToken = sessionStorage.getItem('refresh_token');
    if (!refreshToken) {
        clearAuthSession(true);
        return response;
    }

    try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!refreshRes.ok) {
            clearAuthSession(true);
            return response;
        }

        const data = await refreshRes.json();
        const nextAccess: string = data.access_token;
        const nextRefresh: string = data.refresh_token || refreshToken;
        persistAuthTokens(nextAccess, nextRefresh);

        const newHeaders = new Headers(options.headers || {});
        newHeaders.set('Authorization', `Bearer ${nextAccess}`);
        response = await fetch(url, { ...options, headers: newHeaders });
    } catch (error) {
        console.error('Token refresh failed', error);
        clearAuthSession(true);
    }

    return response;
};

/**
 * Helper générique : élimine le `if (!response.ok) throw …` dans chaque
 * resource module. Toutes les erreurs passent systématiquement par le bus
 * (buildApiError) → couverture UX à 100 %.
 *
 * @param path       Chemin relatif à API_URL (ex: `/documents/123`)
 * @param init       RequestInit standard (method, body, headers…)
 * @param fallback   Message métier affiché si le backend ne renvoie pas de
 *                   `detail` lisible (ex: "Lecture du document impossible")
 */
export const apiCall = async <T>(
    path: string,
    init: RequestInit = {},
    fallback = 'Requête échouée',
): Promise<T> => {
    const isMultipart = init.body instanceof FormData;
    const response = await fetchWithRefresh(`${API_URL}${path}`, {
        ...init,
        headers: {
            ...getHeaders(isMultipart),
            ...(init.headers as Record<string, string> | undefined ?? {}),
        },
    });
    if (!response.ok) throw await buildApiError(response, fallback);
    return response.json() as Promise<T>;
};

/**
 * Variante de apiCall pour les endpoints qui renvoient 204 No Content ou dont
 * on n'a pas besoin du corps (DELETE, etc.).
 */
export const apiCallVoid = async (
    path: string,
    init: RequestInit = {},
    fallback = 'Requête échouée',
): Promise<void> => {
    const isMultipart = init.body instanceof FormData;
    const response = await fetchWithRefresh(`${API_URL}${path}`, {
        ...init,
        headers: {
            ...getHeaders(isMultipart),
            ...(init.headers as Record<string, string> | undefined ?? {}),
        },
    });
    if (!response.ok) throw await buildApiError(response, fallback);
};

/**
 * Variante de apiCall pour les réponses binaires (preview/download).
 * Renvoie un Blob avec son MIME type d'origine.
 */
export const apiCallBlob = async (
    path: string,
    init: RequestInit = {},
    fallback = 'Téléchargement impossible',
): Promise<Blob> => {
    const response = await fetchWithRefresh(`${API_URL}${path}`, {
        ...init,
        headers: {
            ...getHeaders(false),
            ...(init.headers as Record<string, string> | undefined ?? {}),
        },
    });
    if (!response.ok) throw await buildApiError(response, fallback);
    return response.blob();
};

/**
 * Requête sans auth (login, public tenants, health…).
 * N'utilise PAS fetchWithRefresh pour éviter de boucler sur les endpoints
 * qui ne portent pas de token.
 */
export const requestJson = async <T>(url: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw await buildApiError(response, `Requête ${url} échouée`);
    }
    return response.json() as Promise<T>;
};
