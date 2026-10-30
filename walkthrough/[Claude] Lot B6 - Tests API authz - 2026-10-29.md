# [Claude] Lot B6 — Tests API : bornes authz users, org_units, reports, usage — 2026-10-29

> Statut : DONE — PR #17 CI verte, fusionnée le 2026-10-29 (928aefc). Constats authz : décision PO en attente.

## Ce qui va être fait

Item 6 du Lot B (`AUDIT.md`) : tests API « nominal + bornes authz » pour `users`, `org_units`, `reports`
et `usage`.

## Pourquoi

Depuis l'audit, `test_admin_crud_coverage.py` et `test_reports_usage_coverage.py` couvrent le nominal,
toujours en `super_admin`. Rien ne prouvait les refus : rôle sans permission, `unit_admin` en lecture seule,
cloisonnement entre tenants, portée d'unité du `manager`, attribution des données d'usage à l'appelant.
Six routes n'avaient aucun test (`reset-password`, `toggle-active`, `disable-mfa`, `assignable-roles`,
`/org-units/types`, `/org-units/tree`).

## Comment

1. `tests/conftest.py` : fixture `client_as(role, **champs)`, un client authentifié pour n'importe quel
   rôle et n'importe quel utilisateur fictif (`org_unit_id=None` compris). Reuse-first : `test_authz.py` a
   un `_make_client` local qui oblige à retirer les overrides à la main dans chaque test. La fixture les
   retire en `finally`, ce qui évite qu'un échec contamine les tests suivants.
2. Un fichier par module, à côté des fichiers `*_coverage.py` existants (non déplacés) :
   - `test_users.py` : authentification exigée sur les 12 routes ; `manager`, `reader` et `standard`
     refusés ; `unit_admin` en lecture seule ; `tenant_admin` d'un autre tenant → 404 (pas de fuite
     d'existence), filtre `tenant_id` ignoré, création dans un autre tenant → 403 ; reset du mot de passe,
     bascule d'activation et effacement du secret MFA vérifiés en base ; actions sur son propre compte → 400 ;
     `role_code` résolu, mot de passe à usage unique généré ; N+1 inconnu, d'un autre tenant, soi-même ou
     créant un cycle → 422 ; suppression bloquée par un document actif ; `super_admin` absent des rôles
     assignables.
   - `test_org_units.py` : mêmes bornes ; arbre limité aux unités actives, imbriqué, et `?tenant_id=`
     réservé au `super_admin` ; suppression bloquée par un utilisateur actif ; types triés par niveau.
   - `test_reports.py` : `reader` refusé sur les 4 panneaux ; `manager` ramené sur son unité (récursif par
     défaut), 403 hors de son unité ou sans unité ; `tenant_id` honoré pour le `super_admin`, ignoré pour le
     `tenant_admin`.
   - `test_usage.py` : authentification exigée ; événement attribué à l'appelant malgré des champs
     `tenant_id`/`user_id` injectés ; le snapshot d'un utilisateur reste invisible et non supprimable par
     un collègue.
3. Les tests de non-authentification acceptent 401 ou 403 : FastAPI 0.110 (`HTTPBearer`) répond 403
   sans en-tête, 401 à partir de 0.115. Le contrat testé est « refusé », pas le code exact.
4. Mesure de couverture (LESSON-2026-015) : `users.py` restait à 40 % malgré ces tests. Les sections
   `[coverage:*]` de `pytest.ini` n'étaient pas lues : coverage.py ne lit jamais ce fichier. Elles passent
   dans `backend/.coveragerc`, avec `concurrency = greenlet, thread` pour compter les lignes exécutées après
   une requête SQLAlchemy async. `tests/test_coverage_config.py` vérifie que la config est chargée.

## Fichiers / zones concernés (verrou)

- `backend/tests/conftest.py` (ajout seul)
- `backend/tests/api/test_users.py`, `test_org_units.py`, `test_reports.py`, `test_usage.py` (nouveaux)
- `backend/.coveragerc` (nouveau), `backend/pytest.ini` (sections coverage retirées),
  `backend/tests/test_coverage_config.py` (nouveau)
- `DOCS/engineering/lessons-learned.md` (LESSON-2026-015)
- Aucun code applicatif modifié.

