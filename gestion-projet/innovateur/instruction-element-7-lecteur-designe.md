# Instruction de l'élément 7 : lecteur désigné hors circuit (#254, partie 13 a)

- **Statut** : instruction, sans code. À relire par B (porteur), F (écran de désignation) et Q (matrice 404).
- **Demande** : un agent donne à lire un document précis à une personne précise d'un autre service, sans lancer de circuit (`plan-v1.2.md`, ligne de l'élément 7).
- **Décision PO déjà prise** (`fiche-decisions-po-19-11.md`, question 13) : la lecture seule, jamais de modification. Garder l'accès après une étape terminée permet de retrouver ce qu'on a validé.
- **Ce qui reste en V1.1** : #254 « accès par l'étape de circuit » (un `WorkflowStep.assigned_to` met le document dans le périmètre de lecture). L'élément 7 en est l'extension hors circuit.

## 1. Point de départ (main du 18/11, et PR ouvertes)

- **Aucune notion de partage** : ni table, ni ACL, ni lien signé, sur main comme sur les branches distantes. Le contenu est servi par l'API (pas d'URL présignée). Le seul champ d'expiration existant est `lock_expires_at`.
- **Lecture par identifiant** (`documents.py`) :
  - `_get_document_or_404` filtre le tenant ;
  - `_can_read_document` applique Casbin (`documents read`), puis restreint manager et reader à leur unité ;
  - sinon, `read_own`, accordé au collaborateur seulement.
  - `ctx_from_resource` ne transporte que tenant, propriétaire et unité : il n'existe aucun point d'accroche pour un accès accordé à une personne.
- **Règle 404 de #247** (PR #263, ouverte, empilée sur #213) : hors du périmètre, toute route par identifiant répond 404 comme pour un document inexistant. Dans le périmètre, l'absence de droit reste un 403.
  - Point d'entrée unique : `_get_document_in_reach_or_404` / `_in_perimeter`.
  - #308 vérifie la règle sur 18 routes : identifiant caché et identifiant inexistant donnent le même statut et le même corps.
- **Listes et recherche** :
  - `list_documents`, la corbeille et l'espace de travail ont chacun leur `if/elif` sur les rôles ;
  - `visible_document_scope` alimente les statistiques ;
  - la recherche (`core/search/postgres_engine.py`) n'applique que des filtres ET, donc pas de « OU accès accordé ».
- **« Partagés avec moi »** : PR #165 (`GET /me/shared?reason=assigned|visible`, sans table de partage), lieu naturel d'un motif « désigné ».
- **Audit** : `AuditLog` sur `documents`. Seul `/content` journalise une lecture (`content_viewed`). GET, versions et OCR ne sont pas journalisés.
- **Notifications** : en application seulement (`NotificationFactory.get_notifier("in_app")`), patron `dispatcher.dispatch` puis listener. La PR #331 (élément 23) ajoute l'aide `_notify` (rien quand l'auteur est le destinataire).
- **Tâches planifiées** : `beat_schedule` est remplacé, pas fusionné (`celery_app.py`). Toute tâche planifiée ajoutée hérite de ce piège.
- **Alembic** : tête unique `a7c8d9e0f1b2`. Six branches ouvertes en partent déjà, ce qui fait un risque de têtes multiples à la fusion.

## 2. Options

### Option A : table de désignations dédiée (recommandée)

- **Modèle** : `document_reader_grants`.
  - `id`, `tenant_id` (FK, cascade), `document_id` (FK, cascade), `grantee_user_id` (FK), `granted_by` (FK) ;
  - `expires_at` (nullable), `revoked_at` et `revoked_by` (nullables), `created_at` ;
  - index unique partiel (`document_id`, `grantee_user_id`) `WHERE revoked_at IS NULL` : une seule désignation active par couple, et l'historique reste ;
  - index (`grantee_user_id`, `revoked_at`) pour « Partagés avec moi ».
- **Un seul prédicat** `reader_grant_active(user, document)` : désignation non révoquée, non expirée (`expires_at IS NULL OR expires_at > now()`), même tenant. Ce prédicat s'ajoute en OU à `_in_perimeter` pour les seules routes de lecture.
- **Mieux encore** : ce prédicat est le même point d'insertion que #254 V1.1 (étape assignée). Un seul résolveur « accès de lecture accordé » réunit les deux causes, l'étape de circuit et la désignation.
- **Routes** :
  - `POST /documents/{id}/readers` : désigner (idempotent : si une désignation active existe, elle est renvoyée sans doublon) ;
  - `GET /documents/{id}/readers` : la liste des personnes désignées ;
  - `DELETE /documents/{id}/readers/{grant_id}` : révoquer (passe `revoked_at`, ne supprime pas).

### Option B : circuit de lecture à une étape

