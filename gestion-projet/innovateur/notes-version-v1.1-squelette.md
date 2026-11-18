# Notes de version V1.1 : squelette (tag du 07/12)

- **Statut** : SQUELETTE, préparé par l'innovateur le 18/11, à la demande d'O. À finaliser le 06/12 sur l'état réel de `main`.
- **Source** : `file-v1.1.md` (ORDER par vague, 18/11) et titres des PR ouvertes.
- **Remplace** `squelette-notes-version-v1.1.0.md` (17/11, classé par thème). Ce fichier-ci, classé par vague, fait foi. De l'ancien, on garde :
  - la liste des réglages coupés par défaut (section « Pour O ») : chacun est tranché au moment de la fusion de sa PR ;
  - les issues V1.1 encore sans PR au 18/11 : #204 (alerte si l'application d'authentification n'est pas réenrôlée sous 24 h), #214 (un seul point d'accès pour les fonctions activées), #215 (responsable d'unité borné pour les revues et les validations) et #216 (constats B6). Réponse de B (18/11) : #214 se ferme par #224, #215 par #241, #216 par #222 ; #204 reste sans PR et entre en V1.1 après #193 et #219 (tableau des engagements, plus bas).
- **Règle de finalisation** :
  - une ligne ne reste que si toutes ses PR sont fusionnées ;
  - une ligne dont une PR manque part en « Reporté » ;
  - les numéros de PR sont retirés de la version publiée : ils ne servent qu'au contrôle.
- **Lecteurs** : l'agent, le chef de service et l'administrateur de l'institution. Les lignes « Exploitant » vont dans une annexe technique séparée.
- **Ton** : phrases courtes, sans jargon, au présent : « Vous pouvez… ».

## En bref (à écrire le 06/12, 5 lignes au plus)

- ‹ Les trois changements que l'agent remarque dès la première heure. ›
- ‹ Le changement principal pour le chef de service. ›
- ‹ Le changement principal pour l'administrateur. ›

## Vague 0 : socle (24/11)

