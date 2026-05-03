// frontend/lib/errors/errorBus.ts
//
// Bus global d'erreurs (Zustand). Toute erreur applicative passe par ici
// avant d'être rendue par <ErrorOverlay/>.
//
// Conformité :
// - WCAG 2.1 §3.3.1 (Error Identification) : chaque entrée porte un message
//   identifiant l'erreur de façon textuelle (pas seulement par couleur).
// - Nielsen #9 : un retryable booléen pilote l'affichage d'une action de
//   récupération (« Réessayer »).
// - WCAG 2.2.1 (Timing Adjustable) : les toasts auto-dismiss ont une durée
//   par défaut > 4 s ; les erreurs critiques NE sont JAMAIS auto-dismiss
//   (l'utilisateur doit explicitement les fermer).

import { create } from 'zustand';
import type { ApiError, ErrorSeverity } from './ApiError';

export type ErrorPresentation = 'toast' | 'banner' | 'modal';

export interface ErrorEntry {
  id: string;
  errorCode: string;
  userMessage: string;
  severity: ErrorSeverity;
  retryable: boolean;
  correlationId?: string;
  presentation: ErrorPresentation;
  /** Action callback for the « Réessayer » button. */
  onRetry?: () => void;
  /** Auto-dismiss delay in ms ; 0 disables auto-dismiss (default for critical). */
  autoDismissMs: number;
  createdAt: number;
}

interface ErrorBusState {
  entries: ErrorEntry[];
  push: (
    error: ApiError,
    options?: {
      presentation?: ErrorPresentation;
      onRetry?: () => void;
      autoDismissMs?: number;
    },
  ) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const DEFAULT_TOAST_MS = 6_000;

const choosePresentation = (error: ApiError): ErrorPresentation => {
  if (error.severity === 'critical') return 'modal';
  if (error.status === 401) return 'modal';
  return 'toast';
};

const chooseAutoDismissMs = (
  presentation: ErrorPresentation,
  severity: ErrorSeverity,
  override?: number,
): number => {
  if (override !== undefined) return override;
  // Modal/critical : jamais d'auto-dismiss (WCAG 2.2.1 — l'utilisateur ferme).
  if (presentation === 'modal') return 0;
  if (severity === 'critical') return 0;
  return DEFAULT_TOAST_MS;
};

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export const useErrorBus = create<ErrorBusState>((set, get) => ({
  entries: [],

  push: (error, options = {}) => {
    const presentation = options.presentation || choosePresentation(error);
    const autoDismissMs = chooseAutoDismissMs(
      presentation,
      error.severity,
      options.autoDismissMs,
    );

    // Dédoublonnage simple : si un toast avec le même errorCode est déjà
    // affiché depuis < 1 s, on ne pousse pas une 2ᵉ instance (anti-spam).
    const now = Date.now();
    const dup = get().entries.find(
      (e) =>
        e.errorCode === error.errorCode &&
        e.presentation === presentation &&
        now - e.createdAt < 1_000,
    );
    if (dup) return dup.id;

    const id = newId();
    const entry: ErrorEntry = {
      id,
      errorCode: error.errorCode,
      userMessage: error.userMessage,
      severity: error.severity,
      retryable: error.retryable,
      correlationId: error.correlationId,
      presentation,
      onRetry: options.onRetry,
      autoDismissMs,
      createdAt: now,
    };
    set({ entries: [...get().entries, entry] });

    // Log technique (console dev, jamais visible end-user).
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ApiError] ${error.errorCode} — ${error.userMessage}`,
        error.technicalDetail,
        error.raw,
      );
    }

    if (autoDismissMs > 0) {
      setTimeout(() => get().dismiss(id), autoDismissMs);
    }
    return id;
  },

  dismiss: (id) =>
    set({ entries: get().entries.filter((e) => e.id !== id) }),

  clear: () => set({ entries: [] }),
}));

/**
 * Helper impératif pour pousser une erreur depuis du code non-React
 * (ex : services API, intercepteurs).
 */
export const pushApiError = (
  error: ApiError,
  options?: Parameters<ReturnType<typeof useErrorBus.getState>['push']>[1],
): string => useErrorBus.getState().push(error, options);
