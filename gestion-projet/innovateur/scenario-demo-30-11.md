# Scénario de la démo du 30/11 — le classement automatique, de bout en bout

- **Pour** : O (relit, présente au PO), P (présente), Q (données, captures, recette), B et F (points à vérifier). Innovateur, 2026-11-17, sur `main` c216141 (fusion de #188).
- **Périmètre** : uniquement ce qui sera dans la rc.1, c'est-à-dire `main` après #104 (notes) et #121 (version du frontend). Rien des PR post-rc1 : #159, #171 (vue doublons), #180, #183, #186 ne sont pas montrées.
- **Remplace** le § 1 de `deroule-demo.md` (10/11), écrit avant les fusions du 10 au 17/11. Les autres documents restent valables et ce scénario y renvoie : préparation des postes (`checklist-demo.md`), constitution du jeu (`jeu-donnees-demo.md`, `DOCS/exploitation/donnees-demo.md`), réponses aux questions (`plan-presentation.md` § 4).
- **Niveaux** : `Vérifié` = lu dans le code de c216141 ; `À vérifier` = à confirmer en recette (§ 5) ; `Proposé` = choix de ce scénario.

## 1. Parcours minuté (20:00 maximum)

Fil conducteur : *un service reçoit un dossier en vrac. GED237 le range tout seul, explique pourquoi, laisse à un humain ce qu'il ne sait pas classer, puis chacun ne retrouve que ce qu'il a le droit de voir, avec la trace de qui a fait quoi et les chiffres du service.*

Postes : une fenêtre **A** (`MINFI002`, collaborateur DAF), connectée en direct, et quatre profils de navigateur **préconnectés** 10 minutes avant la séance : **B** `MINFI001` (admin), **C** `READ001` (lecteur DSI), **D** `AUDIT001` (auditeur), **E** `MGR001` (manager DAF). Une seule connexion en direct, pour gagner 2 à 3 minutes d'OTP.

| Min | Étape | Fenêtre | Ce que l'on fait (`Vérifié` sauf mention) | Ce que le jury doit voir | Transition |
|---|---|---|---|---|---|
| 0:00–1:30 | **Ouverture** | — | une diapositive (§ 5 n° 19) : des dossiers partagés en vrac, des documents introuvables | le problème et la promesse en une phrase | « Entrons comme un agent de la DAF. » |
| 1:30–2:30 | **Connexion** | A | mot de passe puis code à usage unique | nom et rôle dans l'en-tête | « Ce matin, il reçoit 30 fichiers en vrac. » |
| 2:30–6:00 | **1. Import en vrac** | A | menu « Ranger / Importer » (`/ingestion`) → « Importer dans le Serveur de l'Application » → choix du dossier `live` (30 fichiers, envoi par le navigateur) → analyse → validation | la répartition avant import (classés, à revoir, **2 doublons** reconnus au contenu et ignorés), puis le compteur de fin | « Où sont-ils partis ? » |
| 6:00–8:00 | **2. Le rangement** | A | explorateur des documents (libellé et route `À vérifier`, § 5 n° 6) : DAF → domaine → activité → année ; ouvrir un document importé | l'arborescence **service > domaine > activité > année** remplie par l'import ; un fichier sans date part dans « A classer/‹année› ». Si l'on demande « et par année d'abord ? » : « On range d'abord par métier, parce que c'est ainsi qu'on cherche un dossier ; l'année est le dernier niveau, et un filtre par année existe dans chaque dossier. » (filtre : `À vérifier`, § 5 n° 6) | « Pourquoi là ? Parce qu'une règle le dit. » |
| 8:00–10:00 | **3. Les règles** | B | « Plan de classement » (`/classement`) → onglet des règles : une règle avec critère de **contenu** ou d'**année** ; onglet simulateur sur une règle inactive | la règle en clair ; la simulation montre avant/après **sans rien déplacer** | « Ce qu'aucune règle ne sait classer attend un humain. » |
| 10:00–11:00 | **4. La bannette** | A | « Ma bannette » (`/classification-reviews`) : un fichier « à revoir » de l'import, choix du domaine, de l'activité et de l'année | le fichier quitte la bannette et rejoint l'arbre | « Maintenant, retrouvons-le. » |
| 11:00–13:00 | **5. Recherche et droits** | A puis C | barre de recherche du bandeau, même mot-clé dans A (DAF) puis C (lecteur DSI) | deux listes différentes pour la même requête ; un document mis en corbeille n'apparaît pas ; le menu de C est réduit (pas d'import d'administration, pas de rapports) | « Et qui a fait quoi ? » |
| 13:00–14:30 | **6. Historique** | A puis D | fiche d'un document versionné → onglet historique ; puis D : « Audit & Traçabilité » (`/audit`), filtre `MINFI002` + aujourd'hui → « Exporter (CSV) » | les versions ; dans le journal, l'import, la revue et les consultations de la séance, dans l'ordre ; l'export, lui-même tracé | « Et pour le chef de service ? » |
| 14:30–16:30 | **7. Rapports** | E | « Rapports » (`/reports`) : Synthèse, puis Services | les chiffres **de la DAF seulement** (#175, #188) : volumes, non classés, à revoir | « Voilà ce qui marche. Voici ce qui manque. » |
| 16:30–17:30 | **Ce qui manque** | — | une phrase par écart, avec sa date ou son appui (§ 1 bis) | — | « Vos questions. » |
| 17:30–20:00 | **Questions** | — | `plan-presentation.md` § 4 | — | — |

Direct : 14:30 (de 1:30 à 16:30 ; ce bloc inclut la connexion). Le tampon se prend sur l'étape 1 (import plus long) puis sur l'étape 3 : simulation seule, en 1:00. Si l'horloge dépasse 12:00 à la fin de l'étape 5, l'étape 6 se réduit au journal d'audit, sans export.

### 1 bis. Ce qui manque, dit au bloc 16:30 (taux CDC du relevé du 19, sur #104)

- **Mesure de charge** (100 000 fichiers en moins de 20 min, item 8) : non mesurée ; décision PO du 17/11, mesure après le 24/11.
- **Vue « doublons »** (item 19) : les doublons sont refusés à l'import et comptés au tableau de bord ; la vue de choix arrive après la version.
- **HTTPS, installation sur site, disponibilité** (items 27, 28, 29) : dire l'état constaté au compte rendu du 20/11, pas avant.
- **Circuit de validation** : présent dans la rc.1 mais hors de ce fil conducteur ; montré **seulement si le jury le demande** (décision O du 17/11). Un document est déjà en attente de visa chez `MGR001` (§ 5 n° 18) : fenêtre E, tâches en attente, viser ou rejeter avec motif (1:00, pris sur les questions ; déroulé détaillé : `deroule-demo.md` P8).

## 2. Jeu de données de démo

- **Provenance** : entièrement **synthétique**, aucune donnée réelle. Généré par `backend/scripts/demo_dataset.py` avec une graine fixe (`GED_EXPORT_SEED=237`) : PDF, images et fichiers bureautiques fabriqués, noms et contenus fictifs (`Vérifié`).
- **Volume** (`frontend/e2e/data/demo-manifest.json`, section `expected`, `Vérifié`) : **408 documents** (357 classés, 51 à revoir), répartis en DRH 154, DAF 157, DSI 87 et MINESUP-DAAJ 10 (étanchéité entre établissements). S'y ajoutent 12 doublons refusés, 8 documents en corbeille, 5 documents versionnés, 4 imports, et **30 fichiers réservés au direct** (dossier `live`, non chargés). L'étape P8 en ajoute 2.
- **Commandes** (`DOCS/exploitation/donnees-demo.md`) : génération `bash scripts/demo-dataset.sh` ; remise à zéro `E2E_MANIFEST=/e2e-data/demo-manifest.json sh scripts/e2e_reset.sh demo` dans le conteneur `api` de la pile e2e. `seed_demo.py` purge, pose les règles, importe et **échoue si un compte diffère** du manifeste. Redis doit répondre.
- **Pour le direct** : l'import passe par le navigateur, donc le dossier `live` doit être **copié sur le disque du poste de démo** (et du poste de secours) à un chemin court et connu. Durée de la remise à zéro : inconnue, à mesurer (§ 5 n° 1).

## 3. Comptes et rôles à préparer

Comptes du seed (`backend/scripts/seed_db.py`, `Vérifié`). **Aucun mot de passe dans ce document** : ils restent dans le coffre du poste et ne s'affichent jamais à l'écran. Ne pas utiliser les boutons de profils préremplis de l'écran de connexion.

| Identifiant | Rôle | Unité | Fenêtre | Sert à |
|---|---|---|---|---|
| `MINFI002` | collaborateur | DAF | A, en direct | connexion, import, bannette, recherche, fiche document |
| `MINFI001` | admin de l'établissement | MINFI | B, préconnectée | plan de classement, simulateur ; recours pour le tableau de bord (tuile « Doublons refusés ») |
| `READ001` | lecteur | DSI | C, préconnectée | même recherche, autre résultat ; menu réduit |
| `AUDIT001` | auditeur | MINFI | D, préconnectée | journal d'audit en lecture seule, export CSV |
| `MGR001` | manager | DAF | E, préconnectée | rapports limités à la DAF |
| `UNIT001` | admin d'unité | DRH | **aucun profil admin d'unité dans la démo** (décision O du 17/11) | en recherche et en liste, il voit tout l'établissement ; suivi par l'issue #195 après la rc.1 |
| `MINESUP001`, `SUPER001` | collaborateur MINESUP, super admin | — | non utilisés | — |

## 4. Risques en direct et plan B

Règle commune (`checklist-demo.md` § C) : une tentative (F5), sinon on bascule en moins de 60 s, sinon on montre les captures. On ne redémarre jamais en séance. Les captures viennent du rapport Playwright rejoué sur le tag (onglet ouvert d'avance).

| Risque | Signe | Plan B |
|---|---|---|
| Code à usage unique refusé ou trop de tentatives | message d'erreur, attente imposée | passer sur B, déjà connectée, et commenter ; capture de `auth-2fa` |
| Code à usage unique affiché en clair à l'écran (canal `dev_response` de la pile de démo, signalé par O le 17/11) | le code apparaît sur l'écran projeté pendant la connexion de A | parade retenue selon le § 5 n° 14 : (a) la connexion de A se fait avant la séance, comme B à E, et l'étape « Connexion » montre l'écran de connexion **sans le valider** (0:30 gagnées) ; ou (b) projecteur en mode « étendre », connexion saisie sur l'écran non projeté, puis bascule. Phrase si le jury le voit : « Sur la pile de démonstration, le code s'affiche pour le test ; en service, il part par un canal séparé. » (`À vérifier` : canal réel, § 5 n° 14) |
| Session expirée sur une fenêtre préconnectée | retour à l'écran de connexion | reconnexion du compte concerné (≈ 40 s) ; si deux expirent, captures pour les étapes restantes |
| Import long ou en erreur | analyse qui ne finit pas, erreur | importer un sous-dossier de 5 fichiers préparé (dont 1 doublon) ; sinon capture de `directory-import` |
| Répartition différente de celle annoncée | autres nombres de classés, à revoir ou doublons | lire les nombres affichés sans les commenter ; la répétition fige les chiffres attendus (§ 5 n° 3) |
| Bannette vide (tout est classé) | liste vide | ouvrir un des 51 « à revoir » du jeu |
| Mauvais clic sur le menu admin « Recherche » | page introuvable sur c216141 (`Vérifié`) ; correctif de F en rc.1 attendu avant le 19 à 12:00 (décision O du 17/11) | la recherche passe de toute façon par la barre du bandeau ; si le correctif n'est pas fusionné, ne jamais cliquer ce menu |
| Rapports vides ou erreur côté manager | aucun chiffre, refus | montrer la même page dans B (admin, tout l'établissement), en disant que le manager ne voit que la DAF |
| Journal filtré vide | aucune ligne | retirer le filtre d'agent, garder la journée |
| Pile Docker ou poste en panne | plus de réponse | poste de secours prêt, avec la même pile et le même jeu (`checklist-demo.md` § B) ; sinon captures pour tout le reste |
| Données modifiées par la répétition | import du direct déjà fait, bannette déjà vidée | remise à zéro la veille et après chaque répétition, puis contrôle des nombres du manifeste |

## 5. À vérifier pendant la recette (20 au 23/11)

| # | Point | Qui | Preuve attendue |
|---|---|---|---|
| 1 | Durée de la remise à zéro du jeu sur le poste de démo | Q | durée notée, compatible avec J-1 |
| 2 | Le dossier `live` (30 fichiers, dont 2 doublons) est généré et copié sur les deux postes | Q | liste des fichiers |
| 3 | Répartition de l'import du direct : classés, à revoir, doublons | Q | les trois nombres, figés dans ce document par ajout daté |
| 4 | Destination de quelques fichiers de `live` dans l'arbre DAF, et un cas « A classer/‹année› » | Q | chemins notés |
| 5 | L'import d'un collaborateur range bien côté serveur et alimente sa bannette | Q | rejeu de l'étape 1 avec `MINFI002` |
| 6 | Libellé et route de l'explorateur pour un collaborateur (arbre complet visible ?) ; existence d'un filtre par année dans un dossier (sinon retirer la fin de la phrase prête de l'étape 2) | F | capture et route |
| 7 | Au moins une règle active du jeu utilise un critère de contenu ou d'année ; une règle inactive donne une simulation non vide | B | nom des règles retenues |
| 8 | Mot-clé présent dans la DAF et la DSI ; un document de la corbeille le contient ; résultats différents entre A et C | Q | mot-clé et nombres de résultats |
| 9 | Menus de `READ001` et `MGR001` conformes au § 3 | F | captures |
| 10 | Un document versionné accessible à `MINFI002`, avec son historique | Q | identifiant du document |
| 11 | Journal : lignes d'import, de revue et de consultation de `MINFI002` du jour ; l'export CSV s'ouvre dans le tableur | Q | fichier exporté |
| 12 | Rapports de `MGR001` limités à la DAF, avec signaux à la même portée (#188) | Q | capture des onglets Synthèse et Services |
| 13 | Durée de vie d'une session préconnectée (au moins 40 min, ou renouvellement automatique) | B | réglage relevé dans la configuration |
| 14 | Comment le code à usage unique arrive sur la pile de démo ; s'il s'affiche à l'écran (`dev_response`), choix de la parade (a) ou (b) du § 4 et mise à jour de l'étape « Connexion » | B (fait), O (choix) | mode décrit, sans secret ; parade notée par ajout daté |
| 15 | Deux répétitions chronométrées (dont le 27/11), écarts reportés ici par ajout daté | O | chronos |
| 16 | Captures de secours régénérées sur le tag `v1.0.0-rc.1` | Q | rapport Playwright du tag |
| 17 | Chaque entrée du menu admin (`MINFI001`) ouvre une page, aucune « page introuvable » (correctif de F du menu « Recherche ») | Q | liste des entrées cliquées, avec la route |
| 18 | Un document de la DAF est en attente de visa chez `MGR001` après la remise à zéro (jeu P8), et le visa comme le rejet motivé fonctionnent | Q | identifiant du document, capture de la tâche en attente |
| 19 | Diapositive d'ouverture (le problème des dossiers en vrac, la promesse en une phrase) | O la fournit, P la valide | fichier de la diapositive, validation de P |

## 6. Décisions de O du 17/11 (sur la première version de ce § 6)

1. **Ordre du rangement** : on montre ce qui existe, la catégorie (domaine, activité) puis l'année (`space_path_builder.py`, `Vérifié`). Pas de « Ranger sur mon poste ». Phrase prête au § 1, étape 2.
2. **`unit_admin` en recherche et en liste** : il voit tout l'établissement (`documents.py` l. 90-91, `ADMIN_ROLES`), alors que #188 le limite dans les rapports. Rien ne change pour la rc.1 (trop large avant le gel) ; issue #195 après la rc.1, présentée au PO par O. Aucun profil admin d'unité dans la démo (§ 3).
3. **Menu admin « Recherche »** : F le corrige en rc.1, limite le 19 à 12:00 ; contrôle en recette (§ 5 n° 17, Q).
4. **Circuit de validation** : montré seulement sur demande ; un document en attente est préparé (§ 1 bis, § 5 n° 18).
