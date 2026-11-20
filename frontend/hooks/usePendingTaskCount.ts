import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { TASKS_CHANGED_EVENT } from '../lib/taskCount';

// Même rythme que la cloche : pas de temps réel sans WebSocket.
export const TASK_COUNT_REFRESH_MS = 60_000;

/**
 * Nombre de tâches qui attendent l'utilisateur connecté (GET /workflows/pending).
 * Appels muets : hors ligne rien n'est envoyé, un échec n'affiche aucun message.
 */
export const usePendingTaskCount = (): number => {
  const userKey = useAuthStore((s) => s.userProfile?.matricule ?? null);
  const [count, setCount] = useState(0);
  // Une réponse arrivée après déconnexion ou changement de compte est ignorée.
  const currentUser = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!navigator.onLine) return;
    const requestedFor = currentUser.current;
    try {
      const tasks = await api.getPendingWorkflows({ silent: true });
      if (!requestedFor || currentUser.current !== requestedFor) return;
      setCount(Array.isArray(tasks) ? tasks.length : 0);
    } catch {
      // Le prochain essai suffit.
    }
  }, []);

  useEffect(() => {
    if (!userKey) {
      setCount(0);
      return;
    }
    currentUser.current = userKey;
    void refresh();
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onChanged = () => void refresh();
    const timer = window.setInterval(refreshIfVisible, TASK_COUNT_REFRESH_MS);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener(TASKS_CHANGED_EVENT, onChanged);
    return () => {
      currentUser.current = null;
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener(TASKS_CHANGED_EVENT, onChanged);
    };
  }, [userKey, refresh]);

  return count;
};
