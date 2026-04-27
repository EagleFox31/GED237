// frontend/services/api.ts
import { API_URL } from '../constants';

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

export interface ResolveReviewPayload {
    target_folder_id: string;
    document_category_id?: string;
    comment?: string;
    resolution_reason?: string;
    new_filename?: string;
    mark_as_resolved: boolean;
    create_rule_suggestion?: boolean;
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

const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token', 'token', 'user_profile'] as const;
const AUTH_ENDPOINT_SEGMENTS = ['/auth/login', '/auth/verify-otp', '/auth/refresh', '/auth/logout'];

const isAuthEndpoint = (url: string) => AUTH_ENDPOINT_SEGMENTS.some((segment) => url.includes(segment));

const redirectToLogin = () => {
    if (typeof window === 'undefined') {
        return;
    }

    if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
    }
};

export const clearAuthSession = (redirect = false) => {
    AUTH_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));

    if (redirect) {
        redirectToLogin();
    }
};

export const persistAuthTokens = (accessToken: string, refreshToken: string) => {
    sessionStorage.setItem('access_token', accessToken);
    sessionStorage.setItem('refresh_token', refreshToken);
    sessionStorage.setItem('token', accessToken);
};

// Helper to get headers with token
export const getHeaders = (isMultipart = false) => {
    const token = sessionStorage.getItem('access_token') || sessionStorage.getItem('token');
    const headers: Record<string, string> = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (!isMultipart) {
        headers['Content-Type'] = 'application/json';
    }

    return headers;
};

const requestJson = async <T>(url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
};

// Interceptor wrapper to handle 401s and refresh tokens automatically
export const fetchWithRefresh = async (url: string, options: RequestInit = {}) => {
    let response = await fetch(url, options);

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
        const nextAccessToken = data.access_token;
        const nextRefreshToken = data.refresh_token || refreshToken;
        persistAuthTokens(nextAccessToken, nextRefreshToken);

        const newHeaders = new Headers(options.headers || {});
        newHeaders.set('Authorization', `Bearer ${nextAccessToken}`);
        response = await fetch(url, { ...options, headers: newHeaders });
    } catch (error) {
        console.error('Token refresh failed', error);
        clearAuthSession(true);
    }

    return response;
};

