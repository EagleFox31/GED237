# Réglages à l'écran (8a) et grille des droits (8b) (#280)

- **Pour** B (API), F (écrans) et Q (recette). Innovateur, 17/11/2026. Lot 8 de `plan-v1.1.md`, décision du PO du 17/11 (question 12, choix C).
- **Base** : `main` f8f1d75, vérifiée le 17/11. Le ticket est `ticket-v1.1-reglages-ecran.md` ; cette spec fixe les écrans, les messages et la recette.
- **Règles communes** : celles de `specs-fiche-document-274-276.md`. Jamais le texte brut du serveur, un message par code HTTP, textes courts avec accents.
- **Qui** : l'administrateur de la plateforme (super admin) seul, pour 8a comme pour 8b. Aucun nouveau droit pour un autre rôle.
- **Ordre** : 8a attend #230 (fonctions) et #154 (serveur e-mail) pour ces deux réglages seulement ; le reste de 8a peut partir avant. 8b attend #228 (lot 3) et #235 → #238 (lot 13).

## Lot 8a — Réglages à l'écran

### Réglages visés (relevés sur `main`, `backend/app/core/config.py`)

| Réglage à l'écran | Variable du serveur (défaut) | Bornes proposées (`Déduit`, B confirme) | Prise d'effet |
|---|---|---|---|
| **Durée d'une session sans activité** | `ACCESS_TOKEN_EXPIRE_MINUTES` (30 min) | 5 à 240 min | connexions suivantes |
| **Rester connecté au plus** | `REFRESH_TOKEN_EXPIRE_DAYS` (7 jours) | 1 à 30 jours | connexions suivantes |
| **Codes faux avant blocage du compte** | `AUTH_OTP_MAX_FAILURES` (3) | 3 à 10 | tout de suite |
| **Durée du blocage** | `AUTH_LOCKOUT_SECONDS` (900 s) | 5 à 60 min, saisie en minutes | blocages suivants |
| **Taille maximale d'un fichier** | `MAX_UPLOAD_SIZE_MB` (100 Mo) | 1 à **100 Mo** | tout de suite |
| **Fonctions activées** (#230) | celles de #230 | interrupteur par fonction | tout de suite |
| **Serveur e-mail** (#154) | hôte, port, expéditeur, chiffrement | port de 1 à 65535 | envois suivants |

- **Taille maximale** : 100 Mo au plus à l'écran, car le proxy (`nginx/app-locations.conf`, `client_max_body_size 101M`) refuse au-delà. Monter plus haut demande un changement sur le serveur, hors écran.
- **Limites de débit** (`AUTH_*_RATE_LIMIT`) : hors 8a. Elles se règlent par adresse IP et protègent des attaques : elles restent sur le serveur.
- **Jamais à l'écran ni dans l'API** : `DB_PASSWORD`, `SECRET_KEY`, mot de passe du serveur e-mail, `ENVIRONMENT`, port, sauvegardes, `AUTHZ_BACKEND`.

### Contrat attendu de l'API (B fixe les noms de routes)

- Une lecture de tous les réglages. Pour chacun : la clé, la valeur en vigueur, la valeur par défaut du serveur, l'origine (`server` ou `screen`), les bornes et l'unité.
- Une écriture par réglage, avec la nouvelle valeur. Le serveur vérifie les bornes (422 hors bornes).
- Un retour à la valeur du serveur (suppression de la valeur en base).
- Les valeurs sont en base, avec un cache. Un changement s'applique **sans redémarrer** la pile, sur toutes les instances.
- Chaque changement est inscrit au **journal d'audit**, avec le nom du réglage, l'ancienne et la nouvelle valeur, et l'auteur.
- La réponse ne contient aucun secret. Un test le prouve, sur la réponse entière.

### Ce que voit le super admin

**Où** : une page **Réglages** dans l'espace du super admin, en sections :
- **Connexion** : durée de session, rester connecté, codes faux, durée du blocage ;
- **Documents** : taille maximale d'un fichier ;
- **Fonctions** : interrupteurs de #230 ;
- **E-mail** : hôte, port, expéditeur, chiffrement.

Pour chaque réglage :
- la valeur, modifiable, avec l'unité (« minutes », « jours », « Mo ») ;
- sous le champ, en petit : « Valeur du serveur : 30 minutes » ;
- quand la valeur vient de l'écran, un lien **Revenir à la valeur du serveur** ;
- une icône « ? » avec une phrase courte, par exemple, pour les codes faux : « Après ce nombre de codes faux, le compte est bloqué un moment. »

Un bouton **Enregistrer** par section, actif seulement s'il y a un changement. Après l'enregistrement : « Réglages enregistrés. »

Ligne d'aide en tête de page, derrière l'icône « ? » : « Les mots de passe et les clés techniques ne se règlent pas ici. Ils restent sur le serveur. »

**E-mail** : un bouton **Envoyer un e-mail de test** à l'adresse du super admin, si #154 le prévoit. Le champ du mot de passe n'existe pas à l'écran.

### Messages

| Cas (code) | Message affiché |
|---|---|
| 200 | « Réglages enregistrés. » |
| 422 (hors bornes) | Sous le champ : « Entre 5 et 240 minutes. » (les bornes renvoyées par la lecture) |
| 403 | « Vous n'avez pas le droit de modifier les réglages. » |
| Erreur réseau ou 500 | « Les réglages n'ont pas été enregistrés. Réessayez. » Les champs gardent la saisie. |
| Lecture impossible | « Réglages indisponibles pour le moment. » |

### Critères d'acceptation

1. Le super admin passe la durée de session de 30 à 15 minutes. Sans redémarrage, une nouvelle connexion expire au bout de 15 minutes. Le journal d'audit montre « 30 → 15 » et son nom.
2. **Revenir à la valeur du serveur** rétablit 30 minutes, avec une ligne au journal.
3. La taille maximale passe à 10 Mo : un fichier de 12 Mo est refusé, à l'écran (#275) comme par l'API (413).
4. Une valeur hors bornes (0, 500 Mo) est refusée par l'API (422), même par appel direct.
5. Aucune réponse de l'API des réglages ne contient de mot de passe ni de clé (test sur la réponse entière).
6. Un administrateur d'institution n'a ni la page ni l'accès par l'API (403).
7. Avec deux instances de l'API, un changement s'applique sur les deux (cache invalidé).

## Lot 8b — Grille des droits

### Ce qui existe sur `main`

- Routes `GET`, `POST` et `DELETE /authz/policies`, et `GET /authz/roles` (`backend/app/api/v1/endpoints/authz.py`) : **super admin seul** (403 sinon).
- **Elles répondent 409 tant que `AUTHZ_BACKEND` vaut `csv`**, ce qui est le défaut (`config.py`, l. 108). Il faut `sql` (ou `shadow`) pour que la grille écrive.
  - **Décision à prendre par O avec B** : passer la pile de démo et la prod en `sql`, ce que #235 → #238 (lot 13) prépare en synchronisant `policy.csv` et la table `casbin_rule`. Sans cela, la grille reste en lecture seule.
- Le vocabulaire est figé (`policy.csv`) : une ressource ou une action inconnue renvoie 422.
- Une règle `manage` vaut toutes les actions sur la ressource (matcher de `model.conf`). Sur `main`, 21 règles sur 80 sont des `manage`.
- **Les droits sont les mêmes pour toutes les institutions** : il n'y a pas de domaine par institution dans les règles. Cocher une case change le droit de ce rôle partout.
- Les changements sont écrits dans les journaux techniques (`[AUTHZ_POLICY_MUTATION]`), **pas au journal d'audit** : B l'ajoute.

### Ce que voit le super admin

**Où** : l'onglet « Gestion AuthZ » est renommé **Droits des rôles**. La liste brute des règles passe sous un lien **Vue technique**, replié.

- **Choix du rôle** en haut, avec le nom en clair (`ROLE_HUMAN_LABEL`) : Administrateur d'institution, Administrateur d'unité, Manager, Collaborateur, Lecteur, Auditeur.
- **Une ligne par ressource**, avec un libellé en français ; **une colonne par action**. Seules les cases qui ont un sens pour la ressource sont proposées : les autres sont vides, sans case.
- **Ligne d'avertissement**, fixe, en tête : « Ces droits s'appliquent à toutes les institutions. »
- **Tous les droits** (`manage`) : une case à part, en début de ligne. Cochée, elle coche et grise les autres cases de la ligne. La décocher retire la règle `manage` et laisse les cases de la ligne décochées et modifiables.
- **Rôle Administrateur de la plateforme** : affiché en lecture seule, avec la mention « Ce rôle garde tous ses droits. » Cela évite de se retirer l'accès à cet écran.
- Chaque case cochée ou décochée s'enregistre tout de suite, avec le message « Droit mis à jour. » En cas d'erreur, la case revient à son état d'avant.
- Si le serveur répond 409 (`AUTHZ_BACKEND` en `csv`), la grille s'affiche en lecture seule, avec la ligne : « Les droits ne sont pas modifiables sur ce serveur. Contactez l'équipe technique. »

**Libellés des ressources** :

| Ressource | Libellé |
|---|---|
| `documents` | Documents |
| `spaces` | Espaces |
| `categories` | Catégories |
| `workflows` | Circuits de validation |
| `gedrules.rules` | Règles de routage |
| `gedrules.templates` | Modèles de circuit |
| `classification_rules` | Règles de classement |
| `classification_reviews` | Documents à reclasser |
| `org_units` | Services |
| `users` | Utilisateurs |
| `tenants` | Institutions |
| `audit_logs` | Journal d'audit |
| `analytics.tenant` | Tableau de bord de l'institution |
| `analytics.platform` | Tableau de bord de la plateforme |

**Libellés des actions** :

| Action | Libellé |
|---|---|
| `read` | Voir tout |
| `read_own` | Voir les siens |
| `create` | Créer |
| `update` | Modifier tout |
| `update_own` | Modifier les siens |
| `delete` | Supprimer |
| `delete_own` | Supprimer les siens |
| `trash_own` | Mettre les siens à la corbeille |
| `archive` | Archiver |
| `assign` | Attribuer une tâche |
| `review` | Revoir |
| `resolve_review` | Valider ou rejeter une étape |
| `simulate` | Simuler |
| `manage` | Tous les droits |
| autre valeur (ajoutée plus tard, par exemple `purge` de #152) | libellé brut entre parenthèses, en attendant un libellé |

- Pour #152, `purge` se lit « Supprimer définitivement » dès que l'action entre dans le vocabulaire.

### Messages

| Cas (code) | Message affiché |
|---|---|
| 200 ou 201 | « Droit mis à jour. » |
| 403 | « Vous n'avez pas le droit de modifier les droits. » |
| 409 (`AUTHZ_BACKEND` en `csv`) | Grille en lecture seule, avec la ligne ci-dessus. |
| 422 (ressource ou action inconnue) | « Ce droit n'existe pas. Rechargez la page. » |
| 503 | « Les droits sont indisponibles pour le moment. » |
| Erreur réseau ou 500 | « Le droit n'a pas été mis à jour. Réessayez. » La case revient à son état d'avant. |

### Critères d'acceptation

1. Décocher « Voir tout » sur les documents pour le Lecteur : un lecteur connecté reçoit 403 sur la liste des documents, sans redémarrage. Le recocher rétablit l'accès.
2. **Un test par rôle** (6 rôles) : une case cochée à l'écran donne le même résultat, à l'appel de l'API, que la règle équivalente dans `policy.csv`.
3. Chaque changement figure au journal d'audit, avec le rôle, la ressource, l'action, « ajouté » ou « retiré », et l'auteur.
4. Décocher **Tous les droits** sur une ligne retire la règle `manage` seule ; les autres règles de la ligne ne changent pas.
5. Le rôle Administrateur de la plateforme est en lecture seule à l'écran.
6. Avec `AUTHZ_BACKEND=csv`, la grille s'affiche en lecture seule, sans erreur technique.
7. Aucun code brut (`read_own`, `gedrules.rules`) n'est visible hors de la **Vue technique**.
8. Un administrateur d'institution n'a ni l'onglet ni l'accès par l'API (403).

## Guide et notes de version

- « Ce qui se règle où » (notes rc.1, puis guide V1.1) : ajouter les lignes **Réglages** et **Droits des rôles**, avec la liste de ce qui reste sur le serveur. L'innovateur s'en charge à la fusion.

## Hors périmètre de #280

- Droits différents d'une institution à l'autre : il faudrait un domaine par institution dans les règles. À instruire en V1.2 si le PO le demande.
- Créer un rôle, ou une action hors du vocabulaire figé.
- Limites de débit, sauvegardes, secrets.
