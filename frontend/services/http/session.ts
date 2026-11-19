// frontend/services/http/session.ts
//
// Persistance et cycle de vie de la session côté navigateur.
// Isolé du transport HTTP pour pouvoir évoluer indépendamment (rotation token,
// MFA renforcée, etc.) sans toucher 80 endpoints.
//
// SRP : ce module a UNE seule raison de changer — l'évolution du modèle
// d'authentification côté client.

import { isSafeInternalPath } from './safePath';
import { accountKeyOf } from './accountKey';

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
// Hors AUTH_STORAGE_KEYS : survit au nettoyage de la session pour être lu par l'écran de connexion.
const SESSION_EXPIRED_KEY = 'post_login_session_expired';

/** Marque une session refusée par le serveur : l'écran de connexion l'annoncera une fois. */
export const markSessionExpired = (): void => {
    try {
        sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
    } catch {
        // Stockage indisponible : la redirection a lieu, sans message.
    }
};

/** Lecture sans effet de bord (sûre dans un initialiseur React). */
export const isSessionExpiredNoticePending = (): boolean => {
    try {
        return sessionStorage.getItem(SESSION_EXPIRED_KEY) === '1';
    } catch {
        return false;
    }
};

/** Retire le marqueur une fois le message affiché : il n'apparaît qu'une fois. */
export const clearSessionExpiredNotice = (): void => {
    try {
        sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    } catch {
        // Rien à faire.
    }
};

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
        const accountKey = accountKeyOf(JSON.parse(sessionStorage.getItem('user_profile') || 'null'));
        if (!accountKey) return;
        sessionStorage.setItem(DESTINATION_KEY, JSON.stringify({ path: `${inApp}${search}${hash}`, userId: accountKey }));
    } catch {
        // Stockage indisponible : on retombe sur la page d'accueil du profil.
    }
};

/** Retourne la page mémorisée (une seule fois) si elle appartient à cet utilisateur. */
export const takePostLoginDestination = (accountKey: string | undefined): string | null => {
    try {
        const raw = sessionStorage.getItem(DESTINATION_KEY);
        sessionStorage.removeItem(DESTINATION_KEY);
        if (!raw || !accountKey) return null;
        const saved = JSON.parse(raw) as { path?: string; userId?: string };
        return saved.userId === accountKey && isSafeInternalPath(saved.path) ? saved.path : null;
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
    // Session de nouveau valide : pas de message « expirée » périmé à la prochaine déconnexion.
    clearSessionExpiredNotice();
};

/** En-têtes HTTP (Authorization + Content-Type, sauf multipart). */
export const getHeaders = (isMultipart = false): Record<string, string> => {
    const token = sessionStorage.getItem('access_token') || sessionStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!isMultipart) headers['Content-Type'] = 'application/json';
    return headers;
};
