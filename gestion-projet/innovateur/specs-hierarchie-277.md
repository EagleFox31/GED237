# Chef et équipe d'un agent, profil à jour (#277)

- **Pour** F, qui code les écrans, et Q, qui recette. Innovateur, 17/11/2026. Lot 10 de `plan-v1.1.md`.
- **Base** : `main` f8f1d75. Toutes les routes existent dans `backend/app/api/v1/endpoints/users.py` : rien à faire côté API (B, 17/11).
- **Règles communes** : celles de `specs-fiche-document-274-276.md`. Jamais le texte brut du serveur, un message par code HTTP, textes courts avec accents.

## Routes et droits

| Route | Renvoie | Droit |
|---|---|---|
| `GET /users/{id}/hierarchy-up` | La chaîne des chefs, du N+1 au plus haut, en suivant « rend compte à ». | `users:read` sur l'agent visé |
| `GET /users/{id}/hierarchy-down` | Les agents qui rendent compte directement à cet agent, sur un seul niveau, triés par matricule. | `users:read` |
| `GET /users/me` | Le profil de la personne connectée. | Connecté |

`users:read` est détenu par :
- l'administrateur de la plateforme et l'administrateur d'institution (`users:manage`) ;
- l'administrateur d'unité ;
- l'auditeur.

Un agent, un manager ou un lecteur **n'a pas** ce droit : voir « Hors périmètre ».

## A. Chef et équipe dans l'écran Utilisateurs

**Où** : fiche d'un agent dans l'écran Utilisateurs (`tenant-admin/pages/users/AgentsListTab.tsx`, et `UserTable` côté administrateur de la plateforme).

### Ce que voit l'administrateur

Un bloc **Rattachement** dans la fiche de l'agent :
- **Rend compte à** : la chaîne des chefs, sur une ligne : « Paul Mbarga (N+1) › Jeanne Fouda (N+2) › … ». Chaque nom ouvre la fiche de cette personne. Au-delà de 3 niveaux, les intermédiaires se replient en « … », et un clic les déplie.
- **Son équipe** : la liste des agents qui lui rendent compte directement, avec le nom, le matricule et le rôle en clair. Compteur : « 4 personnes ». Chaque nom ouvre la fiche de la personne.
- **Aucun chef** : « Ne rend compte à personne. » **Aucune équipe** : « Personne ne lui rend compte. »
- Le bloc se charge à l'ouverture de la fiche, pas dans la liste, pour ne pas multiplier les appels.
- Le choix « Rend compte à », dans le formulaire de modification, ne change pas. Après un enregistrement, le bloc se recharge.

### Messages

| Cas (code) | Message affiché |
|---|---|
| 404 (agent supprimé, ou d'une autre institution) | « Agent introuvable. » |
| 403 | Le bloc ne s'affiche pas. L'écran ne l'affiche que si `users:read` est accordé (`useCan`, introduit par #181). |
| Erreur réseau ou 500 | « Rattachement indisponible pour le moment. », dans le bloc seulement : le reste de la fiche reste utilisable. |

### Critères d'acceptation

1. Dans la fiche d'un agent du jeu de démo qui a un N+1 et un N+2, la chaîne s'affiche dans l'ordre N+1 › N+2.
2. Dans la fiche d'un chef, son équipe directe s'affiche, sans les agents de N-2.
3. Changer le « Rend compte à » d'un agent met à jour le bloc sans recharger la page, et l'agent apparaît dans l'équipe de son nouveau chef.
4. L'administrateur d'une institution n'obtient jamais la chaîne d'un agent d'une autre institution : 404 et « Agent introuvable. »
5. Un manager connecté ne voit pas le bloc « Rattachement » dans l'écran Utilisateurs, auquel il n'a pas accès. Il a sa propre vue (partie C).

## B. Profil à jour après modification (`/users/me`)

**Problème** : le nom, le matricule et le rôle affichés dans l'en-tête (`Header.tsx`, menu du compte) sont lus à la connexion. Si l'agent change son nom dans son profil (#222, réponse 8 du PO), ou si un administrateur change son rôle, l'en-tête reste sur l'ancienne valeur jusqu'à la reconnexion.

### Ce que voit l'agent

- Après l'enregistrement de son profil : message « Profil enregistré. ». L'en-tête montre aussitôt le nouveau nom, par un appel à `GET /users/me`.
- À chaque retour sur l'onglet du navigateur, au plus une fois toutes les 5 minutes, l'écran relit `/users/me`. Si le rôle a changé, le menu se met à jour sans message.
- Si `/users/me` répond 401, la session a expiré : le comportement de déconnexion existant s'applique, sans nouveau message.

### Critères d'acceptation

1. L'agent change son prénom : l'en-tête affiche le nouveau prénom sans reconnexion.
2. Un administrateur passe un agent de « Collaborateur » à « Manager ». L'agent, connecté, voit son menu de manager au plus tard 5 minutes après être revenu sur l'onglet.
3. Aucun appel `/users/me` en boucle : au plus un appel par retour sur l'onglet et par tranche de 5 minutes, vérifié dans les requêtes réseau du test.

## C. « Mon équipe » pour chacun (V1.1, décision de O du 17/11)

Le PO attend qu'un manager voie sa propre chaîne et ses N-1. Coût total : 1,0 h-s (B 0,5, F 0,25, Q 0,25). C'est pile le seuil fixé par O.

**API (B)** : `hierarchy-up` et `hierarchy-down` sont autorisées sans `users:read` dans deux cas :
- quand `id` est la personne connectée ;
- quand l'agent visé rend compte directement à elle.

Hors de ces cas, un rôle sans `users:read` reçoit **404**, selon la convention de #263. Si #263 n'est pas encore fusionnée, B reproduit la règle localement.

### Ce que voit l'agent

- Une entrée **Mon équipe** dans le menu du compte (en-tête), pour tous les rôles.
- La page réutilise le bloc « Rattachement » de la partie A :
  - **Je rends compte à** : ma chaîne de chefs ;
  - **Mon équipe** : mes N-1 directs, avec le nom, le matricule et le rôle en clair. Pas de N-2.
- **Agent sans équipe** : seule la partie « Je rends compte à » s'affiche, sans message.
- **Agent sans chef ni équipe** : « Vous n'êtes rattaché à personne pour le moment. Contactez votre administrateur. »
- Un nom de l'équipe n'ouvre pas de fiche pour un manager sans `users:read` : c'est du texte simple.

### Critères d'acceptation

1. Un manager du jeu de démo voit sa chaîne et ses N-1 directs, sans ses N-2.
2. Un collaborateur voit sa chaîne. Il ne voit pas d'équipe s'il n'en a pas.
3. Un appel direct à la chaîne d'un voisin ou d'un N-2, par un rôle sans `users:read`, renvoie 404.
4. Un administrateur (avec `users:read`) garde l'accès à tous les agents de son institution.
5. Tests par rôle côté API : soi, N-1 direct, N-2 refusé, voisin refusé, rôle avec `users:read`.

## Hors périmètre de #277

- Organigramme graphique de l'institution.
