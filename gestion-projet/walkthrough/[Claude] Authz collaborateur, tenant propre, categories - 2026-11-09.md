# [Claude] Authz : collaborateur, tenant propre, catégories en lecture — 2026-11-09

> Statut : EN REVUE
> Session : ged-dev-backend
> Référence : smoke e2e PR #39 (ci-qa) SMK-04, SMK-05, SMK-10 ; arbitrages orchestrateur du 2026-11-09
> Branche : `fix/authz-collaborator` (worktree `../GED237-authz`)
> Guide appliqué : `gestion-projet/dev-backend/GUIDE_BACKEND_BD.md` §7

## Ce qui va être fait

Trois refus 403 vus par le smoke contre la pile Docker : le collaborateur ne peut pas téléverser
(SMK-04), tout profil non admin reçoit 403 en lisant son institution (SMK-05, `Sidebar.tsx:20`),
le lecteur et le collaborateur ne peuvent pas lire les catégories, ce qui casse l'écran documents (SMK-10).

## Causes

| Id | Cause |
|---|---|
| SMK-04 | `policy.csv` nommait le rôle `standard` ; le seed crée `collaborator` (migration 001 : `COLLABORATOR`, traité mardi). Aucune règle ne matchait ; la suite pytest semait aussi `standard`, donc verte à tort. |
| SMK-05 | Seuls super_admin, tenant_admin et `standard` avaient `tenants read` ; l'action couvre aussi `GET /tenants/` (liste), donc l'accorder aux rôles de lecture ouvrirait la liste. |
| SMK-10 | `categories read` réservé aux admins (manage) et à l'auditeur. |

## Changements

| Fichier | Changement |
|---|---|
| `backend/app/core/authz/policy.csv` | `standard` → `collaborator` (11 règles, mêmes droits) ; `categories read` pour collaborator, reader, manager, unit_admin (auditor l'avait) ; écritures catégories inchangées. |
| `backend/app/api/v1/endpoints/tenants.py` | `GET /tenants/{id}` : si `tenant_id == current_user.tenant_id`, lecture sans règle Casbin ; sinon Casbin + isolation comme avant. **Dérogation déclarative justifiée** : l'action `tenants read` couvre la liste, qui doit rester fermée. |
| `backend/tests/conftest.py` + 5 fichiers de tests | Code de rôle semé/simulé `standard` → `collaborator` (63 occurrences dans `test_authz.py`, SQL `v0='collaborator'`). |
| `backend/tests/api/test_authz_smoke_fixes.py` | Garde-fou : sujets `p,` de `policy.csv` == codes semés (dérive dans un sens ou l'autre = échec) ; rôles de lecture : `categories read` oui, écritures non (paramétré) ; collaborateur upload 201 ; lecteur 200 `GET /categories/` + 403 `POST` ; lecteur 200 son tenant, 403 tenant étranger, 403 liste. |
| `DOCS/engineering/lessons-learned.md` | LESSON-2026-023 : donnée de référence dupliquée (codes de rôle) sans test croisé. |

## Démo (compose)

La politique CSV est chargée au démarrage de l'application, il n'y a pas de script de rechargement :
après mise à jour de l'image, `docker compose up -d --build backend` (ou `docker compose restart backend`
si seule la politique a changé et qu'elle est montée). À ajouter à la checklist démo.

## Ordre avec la migration des rôles (mardi)

Casbin compare les codes tels quels ; la façade `_role_code()` met en minuscules le code du rôle de
l'utilisateur. Cette PR fixe `collaborator` en minuscules dans la politique ; la migration de mardi
passera les codes insérés par 001 (`COLLABORATOR`, …) en minuscules : cohérent, aucun doublon.

## Preuves

- Docker, modules touchés (`test_authz_smoke_fixes.py`, `test_authz.py`, `test_users.py`, `test_org_units.py`, `test_usage.py`, `test_backend_engineering_patterns.py`) : **126 passed**.
- Suite complète : à rejouer après le redimensionnement de la VM Docker (gel demandé par ci-qa) ; reportée ici avant fusion.
