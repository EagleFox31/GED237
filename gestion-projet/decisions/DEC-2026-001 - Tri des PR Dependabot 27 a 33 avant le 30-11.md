# DEC-2026-001 — Tri des PR Dependabot #27 à #33 avant la présentation du 30/11

- **Statut** : ACCEPTÉ (PO, 2026-11-09 17:30) — #26 fusionnée (3e05d6c), #27 et #31 fermées, #28/#32/#33 en file de fusion, #29/#30 reportés, PR sécurité ciblée assignée à dev-backend.
- **Demandeur** : orchestrateur. **Contrainte** : recette S2 (17–23/11), gel le 24/11, démo le 30/11.
- **Règle de départ** : pas de major en période de recette, sauf CVE exploitable sur le périmètre démo.
- **Preuves** : `Vérifié` = relu dans le code / logs CI / registres (pypi, npm) le 2026-11-09 ; `Documenté` = doc éditeur ; `Déduit` = inférence.

## Décision par PR

| PR | Contenu | CI | Décision | Preuve clé | Coût |
|---|---|---|---|---|---|
| #26 | Node 20 → 24 (`.nvmrc` source unique) | verte | **Fusionner** (PO) | 12/12 checks verts ; choix Node 24 déjà validé par le PO | 0 j |
| #27 | `node:26-alpine` (Dockerfile) | verte | **Fermer** dès #26 fusionnée | Contredit la décision Node 24 ; #26 remplace `FROM node:20-alpine` par `ARG NODE_VERSION` lu depuis `.nvmrc`, donc #27 devient caduque et conflictuelle. `Vérifié` | 0 j |
| #28 | react-router-dom 7.18.4 → 7.18.5 (patch) | verte | **Fusionner** | Patch de dépendances transitives, build + lint + npm audit verts. `Vérifié` | 0 j |
| #29 | typescript 5.8 → 7.0 (major) | rouge | **Reporter après 30/11** | Échec lint : `@typescript-eslint/parser` 7.18 ne charge pas (`BarBarToken` undefined) ; TS 7 = compilateur Go, hors plage `typescript-eslint` (peer `<6.1.0`). Aucune CVE. `Vérifié` | 2–3 j (migration ESLint flat + typescript-eslint 8 + corrections) |
| #30 | eslint 8.57 → 10.14 (major) | rouge | **Reporter après 30/11** | `npm ci` ERESOLVE : `@typescript-eslint/eslint-plugin` 7.18 exige `eslint ^8.56` ; `.eslintrc.json` (legacy) non supporté par ESLint ≥ 9 → Trivy/SCA tombent sur le même `npm ci`. ESLint 8 est EOL (pas de CVE ouverte). Même chantier que #29 : traiter ensemble en S4. `Vérifié` | inclus dans #29 |
| #31 | groupe python, 25 maj (fastapi 0.110→0.162, sqlalchemy 2.0→2.1, pydantic 2.6→2.14, torch 2.6→2.15, ruff 0.6→0.17…) | rouge | **Fermer** et remplacer par #31-bis ciblée (ci-dessous) | Tests : `ModuleNotFoundError: No module named 'psycopg'` (SQLAlchemy 2.1 change le driver PostgreSQL par défaut) ; ruff 0.17 : ~900 nouvelles règles (UP007, UP035…) ; bandit 1.9.4 : B105 sur `'bearer'`. Monolithe non fusionnable sans refonte. `Vérifié` | 4–6 j si pris en bloc |
| #32 | redis-py 5.0.1 → 8.1.0 (major) | verte | **Fusionner** (dérogation à la règle « pas de major », justifiée ci-dessous) | Voir § redis | 0,5 j (smoke OTP/logout en Docker) |
| #33 | spacy `>=3.7.0` → `>=3.8.18` (plage) | verte | **Fusionner** | Pas de changement de version installée : les logs CI montrent déjà `spacy-3.8.18` résolu avec l'ancienne plage. No-op réel. `Vérifié` | 0 j |

## redis-py 8 : l'API utilisée par `backend/app` est-elle touchée ? — Non (`Vérifié`)

