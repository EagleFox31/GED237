# Notes de version V1.1 : squelette (tag du 07/12)

- **Statut** : SQUELETTE, préparé par l'innovateur le 18/11, à la demande d'O. À finaliser le 06/12 sur l'état réel de `main`.
- **Source** : `file-v1.1.md` (ORDER par vague, 18/11) et titres des PR ouvertes.
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
- **Tous** : messages plus clairs quand une action est refusée ou qu'une limite est atteinte. Le texte exact est à reprendre de #403 avec F. (#403)
- *Sans effet visible* : contrôle de cohérence des réglages (#389).

## Vague 1 : comptes et réglages (24 et 25/11)

- **Administrateur**
  - Vous débloquez vous-même un compte bloqué, depuis la fiche de l'agent. (#394, #405)
  - Chaque changement sur un compte d'agent est inscrit au journal. (#227)
  - Un rôle vide ou inconnu donne un message clair, et non plus une erreur du serveur. (#237)
  - Corrections sur les comptes et les quotas d'usage. (#222) ‹ à formuler avec B ›
  - Les fonctions désactivées pour votre institution n'apparaissent plus à l'écran. (#224, #234)
  - Une mise à jour ajoute les nouveaux droits sans effacer vos réglages. (#235, #238)
- **Agent** : les lecteurs d'écran lisent toutes les colonnes de la vue détaillée des espaces. (#240)
- **Tous** : un compte désactivé ou une session fermée ne peut plus être prolongé en arrière-plan. (#414, issue en attente de PR)
- **Exploitant** :
  - le serveur refuse de démarrer en production avec la clé secrète par défaut (#413, issue en attente de PR) ;
  - pile réduite pour le VPS, avec en-têtes de sécurité (#248, #267, #268) ;
  - réglage des adresses acceptées par le serveur de l'interface (#245).
- **Si le PO la retient** : pagination du journal d'audit (idée du PO, en attente).
- *Sans effet visible* : #243, #253, #268 (contrôles).

## Vague 2 : lecture des documents, OCR (25 et 26/11)

- **Agent**
  - Vous voyez si un document a été lu, s'il est en cours de lecture, si la lecture a échoué ou si elle est peu sûre, dans la liste et dans la fiche. (#372, #284)
  - Le texte reconnu s'affiche dans la fiche. (#290)
  - Le document s'affiche directement dans la fiche, sans le télécharger. (#338)
  - Les PDF mixtes (pages tapées et pages scannées) sont mieux lus, et les gros PDF ne bloquent plus la lecture. (#384, #386, #387)
  - Vous filtrez la liste par catégorie. (#388)
- *Sans effet visible* : jeu de test (#311).
- **Reporté en V1.2** : bouton « relancer la lecture » quand elle a échoué (#355, liée à #404).

## Vague 3 : chaque service voit ses documents (26/11)

- **Administrateur de service** : vous ne voyez et ne modifiez que les documents, les circuits et les revues de votre service et des services qui en dépendent. (#241, #213, #261, #266, #361)
- **Agent** : un lien vers un document hors de votre périmètre affiche un message clair, et non une page d'erreur. (#263, #296)
- **Chef de service** : un tableau de bord pour votre service et ses sous-services. (#221)
- **Administrateur** : les volumes de stockage s'affichent correctement dans les statistiques. (#282)
- *Sans effet visible* : test (#308).

## Vague 4 : nouvelles fonctions (30/11 au 02/12), sous réserve de la décision du PO

Chaque ligne dépend de l'avis du PO (`plan-fusion-v1.1.md` § 6). Une fonction refusée part en « Reporté ».

- **Agent**
  - **Corbeille** : « Supprimer » met le document à la corbeille, d'où vous pouvez le restaurer. La touche Suppr met à la corbeille. Vous pouvez annuler la dernière suppression ou le dernier déplacement. (#152, #181, #184, #301)
  - F2 renomme le document sélectionné. (#302)
  - Favoris, documents récents et documents partagés avec vous. (#165, #205)
  - Un import de dossier interrompu reprend là où il s'est arrêté. (#186)
  - Vous annulez un reclassement. Le journal l'affiche en français. (#179, #262, #309)
  - Une seule file pour tout ce que vous avez à valider. (#153, #190)
  - Notifications en temps réel. Ligne retenue seulement si le PO garde #155. (#155)
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
  - Moins de gestes pour les tâches de tous les jours (audit UX, Lot 4). (#362) ‹ détailler avec F ›
  - Archivage depuis l'aperçu de l'explorateur. (#407) ‹ préciser quels profils peuvent archiver ›
  - Accessibilité des lignes de l'explorateur. (#400)
- **Chef de service**
  - Page « Mon équipe » : votre chaîne hiérarchique et vos agents directs. (#285, #297)
  - Les cartes du tableau de bord ouvrent la liste correspondante. Le journal mène à la fiche du document. (#347)
  - Le tableau de bord compte les étapes en attente et les étapes terminées. (#399)
  - Motifs de rejet en un clic. (#395)
- **Administrateur**
  - Grille des droits par rôle et par action, en lecture seule, avec les changements inscrits au journal. (#294, #303)
  - Règles de classement :
    - vous testez une règle avant de l'activer (#377, #398) ;
    - l'onglet ouvert reste le même au rechargement (#367) ;
    - les erreurs du simulateur s'affichent (#366).
  - Liste des agents : Échap ferme, et une confirmation est demandée. (#342)
- **Tous** : les profils de démonstration n'apparaissent plus sur la page de connexion en production. (#378)
- *À qualifier* : #344 (brouillon sans description), #353 (test).

## Vague 6 : outillage (03 et 04/12)

- *Sans effet visible* : #335, #312, #189, #166 (scripts et documentation).

## Reporté en V1.2 (liste à figer le 06/12)

- Relance de la lecture à l'écran (#355) et sa base (#404, liée à #370).
- Écran Corbeille de l'administrateur de la plateforme, avec choix de l'institution (DEC-2026-006).
- Audit UX Lot 7 :
  - historique d'un document ;
  - export du journal sur une période et en PDF ;
  - recherche par date et par auteur ;
  - indicateur de retard ;
  - délégation pendant une absence.
- Audit UX Lot 6 : barre d'actions fixe dans la fenêtre de dépôt, saisie gardée à la reconnexion, aide du premier jour.
- Corbeille groupée avec annulation, et Ctrl+Espace (suite de #211 ; numéro de l'issue V1.2 à noter).
- Selon la réponse du PO : #359, #155 et #169.

## À vérifier avant le 06/12 : engagements V1.1 du PO sans PR dans la file au 18/11

- Fiche PO du 19/11 :
  - question 2 (#203) ;
  - question 3 : trois accès fermés, dans une PR distincte ;
  - question 10 : archivage par l'administrateur d'institution (#228) ;
  - question 12 B : réglages à l'écran (durée des sessions, taille des envois, fonctions, serveur e-mail) ;
  - question 13 A et A : lecture par une personne désignée hors de son service (#254).
- Pour chacun : une PR fusionnée donne une ligne dans la bonne vague ; sinon, l'engagement passe en « Reporté », avec l'accord du PO.

## Limites connues (à reprendre des notes rc.1, puis à mettre à jour)

- ‹ Reprendre la section « Limites connues » des notes rc.1 (#104). Retirer ce que la V1.1 corrige, et garder le reste. ›
- ‹ Exigence 28 : « vérifiée sur machine simulée » (essai du 25/11), à confirmer sur un vrai poste. ›

## Mise à jour depuis la rc.1 (annexe exploitant)

- ‹ Migrations à appliquer (`alembic upgrade head`), dans l'ordre de la chaîne de `file-v1.1.md` § 2 ›
- ‹ Nouvelles variables d'environnement, à relever dans `.env.example` sur le tag ›
- ‹ Sauvegarde à faire avant la mise à jour ›
- ‹ Retour arrière ›
