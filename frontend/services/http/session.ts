// frontend/services/http/session.ts
//
// Persistance et cycle de vie de la session côté navigateur.
// Isolé du transport HTTP pour pouvoir évoluer indépendamment (rotation token,
// MFA renforcée, etc.) sans toucher 80 endpoints.
//
// SRP : ce module a UNE seule raison de changer — l'évolution du modèle
// d'authentification côté client.

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

export const clearAuthSession = (redirect = false): void => {
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
