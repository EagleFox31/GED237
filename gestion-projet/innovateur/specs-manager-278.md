# Tableau de bord du manager et détail d'un modèle de circuit (#278)

- **Pour** F, qui code les écrans, et Q, qui recette. Innovateur, 17/11/2026. Lot 10 de `plan-v1.1.md`.
- **Base** : `main` f8f1d75. Les routes existent : rien à faire côté API (B, 17/11), à part le périmètre apporté par #203.
- **Règles communes** : celles de `specs-fiche-document-274-276.md`. Jamais le texte brut du serveur, un message par code HTTP, textes courts avec accents.
- **Dans le plan** : #278 est la sortie n° 4 (valeur moyenne-faible). Si la capacité de Q manque, elle part en V1.2 la première.

## A. Tableau de bord du manager (`GET /analytics/manager`)

### Ce que renvoie la route

- Droit : `analytics.tenant:read`. Tous les rôles d'une institution l'ont, collaborateur compris.
- Périmètre :
  - **sur `main`** : le service de la personne connectée, sans ses sous-services ;
  - **avec #203** : le service et ses sous-services, sur un niveau (réponse 5 du PO).
- Champs renvoyés :
  - `documents.total` ;
  - `documents.needs_review` (documents à classer ou à revoir) ;
  - `documents.storage_used_mb` ;
  - `active_workflows` (circuits de validation en cours).

### Ce que voit le manager

**Où** : en tête de la page d'accueil du manager (`profiles/manager`), au-dessus de « Validations ». Les autres rôles ne le voient pas dans la V1.1.

Quatre tuiles, avec chiffres et libellés courts :

| Tuile | Chiffre | Clic |
|---|---|---|
| **Documents du service** | `documents.total` | ouvre la liste des documents, filtrée sur le service |
| **À revoir** | `documents.needs_review` | ouvre la liste des documents à revoir, si le rôle y a accès ; sinon pas de lien |
| **Validations en cours** | `active_workflows` | ouvre « Validations » |
| **Espace utilisé** | `storage_used_mb`, affiché « 1,2 Go » ou « 350 Mo » | pas de lien |

- Sous les tuiles, une ligne discrète : « Service : Direction des affaires financières, et ses sous-services ». La mention « et ses sous-services » n'apparaît qu'avec #203.
- Les chiffres se rechargent à l'ouverture de la page, sans rafraîchissement automatique.
- **Format** : séparateur de milliers français (« 1 234 »). `storage_used_mb` peut arriver en chaîne (#264) : l'écran accepte un nombre ou une chaîne.

### Messages

| Cas | Message affiché |
|---|---|
| Le manager n'est rattaché à aucun service | À la place des tuiles : « Vous n'êtes rattaché à aucun service. Contactez votre administrateur. » Sans appel au serveur, si le profil n'a pas d'unité. |
| 403 | Les tuiles ne s'affichent pas, sans message. |
| Erreur réseau ou 500 | « Chiffres indisponibles pour le moment. » La page reste utilisable. |
| Service vide | Les tuiles affichent 0 : pas de message. |

### Critères d'acceptation

1. Un manager MINFI du jeu de démo voit les quatre tuiles. Le total égale le nombre de documents de son service dans la liste (même périmètre).
2. Un clic sur **Documents du service** ouvre la liste filtrée, et elle montre ce même nombre.
3. Après #203, un document d'un sous-service est compté. Un document d'un service voisin ne l'est pas.
4. Un document mis à la corbeille ne compte plus dans aucune tuile : vérifié sur `main`, la route filtre `deleted_at` pour les quatre chiffres. `active_workflows` compte les étapes en cours, pas les documents. Le libellé « Validations en cours » reste juste.
5. Aucun chiffre d'un autre service ou d'une autre institution n'apparaît, même par appel direct.

## B. Détail d'un modèle de circuit (`GET /gedrules/templates/{id}`)

### Ce que renvoie la route

- Droit : `gedrules.templates:read`. Seuls l'administrateur d'institution et l'administrateur de la plateforme l'ont.
- Champs renvoyés :
  - `code`, `name`, `description`, `is_active` ;
  - les étapes (`steps`), avec pour chacune `step_order`, `label`, `expected_action_type`, `role_id`, `assignment_scope` et `target_unit_type_id`.
- Un modèle d'une autre institution renvoie 404.

### Ce que voit l'administrateur

**Où** : onglet des modèles (`tenant-admin/pages/gedrules/TemplatesTab.tsx`). Un clic sur une ligne ouvre un panneau latéral **Détail du modèle**, en lecture. Le bouton **Modifier** existant ouvre l'édition comme aujourd'hui.

Le panneau montre :
- le nom, le code en petit, la description, et l'état « Actif » ou « Désactivé » ;
- les étapes, numérotées dans l'ordre, sous la forme : « 1. Visa — par un Manager du même service ».

**Libellés en français simple** (pas de code brut à l'écran) :

| Valeur | Libellé |
|---|---|
| `read_ack` | Prise de connaissance |
| `visa` | Visa |
| `approval` | Approbation |
| `final_signature` | Signature finale |
| `same_org_unit` | du même service |
| `parent_org_unit` | du service parent |
| `grandparent_org_unit` | du service au-dessus du parent |
| autre valeur | libellé brut, entre parenthèses, en attendant un libellé |

Le rôle s'affiche par son nom en clair (`ROLE_HUMAN_LABEL`), pas par `role_id`.

### Messages

| Cas (code) | Message affiché |
|---|---|
| 404 (modèle supprimé, ou d'une autre institution) | « Modèle introuvable. » Le panneau se ferme, et la liste se recharge. |
| 403 | Le panneau ne s'ouvre pas. Cela ne devrait pas arriver, puisque l'onglet est déjà réservé aux administrateurs. |
| Erreur réseau ou 500 | « Détail indisponible pour le moment. » |
| Modèle sans étape | « Aucune étape dans ce modèle. » |

### Critères d'acceptation

1. Un clic sur un modèle du jeu de démo ouvre son détail, avec les étapes dans l'ordre et des libellés en français. Aucun code brut (`visa`, `same_org_unit`, numéro de rôle) n'est visible.
2. Un modèle désactivé affiche « Désactivé ».
3. Un identifiant de modèle d'une autre institution, par appel direct, renvoie 404, et l'écran affiche « Modèle introuvable. »
4. Le bouton **Modifier** marche comme avant : test de non-régression de l'onglet des modèles.

## Hors périmètre de #278

- Tableau de bord pour les autres rôles (collaborateur, lecteur), graphiques et évolution dans le temps : V1.2.
- Rapports officiels en PDF : #197.
