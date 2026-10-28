// frontend/lib/errors/index.ts
export {
  ApiError,
  apiErrorFromException,
  apiErrorFromResponse,
} from './ApiError';
export type { ErrorSeverity, ProblemDetailPayload } from './ApiError';
export {
  useErrorBus,
  pushApiError,
} from './errorBus';
export type { ErrorEntry, ErrorPresentation } from './errorBus';
export { pushClientOperationError } from './clientOperationError';
