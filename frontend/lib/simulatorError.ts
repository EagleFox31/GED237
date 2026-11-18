// frontend/lib/simulatorError.ts
import { ApiError, pushClientOperationError } from './errors';

export const SIMULATOR_LOAD_ERROR_MESSAGE =
  'Impossible de charger les référentiels du simulateur.';

/**
 * Retourne le message court à afficher pour une erreur de chargement du simulateur,
 * ou `null` si c'est déjà une `ApiError` publiée par le client HTTP.
 */
export function simulatorLoadErrorMessage(error: unknown): string | null {
  if (error instanceof ApiError) {
    return null;
  }
  return SIMULATOR_LOAD_ERROR_MESSAGE;
}

export function reportSimulatorLoadError(error: unknown): ApiError | null {
  const message = simulatorLoadErrorMessage(error);
  if (!message) {
    return null;
  }
  return pushClientOperationError(error, {
    fallbackDetail: message,
  });
}
