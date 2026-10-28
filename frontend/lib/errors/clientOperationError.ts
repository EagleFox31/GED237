// frontend/lib/errors/clientOperationError.ts
//
// Erreurs hors flux HTTP (rangement local, File System API, ZIP navigateur…).
// Pousse au bus global comme buildApiError, pour un rendu unifié (toast / overlay).

import type { ErrorSeverity } from './ApiError';
import { ApiError } from './ApiError';
import { pushApiError } from './errorBus';
import { errorMessage } from '../../utils/errors';

export function pushClientOperationError(
  err: unknown,
  opts: {
    fallbackDetail: string;
    errorCode?: string;
    retryable?: boolean;
    severity?: ErrorSeverity;
  },
): ApiError {
  const detail = errorMessage(err, opts.fallbackDetail);
  const apiErr = new ApiError({
    status: 0,
    detail,
    error_code: opts.errorCode ?? 'CLIENT_OPERATION_FAILED',
    severity: opts.severity ?? 'error',
    retryable: opts.retryable ?? false,
  });
  pushApiError(apiErr);
  return apiErr;
}
