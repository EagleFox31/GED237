// frontend/services/http/session.ts
//
// Persistance et cycle de vie de la session côté navigateur.
// Isolé du transport HTTP pour pouvoir évoluer indépendamment (rotation token,
// MFA renforcée, etc.) sans toucher 80 endpoints.
//
// SRP : ce module a UNE seule raison de changer — l'évolution du modèle
// d'authentification côté client.

import { isSafeInternalPath } from './safePath';

const APP_BASE_PATH = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token', 'token', 'user_profile'] as const;

const AUTH_ENDPOINT_SEGMENTS = ['/auth/login', '/auth/verify-otp', '/auth/refresh', '/auth/logout'];

export const isAuthEndpoint = (url: string): boolean =>
    AUTH_ENDPOINT_SEGMENTS.some((segment) => url.includes(segment));

export const redirectToLogin = (): void => {
    if (typeof window === 'undefined') return;
    const loginPath = `${APP_BASE_PATH}/login`;
    if (window.location.pathname !== loginPath) {
        window.location.href = loginPath;
    }
};

const DESTINATION_KEY = 'post_login_destination';

/**
 * Mémorise la page en cours quand la session expire, pour y revenir après la
 * reconnexion. Liée à l'utilisateur : un autre compte ne la reprend pas.
 */
const rememberDestination = (): void => {
    if (typeof window === 'undefined') return;
    try {
        const { pathname, search, hash } = window.location;
        const inApp = APP_BASE_PATH && pathname.startsWith(APP_BASE_PATH) ? pathname.slice(APP_BASE_PATH.length) : pathname;
        if (!isSafeInternalPath(inApp) || inApp === '/login' || inApp === '/') return;
        const profile = JSON.parse(sessionStorage.getItem('user_profile') || 'null');
        if (!profile?.id) return;
        sessionStorage.setItem(DESTINATION_KEY, JSON.stringify({ path: `${inApp}${search}${hash}`, userId: profile.id }));
    } catch {
        // Stockage indisponible : on retombe sur la page d'accueil du profil.
    }
};

/** Retourne la page mémorisée (une seule fois) si elle appartient à cet utilisateur. */
export const takePostLoginDestination = (userId: string | undefined): string | null => {
    try {
        const raw = sessionStorage.getItem(DESTINATION_KEY);
        sessionStorage.removeItem(DESTINATION_KEY);
        if (!raw || !userId) return null;
        const saved = JSON.parse(raw) as { path?: string; userId?: string };
        return saved.userId === userId && isSafeInternalPath(saved.path) ? saved.path : null;
    } catch {
        return null;
    }
};

export const clearAuthSession = (redirect = false): void => {
    if (redirect) rememberDestination();
    else sessionStorage.removeItem(DESTINATION_KEY);
    AUTH_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
    if (redirect) redirectToLogin();
};

export const persistAuthTokens = (accessToken: string, refreshToken: string): void => {
    sessionStorage.setItem('access_token', accessToken);
    sessionStorage.setItem('refresh_token', refreshToken);
    sessionStorage.setItem('token', accessToken);
};

/** En-têtes HTTP (Authorization + Content-Type, sauf multipart). */
export const getHeaders = (isMultipart = false): Record<string, string> => {
    const token = sessionStorage.getItem('access_token') || sessionStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isMultipart) headers['Content-Type'] = 'application/json';
    return headers;
};
