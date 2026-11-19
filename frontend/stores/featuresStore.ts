import { create } from 'zustand';

import { API_URL } from '../constants';
import { FEATURES_UNLOADED, loadFeatures, type FeatureState } from '../lib/features';
import { fetchWithRefresh, getHeaders } from '../services/http/client';

interface FeaturesStore extends FeatureState {
  /** Lit GET /config/features ; appelé une fois après connexion. */
  load: () => Promise<void>;
  /** Déconnexion : retour à l'état non chargé. */
  reset: () => void;
}

/**
 * Lecture discrète : pas d'apiCall, qui afficherait une erreur à chaque connexion si le serveur
 * n'expose pas encore la route (404). En échec, tout reste désactivé et l'en-tête sert de repli.
 */
async function fetchFeatures(): Promise<unknown> {
  const response = await fetchWithRefresh(`${API_URL}/config/features`, { headers: getHeaders() });
  if (!response.ok) throw new Error(`GET /config/features ${response.status}`);
  return response.json();
}

// Génération de session : une lecture encore en vol après reset() (déconnexion) ne réécrit pas l'état.
let generation = 0;

export const useFeaturesStore = create<FeaturesStore>((set) => ({
  ...FEATURES_UNLOADED,
  load: async () => {
    generation += 1;
    const mine = generation;
    const state = await loadFeatures(fetchFeatures);
    if (mine === generation) set(state);
  },
  reset: () => {
    generation += 1;
    set(FEATURES_UNLOADED);
  },
}));
