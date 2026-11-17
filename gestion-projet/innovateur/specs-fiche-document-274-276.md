# Fiche document : verrou (#274), nouvelle version (#275), texte reconnu (#276), document introuvable (#263)

- **Pour** F, qui code les écrans, et Q, qui recette. Innovateur, 17/11/2026. Lot 9 de `plan-v1.1.md`.
- **Base** : `main` f8f1d75. Routes dans `backend/app/api/v1/endpoints/documents.py`. Fiche actuelle dans `frontend/components/DocumentDetailModal.tsx`, avec trois onglets : « Détails & Aperçu », « Circuit de Validation » et « Historique des Versions ».
- **Ordre prévu par F** : #276, puis #275, puis #274.

## Règles communes

1. **Ne jamais afficher le texte brut renvoyé par le serveur.** Il est en anglais, ou en français sans accents (« verrouille », « deverrouiller »). L'écran choisit son message d'après le code HTTP et le champ `error`, avec les textes ci-dessous.
2. **Boutons et messages** : courts, en français avec accents, sans jargon. Pas de « verrou » ni d'« OCR » dans les textes : on écrit « réservé » et « texte reconnu ».
3. **Erreurs** : les erreurs HTTP passent par le bus global (`pushApiError`). Les messages ci-dessous remplacent le message générique pour ces codes. Une erreur inattendue garde le message générique.
4. **Heures** : heure locale, au format « 14 h 05 ». Pas de secondes, pas de fuseau.

## #274 — Réserver un document pour le modifier

**But** : deux agents ne modifient pas le même document en même temps. Le serveur réserve le document 30 minutes (`LOCK_DURATION_MINUTES`) à celui qui le demande.

### Ce que voit l'agent

