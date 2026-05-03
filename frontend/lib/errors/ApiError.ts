// frontend/lib/errors/ApiError.ts
//
// Représentation typée d'une erreur API conforme RFC 9457 (Problem Details).
// Source canonique des erreurs : le backend GED237 produit toujours ce format
// via app.core.errors.handlers.
//
// Conformité :
// - RFC 9457 §3 : champs `type`, `title`, `status`, `detail`, `instance`.
// - Extensions GED237 : `error_code`, `severity`, `retryable`, `correlation_id`.
// - Nielsen #9 : userMessage est lisible, dev peut consulter technicalDetail (= type+code).

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ProblemDetailPayload {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  instance?: string;
  error_code?: string;
  severity?: ErrorSeverity;
  retryable?: boolean;
  correlation_id?: string;
  // Extensions ad hoc (ex: validation `errors: [{field, message, type}]`)
  [key: string]: unknown;
}

export class ApiError extends Error {
  /** Message public, FR, prêt à afficher à l'end-user. */
  readonly userMessage: string;
  /** Code machine SCREAMING_SNAKE_CASE pour mapping logique côté UI. */
  readonly errorCode: string;
  /** Statut HTTP. */
  readonly status: number;
  /** Gravité — pilote le rendu (toast / banner / modal bloquant). */
  readonly severity: ErrorSeverity;
  /** True si une nouvelle tentative a du sens (affiche bouton « Réessayer »). */
  readonly retryable: boolean;
  /** Identifiant à citer au support. */
  readonly correlationId?: string;
  /** Path/URL de la requête qui a échoué (pour debug dev). */
  readonly instance?: string;
  /** Erreurs de validation par champ, le cas échéant. */
  readonly fieldErrors?: { field: string; message: string; type: string }[];
  /** Payload brut conservé pour debug. */
  readonly raw: ProblemDetailPayload;

  constructor(payload: ProblemDetailPayload) {
    const userMessage = payload.detail || payload.title || 'Erreur.';
    super(userMessage);
    this.name = 'ApiError';
    this.userMessage = userMessage;
    this.errorCode = payload.error_code || 'ERROR';
    this.status = payload.status;
    this.severity = payload.severity || (payload.status >= 500 ? 'error' : 'warning');
    this.retryable = payload.retryable ?? false;
    this.correlationId = payload.correlation_id;
    this.instance = payload.instance;
    this.fieldErrors = Array.isArray(payload.errors)
      ? (payload.errors as { field: string; message: string; type: string }[])
      : undefined;
    this.raw = payload;
  }

  /** Détail destiné à la console dev — JAMAIS affiché à l'end-user. */
  get technicalDetail(): string {
    return [
      `[${this.errorCode}]`,
      this.status ? `HTTP ${this.status}` : null,
      this.instance ? `at ${this.instance}` : null,
      this.correlationId ? `req=${this.correlationId}` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }
}

/**
 * Construit une ApiError depuis une Response échouée. Si le corps n'est pas du
 * Problem Details, on synthétise un ProblemDetail minimal.
 */
export async function apiErrorFromResponse(response: Response): Promise<ApiError> {
  let payload: ProblemDetailPayload;
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('json')) {
      const body = await response.json();
      payload = {
        ...body,
        status: typeof body.status === 'number' ? body.status : response.status,
      };
    } else {
      const text = await response.text();
      payload = {
        status: response.status,
        detail: text.slice(0, 200) || response.statusText,
      };
    }
  } catch {
    payload = { status: response.status, detail: response.statusText };
  }
  return new ApiError(payload);
}

/**
 * Construit une ApiError depuis une exception JS arbitraire (TypeError « Failed
 * to fetch », abort, etc.). Mappe vers un erreur réseau retryable.
 */
export function apiErrorFromException(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  // TypeError "Failed to fetch" / NetworkError → réseau injoignable
  const isNetwork =
    msg === 'Failed to fetch' ||
    msg.toLowerCase().includes('network') ||
    msg.toLowerCase().includes('fetch');
  if (isNetwork) {
    return new ApiError({
      status: 0,
      detail:
        "Le serveur est injoignable. Vérifiez votre connexion puis réessayez.",
      error_code: 'NETWORK_UNREACHABLE',
      severity: 'error',
      retryable: true,
    });
  }
  return new ApiError({
    status: 0,
    detail: 'Une erreur inattendue est survenue.',
    error_code: 'CLIENT_EXCEPTION',
    severity: 'error',
    retryable: false,
  });
}
