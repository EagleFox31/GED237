// Bouton « Ouvrir » (F-NEXT-02) : lien signé court, ouvert dans un nouvel onglet sans en-tête Authorization.

/**
 * URL absolue du lien renvoyé par `POST /documents/{id}/request-access`.
 * Le serveur renvoie un chemin relatif à l'hôte de l'API (« /api/v1/documents/stream/<token> ») ;
 * `apiUrl` peut lui-même être relatif (« /api/v1 », même origine que l'application).
 * Tout ce qui n'est pas un chemin absolu de l'hôte (URL complète, « //autre-hote ») est refusé :
 * on n'ouvre jamais une adresse choisie ailleurs que sur l'API.
 */
export const resolveAccessUrl = (path: string, apiUrl: string, pageUrl: string): string => {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error(INVALID_LINK_MESSAGE);
  }
  return new URL(path, new URL(apiUrl, pageUrl)).href;
};

export const INVALID_LINK_MESSAGE = 'Lien d’ouverture invalide.';
export const BLOCKED_TAB_MESSAGE = 'Autorisez les fenêtres pour ce site, puis réessayez.';

/** Onglet ouvert pendant le clic, puis dirigé vers le lien une fois celui-ci reçu. */
export interface PendingTab {
  /** `false` si aucun onglet n'a pu s'ouvrir (fenêtres bloquées). */
  go(url: string): boolean;
  cancel(): void;
}

/**
 * À appeler dans le geste de clic, avant tout `await` : un `window.open` fait après une
 * requête est bloqué par plusieurs navigateurs. Si l'onglet est refusé quand même,
 * `go` retente une ouverture directe ; sans `noopener`, pour savoir si elle a abouti
 * (avec `noopener`, `window.open` renvoie toujours `null`), l'opener étant coupé aussitôt.
 */
export const openPendingTab = (win: Window = window): PendingTab => {
  const tab = win.open('', '_blank');
  if (tab) tab.opener = null; // la page ouverte ne doit pas pouvoir agir sur l'application
  return {
    go(url) {
      if (tab && !tab.closed) {
        tab.location.href = url;
        return true;
      }
      const retry = win.open(url, '_blank');
      if (!retry) return false;
      retry.opener = null;
      return true;
    },
    cancel() {
      if (tab && !tab.closed) tab.close();
    },
  };
};

/**
 * - `opened` : le lien est ouvert ;
 * - `request-failed` : la demande a échoué, et le bus global l'a déjà affichée (erreur HTTP) ;
 * - `invalid-link` et `blocked` : échecs locaux, à afficher par la page.
 */
export type OpenOutcome = 'opened' | 'request-failed' | 'invalid-link' | 'blocked';

/** Demande le lien et l'ouvre dans `tab` ; l'onglet vide est refermé en cas d'échec. */
export const openDocumentAccess = async (
  tab: PendingTab,
  request: () => Promise<{ url: string }>,
  apiUrl: string,
  pageUrl: string,
): Promise<OpenOutcome> => {
  let path: string;
  try {
    path = (await request()).url;
  } catch {
    tab.cancel();
    return 'request-failed';
  }
  let url: string;
  try {
    url = resolveAccessUrl(path, apiUrl, pageUrl);
  } catch {
    tab.cancel();
    return 'invalid-link';
  }
  return tab.go(url) ? 'opened' : 'blocked';
};
