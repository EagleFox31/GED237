import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '../constants';
import { subscribeToNotifications } from '../lib/notificationsSocket';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';

// Rafraîchissement de la liste tant que l'onglet est visible (pas de temps réel sans WebSocket).
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
    // Jeton legacy : plus écrit depuis les cookies HttpOnly, donc pas de WebSocket (V1.1).
    const token = sessionStorage.getItem('token');
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

    // API_URL : VITE_API_URL (relatif /api/v1 en image Docker). Son repli localhost:8000 ne sert qu'au dev.
    // Nouvelle notification reçue en temps réel : ajoutée en tête de liste.
    useEffect(
        () => subscribeToNotifications(API_URL, window.location.href, token, (data) => {
            setNotifications((prev) => [data as Notification, ...prev]);
        }),
        [token],
    );

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
