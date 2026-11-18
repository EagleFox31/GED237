// frontend/lib/simulatorError.ts
import { ApiError, pushClientOperationError } from './errors';

export const SIMULATOR_LOAD_ERROR_MESSAGE =
  'Impossible de charger les référentiels du simulateur.';

export function reportSimulatorLoadError(error: unknown): ApiError | null {
  if (error instanceof ApiError) {
    return null;
  }
  return pushClientOperationError(error, {
    fallbackDetail: SIMULATOR_LOAD_ERROR_MESSAGE,
  });
}
