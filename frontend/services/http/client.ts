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
    markSessionExpired,
} from './session';
import { buildApiError, buildNetworkError } from './errorAdapter';
import { refreshOutcome } from './refreshOutcome';

/** Session refusée par le serveur : déconnexion, avec le message « session expirée » à l'écran de connexion. */
const expireSession = (): void => {
    markSessionExpired();
    clearAuthSession(true);
};

export { getHeaders };

/**
 * Wrapper fetch avec refresh automatique sur 401.
 * Point d'entrée unique pour tous les appels authentifiés.
 */
export const fetchWithRefresh = async (
    url: string,
    options: RequestInit = {},
    silent = false,
): Promise<Response> => {
    let response: Response;
    try {
        response = await fetch(url, options);
    } catch (err) {
        // Erreur réseau (TypeError "Failed to fetch", abort, DNS…).
        // Pousse au bus (sauf appelant silencieux) ET rejette pour que le call site puisse aussi gérer.
        throw buildNetworkError(err, silent);
    }

    if (response.status !== 401 || isAuthEndpoint(url)) {
        return response;
    }

    const refreshToken = sessionStorage.getItem('refresh_token');
    if (!refreshToken) {
        expireSession();
        return response;
    }

    let refreshRes: Response;
    try {
        refreshRes = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });
    } catch (err) {
        // Coupure réseau pendant le renouvellement : la session reste, l'erreur passe par le bus
        // et la prochaine action retente le renouvellement.
        throw buildNetworkError(err);
    }

    const outcome = refreshOutcome(refreshRes.status);
    if (outcome === 'expired') {
        expireSession();
        return response;
    }
    // 429 / 5xx : session gardée ; l'appelant reçoit l'erreur du serveur, affichée par le bus.
    if (outcome === 'transient') return refreshRes;

    let nextAccess: string;
    let nextRefresh: string;
    try {
        const data = await refreshRes.json();
        nextAccess = data.access_token;
        nextRefresh = data.refresh_token || refreshToken;
    } catch (err) {
        // Réponse tronquée (connexion coupée en cours de lecture) : même traitement qu'une coupure.
        throw buildNetworkError(err);
    }
    persistAuthTokens(nextAccess, nextRefresh);

    const newHeaders = new Headers(options.headers || {});
    newHeaders.set('Authorization', `Bearer ${nextAccess}`);
    try {
        return await fetch(url, { ...options, headers: newHeaders });
    } catch (err) {
        throw buildNetworkError(err);
    }
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
export interface ApiCallOptions {
    /** Statuts que l'appelant affiche lui-même : l'erreur est levée sans toast global. */
    handledStatuses?: readonly number[];
    /** L'appelant affiche lui-même toute erreur (bilan d'une action groupée) : aucun toast, réseau compris. */
    silent?: boolean;
}

const quietStatuses = (options: ApiCallOptions, status: number): readonly number[] =>
    options.silent ? [status] : options.handledStatuses ?? [];

export const apiCall = async <T>(
    path: string,
    init: RequestInit = {},
    fallback = 'Requête échouée',
    options: ApiCallOptions = {},
): Promise<T> => {
    const isMultipart = init.body instanceof FormData;
    const response = await fetchWithRefresh(`${API_URL}${path}`, {
        ...init,
        headers: {
            ...getHeaders(isMultipart),
            ...(init.headers as Record<string, string> | undefined ?? {}),
        },
    }, options.silent);
    if (!response.ok) throw await buildApiError(response, fallback, quietStatuses(options, response.status));
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

/** Octets reçus, et total annoncé par le serveur (Content-Length) ou null. */
export type BlobProgress = (loaded: number, total: number | null) => void;

/** Lit le corps morceau par morceau pour signaler la progression ; même Blob que `response.blob()`. */
const readBlobWithProgress = async (response: Response, onProgress: BlobProgress): Promise<Blob> => {
    const reader = response.body?.getReader();
    if (!reader) return response.blob();
    const declared = Number(response.headers.get('Content-Length'));
    const total = Number.isFinite(declared) && declared > 0 ? declared : null;
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    onProgress(0, total);
    for (;;) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.byteLength;
        onProgress(loaded, total);
    }
    return new Blob(chunks as BlobPart[], { type: response.headers.get('Content-Type') ?? '' });
};

/**
 * Variante de apiCall pour les réponses binaires (preview/download).
 * Renvoie un Blob avec son MIME type d'origine ; `onProgress` suit le téléchargement.
 */
export const apiCallBlob = async (
    path: string,
    init: RequestInit = {},
    fallback = 'Téléchargement impossible',
    options: ApiCallOptions = {},
    onProgress?: BlobProgress,
): Promise<Blob> => {
    const response = await fetchWithRefresh(`${API_URL}${path}`, {
        ...init,
        headers: {
            ...getHeaders(false),
            ...(init.headers as Record<string, string> | undefined ?? {}),
        },
    }, options.silent);
    if (!response.ok) throw await buildApiError(response, fallback, quietStatuses(options, response.status));
    return onProgress ? readBlobWithProgress(response, onProgress) : response.blob();
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
