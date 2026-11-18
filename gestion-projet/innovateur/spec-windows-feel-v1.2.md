# Spec V1.2 — une application qui se comporte comme Windows

- **Pour** O, puis F, B et Q. Innovateur, 18/11/2026. Base : `origin/main` 2f15b6e, lu en lecture seule.
- **But** : l'agent retrouve dans GED237 les gestes qu'il fait chaque jour dans Windows, sans formation.
- **Périmètre** : quatre idées, éléments 20 à 23 de `plan-v1.2.md`. L'apparence « Windows 11 » (idée 4) est écartée : elle change l'identité visuelle sans gain d'usage.
- **Prolonge** `spec-reflexes-windows-explorateur.md` (lots L1 clavier et L2 clic droit livrés en #164 et #173 ; L3 sélection multiple et L4 Suppr, F2, glisser-déposer). Ici, rien ne remplace ces lots.
- **Contraintes communes** :
  - aucune nouvelle bibliothèque (gel des dépendances jusqu'au 30/11, et sobriété ensuite) ;
  - tout doit marcher **sans Internet**, sur le réseau de l'institution ;
  - mêmes droits et même trace d'audit que les actions existantes, jamais de raccourci qui les contourne ;
  - aide par icône `help` et infobulle courte, pas de bandeau (règles UX du projet : densité et aide).
- Chiffres en h-s, `Déduit` sauf mention contraire ; F, B et Q les remplaceront.

## 20 — Glisser des fichiers depuis l'Explorateur Windows sur un dossier

**Aujourd'hui** (`Mesuré`, lecture du code) : le dépôt de fichiers n'existe que dans `frontend/components/UploadDocumentModal.tsx` (l. 42 et 119), et il ne prend que **le premier fichier** (`e.dataTransfer.files[0]`). L'explorateur des espaces (`frontend/profiles/tenant-admin/pages/SpacesPage.tsx`) n'accepte aucun dépôt venant de Windows.

**Attendu** :
1. L'agent fait glisser un ou plusieurs fichiers depuis l'Explorateur Windows sur un dossier de l'arbre, ou sur la zone de contenu (= dossier ouvert).
2. Le dossier visé se met en surbrillance pendant le survol ; le curseur indique « copier ».
3. Au lâcher, l'écran d'import existant s'ouvre, **dossier de destination pré-rempli** et fichiers déjà listés. Rien n'est envoyé sans confirmation.
4. Plusieurs fichiers : la même liste que l'import existant, avec doublons repérés et refusés comme aujourd'hui.
5. Un dossier Windows glissé : `À vérifier` (lecture récursive par `webkitGetAsEntry`, sans bibliothèque). S'il n'est pas retenu, message court : « Glissez les fichiers, pas le dossier. »
6. Sans droit d'écriture sur le dossier visé : pas de surbrillance, curseur « interdit », infobulle « Vous ne pouvez pas déposer ici. »

**Règles** :
- Distinguer le dépôt venant de Windows (`dataTransfer.types` contient `Files`) du glisser-déposer interne de l'élément 18 (#299, reclassement). Les deux partagent les gestionnaires de l'arbre : **les faire ensemble**, par F, à la suite.
- Le rôle collaborateur n'a pas d'import en masse (c'est voulu) : pour lui, le dépôt ouvre l'import d'un seul document, et au-delà d'un fichier : « Un fichier à la fois. »
- Aucune route serveur nouvelle : l'import existant reçoit l'unité de destination.

**Acceptation (Q, e2e)** : dépôt de 1 puis 3 fichiers sur un dossier → écran d'import pré-rempli ; doublon refusé ; dépôt refusé sans droit ; le reclassement interne (18) fonctionne toujours.

**Chiffrage** : B 0 · F 1 · Q 0,5.

## 21 — Application installable (fenêtre à elle, icône dans la barre des tâches)

**Aujourd'hui** (`Mesuré`) : pas de manifeste ni de service worker dans `frontend/`. `frontend/index.html` ne déclare qu'une icône d'onglet. `frontend/public/` contient `icon.png` (≈ 485 Ko), `icon-small.png` et `logo.png`.

**Attendu** : dans Edge ou Chrome, l'agent clique « Installer GED237 ». L'application s'ouvre dans sa propre fenêtre, sans barre d'adresse, avec son icône dans le menu Démarrer et la barre des tâches.

**Contenu** :
- `frontend/public/manifest.webmanifest` : nom, nom court, `display: standalone`, `start_url` et `scope` alignés sur `%BASE_URL%`, couleurs de la charte, icônes 192 et 512 px (PNG redimensionnés une fois à partir de `icon.png`, sans outil ajouté au dépôt) ;
- `index.html` : `<link rel="manifest">` et `<meta name="theme-color">`.

**Limites** :
- **HTTPS obligatoire** (ou `localhost`). Sur le poste de démonstration, le certificat est installé : OK. Sur un autre poste, le navigateur avertit, et l'installation peut être refusée. Même limite que celle des notes de version (adresse publique en 1.2, élément 15).
- **Service worker** : `À vérifier` si Edge et Chrome l'exigent encore pour proposer l'installation. Si oui, un service worker minimal, **sans mise en cache** (pas de mode hors ligne promis, pour ne pas servir une version périmée après une mise à jour).
- L'application reste celle du serveur : rien n'est installé sur le poste, rien ne se met à jour à part.

**Acceptation (Q)** : installation proposée sur le poste de démonstration ; ouverture en fenêtre propre ; icône nette dans la barre des tâches ; connexion et déconnexion inchangées ; aucune requête externe (même contrôle que le test hors ligne du 25/11).

**Chiffrage** : B 0 · F 0,5 · Q 0,25.

## 22 — Vue « Détails » comme dans l'Explorateur

**Aujourd'hui** (`Mesuré`, `SpacesPage.tsx`) :
- les deux vues existent déjà (`ViewMode = 'details' | 'icons'`, l. 123) ; la vue par défaut est **icônes** (l. 200), et le choix est perdu à chaque visite ;
- la vue Détails est un tableau à 6 colonnes fixes : Document, Classement, Cible métier, Taille, Mise à jour, Actions (l. 980-990) ; aucune colonne ne se trie ni ne se redimensionne ;
- le fil d'Ariane est déjà cliquable (l. 596-610) ;
- la liste est **paginée par le serveur** (`limit` et `offset`, l. 319-320), et la route ne propose **aucun tri**. Un tri côté navigateur ne trierait que la page affichée : il faut donc un tri côté serveur.

**Attendu** :
1. **Tri** : clic sur un en-tête = tri croissant, second clic = décroissant, flèche visible, `aria-sort` pour les lecteurs d'écran. Colonnes triables : Document, Taille, Mise à jour (Classement et Cible métier : `À vérifier` avec B, selon le coût de la jointure).
2. **Largeur des colonnes** : poignée sur le bord droit de l'en-tête, largeur minimale, double-clic = largeur ajustée au contenu.
3. **Mémoire** : vue, tri et largeurs retenus par utilisateur dans le navigateur (`localStorage` encadré par `try/catch`, valeurs par défaut si absent).
4. **Barre d'adresse** : le fil d'Ariane reste tel quel ; ajouter un bouton « dossier parent » (flèche haut). Le raccourci `Alt+↑` est à rapprocher du lot L1 clavier (`À vérifier` : déjà livré ou non).

**Serveur (B)** : paramètres `sort` et `order` sur la liste des documents, avec une **liste blanche** de champs (jamais un nom de colonne libre dans la requête) ; tri secondaire stable par identifiant pour que la pagination ne saute ni ne répète aucune ligne ; filtre des droits inchangé.

**Acceptation (Q)** : tri sur 2 pages de résultats (le premier élément de la page 2 suit bien le dernier de la page 1) ; champ de tri inconnu → 422 ; vue et tri retrouvés après déconnexion ; vue Icônes inchangée.

**Chiffrage** : B 0,5 · F 1,25 · Q 0,5.

## 23 — Notifications Windows pour les visas et les revues

**Aujourd'hui** (`Mesuré`) : l'infrastructure existe mais **ne pousse rien**.
- Serveur : modèle `Notification`, `InAppNotifier` qui enregistre en base, abonnés à `WORKFLOW_ASSIGNED` et `WORKFLOW_COMPLETED` (`services/notifications/listeners.py`), WebSocket `/notifications/ws` avec un gestionnaire de connexions (`endpoints/notifications.py`).
- Mais **personne n'appelle** `send_personal_message` : une notification créée n'arrive en direct à personne ; elle n'apparaît qu'au rechargement de la liste.
- `WORKFLOW_ASSIGNED` est émis (`workflows.py` l. 229 et 533). **`WORKFLOW_COMPLETED` n'est émis nulle part** : le déposant n'est jamais prévenu du visa ou du rejet.
- Aucun événement pour la bannette « à revoir ».
- Navigateur : `useNotifications.ts` ouvre le WebSocket et ajoute en tête ce qu'il reçoit ; l'en-tête affiche le compteur de non-lus. Pas de reconnexion après une coupure, pas d'appel à l'API `Notification` du navigateur.
- Le relais `nginx/app-locations.conf` transmet déjà les en-têtes `Upgrade`.

**Choix de technique** :
- **Web Push est écarté** : il passe par un service de notification sur Internet (celui de l'éditeur du navigateur), incompatible avec le fonctionnement sans Internet.
- On garde le **WebSocket existant** : la notification Windows s'affiche **quand l'application est ouverte**, même réduite ou derrière une autre fenêtre. Application fermée = rien, et c'est dit à l'agent.

**Attendu** :
1. Serveur (B) :
   - après l'enregistrement, `InAppNotifier` pousse la notification sur le WebSocket de son destinataire ;
   - émettre `WORKFLOW_COMPLETED` au visa et au rejet (motif inclus) ;
   - nouvel événement « document mis en revue », à destination des administrateurs de l'institution, **regroupé par import** (une notification « 12 documents à revoir », pas douze).
2. Navigateur (F) :
   - dans le menu des notifications, un interrupteur « Prévenir sur le bureau » qui demande l'autorisation **au clic** (jamais à l'ouverture de la page) ;
   - si la fenêtre n'a pas le focus, afficher une notification Windows : titre court, une ligne de texte, **sans contenu du document** (l'écran peut être vu par d'autres) ;
   - clic sur la notification = l'application revient au premier plan sur le document ou la bannette ;
   - reconnexion automatique du WebSocket, à intervalles croissants, puis rechargement de la liste pour ne rien perdre.
3. Aide : icône `help` à côté de l'interrupteur : « Fonctionne quand GED237 est ouvert, même en arrière-plan. »

**Points de vigilance** :
- **Un seul processus d'API** aujourd'hui (`uvicorn` sans `--workers`) : un gestionnaire en mémoire suffit. Si une notification naît dans le worker Celery (import en tâche de fond) ou si l'API passe à plusieurs processus, il faut un relais par Redis (déjà présent, pas de nouvelle bibliothèque). `À vérifier` par B : où naissent les revues pendant un import.
- **Jeton dans l'adresse du WebSocket** (`?token=`, `useNotifications.ts` l. 38) : il peut finir dans les journaux d'accès du relais. Existant, suivi par le ticket **#316** (security, v1.2) : ticket de courte durée ou jeton envoyé dans le premier message. **À traiter avant ou avec l'élément 23**, qui fait reposer davantage de trafic sur ce WebSocket.
- HTTPS requis pour l'API `Notification` (même limite qu'à l'élément 21).
- Isolation : le destinataire est résolu côté serveur, dans le `tenant_id` de l'événement ; jamais d'envoi à un identifiant fourni par le navigateur.

**Acceptation (Q)** : visa → le déposant reçoit la notification en moins de 5 s sans recharger ; rejet → motif visible ; import avec revues → une seule notification pour l'administrateur ; fenêtre en arrière-plan → notification Windows ; autorisation refusée → seulement le compteur, sans erreur ; coupure du serveur puis retour → reconnexion et liste complète ; un utilisateur d'une autre institution ne reçoit rien.

**Chiffrage** : B 1 · F 0,75 · Q 0,75.

## Récapitulatif

| Élément | B | F | Q | Total | Dépend de |
|---|---|---|---|---|---|
| 20 Glisser depuis Windows | 0 | 1 | 0,5 | 1,5 | 18 (#299), à faire à la suite |
| 21 Application installable | 0 | 0,5 | 0,25 | 0,75 | HTTPS (élément 15 pour les autres postes) |
| 22 Vue Détails | 0,5 | 1,25 | 0,5 | 2,25 | — |
| 23 Notifications Windows | 1 | 0,75 | 0,75 | 2,5 | circuit de validation (V1.0) |
| **Total** | **1,5** | **3,5** | **2** | **≈ 7** | |

**Ordre proposé** : 21 d'abord (petit, visible, sans risque), puis 22, puis 18 et 20 ensemble, puis 23 (le seul qui touche le serveur et la sécurité).

**Ce que la démo du 30/11 n'en dit pas** : rien de cela n'est livré en 1.0. Si on pose la question, on répond : « Prévu en 1.2. »
