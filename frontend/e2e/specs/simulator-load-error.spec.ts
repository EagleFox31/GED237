// Spec pur (npm run test:unit) : message d'erreur du simulateur (fonction pure, sans appel au bus).
import { test, expect } from '@playwright/test';
import { ApiError } from '../../lib/errors/ApiError';
import {
  SIMULATOR_LOAD_ERROR_MESSAGE,
  simulatorLoadErrorMessage,
} from '../../lib/simulatorError';

test.describe('Erreur de chargement du simulateur (SimulatorTab)', () => {
  test('renvoie un message court en français pour une erreur locale', () => {
    const msg = simulatorLoadErrorMessage(new Error('Network down'));
    expect(msg).toBe(SIMULATOR_LOAD_ERROR_MESSAGE);
    expect(msg).toBe('Impossible de charger les référentiels du simulateur.');
  });

  test('renvoie null pour une ApiError déjà publiée par le client HTTP', () => {
    const apiErr = new ApiError({
      status: 503,
      detail: 'Service indisponible',
      error_code: 'SERVICE_UNAVAILABLE',
    });

    expect(simulatorLoadErrorMessage(apiErr)).toBeNull();
  });
});
