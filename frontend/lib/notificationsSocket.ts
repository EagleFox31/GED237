// Temps réel des notifications : adresse du WebSocket, attente entre deux essais, arrêt.
// Fonctions pures, testées dans e2e/unit/notifications-socket.spec.ts.

/**
 * Adresse du WebSocket à partir de l'adresse de l'API, absolue (`http://hôte/api/v1`)
 * ou relative à la page (`/api/v1`, cas de la pile servie par nginx).
 */
export function notificationsSocketUrl(apiUrl: string, ticket: string, pageUrl: string): string {
    const url = new URL(`${apiUrl.replace(/\/+$/, '')}/notifications/ws`, pageUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('ticket', ticket);
    return url.toString();
}

export const SOCKET_RETRY_FIRST_MS = 2_000;
export const SOCKET_RETRY_MAX_MS = 60_000;

/** Attente avant le nouvel essai n° `attempt` (0, 1, 2…) : doublée à chaque échec, plafonnée. */
export function socketRetryDelay(attempt: number): number {
    return Math.min(SOCKET_RETRY_MAX_MS, SOCKET_RETRY_FIRST_MS * 2 ** Math.max(0, attempt));
}

/** Fermeture « ticket refusé » par le serveur : on n'insiste pas, le rafraîchissement régulier suffit. */
export const SOCKET_REFUSED = 1008;

/**
 * Demande de ticket refusée pour de bon : session terminée (401), droit absent (403),
 * serveur sans temps réel (404). Les autres échecs (réseau, 5xx) sont réessayés.
 */
export function ticketRefusalIsFinal(status: number | undefined): boolean {
    return status === 401 || status === 403 || status === 404;
}
