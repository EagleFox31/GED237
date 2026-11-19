// frontend/services/resources/auth.api.ts
//
// Domaine : authentification (login, OTP, logout, changement de mot de passe).
// SRP : change uniquement si le contrat /auth/* évolue.

import { API_URL } from '../../constants';
import { apiCall, fetchWithRefresh } from '../http/client';
import { clearAuthSession, getHeaders } from '../http/session';
import { buildApiError } from '../http/errorAdapter';
import { apiErrorFromResponse } from '../../lib/errors';
import type { SecurityNotice } from '../../components/auth/securityNotices';

// ── DTOs ────────────────────────────────────────────────────────────────────

export interface LoginPayload {
    institution: string;
    matricule: string;
    password: string;
}

export interface OTPVerifyPayload {
    session_token: string;
    otp: string;
}

export interface LoginResponse {
    session_token: string;
    otp?: string;
    /** Origine du code : "totp" (application d'authentification), "email", "dev_response". */
    method?: string;
}

/** verify-otp d'un rôle qui doit utiliser l'application et n'en a pas encore. */
export interface TotpEnrolmentRequired {
    status: 'totp_enrolment_required';
    enrolment_token: string;
    expires_in: number;
    message: string;
}

export interface TotpSecret {
    secret: string;
    otpauth_uri: string;
}

export interface BackendUser {
    id: string;
    matricule: string;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    full_name: string;
    role: string;
    role_label: string;
    tenant_id: string;
    org_unit_id?: string | null;
    must_change_password?: boolean;
}

export interface AuthSession {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    user: BackendUser;
    /** Changements de l'application depuis la connexion précédente, donnés une seule fois. */
    security_notices?: SecurityNotice[];
}

export type OtpVerifyResult = AuthSession | TotpEnrolmentRequired;

export const isEnrolmentRequired = (result: OtpVerifyResult): result is TotpEnrolmentRequired =>
    'status' in result && result.status === 'totp_enrolment_required';

/**
 * Écrans avant session (connexion, code, enrôlement) : l'erreur n'est PAS poussée au bus
 * global (dont le toast montrerait le détail anglais de l'API) ; l'écran affiche son propre
 * message français (components/auth/authErrors.ts).
 */
const postJson = async <T>(path: string, body: unknown): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw await apiErrorFromResponse(response);
    return response.json() as Promise<T>;
};

// ── API ─────────────────────────────────────────────────────────────────────

export const authApi = {
    login: (payload: LoginPayload): Promise<LoginResponse> =>
        postJson<LoginResponse>('/auth/login', payload),

    verifyOTP: (payload: OTPVerifyPayload): Promise<OtpVerifyResult> =>
        postJson<OtpVerifyResult>('/auth/verify-otp', payload),

    /** Nouveau code e-mail pour la même session de connexion (409 sur une session TOTP). */
    resendOTP: (session_token: string): Promise<LoginResponse> =>
        postJson<LoginResponse>('/auth/resend-otp', { session_token }),

    /** Enrôlement imposé : secret à scanner, montré une seule fois. */
    startTotpEnrolment: (enrolment_token: string): Promise<TotpSecret> =>
        postJson<TotpSecret>('/auth/totp/enrolment/start', { enrolment_token }),

    /** Premier code de l'application : termine la connexion. */
    confirmTotpEnrolment: (enrolment_token: string, code: string): Promise<AuthSession> =>
        postJson<AuthSession>('/auth/totp/enrolment/confirm', { enrolment_token, code }),

    logout: async (): Promise<any> => {
        const response = await fetchWithRefresh(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: getHeaders(),
        });
        // On vide la session côté client avant même de vérifier le statut
        // pour ne jamais laisser des tokens invalides en place.
        clearAuthSession(false);
        if (!response.ok) throw await buildApiError(response, 'Déconnexion impossible');
        return response.json();
    },

    changePassword: async (current_password: string, new_password: string): Promise<true> => {
        await apiCall<any>(
            '/auth/change-password',
            {
                method: 'POST',
                body: JSON.stringify({ current_password, new_password }),
            },
            'Changement de mot de passe impossible',
        );
        return true;
    },
};