- Surface utilisée : `redis.asyncio.from_url(url, encoding, decode_responses)`, `setex`, `get`, `delete`, `close()` (`app/core/redis.py`, `app/services/auth_service.py` : OTP `otp:*`, `otp_session:*`, blacklist `blacklist:*`) ; client sync `redis.Redis.from_url(url, decode_responses=True)` dans `app/core/authz/metrics.py`.
- Ruptures 6.0 (notes de version, `Documenté`) : `ssl_check_hostname=True` par défaut (pas de TLS ici), arguments `charset`/`errors` supprimés (non utilisés ; `encoding` reste accepté), retries par défaut avec backoff, cluster/Sentinel/RedisGears/Graph. Rien de tout cela n'est sur notre chemin.
- `close()` reste un alias de `aclose()` en 8.1.0 (`Documenté`, docs/connections.rst v8.1.0). Dette mineure : passer à `aclose()` à l'occasion.
- Python requis `>=3.10` ; image backend `python:3.11-slim`. OK.
- Preuve d'exécution : la CI de #32 fait tourner `Backend / Tests & Migrations` contre un vrai service `redis:7-alpine` (`conftest.py` lit `TEST_REDIS_URL`) : verte. `Vérifié`
- Pourquoi fusionner malgré le major : redis-py 5.0.1 (oct. 2023) n'aura plus de correctifs ; la fusion maintenant est couverte par les tests et évite un saut plus large après le 30/11. Réversible par revert d'une ligne.

## #31-bis : correctif sécurité ciblé à ouvrir (dev-backend, ≤ 1 j) — soumis au PO

Le rapport `pip-audit` de la CI (artefact `pip-audit-report`, branche `chore/node-24`) liste des CVE sur le **chemin d'upload** exposé par la démo :

| Paquet | Version | CVE (extrait) | Correctif |
|---|---|---|---|
| python-multipart | 0.0.9 | CVE-2024-53981 (DoS multipart), CVE-2026-24486, -40347, -42561, -53538/39/40 | ≥ 0.0.31 (latest 0.0.33) |
| starlette (via fastapi 0.110 → `<0.37`) | 0.36.3 | CVE-2024-47874 (DoS multipart), CVE-2025-54121 | ≥ 0.47.2 → exige fastapi ≥ 0.116 |
| python-dotenv | 1.0.1 | CVE-2026-28684 | 1.2.2 |
| pypdf2 | 3.0.1 | CVE-2023-36464 | 3.9.0 (ou migrer `pypdf`) |

Proposition : une PR dédiée « deps(security) » = `python-multipart==0.0.33`, `fastapi` au dernier 0.1xx compatible pydantic 2.6 (tester 0.116+ ; sinon monter pydantic en minor uniquement), `python-dotenv==1.2.2`, `pypdf2`→`pypdf`. Pas de SQLAlchemy 2.1, pas de torch, pas de ruff. Gate : tests Docker + `pip-audit` sans ces entrées. Torch (24 CVE, 2.6.0) et pyasn1 0.4.8 : reportés après le 30/11 (OCR non exposé à des entrées non authentifiées ; coût ≥ 2 j).

## Recommandations annexes (sans toucher `.github/` maintenant — à inscrire au backlog S4)

1. `dependabot.yml` : ajouter `ignore: update-types: [version-update:semver-major]` sur `node` (docker) et sur `typescript`/`eslint` tant que la migration flat-config n'est pas planifiée.
2. Dérogation RAIDER-D consignée : fusion d'un major (#32) en recette, couverte par CI réelle et revert trivial.
3. Après la démo : chantier « outillage frontend » (#29 + #30 ensemble), chantier « backend 2026 » (#31 par lots : web → ORM → ML).

## Résumé pour l'orchestrateur

Fusionner #26, #28, #32, #33 ; fermer #27 (après #26) et #31 ; reporter #29 et #30 (même chantier) après le 30/11 ; ouvrir #31-bis sécurité ciblée (python-multipart + starlette/fastapi + dotenv + pypdf) avant la recette. Décisions PO : fusion #26, dérogation #32, feu vert #31-bis.
