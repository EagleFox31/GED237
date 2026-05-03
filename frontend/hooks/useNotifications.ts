import { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';

export interface Notification {
    id: string;
    event_type: string;
    message: string;
    is_read: boolean;
    meta_data: any;
    created_at: string;
}

export const useNotifications = () => {
    const token = sessionStorage.getItem('token');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const ws = useRef<WebSocket | null>(null);

    // Fetch initial notifications
    const loadNotifications = async () => {
        try {
            const response = await api.getNotifications();
            if (Array.isArray(response)) {
                setNotifications(response);
            } else {
                setNotifications(response.data || []);
            }
        } catch (error) {
            console.error("Failed to load notifications", error);
        }
    };

    useEffect(() => {
        if (!token) return;

        loadNotifications();

        const API_WS_URL = import.meta.env.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:8000/api/v1';
        ws.current = new WebSocket(`${API_WS_URL}/notifications/ws?token=${token}`);

        ws.current.onopen = () => {
            console.log('Notification WebSocket connected');
        };

        ws.current.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                // Prepend new notification
                setNotifications((prev) => [data, ...prev]);
            } catch (err) {
                console.error('Failed to parse WebSocket message', err);
            }
        };

        ws.current.onclose = () => {
            console.log('Notification WebSocket closed');
        };

        return () => {
            ws.current?.close();
        };
    }, [token]);

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
