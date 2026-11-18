# Instruction de l'élément 13 : droits propres à chaque institution

- **Statut** : instruction, sans code. À relire par B (porteur, 2,5 h-s), Q (1,5 h-s) et F (grille, 1 h-s).
- **Demande** : réponse B du PO à la question 2 (18/11) : « chaque institution règle ses droits sans toucher aux autres ».
- **Contraintes déjà posées** (`plan-v1.2.md`, place de l'élément 13) :
  - migration additive ;
  - les règles actuelles deviennent communes ;
  - une institution n'ajoute que des surcharges : sans surcharge, rien ne change, et le retour arrière consiste à les supprimer ;
  - non-régression prouvée par Q.

## 1. Point de départ (main du 18/11)

- **Modèle Casbin global** (`backend/app/core/authz/model.conf`) : `r = sub, obj, act`, avec le matcher `g(r.sub, p.sub) && r.obj == p.obj && (r.act == p.act || p.act == "manage")`. Il n'y a ni institution ni règle de refus (`e = some(where (p.eft == allow))`).
- **`policy.csv`** : 80 règles `p`, 0 règle `g`, 7 rôles.
  - Les rôles sont globaux : la table `roles` n'a pas de `tenant_id`.
- **Façade** (`app/core/authz/service.py`, `_authorize`) :
  1. Casbin sur `user.role.code` ;
  2. contrôle d'institution (`ctx.tenant_id == user.tenant_id`, sauf super_admin) ;
  3. contrôle `*_own`.
  - 83 appels `authorize_or_403` et 23 `can_perform`.
- **Moteur** : `AUTHZ_BACKEND = csv` partout aujourd'hui. Le passage en `sql` dépend de #235 (synchronisation CSV vers SQL, #232) puis #238 (écritures règle par règle, #236), toutes deux ouvertes.
  - La table SQL `casbin_rule` stocke `p` en `v0 = rôle`, `v1 = ressource`, `v2 = action`.
- **Grille des droits** : #294 (serveur) et #303 (écran), ouvertes, toutes deux globales : « cocher une case change le droit de ce rôle partout ».
- **Périmètre codé en Python, hors Casbin** :
  - `ADMIN_ROLES`, `TENANT_WIDE_READ_ROLES` et `ORG_UNIT_READ_ROLES` dans `documents.py`, repris par `analytics.py` et `search.py` ;
  - `imports.py`, `workflows.py` (`VALIDATOR_ROLE_CODES`), `org_units.py` (manager et reader), `tenant_guard.py`, `reports_scope.py` ;
  - `INSTITUTION_WIDE_ROLES` de #203.

**Conséquence clé** : un droit Casbin dit **ce qu'un rôle peut faire**, alors que le périmètre (**sur quelles données**) reste écrit dans le code. Une surcharge par institution ne change que le premier.

## 2. Options

### Option A : domaine Casbin (« RBAC with domains »)

C'est le modèle documenté par Casbin pour le multi-tenant (Adopt).

- `model.conf` :
  - `r = sub, dom, obj, act` ;
  - `p = sub, dom, obj, act, eft` ;
  - `e = some(where (p.eft == allow)) && !some(where (p.eft == deny))` ;
  - matcher `g(r.sub, p.sub) && (p.dom == r.dom || p.dom == "*") && r.obj == p.obj && (r.act == p.act || p.act == "manage")`.
- Les 80 règles actuelles reçoivent `dom = "*"` et `eft = allow`. Une institution ajoute des règles `dom = <tenant_id>`, en `allow` pour donner un droit ou en `deny` pour le retirer.
- **Migration** : décalage des colonnes de `casbin_rule` (`v1` devient le domaine, `v2..v4` reçoivent ressource, action et effet).
  - Ce n'est **pas additif** : chaque ligne existante est réécrite.
  - Downgrade : supprimer les lignes `dom != "*"`, puis redécaler.
  - `policy.csv` change aussi de format (deux colonnes de plus sur 80 lignes).
- **Impacts** :
  - #235 : la dérive CSV/SQL compare `v0..v2` ;
  - #238 : écritures règle par règle ;
  - #294 : `list_csv_policies` ;
  - #303 : la grille lit les règles `p` ;
  - les 106 appels passent par `_authorize`, qui devra fournir `dom = user.tenant_id`.
  - Bref, quatre PR ouvertes à reprendre.
- **Exige le mode `sql`** : le CSV ne peut pas porter les surcharges d'institutions créées à l'écran.

### Option B : couche de surcharges par institution, devant Casbin (recommandée)

- **Nouvelle table `tenant_permission_overrides`** :
  - colonnes : `id`, `tenant_id` (FK `tenants`, `ON DELETE CASCADE`), `role_code`, `resource`, `action`, `effect` (`allow` ou `deny`), `created_by`, `created_at`, `updated_at` ;
  - unicité sur (`tenant_id`, `role_code`, `resource`, `action`) ;
  - index sur `tenant_id`.
- **Casbin, `model.conf`, `policy.csv` et `casbin_rule` restent intacts** : ce sont les règles communes.
- **Décision dans `_authorize`** :
  1. Pour un utilisateur non super_admin, chercher une surcharge pour (`user.tenant_id`, rôle, ressource, action), puis pour (…, `manage`).
  2. Si elle existe, son effet décide.
  3. Sinon, Casbin comme aujourd'hui.
  4. Le contrôle d'institution et le contrôle `*_own` restent après, inchangés.
- **Cache** : par processus et par institution, invalidé par un numéro de version.
  - On reprend le motif de `authz_policy_version`, avec une colonne `overrides_version` sur `tenants` ou une ligne par institution.
  - Lecture quand le numéro change : aucune requête de plus en régime établi.
- **Migration additive** : une table et un compteur de version.
  - Downgrade : `DROP TABLE` (et colonne).
  - Aucune ligne existante n'est touchée.
- **Fonctionne en `csv` comme en `sql`** : l'élément 13 ne dépend plus du passage en `sql` (#235, #238).
- **Impacts** :
  - #235 et #238 : aucun ;
  - #294 : `GET /authz/policies?tenant_id=` renvoie les règles communes et les surcharges de l'institution ;
  - nouvelles routes `PUT` et `DELETE /authz/tenants/{tenant_id}/overrides`, réservées à tenant_admin (son institution) et super_admin ;
  - #303 : une case porte trois états (commun, ajouté, retiré).

### Option C : rôles par institution (copie des 7 rôles par tenant)

**Écartée.**

- Il faudrait un `tenant_id` sur `roles` et une migration de `users.role_id`.
- Les codes de rôle sont codés en dur dans une dizaine de fichiers (section 1) : ils deviendraient ambigus.
- Le volume de règles est multiplié par le nombre d'institutions.
- Ce n'est pas additif.

### Comparaison

| Critère | A : domaine Casbin | B : surcharges devant Casbin |
| --- | --- | --- |
| Migration additive | non : 80 lignes réécrites, format CSV changé | **oui** : une table |
| Retour arrière | redécaler les colonnes | `DROP TABLE` |
| Dépend du passage en `sql` (#235, #238) | oui | **non** |
| PR ouvertes à reprendre | #235, #238, #294, #303 | #294 (lecture), #303 (trois états) |
| Standard reconnu | **oui** (Casbin domains) | motif « overlay » maison, environ 60 lignes |
| Une seule source de décision | **oui** : Casbin | deux couches, ordre fixé dans `_authorize` |
| Effort B estimé | 3,5 à 4 h-s | **2 à 2,5 h-s** (dans l'enveloppe) |

**Recommandation : B.** Elle respecte les quatre contraintes du PO à la lettre :
- additive ;
- règles communes intactes ;
- surcharges seulement ;
- retour arrière par suppression.

Elle découple aussi l'élément 13 des quatre PR d'autorisation encore ouvertes.

Le prix est une seconde couche de décision. On le maîtrise ainsi :
- une seule fonction de décision, testée par table ;
- un journal d'audit de chaque surcharge, en reprenant `authz_policy_added` et `authz_policy_removed` de #294 avec le `tenant_id`.

Si l'option A devient utile plus tard, les surcharges se convertissent mécaniquement en règles `dom = <tenant_id>`.

## 3. Garde-fous (option B, valables aussi pour A)

1. **Pas d'élévation** : une institution ne peut **ajouter** que des couples (ressource, action) que tenant_admin possède dans les règles communes.
   - Exclus : `tenants:manage`, `analytics.platform:read`, et tout ce qui touche à super_admin.
   - Cas visé : un tenant_admin qui se donne une capacité de plateforme.
2. **Rôles hors surcharge** :
   - super_admin, rôle de plateforme ;
   - tenant_admin, pour éviter qu'une institution s'enferme dehors en retirant ses propres droits d'administration.
3. **Liste des droits surchargeables** :
   - Seuls sont surchargeables les couples dont l'effet passe **entièrement** par Casbin.
   - Un couple dont le périmètre est codé en dur est exclu de la liste. Exemples : `documents:read` pour collaborator, qui reste limité à `read_own` par les listes de `documents.py` ; la validation, liée à `VALIDATOR_ROLE_CODES`.
   - Sinon, la case cochée ne changerait rien : c'est le piège principal de l'élément.
   - L'inventaire de ces couples est la première tâche de B (environ 0,5 h-s), relu par Q.
4. **Refus explicite plutôt que silence** : une surcharge sur un couple hors liste renvoie 422 avec la raison.
5. **Audit** : chaque ajout ou retrait est journalisé (qui, institution, règle, avant et après).

## 4. Migration (option B)

- **upgrade** :
  - `create_table tenant_permission_overrides`, avec l'unicité, l'index et la FK en cascade ;
  - un `CHECK (effect IN ('allow','deny'))` ;
  - le compteur de version.
- **downgrade** : `drop_table`, et suppression du compteur. Les surcharges sont perdues, et c'est voulu : c'est le retour arrière défini par le PO.
- **Pas de données à reprendre.**
- **Une seule tête Alembic** :
  - l'élément 9 crée aussi une migration ;
  - celle qui fusionne en second se raccroche, et Q vérifie `alembic heads` = 1.

## 5. Tests de non-régression

- **Équivalence (exigence du PO)** : sans aucune surcharge, toutes les combinaisons donnent la même décision avant et après (Q).
  - Combinaisons : 7 rôles × toutes les ressources connues × les 14 actions, soit environ 1 300 cas.
  - Avant : le résultat de `enforce_permission`. Après : celui de `_authorize`.
  - Test paramétré, généré depuis `policy.csv` et `get_allowed_actions()` : il ne vieillit pas quand une règle est ajoutée.
- **Surcharges** :
  - `allow` ajoute ;
  - `deny` retire un droit commun, y compris un droit donné par `manage` ;
  - `manage` surchargé ;
  - la surcharge d'une institution n'a aucun effet sur une autre (deux institutions, même rôle).
- **Garde-fous** :
  - élévation refusée (422) ;
  - super_admin et tenant_admin non surchargeables ;
  - couple hors liste refusé ;
  - tenant_admin d'une autre institution : 404 (règle #247).
- **Cache** : une modification est vue par un autre processus après le changement de version ; une institution supprimée emporte ses surcharges.
- **Migration** : `upgrade`, `downgrade`, puis `upgrade` à nouveau sur une base de test avec surcharges.
- **Existants à relancer** :
  - `tests/api/test_authz*`, `test_org_units.py`, `test_users_*` ;
  - les tests de #235, #238 et #294 s'ils sont fusionnés avant.
  - e2e : la grille de #303.

## 6. Question ouverte de l'élément 12 : unit_admin limité à son sous-arbre

**Elle ne relève pas de l'élément 13.**

- Le sous-arbre est une question de **périmètre**, réglée par #203 (#195, décision du PO sur la portée d'unit_admin) :
  - `INSTITUTION_WIDE_ROLES` reste limité à tenant_admin et auditor ;
  - unit_admin se voit limité à son sous-arbre par `unit_subtree_ids`.
- L'élément 13 règle les **droits** : il ne déplace pas un périmètre.

**Proposition** : quand #203 est fusionnée, une petite suite applique la même règle à `/org-units/tree` (environ 0,25 h-s, B) :
- unit_admin reçoit son sous-arbre, comme pour les documents et les rapports ;
- auditor garde tout le tenant, conformément à l'arbitrage de O sur l'élément 12.

Elle peut passer avant ou après l'élément 13, sans dépendance.

## 7. Ordre et effort (option B)

1. Inventaire des couples surchargeables (B 0,5, relu par Q).
2. Table, migration, décision dans `_authorize` et cache (B 1).
3. Routes de surcharge, garde-fous et audit (B 0,5 à 1).
4. Tests d'équivalence et de surcharge (Q 1,5).
5. Grille par institution (F 1, après le contrat du serveur et #303).

Total : B 2 à 2,5, Q 1,5, F 1, dans l'enveloppe déjà comptée de 5 h-s.

## 8. Annexe : rendre le périmètre réglable depuis l'interface (demande du PO, 18/11)

**Le problème.** La grille de l'élément 13 règle ce qu'un rôle **peut faire**. Les données sur lesquelles il agit, son **périmètre**, sont encore décidées dans le code, par des listes de rôles :

- dans `documents.py` : `TENANT_WIDE_READ_ROLES` et `ORG_UNIT_READ_ROLES` ;
- dans `assert_org_unit_scope` : manager et reader ;
- dans #203 : `INSTITUTION_WIDE_ROLES`.

Tant que ces listes restent dans le code, une case de périmètre dans la grille ne changerait rien.

**Le principe.** Le périmètre devient une **donnée**, au même titre qu'un droit.

1. **Quatre niveaux, en langage simple :**
   - `own` : « ses documents » ;
   - `unit` : « son unité » ;
   - `unit_tree` : « son unité et ses sous-unités » ;
   - `tenant` : « toute l'institution ».
2. **Une table de valeurs par défaut** (rôle, ressource → niveau), dans le code. Elle reprend exactement le comportement actuel.
3. **Des surcharges par institution**, dans la même couche que l'option B : une colonne `scope` sur les surcharges, ou une petite table voisine, avec le même cache `overrides_version`.
4. **Un seul point de décision.**
   - `resolve_scope(user, resource)` donne le niveau.
   - `scope_filter(query, model, user, resource)` l'applique à une liste ; `in_scope(user, obj, resource)` l'applique à un objet seul.
   - Ces fonctions s'appuient sur les helpers de #203 (`unit_subtree_ids`, `is_within_unit_tree`).
   - Les listes de rôles disparaissent des endpoints.
5. **Dans la grille (#303)**, la case de périmètre devient une liste déroulante à quatre choix. Ce sont les mêmes mots qu'au point 1.

**Les garde-fous**, en plus de ceux de la section 3 :

- **Plafond par rôle :** une institution ne peut pas donner un périmètre plus large que celui de tenant_admin. Un plafond par rôle est fixé dans le code (par exemple, collaborator ne dépasse pas `unit`).
- **L'écriture ne dépasse jamais la lecture :** le périmètre d'écriture (`update`, `delete`) est toujours inclus dans celui de lecture.
  - La modification et la suppression d'un document ne vérifient que l'institution et la propriété, pas l'unité. Sur main (18/11), cela ne crée pas d'écart pour les administrateurs, qui lisent toute l'institution. L'écart apparaît dès que leur lecture est restreinte (#203). Il existe déjà pour un responsable qui possède un document hors de son unité. Le détail est en section 9.
  - Il faut le corriger **avant** d'ouvrir le réglage.
- **Hors de portée, c'est 404** (#247), quel que soit le niveau.
- **Garde-fou de non-retour :** un test d'architecture échoue si une liste de rôles de périmètre réapparaît dans un endpoint au lieu de passer par `resolve_scope`.
- **Audit :** chaque changement de périmètre est journalisé, comme les droits.

**L'ordre**, après l'élément 13 (option B) et la fusion de #203 :

| Étape | Contenu | Effort (h-s) |
| --- | --- | --- |
| 1 | Table des valeurs par défaut et `resolve_scope`, sans changement de comportement, avec des tests d'équivalence rôle × ressource avant et après | B 1, Q 0,5 |
| 2 | Bascule des endpoints, ressource par ressource : documents, users et org-units, rapports, circuits ; écriture incluse dans la lecture | B 1 à 1,5, Q 0,5 |
| 3 | Surcharges de périmètre, plafonds et audit | B 0,5 |
| 4 | Liste déroulante dans la grille | F 1 |

**Total : environ 5 h-s.** C'est un chantier V1.2+ ou V2, hors de l'enveloppe de l'élément 13.

**Le risque principal** est d'oublier un endroit du code qui décide encore du périmètre lui-même : il y aurait alors une fuite ou un réglage sans effet. Deux protections couvrent ce risque :

- l'inventaire de l'élément 13, étendu pour suivre aussi les helpers importés depuis un autre module ;
- le test de non-retour décrit plus haut.

**Recommandation :** ne pas ouvrir le réglage du périmètre en V1.x.

- Étape 1 seule : elle met de l'ordre sans rien changer de visible.
- Étapes 2 à 4 : seulement si une institution pilote en exprime le besoin.

## 9. Contrat figé et plan d'exécution (V1.2, décision du PO du 18/11)

**Décision du PO :** le périmètre réglable est livré **en entier** (étapes 1 à 4 de la section 8) en V1.2, en **1 h-s**. Cette décision remplace la recommandation de la section 8. Le lancement (T0) a lieu au signal de l'orchestrateur, après la fusion de #203 et de #303.

Le contrat ci-dessous est **figé** : B et F codent en parallèle dessus, sans se concerter. Toute modification passe par l'orchestrateur.

### 9.1 État de départ (vérifié le 18/11)

| Cas | Lecture | Écriture (update, corbeille, suppression) | Écart |
| --- | --- | --- | --- |
| super_admin, tenant_admin, auditor | institution | institution (sauf auditor : aucune) | aucun |
| unit_admin, main | institution | institution | aucun |
| unit_admin, #203 | **listes** limitées à son unité et ses sous-unités | institution | **oui** : l'ouverture d'un document par son identifiant (`_can_read_document`), la modification et la suppression restent ouvertes sur toute l'institution |
| manager, propriétaire d'un document hors de son unité | refusée (`_can_read_document` : `read` limité à l'unité, pas de `read_own`) | autorisée (`update_own`, `trash_own`) | **oui** |
| manager, `DELETE /documents/{id}` | — | suppression définitive avec le seul `update_own` | correctif V1.0 de B (`fix/v10-delete-perm`) |

Le contrat ferme les deux écarts marqués « oui » par une règle unique : **une écriture exige que l'objet soit dans le périmètre de lecture.**

### 9.2 Module `backend/app/services/access_scope.py` (B)

- `Scope = Literal["own", "unit", "unit_tree", "tenant"]`, ordonnés du plus étroit au plus large.
- `Resource = Literal["documents", "users", "org_units"]`.
  - Les rapports suivent `documents` : `resolve_report_scope` (#203) lit `resolve_scope(user, "documents")`.
- `DEFAULT_SCOPES: dict[role_code, dict[Resource, Scope]]` et `ROLE_SCOPE_CEILING: dict[role_code, Scope]`, en données (table ci-dessous).
- `async resolve_scope(db, user, resource) -> Scope` :
  1. prend la surcharge de l'institution, sinon la valeur par défaut ;
  2. borne le résultat au plafond du rôle ;
  3. si le niveau est `unit` ou `unit_tree` et que l'utilisateur n'a pas d'unité, renvoie `own` (comportement actuel).
- `scope_filter(user, scope, resource) -> list[ColumnElement]` : conditions SQL à ajouter au filtre d'institution.
  - `own` : propriétaire (`documents`) ou soi-même (`users`).
  - `unit` : `org_unit_id == user.org_unit_id`.
  - `unit_tree` : `org_unit_id IN unit_subtree_ids(user.org_unit_id)` (#203).
  - `tenant` : aucune condition.
- `async in_scope(db, user, obj, resource) -> bool` : même règle pour un objet seul. Pour `unit_tree`, elle s'appuie sur `is_within_unit_tree` (#203).
- **Branchement :**
  - documents : `visible_document_scope`, `_can_read_document`, `_can_mutate_document`, `_can_trash_document` et `DELETE` ;
  - les trois fonctions d'écriture appellent `in_scope(..., "documents")` **avant** Casbin ;
  - users : le filtre `_unit_scope` du lot de B (668b8f6) est remplacé par `scope_filter(user, resolve_scope(...), "users")` ;
  - org-units : `/org-units/tree` et `/users/{id}/hierarchy-tree`.
- **Hors de portée : 404**, en lecture comme en écriture (#247).

### 9.3 Valeurs par défaut et plafonds

Les valeurs par défaut reproduisent main à T0, c'est-à-dire après la fusion de #203 et du lot users de B. Le test T1 fait foi en cas de doute.

| Rôle | documents | users | org_units | Plafond |
| --- | --- | --- | --- | --- |
| super_admin | tenant | tenant | tenant | tenant |
| tenant_admin | tenant | tenant | tenant | tenant |
| auditor | tenant | tenant | tenant | tenant |
| unit_admin | unit_tree | unit_tree | unit_tree | tenant |
| manager | unit | — | — | unit_tree |
| reader | unit | — | — | unit_tree |
| collaborator | own | — | — | unit |

« — » signifie que Casbin interdit déjà la ressource, ou que la règle de #285 (soi-même et ses N-1) s'applique. Ces cases ne sont pas réglables en V1.2 et n'apparaissent pas dans la grille.

super_admin et tenant_admin ne sont pas réglables, comme pour les surcharges de droits (section 3) : leurs lignes servent de plafond de référence et n'apparaissent pas dans la grille.

### 9.4 Stockage

- Table `role_scope_overrides` :
  - colonnes : `id`, `tenant_id` (FK), `role_code`, `resource`, `scope`, `updated_by`, `updated_at` ;
  - contrainte unique `(tenant_id, role_code, resource)`.
- Une table vide donne exactement le comportement par défaut. Aucune reprise de données.
- Migration Alembic avec `downgrade`, puis `alembic upgrade head` sur chaque base utilisée.
- Lecture : une requête par appel, sur l'index unique. Si l'option B de l'élément 13 est livrée, la table utilise le même cache `overrides_version`.

### 9.5 API (B), consommée telle quelle par F

`GET /api/v1/admin/access-scopes` :

- réservé à tenant_admin (son institution) et super_admin, comme les routes de surcharge de l'option B ; les autres rôles reçoivent 403 ;
- 200 → `[{ "role": "manager", "resource": "documents", "scope": "unit", "default": "unit", "ceiling": "unit_tree", "overridden": false }, ...]` ;
- seules les cases réglables de la table 9.3 sont renvoyées.

`PUT /api/v1/admin/access-scopes` :

- même droit que le `GET` ;
- corps : `{ "role": "manager", "resource": "documents", "scope": "unit_tree" }` ;
- 200 → l'élément mis à jour, au format du `GET` ;
- 422 dans ces cas :
  - rôle, ressource ou niveau inconnu ;
  - case non réglable ;
  - niveau au-dessus du plafond ;
- **idempotent :**
  - choisir la valeur par défaut supprime la surcharge ;
  - renvoyer la valeur déjà en place n'écrit rien, ni ligne ni audit ;
- **audit :** une ligne `access_scope.update` par changement effectif, avec l'avant et l'après ;
- l'institution vient du jeton, jamais du corps de la requête.

### 9.6 Interface (F), sur la grille #303

- Une colonne « Périmètre » par rôle et ressource réglable.
- Une liste déroulante à quatre libellés :
  - « Ses documents » ;
  - « Son unité » ;
  - « Son unité et ses sous-unités » ;
  - « Toute l'institution ».
- La valeur par défaut porte la mention « (par défaut) ». Les niveaux au-dessus du plafond sont grisés.
- L'enregistrement se fait par `PUT`.
  - Un 422 s'affiche sur la ligne concernée (`handledStatuses: [422]`), sans toast global.
- Aide : une icône d'aide avec une phrase courte, sans paragraphe dans la carte.

### 9.7 Tests de non-retour

| Id | Test | Vérifie |
| --- | --- | --- |
| T1 | Équivalence, sans surcharge : pour chaque rôle et chaque ressource, l'ensemble visible est égal à l'instantané pris à T0 sur main. Ensembles comparés : `GET /documents`, `/documents/stats`, `/users`, `/org-units/tree`, `/users/{id}/hierarchy-tree`. | aucun changement visible par défaut |
| T2 | Lecture hors périmètre : `GET /documents/{id}` et `/content` d'une autre unité renvoient 404, pour `unit` et pour `unit_tree`. | #247 ; ferme l'écart de #203 sur l'objet seul |
| T3 | Écriture ≤ lecture : pour chaque rôle et chaque niveau, si `in_scope` est faux, alors `PATCH`, corbeille et `DELETE` renvoient 404. Inclut le cas du manager propriétaire d'un document hors de son unité. | les deux écarts de 9.1 |
| T4 | Surcharge effective : tenant_admin passe manager/documents à `unit_tree`, et le manager voit le document d'une sous-unité. Un retour à la valeur par défaut le masque. Un second `PUT` identique n'écrit ni ligne ni audit. | réglage et idempotence |
| T5 | Plafond : `PUT` collaborator/documents à `tenant` renvoie 422, sans aucune ligne écrite. | plafond |
| T6 | Isolation : une surcharge dans l'institution A ne change rien dans l'institution B. | multi-tenant |
| T7 | Audit : une ligne par changement effectif, avec l'avant et l'après. | traçabilité |
| T8 | Architecture : aucun endpoint (`app/api/v1/endpoints/*.py`) ne déclare ni n'utilise de liste de rôles de périmètre, comme `*_READ_ROLES`, `INSTITUTION_WIDE_ROLES`, `UNIT_TREE_READ_ROLES` ou `_unit_scope`. En cas d'échec, le message désigne le fichier et la ligne, et renvoie vers `access_scope`. | aucun endroit oublié |
| T9 | e2e : dans la grille, tenant_admin choisit « Son unité et ses sous-unités » pour manager/documents. La liste de documents du manager s'élargit, puis le réglage est remis par défaut. | parcours réel |

Le test existant du lot users de B (`test_users_unit_admin_scope.py`) et ceux de #203 (`test_unit_admin_read_scope.py`, `test_reports_scope_roles.py`) sont gardés et doivent rester verts.

### 9.8 Plan d'exécution (1 h-s)

| Créneau | Qui | Quoi |
| --- | --- | --- |
| T0 à T+25 | B | migration, `access_scope.py`, branchements de 9.2, `GET` et `PUT`, tests T1 à T8 |
| T0 à T+25 | F | colonne et liste déroulante de 9.6 sur un mock du contrat 9.5, test T9 (mock puis réel) |
| T+25 à T+45 | I (scripts Docker prêts) | un seul créneau Docker plafonné : pytest ciblé (access_scope, documents, users, org_units, hierarchy, reports scope), puis e2e chromium (settings, documents, route-guard, scope), puis démontage à 0 |
| T+45 à T+60 | Q, I, O | relecture Q, corps de PR et RAIDER review (I), ouverture des PR (O) |

**Prérequis bloquants :** #203 et #303 fusionnées sur main ; T0 donné par l'orchestrateur.

**Risques :**
- un échec Docker relancé ajoute environ 15 min ;
- si #303 n'est pas sur main à T0, la liste déroulante sort de l'heure, mais l'API reste livrée.
