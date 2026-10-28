# Inventaire des tests API — GED237 — 2026-07-22

> Statut : Vérifié par lecture ; tests non exécutés
> Agent coordinateur : Cursor
> Recherche : sous-agent d'exploration backend
> Référence PERT : préparation T12–T13
> Périmètre : `backend/app/api/v1/endpoints/`, `backend/tests/api/`

## 1. Synthèse

- 19 modules endpoint ;
- environ 109 routes HTTP et une route WebSocket ;
- 13 fichiers de tests API et environ 118 fonctions de test ;
- aucun fichier de test dédié pour `reports`, `usage`, `org_units`,
  `notifications`, `categories`, `audit` et `users`.

Les quantités sont issues d'une lecture/inventaire et doivent être recalculées
par commande lors de T06.

## 2. Couverture par module

| Module | Routes approximatives | Test dédié | Couverture actuelle | Priorité |
|---|---:|---|---|---|
| auth | 5 | `test_auth.py` | Faible | P1 |
| tenants | 5 | `test_tenants.py` | Faible | P1 |
| org_units | 7 | Aucun | RBAC indirect uniquement | P0 |
| spaces | 2 | `test_spaces.py` | Un test | P0 |
| users | 12 | Aucun | Quelques tests indirects | P1 |
| documents | ~24 | `test_documents.py` | Partielle | P1 |
| imports | 4 | `test_imports.py` | Bonne base | P1 |
| workflows | 8 | `test_workflows.py` | Bonne base | P1 |
| search | 1 | `test_search.py` | Smoke uniquement | P0 |
| categories | 5 | Aucun | RBAC indirect | P1 |
| notifications | 3 + WS | Aucun | Absente | P0 |
| analytics | 3 | `test_analytics.py` | Faible | P1 |
| reports | 4 | Aucun | Absente | P0 |
| gedrules | 9 | Deux fichiers | Partielle | P1 |
| classification | 14 | `test_classification_admin.py` | Négatifs surtout | P1 |
| classification_reviews | 2 | dédié | Partielle | P1 |
| authz | 8 | `test_authz.py` | Forte | P1 |
| audit | 1 | Aucun | Absente | P1 |
| usage | 4 | Aucun | Absente | P0 |

## 3. Risques critiques détectés

### Recherche

Le tenant est filtré, mais aucun scope explicite rôle/unité/propriétaire n'est
appliqué. Un utilisateur pourrait retrouver les documents d'autres utilisateurs
du même tenant.

**Test attendu** : utilisateur A crée un document ; utilisateur B sans
autorisation cherche un terme unique ; résultat vide ou 403.

### Rapports

Le scope est forcé pour `manager` et `reader`, mais le comportement de
`standard`, `unit_admin` et `tenant_admin` doit être figé et testé. Les métriques
de rangement local semblent tenant-wide même avec filtre organisationnel.

### Espaces

`/spaces/tree` autorise `spaces.read`, puis délègue à un endpoint exigeant
`org_units.read`. Le rôle standard peut donc rencontrer un 403 inattendu.

### Usage

L'upsert du snapshot recherche d'abord par `user_id` sans filtre explicite
`tenant_id`. Une défense en profondeur et un test de régression sont requis.

### Notifications

Les lectures/écritures filtrent l'utilisateur, mais la présence du filtre
`tenant_id` doit être renforcée et testée. La route WebSocket doit refuser les
tokens invalides.

## 4. T12 — Tests Rapports

Fichier cible : `backend/tests/api/test_reports.py`.

| ID | Priorité | Cas |
|---|---|---|
| R-E01 | P0 | Tenant admin obtient 200 et un schéma valide sur les 4 routes |
| R-E02 | P0 | Comportement standard/unit-admin explicitement testé |
| R-E03 | P0 | Manager hors périmètre → 403 |
| R-E04 | P0 | Manager sans org_unit → scope automatique |
| R-E05 | P1 | Super admin avec tenant cible reste isolé |
| R-E06 | P1 | Domain/activity/category modifient les agrégats |
| R-E07 | P1 | `date_from > date_to` → erreur contrôlée |
| R-E08 | P1 | Usage local alimente les signaux documentaires |
| R-E09 | P2 | Granularités jour/semaine/mois |

Definition of Done T12 :

