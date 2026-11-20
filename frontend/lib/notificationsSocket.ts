/**
 * Adresse du WebSocket des notifications, toujours absolue.
 *
 * `VITE_API_URL` vaut `/api/v1` derrière le proxy (compose, image) : une adresse relative
 * passée à `new WebSocket` lève une SyntaxError sur Chrome < 125 et Firefox < 124.
 * On la résout donc contre l'adresse de la page, puis http → ws et https → wss.
 * Une adresse déjà absolue (http, https, ws, wss) garde son hôte et son port.
 */
export const notificationsSocketUrl = (apiUrl: string, pageHref: string, token: string): string => {
  const url = new URL(`${apiUrl.replace(/\/+$/, '')}/notifications/ws`, pageHref);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.searchParams.set('token', token);
  return url.href;
};

/**
 * Ouvre le WebSocket, ou renvoie `null` si l'adresse ou le navigateur le refuse.
 * Le temps réel est un bonus : la liste se rafraîchit déjà toute seule, donc une panne
 * ici ne doit jamais casser la page. Pas de message à l'utilisateur ni de nouvel essai,
 * et l'adresse (qui contient le jeton) n'est jamais journalisée.
 */
export const openNotificationsSocket = (
  apiUrl: string,
  pageHref: string,
  token: string,
  create: (url: string) => WebSocket = (url) => new WebSocket(url),
): WebSocket | null => {
  try {
    return create(notificationsSocketUrl(apiUrl, pageHref, token));
  } catch {
    console.warn('Notifications en temps réel indisponibles : la liste reste rafraîchie périodiquement.');
    return null;
  }
};
