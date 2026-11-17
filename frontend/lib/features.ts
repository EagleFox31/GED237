// frontend/lib/features.ts
//
// Réglages serveur des fonctions activables (GET /config/features, #224 / #230).
// Module pur (sans navigateur ni client HTTP) : testé par e2e/specs/features.spec.ts.

export const FEATURE_KEYS = [
  'recent_tracking',
  'scheduled_reports',
  'quality_alerts',
  'workflow_inbox',
  'totp',
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureFlags = Record<FeatureKey, boolean>;

/** `server` : réglages lus sur /config/features. `fallback` : non lus (pas encore chargés, ou erreur). */
export type FeatureSource = 'server' | 'fallback';

export interface FeatureState {
  flags: FeatureFlags;
  source: FeatureSource;
}

const allOff = (): FeatureFlags =>
  Object.fromEntries(FEATURE_KEYS.map((key) => [key, false])) as FeatureFlags;

export const FEATURES_UNLOADED: FeatureState = { flags: allOff(), source: 'fallback' };

/** Contrat #224 : seule une valeur `true` active la fonction ; clé absente ou autre type = désactivée. */
export function parseFeatures(raw: unknown): FeatureFlags {
  const body = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(FEATURE_KEYS.map((key) => [key, body[key] === true])) as FeatureFlags;
}

/** Charge les réglages ; en cas d'échec tout reste désactivé, sans exception pour l'écran. */
export async function loadFeatures(fetcher: () => Promise<unknown>): Promise<FeatureState> {
  try {
    return { flags: parseFeatures(await fetcher()), source: 'server' };
  } catch {
    return FEATURES_UNLOADED;
  }
}

/**
 * Vrai si la fonction est active. Les réglages serveur font foi ; tant qu'ils ne sont pas lus,
 * l'en-tête X-*-Enabled de la réponse concernée sert de repli (« true » / « false »), sinon désactivée.
 */
export function isFeatureEnabled(state: FeatureState, key: FeatureKey, headerValue?: string | null): boolean {
  if (state.source === 'server') return state.flags[key];
  const header = headerValue?.trim().toLowerCase();
  if (header === 'true') return true;
  if (header === 'false') return false;
  return state.flags[key];
}
