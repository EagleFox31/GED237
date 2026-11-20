# Inventaire — ce que change `ENVIRONMENT=production` (main 33b2425)

- **Destinataire** : B, pour le lot ENVIRONMENT (après le 30/11, empilé sur #154).
- **Périmètre** : `backend/`, `docker-compose*.yml`, `frontend/` (`VITE_*`, `/health`), relevé en lecture seule sur `origin/main` 33b2425 le 17/11.
- **Hypothèse « sans canal OTP »** : on bascule `ENVIRONMENT=production` sur main tel quel, sans #154 ni aucun envoi réel du code.
- Aucun identifiant de démo n'est reproduit ici ; seuls les rôles sont cités ailleurs dans le dossier.

## 1. Constat en une phrase

Sur main, `ENVIRONMENT` ne pilote que **deux** comportements : l'écho de l'OTP dans la réponse de login et le contrôle de la `SECRET_KEY`. Tout le reste (CORS, `/api/docs`, logs, cadre de démo, `--reload`) est **indépendant** de la variable. Passer en `production` sans canal OTP bloque donc toute connexion, sans rien durcir d'autre.

## 2. Occurrences et effets

| # | Fichier:ligne | En `development` | En `production` | Risque sans canal OTP | Impact démo |
|---|---|---|---|---|---|
| 1 | `backend/app/core/config.py:20` | Valeur par défaut `"development"` | Doit être fournie par l'environnement | Une valeur mal orthographiée (`prod`, `Production`) n'est ni dev ni prod : l'OTP est masqué **et** le contrôle de clé est sauté | — |
| 2 | `backend/app/services/auth_service.py:116-123` | `response["otp"] = otp` (égalité stricte `== "development"`) | Le champ `otp` est absent ; le message dit toujours « OTP sent to your registered contact » | **Blocage total** : le code est stocké dans Redis mais n'est envoyé nulle part, personne ne peut se connecter | **Bloquant** : plus aucune connexion, donc plus de démo |
| 3 | `backend/app/core/config.py:226-235` (`get_settings`) | Aucun contrôle | `RuntimeError` si `ENVIRONMENT == "production"` **et** `SECRET_KEY` vaut le défaut de `config.py:46` | Voir n° 4 : le contrôle ne se déclenche pas avec le compose | Si la clé est le défaut de config, l'API ne démarre pas |
| 4 | `docker-compose.yml:70, 96, 134` ; `backend/docker-compose.yml:58` | Défaut `dev-secret-key-change-in-production` | Identique | **Le défaut du compose diffère de celui de `config.py:46`** (`...-change-this-in-...`). Sans `SECRET_KEY` dans `.env`, le contrôle du n° 3 ne voit pas le défaut : l'API démarre en production avec une clé JWT publique et connue | Aucun (c'est justement le danger : rien ne casse) |
| 5 | `docker-compose.yml:71, 97, 141` (`migrate`, `seed`, `api`) | `ENVIRONMENT: development` en dur | Impossible via `.env` : il faut modifier le compose | Bascule non pilotable par configuration ; trois services à aligner à la main | — |
| 6 | `backend/docker-compose.yml:59-60` | `ENVIRONMENT: development`, `DEBUG: "true"` | Idem, en dur | Compose de dev : à ne pas utiliser pour la production | — |
| 7 | `docker-compose.e2e.yml:78` (et `:73` clé dédiée e2e) | `ENVIRONMENT: development` | — | Les e2e **exigent** l'écho : `frontend/e2e/fixtures/uat.fixture.ts:57-58`, `specs/seed.spec.ts:19`, `specs/demo-counters.spec.ts:38`, `specs/uat/auth-2fa.spec.ts:9` | Si on bascule la pile e2e, toute la suite échoue au login |
| 8 | `scripts/measure_lib.py:37` | Lit l'OTP dans la réponse | Arrêt : « ENVIRONMENT must be development », sauf `MEASURE_OTP` fourni | Mesures de performance impossibles sans saisie manuelle du code | Chiffres C6 non reproductibles en production |
| 9 | `backend/.env.example:49` | `ENVIRONMENT=development` | — | Le modèle d'environnement n'indique pas les valeurs admises | — |
| 10 | `backend/app/core/config.py:46` + `.env.example:13` | Clé de dev par défaut | Doit être fournie | Couvert par les n° 3 et 4 | — |
| 11 | `backend/app/main.py:44-47` | `/api/docs`, `/api/redoc`, `/api/openapi.json` exposés | **Toujours exposés** (non liés à `ENVIRONMENT`) | Surface d'API publique documentée en production | Aucun |
| 12 | `backend/app/main.py:73-79` ; `config.py:96-99` ; `docker-compose.yml:140` | `ALLOWED_ORIGINS` (localhost), `allow_credentials=True`, méthodes et en-têtes `*` | **Identique** (non lié à `ENVIRONMENT`) | Les origines de production doivent être posées à la main ; rien ne refuse un `*` ou un localhost oublié | Aucun si l'origine de la démo est listée |
| 13 | `backend/app/core/config.py:102` ; `.env.example:64` | `LOG_LEVEL=INFO` | Identique | **`LOG_LEVEL` n'est lu nulle part** dans `backend/app` : aucun réglage de niveau n'est appliqué, quel que soit l'environnement | Aucun |
| 14 | `backend/app/core/config.py:21-23` ; `database.py:9` | `DEBUG` active l'écho SQL | Indépendant de `ENVIRONMENT` (`docker-compose.yml:143` : `"false"`) | Aucun lien entre `DEBUG=true` et la production n'est contrôlé | Aucun |
| 15 | `backend/app/core/config.py:157-159` ; `services/email_service.py` | `EMAIL_ENABLED=False` | Identique | L'e-mail (Resend) ne sert qu'à `send_account_created` (`users.py:29`), **jamais à l'OTP** : activer l'e-mail ne débloque pas la connexion | Aucun |
| 16 | `docker-compose.yml:123` | `uvicorn --reload --proxy-headers --forwarded-allow-ips="*"` | **Identique** | Rechargement à chaud et confiance dans tout proxy dans le compose de déploiement | Aucun (léger coût CPU) |
| 17 | `docker-compose.yml:170` | Worker `--loglevel=info` | Identique | Niveau en dur, non relié à `LOG_LEVEL` | Aucun |
| 18 | `backend/app/main.py:88-93` ; `frontend/.../health.api.ts:12` | `/health` renvoie statut et `APP_VERSION` | Identique : **n'expose pas l'environnement** | Le front ne peut pas savoir dans quel mode tourne l'API | Aucun |
| 19 | `frontend/components/LoginPage.tsx:139-140` | Pré-remplit l'OTP si `response.otp` fait 6 caractères | Champ absent : rien n'est pré-rempli, l'écran attend un code que personne ne reçoit | Même cause que le n° 2 | **Bloquant** (voir n° 2) |
| 20 | `frontend/components/LoginPage.tsx:365` ; `widgets/DemoProfiles.tsx:27` ; `LoginPage.tsx:32, 109` | Cadre « Espace Démo Interactif » affiché, profils de démo cliquables (`DEMO_CREDENTIALS`) | **Toujours affiché** : rendu inconditionnel, lié à aucune variable | En production, des comptes de démo cliquables restent publiés dans le bundle et à l'écran | Aucun (le cadre reste) ; c'est un risque de sécurité, pas un risque démo |
| 21 | `docker-compose.yml:209, 221` ; `frontend/constants.tsx:3-4` ; `useNotifications.ts:37` | `VITE_APP_VERSION` (défaut `dev`), `VITE_API_URL` (`/api/v1`, défaut localhost:8000) | Identique ; injectés au build | Aucun `VITE_ENVIRONMENT` : le front ne connaît pas le mode | Aucun |
| 22 | `frontend/.../ErrorBoundary.tsx:41` ; `lib/errors/errorBus.ts:112` | `import.meta.env.DEV` : détails d'erreur et logs console | Pilotés par le **mode de build Vite**, pas par `ENVIRONMENT` | Aucun (le build Docker est déjà en mode production) | Aucun |