- **Administrateur** : vous réglez le nombre de lignes de l'export du journal. (#383)
- **Tous** (#403, formulation de B) :
  - la tuile « Utilisateurs » du tableau de bord n'est cliquable que si vous pouvez ouvrir la gestion des utilisateurs ;
  - un export du journal trop gros vous dit « ajoutez un filtre », au lieu d'échouer sans message ;
  - la bannette « À revoir » affiche un message clair quand un service ne se charge pas.
- **Exploitant** : aucun plafond d'envoi ne change ; un contrôle vérifie que la limite du serveur web reste au-dessus de celle de l'application. (#403)
- *Sans effet visible* : contrôle de cohérence des réglages (#389).

## Vague 1 : comptes et réglages (24 et 25/11)

- **Administrateur**
  - Vous débloquez vous-même un compte bloqué, depuis la fiche de l'agent. (#394, #405)
  - Chaque changement sur un compte d'agent est inscrit au journal. (#227)
  - Un rôle vide ou inconnu donne un message clair, et non plus une erreur du serveur. (#237)
  - Seuls les profils qui gèrent les agents voient la liste des rôles qu'on peut attribuer. (#222)
  - L'e-mail, le rôle, le service, le supérieur, l'état actif, le mot de passe et la photo d'un agent restent réservés à l'administrateur. Une demande qui en touche un est refusée en entier, avec la liste des champs refusés. (#222)
  - Les fonctions désactivées pour votre institution n'apparaissent plus à l'écran. (#224, #234)
  - Une mise à jour ajoute les nouveaux droits sans effacer vos réglages. (#235, #238)
- **Agent**
  - Vous modifiez vous-même votre prénom, votre nom et votre téléphone. (#222)
  - Les lecteurs d'écran lisent toutes les colonnes de la vue détaillée des espaces. (#240)
- **Exploitant** : la liste des champs que l'agent peut modifier se règle par `USER_SELF_EDITABLE_FIELDS`. (#222)
- **Tous** : un compte désactivé ou une session fermée ne peut plus être prolongé en arrière-plan. (#414, issue en attente de PR)
- **Exploitant** :
  - le serveur refuse de démarrer en production avec la clé secrète par défaut (#413, issue en attente de PR) ;
  - pile réduite pour le VPS, avec en-têtes de sécurité (#248, #267, #268) ;
  - réglage des adresses acceptées par le serveur de l'interface (#245).
- **Administrateur** : le journal d'audit se parcourt page par page, au-delà des 200 dernières lignes. (PR à ouvrir, GO du PO le 18/11 ; fin de vague 1 si elle est prête, sinon vague 5)
- *Sans effet visible* : #243, #253, #268 (contrôles).

## Vague 2 : lecture des documents, OCR (25 et 26/11)

- **Agent**
  - Vous voyez si un document a été lu, s'il est en cours de lecture, si la lecture a échoué ou si elle est peu sûre, dans la liste et dans la fiche. (#372, #284)
  - Le texte reconnu s'affiche dans la fiche. (#290)
  - Le document s'affiche directement dans la fiche, sans le télécharger. (#338)
  - Les PDF mixtes (pages tapées et pages scannées) sont mieux lus, et les gros PDF ne bloquent plus la lecture. (#384, #386, #387)
  - Vous filtrez la liste par catégorie. (#388)
  - Quand la lecture a échoué, la liste et la fiche l'affichent, et un bouton la relance. (#404, #355)
- **Exploitant** : une lecture interrompue (redémarrage, coupure) est reprise, avec un nombre d'essais borné. (#370)
- *Sans effet visible* : jeu de test (#311).

## Vague 3 : chaque service voit ses documents (26/11)

- **Administrateur de service** : vous ne voyez et ne modifiez que les documents, les circuits et les revues de votre service et des services qui en dépendent. (#241, #213, #261, #266, #361)
- **Agent** : un lien vers un document hors de votre périmètre affiche un message clair, et non une page d'erreur. (#263, #296)
- **Chef de service** : un tableau de bord pour votre service et ses sous-services. (#221)
- **Administrateur** : les volumes de stockage s'affichent correctement dans les statistiques. (#282)
- *Sans effet visible* : test (#308).

## Vague 4 : nouvelles fonctions (30/11 au 02/12)

Le PO garde tout en V1.1 (18/11 : « on repousse rien »). Une ligne n'en sort que si sa PR n'est pas fusionnée le 06/12.

- **Agent**
  - **Corbeille** : « Supprimer » met le document à la corbeille, d'où vous pouvez le restaurer. La touche Suppr met à la corbeille. Vous pouvez annuler la dernière suppression ou le dernier déplacement. (#152, #181, #184, #301)
  - F2 renomme le document sélectionné. (#302)
  - Favoris, documents récents et documents partagés avec vous. (#165, #205)
  - Un import de dossier interrompu reprend là où il s'est arrêté. (#186)
  - Vous annulez un reclassement. Le journal l'affiche en français. (#179, #262, #309)
  - Une seule file pour tout ce que vous avez à valider. (#153, #190)
  - Notifications en temps réel. (#155)
  - Code de connexion reçu par e-mail, avec un bouton « renvoyer le code ». (#154)
- **Chef de service**
  - Rapport officiel en PDF, programmable, avec copie conforme et réimpression. (#197, #180, #209)
  - Indicateurs de qualité des documents : sans catégorie, sans texte lu, etc. (#162)
- **Administrateur**
  - L'application d'authentification sur téléphone devient obligatoire pour les administrateurs. (#193, #219)
  - Écran des doublons : vous gardez un exemplaire et mettez les autres à la corbeille. (#171, #199)
  - La purge définitive de la corbeille est réservée à l'administrateur de la plateforme (DEC-2026-006). Vous mettez à la corbeille et vous restaurez, mais vous ne purgez pas. (#152)
- **Exploitant** :
  - sauvegarde automatique chaque nuit, avec rétention et alerte (#192) ;
  - sonde de disponibilité (#147) ;
  - démarrage refusé en production sans canal d'envoi du code (#212).
- *Sans effet visible* : tests (#168, #169, #170, #172, #182, #310).

## Vague 5 : fiche document, équipe, droits et confort (01 au 03/12)

- **Agent**
  - Vous réservez un document dans sa fiche, et les autres voient qu'il est réservé. (#283, #293)
  - Vous déposez une nouvelle version depuis l'historique du document. (#295)
  - Sélection multiple (Ctrl, Maj, Ctrl+A) et actions groupées dans les espaces. (#401)
  - Aperçu du document dans l'onglet d'information de la fiche. (#391)
  - Téléchargement rapide depuis les cartes, et bouton pour remettre les filtres à zéro. (#396)
  - Dépôt en série : « Envoyer et déposer un autre ». La dernière catégorie utilisée est gardée. (#392, #354)
  - Le filtre de catégorie est conservé quand vous revenez à la liste. (#351)
  - Une liste vide explique pourquoi elle est vide. (#371)
  - Les erreurs de dépôt sont lisibles, avec le détail technique en infobulle. Sans réseau, un seul message s'affiche. (#373, #417)
  - Le dernier valideur choisi est proposé par défaut. (#393)
  - « Valider » et « Rejeter » affichent un état d'attente pendant l'envoi. (#416)
  - Moins de gestes au quotidien (#362) :
    - le dernier valideur est déjà choisi quand vous soumettez ;
    - la bannette passe seule au dossier suivant et garde la dernière destination choisie ;
    - « Tout marquer comme lu » en un clic sur les accusés de lecture ;
    - vous visez ou rejetez directement depuis la fiche du document.
  - Vous mettez plusieurs documents à la corbeille d'un coup, et vous pouvez annuler. Ctrl+Espace sélectionne dans l'explorateur. (suite de #211, PR à ouvrir)
  - Vous vous reconnectez plus vite. (#359)
  - Accessibilité des lignes de l'explorateur. (#400)
- **Chef de service**
  - Page « Mon équipe » : votre chaîne hiérarchique et vos agents directs. (#285, #297)
  - Les cartes du tableau de bord ouvrent la liste correspondante. Le journal mène à la fiche du document. (#347)
  - Le tableau de bord compte les étapes en attente et les étapes terminées. (#399)
  - Motifs de rejet en un clic. (#395)
- **Administrateur**
  - Vous archivez un document validé ou signé depuis l'aperçu de l'explorateur. Seuls l'administrateur de l'institution et l'administrateur de la plateforme voient « Archiver ». (#407)
  - Grille des droits par rôle et par action, avec les changements inscrits au journal. Elle est en lecture seule dans la configuration par défaut ; seul l'administrateur de la plateforme peut la modifier, et seulement si les droits sont gérés en base. (#294, #303)
  - Réglages à l'écran : durée des sessions, essais de connexion, taille maximale d'un envoi, fonctions activées. Le serveur e-mail reste réglé côté serveur. (lot 8a de #280, PR à ouvrir)
  - Vous cherchez un mot dans le journal d'audit et dans son export. (#344)
- **Auditeur** : même recherche libre dans le journal et dans son export. (#344)
  - Règles de classement :
    - vous testez une règle avant de l'activer (#377, #398) ;
    - l'onglet ouvert reste le même au rechargement (#367) ;
    - les erreurs du simulateur s'affichent (#366).
  - Liste des agents : Échap ferme, et une confirmation est demandée. (#342)
- **Tous** : les profils de démonstration n'apparaissent plus sur la page de connexion en production. (#378)
- *Sans effet visible* : #353 (test).

## Vague 6 : outillage (03 et 04/12)

- *Sans effet visible* : #335, #312, #189, #166 (scripts et documentation).

## Reporté en V1.2 (liste à figer le 06/12)

- Lecteur désigné hors du circuit (#254, partie 13 a : réponse du PO du 17/11, « 2 V1.2 »).
- Alertes de qualité (#183, #194 : réponse du PO du 17/11).
- Écran Corbeille de l'administrateur de la plateforme, avec choix de l'institution (DEC-2026-006).
- Audit UX Lot 7 :
  - historique d'un document ;
  - export du journal sur une période et en PDF ;
  - recherche par date et par auteur ;
  - indicateur de retard ;
  - délégation pendant une absence.

## Revenus en V1.1 le 18/11 (O : « on repousse rien »), lignes à placer dans leur vague à la fusion

- *Accessibilité (audit UX Lot 8)* : les documents s'ouvrent au clavier et `Échap` ferme les fenêtres ; la zone de dépôt se pilote au clavier ; les boutons icônes ont un nom lu par le lecteur d'écran ; textes et badges plus contrastés ; boutons « Annuler / Envoyer » toujours visibles dans la fenêtre de dépôt, même sur un petit écran zoomé (avec le point 5 du Lot 6).
- *Journal (audit UX Lot 9)* : export CSV possible avec plusieurs auteurs filtrés.
- *Audit UX Lot 6* : aide du premier jour et « Renvoyer le code » ; saisie gardée à la reconnexion.
- Tableau de bord du manager par service (#298, #278) ; glisser-déposer pour reclasser (#299) ; serveur d'e-mail réglable à l'écran (lot 8a).
- *Sans effet visible* : versions majeures de Starlette, Python, TypeScript et ESLint ; suppression d'une table inutilisée (#265) ; dépréciation de `GET /documents/tree` (#281, #279) ; accès public en HTTPS sur le serveur (phase 2 de #288, sur accord du PO). La robustesse de l'OCR (OCR-1) est #370, déjà listée.

## Engagements V1.1 du PO sans PR dans la file au 18/11 (état vérifié avec gh le 18/11)

Le PO ne repousse rien : chaque ligne a un porteur et un jour. Coûts en h-s, `Déduit`.

| Question | État vérifié | Ce qui manque | Porteur | Coût B / F / Q | Plan |
|---|---|---|---|---|---|
| Q2 : le responsable d'unité ne voit que son service | #203 et #196 fusionnées le 18/11 à 13:28 (17498b5), donc dans `main`. | Rien pour la V1.1. **Effet de bord** : elles seront dans la rc.1 si le tag est pris sur `main`, alors que le PO avait dit « après le 30 ». Les « Limites connues » des notes rc.1 (#104) sont à revoir. | O (rc.1), I (notes) | 0 / 0 / 0 | Vérifier les notes rc.1 avant le push de #104, le 19/11. |
| Q3 : trois accès fermés | #358 (4fcd8d9, fusionnée le 18/11) ferme l'import au nom d'un autre agent et la vue de l'institution ; #360 (8ceae3b) couvre les comptes et les services. | Le lien direct : #213 et #263 (vague 3, ouvertes), et l'e2e #308. | B, Q | déjà compté (lot 11) | Fusion le 26/11, vague 3. |
| Q10 : archivage par l'administrateur d'institution (réponse A : rc.1) | #231 fusionnée le 17/11 (99d06e9). #239 fermée sans fusion, remplacée par #246, fusionnée (2a1052b). #228 fermée « completed » à la fusion de #231, le 17/11 à 17:17 : pas une erreur. | Rien. L'archivage depuis l'aperçu de l'explorateur (#407) est un confort en plus, vague 5. | — | 0 / 0 / 0 | Ligne des notes rc.1. |
| Q12 : réglages et écran des droits (réponse C) | Issue #280 ouverte. 8b = #294 et #303 (vague 5). La grille n'est modifiable que par le super_admin avec `AUTHZ_BACKEND` à `sql` ou `shadow` ; le défaut est `csv`, donc lecture seule. | 8a (réglages à l'écran) : aucune PR. Le serveur e-mail à l’écran, sorti par O le 17/11, est revenu dans 8a le 18/11 (B + 0,5). | B (API), F (écran), Q | déjà compté (lot 8 : 8a 3,5) | B du 25 au 30/11, F les 01 et 02/12, relecture de Q le 02/12, fusion le 03/12. |
| Q13 : accès par l'étape de circuit (partie 13 b ; 13 a en V1.2 par le PO) | Issue #254 ouverte, sans PR. L'étiquette `v1.2` vise la partie 13 a seulement. | Un EXISTS sur `WorkflowStep.assigned_to` dans `_in_perimeter`, `_can_read_document` et `visible_document_scope` : lecture seule, borné au tenant, accès gardé après l'étape. Après #247 et #263. | B, Q | déjà compté (B 1,5, lot 11) | B les 26 et 27/11, relecture de Q le 30/11, fusion le 01/12. |
| Issues V1.1 sans PR de l'ancien squelette | #204, #214, #215 et #216 : OPEN le 18/11. **Réponse de B (18/11)** : #214 se ferme à la fusion de #224, #215 à celle de #241, #216 à celle de #222. | #204 (suite TOTP de #193) n'a pas de PR. #193 est en V1.1 (vague 4), donc #204 aussi, après #193 et #219. | B, Q | #204 à chiffrer par B | PR de B après #219 ; relecture de Q (auth). |

## Limites connues (à reprendre des notes rc.1, puis à mettre à jour)

- ‹ Reprendre la section « Limites connues » des notes rc.1 (#104). Retirer ce que la V1.1 corrige, et garder le reste. ›
- ‹ Exigence 28 : « vérifiée sur machine simulée » (essai du 25/11), à confirmer sur un vrai poste. ›

## Mise à jour depuis la rc.1 (annexe exploitant)

- ‹ Migrations à appliquer (`alembic upgrade head`), dans l'ordre de la chaîne de `file-v1.1.md` § 2 ›
- ‹ Nouvelles variables d'environnement, à relever dans `.env.example` sur le tag ›
- ‹ Sauvegarde à faire avant la mise à jour ›
- ‹ Retour arrière ›
