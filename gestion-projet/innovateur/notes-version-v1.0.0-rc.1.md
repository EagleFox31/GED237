# Notes de version — v1.0.0-rc.1

## [1.0.0-rc.1] - 2026-11-24

Première version candidate d'E-Dossier Cameroun (GED237) pour la démonstration du 30/11 : connexion à deux facteurs, import et classement automatique, espaces par service, recherche cloisonnée, revue manuelle, cycle de validation, journal d'audit, sauvegarde et restauration.

### Fonctionnalités

- Connexion en deux temps (mot de passe puis code à usage unique) avec limitation des tentatives par compte et par adresse (#44, #73).
- Import d'un répertoire entier avec détection des doublons et classement automatique par règles (type, origine, nom de fichier, format) ; chemins d'import limités aux racines autorisées par l'administrateur (#2, #53).
- Règles de classement : création, simulation avant activation, lecture de l'année dans les noms de fichiers (#2, #76 30e63ec).
- Espaces par service : arborescence service → domaine → activité → année, filtres et pagination côté serveur (#38 ; écran #78 75f3fb6).
- Recherche plein texte limitée au périmètre de lecture de l'utilisateur ; la corbeille est exclue des résultats (#42).
- Revue manuelle des documents que les règles ne savent pas classer (#2).
- Cycle de validation : soumission à un valideur, visa ou rejet motivé, suivi des tâches en attente (#51, #66).
- Journal d'audit en lecture seule pour le profil auditeur (#2).
- Rôles et accès : collaborateur limité à son service, lecteur, manager, auditeur, administrateur ; écrans d'administration réservés aux profils autorisés (#46, #47, #50).
- Plafond de taille à l'envoi appliqué sur tous les chemins de dépôt (#52).
- Sauvegarde et restauration de la base et du stockage par scripts d'exploitation, avec attente de la santé des services (#54, #62).
- Version de l'application affichée par l'API (`/health`) et lue du tag de release (#58).
- Jeu de démonstration reproductible (D1) et profil de remise à zéro associé (#70).
- Tableau de bord : tuile « Doublons refusés » (#77 ac77271, #81 3f10054).
- Règles de classement : export et import en un fichier, rejouable sans doublon (#79 96ea1fc, #84 a137d8d) ; critères sur le texte OCR et sur l'année du document (#92 aa1ff60, #95 fa26e17) ; année avec `_` dans les noms de fichiers (#76) ; espaces : filtres et pagination (#78).
- Journal d'audit : export CSV plafonné à 50 000 lignes (#80 dc4daae, #87 c6724ea) ; traçage des connexions, dépôts et imports (#98 351c82c).
- Verrou du compte pendant 15 minutes après trois codes OTP erronés, avec compte à rebours à l'écran (#83 64ade05, #88 6669f2c).
- Retour à la page quittée après une reconnexion (#97 42397a3) ; version de l'application dans la barre latérale (#94 7bea1c0) ; barre latérale repliée sous 768 px (#93 6516d29).
- Dossiers surveillés importés automatiquement par le worker (#101 3cc6e15) ; écran d'état de la surveillance (#100 187b7f7).
- Manuel d'installation (#105 b6e0004, corrigé par #107 7fa1ab8) ; sonde de disponibilité `scripts/probe_c6.sh` (#106 ca9953b) ; accès HTTPS local (#109 e1480c8).
- Explorateur des espaces : raccourcis clavier et clic droit étendu (#164, #173).
- Archivage : bouton « Archiver » sur un document validé ou signé, pour l'administrateur de l'institution, qui traite aussi la revue de classement (#231, #246).
- Menu « Rapports » du Manager limité à son service (#175).
- Fonctionnement sans Internet : polices, styles et avatars servis par l'application (#116, #122, #126) ; export et import des images de la pile pour une installation hors ligne (#144).
- Jeu de démonstration : un circuit de validation et deux bordereaux de la DAF (#127).

### Corrections

- Profil de démonstration : l'institution est retrouvée par le code du ministère (#41).
- Moteur OCR et démarrage Docker durcis ; garde « schéma à jour » au démarrage de l'API (#1, #5, #60).
- Codes de rôle en minuscules, jeu de référence convergent entre le seed et le service de démonstration (#50).
- Validation d'import : la file de traitement ne bloque plus la réponse quand le stockage des résultats est injoignable (#75).
- Interface : contraste, libellés de l'Atelier, message clair en cas de trop nombreuses tentatives de connexion, accessibilité des modales et du lecteur (#45, #73).
- Rapports : les signaux `imports_needing_review` et `local_organize_*` sont limités au périmètre de l'appelant (#188).
- Compteurs `/documents/stats` et `/workflows/stats` limités aux documents que l'appelant peut lister (#177, #176).
- Tableau de bord de l'institution : les documents en corbeille ne sont plus comptés (#260).
- Reprise de la page quittée après reconnexion, liée au compte et non au profil (#123, #140).
- Recherche : aucune touche perdue dans la barre d'en-tête (#174) ; ses résultats s'ouvrent, et « Mes documents » cherche sur le serveur (#258).
- Libellés en français accentué : interface, messages du serveur, jeu de démonstration, journal d'audit, motifs de revue (#233, #257, #260, #269, #287).
- Écrans des droits et de la revue de classement : plus de texte brut du serveur ni de code technique à l'écran (#286).
- Menus : l'entrée d'administration qui ouvrait une page introuvable est retirée ; le bouton des permissions répond ; l'auditeur a son entrée « Audit » (#198, #233).
- Exploitation : l'interface redémarre après un redémarrage du serveur (#200) ; `/health` et la documentation de l'API derrière un proxy (#120) ; installation du moteur OCR relancée en cas d'échec réseau (#129).

### Sécurité

- Un administrateur ne peut plus attribuer un rôle plus élevé que le sien (#223).

### Droits retirés

- Les rapports de l'Admin Service ne couvrent plus que son service et ses sous-services ; les Collaborateurs n'ont plus accès aux rapports (#188, #187).
- L’Admin Service ne voit plus que son service et ses sous-services, partout : listes de documents, corbeille, recherche, statistiques, document ouvert par son lien (ailleurs : introuvable), lots d’import, circuits de validation, file de classement, espaces et règles ; les règles de l’institution lui restent visibles en lecture seule (#196, #203, #358).

### Recette et CI

- Suite de fumée Playwright et parcours UAT P1–P8 joués contre la pile Docker complète (#39, #48, #55, #59, #63, #69).
- Scripts de mesure du taux de classement (C2), du temps de recherche (C3) et des compteurs de démonstration (#64, #65).
- CI proportionnée aux fichiers modifiés (impact-aware), lint et analyse de sécurité bloquants, vérification de l'intégrité des releases (#4, #17, #19, #20, #22).
- Exercice de restauration n° 1 consigné (#61).
- Scénarios préparés pour les cinq lots réouverts (#67, #71).
- Recette UAT nocturne sur un workflow Playwright réutilisable (#130) ; verrou OTP et lots V1.1 joués pour de vrai (#208) ; specs alignés sur l'interface actuelle, données du circuit isolées des compteurs de démonstration (#89, #91, #102, #108, #289, #291).
- Contrôles de CI : aucune URL externe chargée par le navigateur (#146), specs purs exécutés (#143), branches `release/**` couvertes (#206), contrôles en lecture seule avant le tag (`tag_preflight.sh`, #156).
- Capture visuelle versionnée avec garde d'écran (#249) ; substitut Redis unique pour les tests (#118) ; pile allégée et synthèse par demi-journée pour la sonde de disponibilité (#117, #142).

### Documentation

- Guide de test fonctionnel, exploitation (sauvegarde, données de démonstration), passations par rôle, dossiers de décision et fiches de lots (#3, #15, #24, #34, #36, #40, #43, #49, #57, #68, #72).
- Guides utilisateur et d'installation alignés sur la rc.1 (#292) ; installation : navigateur sans Internet, lien vers l'accès HTTPS local (#114, #115, #139) ; clé publique et vérification de la signature (#124).
- Plan et contrôles du tag rc.1 (#131, #158, #160, #226) ; recette : plan et checklists du 20 au 23/11, fiche UAT du 23/11, essai d'installation sans Internet du 25/11, checklist de démonstration (#90, #96, #119, #128, #217, #244).
- Mémoire d'échecs du projet (#103, #125, #132, #178).

### Dépendances et outillage

- Node 24, mises à jour de sécurité Python et npm, portabilité des fichiers suivis (#7–#33, #37, #26, #16).

### Limites connues

Relevé des `fixme` des specs e2e (`frontend/e2e/specs`, main 7ecde2b, 10/11), mis à jour à la coupe du 19/11 : toutes les lignes sont corrigées dans la rc.1.

| Défaut (spec) | Ce que voit l'utilisateur | Statut |
|---|---|---|
| SC-AUTH-02 E1 (`auth-2fa`) | Après une session expirée, la reconnexion ramène au tableau de bord et non à la page demandée : il faut y retourner soi-même. | **corrigé** (#97 42397a3) |
| SC-AUTH-01 E3 (`auth-2fa`) | Trois codes OTP erronés verrouillent le compte 15 minutes, avec un compte à rebours à l'écran ; le déblocage anticipé passe par l'administrateur (procédure d'exploitation), écran de déblocage en V1.1. | **corrigé** (#83 64ade05 + #88 6669f2c) |
| D3 (`audit-trail`) | Le journal d'audit ne trace ni les connexions, ni les dépôts, ni les imports : seuls la revue manuelle, les consultations, les doublons refusés, la corbeille et les versions y figurent. | **corrigé** (#98 351c82c) |
| SC-V11-01 (`v11-lots`) | Tuile « Doublons refusés » du tableau de bord. | **corrigé** (#77 ac77271 + #81 3f10054) |
| SC-V11-02 (`v11-lots`) | Export puis import des règles de classement, rejouable sans doublon. | **corrigé** (#79 96ea1fc + #84 a137d8d) |
| SC-V11-03 (`v11-lots`) | Export CSV du journal d'audit, plafonné à 50 000 lignes (au-delà, affiner la période ou les filtres) ; verrou après 3 codes erronés. | **corrigé** (#80 dc4daae + #87 c6724ea ; #83 64ade05) |
| SC-V11-04 (`v11-lots`) | Les règles ne lisent ni le texte OCR ni la date du document : classement par nom de fichier et dossier seulement. | **corrigé** (#92 aa1ff60 + #95 fa26e17). Limites de #92 (restent en V1.0) : un fichier passé par la file de revue d'import que rien ne classe à l'analyse ne crée pas de document, donc il n'est pas reclassé après OCR (seuls l'ingestion de dossier et le dépôt le sont) ; à l'ingestion, les règles sont évaluées avec la portée « service » : une règle à portée « utilisateur » ne s'applique jamais à un document ingéré ; les documents classés avant cette version ne sont pas reclassés. |
| SC-V11-05 (`v11-lots`) | Aucun dossier n'est surveillé en continu : l'import se lance à la main depuis l'écran Ingestion. | **corrigé** (#101 3cc6e15 + #100 187b7f7) |

Hors tableau : `demo-counters` (`AWAITING_D1`) est une activation de test, levée par #82 (recette, pas une limite produit) ; `validation-cycle` est déjà actif (`AWAITING_VALIDATION_UI = false`).

Limites hors `fixme` :

- Cycle de vie manuel : corbeille, restauration et purge par l'administrateur ; pas de durée de conservation automatique.
- Cloisonnement par profil : un collaborateur n'importe pas en masse et ne cherche que dans ses propres documents. L'import en masse, l'explorateur documentaire et la bannette de classement sont réservés à l'administrateur. C'est voulu : l'administrateur prépare, chacun ne voit que ce qui le concerne.
- Les documents mis à la corbeille ne sont plus comptés au tableau de bord de l'institution (#260), mais le compteur des circuits de validation les compte encore. Correction prévue en V1.1 (#536).
- Renommer ou reclasser un document ne laisse pas encore de trace dans le journal d'audit. Correction prévue en V1.1 (#250).
- Un administrateur peut désigner comme dossier de classement, à la résolution d'une revue, un dossier qui n'est pas vérifié comme appartenant à son institution. Correction prévue en V1.1 (#242).
- Pour un manager ou un lecteur, un document hors de son service répond « accès refusé » au lieu de « introuvable » : la réponse confirme que le document existe. Correction prévue en V1.1 (#247).
- Navigateurs pris en charge : Chrome 109 et plus, Firefox 115 et plus, Edge. Internet Explorer affiche une page blanche ; avant Chrome 108 et Firefox 101, la fenêtre de dépôt est coupée à 1366×768. Sur un autre poste en HTTP (port 8080), le bouton « Copier » ne fait rien, car le navigateur réserve le presse-papiers aux connexions chiffrées : copier l'adresse à la main, ou passer en HTTPS. Correction proposée en V1.1 (#523).
- Écran « Gestion AuthZ », onglet des règles : il ne montre pas les droits et indique qu'ils ne sont pas modifiables sur cette installation. Le serveur garde les droits dans un fichier (`AUTHZ_BACKEND=csv`) ; c'est la personne qui installe qui les règle. En V1.1, la grille s'affiche en lecture seule tant que le serveur reste dans ce mode, puis devient modifiable par le seul super admin quand il passe en base de données.
- Reporté en V1.2 (décision du 17/11) : désigner un lecteur d'un autre service sans lancer de circuit ; alertes de qualité et onglet « Qualité » des rapports ; accès public en HTTPS sur un serveur distant.
- OCR léger uniquement ; le moteur complet est hors budget machine (DEC-2026-003).
- Traces de recette : l'artefact CI `e2e-smoke-report` (14 jours) conserve les traces Playwright des tests rejoués, donc les en-têtes d'autorisation d'un jeton e2e éphémère (30 min, environnement CI détruit après le run) ; aucun compte réel n'y figure.
- Lots non fusionnés à la coupe du 19/11 (`release/v1.0.0` = `a1c15f61`) : aucune PR de la V1.1 n'est entrée. Ce qu'on peut voir à la démonstration et qui n'est pas livré :
  - remplacement pendant une absence (#445, #453) ;
  - recherche insensible aux accents (#436) ;
  - mesure des 100 000 fichiers (#473, #497) ;
  - lisibilité des badges de statut (#484) ;
  - focus clavier à la connexion (#446) ;
  - déblocage d'un compte par l'administrateur (#394, #405).

  Environ 100 PR restent en brouillon pour la V1.1, qui commence le 24/11. Les phrases d'écart sont dans `plan-presentation.md` § 3.

### Écarts d'exploitation connus

- **HTTPS (item CDC 27)** : l'accès chiffré `https://localhost:8443` utilise un certificat local (mkcert) installé sur le poste de démonstration ; aucun certificat public (pas de nom de domaine, démonstration sur place). Un autre poste affiche un avertissement tant que `mkcert -install` n'y a pas été lancé. Le HTTP sur le port 8080 reste disponible. Livré par #109 ; décision du PO du 16/11 : la démonstration se fait en HTTPS.
- **Disponibilité (item CDC 29)** : mesurée par `scripts/probe_c6.sh` (#106) du 17 au 21/11 ; relevés bruts, sans arrondi. Mesuré à ce jour :
  - **19/11, C6 verte** : 7 relevés verts consécutifs, de 21:35:19Z à 22:05:27Z, sans échec ni trou. Ils portent sur une pile construite depuis le SHA de coupe `a1c15f61`, provenance vérifiée par le contenu. Les séries lues plus tôt dans la journée mesuraient la pile de démonstration du 16/11 (`7898387b`) : elles ne sont pas retenues.
  - **20/11, trou de sonde** : aucun relevé de 06:29:52Z à 12:40:26Z sur la pile de démonstration (Docker arrêté, disque plein). Ce trou est compté comme un trou, pas comme un succès.
  - **21/11** : lecture à venir.
- **Déploiement sur serveur distant (item CDC 28)** : non livré dans la rc.1, décision du PO du 9/11 (démonstration sur place, mêmes conteneurs). La preuve d'installation retenue est l'essai d'installation sans Internet du 25/11. La mise en service sur le serveur distant vient en V1.1, avec un accès par VPN seulement (#288) ; l'accès public en HTTPS suit en V1.2.
- **Volumétrie (item CDC 8)** : 420 documents mesurés ; les 100 000 fichiers du cahier des charges sont mesurés en décembre.

### Ce qui se règle où

| À l'écran | Sur le serveur, par la personne qui installe |
|---|---|
| Institutions, leur organisation et leur premier administrateur (« Institutions ») | Mots de passe techniques et clé de sécurité |
| Comptes (« Utilisateurs ») | Durée des sessions, nombre d'essais de connexion, taille maximale d'un envoi |
| « Gestion AuthZ » : les droits ne s'y règlent pas dans cette version (voir les Limites connues) | Droits des rôles (fichier `policy.csv`) |
| Affichage du menu (« Paramètres ») | Sauvegardes et restaurations |
| Côté Admin Institution : plan de classement, règles de rangement, modèles, espaces | Adresse et port de l'application |

Les mots de passe techniques ne passent jamais par l'écran. En V1.1, la durée des sessions, le nombre d'essais de connexion et la taille maximale d'un envoi passent à l'écran, et la grille des droits s'affiche ; elle devient modifiable par le seul super admin quand le serveur passe en base de données. Détail des réglages du serveur : `DOCS/exploitation/installation.md` § 3.

### Dépendances

Gel des dépendances jusqu'à la démonstration du 30/11 : les mises à jour proposées automatiquement (#110 à #113, #29, #30, #56) ne sont pas fusionnées ; reprise une par une après la démonstration (`plans/note-gel-dependances-rc1.md`).

### Retour arrière (à valider par un rejeu avant le tag)

1. Avant toute mise à jour : `bash ops/backup.sh` (dossier `backups/ged237-<horodatage>`).
2. Revenir au tag précédent : `docker compose down`, `git checkout <tag précédent>`.
3. Restaurer les données **de la sauvegarde d'avant la mise à jour** : `docker compose up -d postgres redis`, puis `bash ops/restore.sh backups/ged237-<horodatage> --wipe`, puis `docker compose up -d --build`.
4. Contrôler : `curl -s http://localhost:8080/health` (version attendue = tag précédent) et `docker compose exec api alembic current`.

On ne « descend » pas les migrations à la main : deux migrations de réparation (`a7d9e2f4c6b8`, `b8e1f3a5c7d9`) sont volontairement à sens unique (`downgrade` vide), la restauration de la sauvegarde est le seul retour arrière garanti. Cette procédure découle de `DOCS/exploitation/sauvegarde-restauration.md` et de `installation.md` § 6 ; elle n'a pas été rejouée de bout en bout (rejeu prévu au plan de recette du 20/11).

---

## Delta du gel à la coupe (`2f15b6e`, 17/11 → `a1c15f61`, 19/11)

70 PR sont fusionnées sur `main` entre le gel et la coupe. Il n'y a pas de nouvelle migration : la tête reste `a7c8d9e0f1b2`. Les lignes des sections ci-dessus qui en dépendent sont à jour.

- **Corbeille et doublons** : corbeille avec restauration et purge selon les droits (#152, #181) ; vue des doublons, qui garde un document et met les autres à la corbeille (#171, #199) ; entrée de menu cachée sans droit de corbeille (#492) ; suppression définitive réservée au droit correspondant (#345) ; un propriétaire ne peut pas mettre à la corbeille un document en cours de validation (#464).
- **Circuit de validation** : motif de rejet, renvoi après correction, émetteur et compteurs (#438, #502) ; un seul critère pour les tâches de l'utilisateur (#429) ; nombre de tâches en attente sur le menu (#442) ; l'assigné lit le document hors de son service (#340) ; une ligne de journal par visa, validation ou rejet (#515).
- **Droits** : l'administrateur d'unité est limité à son service et à ses sous-services (#203, #358, #360) ; jeton d'accès contrôlé par type (#474) ; session révoquée à la déconnexion (#479) ; plus de déconnexion sur une coupure réseau (#410) ; profils de démonstration masquables à la connexion (#422, #425).
- **OCR et import** : Tesseract par défaut, RapidOCR pour les photos et formulaires, EasyOCR hors ligne et désactivé par défaut (#325, #350, #365, #368, #374) ; relance de l'OCR d'un document (#369) ; classement à l'import des fichiers que l'OCR ne lit pas (#480) ; un fichier stocké par envoi, noms longs tronqués (#319, #321) ; contrôle de la taille et du format avant l'envoi, extraits de recherche (#423, #460).
- **Revue de classement** : passage au fichier suivant après une décision (#420) ; revue ouverte sur tous les chemins qui la demandent (#485).
- **Écrans et accessibilité** : commandes sans action retirées ou branchées, dialogues maison au lieu des fenêtres natives, libellés relus (#314, #324, #334, #336, #337, #339, #341, #346, #348, #364, #390, #412, #427, #430, #432) ; accès clavier aux cartes, à la zone de dépôt et aux dialogues (#441) ; boutons Annuler et Envoyer visibles sur petit écran (#450) ; anneau de focus net (#499).
- **Exploitation** : sauvegarde et restauration plus sûres (#482) ; import des images hors ligne (#477) ; résumé des relevés de disponibilité (#498) ; manuels d'installation et d'exploitation (#327, #328, #375, #408, #409).
- **Recette et CI** : scénario de démonstration de bout en bout (#356, #363, #406) ; tests unitaires du frontend (#421) ; CI backend en 4 parties et sans double passage (#472, #489, #490) ; leçons (#317, #415, #461).

Au 17/11 au soir (`main` 2f15b6e) : toutes les PR prévues avant le gel sont fusionnées, dont #99, #100 et #109 ; état de référence : `plans/releve-coupure-19-11.md`.