## Vérifications prévues

- Nouveaux fichiers et fichiers de couverture voisins verts dans Docker.
- Mutations temporaires du code (puis restaurées) : chaque garde retirée doit faire échouer un test.
- Suite complète avec gate de couverture 70 % ; `ruff check` et `ruff format` (0.6.9) ; CI de la PR.

## Résultats

- Nouveaux fichiers et fichiers de couverture voisins : 74 passed (Docker).
- Mutations temporaires, puis restaurées : retrait du filtre tenant sur `GET /users/{id}`, `tenant_id`
  honoré pour tout rôle dans `reports.py`, snapshot d'usage cherché sans `user_id`. Chaque mutant est tué
  par le test attendu, et par lui seul.
- Suite complète, Docker : 226 passed.

  | Mesure | Avant (config ignorée) | Après (`.coveragerc`) |
  |---|---|---|
  | Total | 71,21 % | **85,16 %** |
  | `users.py` | 40 % | 95 % |
  | `org_units.py` | 47 % | 96 % |
  | `usage.py` | 59 % | 100 % |
  | `reports.py` | 100 % | 100 % |

  Avant ce lot, le total était à 70,34 %. Le gate reste à 70 % : le relever est une décision à part, à
  prendre une fois la nouvelle mesure stable en CI.
- Durée : le traçage greenlet coûte du temps. En local, la suite a pris 6 min 32 sans lui et 12 min 55
  avec, mais le temps local varie d'un run à l'autre (≈ 13 min noté avant ce lot). Référence : en CI,
  l'étape de tests prenait 3 min 36 sur la PR #16 (job : 5 min 30, `timeout-minutes: 15`). À comparer sur
  cette PR.
- `test_coverage_config.py` : passe avec `.coveragerc`, échoue sans lui (`'greenlet' in []`).
- `ruff check` et `ruff format` (0.6.9) : OK ; hooks pre-commit au vert sur chaque commit.

## Constats hors périmètre (non corrigés)

- `GET /users/assignable-roles` n'appelle pas `authorize_or_403` : tout utilisateur connecté lit le
  catalogue des rôles. Sensibilité faible ; restreindre à `users:create` demande de vérifier les écrans qui
  l'appellent. À trancher par le PO.
- Avec `policy.csv`, `manager` et `reader` n'ont ni `users` ni `org_units`, et `reader` n'a pas
  `analytics.tenant` : les branches « portée d'unité » de ces rôles dans `read_users`, `read_org_units`,
  `get_org_units_tree` et `reports.py` (pour `reader`) ne s'exécutent que si une politique SQL leur accorde
  ces droits. Elles ne sont pas testées par ce lot.
- `standard` n'a pas `users:update_own` dans `policy.csv` : à confirmer selon ce que l'écran de profil
  attend.
- `PUT /usage/local-arrangement-snapshot` cherche le snapshot existant par `user_id` seul, puis réécrit son
  `tenant_id`. Sans effet tant qu'un utilisateur n'appartient qu'à un seul tenant.
- `GET /org-units/types` n'a pas de contrôle RBAC : c'est une liste de référence, et le test documente ce
  choix.

## Checklist RAIDER

- **R — Reusable** : `client_as` sert tout test qui doit changer de rôle ou d'utilisateur fictif.
- **A — Agnostic** : rien de lié à l'OS ; codes 401/403 tolérés selon la version de FastAPI.
- **I — Idempotent** : base remise à zéro à chaque test (fixture existante) ; aucun état partagé.
- **D — Durable** : aucun test existant modifié ; fixtures existantes inchangées ; suite complète relancée ;
  gate inchangé à 70 %, même commande CI.
- **Failure memory** : LESSON-2026-015 (config de couverture jamais lue), avec prévention testée ;
  constats hors périmètre consignés pour décision.
- **E — Engineering-grade** : tests mutation-vérifiés ; overrides retirés en `finally` ; config de
  couverture en source unique.
- **Scoped execution** : backend seul (tests et config de couverture) → gates backend uniquement.
- **Reuse-first** : `_make_fake_user` réutilisé ; `_make_client` de `test_authz.py` évalué (voir « Comment »).
- **R — Retroactive** : fichiers `*_coverage.py` laissés en place, non dupliqués.
