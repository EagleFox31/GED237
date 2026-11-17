# Corbeille (#181), avec les 404 de #263

- **Pour** F, qui code les écrans, et Q, qui recette. Innovateur, 17/11/2026. Lot 1 de `plan-v1.1.md`.
- **Base** :
  - serveur : PR #152 (branche `feat/post-rc1-l2-trash`) ;
  - écran : PR #181 (branche `feat/post-rc1-trash-ui`), déjà codée.
  Cette spec fixe les textes et les critères de recette. Elle ne demande de changement à #181 que là où elle s'en écarte : voir « Écarts avec #181 ».
- **Règles communes** : celles de `specs-fiche-document-274-276.md`. Jamais le texte brut du serveur ; un message par code HTTP ; textes courts avec accents.

## Qui peut faire quoi

Le serveur décide. L'écran affiche une action seulement si `GET /authz/me/permissions` l'accorde (hook `useCan`), et la masque en cas d'erreur.

| Action | Droit (serveur) | Qui, dans la rc.1 et #152 |
|---|---|---|
| Mettre à la corbeille | `documents:delete`, ou `documents:trash_own` pour ses propres documents | administrateurs ; l'agent pour ses documents |
| Voir la corbeille | connecté | chacun voit ce que le serveur lui renvoie (voir « Périmètre ») |
| Restaurer | même droit que pour mettre à la corbeille | idem |
| Supprimer définitivement, vider | `documents:purge` | administrateur d'institution (`tenant_admin`, ajouté par #152) et administrateur de la plateforme |

## Ce que voit l'agent

- **Menu** : entrée **Corbeille**.
- **Mettre à la corbeille** :
  - accès : menu contextuel de l'explorateur et pied de la fiche document ;
  - pas de confirmation, car l'action se rattrape ;
  - message « Document placé dans la corbeille. », avec un bouton **Annuler** pendant 5 secondes, qui restaure.
- **Page Corbeille** :
  - titre « Corbeille » et compteur « 12 documents » ;
  - aide derrière l'icône « ? » : « Les documents supprimés arrivent ici. Restaurez-les pour les remettre à leur place. » ;
  - chaque ligne affiche le titre, le service, la date de suppression (« supprimé le 17/11 à 14 h 05 ») et le nom de la personne qui l'a supprimé ;
  - « Afficher plus » au-delà de la première page.
- **Restaurer**, sur chaque ligne : le document retrouve sa place, la ligne disparaît, message « Document restauré. ».
- **Supprimer définitivement**, sur chaque ligne, seulement avec `documents:purge`. Confirmation :
  - titre « Supprimer définitivement ? » ;
  - texte « Ce document sera effacé pour de bon. Cette action ne peut pas être annulée. » ;
  - boutons **Supprimer** (rouge) et **Annuler**.
- **Vider la corbeille**, en haut de page, seulement avec `documents:purge`. Confirmation :
  - titre « Vider la corbeille ? » ;
  - texte « Les 12 documents seront effacés pour de bon, sauf ceux qui sont signés ou archivés. Cette action ne peut pas être annulée. » ;
  - pendant le vidage, « Suppression en cours… 200 sur 412 ». L'écran rappelle le serveur tant que `remaining` est supérieur à 0.
- **Documents protégés** (signés ou archivés) : pas de bouton **Supprimer définitivement**, et l'étiquette « Signé ou archivé : ne peut pas être effacé ». **Restaurer** reste possible.
- **Corbeille vide** : « La corbeille est vide. »
- **Purge automatique** : #152 l'ajoute (`TRASH_RETENTION_DAYS`), désactivée par défaut (0). Si le serveur expose une durée supérieure à 0, une ligne d'aide dit « Les documents sont effacés automatiquement 30 jours après leur suppression. » Sinon, rien.

## Messages

| Cas (route, code, `error`) | Message affiché |
|---|---|
| `trash`, `restore` ou `purge`, 403 | « Vous n'avez pas le droit de faire cette action. » |
| `restore` ou `purge`, **404** (document déjà effacé, ou hors de votre périmètre avec #263) | « Document introuvable. Il a peut-être déjà été effacé. » La ligne disparaît de la liste. |
| `purge`, 409 `document_not_in_trash` (restauré entre-temps par quelqu'un d'autre) | « Ce document a été restauré entre-temps. » La ligne disparaît. |
| `purge`, 409 `document_protected` | « Un document signé ou archivé ne peut pas être effacé. » |
| `trash`, 423 (réservé par un autre, #274) | Message du 423 de `specs-fiche-document-274-276.md`. |
| `trash/empty`, 200 avec `remaining = 0` | « Corbeille vidée : 412 documents effacés. » Si des documents protégés restent : « 3 documents signés ou archivés sont conservés. » |
| `trash/empty`, erreur en cours de vidage | « Le vidage s'est arrêté : 200 documents effacés, 212 restent. Réessayez. » Pas de retour en arrière : ce qui est effacé l'est. |
| Liste, erreur réseau ou 500 | « Corbeille indisponible pour le moment. » |

**404 de #263** : on n'écrit jamais « vous n'avez pas accès ». Un document hors périmètre et un document déjà effacé donnent le même message.

## Périmètre : point à régler avec B

Sur #152, la liste de la corbeille se borne par rôle :
- rôles à lecture d'institution : toute l'institution ;
- rôles d'unité : leur service seul ;
- les autres : leurs propres documents.

Elle ne suit pas encore le périmètre de #203 (service et sous-services, réponse 5 du PO). **Critère** : après #203, un agent ne voit dans la corbeille que des documents qu'il pouvait voir avant leur suppression. Si #181 fusionne avant #203, l'écart est noté dans les limites de la V1.1.

## Écarts avec #181, à faire par F

1. Bouton **Annuler** pendant 5 s après « Mettre à la corbeille ». Si F juge ce point trop coûteux, il le dit, et on le sort en V1.2.
2. La ligne de corbeille affiche la date de suppression et la personne qui a supprimé. **Vérifié sur #152 : `DocumentRead` n'expose ni `deleted_at` ni `deleted_by`.** B les ajoute, avec le nom de la personne (≈ 0,25 h-s, `Déduit`). Sans eux, la ligne n'affiche que le titre et le service, et la liste reste triée par date de suppression côté serveur.
3. Le 404 sur `restore` et `purge` retire la ligne, avec le message ci-dessus.
4. Le message de fin de « Vider » distingue les documents protégés.

## Critères d'acceptation

1. Un agent met un de ses documents à la corbeille depuis l'explorateur, puis le restaure depuis la page Corbeille. Le document retrouve son dossier, et les deux actions figurent au journal d'audit.
2. Un manager peut restaurer, mais ne voit ni **Supprimer définitivement** ni **Vider** (`documents:purge` refusé par le serveur).
3. L'administrateur d'institution supprime définitivement un document après confirmation. Ouvrir ensuite son lien `?open=` affiche « Document introuvable… » (`specs-fiche-document-274-276.md`, § #263).
4. Un document signé ou archivé n'a pas de bouton **Supprimer définitivement**, et « Vider » le conserve.
5. Vider une corbeille de plus de 200 documents va jusqu'au bout en plusieurs appels, avec la progression affichée.
6. Deux administrateurs : A restaure un document pendant que B le supprime définitivement. B reçoit « Ce document a été restauré entre-temps. », sans erreur technique.
7. L'administrateur d'une institution ne voit, ne restaure ni n'efface jamais un document d'une autre institution (404 côté serveur, même message).
8. Les tests de #181 (`e2e/specs/uat/trash.spec.ts`) passent, avec les points 1 à 6 ajoutés.
