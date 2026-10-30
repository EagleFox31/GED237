// frontend/services/resources/notifications.api.ts
//
// Domaine : notifications (liste, mark as read, mark all).
// SRP : change uniquement si le contrat /notifications/* évolue.

import { apiCall } from '../http/client';

export const notificationsApi = {
    // Promise<any> volontaire (pas any[]) : certains backends retournent
    // {data: [...]} ; le narrowing Array.isArray côté hook a besoin de any.
    getNotifications: (): Promise<any> =>
        apiCall<any>('/notifications/', {}, 'Récupération des notifications impossible'),

    markNotificationAsRead: (id: string): Promise<any> =>
        apiCall<any>(
            `/notifications/${id}/read`,
            { method: 'PUT' },
            'Marquage de la notification impossible',
        ),

    markAllNotificationsAsRead: (): Promise<any> =>
        apiCall<any>(
            '/notifications/read-all',
            { method: 'PUT' },
            'Marquage de toutes les notifications impossible',
        ),
};