- **Modèle** : désigner revient à créer en coulisse un circuit d'une étape `read_ack` assignée à la personne. #254 V1.1 donne alors l'accès, sans table ni migration.
- **Ce qui ne va pas** :
  - « hors circuit » devient un circuit : il apparaît dans les statistiques des circuits, dans `/workflows/pending` et dans l'historique, ce qui fausse les chiffres du tableau de bord ;
  - un document ne peut plus porter son vrai circuit en même temps sans règles nouvelles ;
  - aucune expiration ni révocation propre : il faudrait annuler un circuit ;
  - la question 13 b (garder l'accès après l'étape) devient la règle par défaut, sans que la personne qui désigne puisse borner l'accès.

### Comparaison

| Critère | A : table dédiée | B : circuit à une étape |
|---|---|---|
| Migration | 1 table, additive, retour arrière = `drop table` | aucune |
| Fidélité au besoin (« sans circuit ») | oui | non : un circuit caché |
| Expiration, révocation | natives (`expires_at`, `revoked_at`) | à inventer sur le circuit |
| Statistiques des circuits | inchangées | faussées |
| Point d'insertion du droit | le même que #254 V1.1 | #254 V1.1 tel quel |
| Audit | 2 actions claires | noyé dans les événements de circuit |
| Effort B | 1,5 | ≈ 1, puis la dette ci-dessus |

**Recommandation : A**, avec un résolveur commun à #254 V1.1 et à l'élément 7.

Écarté d'office : le lien signé ou public. Il n'existe pas de lien présigné, le contenu passe par l'API, et un lien sortirait du contrôle d'identité et du tenant.

## 3. Droits et périmètre

**Qui peut désigner** : une nouvelle action Casbin, `documents share`.
- Proposition : tenant_admin et unit_admin (par `manage`/`share`), manager (`share`), collaborator (`share_own`, ses documents seulement).
- reader et auditor : non.
- Garde-fou : la personne qui désigne doit elle-même pouvoir lire le document. Sinon 404, selon la règle #247 : on ne donne pas ce qu'on ne voit pas.
- La personne désignée : même tenant, compte actif ; sinon 422. Jamais d'accès inter-institution, y compris pour super_admin, qui n'a pas besoin de désignation.