export const api = {
    // Auth
    login: async (payload: LoginPayload): Promise<LoginResponse> => {
        return requestJson<LoginResponse>(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    },

    verifyOTP: async (otpPayload: OTPVerifyPayload): Promise<AuthSession> => {
        return requestJson<AuthSession>(`${API_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(otpPayload),
        });
    },

    logout: async () => {
        const response = await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: getHeaders(),
        });
        clearAuthSession(false);
        if (!response.ok) throw new Error('Logout failed');
        return response.json();
    },

    // Documents
    uploadDocument: async (formData: FormData) => {
        const response = await fetchWithRefresh(`${API_URL}/documents/upload`, {
            method: 'POST',
            headers: getHeaders(true),
            body: formData,
        });

        if (!response.ok) {
            let payload: any = null;
            try { payload = await response.json(); } catch {}
            const err: any = new Error(
                payload?.detail?.message || payload?.detail || 'Upload failed'
            );
            err.status = response.status;
            err.payload = payload;
            throw err;
        }

        return response.json();
    },

    getDocuments: async (params: { status?: string; skip?: number; limit?: number } = {}) => {
        const queryParams = new URLSearchParams();
        if (params.status) queryParams.append('status', params.status);
        if (typeof params.skip === 'number') queryParams.append('skip', String(params.skip));
        if (typeof params.limit === 'number') queryParams.append('limit', String(params.limit));
        const qs = queryParams.toString();

        const response = await fetchWithRefresh(`${API_URL}/documents${qs ? `?${qs}` : ''}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch failed');
        return response.json();
    },

    getDocument: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/documents/${id}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch failed');
        return response.json();
    },

    deleteDocument: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/documents/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Delete failed');
        return true;
    },

    updateDocument: async (id: string, data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/documents/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Update failed');
        return response.json();
    },

    getDocumentVersions: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/documents/${id}/versions`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch versions failed');
        return response.json();
    },

    // Traceability & Manual Review
    getNeedsReviewDocuments: async () => {
        const response = await fetchWithRefresh(`${API_URL}/documents/needs-review`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch needs review failed');
        return response.json();
    },

    getDocumentAuditLogs: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/documents/${id}/audit-logs`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch audit logs failed');
        return response.json();
    },

    resolveReview: async (id: string, payload: any) => {
        const response = await fetchWithRefresh(`${API_URL}/documents/${id}/resolve-review`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Resolve review failed');
        return response.json();
    },

    // Users
    getUsers: async () => {
        const response = await fetchWithRefresh(`${API_URL}/users`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch users failed');
        return response.json();
    },

    // Workflows
    createWorkflowSteps: async (documentId: string, steps: any[]) => {
        const response = await fetchWithRefresh(`${API_URL}/workflows/document/${documentId}/steps`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(steps),
        });
        if (!response.ok) throw new Error('Failed to create workflow steps');
        return response.json();
    },

    getWorkflowSteps: async (documentId: string) => {
        const response = await fetchWithRefresh(`${API_URL}/workflows/document/${documentId}/steps`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch workflow steps');
        return response.json();
    },

    getPendingWorkflows: async () => {
        const response = await fetchWithRefresh(`${API_URL}/workflows/pending`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch pending workflows');
        return response.json();
    },

    validateWorkflowStep: async (stepId: string, action: string, comment?: string) => {
        const response = await fetchWithRefresh(`${API_URL}/workflows/step/${stepId}/actions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ action_type: action, outcome: action === 'approve' ? 'accepted' : 'rejected', comment }),
        });
        if (!response.ok) throw new Error('Failed to validate workflow step');
        return response.json();
    },

    getPendingAssignments: async () => {
        const response = await fetchWithRefresh(`${API_URL}/workflows/pending-assignments`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch pending assignments');
        return response.json();
    },

    submitWorkflowAction: async (stepId: string, payload: { action_type: string, outcome: string, document_version_id: string, comment?: string }) => {
        const response = await fetchWithRefresh(`${API_URL}/workflows/step/${stepId}/actions`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to submit workflow action');
        return response.json();
    },

    assignPendingStep: async (stepId: string, assignedTo: string) => {
        const response = await fetchWithRefresh(`${API_URL}/workflows/steps/${stepId}/assign`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ assigned_to: assignedTo }),
        });
        if (!response.ok) throw new Error('Failed to assign step');
        return response.json();
    },

    getWorkflowActions: async (documentId: string) => {
        const response = await fetchWithRefresh(`${API_URL}/workflows/document/${documentId}/actions`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to fetch workflow action history');
        return response.json();
    },

    // Org Units
    getOrgUnitsTree: async () => {
        const response = await fetchWithRefresh(`${API_URL}/org-units/tree`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch org units tree failed');
        return response.json();
    },

    getOrgUnitsTreeForTenant: async (tenantId: string) => {
        const response = await fetchWithRefresh(`${API_URL}/org-units/tree?tenant_id=${tenantId}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch org units tree for tenant failed');
        return response.json();
    },

    getOrgUnits: async () => {
        const response = await fetchWithRefresh(`${API_URL}/org-units`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch org units failed');
        return response.json();
    },

    getOrgUnitTypes: async (): Promise<{ id: number; code: string; label: string; level: number }[]> => {
        const response = await fetchWithRefresh(`${API_URL}/org-units/types`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch org unit types failed');
        return response.json();
    },

    getOrgUnitsForTenant: async (tenantId: string) => {
        const response = await fetchWithRefresh(`${API_URL}/org-units?tenant_id=${tenantId}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch org units for tenant failed');
        return response.json();
    },

    getDocumentStats: async (tenantId?: string) => {
        const qs = tenantId ? `?tenant_id=${tenantId}` : '';
        const response = await fetchWithRefresh(`${API_URL}/documents/stats${qs}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch document stats failed');
        return response.json();
    },

    getWorkflowStats: async (tenantId?: string) => {
        const qs = tenantId ? `?tenant_id=${tenantId}` : '';
        const response = await fetchWithRefresh(`${API_URL}/workflows/stats${qs}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch workflow stats failed');
        return response.json();
    },

    createOrgUnit: async (data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/org-units`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            let payload: any = null;
            try { payload = await response.json(); } catch {}
            let message = 'Création du service impossible';
            if (typeof payload?.detail === 'string') {
                message = payload.detail;
            } else if (Array.isArray(payload?.detail)) {
                // Pydantic validation error: [{loc:[...], msg:"...", type:"..."}]
                message = payload.detail
                    .map((d: any) => {
                        const field = Array.isArray(d?.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
                        return field ? `${field}: ${d?.msg ?? ''}` : (d?.msg ?? '');
                    })
                    .filter(Boolean)
                    .join(' ; ') || message;
            }
            const err: any = new Error(message);
            err.status = response.status;
            err.payload = payload;
            throw err;
        }
        return response.json();
    },

    updateOrgUnit: async (id: string, data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/org-units/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Update org unit failed');
        return response.json();
    },

    deleteOrgUnit: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/org-units/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Delete org unit failed');
        return true;
    },

    // User Management (extended)
    createUser: async (data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/users`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            let detail = 'Create user failed';
            try {
                const body = await response.json();
                if (typeof body?.detail === 'string') detail = body.detail;
                else if (Array.isArray(body?.detail)) detail = body.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
            } catch { /* ignore */ }
            throw new Error(detail);
        }
        return response.json();
    },

    changePassword: async (current_password: string, new_password: string) => {
        const response = await fetchWithRefresh(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ current_password, new_password }),
        });
        if (!response.ok) {
            let detail = 'Change password failed';
            try {
                const body = await response.json();
                if (typeof body?.detail === 'string') detail = body.detail;
            } catch { /* ignore */ }
            throw new Error(detail);
        }
        return true;
    },

    updateUser: async (id: string, data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/users/${id}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Update user failed');
        return response.json();
    },

    deleteUser: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/users/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Delete user failed');
        return true;
    },

    // GEDRules: Templates
    getTemplates: async () => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/templates`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch templates failed');
        return response.json();
    },

    createTemplate: async (data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/templates`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            let msg = 'Create template failed';
            try { const errBody = await response.json(); msg = errBody.detail || msg; } catch(e) {}
            throw new Error(msg);
        }
        return response.json();
    },

    updateTemplate: async (id: string, data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/templates/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            let msg = 'Update template failed';
            try { const errBody = await response.json(); msg = errBody.detail || msg; } catch(e) {}
            throw new Error(msg);
        }
        return response.json();
    },

    deleteTemplate: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/templates/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Delete template failed');
        return true;
    },

    // GEDRules: Routing Rules
    getRoutingRules: async () => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/rules`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch rules failed');
        return response.json();
    },

    createRoutingRule: async (data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/rules`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Create rule failed');
        return response.json();
    },

    updateRoutingRule: async (id: string, data: any) => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/rules/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Update rule failed');
        return response.json();
    },

    deleteRoutingRule: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/rules/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Delete rule failed');
        return true;
    },

    simulateRouting: async (payload: { document_category_id: string; org_unit_id: string | null }) => {
        const response = await fetchWithRefresh(`${API_URL}/gedrules/simulate`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Simulation failed');
        return response.json();
    },

    // Search
    searchDocuments: async (query: string, filters: Record<string, string> = {}) => {
        const queryParams = new URLSearchParams();
        if (query) queryParams.append('q', query);
        Object.entries(filters).forEach(([key, value]) => {
            if (value) queryParams.append(key, value);
        });

        const response = await fetchWithRefresh(`${API_URL}/search?${queryParams.toString()}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Search failed');
        return response.json();
    },

    // Notifications
    getNotifications: async () => {
        const response = await fetchWithRefresh(`${API_URL}/notifications/`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch notifications failed');
        return response.json();
    },

    markNotificationAsRead: async (id: string) => {
        const response = await fetchWithRefresh(`${API_URL}/notifications/${id}/read`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Mark notification as read failed');
        return response.json();
    },

    markAllNotificationsAsRead: async () => {
        const response = await fetchWithRefresh(`${API_URL}/notifications/read-all`, {
            method: 'PUT',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Mark all notifications as read failed');
        return response.json();
    },

    // Tenant
    getTenant: async (tenantId: string) => {
        const response = await fetchWithRefresh(`${API_URL}/tenants/${tenantId}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch tenant failed');
        return response.json();
    },

    getPublicTenants: async (): Promise<Array<{ name: string; short_name: string | null }>> => {
        const response = await fetch(`${API_URL}/tenants/public`);
        if (!response.ok) throw new Error('Fetch public tenants failed');
        return response.json();
    },

    getTenants: async () => {
        const response = await fetchWithRefresh(`${API_URL}/tenants/`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch tenants failed');
        return response.json();
    },

    createTenant: async (payload: { name: string; short_name?: string; domain?: string; is_active?: boolean }) => {
        const response = await fetchWithRefresh(`${API_URL}/tenants/`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`Create tenant failed: ${detail}`);
        }
        return response.json();
    },

    updateTenant: async (tenantId: string, payload: Partial<{ name: string; short_name: string; domain: string; is_active: boolean }>) => {
        const response = await fetchWithRefresh(`${API_URL}/tenants/${tenantId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Update tenant failed');
        return response.json();
    },

    getPlatformUsers: async (params?: { tenant_id?: string; limit?: number }) => {
        const q = new URLSearchParams();
        if (params?.tenant_id) q.set('tenant_id', params.tenant_id);
        if (params?.limit) q.set('limit', String(params.limit));
        const qs = q.toString() ? `?${q.toString()}` : '';
        const response = await fetchWithRefresh(`${API_URL}/users${qs}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch platform users failed');
        return response.json();
    },

    // Health (backend root /health, not /api/v1)
    getHealth: async () => {
        const base = API_URL.replace(/\/api\/v1\/?$/, '');
        const response = await fetch(`${base}/health`, { method: 'GET' });
        if (!response.ok) throw new Error('Health check failed');
        return response.json();
    },

    // Analytics
    getTenantAnalytics: async () => {
        const response = await fetchWithRefresh(`${API_URL}/analytics/tenant`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch tenant analytics failed');
        return response.json();
    },

    getPlatformAnalytics: async () => {
        const response = await fetchWithRefresh(`${API_URL}/analytics/platform`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch platform analytics failed');
        return response.json();
    },

    // AuthZ Admin (super_admin only)
    getAuthzPolicies: async () => {
        const response = await fetchWithRefresh(`${API_URL}/authz/policies`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch authz policies failed');
        return response.json();
    },

    addAuthzPolicy: async (policy: { ptype?: string; v0: string; v1: string; v2: string; v3?: string; v4?: string; v5?: string }) => {
        const response = await fetchWithRefresh(`${API_URL}/authz/policies`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ ptype: 'p', ...policy }),
        });
        if (!response.ok) throw new Error('Add authz policy failed');
        return response.json();
    },

    deleteAuthzPolicy: async (policy: { ptype?: string; v0: string; v1: string; v2: string; v3?: string; v4?: string; v5?: string }) => {
        const response = await fetchWithRefresh(`${API_URL}/authz/policies`, {
            method: 'DELETE',
            headers: getHeaders(),
            body: JSON.stringify({ ptype: 'p', ...policy }),
        });
        if (!response.ok) throw new Error('Delete authz policy failed');
        return response.json();
    },

    getAuthzRoles: async () => {
        const response = await fetchWithRefresh(`${API_URL}/authz/roles`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch authz roles failed');
        return response.json();
    },

    getAuthzMetrics: async (filters: { decision?: string; tenant_id?: string; resource?: string; action?: string; top_n?: number } = {}) => {
        const params = new URLSearchParams();
        if (filters.decision) params.append('decision', filters.decision);
        if (filters.tenant_id) params.append('tenant_id', filters.tenant_id);
        if (filters.resource) params.append('resource', filters.resource);
        if (filters.action) params.append('action', filters.action);
        if (filters.top_n) params.append('top_n', String(filters.top_n));
        const qs = params.toString();

        const response = await fetchWithRefresh(`${API_URL}/authz/metrics${qs ? `?${qs}` : ''}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch authz metrics failed');
        return response.json();
    },

    getAuthzTopDenies: async (filters: { tenant_id?: string; resource?: string; action?: string; top_n?: number } = {}) => {
        const params = new URLSearchParams();
        if (filters.tenant_id) params.append('tenant_id', filters.tenant_id);
        if (filters.resource) params.append('resource', filters.resource);
        if (filters.action) params.append('action', filters.action);
        if (filters.top_n) params.append('top_n', String(filters.top_n));
        const qs = params.toString();

        const response = await fetchWithRefresh(`${API_URL}/authz/metrics/top-denies${qs ? `?${qs}` : ''}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch authz top denies failed');
        return response.json();
    },

    resetAuthzMetrics: async () => {
        const response = await fetchWithRefresh(`${API_URL}/authz/metrics/reset`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Reset authz metrics failed');
        return response.json();
    },

    getAuthzHealth: async () => {
        const response = await fetchWithRefresh(`${API_URL}/authz/metrics/health`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch authz health failed');
        return response.json();
    },

    // Audit logs (global)
    getAuditLogs: async (params: { skip?: number; limit?: number; table_name?: string; action?: string } = {}) => {
        const queryParams = new URLSearchParams();
        if (typeof params.skip === 'number') queryParams.append('skip', String(params.skip));
        if (typeof params.limit === 'number') queryParams.append('limit', String(params.limit));
        if (params.table_name) queryParams.append('table_name', params.table_name);
        if (params.action) queryParams.append('action', params.action);
        const qs = queryParams.toString();

        const response = await fetchWithRefresh(`${API_URL}/audit/logs${qs ? `?${qs}` : ''}`, {
            headers: getHeaders(),
        });
        if (!response.ok) throw new Error('Fetch audit logs failed');
        return response.json();
    },

    // Directory Ingestion
    ingestDirectory: async (directoryPath: string, recursive: boolean = true, documentCategoryId?: string, processingMode: 'archive' | 'process' = 'process') => {
        const response = await fetchWithRefresh(`${API_URL}/documents/ingest-directory`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                directory_path: directoryPath,
                recursive,
                document_category_id: documentCategoryId || null,
                processing_mode: processingMode,
            }),
        });
        if (!response.ok) throw new Error('Directory ingestion failed');
        return response.json();
    },

    startDocumentWorkflow: async (documentId: string) => {
        const response = await fetchWithRefresh(`${API_URL}/documents/${documentId}/start-workflow`, {
            method: 'POST',
            headers: getHeaders(),
        });
        if (!response.ok) {
            let payload: any = null;
            try { payload = await response.json(); } catch {}
            const err: any = new Error(payload?.detail || 'Lancement du circuit impossible');
            err.status = response.status;
            throw err;
        }
        return response.json();
    },
};