| Situation | Ce qui s'affiche dans la fiche |
|---|---|
| Personne ne l'a réservé | Bouton **Réserver pour modifier**. |
| Il l'a réservé lui-même | Bandeau discret : « Réservé par vous jusqu'à 14 h 35 ». Bouton **Libérer**. Les actions de modification sont actives. |
| Un autre agent l'a réservé | Bandeau : « En cours de modification par Awa Ndi jusqu'à 14 h 35 ». Les boutons qui modifient (nouvelle version, renommer, supprimer, archiver) sont grisés, avec l'infobulle « Réservé par une autre personne ». La lecture et le téléchargement restent possibles. |
| Administrateur, document réservé par un autre | Même bandeau, plus un bouton **Libérer** (le serveur autorise l'administrateur). |

- **Renouvellement** : tant que la fiche est ouverte et que l'agent détient la réservation, l'écran la renouvelle (`POST /{id}/refresh-lock`) avant son expiration, par exemple toutes les 20 minutes. Il ne la renouvelle pas si l'onglet du navigateur est fermé.
- **Fermeture** : à la fermeture de la fiche, l'écran libère la réservation (`POST /{id}/unlock`). Si la libération échoue, rien ne s'affiche : la réservation expire seule.
- **Nom de la personne** : `DocumentRead` n'expose pas encore `locked_by_user_id`, `locked_at` ni `lock_expires_at`, ni le nom. **B les ajoute** (décision de O, 17/11), avant l'écran de F. Sans le nom, le bandeau dit « En cours de modification par une autre personne jusqu'à 14 h 35 ».

### Messages

| Cas (route, code) | Message affiché |
|---|---|
| `lock`, 423 : réservé par un autre | « Ce document est déjà en cours de modification par Awa Ndi, jusqu'à 14 h 35. » La fiche bascule dans l'état « réservé par un autre ». |
| Toute modification, 423 `document_locked` | Même message. |
| `lock`, 400 : document en corbeille | « Ce document est dans la corbeille. Restaurez-le avant de le modifier. » |
| `lock`, 403 | « Vous n'avez pas le droit de modifier ce document. » |
| `unlock`, 403 | « Seule la personne qui l'a réservé, ou un administrateur, peut le libérer. » |
| `refresh-lock`, 409 : réservation expirée | « Votre réservation a expiré. Réservez de nouveau le document pour continuer. » Le bouton **Réserver pour modifier** réapparaît. |
| `refresh-lock`, 403 : réservation perdue | « Ce document a été libéré ou réservé par une autre personne. » La fiche se recharge. |

### Critères d'acceptation

1. A réserve le document. B ouvre la même fiche : il voit le bandeau avec le nom de A et l'heure de fin, et les boutons de modification sont grisés.
2. B tente une modification (par appel direct, par exemple) : il reçoit le message du 423, jamais le texte brut du serveur.
3. A ferme la fiche : B, en rouvrant la fiche, voit le bouton **Réserver pour modifier**.
4. A garde la fiche ouverte 45 minutes sans rien faire : sa réservation est toujours active (renouvellement).
5. Un administrateur libère la réservation de A. A reçoit le message « réservation perdue » au renouvellement suivant.
6. Document en corbeille : le bouton **Réserver pour modifier** n'apparaît pas.
7. Test e2e à deux utilisateurs (A et B), dans la suite de Q.

## #275 — Déposer une nouvelle version

**But** : remplacer le fichier d'un document en gardant l'historique.

### Ce que voit l'agent

- Dans l'onglet « Historique des Versions », un bouton **Nouvelle version**. Il ouvre un choix de fichier et un champ facultatif **Ce qui change** (une ligne).
- Le bouton est grisé, avec l'infobulle « Réservé par une autre personne », quand un autre agent a réservé le document (#274).
- Pendant l'envoi : barre de progression et bouton **Annuler**.
- Après l'envoi : message « Version 3 enregistrée. » La nouvelle version apparaît en tête de liste, marquée **Actuelle**. Le numéro affiché dans « Détails & Aperçu » passe à V3.
- Avant l'envoi, l'écran refuse un fichier de plus de 100 Mo (`MAX_UPLOAD_SIZE_MB`, à lire dans la configuration servie, pas en dur). Il ne l'envoie pas.

### Messages

| Cas (code, `error`) | Message affiché |
|---|---|
| 201 | « Version N enregistrée. » |
| 409 `identical_to_current` | « Ce fichier est identique à la version actuelle. Rien n'a été ajouté. » |
| 409 `identical_to_previous_version` | « Ce fichier est identique à une version précédente (V2). Rien n'a été ajouté. » Le numéro est indiqué si le serveur le renvoie. |
| 409 `duplicate_file` | « Ce fichier existe déjà dans un autre document. Rien n'a été ajouté. » |
| 400 : document en corbeille | « Ce document est dans la corbeille. Restaurez-le avant d'ajouter une version. » |
| 400 : agent sans unité | « Votre compte n'est rattaché à aucun service. Contactez votre administrateur. » |
| 413, ou refus avant l'envoi | « Fichier trop lourd : 100 Mo au plus. » |
| 423 | Message du 423 de #274. |
| 403 | « Vous n'avez pas le droit de modifier ce document. » |

### Critères d'acceptation

1. Un fichier différent crée la version N + 1, qui s'affiche **Actuelle** sans recharger la page.
2. Le même fichier que la version actuelle donne le message `identical_to_current`, et le nombre de versions ne change pas.
3. Un fichier de plus de 100 Mo est refusé avant l'envoi, sans appel au serveur.
4. Document réservé par un autre : bouton grisé. Un appel direct renvoie 423 et affiche le bon message.
5. La création de la version figure au journal d'audit (vérifié par Q).

## #276 — Voir le texte reconnu

**But** : l'agent voit le texte lu dans un scan, le copie, et comprend pourquoi la recherche trouve (ou non) ce document.

### Ce que voit l'agent

Un bloc **Texte reconnu** dans l'onglet « Détails & Aperçu », sous l'aperçu, replié par défaut. Il s'appuie sur `GET /{id}/ocr`.

| `ocr_status` | Affichage |
|---|---|
| `completed` | Le texte, dans une zone défilante, avec un bouton **Copier** (message « Texte copié. »). Ligne « Lecture incertaine » si `low_confidence` vaut `true` (voir plus bas). |
| `processing` | « Lecture du texte en cours. Revenez dans quelques minutes. » |
| `not_processed` | « Pas de texte reconnu pour ce type de fichier. » |
| `completed` avec un texte vide | « Aucun texte lisible n'a été trouvé dans ce fichier. » |
| `failed` (ajouté par B en V1.1, avec `ocr_error`) | Message selon la raison, voir le tableau suivant. Le document reste consultable dans tous les cas. |

| `ocr_error` (codes confirmés par B le 17/11) | Message affiché |
|---|---|
| fichier introuvable (`file_not_found`) | « Le texte n'a pas pu être lu : le fichier est introuvable. Prévenez votre administrateur. » |
| format non pris en charge (`unsupported_format`) | « Ce type de fichier ne permet pas de lire le texte. » |
| aucun texte lu (`no_text`) | « Aucun texte lisible n'a été trouvé dans ce fichier. » |
| erreur du moteur (`engine_error`) | « La lecture du texte a échoué. Réessayez plus tard ou prévenez votre administrateur. » |
| raison absente ou inconnue | « Le texte n'a pas pu être lu. » |

**Lecture incertaine** : B ajoute le booléen `low_confidence` à `GET /{id}/ocr` (seuil de 0,7, fixé côté serveur). L'écran ne code aucun seuil : il affiche la ligne « Lecture incertaine : vérifiez sur l'original. » quand `low_confidence` vaut `true`.

**État d'échec** : B ajoute `failed` et `ocr_error` en V1.1 (≈ 1 h-s, sans migration ; décision de O du 17/11). **Repli à 24 h, seulement pour les anciens documents** restés en `processing` avant ce changement : au-delà de 24 h après le dépôt, l'écran les traite comme `failed` sans raison.

### Critères d'acceptation

1. Un PDF scanné du jeu de démo affiche son texte, et **Copier** met ce texte dans le presse-papiers.
2. Un fichier Word affiche « Pas de texte reconnu pour ce type de fichier. »
3. Le bloc est replié par défaut et ne ralentit pas l'ouverture de la fiche : le texte n'est chargé qu'au dépliage.
4. Un agent sans droit de lecture n'obtient jamais le texte (403 ou 404, traité comme « document introuvable »).

## #263 — Document introuvable depuis un lien (`?open=`)

**Situation** : un lien `/documents?open=<id>` (résultat du bandeau de recherche, lien copié, favori) vise un document supprimé définitivement ou hors du périmètre de l'agent. Avec #263, le serveur répond 404 dans les deux cas, exprès, pour ne pas révéler qu'un document existe. Sur `main`, un document hors périmètre répond encore 403.

**Aujourd'hui** (`Documents.tsx` l. 83 à 107) : le message générique du bus d'erreurs s'affiche, puis `open` est retiré de l'URL.

### Ce que voit l'agent

- La liste des documents reste affichée.
- Un message (bandeau ou notification) : **« Document introuvable. Il a peut-être été supprimé, ou vous n'y avez pas accès. »** Pas de bouton, sauf **Fermer**.
- `open` est retiré de l'URL, comme aujourd'hui, pour ne pas réafficher le message au rechargement.

### Règles

- **Même message pour 404 et 403.** L'écran ne dit jamais « vous n'avez pas accès » seul, ni « ce document existe ».
- Identifiant mal formé dans l'URL (pas un UUID) : même message, sans appel au serveur.
- Document en corbeille, pour un agent qui ne voit pas la corbeille : même message.

### Critères d'acceptation

1. Un agent du MINFI ouvre le lien d'un document du MINESUP : le message ci-dessus s'affiche, sans détail de plus.
2. Un agent ouvre le lien d'un document d'un autre service de son institution, hors de son périmètre : même message (après #263).
3. `?open=abc` affiche le même message, sans appel réseau.
4. Après le message, un rechargement de la page n'affiche plus rien.

## Ce qui n'est pas dans ces tickets

- Comparer deux versions côte à côte, restaurer une ancienne version : V1.2.
- Corriger à la main le texte reconnu : hors périmètre.
- Prévenir un agent quand un document qu'il attend est libéré : hors périmètre.