**Effet de la désignation : un 404 qui devient une lecture autorisée.**
- **Lecture** (le document entre dans le périmètre de la personne) : `GET /documents/{id}`, `/versions`, `/ocr` et `/content`, inline et en téléchargement, passent de 404 à 200.
- **Hors lecture** : `/audit-logs` reste refusé. L'historique révèle les actions des autres, ce qui dépasse « donner à lire ».
- **Modification** (PATCH, verrou, corbeille, lancement de circuit, nouvelle version) : `_in_reach` est inchangé. Comme le document est désormais visible, la règle #263 « dans le périmètre, l'absence de droit reste un 403 » s'applique : la personne obtient **403**, plus 404. C'est exactement le test attendu par #254 (200 en lecture, 403 en écriture).
- **Après révocation ou expiration** : retour au 404 identique à un document inexistant (#308).
- **Listes** :
  - le document apparaît dans « Partagés avec moi » (#165, motif `designated`) ;
  - il n'entre pas dans la liste de l'unité ni dans les statistiques (`visible_document_scope` inchangé) : les chiffres d'un service ne bougent pas parce qu'un document y a été prêté.
- **Recherche** : exclue en V1.2. Il faudrait un OU dans le moteur, qui ne sait faire que des ET (+0,5 h-s B, et un risque sur la règle 404). Le document reste trouvable dans « Partagés avec moi ».

**Lien avec #247/#263** : l'élément 7 se construit sur #263 fusionnée. Il ne touche qu'à une fonction, `_in_perimeter` côté lecture, plus le résolveur commun. Aucune route ne retrouve son propre `if/elif` de rôles.

## 4. Expiration, révocation, audit, notification

- **Expiration** :
  - facultative, choisie par la personne qui désigne : aucune, 7, 30 ou 90 jours ;
  - contrôlée **à la lecture** (`expires_at > now()`), pas par une tâche planifiée : pas de dépendance au `beat_schedule` fragile, et l'effet est immédiat ;
  - une purge éventuelle des lignes expirées pourra venir plus tard, sans effet sur les droits.
- **Révocation** :
  - possible pour la personne qui a désigné, le propriétaire du document, unit_admin dans son sous-arbre, et tenant_admin ;
  - effet immédiat (pas de cache) ; la ligne est gardée pour l'audit ;
  - désigner de nouveau crée une nouvelle ligne ;
  - document mis à la corbeille : plus lisible par la personne désignée, comme pour tout non-administrateur ;
  - document purgé : les désignations sont supprimées en cascade et l'audit reste.
- **Audit** :
  - `reader_granted` et `reader_revoked` sur la table `documents`, avec `new_data = {grantee_id, expires_at}` ;
  - les lectures de la personne désignée via `/content` gardent `content_viewed`, avec `access: "designated"` dans les détails : le propriétaire sait que la lecture vient d'une désignation ;
  - l'expiration n'est pas un événement : elle se déduit de `expires_at`.
- **Notification (lien avec l'élément 23)** :
  - événement `DOCUMENT_READER_GRANTED`, puis listener, puis notification en application à la personne désignée, avec le lien du document ;
  - avec #331 fusionnée, on passe par l'aide `_notify`, et la notification de bureau de l'élément 23 suit sans travail en plus ;
  - pas de notification à la révocation ni avant l'expiration en V1.2.

## 5. Écran (F)

- Sur la fiche du document : une icône « Donner à lire » ouvre un petit dialogue :
  - choisir une personne ;
  - choisir la durée (aucune par défaut) ;
  - voir les personnes déjà désignées, avec une icône de révocation.
  - Respecter la règle de densité : pas de bandeau, une aide en icône.
- Côté personne désignée : l'onglet « Partagés avec moi » (#165), avec la mention « Donné à lire par X, jusqu'au … ».
- **Point à vérifier (B)** : choisir une personne d'un autre service suppose une recherche de comptes accessible à un manager.
  - Si `users:read` lui manque, il faut un `GET /users/lookup?q=` minimal : même tenant, au moins 2 caractères, et seulement id, nom et service.
  - C'est compté dans l'effort ci-dessous.

## 6. Non-régression (Q)

- **Sans aucune désignation**, les 18 routes de #308 sont inchangées : identifiant caché et inexistant donnent le même statut et le même corps.
- **Personne désignée** :
  - lecture : 200 ;
  - modification : 403 ;
  - `/audit-logs` : refusé ;
  - liste de l'unité et statistiques : inchangées.
- **Après révocation, puis après expiration** (horloge de test) : 404 identique à un document inexistant.
- **Désignations refusées** :
  - personne d'un autre tenant : 422, et aucune lecture possible ;
  - collaborateur qui tente de désigner sur le document d'un autre : 404.
- **Idempotence** : désigner deux fois la même personne donne une seule ligne active.
- **Élément 13** : le test d'équivalence (≈ 1 300 cas) est étendu à l'action `share`. Une surcharge « deny share » pour manager dans une institution donne 403 sur `POST /readers` dans cette institution seulement.
- **Migration** :
  - `alembic heads` = 1 après rebase sur la tête du moment ;
  - upgrade, puis downgrade, puis upgrade sur une base de test ;
  - `alembic upgrade head` sur chaque base utilisée.

## 7. Dépendances et ordre

1. **#213 puis #263** (règle 404, `_in_perimeter`), fusionnées : c'est le point d'insertion.
2. **#254 V1.1** (accès par l'étape de circuit) : on y crée le résolveur commun, et l'élément 7 y ajoute sa cause.
3. **Élément 13** (option B validée) : `documents share` est un droit entièrement décidé par Casbin. Il entre dans la liste des droits réglables par institution, et l'élément 7 s'écrit directement dans ce modèle (`plan-v1.2.md` : « faites après 13 »).
   - Le **droit de désigner** relève de la grille (élément 13).
   - L'**effet d'une désignation** relève du périmètre : c'est une donnée par document, pas une case de la grille.
4. **#165** (« Partagés avec moi ») pour l'écran de la personne désignée. Sans elle, une liste simple « Donnés à lire » sur la fiche suffit.
5. **#331** (élément 23), facultative : sans elle, appel direct de `NotificationFactory`.

## 8. Effort (option A)

- **B : 1,5 h-s** : table et migration, 3 routes, résolveur, audit, notification. Plus 0,25 si `GET /users/lookup` est nécessaire.
- **F : 1 h-s** : dialogue et onglet.
- **Q : 0,75 h-s** : la matrice 404/403 du point 6, et l'extension du test d'équivalence.
- **Total : 3,25 à 3,5 h-s**, contre 3 au plan (`plan-v1.2.md`). L'écart vient de Q (matrice #308) et de la recherche de comptes possible.

## 9. Questions au PO (réponses par défaut proposées)

1. **Durée par défaut d'une désignation ?** Par défaut : aucune, et la personne qui désigne peut choisir 7, 30 ou 90 jours.
2. **La personne désignée peut-elle télécharger, ou seulement consulter ?** Par défaut : télécharger aussi. Lire, c'est lire, et chaque lecture est journalisée.
3. **Le document désigné doit-il ressortir dans la recherche dès la V1.2 ?** Par défaut : non. Il est accessible par « Partagés avec moi », et la recherche viendra plus tard (+0,5 h-s B).
