// frontend/services/resources/notifications.api.ts
//
// Domaine : notifications (liste, mark as read, mark all).
// SRP : change uniquement si le contrat /notifications/* évolue.

import { apiCall, type ApiCallOptions } from '../http/client';

export const notificationsApi = {
    // Promise<any> volontaire (pas any[]) : certains backends retournent
    // {data: [...]} ; le narrowing Array.isArray côté hook a besoin de any.
    // `silent` : rafraîchissement de fond, aucune erreur affichée.
    getNotifications: (options: ApiCallOptions = {}): Promise<any> =>
        apiCall<any>('/notifications/', {}, 'Récupération des notifications impossible', options),

    markNotificationAsRead: (id: string): Promise<any> =>
        apiCall<any>(
            `/notifications/${id}/read`,
            { method: 'PUT' },
            'Marquage de la notification impossible',
        ),

    // Ticket à usage unique (~30 s) pour ouvrir le WebSocket : le jeton ne passe jamais dans l'URL.
    // Silencieux : sans temps réel, la liste se rafraîchit quand même.
    getWsTicket: (): Promise<{ ticket: string; expires_in: number }> =>
        apiCall<{ ticket: string; expires_in: number }>(
            '/auth/ws-ticket',
            { method: 'POST' },
            'Connexion temps réel impossible',
            { silent: true },
        ),

    markAllNotificationsAsRead: (): Promise<any> =>
        apiCall<any>(
            '/notifications/read-all',
            { method: 'PUT' },
            'Marquage de toutes les notifications impossible',
        ),
};
