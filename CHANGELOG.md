# Changelog

Toutes les évolutions notables d'E-Dossier Cameroun (GED237). Format : [Keep a Changelog 1.1.0](https://keepachangelog.com/fr/1.1.0/) ; versions selon [SemVer](https://semver.org/lang/fr/). Le corps de chaque version sert aussi de texte à la release GitHub du même tag.

## [Unreleased]

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
- Écran « Gestion AuthZ », onglet des règles : il ne montre pas les droits et indique qu'ils ne sont pas modifiables sur cette installation. Le serveur garde les droits dans un fichier (`AUTHZ_BACKEND=csv`) ; c'est la personne qui installe qui les règle. En V1.1, la grille s'affiche en lecture seule tant que le serveur reste dans ce mode, puis devient modifiable par le seul super admin quand il passe en base de données.
- Reporté en V1.2 (décision du 17/11) : désigner un lecteur d'un autre service sans lancer de circuit ; alertes de qualité et onglet « Qualité » des rapports ; accès public en HTTPS sur un serveur distant.
- OCR léger uniquement ; le moteur complet est hors budget machine (DEC-2026-003).
- Traces de recette : l'artefact CI `e2e-smoke-report` (14 jours) conserve les traces Playwright des tests rejoués, donc les en-têtes d'autorisation d'un jeton e2e éphémère (30 min, environnement CI détruit après le run) ; aucun compte réel n'y figure.
- Lots non fusionnés à la coupe du 19/11 (`release/v1.0.0` = `a1c15f61`) : aucune PR de la V1.1 n'est entrée. Ce qu'on peut voir à la démonstration et qui n'est pas livré : remplacement pendant une absence (#445, #453), recherche insensible aux accents (#436), mesure des 100 000 fichiers (#473, #497), lisibilité des badges de statut (#484), focus clavier à la connexion (#446), déblocage d'un compte par l'administrateur (#394, #405). Phrases d'écart : `plan-presentation.md` § 3.
- Disponibilité (item CDC 29) : la C6 du 19/11 est **verte**, avec 7 relevés consécutifs de 21:35:19Z à 22:05:27Z, sans échec ni trou, sur une pile construite depuis `a1c15f61` (provenance vérifiée par le contenu, empreinte `9cd06f7b`). La lecture du 21/11 est à venir.
