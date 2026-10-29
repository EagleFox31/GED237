// frontend/services/resources/auth.api.ts
//
// Domaine : authentification (login, OTP, logout, changement de mot de passe).
// SRP : change uniquement si le contrat /auth/* évolue.

import { API_URL } from '../../constants';
import { apiCall, requestJson, fetchWithRefresh } from '../http/client';
import { clearAuthSession, getHeaders } from '../http/session';
import { buildApiError } from '../http/errorAdapter';

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
}

// ── API ─────────────────────────────────────────────────────────────────────

export const authApi = {
    login: (payload: LoginPayload): Promise<LoginResponse> =>
        requestJson<LoginResponse>(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }),

    verifyOTP: (payload: OTPVerifyPayload): Promise<AuthSession> =>
        requestJson<AuthSession>(`${API_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }),

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
