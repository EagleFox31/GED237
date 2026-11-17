# Scénario de la démo du 30/11 — le classement automatique, de bout en bout

- **Pour** : O (relit, présente au PO), P (présente), Q (données, captures, recette), B et F (points à vérifier). Innovateur, 2026-11-17. Première version sur `main` c216141 ; **contrôlé ligne à ligne sur b701314** le 17/11 (§ 7).
- **Périmètre** : uniquement ce qui sera dans la rc.1, c'est-à-dire b701314 plus #104 (documentation seule). Rien des PR post-rc1 : pas de code par e-mail ni de renvoi du code (#154), pas d'application d'authentification (#193), pas de vue « Doublons » (#171, #199), pas d'écran « Corbeille » (#181), pas de sélection multiple (#211), pas de favoris ni de récents (#165), pas de rapports officiels (#180, #197, #209).
- **Remplace** le § 1 de `deroule-demo.md` (10/11), écrit avant les fusions du 10 au 17/11. Les autres documents restent valables et ce scénario y renvoie : préparation des postes (`checklist-demo.md`), constitution du jeu (`jeu-donnees-demo.md`, `DOCS/exploitation/donnees-demo.md`), réponses aux questions (`plan-presentation.md` § 4).
- **Niveaux** : `Vérifié` = lu dans le code de b701314 ; `À vérifier` = à confirmer en recette (§ 5) ; `Proposé` = choix de ce scénario.

## 1. Parcours minuté (18:00, marge de 2:00 sur le créneau de 20:00)

Fil conducteur : *un service reçoit un dossier en vrac. GED237 le range tout seul, explique pourquoi, laisse à un humain ce qu'il ne sait pas classer, puis chacun ne retrouve que ce qu'il a le droit de voir, avec la trace de qui a fait quoi et les chiffres du service.*

Postes : une fenêtre **A** (`MINFI001`, administrateur de l'institution), connectée en direct, et quatre profils de navigateur **préconnectés** 10 minutes avant la séance : **B** `MINFI001` (secours de A), **C** `READ001` (lecteur DSI), **D** `AUDIT001` (auditeur), **E** `MGR001` (manager DAF). Une seule connexion en direct. Narrateur : l'administrateur du ministère (décision de O du 17/11). L'import, l'explorateur et la bannette lui sont réservés, ce qui est voulu : c'est le cloisonnement, pas un manque (§ 7, lignes 2 à 4).

| Min | Durée | Étape | Fenêtre | Ce que l'on fait (`Vérifié` sauf mention) | Ce que le jury doit voir | Transition |
|---|---|---|---|---|---|---|
| 0:00–1:00 | 1:00 | **Ouverture** | — | une diapositive (§ 5 n° 19) : des dossiers partagés en vrac, des documents introuvables | le problème et la promesse en une phrase | « Entrons comme l'administrateur du ministère. » |
| 1:00–1:45 | 0:45 | **Connexion** | A | « Administration / Organisme », « Matricule Personnel », « Mot de Passe », « Étape Suivante », puis le code et « Confirmer l'identité » (parade du § 4 si le code s'affiche) | nom et rôle « Admin Institution » dans l'en-tête | « La DAF lui transmet 30 fichiers en vrac. » |
| 1:45–4:45 | 3:00 | **1. Import en vrac** | A | menu « Import en masse » (`/ingestion`) → « Importer dans le Serveur de l'Application » → « Juste les ranger » → « Choisir un dossier » : `live` (30 fichiers, envoi par le navigateur) → « Définir la destination » : « Service », DAF → « Vérifier le classement » → « Importer les documents ». Phrase pendant l'analyse : « L'administrateur prépare, chacun ne voit que ce qui le concerne. Un agent n'importe pas en masse et ne cherche que dans ses documents : c'est le cloisonnement voulu. » | les cartes « Fichiers analysés », « Prêts », « À revoir », « Ignorés / doublons » (**2 doublons** reconnus au contenu), puis « Importés », « À arbitrer », « Doublons », « Erreurs » | « Où sont-ils partis ? » |
| 4:45–6:15 | 1:30 | **2. Le rangement** | A | « Explorateur documentaire » (`/spaces`) : DAF → domaine → activité → année ; ouvrir un document importé | l'arborescence **service > domaine > activité > année** remplie par l'import ; un fichier sans date part dans « A classer/‹année› » (`À vérifier`, § 5 n° 4). Si l'on demande « et par année d'abord ? » : « On range d'abord par métier, parce que c'est ainsi qu'on cherche un dossier ; l'année est le dernier niveau, et le filtre « Toutes les années » permet de choisir une année. » **E24** : le statut s'affiche « A verifier », sans accent | « Pourquoi là ? Parce qu'une règle le dit. » |
| 6:15–7:45 | 1:30 | **3. Les règles** | A | « Plan de classement » (`/classement`) → « Règles de classement » : une règle avec critère de **contenu** ou d'**année** ; puis « Simulateur » sur une règle inactive | la règle en clair ; la simulation montre avant/après **sans rien déplacer** | « Ce qu'aucune règle ne sait classer attend un humain. » |
| 7:45–8:45 | 1:00 | **4. La bannette** | A | « Ma bannette » (`/classification-reviews`, page « Revue de classement ») : un fichier « à revoir » de l'import, ou, si l'import a tout classé, un des 41 « à revoir » MINFI du jeu, choisi par Q (§ 5 n° 3) ; « Domaine », « Activité », « Année », puis « Classer et relancer » | le fichier quitte la bannette et rejoint l'arbre | « Maintenant, retrouvons-le. » |
| 8:45–10:15 | 1:30 | **5. Recherche et droits** | E puis C | dans E (arrivée sur « Tâches & Validations »), barre de recherche du bandeau : « courrier » ; dans C, cliquer d'abord « Tableau de Bord », puis le même mot-clé. « courrier » est le seul nom de famille de documents présent à la fois à la DAF et à la DSI (`demo_dataset.py`, famille « courrier » : DAF 20, DSI 18, dont environ un sur quatre porte le mot) ; nombres de résultats `À vérifier` par Q (§ 5 n° 8). « facture » ne convient pas : 20 résultats pour E, 0 pour C (#256, écart 10) | deux listes différentes pour la même requête : DAF pour E, DSI pour C ; un document mis en corbeille n'apparaît pas ; le menu de C n'a ni « Rapports », ni « Plan de classement », ni « Import en masse » | « Et qui a fait quoi ? » |
| 10:15–11:30 | 1:15 | **6. Historique** | A puis D | fiche d'un document versionné → onglet « Historique des Versions » ; puis D, menu « Audit » (`/audit`, depuis #233), page « Registre Des Actions » : filtre de la colonne « Effectuée par » sur l'administrateur → « Exporter (CSV) ». L'aller-retour par le menu et l'export marchent (répétition du 17/11, #256 écart 11) | les versions ; dans le journal, l'import, la revue et les consultations de la séance ; l'export, lui-même tracé | « Et pour le chef de service ? » |
| 11:30–12:45 | 1:15 | **7. Rapports** | E | menu « Rapports » (`/reports`) : « Traitement & délais », puis « Services » (le manager n'a pas l'onglet « Synthèse ») | les chiffres **de la DAF seulement** (#175, #188) : volumes, non classés, à revoir | « Et quand un dossier est clos ? » |
| 12:45–13:30 | 0:45 | **8. Archivage** | A | ouvrir la fiche du document **validé** de la DAF : le bordereau P8, visé par `MGR001` puis signé par l'administrateur **pendant la préparation**, après la remise à zéro et avant la séance, car le jeu ne contient aucun document validé (§ 5 n° 21) → « Archiver » → « Archiver ce document ? » → « Oui, archiver » ; puis « Mes documents », filtre « Archivé ». **Dépend de #256 écart 9** : le chemin jusqu'au bouton est `À vérifier` après le correctif de F (aujourd'hui, l'aperçu de l'explorateur n'a pas le bouton et « Mes documents » ne charge que 100 documents). Sans correctif avant la coupe, l'étape est retirée et ses 0:45 vont aux questions | le badge « Archivé » ; le document reste consultable ; seul un document validé ou signé s'archive, et seul l'administrateur de l'institution le fait (#231, #239) | « Voilà ce qui marche. Voici ce qui manque. » |
| 13:30–14:15 | 0:45 | **Ce qui manque** | — | une phrase par écart, avec sa date ou son appui (§ 1 bis) | — | « Vos questions. » |
| 14:15–18:00 | 3:45 | **Questions** | — | `plan-presentation.md` § 4 | — | — |

Total : 18:00, dont 12:30 de direct (de 1:00 à 13:30, connexion comprise). Marge : 2:00 avant la fin du créneau. Les durées comptent 10 s par changement de fenêtre.

Si l'import dépasse 4:00 : l'étape 3 se réduit au « Simulateur » (0:45) et l'étape 6 au journal, sans export (0:45). Les questions absorbent le reste. On ne prend jamais sur la marge de 2:00.

### 1 bis. Ce qui manque, dit au bloc 13:30 (taux CDC du relevé du 19, sur #104)

- **Mesure de charge** (100 000 fichiers en moins de 20 min, item 8) : non mesurée ; décision PO du 17/11, mesure après le 24/11.
- **Vue « doublons »** (item 19) : les doublons sont refusés à l'import et comptés au tableau de bord (tuile « Doublons refusés », `Vérifié`) ; la vue de choix arrive après la version.
- **HTTPS, installation sur site, disponibilité** (items 27, 28, 29) : dire l'état constaté au compte rendu du 20/11, pas avant.
- **Circuit de validation** : présent dans la rc.1 mais hors de ce fil conducteur ; montré **seulement si le jury le demande** (décision O du 17/11). Un document est déjà en attente chez `MGR001` (§ 5 n° 18) : fenêtre E, page « Tâches & Validations », « Valider », ou « Rejeter » puis « Confirmer le rejet » avec un motif (1:00, pris sur les questions ; déroulé détaillé : `deroule-demo.md` P8).

## 2. Jeu de données de démo

- **Provenance** : entièrement **synthétique**, aucune donnée réelle. Généré par `backend/scripts/demo_dataset.py` avec une graine fixe (`GED_EXPORT_SEED=237`) : PDF, images et fichiers bureautiques fabriqués, noms et contenus fictifs (`Vérifié`).
- **Volume** (`frontend/e2e/data/demo-manifest.json`, section `expected`, `Vérifié`) : **408 fichiers** reçus, répartis en DRH 154, DAF 157, DSI 87 et MINESUP-DAAJ 10 (étanchéité entre établissements). Ce sont des fichiers, pas des documents : 357 deviennent des documents classés, et 51 restent des revues ouvertes (41 MINFI, 10 MINESUP ; les 10 de MINESUP sont tous à revoir, faute de règle, ce qui montre le cloisonnement). S'y ajoutent 12 doublons refusés, 8 documents en corbeille, 5 documents versionnés, 4 imports, et **30 fichiers réservés au direct** (dossier `live`, non chargés). L'étape P8 en ajoute 2.
- **Total affiché à l'accueil de `MINFI001`** (B, 17/11, détail dans `DOCS/exploitation/donnees-demo.md`) : **351 documents** après la remise à zéro (357 classés, moins 8 en corbeille, plus 2 de P8), puis **351 + le nombre de fichiers classés par l'import en direct** (étape 1 : 28 nouveaux fichiers, plus 2 doublons refusés). Les fichiers « à revoir » ne comptent pas : ils deviennent des revues, pas des documents (`import_execution_service.py`, `Vérifié`). Le total attendu est **379** si les 28 sont classés, comme l'a mesuré Q le 17/11 sur 18a1018 par `POST /documents/ingest-directory` (28 importés, 2 doublons, aucun à revoir). Ce n'est pas le chemin de la démo : l'étape 1 passe par l'assistant « Import en masse » (`/imports`, analyse puis « Importer les documents »). Q fige le chiffre sur ce chemin-là (§ 5 n° 3). L'ancien attendu de 367 (16 classés, 12 à revoir) était `Déduit` et il est retiré (§ 9). Ces chiffres valent une fois la PR #260 fusionnée.
- **Commandes** (`DOCS/exploitation/donnees-demo.md`) : génération `bash scripts/demo-dataset.sh` ; remise à zéro `E2E_MANIFEST=/e2e-data/demo-manifest.json sh scripts/e2e_reset.sh demo` dans le conteneur `api` de la pile e2e. `seed_demo.py` purge, pose les règles, importe et **échoue si un compte diffère** du manifeste. Redis doit répondre. La pile de démo part de volumes vides (`docker compose down -v` avant le premier `up`) : sur une base déjà initialisée, le seed ne repasse pas, et les noms accentués des unités n'apparaissent pas (B, 17/11).
- **Pour le direct** : l'import passe par le navigateur, donc le dossier `live` doit être **copié sur le disque du poste de démo** (et du poste de secours) à un chemin court et connu. Durée de la remise à zéro : inconnue, à mesurer (§ 5 n° 1).

## 3. Comptes et rôles à préparer

Comptes du seed (`backend/scripts/seed_db.py`, `Vérifié` sur b701314 : identifiant, rôle et unité). **Aucun mot de passe dans ce document** : ils restent dans le coffre du poste et ne s'affichent jamais à l'écran. Ne pas utiliser les boutons de profils préremplis de l'écran de connexion.

| Identifiant | Rôle | Unité | Fenêtre | Sert à |
|---|---|---|---|---|
| `MINFI001` | admin de l'établissement | MINFI | A, en direct ; B, préconnectée (secours) | connexion, import, explorateur, plan de classement, simulateur, bannette, fiche document ; tableau de bord (tuile « Doublons refusés ») |
| `READ001` | lecteur | DSI | C, préconnectée | même recherche, autre résultat ; menu réduit |
| `AUDIT001` | auditeur | MINFI | D, préconnectée | journal d'audit en lecture seule, export CSV |
| `MGR001` | manager | DAF | E, préconnectée | recherche limitée à la DAF ; rapports limités à la DAF ; circuit de validation sur demande |
| `MINFI002` | collaborateur | DAF | **non utilisé** | son import est verrouillé, la bannette lui est refusée et sa recherche ne montre que ses propres documents (§ 7) : preuve du cloisonnement, à citer si le jury demande ce que voit un agent |
| `UNIT001` | admin d'unité | DRH | **aucun profil admin d'unité dans la démo** (décision O du 17/11) | en recherche et en liste, il voit tout l'établissement ; suivi par l'issue #195 après la rc.1 |
| `MINESUP001`, `SUPER001` | collaborateur MINESUP, super admin | — | non utilisés | — |

## 4. Risques en direct et plan B

Règle commune (`checklist-demo.md` § C) : une tentative (F5), sinon on bascule en moins de 60 s, sinon on montre les captures. On ne redémarre jamais en séance. Les captures viennent du rapport Playwright rejoué sur le tag (onglet ouvert d'avance).

| Risque | Signe | Plan B |
|---|---|---|
| Code à usage unique refusé ou trop de tentatives | message d'erreur, attente imposée (« Compte verrouillé. Réessayez dans … ») | passer sur B (`MINFI001`, déjà connectée) et commenter ; capture de `auth-2fa` |
| Code à usage unique affiché en clair à l'écran (canal `dev_response` de la pile de démo, signalé par O le 17/11) | le code apparaît sur l'écran projeté pendant la connexion de A | parade retenue selon le § 5 n° 14 : (a) la connexion de A se fait avant la séance, comme B à E, et l'étape « Connexion » montre l'écran de connexion **sans le valider** (0:30 gagnées) ; ou (b) projecteur en mode « étendre », connexion saisie sur l'écran non projeté, puis bascule. Phrase si le jury le voit : « Sur la pile de démonstration, le code s'affiche pour le test ; son envoi par e-mail arrive dans la version suivante. » (la rc.1 n'a pas de canal d'envoi : #154 vient après le 30/11, § 8) |
| Session expirée sur une fenêtre préconnectée | retour à l'écran de connexion | reconnexion du compte concerné (≈ 40 s) ; si deux expirent, captures pour les étapes restantes |
| Import long ou en erreur | analyse qui ne finit pas, erreur | importer un sous-dossier de 5 fichiers préparé (dont 1 doublon) ; sinon capture de `directory-import` |
| Répartition différente de celle annoncée | autres nombres de classés, à revoir ou doublons | lire les nombres affichés sans les commenter ; la répétition fige les chiffres attendus (§ 5 n° 3) |
| Bannette vide (tout est classé) | liste vide | ouvrir un des 51 « à revoir » du jeu |
| Le jury remarque « A verifier » sans accent (E24) | question sur l'orthographe | « Écart connu, noté en recette. » Ne pas s'y attarder |
| Rapports vides ou erreur côté manager | aucun chiffre, refus | montrer la même page dans A (admin, tout l'établissement), en disant que le manager ne voit que la DAF |
| Journal filtré vide | aucune ligne | retirer le filtre de la colonne « Effectuée par », trier par « Date et heure » |
| Pile Docker ou poste en panne | plus de réponse | poste de secours prêt, avec la même pile et le même jeu (`checklist-demo.md` § B) ; sinon captures pour tout le reste |
| Données modifiées par la répétition | import du direct déjà fait, bannette déjà vidée | remise à zéro la veille et après chaque répétition, puis contrôle des nombres du manifeste |

Le risque du menu admin « Recherche » (page introuvable sur c216141) est levé : le correctif #198 est dans b701314 (`Vérifié`). Le contrôle reste au § 5 n° 17.

## 5. À vérifier pendant la recette (20 au 23/11)

| # | Point | Qui | Preuve attendue |
|---|---|---|---|
| 1 | Durée de la remise à zéro du jeu sur le poste de démo | Q | durée notée, compatible avec J-1 |
| 2 | Le dossier `live` (30 fichiers, dont 2 doublons) est généré et copié sur les deux postes | Q | liste des fichiers |
| 3 | Répartition de l'import du direct **par l'assistant « Import en masse »** (pas par `ingest-directory`) : classés, à revoir, doublons, et le total de l'accueil qui en découle (351 + classés) ; si aucun fichier n'est à revoir, identifiant d'un des 41 « à revoir » MINFI du jeu pour l'étape 4 ; **durée** de « Vérifier le classement » puis de l'import (budget de l'étape 1 : 3:00) | Q | les trois nombres et les deux durées, figés dans ce document par ajout daté |
| 4 | Destination de quelques fichiers de `live` dans l'arbre DAF, et un cas « A classer/‹année› » | Q | chemins notés |
| 5 | L'import de `MINFI001` vers « Service » DAF range bien côté serveur et alimente « Ma bannette » | Q | rejeu de l'étape 1 avec `MINFI001` |
| 6 | Le filtre « Toutes les années » de l'explorateur filtre bien un dossier de la DAF | F | capture |
| 7 | Au moins une règle active du jeu utilise un critère de contenu ou d'année ; une règle inactive donne une simulation non vide | B | nom des règles retenues |
| 8 | Mot-clé « courrier » (§ 1, étape 5) : résultats non vides pour E (DAF) et pour C (DSI), listes différentes ; un document de la corbeille le contient, sinon le dire sans le montrer | Q | nombres de résultats pour E et pour C |
| 9 | Menus de `READ001` et `MGR001` conformes au § 3 | F | captures |
| 10 | Un document versionné du jeu, avec son onglet « Historique des Versions » rempli | Q | identifiant du document |
| 11 | Journal : lignes d'import, de revue et de consultation de `MINFI001` du jour, visibles par `AUDIT001` ; l'export CSV s'ouvre dans le tableur | Q | fichier exporté |
| 12 | Rapports de `MGR001` limités à la DAF, avec signaux à la même portée (#188) | Q | capture des onglets « Traitement & délais » et « Services » |
| 13 | Durée de vie d'une session préconnectée (au moins 40 min, ou renouvellement automatique) | B | réglage relevé dans la configuration |
| 14 | Comment le code à usage unique arrive sur la pile de démo ; s'il s'affiche à l'écran (`dev_response`), choix de la parade (a) ou (b) du § 4 et mise à jour de l'étape « Connexion » | B (fait), O (choix) | mode décrit, sans secret ; parade notée par ajout daté |
| 15 | Deux répétitions chronométrées (dont le 27/11), écarts reportés ici par ajout daté ; parcours de 18:00 au plus | O | chronos |
| 16 | Captures de secours régénérées sur le tag `v1.0.0-rc.1` | Q | rapport Playwright du tag |
| 17 | Chaque entrée du menu admin (`MINFI001`) ouvre une page, aucune « page introuvable » | Q | liste des entrées cliquées, avec la route |
| 18 | Un document de la DAF est en attente chez `MGR001` après la remise à zéro (jeu P8), et la validation comme le rejet motivé fonctionnent | Q | identifiant du document, capture de la tâche en attente |
| 19 | Diapositive d'ouverture (le problème des dossiers en vrac, la promesse en une phrase) | O la fournit, P la valide | fichier de la diapositive, validation de P |
| 20 | Deux sessions simultanées de `MINFI001` (A en direct, B préconnectée) restent ouvertes toutes les deux | Q | constat noté |
| 21 | *(si #256 écart 9 est corrigé avant la coupe)* Le jeu ne contient **aucun** document validé après la remise à zéro (Q, 17/11). Pendant la préparation, après la remise à zéro : `MGR001` vise le bordereau P8, puis l'administrateur le signe. Vérifier qu'un autre document reste en attente chez `MGR001` pour le n° 18, sinon le circuit ne se montre plus sur question. Puis chemin de A jusqu'au bouton « Archiver » : l'archivage passe et le filtre « Archivé » le retrouve. À ajouter à `checklist-demo.md`, préparation après la remise à zéro | Q, F (chemin) | identifiant du bordereau, document resté en attente, chemin cliqué, capture du badge |

## 6. Décisions de O du 17/11 (sur la première version de ce § 6)

1. **Ordre du rangement** : on montre ce qui existe, la catégorie (domaine, activité) puis l'année (`space_path_builder.py`, `Vérifié`). Pas de « Ranger sur mon poste ». Phrase prête au § 1, étape 2.
2. **`unit_admin` en recherche et en liste** : il voit tout l'établissement (`documents.py` l. 90-91, `ADMIN_ROLES`), alors que #188 le limite dans les rapports. Rien ne change pour la rc.1 (trop large avant le gel) ; issue #195 après la rc.1, présentée au PO par O. Aucun profil admin d'unité dans la démo (§ 3).
3. **Menu admin « Recherche »** : corrigé par #198, présent dans b701314 ; contrôle en recette (§ 5 n° 17, Q).
4. **Circuit de validation** : montré seulement sur demande ; un document en attente est préparé (§ 1 bis, § 5 n° 18).

## 7. Contrôle sur b701314 (17/11) : écarts corrigés

Demande de O du 17/11. Chaque ligne cite le texte de la version c216141 (numéro de ligne de cette version), la preuve dans le code de b701314 et la correction portée au § 1, ou le plan B. Aucune étape ne suppose une fonction post-rc1.

| # | Étape | Texte de la version c216141 | Constat sur b701314 | Correction ou plan B |
|---|---|---|---|---|
| 1 | Postes | l. 12 : « une fenêtre **A** (`MINFI002`, collaborateur DAF), connectée en direct » | les étapes 1, 2 et 4 sont refusées à un collaborateur (lignes 2 à 4 ci-dessous) | A = `MINFI001` (admin) en direct ; B = `MINFI001` préconnectée, en secours. `MINFI002` n'est plus utilisé (§ 3) |
| 2 | 1. Import | l. 18 : « menu « Ranger / Importer » (`/ingestion`) → « Importer dans le Serveur de l'Application » » | l'assistant complet est réservé au super admin et à l'admin d'institution (`DirectoryIngestion.tsx` l. 1046) ; les autres profils voient « Verrouillé pour votre profil — sera ouvert pour lancer un circuit. » | fait dans A (admin) par le menu « Import en masse », avec les libellés exacts des étapes de l'assistant |
| 3 | 2. Rangement | l. 19 : « A | explorateur des documents (libellé et route `À vérifier`) » ; filtre par année `À vérifier` | « Explorateur documentaire » (`/spaces`) n'est que dans le menu admin ; filtre « Toutes les années » présent (`SpacesPage.tsx` l. 762) | fait dans A (admin) ; filtre `Vérifié`. **E24** : statut « A verifier » sans accent (`SpacesPage.tsx` l. 39) |
| 4 | 4. Bannette | l. 21 : « A | « Ma bannette » (`/classification-reviews`) » | le droit `classification_reviews` n'existe que pour super admin, admin d'institution et admin d'unité (`policy.csv` l. 40, 60, 73) : un collaborateur reçoit un refus | fait dans A (admin) ; bouton exact « Classer et relancer » |
| 5 | 5. Recherche | l. 22 : « même mot-clé dans A (DAF) puis C (lecteur DSI) » | un collaborateur ne trouve que ses propres documents ; manager et lecteur voient leur unité (`search.py` l. 50-55) ; sur la page d'arrivée du lecteur (« Mes Documents »), la barre du bandeau filtre la page au lieu de chercher | comparaison E (manager DAF) contre C (lecteur DSI) ; C clique d'abord « Tableau de Bord » |
| 6 | 5. Recherche | l. 22 : « le menu de C est réduit (pas d'import d'administration, pas de rapports) » | le menu du lecteur garde « Ranger / Importer » (vue verrouillée) ; il n'a ni « Rapports », ni « Plan de classement », ni « Import en masse » | phrase remplacée par la liste des trois entrées absentes |
| 7 | 6. Historique | l. 23 : « onglet historique » | onglet « Historique des Versions » (`DocumentDetailModal.tsx` l. 166) | libellé exact ; document ouvert dans A |
| 8 | 6. Historique | l. 23 : « D : « Audit & Traçabilité » (`/audit`), filtre `MINFI002` + aujourd'hui » | **E25** : pas d'entrée « Audit » dans le menu de l'auditeur ; il arrive sur « Registre Des Actions ». Les filtres sont ceux des colonnes (registre, action, auteur) ; il n'y a pas de filtre de date ; la colonne « Effectuée par » affiche le nom, pas l'identifiant (`AuditLogs.tsx` l. 18-20, l. 164-177) | D reste sur sa page d'arrivée ; filtre de la colonne « Effectuée par » sur le nom de `MINFI001` ; plan B au § 4 si D quitte la page |
| 9 | 7. Rapports | l. 24 : « « Rapports » (`/reports`) : Synthèse, puis Services » | le manager n'a pas l'onglet « Synthèse » (`ReportsPage.tsx` l. 62, l. 75-76) | « Traitement & délais », puis « Services » |
| 10 | 1 bis | l. 35 : « viser ou rejeter avec motif » | la page « Tâches & Validations » propose « Valider » et « Rejeter » (`WorkflowTasks.tsx` l. 53, 99, 106) | « Valider », ou « Rejeter » puis « Confirmer le rejet » |
| 11 | § 4 | l. 70 : risque du menu admin « Recherche » | #198 est dans b701314 | ligne retirée, remplacée par une phrase sous le tableau |
| 12 | Minutage | l. 8 et l. 28 : parcours de 20:00, questions comprises, sans marge | demande de O : 18:00 au plus, 2:00 de marge | durées par étape au § 1 ; direct de 11:45 au lieu de 14:30 |

Écarts de recette E23 à E25 :

- **E23** (« Gérer les Permissions » sans action, tableau de bord de l'admin d'unité) : aucune étape touchée, car il n'y a pas de profil admin d'unité dans la démo.
- **E24** (accents) : étape 2, statut « A verifier » dans l'« Explorateur documentaire ». « Parametres » (menu du super admin) n'apparaît pas, car `SUPER001` n'est pas utilisé.
- **E25** (menu de l'auditeur) : corrigé par #233, dans la rc.1 (réponse du PO du 17/11, question 7). Étape 6 mise à jour le 17/11 : D passe par son menu « Audit ». Le plan B du § 4 est retiré.

Si le PO fait corriger E24 ou E25 sur la release, appliquer la version « corrigé » ci-dessous (question Q6 de O au PO), après avoir relu le libellé dans le code de `release/v1.0.0`.

| Écart | Ligne | Version actuelle (non corrigé) | Version si corrigé sur la release |
|---|---|---|---|
| E25 | § 1, étape 6, « Ce que l'on fait » | « … puis D, qui arrive sur la page « Registre Des Actions » (`/audit`) : filtre de la colonne « Effectuée par » sur l'administrateur → « Exporter (CSV) ». **E25** : D n'a pas d'entrée « Audit » dans son menu ; ne pas quitter la page » | « … puis D : menu « ‹libellé relevé› » (`/audit`), page « Registre Des Actions » : filtre de la colonne « Effectuée par » sur l'administrateur → « Exporter (CSV) » » |
| E25 | § 4, ligne « L'auditeur quitte sa page d'arrivée » | plan B : cliquer « Tableau de Bord » | ligne supprimée |
| E24 | § 1, étape 2, « Ce que le jury doit voir » | « … **E24** : le statut s'affiche « A verifier », sans accent » | fin de phrase supprimée |
| E24 | § 4, ligne « Le jury remarque « A verifier » » | « Écart connu, noté en recette. » | ligne supprimée |

## 8. Recoupement avec le contenu réel de la rc.1 (17/11)

Demande de O du 17/11. La rc.1, c'est `main` au moment de la coupe : 53d4c40, plus #104 (documentation seule). Depuis b701314 (§ 7), seuls #217 (documentation) et #223 sont arrivés. #223 ne touche que l'attribution des rôles (`users.py`), et aucune étape ne s'en sert.

Fonctions absentes de la rc.1 :
- application d'authentification (#193, #219) ;
- envoi du code par e-mail et renvoi (#154) ;
- écran « Corbeille » (#181, #211, #184) ;
- vue « Doublons » (#171, #199) ;
- favoris et récents (#165) ;
- rapports officiels (#180, #197, #209).

| Étape | Appui sur une fonction absente | Décision |
|---|---|---|
| Connexion (§ 1), phrase de la parade (§ 4) | la phrase disait « en service, il part par un canal séparé » ; la rc.1 n'a pas de canal d'envoi (#154) | **remplacée** : « son envoi par e-mail arrive dans la version suivante » |
| 5. Recherche et droits | aucun : le document en corbeille vient du jeu, et la recherche de la rc.1 l'exclut (#42) ; aucun écran « Corbeille » n'est ouvert | **gardée** ; si le jury demande à voir la corbeille : « bientôt », à l'oral (#181) |
| 1 bis, vue « doublons » | déjà annoncée comme venant après la version | **gardée**, avec le « bientôt » déjà écrit |
| Questions, sécurité des comptes administrateurs | l'application d'authentification n'est pas dans la rc.1 | rien à montrer ; à l'oral, sur question : « bientôt, obligatoire pour les administrateurs » (#193, DEC-2026-004) |

Aucune étape n'est à retirer. Les étapes 1 à 4, 6 et 7 n'utilisent que des fonctions de la rc.1.

## 9. Corrections du 17/11, soir (Q sur 18a1018, demande de O)

| Point | Avant | Constat | Correction |
|---|---|---|---|
| Total après l'import en direct | 367 (16 classés, 12 à revoir), `Déduit` | `POST /documents/ingest-directory` sur `/data/ingest/live` : 28 importés, 2 doublons, aucun à revoir, accueil à **379** | Le chemin de la démo est l'assistant « Import en masse » (`/imports`), pas `ingest-directory`. Attendu : **351 + classés**, soit 379 si tout est classé. Q fige le chiffre sur ce chemin (§ 5 n° 3). Étape 4 : si l'import ne laisse rien à revoir, on prend un des 41 « à revoir » du jeu. |
| Étape 8 « Archivage » (n° 21) | « un document validé du jeu » | aucun document validé après la remise à zéro | Pendant la préparation, après la remise à zéro et avant la sauvegarde J-1 : `MGR001` vise le bordereau P8, puis l'administrateur le signe (`checklist-demo.md` § B Données). L'étape 8 reste après l'étape 7 ; elle n'attend plus rien de la séance. |
