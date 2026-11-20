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
    throw new Error('Lien d’ouverture invalide.');
  }
  return new URL(path, new URL(apiUrl, pageUrl)).href;
};

/** Onglet ouvert pendant le clic, puis dirigé vers le lien une fois celui-ci reçu. */
export interface PendingTab {
  go(url: string): void;
  cancel(): void;
}

/**
 * À appeler dans le geste de clic, avant tout `await` : un `window.open` fait après une
 * requête est bloqué par plusieurs navigateurs. Si l'onglet est refusé quand même,
 * `go` retente une ouverture directe.
 */
export const openPendingTab = (win: Window = window): PendingTab => {
  const tab = win.open('', '_blank');
  if (tab) tab.opener = null; // la page ouverte ne doit pas pouvoir agir sur l'application
  return {
    go(url) {
      if (tab && !tab.closed) tab.location.href = url;
      else win.open(url, '_blank', 'noopener');
    },
    cancel() {
      if (tab && !tab.closed) tab.close();
    },
  };
};
