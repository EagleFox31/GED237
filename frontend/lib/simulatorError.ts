// frontend/lib/simulatorError.ts
import { ApiError } from './errors';

export const SIMULATOR_LOAD_ERROR_MESSAGE =
  'Impossible de charger les données du simulateur.';

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
