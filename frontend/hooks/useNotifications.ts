import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import {
    connectNotificationSocket,
    currentPermission,
    desktopText,
    shouldShowDesktop,
    targetPath,
} from '../lib/desktopNotify';

export interface Notification {
    id: string;
    event_type: string;
    message: string;
    is_read: boolean;
    meta_data: any;
    created_at: string;
}

interface Options {
    /** L'agent a activé « Prévenir sur le bureau ». */
    desktopEnabled?: boolean;
    /** Appelé au clic sur la notification Windows (ouvre le document). */
    onOpenPath?: (path: string) => void;
}

/** Événement de simulation (mode développement) tant que le serveur n'émet pas tous les événements de visa. */
export const MOCK_NOTIFICATION_EVENT = 'ged:mock-notification';

export const useNotifications = ({ desktopEnabled = false, onOpenPath }: Options = {}) => {
    const token = sessionStorage.getItem('token');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    // Réglages lus au moment du message, sans rouvrir la connexion à chaque changement.
    const settings = useRef({ desktopEnabled, onOpenPath });
    settings.current = { desktopEnabled, onOpenPath };

    const loadNotifications = useCallback(async () => {
        try {
            const response = await api.getNotifications();
            setNotifications(Array.isArray(response) ? response : response.data || []);
        } catch (error) {
            console.error("Failed to load notifications", error);
        }
    }, []);

    const receive = useCallback((data: Notification) => {
        setNotifications((prev) => (prev.some((n) => n.id === data.id) ? prev : [data, ...prev]));
        const { desktopEnabled: enabled, onOpenPath: open } = settings.current;
        if (!shouldShowDesktop({ enabled, permission: currentPermission(), hasFocus: document.hasFocus(), isRead: data.is_read })) return;
        const { title, body } = desktopText(data);
        const popup = new window.Notification(title, { body, tag: data.id });
        popup.onclick = () => {
            window.focus();
            popup.close();
            open?.(targetPath(data));
        };
    }, []);

    useEffect(() => {
        if (!token) return;
        loadNotifications();
        return connectNotificationSocket(token, {
            // Après une coupure, on recharge la liste : rien n'est perdu pendant l'absence.
            onOpen: (attempt) => { if (attempt > 0) loadNotifications(); },
            onMessage: (raw) => {
                try {
                    receive(JSON.parse(raw));
                } catch (err) {
                    console.error('Failed to parse WebSocket message', err);
                }
            },
        });
    }, [token, loadNotifications, receive]);

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const onMock = (e: Event) => receive((e as CustomEvent<Notification>).detail);
        window.addEventListener(MOCK_NOTIFICATION_EVENT, onMock);
        return () => window.removeEventListener(MOCK_NOTIFICATION_EVENT, onMock);
    }, [receive]);

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
