// frontend/services/resources/health.api.ts
//
// Domaine : health check backend (hors prefix /api/v1).
// SRP : change uniquement si l'endpoint /health évolue.

import { API_URL } from '../../constants';

export const healthApi = {
    getHealth: async (): Promise<any> => {
        // /health est hors du prefix /api/v1 — on reconstruit la base URL.
        const base = API_URL.replace(/\/api\/v1\/?$/, '');
        const response = await fetch(`${base}/health`, { method: 'GET' });
        if (!response.ok) throw new Error('Health check failed');
        return response.json();
    },
};
