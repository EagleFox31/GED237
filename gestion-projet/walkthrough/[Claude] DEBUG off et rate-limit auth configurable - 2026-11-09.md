# [Claude] DEBUG désactivé par défaut, rate-limit auth configurable — 2026-11-09

> Statut : EN REVUE
> Session : ged-dev-backend
> Référence : DEC-2026-002 (amendement PO : « DEBUG → PR séparée ») ; `gestion-projet/innovateur/parcours-demo.md` §0
> Branche : `fix/debug-off-rate-limits` (worktree `../GED237-debug`)
> Guide appliqué : `gestion-projet/dev-backend/GUIDE_BACKEND_BD.md` §7.5

## Ce qui va être fait

`DEBUG` valait `True` par défaut (`core/config.py`) et `"true"` dans `docker-compose.yml`. Or `auth.py`
lisait ce drapeau pour passer login / OTP / refresh à 1000/min : toute pile issue du compose tournait
sans limitation réelle. Le drapeau ne doit plus toucher à la sécurité ; les limites deviennent des
réglages explicites, et la clé de limitation ne fait confiance à `X-Forwarded-For` que derrière un proxy
déclaré.

## Ce que DEBUG pilote (inventaire, `grep settings.DEBUG`)

| Avant | Après |
|---|---|
| `database.py:9` `echo=settings.DEBUG` (SQL dans les logs) | inchangé, seul usage restant |
| `auth.py` : 1000/min si DEBUG sur login / verify-otp / refresh | supprimé |
| `/docs`, CORS, gestion d'erreurs | jamais pilotés par DEBUG (vérifié) |

## Changements

| Fichier | Changement |
|---|---|
| `backend/app/core/config.py` | `DEBUG=False` par défaut ; `AUTH_LOGIN_RATE_LIMIT` / `AUTH_OTP_RATE_LIMIT` (`5/minute`), `AUTH_REFRESH_RATE_LIMIT` (`10/minute`), `TRUSTED_PROXY=False`. |
| `backend/app/core/rate_limit.py` | `client_ip()` : **dernier** élément de `X-Forwarded-For` si `TRUSTED_PROXY` (nginx ajoute l'IP réelle après ce que le client envoie), sinon `request.client.host` et en-tête ignoré ; `limiter` partagé construit dessus ; `rate_limit_by_user_or_ip` retombe sur la même clé. |
| `backend/app/api/v1/endpoints/auth.py` | Plus de `Limiter` local ni de branche DEBUG ; `@limiter.limit(lambda: settings.AUTH_*)` (valeur lue à chaque requête, limiteur partagé = celui de `app.state`). |
| `docker-compose.yml` | `DEBUG: "false"` ; `AUTH_LOGIN/OTP_RATE_LIMIT: "30/minute"` (pic démo 4 OTP/60 s, 429 compte comme tentative) ; `TRUSTED_PROXY: "true"` car nginx est le seul port publié et pose `X-Forwarded-For`. |
| `backend/.env.example` | Les 5 variables documentées. |
| `backend/tests/conftest.py` | `1000/minute` posé explicitement (les tests enchaînent les logins) — remplace l'effet implicite de DEBUG. |
| `backend/tests/api/test_auth_rate_limit.py` | 10 tests : limite sans proxy ; `DEBUG=True` ne relâche pas ; `X-Forwarded-For` forgé ignoré sans drapeau ; proxy de confiance → compteur par client forwardé ; « forgé, réel » → clé = réel (revue orchestrateur) ; valeur lue à chaud ; défauts stricts ; limiteur partagé installé ; compteur par IP. |
| `GUIDE_BACKEND_BD.md` §7.5 | Tableau des variables + règle « un drapeau confort dev n'est jamais lu par du code de sécurité ». |

## Variables d'environnement

| Variable | Défaut | Démo (compose) | Tests |
|---|---|---|---|
| `DEBUG` | `false` | `false` | — |
| `AUTH_LOGIN_RATE_LIMIT` | `5/minute` | `30/minute` | `1000/minute` |
| `AUTH_OTP_RATE_LIMIT` | `5/minute` | `30/minute` | `1000/minute` |
| `AUTH_REFRESH_RATE_LIMIT` | `10/minute` | `10/minute` | `1000/minute` |
| `TRUSTED_PROXY` | `false` | `true` | `false` |

La pile e2e de ci-qa (`docker-compose.e2e.yml`, PR #39) porte déjà ses propres valeurs `30/minute` : non touchée.

## Vérification nginx (TRUSTED_PROXY=true en démo)

`nginx/nginx.conf` L.16-20 : `location /api/` → `proxy_pass http://api_backend` avec
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for` (L.20) ; `client_ip()` lit le dernier élément de
cet en-tête (celui ajouté par nginx, un seul saut), donc chaque poste de la salle a son compteur et 30/min n'est pas un plafond collectif.
Seul `/api/` est limité (les routes `/api/docs`, `/health` n'ont pas de limiteur).

## Décisions

- Limiteur **unique** (`core/rate_limit.py`) plutôt que deux instances : même clé, même stockage,
  `app.state.limiter` cohérent avec le gestionnaire 429.
- Limites lues à la requête (callable) : testables sans recharger l'app, modifiables par env sans code.
- `TRUSTED_PROXY` binaire (pas de liste de proxys) : suffisant pour un nginx dans le même compose ;
  une liste de réseaux de confiance serait l'évolution si l'API est un jour exposée autrement.

## Preuves

- Tests ciblés en conteneur (`test_auth_rate_limit.py`, `test_auth.py`, `test_authz.py`) : 76 passed.
- Suite Docker complète (2026-11-09) : **251 passed** (243 + 8 nouveaux), 9 warnings, 19 min 54 ; couverture 85,19 % (gate 70 %).
- `grep settings.DEBUG backend/app` : seul `database.py:9` subsiste.
- Lint/format via pre-commit (ruff v0.6.9, bandit) au commit.
