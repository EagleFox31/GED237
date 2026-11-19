import { useEffect, useRef } from 'react';

import { api } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { shouldRefreshProfile } from '../lib/profileRefresh';

// Relecture en arrière-plan : aucun bandeau d'erreur, l'utilisateur n'a rien demandé.
const BACKGROUND = { handledStatuses: [403, 404, 429, 500, 502, 503, 504] } as const;

/**
 * Au retour sur l'onglet, relit GET /users/me (au plus une fois toutes les 5 minutes) : un nom ou
 * un rôle changé par un administrateur s'affiche sans reconnexion. Un 401 suit le parcours de
 * déconnexion existant ; les autres échecs sont silencieux (le profil courant reste valable).
 */
export const useProfileRefresh = (): void => {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  // Le chargement de la session vaut relecture : pas d'appel au premier retour sur l'onglet.
  const lastAt = useRef<number | null>(Date.now());

  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (!shouldRefreshProfile(lastAt.current, now, navigator.onLine)) return;
      lastAt.current = now;
      api.getMe(BACKGROUND).then(refreshProfile).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isLoggedIn, refreshProfile]);
};
