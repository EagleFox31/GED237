# Scénario de la démo du 30/11 — le classement automatique, de bout en bout

- **Pour** : O (relit, présente au PO), P (présente), Q (données, captures, recette), B et F (points à vérifier). Innovateur, 2026-11-17. Première version sur `main` c216141 ; **contrôlé ligne à ligne sur b701314** le 17/11 (§ 7).
- **Périmètre** : uniquement ce qui sera dans la rc.1, c'est-à-dire b701314 plus #104 (documentation seule). Rien des PR post-rc1 : pas de code par e-mail ni de renvoi du code (#154), pas d'application d'authentification (#193), pas de vue « Doublons » (#171, #199), pas d'écran « Corbeille » (#181), pas de sélection multiple (#211), pas de favoris ni de récents (#165), pas de rapports officiels (#180, #197, #209).
- **Exception du 18/11 (demande de O)** : les accueils par rôle corrigés par #334 (correctif V1.0, branche `fix/v10-role-home-dead-controls`, ouverte) sont intégrés au parcours (§ 1 étape 5, § 1 bis, § 11). Ils ne valent que si #334 est dans le tag : sinon, on revient au texte d'avant, gardé en § 11.4.
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
| 7:45–8:45 | 1:00 | **4. La bannette** | A | « Ma bannette » (`/classification-reviews`, page « Revue de classement ») : un des 12 fichiers « à revoir » laissés par l'import du direct (§ 5 n° 3), **pas un bordereau P8** (§ 10) ; « Domaine », « Activité », « Année », puis « Classer et relancer » | le fichier quitte la bannette et rejoint l'arbre | « Maintenant, retrouvons-le. » |
| 8:45–10:15 | 1:30 | **5. Recherche et droits** | E puis C | dans E (arrivée sur « Tâches & Validations »), barre de recherche du bandeau : « courrier » ; dans C, cliquer d'abord « Tableau de Bord » (sa bibliothèque), puis le même mot-clé ; puis, dans la bibliothèque, **cliquer une carte : la fiche du document s'ouvre en lecture** (#334, `À vérifier`, § 5 n° 23). « courrier » est le seul nom de famille de documents présent à la fois à la DAF et à la DSI (`demo_dataset.py`, famille « courrier » : DAF 20, DSI 18, dont environ un sur quatre porte le mot) ; nombres de résultats `À vérifier` par Q (§ 5 n° 8). « facture » ne convient pas : 20 résultats pour E, 0 pour C (#256, écart 10) | deux listes différentes pour la même requête : DAF pour E, DSI pour C ; un document mis en corbeille n'apparaît pas ; le menu de C n'a ni « Rapports », ni « Plan de classement », ni « Import en masse », ni (avec #334) « Ranger / Importer » et « Bibliothèque locale » : **menu réduit** (§ 11) ; la fiche ouverte depuis la bibliothèque n'offre aucune modification | « Et qui a fait quoi ? » |
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
- **Circuit de validation** : présent dans la rc.1 mais hors de ce fil conducteur ; montré **seulement si le jury le demande** (décision O du 17/11). Un document est déjà en attente chez `MGR001` (§ 5 n° 18) : fenêtre E, page « Tâches & Validations », **« Voir le document » d'abord** (la fiche s'ouvre), puis « Valider », ou « Rejeter » : la boîte « Rejeter le document » **exige un motif**, « Confirmer le rejet » reste grisé tant que le champ est vide (#334, `À vérifier`, § 5 n° 23) (1:00, pris sur les questions ; déroulé détaillé : `deroule-demo.md` P8).

## 2. Jeu de données de démo

- **Provenance** : entièrement **synthétique**, aucune donnée réelle. Généré par `backend/scripts/demo_dataset.py` avec une graine fixe (`GED_EXPORT_SEED=237`) : PDF, images et fichiers bureautiques fabriqués, noms et contenus fictifs (`Vérifié`).
- **Volume** (`frontend/e2e/data/demo-manifest.json`, section `expected`, `Vérifié`) : **408 fichiers** reçus, répartis en DRH 154, DAF 157, DSI 87 et MINESUP-DAAJ 10 (étanchéité entre établissements). Ce sont des fichiers, pas des documents : 357 deviennent des documents classés, et 51 restent des revues ouvertes (41 MINFI, 10 MINESUP ; les 10 de MINESUP sont tous à revoir, faute de règle, ce qui montre le cloisonnement). S'y ajoutent 12 doublons refusés, 8 documents en corbeille, 5 documents versionnés, 4 imports, et **30 fichiers réservés au direct** (dossier `live`, non chargés). L'étape P8 en ajoute 2.
- **Total affiché à l'accueil de `MINFI001`** (B, 17/11, détail dans `DOCS/exploitation/donnees-demo.md`) : **351 documents** après la remise à zéro (357 classés, moins 8 en corbeille, plus 2 de P8), puis **351 + le nombre de fichiers classés par l'import en direct** (étape 1 : 28 nouveaux fichiers, plus 2 doublons refusés). Les fichiers « à revoir » ne comptent pas : ils deviennent des revues, pas des documents (`import_execution_service.py`, `Vérifié`). **Total attendu : 367** (351 + 16 classés), mesuré par Q le 17/11 au soir sur 18a1018 par le chemin de la démo : assistant « Import en masse » (`/imports`), « Juste les ranger », service MINFI-DAF. Analyse : 16 classés, 12 à revoir, 2 doublons. Exécution : 16 importés, 12 revues, 0 échec (`Vérifié`). Le chiffre de 379 venait de `POST /documents/ingest-directory`, qui n'est pas le chemin de la démo (§ 10). Ces chiffres valent une fois la PR #260 fusionnée.
- **Commandes** (`DOCS/exploitation/donnees-demo.md`) : génération `bash scripts/demo-dataset.sh` ; remise à zéro `sh scripts/e2e_reset.sh demo` (`E2E_MANIFEST` pointe sur `demo-manifest.json`) dans le conteneur `api` de la pile complète (`docker-compose.yml`), avec le corpus et les manifestes fournis comme indiqué dans `donnees-demo.md` (étape 2). `seed_demo.py` purge, pose les règles, importe et **échoue si un compte diffère** du manifeste. Redis doit répondre. La pile de démo part de volumes vides (`docker compose down -v` avant le premier `up`) : sur une base déjà initialisée, le seed ne repasse pas, et les noms accentués des unités n'apparaissent pas (B, 17/11).
- **Pour le direct** : l'import passe par le navigateur, donc le dossier `live` doit être **copié sur le disque du poste de démo** (et du poste de secours) à un chemin court et connu. Durée de la remise à zéro : inconnue, à mesurer (§ 5 n° 1).

## 3. Comptes et rôles à préparer

Comptes du seed (`backend/scripts/seed_db.py`, `Vérifié` sur b701314 : identifiant, rôle et unité). **Aucun mot de passe dans ce document** : ils restent dans le coffre du poste et ne s'affichent jamais à l'écran. Ne pas utiliser les boutons de profils préremplis de l'écran de connexion.

| Identifiant | Rôle | Unité | Fenêtre | Sert à |
|---|---|---|---|---|
| `MINFI001` | admin de l'établissement | MINFI | A, en direct ; B, préconnectée (secours) | connexion, import, explorateur, plan de classement, simulateur, bannette, fiche document ; tableau de bord (tuile « Doublons refusés ») |
| `READ001` | lecteur | DSI | C, préconnectée | même recherche, autre résultat ; ouverture d'un document depuis sa bibliothèque ; menu réduit (§ 11) |
| `AUDIT001` | auditeur | MINFI | D, préconnectée | journal d'audit en lecture seule, export CSV |
| `MGR001` | manager | DAF | E, préconnectée | recherche limitée à la DAF ; rapports limités à la DAF ; circuit de validation sur demande |
| `MINFI002` | collaborateur | DAF | **non utilisé** dans le fil ; F, préconnectée, **sur question** (§ 11, avec #334) | son import est verrouillé, la bannette lui est refusée et sa recherche ne montre que ses propres documents (§ 7) : preuve du cloisonnement, à citer si le jury demande ce que voit un agent |
| `UNIT001` | admin d'unité | DRH | **aucun profil admin d'unité dans le fil** (décision O du 17/11) ; G, préconnectée, **sur question** pour ses compteurs (§ 11, demande de O du 18/11) | voit son unité et les unités en dessous, partout : listes, recherche, document ouvert par son id, compteurs du tableau de bord (V1.0, #203 et correctif de B, décision O du 18/11). Ses compteurs sont donc ceux de la DRH, pas de l'établissement |
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
| Bannette vide (tout est classé) | liste vide | ouvrir un des « à revoir » MINFI du jeu, sauf les 2 bordereaux P8 (§ 10) |
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
| 3 | Répartition de l'import du direct **par l'assistant « Import en masse »** (pas par `ingest-directory`) : classés, à revoir, doublons, et le total de l'accueil qui en découle (351 + classés) ; si aucun fichier n'est à revoir, identifiant d'un des 41 « à revoir » MINFI du jeu pour l'étape 4 ; **durée** de « Vérifier le classement » puis de l'import (budget de l'étape 1 : 3:00) | Q | **nombres relevés le 17/11 au soir** (16, 12, 2 ; accueil à 367 ; § 10) ; **durées mesurées dans l'écran le 18/11** : moins de 1 s au total (§ 10) |
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
| 18 | Un document de la DAF est en attente chez `MGR001` après la remise à zéro (jeu P8), et la validation comme le rejet motivé fonctionnent | Q | **vérifié le 17/11** : 2 tâches chez `MGR001` après la remise à zéro (les 2 bordereaux P8), 1 après le visa de préparation (« à rejeter »). **Ne pas la consommer avant la séance.** |
| 19 | Diapositive d'ouverture (le problème des dossiers en vrac, la promesse en une phrase) | O la fournit, P la valide | fichier de la diapositive, validation de P |
| 20 | Deux sessions simultanées de `MINFI001` (A en direct, B préconnectée) restent ouvertes toutes les deux | Q | constat noté |
| 21 | *(si #256 écart 9 est corrigé avant la coupe)* Le jeu ne contient **aucun** document validé après la remise à zéro (Q, 17/11). Pendant la préparation, après la remise à zéro : `MGR001` vise le bordereau P8, puis l'administrateur le signe. Vérifier qu'un autre document reste en attente chez `MGR001` pour le n° 18, sinon le circuit ne se montre plus sur question. Puis chemin de A jusqu'au bouton « Archiver » : l'archivage passe et le filtre « Archivé » le retrouve. À ajouter à `checklist-demo.md`, préparation après la remise à zéro | Q, F (chemin) | identifiant du bordereau, document resté en attente, chemin cliqué, capture du badge |
| 22 | #334 est fusionnée et dans le tag ; sinon le § 11.4 s'applique | O | numéro du commit du tag qui contient #334 |
| 23 | Les quatre accueils du § 11 sur la pile de démo : la carte de la bibliothèque de `READ001` ouvre la fiche ; « Nouveau Document » de `MINFI002` ouvre la modale standard et l'envoi réussit ; « Voir le document » de `MGR001` ouvre la fiche, et un rejet sans motif est impossible ; les compteurs de `UNIT001` ouvrent leur page. **Ne pas consommer la tâche du n° 18** : rejet testé jusqu'au bouton grisé, puis « Annuler » | Q | captures ; e2e `role-home-controls.spec.ts` vert sur le tag |
| 24 | **Menu réduit pour reader et collab** : ni « Ranger / Importer » ni « Bibliothèque locale » dans le menu de `READ001` et de `MINFI002`, et les adresses `/ingestion` et `/local-library` tapées à la main sont refusées | F | captures des deux menus, refus par adresse |

## 6. Décisions de O du 17/11 (sur la première version de ce § 6)

1. **Ordre du rangement** : on montre ce qui existe, la catégorie (domaine, activité) puis l'année (`space_path_builder.py`, `Vérifié`). Pas de « Ranger sur mon poste ». Phrase prête au § 1, étape 2.
2. **`unit_admin` en recherche et en liste** : sur main avant la V1.0, il voyait tout l'établissement (`documents.py`, `ADMIN_ROLES`). Décision O du 18/11 : passe en V1.0. Il est limité à son unité et ses sous-unités partout : listes, recherche, document ouvert par son id (#203), puis compteurs, circuits, file de classement et imports (correctif de B), puis utilisateurs (lot de B). **Aucun effet sur le fil** : `MGR001` est *manager*, déjà limité à la DAF ; `READ001` est lecteur, déjà limité à la DSI ; les nombres « courrier » et les rapports du manager restent identiques. Seul `UNIT001` (G, sur question) change : ses compteurs deviennent ceux de la DRH.
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

## 10. Mesures de Q du 17/11, soir, par le chemin de la démo (main 18a1018)

Chemin : `/imports`, « Juste les ranger », service MINFI-DAF, dossier `live` de 30 fichiers, sur une pile de démo isolée.

| Point | Mesure | Conséquence |
|---|---|---|
| Import du direct (§ 5 n° 3) | Analyse : 16 classés, 12 à revoir, 2 doublons. Exécution : 16 importés, 12 revues, 0 échec. Accueil de `MINFI001` : 351 → **367**. | L'ancien 367 était juste pour ce chemin. Le 379 du § 9 venait de `ingest-directory` : il est retiré. Mêmes nombres dans l'écran le 18/11 (durées ci-dessous). |
| Revues ouvertes | 43 → 55. Avant l'import, il y en a 43, pas 41 : les 2 bordereaux P8 (à viser, à rejeter) ne trouvent aucune règle de classement et ont chacun une revue « à revoir ». | À l'étape 4, on ouvre un des 12 fichiers de l'import, jamais un bordereau. Il n'y a pas de plan B à prévoir pour une bannette vide : l'import laisse toujours 12 fichiers à revoir. |
| Identifiant d'une revue « à revoir » | Il change à chaque remise à zéro. | Q le relève à J-1, après la remise à zéro et l'import de répétition. |
| Circuit (§ 5 n° 18) | `MGR001` a 2 tâches après la remise à zéro, puis 1 après le visa de préparation (« à rejeter »). | Le circuit se montre sur question. **Ne pas consommer cette tâche avant la séance.** |
| Recherche (fiche UAT, geste 7) | 45 requêtes (3 termes, pour `MINFI001`, `MGR001` et `READ001`, 5 fois chacune). p95 de 20 ms, maximum de 24 ms. | Très en dessous des 2 s exigées. Couvert. |

**Bordereaux P8 dans la bannette (décision de O, 17/11)** : on ne change pas le jeu P8 avant le tag. Les bordereaux arrivent par le circuit de validation, pas par une règle de classement ; leur présence parmi les « à revoir » est donc cohérente. La bannette compte 43 revues avant l'import, 55 après. À l'étape 4, le présentateur évite les 2 bordereaux et ouvre un des 12 fichiers de l'import. La surcouche P8 qui les classerait d'office passe en V1.2 (élément 17 de `plan-v1.2.md`, B 0,25 h-s).

**Durées (Q, 17/11, sur la pile de test)** : l'analyse des 30 fichiers par l'API (`/imports/analyze`) prend 0,3 s, et l'import répond sans délai perceptible. Ces temps ne comptent ni l'envoi des fichiers depuis le navigateur ni les clics : les 3:00 de l'étape 1 dépendent surtout des gestes à l'écran. Q mesurera l'analyse et l'import de bout en bout, dans l'écran, sur sa prochaine pile de démo (après l'OCR de B).

**Durées dans l'écran (Q, 18/11, `Mesuré`)** : pile isolée sur `main` 2f15b6e, page « Import en masse », `MINFI001`, « Juste les ranger », service DAF, dossier `live` de 30 fichiers. Deux passages, avec une remise à zéro avant chacun.

| Mesure | 1er passage | 2e passage |
|---|---|---|
| Analyse : du clic à la réponse du serveur, puis à l'affichage | 441 ms, puis 538 ms | 411 ms, puis 476 ms |
| Import : du clic à la réponse du serveur, puis à l'affichage | 249 ms, puis 306 ms | 187 ms, puis 251 ms |
| Total, de « Vérifier le classement » au compte rendu affiché | 904 ms | 790 ms |

- Compteurs identiques sur les deux passages : après l'analyse, 16 prêts, 12 à revoir, 2 ignorés ou déjà présents ; après l'import, Importés 16, À arbitrer 12, Doublons 2, Erreurs 0 ; accueil de 351 à 367.
- L'analyse prend 0,4 à 0,45 s au lieu de 0,3 s par l'API, car le navigateur envoie lui-même les 30 fichiers. L'affichage ajoute 60 à 100 ms.
- Limites de la mesure : navigateur sans fenêtre, page servie en mode développement (pas la version compilée), serveur sur le même poste. Un serveur distant ajoute le temps d'envoi des 30 fichiers par le réseau (`Déduit`). La répétition sur le poste de démo le confirmera.
- **Version compilée (F, 18/11, contrôlé par Q, `Mesuré`)** : même SHA et même lot, page de production servie par `vite preview`. Deux passages :

  | Mesure | 1er passage | 2e passage |
  |---|---|---|
  | Analyse, du clic à la réponse | 440 ms | 602 ms |
  | Import, du clic à la réponse | 253 ms | 176 ms |
  | Total, du clic sur l'analyse aux cartes finales | 807 ms | 884 ms |

  Mêmes compteurs (16, 12, 2, 0 erreur ; accueil de 351 à 367). La version compilée ne change pas sensiblement les temps, qui dépendent surtout du serveur. L'affichage ne prend que 17 à 26 ms après la réponse. Avec 2 passages par mode, l'écart de 411 à 602 ms sur l'analyse est du bruit de mesure. **La réserve sur le mode développement est levée.** Reste à confirmer à la répétition : le temps d'envoi avec le serveur sur une autre machine.
- **Conséquence pour l'étape 1 (`Déduit`)** : l'attente machine est inférieure à 1 s sur les 3:00 prévues. Le temps passe dans les clics, le choix du dossier et la phrase du narrateur. Le budget de 3:00 est tenu avec de la marge ; le repli « si l'import dépasse 4:00 » (§ 1) ne sert qu'en cas de panne ou de réseau lent.

## 11. Accueils par rôle corrigés par #334 (18/11, demande de O)

Source : PR #334 (`fix/v10-role-home-dead-controls`, ouverte, commits 0a9655f, bdfb13d, fce5c2b). Les libellés ci-dessous sont lus dans le code de la branche. Ils restent `À vérifier` en recette (§ 5 n° 22 à 24) tant que #334 n'est ni fusionnée ni dans le tag.

### 11.1 Le parcours par rôle

| Rôle | Fenêtre | Ce que l'on fait | Ce que le jury doit voir | Quand |
|---|---|---|---|---|
| Lecteur (`READ001`) | C | « Tableau de Bord » (sa bibliothèque) : cliquer une carte | la fiche du document s'ouvre, en lecture seule | dans le fil, étape 5 |
| Collaborateur (`MINFI002`) | F | « Tableau de Bord » (son atelier) → « Nouveau Document » | la modale standard « Nouveau Document », la même que pour les autres profils, avec ses deux modes : ranger seulement, sans circuit ; ou circuit lancé si une règle d'aiguillage correspond. Le choix du valideur est conservé. Les cartes de brouillon ouvrent leur fiche. Aucune boîte native du navigateur | sur question, 0:45 pris sur les questions |
| Manager, le chef (`MGR001`) | E | « Tâches & Validations » → « Voir le document », puis « Valider » ou « Rejeter » | il lit le document avant de décider. « Rejeter le document » exige un motif (« Ce que le rédacteur doit corriger ») : « Confirmer le rejet » reste grisé sans texte | sur question (§ 1 bis) |
| Chef d'unité (`UNIT001`) | G | tableau de bord du service : cliquer le compteur « Workflows en attente » | la page des tâches s'ouvre. Les compteurs « Documents » et « Workflows en attente » sont cliquables ; les autres sont des chiffres seuls, assumés comme tels | sur question, 0:30 pris sur les questions |

### 11.2 Menu réduit pour reader et collab

- Le lecteur et le collaborateur n'ont plus « Ranger / Importer » ni « Bibliothèque locale » dans leur menu.
- Les adresses `/ingestion` et `/local-library`, tapées à la main, leur sont aussi refusées (fce5c2b).
- Les autres profils gardent ces entrées. Côté serveur, rien ne change : le menu reflète les droits, il ne les décide pas.
- Phrase pour le jury : « Chacun n'a dans son menu que ce qu'il a le droit de faire. »

### 11.3 Précautions

- **Compteur « Documents » du chef d'unité** :
  - tant que #203 n'est pas fusionnée, la liste qu'il ouvre montre tout l'établissement (§ 6, décision 2 ; issue #195) ;
  - en démo, on ne clique donc que « Workflows en attente » ;
  - si le jury clique « Documents », on le dit : « la limite au service arrive avec la version suivante ».
- **Deux fenêtres préconnectées de plus** (F et G) :
  - même durée de vie de session que les autres (§ 5 n° 13) ;
  - à ajouter à `checklist-demo.md` si #334 entre dans le tag.
- **Tâche du n° 18** : le rejet se montre jusqu'au bouton grisé, puis « Annuler », pour garder la tâche de `MGR001`.

### 11.4 Sans #334 dans le tag (texte d'avant, à rétablir)

- Étape 5 : C clique « Tableau de Bord » puis cherche, sans ouvrir de carte. Le menu de C garde « Ranger / Importer », en vue verrouillée.
- § 1 bis : « Valider », ou « Rejeter » puis « Confirmer le rejet » avec un motif.
- `MINFI002` et `UNIT001` ne sont pas utilisés ; les fenêtres F et G ne sont pas préparées.

## 12. Photo de document → recherche plein texte (OCR, demande de O du 18/11)

Contexte (B, V1.0) : photos, captures et formulaires passent par RapidOCR v5 latin (image ramenée à 2000 px) ; les scans passent par Tesseract ; si RapidOCR échoue, Tesseract prend le relais. Mesures du banc de Q (18/11, part des mots retrouvés) : photo réelle d'un document imprimé 0,879 ; formulaires 0,743 ; manuscrit photographié 0,01 à 0,10.

> **Mise à jour du 18/11** : RapidOCR n'est dans la rc.1 que si sa PR est verte et relue avant le 19 à 16:00. Sinon, la démo lit les photos avec Tesseract, le moteur par défaut sur `main`, avec EasyOCR en secours. Le moteur de la démo est fixé le 20 à 09:00 (fiche PO, questions 17 et 21). Pas de vote entre plusieurs moteurs (`decision-vote-ocr.md`).

### 12.1 Pile de démo et prérequis du worker

La démo tourne sur la **pile complète `docker-compose.yml`** (`docker compose up -d`, puis le seed : `DOCS/exploitation/donnees-demo.md`), et non sur `docker-compose.e2e.yml`. Le test hors ligne du 25/11 (Q) porte sur cette même pile (décision de O du 18/11).

L'OCR ne tourne pas pendant la requête. L'envoi d'un document (`POST /documents`) et l'import en masse mettent une tâche `process_document_ocr` en file Celery (`documents.py`, `imports.py`, `Vérifié` sur main). La pile complète a le service `worker` qui traite cette file. La pile e2e n'en a pas : sur elle, la fiche resterait « en cours » et la recherche ne trouverait rien.

**Prérequis, avant la séance (liste de préparation, après la remise à zéro)** :
- le worker répond : `docker compose ps worker` le montre démarré, et `docker compose exec worker celery -A app.workers.celery_app inspect ping` répond `pong`. Le service n'a pas de healthcheck dans le compose : ce contrôle en tient lieu ;
- une tâche OCR de contrôle passe : on envoie une image de contrôle (une copie de D1 sous un autre nom), la fiche passe de « en cours » à un texte lu, et la recherche `photocopieurs` la trouve ; puis on la met à la corbeille et on la **supprime définitivement**, pour que l'étape 5 bis donne bien 1 résultat. Si l'une des deux étapes échoue, l'étape 5 bis est retirée et sa minute va aux questions.

### 12.2 L'étape

- **Place** : étape **5 bis**, juste après « 5. Recherche et droits », fenêtre A. **Durée : 1:00**, prise sur les questions (3:45 → 2:45). Rien n'est pris sur la marge.
- **Envoi en avance** : les deux fichiers sont envoyés **au début de l'étape 1**, par « Nouveau Document » dans A (`À vérifier` : bouton et destination DAF pour `MINFI001`). L'OCR tourne pendant l'import et le rangement, soit environ 7 minutes de battement. Ils ne passent pas par le dossier `live` : les nombres de l'étape 1 (16 classés, 12 à revoir, 2 doublons, total 367) restent inchangés.
- **Noms de fichiers neutres** (`IMG_0412.jpg`, `IMG_0413.jpg`) : le titre du document ne contient pas le mot cherché. Si la recherche le trouve, c'est donc grâce au texte lu dans l'image, et pas au nom du fichier.

| Fichier | Contenu (fictif) | Mot à chercher | Résultat attendu |
|---|---|---|---|
| D1 `IMG_0412.jpg` : photo au téléphone d'une page imprimée | « Note de service : inventaire des photocopieurs », texte tapé, le mot dans le titre et deux fois dans le corps | `photocopieurs` | **1 résultat** : `IMG_0412.jpg` ; dans la fiche, le texte lu contient « photocopieurs » |
| D2 `IMG_0413.jpg` : photo ou capture d'un formulaire rempli **à la machine** | « Bon de commande de fournitures », un tableau avec les lignes « agrafeuses », « classeurs », « ramettes » | `agrafeuses` | **1 résultat** : `IMG_0413.jpg` |

- Les deux mots sont **sans accent** : la recherche utilise la configuration `french` de PostgreSQL, sans `unaccent` (`postgres_engine.py`, `Vérifié`). Les mots sont aussi **absents du jeu de démo** (vérifié dans `demo_dataset.py` et `demo-manifest.json` ; « onduleur » et « climatiseurs » y figurent déjà, ils sont donc écartés). Le pluriel est retrouvé par la racine française (`photocopieur` trouve aussi `photocopieurs`).
- Phrase pendant l'étape : « Une photo prise au téléphone devient un document où l'on cherche dans le texte, comme un PDF. »
- Transition : « Et qui a fait quoi ? » (inchangée, vers l'étape 6).

À mesurer pendant la recette (Q) : « Nouveau Document » disponible pour `MINFI001`, avec la destination DAF ; délai entre l'envoi et le premier résultat de recherche ; les deux recherches (1 résultat chacune) ; 0 résultat sur le compte `READ001` (DSI), ce qui illustre aussi le cloisonnement.

### 12.3 Règle : aucun manuscrit pendant la démo

- **Aucun document manuscrit** dans les fichiers de démo, ni dans le dossier `live`, ni à l'envoi en direct. Les formulaires sont **remplis à la machine**. On ne prend pas non plus de photo demandée par le public pendant la séance.
- Phrase si le public pose la question : « L'écriture à la main n'est pas encore lue de façon fiable : on la range et on la retrouve par son titre et son classement ; la lecture du manuscrit viendra dans une version suivante. »

### 12.4 Fichiers de démo (validés par O le 18/11 ; images commitées seulement après son contrôle)

| Id | Fichier | Fabrication | Contenu |
|---|---|---|---|
| D1 | `IMG_0412.jpg` | une page A4 générée, puis photo **synthétique** obtenue avec la méthode du banc de Q (fond de table, perspective, flou léger, éclairage inégal, JPEG, graine 237) ; décision de O du 18/11 | note de service fictive, unité DAF, signataire fictif |
| D2 | `IMG_0413.jpg` | un formulaire généré, rempli à la machine, puis photo synthétique de la même façon | bon de commande fictif, fournisseur fictif, montants ronds |
| D1-scan | `SCAN_0412.pdf` | la même page que D1, rendue en PDF propre à 300 dpi (plan B) | identique à D1 |

- Noms de personnes, d'entreprises, numéros et adresses : **inventés**, dans le style de `demo_dataset.py`. Aucune donnée réelle.
- **Exclus** : les photos du PO ; tout fichier personnel ; les photos de manuscrit du banc reçues par messagerie ; les pièces réelles du banc (archives publiques et formulaires FUNSD). Ces pièces servent à la mesure, pas à la démo.
- Dépôt une fois validés : `frontend/e2e/data/demo-ocr/`, à côté du jeu de démo, avec une ligne dans `DOCS/exploitation/donnees-demo.md`.

### 12.5 Plan B : RapidOCR n'est pas fusionnée au gel

- Même étape, même place, même durée, même mot (`photocopieurs`), avec **`SCAN_0412.pdf`** à la place de la photo. Tesseract lit bien un scan propre : 0,867 des mots sur la série « propre » du banc.
- **D2 est retiré** : sur les formulaires, Tesseract retrouve 0,465 des mots, contre 0,743 avec RapidOCR. La recherche « agrafeuses » n'est donc pas assez sûre pour le direct.
- Phrase : « Un document scanné devient un document où l'on cherche dans le texte, comme un PDF. » On ne dit rien de la photo au téléphone.
- Le prérequis du worker et de la tâche de contrôle (§ 12.1) s'applique aussi au plan B (contrôle avec une copie de `SCAN_0412.pdf`).
- En direct, si la recherche ne renvoie rien : on ouvre la fiche, et si l'OCR est encore « en cours », on le dit (« la lecture se fait en arrière-plan ») puis on passe à l'étape 6. Pas de nouvel essai.
