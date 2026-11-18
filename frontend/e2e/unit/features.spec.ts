import { expect, test } from '@playwright/test';

import {
  FEATURE_KEYS,
  FEATURES_UNLOADED,
  isFeatureEnabled,
  loadFeatures,
  parseFeatures,
  type FeatureState,
} from '../../lib/features';

// Spec pur (#230) : contrat de GET /config/features (#224) et repli sur les en-têtes X-*-Enabled.

test.describe('parseFeatures', () => {
  test('une clé absente vaut false', () => {
    const flags = parseFeatures({ totp: true });
    expect(flags.totp).toBe(true);
    for (const key of FEATURE_KEYS.filter((k) => k !== 'totp')) expect(flags[key], key).toBe(false);
  });

  test('seul le booléen true active : chaîne, nombre ou null valent false', () => {
    const flags = parseFeatures({ recent_tracking: 'true', scheduled_reports: 1, quality_alerts: null, workflow_inbox: true });
    expect(flags).toEqual({
      recent_tracking: false,
      scheduled_reports: false,
      quality_alerts: false,
      workflow_inbox: true,
      totp: false,
    });
  });

  test('corps illisible (null, tableau, texte) : tout à false', () => {
    for (const raw of [null, undefined, [], 'oops', 42]) expect(parseFeatures(raw)).toEqual(FEATURES_UNLOADED.flags);
  });

  test('clé inconnue ignorée', () => {
    expect(Object.keys(parseFeatures({ other: true })).sort()).toEqual([...FEATURE_KEYS].sort());
  });
});

test.describe('loadFeatures', () => {
  test('réponse lue : source serveur', async () => {
    const state = await loadFeatures(async () => ({ recent_tracking: true }));
    expect(state.source).toBe('server');
    expect(state.flags.recent_tracking).toBe(true);
  });

  test('erreur réseau : tout à false, sans exception', async () => {
    const state = await loadFeatures(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(state).toEqual(FEATURES_UNLOADED);
  });
});

test.describe('isFeatureEnabled', () => {
  const server = (on: boolean): FeatureState => ({
    flags: { ...FEATURES_UNLOADED.flags, scheduled_reports: on },
    source: 'server',
  });

  test('réglages serveur lus : ils font foi, l’en-tête est ignoré', () => {
    expect(isFeatureEnabled(server(false), 'scheduled_reports', 'true')).toBe(false);
    expect(isFeatureEnabled(server(true), 'scheduled_reports', 'false')).toBe(true);
  });

  test('réglages non lus : l’en-tête sert de repli', () => {
    expect(isFeatureEnabled(FEATURES_UNLOADED, 'scheduled_reports', 'true')).toBe(true);
    expect(isFeatureEnabled(FEATURES_UNLOADED, 'scheduled_reports', ' TRUE ')).toBe(true);
    expect(isFeatureEnabled(FEATURES_UNLOADED, 'scheduled_reports', 'false')).toBe(false);
  });

  test('ni réglages ni en-tête : désactivée', () => {
    expect(isFeatureEnabled(FEATURES_UNLOADED, 'scheduled_reports')).toBe(false);
    expect(isFeatureEnabled(FEATURES_UNLOADED, 'scheduled_reports', null)).toBe(false);
    expect(isFeatureEnabled(FEATURES_UNLOADED, 'scheduled_reports', 'yes')).toBe(false);
  });
});
