// Notifications Windows (V1.2, élément 23) : logique sans réseau ni React, testée par `npm run test:unit`.
// L'application doit être ouverte (WebSocket) ; fermée, rien n'est affiché, et c'est dit à l'agent.

export interface NotificationLike {
  event_type: string;
  is_read?: boolean;
  meta_data?: { document_id?: string } | null;
}

export type PermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/** Délais de reconnexion croissants (1 s, 2 s, 4 s… plafonnés à 30 s). */
export const reconnectDelay = (attempt: number): number => Math.min(30_000, 1000 * 2 ** Math.max(0, attempt));

/** Une notification Windows n'apparaît que si l'agent l'a demandée, l'a autorisée, et ne regarde pas l'application. */
export const shouldShowDesktop = (opts: {
  enabled: boolean;
  permission: PermissionState;
  hasFocus: boolean;
  isRead?: boolean;
}): boolean => opts.enabled && opts.permission === 'granted' && !opts.hasFocus && !opts.isRead;

/** Une ligne par événement notifié (backend : services/notifications/listeners.py). */
const DESKTOP_BODIES: Record<string, string> = {
  WORKFLOW_ASSIGNED: 'Un document attend votre visa.',
  WORKFLOW_STEP_ACCEPTED: 'Un de vos documents a reçu un visa.',
  WORKFLOW_COMPLETED: 'Un de vos documents a été visé.',
  WORKFLOW_REJECTED: 'Un de vos documents a été rejeté.',
  WORKFLOW_RETURNED: 'Un de vos documents vous est renvoyé pour correction.',
  CLASSIFICATION_REVIEWS_PENDING: 'Des documents importés sont à revoir.',
};

/** Titre court et une ligne, jamais le contenu du document (l'écran peut être vu par d'autres). */
export const desktopText = (n: NotificationLike): { title: string; body: string } => ({
  title: 'GED237',
  body: DESKTOP_BODIES[n.event_type] ?? 'Vous avez une nouvelle notification.',
});

/** Chemin (relatif à l'application) ouvert au clic : le document s'il est connu, sinon la liste. */
export const targetPath = (n: NotificationLike): string => {
  if (n.event_type === 'CLASSIFICATION_REVIEWS_PENDING') return '/classification-reviews';
  const id = n.meta_data?.document_id;
  return id ? `/documents?open=${encodeURIComponent(id)}` : '/documents';
};

const PREF_KEY = 'ged.desktopNotify';

export const readPreference = (): boolean => {
  try {
    return localStorage.getItem(PREF_KEY) === '1';
  } catch {
    return false;
  }
};

export const writePreference = (on: boolean): void => {
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* stockage indisponible : la préférence ne survit simplement pas à la session */
  }
};

export const currentPermission = (): PermissionState =>
  typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission as PermissionState);

/** À appeler au clic sur l'interrupteur, jamais au chargement de la page. */
export const askPermission = async (): Promise<PermissionState> => {
  if (typeof Notification === 'undefined') return 'unsupported';
  return (await Notification.requestPermission()) as PermissionState;
};

/** Seul endroit qui ouvre la connexion temps réel. */
export interface SocketHandlers {
  onMessage: (data: string) => void;
  onOpen: (attempt: number) => void;
}

/**
 * Fournit un ticket neuf avant chaque connexion (#316 : usage unique, 30 s, jamais le jeton de session dans l'URL).
 * `null` = session refusée (401) : on s'arrête. Une exception = panne passagère : on réessaie plus tard.
 */
export type TicketProvider = () => Promise<string | null>;

const POLICY_VIOLATION = 1008;

export const connectNotificationSocket = (getTicket: TicketProvider, handlers: SocketHandlers): (() => void) => {
  const base = import.meta.env?.VITE_API_URL?.replace('http', 'ws') || 'ws://localhost:8000/api/v1';
  let attempt = 0;
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const retryLater = () => {
    timer = setTimeout(open, reconnectDelay(attempt));
    attempt += 1;
  };

  async function open() {
    let ticket: string | null;
    try {
      ticket = await getTicket();
    } catch {
      if (!stopped) retryLater();
      return;
    }
    if (stopped || !ticket) return;
    socket = new WebSocket(`${base}/notifications/ws?ticket=${encodeURIComponent(ticket)}`);
    socket.onopen = () => {
      handlers.onOpen(attempt);
      attempt = 0;
    };
    socket.onmessage = (event) => handlers.onMessage(String(event.data));
    socket.onclose = (event) => {
      // 1008 : ticket refusé (inconnu, expiré ou déjà utilisé) ; insister tournerait en boucle.
      if (stopped || event.code === POLICY_VIOLATION) return;
      retryLater();
    };
  }
  void open();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    socket?.close();
  };
};