- quatre endpoints couverts ;
- tenant, rôle et scope organisationnel prouvés ;
- forme des réponses stabilisée ;
- tests exécutés sur PostgreSQL et Redis préparés.

## 5. T13 — Usage

Fichier cible : `backend/tests/api/test_usage.py`.

| ID | Priorité | Cas |
|---|---|---|
| U-E01 | P0 | POST local-organize persiste et audite |
| U-E02 | P0 | PUT → GET → DELETE snapshot |
| U-E03 | P0 | User A ne lit pas le snapshot de B |
| U-E04 | P1 | Upsert protège le tenant |
| U-E05 | P1 | Chaîne usage → reports |
| U-E06 | P2 | Compteurs invalides refusés |

## 6. T13 — Unités organisationnelles

Fichier cible : `backend/tests/api/test_org_units.py`.

| ID | Priorité | Cas |
|---|---|---|
| OU-E01 | P0 | CRUD tenant-admin |
| OU-E02 | P0 | Suppression avec enfant → 409 |
| OU-E03 | P0 | Suppression avec utilisateur actif → 409 |
| OU-E04 | P0 | Suppression avec document actif → 409 |
| OU-E05 | P0 | Standard list → refus |
| OU-E06 | P0 | Accès cross-tenant → 404 |
| OU-E07 | P1 | Arbre manager limité |
| OU-E08 | P1 | Super admin cible un tenant |
| OU-E09 | P2 | Accès aux types conforme à la décision produit |

## 7. T13 — Notifications

Fichier cible : `backend/tests/api/test_notifications.py`.

| ID | Priorité | Cas |
|---|---|---|
| N-E01 | P0 | GET retourne uniquement les notifications utilisateur |
| N-E02 | P0 | Marquer une notification d'un autre utilisateur est refusé |
| N-E03 | P0 | `unread_only=true` filtre correctement |
| N-E04 | P1 | Défense `tenant_id` explicite |
| N-E05 | P1 | Token WebSocket invalide → fermeture 1008 |
| N-E06 | P2 | Read-all idempotent |

## 8. Extensions recommandées

### Catégories

- liste tenant-scopée ;
- code dupliqué refusé ;
- accès cross-tenant refusé ;
- suppression logique et `include_inactive`.

### Classification

- happy path domaine → activité → règle → simulation ;
- standard interdit de créer ;
- règle cross-tenant invisible ;
- simulation retourne le chemin logique.

### Recherche

- propriétaire et scope organisationnel ;
- filtres catégorie/statut/type/tags ;
- pagination et requête vide.

### Espaces

- cohérence `spaces.read` / `org_units.read` ;
- manager limité à son unité ;
- récursivité ;
- lecteur en lecture seule.

### Audit et utilisateurs

- audit tenant-scopé et filtres ;
- CRUD utilisateur, reset password, hiérarchie et scope organisationnel.

## 9. Ordre transmis à Claude

1. Exécuter T06 et corriger l'environnement.
2. Créer `test_reports.py` avec R-E01, R-E03, R-E04 et R-E08.
3. Créer `test_usage.py` avec U-E01 à U-E03.
4. Créer `test_org_units.py` avec OU-E01 à OU-E06.
5. Créer `test_notifications.py` avec N-E01 à N-E03.
6. Coordonner les tests Search avec T11.
7. Coordonner les tests Spaces avec T09–T10.

## 10. Charge indicative

| Lot | Tests minimum indicatifs | P0 | P1 | P2 |
|---|---:|---:|---:|---:|
| Reports | 9 | 4 | 4 | 1 |
| Usage | 6 | 3 | 2 | 1 |
| Org units | 9 | 6 | 2 | 1 |
| Notifications | 6 | 3 | 2 | 1 |
| Extensions | ~24 | 10 | 10 | 4 |
| Total | ~54 | 26 | 20 | 8 |

Cette estimation ne constitue pas un engagement. Les tests P0 priment.

## 11. Handoff

- **Claude** : valide les comportements attendus avant d'écrire les assertions.
- **Gemini** : contrôle que les cas correspondent aux parcours et rôles.
- **PO** : arbitre les accès standard/unit-admin et la portée Reports.

T12–T13 restent **préparées**, pas terminées : aucun test n'a encore été écrit
ou exécuté.
