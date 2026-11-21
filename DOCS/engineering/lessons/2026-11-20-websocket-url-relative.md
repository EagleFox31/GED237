# LMV-1 — WebSocket des notifications sur une adresse relative

- **Date :** 2026-11-20
- **Catégorie :** testing · architecture
- **Statut :** prevention-added
- **Liens :** PR #530 (correctif), harnais `frontend/e2e-legacy/` (LMV-1), `gestion-projet/innovateur/labo-multi-versions.md`

Fiche hors registre : `lessons-learned.md` est gelé jusqu'à la livraison ; à reporter
dans le registre au dégel (prochain numéro libre).

**Contexte** — LMV-1 vérifie l'app sur les moteurs des postes anciens (Chromium 109,
Firefox 115, Chromium 107), sur la vraie API, avec le build servi comme en production.

**Échec** — Sur Chromium 109, toute page connectée affichait « Une erreur est survenue ».
`useNotifications` (appelé par le `Header`) faisait
`new WebSocket(VITE_API_URL.replace('http', 'ws') + '/notifications/ws?token=…')`.
En image Docker, `VITE_API_URL=/api/v1` : l'adresse reste relative. Chrome < 125 et
Firefox < 124 lèvent alors une `SyntaxError` dans l'effet, et l'ErrorBoundary prend
toute la page. Les navigateurs récents acceptent l'adresse relative, et la pile e2e
construit avec `http://api:8000/api/v1` (absolue) : le cas prod n'était jamais exécuté.

**Near miss (essai à vide)** — Le premier test du correctif remplaçait `window.WebSocket`
par un substitut qui imite le refus des moteurs anciens. Mais le `routeWebSocket` de la
maquette le remplaçait à son tour : le test passait sans rien prouver. Le substitut
est désormais verrouillé (`Object.defineProperty`, `writable: false`, `configurable: false`)
et le test lit les adresses réellement reçues.

**Cause racine** — Deux écarts entre test et production : la config de build
(adresse d'API absolue en e2e, relative en prod) et la version du moteur (récent
en CI, ancien chez les utilisateurs). Côté test, un substitut non verrouillé peut être
écrasé sans bruit par une autre couche de simulation.

**Résolution** — `lib/notificationsSocket.ts` : adresse résolue contre la page
(`new URL(…, location.href)`, http → ws, https → wss) ; `try/catch` qui rend `null`,
sans boucle ni journalisation du jeton. La page reste affichée si le navigateur refuse.

**Prévention**
- `e2e/unit/notifications-socket.spec.ts` : adresse relative, absolue, https → wss.
- `e2e/visual/notifications-socket.visual.ts` : build `/api/v1`, substitut verrouillé
  façon Chrome < 125, puis WebSocket qui lève toujours : pas d'écran d'erreur.
- Harnais LMV-1 (`docker-compose.legacy.yml`) : build prod `/api/v1`, 3 moteurs anciens,
  `pageerror` et erreurs console écrites dans le journal en cas d'échec.

**Leçon généralisée**
- Un test qui doit couvrir la prod utilise la config de build de la prod, surtout pour
  les adresses (relatives ou absolues).
- Un substitut de test (API du navigateur, horloge, réseau) est verrouillé, et le test
  vérifie qu'il a bien été appelé. Sinon un test vert peut ne rien prouver.
- Une page qui casse au clic sur un moteur ancien : capturer `pageerror` et console
  avant de conclure à un sélecteur fragile.

**Évolution de standard** — Grille Q : toute URL construite depuis `VITE_API_URL`
(fetch, WebSocket, EventSource, lien signé) passe par une résolution absolue contre la page.
