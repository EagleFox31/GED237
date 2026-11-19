import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../constants';
import {
    SOCKET_REFUSED,
    notificationsSocketUrl,
    socketRetryDelay,
    ticketRefusalIsFinal,
} from '../lib/notificationsSocket';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// Rafraîchissement de la liste tant que l'onglet est visible : filet de sécurité du temps réel.
export const NOTIFICATIONS_REFRESH_MS = 60_000;

export interface Notification {
    id: string;
    event_type: string;
    message: string;
    is_read: boolean;
    meta_data: any;
    created_at: string;
}

export const useNotifications = () => {
    // La liste passe par le cookie de session : il suffit qu'un utilisateur soit connecté.
    const userKey = useAuthStore((s) => s.userProfile?.matricule ?? null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    // Utilisateur courant : une réponse arrivée après déconnexion ou changement de compte est ignorée.
    const currentUser = useRef<string | null>(null);

    /**
     * Ouverture de la cloche : une erreur s'affiche. Rafraîchissement de fond (`background`) :
     * hors ligne, rien n'est envoyé ; en cas d'échec, aucun message, le prochain essai suffit.
     */
    const loadNotifications = useCallback(async (background = false) => {
        if (background && !navigator.onLine) return;
        const requestedFor = currentUser.current;
        try {
            const response = await api.getNotifications({ silent: background });
            if (!requestedFor || currentUser.current !== requestedFor) return;
            setNotifications(Array.isArray(response) ? response : response?.data || []);
        } catch (error) {
            if (!background) console.error('Failed to load notifications', error);
        }
    }, []);

    useEffect(() => {
        if (!userKey) {
            setNotifications([]);
            return;
        }
        currentUser.current = userKey;
        loadNotifications(true);
        const refreshIfVisible = () => {
            if (document.visibilityState === 'visible') loadNotifications(true);
        };
        const timer = window.setInterval(refreshIfVisible, NOTIFICATIONS_REFRESH_MS);
        window.addEventListener('focus', refreshIfVisible);
        return () => {
            currentUser.current = null;
            window.clearInterval(timer);
            window.removeEventListener('focus', refreshIfVisible);
        };
    }, [userKey, loadNotifications]);

    // Temps réel : un ticket à usage unique avant chaque connexion (jamais le jeton dans l'URL).
    // Session finie ou ticket refusé : on s'arrête, le rafraîchissement régulier ci-dessus suffit.
    useEffect(() => {
        if (!userKey) return;
        let stopped = false;
        let socket: WebSocket | null = null;
        let retryTimer: number | undefined;
        let attempt = 0;

        const retryLater = () => {
            if (stopped) return;
            retryTimer = window.setTimeout(connect, socketRetryDelay(attempt));
            attempt += 1;
        };

        async function connect() {
            if (stopped) return;
            let ticket: string;
            try {
                ({ ticket } = await api.getWsTicket());
            } catch (error) {
                if (!ticketRefusalIsFinal((error as { status?: number })?.status)) retryLater();
                return;
            }
            if (stopped) return;
            socket = new WebSocket(notificationsSocketUrl(API_URL, ticket, window.location.href));
            socket.onopen = () => {
                attempt = 0;
            };
            socket.onmessage = (event) => {
                if (currentUser.current !== userKey) return;
                try {
                    const data = JSON.parse(event.data) as Notification;
                    setNotifications((prev) => (prev.some((n) => n.id === data.id) ? prev : [data, ...prev]));
                } catch {
                    // Message illisible : ignoré, la liste se rafraîchit de toute façon.
                }
            };
            socket.onclose = (event) => {
                socket = null;
                if (event.code !== SOCKET_REFUSED) retryLater();
            };
        }

        connect();
        return () => {
            stopped = true;
            window.clearTimeout(retryTimer);
            socket?.close();
        };
    }, [userKey]);

    const markAsRead = async (id: string) => {
        try {
            await api.markNotificationAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
        } catch (error) {
            console.error('Failed to mark notification as read', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.markAllNotificationsAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        } catch (error) {
            console.error('Failed to mark all as read', error);
        }
    };

    return { notifications, markAsRead, markAllAsRead, loadNotifications };
};
