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

### Corrections

- Profil de démonstration : l'institution est retrouvée par le code du ministère (#41).
- Moteur OCR et démarrage Docker durcis ; garde « schéma à jour » au démarrage de l'API (#1, #5, #60).
- Codes de rôle en minuscules, jeu de référence convergent entre le seed et le service de démonstration (#50).
- Validation d'import : la file de traitement ne bloque plus la réponse quand le stockage des résultats est injoignable (#75).
- Interface : contraste, libellés de l'Atelier, message clair en cas de trop nombreuses tentatives de connexion, accessibilité des modales et du lecteur (#45, #73).

### Droits retirés

- Les rapports de l'Admin Service ne couvrent plus que son service et ses sous-services ; les Collaborateurs n'ont plus accès aux rapports (#188, #187).

### Recette et CI

- Suite de fumée Playwright et parcours UAT P1–P8 joués contre la pile Docker complète (#39, #48, #55, #59, #63, #69).
- Scripts de mesure du taux de classement (C2), du temps de recherche (C3) et des compteurs de démonstration (#64, #65).
- CI proportionnée aux fichiers modifiés (impact-aware), lint et analyse de sécurité bloquants, vérification de l'intégrité des releases (#4, #17, #19, #20, #22).
- Exercice de restauration n° 1 consigné (#61).
- Scénarios préparés pour les cinq lots réouverts (#67, #71).

### Documentation

- Guide de test fonctionnel, exploitation (sauvegarde, données de démonstration), passations par rôle, dossiers de décision et fiches de lots (#3, #15, #24, #34, #36, #40, #43, #49, #57, #68, #72).

### Dépendances et outillage

- Node 24, mises à jour de sécurité Python et npm, portabilité des fichiers suivis (#7–#33, #37, #26, #16).

### Limites connues

Relevé des `fixme` encore ouverts dans `frontend/e2e/specs` (main 7ecde2b, 10/11) ; statut « corrigé avant le 19 » = une PR ouverte le couvre et doit être fusionnée avant la coupure du 19/11 18:00, sinon la ligne passe en V1.1 le 19 au soir.

| Défaut (spec) | Ce que voit l'utilisateur | Statut |
|---|---|---|
| SC-AUTH-02 E1 (`auth-2fa`) | Après une session expirée, la reconnexion ramène au tableau de bord et non à la page demandée : il faut y retourner soi-même. | **corrigé** (#97 42397a3) |
| SC-AUTH-01 E3 (`auth-2fa`) | Trois codes OTP erronés verrouillent le compte 15 minutes, avec un compte à rebours à l'écran ; le déblocage anticipé passe par l'administrateur (procédure d'exploitation), écran de déblocage en V1.1. | **corrigé** (#83 64ade05 + #88 6669f2c) |
| D3 (`audit-trail`) | Le journal d'audit ne trace ni les connexions, ni les dépôts, ni les imports : seuls la revue manuelle, les consultations, les doublons refusés, la corbeille et les versions y figurent. | **corrigé** (#98 351c82c) |
| SC-V11-01 (`v11-lots`) | Tuile « Doublons refusés » du tableau de bord. | **corrigé** (#77 ac77271 + #81 3f10054) |
| SC-V11-02 (`v11-lots`) | Export puis import des règles de classement, rejouable sans doublon. | **corrigé** (#79 96ea1fc + #84 a137d8d) |
| SC-V11-03 (`v11-lots`) | Export CSV du journal d'audit, plafonné à 50 000 lignes (au-delà, affiner la période ou les filtres) ; verrou après 3 codes erronés. | **corrigé** (#80 dc4daae + #87 c6724ea ; #83 64ade05) |
| SC-V11-04 (`v11-lots`) | Les règles ne lisent ni le texte OCR ni la date du document : classement par nom de fichier et dossier seulement. | **corrigé** (#92 aa1ff60 + #95 fa26e17). Limites de #92 (restent en V1.0) : un fichier passé par la file de revue d'import que rien ne classe à l'analyse ne crée pas de document, donc il n'est pas reclassé après OCR (seuls l'ingestion de dossier et le dépôt le sont) ; à l'ingestion, les règles sont évaluées avec la portée « service » : une règle à portée « utilisateur » ne s'applique jamais à un document ingéré ; les documents classés avant cette version ne sont pas reclassés. |
| SC-V11-05 (`v11-lots`) | Aucun dossier n'est surveillé en continu : l'import se lance à la main depuis l'écran Ingestion. | **moteur corrigé** (#101 3cc6e15) ; écran d'état en attente (#100), **bascule en V1.1 le 19 à 18:00 si non fusionnée** |

Hors tableau : `demo-counters` (`AWAITING_D1`) est une activation de test, levée par #82 (recette, pas une limite produit) ; `validation-cycle` est déjà actif (`AWAITING_VALIDATION_UI = false`).

Limites hors `fixme` :

- Cycle de vie manuel : corbeille, restauration et purge par l'administrateur ; pas de durée de conservation automatique.
- Cloisonnement par profil : un collaborateur n'importe pas en masse et ne cherche que dans ses propres documents. L'import en masse, l'explorateur documentaire et la bannette de classement sont réservés à l'administrateur. C'est voulu : l'administrateur prépare, chacun ne voit que ce qui le concerne.
- L'Admin Service : ses documents et sa recherche couvrent toute l'institution ; ses rapports, seulement son service. Le limiter à son service partout est prévu en V1.1 (#215).
- Les documents mis à la corbeille sont encore comptés dans les statistiques de l'institution ; corrigé en V1.1 (#218).
- OCR léger uniquement ; le moteur complet est hors budget machine (DEC-2026-003).
- Traces de recette : l'artefact CI `e2e-smoke-report` (14 jours) conserve les traces Playwright des tests rejoués, donc les en-têtes d'autorisation d'un jeton e2e éphémère (30 min, environnement CI détruit après le run) ; aucun compte réel n'y figure.
- Lots non fusionnés au 19/11 18:00 : relevé O reporté ici le 19 au soir ; phrases d'écart dans `plan-presentation.md` § 3.
### Écarts d'exploitation connus

- **HTTPS (item CDC 27)** : l'accès chiffré `https://localhost:8443` utilise un certificat local (mkcert) installé sur le poste de démonstration ; aucun certificat public (pas de nom de domaine, démonstration sur place). Un autre poste affiche un avertissement tant que `mkcert -install` n'y a pas été lancé. Le HTTP sur le port 8080 reste disponible. Livré par #109 ; décision du PO du 16/11 : la démonstration se fait en HTTPS. *Si #109 n'est pas fusionnée le 19 à 18:00 : « accès HTTP seulement ».*
- **Disponibilité (item CDC 29)** : mesurée par `scripts/probe_c6.sh` (#106) du 17 au 21/11 ; la valeur retenue est celle des relevés du `c6.tsv` : **à renseigner le 19 au soir (≥ 6 relevés verts) puis le 21 (10 sur 10)**, sans arrondi.
- **Déploiement sur serveur distant (item CDC 28)** : non livré, décision du PO du 9/11 (démonstration sur place, mêmes conteneurs).
- **Volumétrie (item CDC 8)** : 420 documents mesurés ; les 100 000 fichiers du cahier des charges sont mesurés en décembre.

### Dépendances

Gel des dépendances jusqu'à la démonstration du 30/11 : les mises à jour proposées automatiquement (#110 à #113, #29, #30, #56) ne sont pas fusionnées ; reprise une par une après la démonstration (`plans/note-gel-dependances-rc1.md`).

### Retour arrière (à valider par un rejeu avant le tag)

1. Avant toute mise à jour : `bash ops/backup.sh` (dossier `backups/ged237-<horodatage>`).
2. Revenir au tag précédent : `docker compose down`, `git checkout <tag précédent>`.
3. Restaurer les données **de la sauvegarde d'avant la mise à jour** : `docker compose up -d postgres redis`, puis `bash ops/restore.sh backups/ged237-<horodatage> --wipe`, puis `docker compose up -d --build`.
4. Contrôler : `curl -s http://localhost:8080/health` (version attendue = tag précédent) et `docker compose exec api alembic current`.

On ne « descend » pas les migrations à la main : deux migrations de réparation (`a7d9e2f4c6b8`, `b8e1f3a5c7d9`) sont volontairement à sens unique (`downgrade` vide), la restauration de la sauvegarde est le seul retour arrière garanti. Cette procédure découle de `DOCS/exploitation/sauvegarde-restauration.md` et de `installation.md` § 6 ; elle n'a pas été rejouée de bout en bout (rejeu prévu au plan de recette du 20/11).

---

## Suivi des fusions à reporter ici (à tenir jusqu'au 19/11 18:00)

Au 16/11 (`main` ca9953b) : tout est fusionné, sauf #99, #100 et #109 ; état de référence : `plans/releve-coupure-19-11.md`. Le tableau ci-dessous est l'état du 10/11, conservé pour mémoire.

| PR | Lot / sujet | Ligne cible | État au 10/11 |
|---|---|---|---|
| #76 | année avec `_` dans les noms de fichiers | Fonctionnalités, règles | ouverte, en chaîne |
| #78 | filtres et pagination des espaces (écran) | Fonctionnalités, espaces | ouverte |
| #77 + #81 | lot 1, tuile « Doublons refusés » | Fonctionnalités (nouvelle ligne) | ouvertes, #77 CI rouge |
| #79 + #84 | lot 2, export/import des règles | Fonctionnalités (nouvelle ligne) | ouvertes |
| #80 | lot 3a, export CSV du journal | Fonctionnalités + Limites | ouverte |
| #83 | lot 3b, verrou après 3 OTP | Fonctionnalités + Limites | ouverte |
| #82 | activation de la vérification du jeu D1 | Recette et CI | ouverte |
| lots 4, 5 | critères contenu/date, surveillance | Limites connues | aucune PR |
