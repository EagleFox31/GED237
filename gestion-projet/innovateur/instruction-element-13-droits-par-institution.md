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