## 3. Ce qui casse la démo si on bascule

1. **Connexion impossible** (n° 2 et 19) : plus d'OTP dans la réponse et aucun canal d'envoi. C'est le seul effet bloquant, et il est total.
2. **Outillage** (n° 7 et 8) : e2e et `measure_lib` échouent au login.
3. **Rien d'autre ne change** : le cadre de démo, `/api/docs`, les CORS et les logs restent identiques. La bascule n'apporte donc **aucun durcissement** en dehors du contrôle de clé, et ce contrôle est lui-même contourné par le compose (n° 4).

**Conclusion pour le 30/11** : rester en `development` sur la pile de démo. La bascule n'a de sens qu'avec un canal OTP réel (#154, canal `email`) et le lot ci-dessous.

## 4. Ce que #154 change déjà (PR ouverte, `feat/post-rc1-l4-otp-channel` → main)

- Nouveau réglage `AUTH_OTP_CHANNEL` ∈ {`dev_response`, `email`}, défaut `dev_response`, validé (valeur inconnue → erreur au démarrage).
- L'écho devient `ENVIRONMENT == "development" and get_channel().echoes_code` : toujours une **égalité stricte** sur la chaîne.
- Non traité par #154 : la combinaison `production` + `dev_response` (aucun envoi, aucun écho) reste acceptée au démarrage. C'est exactement le blocage du n° 2.

## 5. Recommandations pour le lot ENVIRONMENT de B (à instruire, non décidées)

| Priorité | Recommandation | Occurrences |
|---|---|---|
| P1 | Valider `ENVIRONMENT` comme une énumération (`development`, `production`, éventuellement `test`) avec normalisation de la casse ; refuser toute autre valeur au démarrage ; exposer un unique `settings.is_production` au lieu de comparaisons de chaînes | 1, 2, 3 |
| P1 | Refuser au démarrage `production` + `AUTH_OTP_CHANNEL=dev_response` (règle fail-closed, message actionnable) | 2, 19, #154 |
| P1 | Exiger une `SECRET_KEY` fournie et non triviale dès que l'on n'est pas en `development` ; supprimer le défaut du compose (`${SECRET_KEY:?...}`) ou l'aligner, et contrôler une liste de défauts connus, pas une seule chaîne | 3, 4, 10 |
| P2 | Rendre `ENVIRONMENT` pilotable par `.env` dans `docker-compose.yml` (`${ENVIRONMENT:-development}`) pour `migrate`, `seed` et `api` ; garder `development` en dur dans `docker-compose.e2e.yml` | 5, 7 |
| P2 | Retirer `--reload` hors `development` ; restreindre `--forwarded-allow-ips` à l'adresse du proxy | 16 |
| P2 | Masquer `/api/docs`, `/api/redoc` et `/api/openapi.json` en production (`docs_url=None`), sauf réglage explicite | 11 |
| P2 | En production, refuser `ALLOWED_ORIGINS` contenant `*` ou `localhost` | 12 |
| P3 | Brancher `LOG_LEVEL` sur la configuration de journalisation (API et worker) | 13, 17 |
| P3 | Conditionner `DemoProfiles` à un drapeau de build (`VITE_DEMO_PROFILES`) ou à un champ `environment` exposé par `/health`, et exclure `DEMO_CREDENTIALS` du bundle de production | 18, 20, 21 |
| P3 | Documenter dans `.env.example` les valeurs admises et la règle « production ⇒ canal OTP réel » | 9 |

**Non-régression attendue du lot** : la pile e2e et `measure_lib` restent en `development` et doivent rester vertes ; un test de démarrage par règle fail-closed (valeur inconnue, `production` + `dev_response`, clé par défaut).

## 6. RAIDER

- **R / A** : recommandations fondées sur la configuration (`.env`, énumérations), sans cas particulier par environnement nommé dans le code.
- **I** : relevé en lecture seule, reproductible par `git grep -n ENVIRONMENT origin/main -- backend frontend 'docker-compose*.yml'`.
- **D** : e2e et outillage de mesure identifiés comme contrats à préserver (n° 7 et 8).
- **Failure memory** : le décalage des deux défauts de `SECRET_KEY` (n° 4) mérite une entrée dans `DOCS/engineering/lessons-learned.md` au moment du correctif (garde contournée par une valeur par défaut divergente).
- **E** : règles fail-closed au démarrage, messages actionnables, aucune donnée secrète dans cette fiche.
