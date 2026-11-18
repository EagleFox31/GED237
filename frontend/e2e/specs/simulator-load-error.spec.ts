// Spec pur (npm run test:unit) : remontée d'erreur du simulateur via pushClientOperationError.
import { test, expect } from '@playwright/test';
import { ApiError, useErrorBus } from '../../lib/errors';
import {
  SIMULATOR_LOAD_ERROR_MESSAGE,
  reportSimulatorLoadError,
} from '../../lib/simulatorError';

test.describe('Erreur de chargement du simulateur (SimulatorTab)', () => {
  test('publie un message court en français via pushClientOperationError pour une erreur locale', () => {
    useErrorBus.getState().clear();
    const pushed = reportSimulatorLoadError(new Error('Network down'));

    expect(pushed).not.toBeNull();
    expect(SIMULATOR_LOAD_ERROR_MESSAGE).toBe(
      'Impossible de charger les référentiels du simulateur.',
    );
    const active = useErrorBus.getState().entries;
    expect(active.length).toBeGreaterThan(0);
  });

  test('ne duplique pas une ApiError déjà publiée par le client HTTP', () => {
    useErrorBus.getState().clear();
    const apiErr = new ApiError({
      status: 503,
      detail: 'Service indisponible',
      error_code: 'SERVICE_UNAVAILABLE',
    });

    expect(reportSimulatorLoadError(apiErr)).toBeNull();
    expect(useErrorBus.getState().entries).toHaveLength(0);
  });
});
