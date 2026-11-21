# Déroulé minute par minute de la séance du 30/11 (file 12)

- **Pour** : P (présente), O (clavier de secours, chrono), Q (plan B captures). Rédigé par l'innovateur le 2026-11-09 soir ; à chronométrer le 27/11 (répétition générale) et à corriger **par ajout daté**.
- **Règle de lecture** : ce déroulé **renvoie**, il ne recopie pas. Étapes détaillées d'un parcours → `parcours-demo.md` § 2 ; état et preuves → `matrice-recette.md` ; phrases d'écart et questions complètes → `plan-presentation.md` § 3-4 ; préparation des postes et conduite de séance → `checklist-demo.md` § B-C. Les comptes sont désignés par **identifiant seul** (`seed_db.py`), jamais par mot de passe.
- **Révision du 21/11 (recette rec10)** :
  - REC-06 : l'import du P2 est fait par l'administrateur `MINFI001`, car `MINFI002` n'a pas accès à `/ingestion` (`frontend/App.tsx:273`).
  - P4 : libellés de l'arbre réel ; geste du manager après les correctifs REC-04 et REC-05 accordés par le PO (§ 1 ter).
  - P2 : ré-import après REC-07 (`parcours-demo.md` P2, étape 8).
  - P7 : traces lues par agent.
  - REC-08 : le P5 commence avec `MGR001`, pas `MINFI002` (un collaborateur ne cherche que dans ses propres documents).
  - REC-09 : l'écran n'affiche pas le temps de réponse ; il se montre par le repli `GET /search` (`took_ms`).
  - REC-10 : requête de contrôle n° 10 = « lettre » (4 documents à la DAF, 8 à la DSI).
  - P4 : l'historique des versions s'ouvre par « Mes Documents », pas par « Espaces ».
- **Cadre** (plan § 1) : 20 min = ouverture 2 + **direct 13 ± 1** + écarts 2 + questions 3. Deux fenêtres de navigateur sur le poste principal : **fenêtre A** = rédacteur `MINFI002` (collaborateur DAF), connectée en direct au P1 et gardée jusqu'à la fin ; **fenêtre B** = profils qui changent (administrateur `MINFI001` → `MGR001` → `READ001` → `AUDIT001`), l'administrateur étant connecté **avant** la séance (H-5). Quatre connexions en direct au total, loin de la limite « 4 par minute » (checklist § C Pendant). *À vérifier le 27* : la session administrateur ouverte à H-5 tient-elle 20 min sans reconnexion (durée du jeton d'accès) ? sinon la connecter à H-1 min.

## 1. Chronologie

| Min | Parcours | Durée | Fenêtre / profil | Données du seed utilisées | Ce que le jury doit voir | Phrase de transition (vers la suite) |
|---|---|---|---|---|---|---|
| 0:00–2:00 | Ouverture | 2:00 | aucune (diapositive « où se situe GED237 », `sources/concurrents-ged.md` § 4) | — | le problème, la promesse, les 4 rôles (plan § 1 ligne 0–2) | « Entrons comme un agent de la DAF. » |
| 2:00–3:30 | **P1** connexion OTP | 1:30 | A — `MINFI002` | compte seed, code OTP | écran de connexion, code, nom et rôle dans l'en-tête ; **ne pas** cliquer un profil pré-rempli (écart 15 : le dire si le jury le remarque) | « Ce rédacteur reçoit une trentaine de fichiers d'un service : l'administrateur les importe pour lui. » |
| 3:30–6:00 | **P2** import + classement | 2:30 | B — administrateur `MINFI001` : `/rules`, règle seed « Factures » (`demo_rule_05` → DAF, Finances et comptabilité) **active** (10 s) ; puis, toujours en B, `/ingestion` → `/data/ingest/live`. Pas en A : le rédacteur `MINFI002` n'a pas accès à `/ingestion` (REC-06, `App.tsx:273`) | `demo-import/live/` (≈ 30 fichiers, doublons et hors règle compris, `jeu-donnees-demo.md` § 3), chemin **`/data/ingest`** (seul autorisé, spec upload § 5) | compteur d'import, documents dans l'arborescence, **doublons refusés**, « reste à classer » non nul | « Rien n'a été classé par magie : voici la règle, et ce qui se passe avant qu'on en active une. » |
| 6:00–7:30 | **P3** simulation de règle | 1:30 | B — administrateur, `/rules` | règle 10 « Rapports financiers » du seed, **inactive** : la simuler plutôt que créer (gagne 40 s) ; corpus 420 documents, 4 services | tableau avant/après, **aucun déplacement** tant que la règle est inactive | **Moment d'écart n° 1** (§ 3) puis : « Ce que la règle ne sait pas classer attend un humain. » |
| 7:30–8:30 | **P6** revue manuelle | 1:00 | B — administrateur, `/needs-review` | les « sans règle » du P2 (+ ≈ 15 documents à revoir du seed) | raison affichée, choix service/domaine/activité/année, le document quitte la liste | « Le document est à sa place ; allons le retrouver comme un chef de service. » |
| 8:30–10:00 | **P4** espaces | 1:30 | B — `MGR001` (manager DAF), `/spaces` | arbre DAF → Finances et comptabilité → Marchés publics → 2025 ; 137 documents à la DAF, dont 62 en 2025 (relevé de B, recette du 21/11) ; corpus 420 | geste selon la variante retenue au **§ 1 ter** ; dans les deux cas : classement sur 4 niveaux, ouverture d'un document (métadonnées) ; historique des versions par « Mes Documents » → document → onglet « Historique des Versions » ; pagination **seulement si livrée** (D2 : premier sacrifice, phrase « tout tient sur une page ») | « Et quand on ne sait pas où il est ? On cherche. » |
| 10:00–12:00 | **P5** recherche + cloisonnement | 2:00 | B — `MGR001` (manager DAF) : recherche ; puis B — `READ001` (lecteur DSI), même recherche. Pas `MINFI002` : un collaborateur ne cherche que dans ses propres documents (REC-08, `search.py:61-62`) | « facture » : 21 résultats pour `MGR001` ; requête de contrôle « lettre », présente dans DAF **et** DSI : 4 documents DAF, 8 DSI (REC-10) ; 1 document DAF à mettre en corbeille avant la seconde recherche | deux listes différentes pour la même requête, document en corbeille absent ; l'écran n'affiche pas le temps de réponse : il se montre par le repli (`GET /search`, `took_ms`, 6 à 15 ms mesurés à la recette ; REC-09) | « Un document n'est pas seulement rangé : il est validé. » |
| 12:00–14:00 | **P8** cycle de validation | 2:00 | A — `MINFI002` soumet au circuit ; B — `MGR001` vise un document, en **rejette** un autre avec motif ; retour A | circuit `E2E-WF-VALID`, 2 documents DAF dédiés (seed PR 2 de Q) | choix du validateur, tâche en attente côté manager, **motif saisi**, statut Visé / Rejeté visible chez le rédacteur | **Moment d'écart n° 2** (§ 3) puis : « Tout ce que vous venez de voir a laissé une trace. » |
| 14:00–15:00 | **P7** journal d'audit | 1:00 | B — `AUDIT001`, `/audit`, filtre `MINFI002` + aujourd'hui | traces produites par P1→P8 | d'abord le filtre « aujourd'hui » seul : les actions de la séance dans l'ordre, avec leur auteur (`MINFI002` connexion et soumission ; `MINFI001` import et revue ; `MGR001` visa et rejet) ; puis le filtre `MINFI002` : ses seules actions. Rôle **lecture seule** | « Voilà ce qui marche. Voici ce qui manque. » |
| 15:00–17:00 | Écarts | 2:00 | aucune | — | les écarts non encore dits de la liste plan § 3 (1, 5, 6, 8, 12, 13, 14, 15) : une phrase chacun, date ou appui | « Vos questions. » |
| 17:00–20:00 | Questions | 3:00 | — | — | § 4 | — |

Direct = 13:00 (P1 1:30 + P2 2:30 + P3 1:30 + P6 1:00 + P4 1:30 + P5 2:00 + P8 2:00 + P7 1:00). Tampon ± 1 min : se prend sur P2 (import plus long) et se rend sur P4/P7. Si le direct dépasse 14:00 à la fin de P5, **P8 réduit à visa seul** (le rejet motivé passe en capture) et P7 à 0:45.

## 1 ter. P4 : geste du manager dans les espaces (ajout du 21/11)

Décision du PO du 21/11 : les correctifs REC-04 (arrivée du manager sur son service) et REC-05 (filtres Domaines et Activités pour le manager) sont accordés. Ce geste suppose leur fusion avant le tag.
1. `MGR001` ouvre « Espaces » : il arrive directement sur la DAF, son service, sans bandeau ni message.
2. Filtre Domaine « Finances et comptabilité », puis Activité « Marchés publics », puis année 2025.
3. Ouvrir un document de la liste : classement sur 4 niveaux dans l'aperçu, métadonnées.
4. Historique des versions : il ne s'ouvre pas depuis « Espaces ». Aller dans « Mes Documents », cliquer le document, puis l'onglet « Historique des Versions » (précision de B, recette du 21/11).
- Phrase : « Le chef de service arrive dans son service et descend l'arborescence : domaine, activité, année. »
- Repli : un message s'affiche ou un filtre reste vide → F5 une fois, puis l'arbre DAF → 2025 sans les filtres (repli § 2).

## 1 bis. Moments conditionnels V1.1 (ajout daté du 10/11, DEC-002 révision du 10/11)

Règle : un moment ci-dessous ne se joue **que si sa PR est fusionnée le mer 19/11 18:00** (coupure ferme) ; sinon il est retiré du déroulé et sa phrase d'écart reste au bloc 15:00–17:00. Chaque moment livré **retire une phrase** de ce bloc : le temps ajouté (≈ 1:50 au total) se prend d'abord sur Écarts (2:00 → 1:00 si les quatre sont livrés), puis sur le tampon ± 1. Aucun repli API pour ces moments : en cas d'incident, on passe et on dit la phrase d'écart. Chronométrage le 27/11 avec le reste (§ 5).

| Moment | Quand | Fenêtre / profil | Clics | Résultat attendu sur le jeu D1 | Conditionnel |
|---|---|---|---|---|---|
| **Tuile « Doublons refusés »** (lot 1) | fin de P2 (≈ 5:45), +0:20 | B — administrateur du seed, `/dashboard` | ouvrir le tableau de bord (F5 s'il est déjà ouvert) ; montrer la carte | carte « Doublons refusés » **> 0** : au moins **2** (les 2 doublons volontaires de `demo-import/live/`), **14** si les 12 doublons du seed passent par un job d'import engagé (chiffre figé par Q au rejeu du 17) ; compteur du tenant seul. Phrase : « rien n'est stocké deux fois, et on le compte. » | PR **#77** (API) **et #81** (carte) fusionnées avant le 19/11 18:00 |
| **Export puis réimport des règles** (lot 2) | début de P3 (≈ 6:00, avant la simulation), +0:45 | B — administrateur, `/rules` | « Exporter » → fichier `regles-classement-MINFI-<date>.json` téléchargé ; « Importer » → **ce même fichier** → dialogue de simulation « 0 à créer, 0 à mettre à jour, 10 identiques » → Confirmer → rapport `created 0, updated 0, skipped 10, applied true` ; liste `/rules` inchangée | 10 = règles de D1 (`demo_rule_01` à `demo_rule_10`, `demo-manifest.json`), actives ou non : l'export les prend toutes. Phrase : « on sauvegarde les règles d'un ministère et on les rejoue sans rien casser : le second import n'écrit rien. » | PR **#79** (API) **et #84** (boutons) |
| **Export CSV du journal** (lot 3a) | fin de P7 (≈ 14:45), +0:15 | B — `AUDIT001`, `/audit`, filtre déjà posé (`MINFI002` + aujourd'hui) | « Exporter (CSV) » → téléchargement `journal-audit-<date>.csv` ; ouvrir dans le tableur préparé (onglet 3) | mêmes lignes que l'écran, filtres compris, séparateur `;`. Phrase : « le journal sort de l'outil pour l'auditeur, filtres compris. » | PR **#80** |
| **Verrou après 3 OTP** (lot 3b) | fin de P8, juste avant P7 (≈ 13:50), +0:30 | B — compte **dédié `UNIT001`** (administrateur d'unité du seed, utilisé nulle part ailleurs dans la séance). **Jamais** `MINFI002`, `MGR001`, `READ001`, `AUDIT001` ni l'administrateur : le verrou dure 15 min, soit la fin de la démo | connexion `UNIT001` → 3 codes OTP faux : 1 et 2 → « code invalide », 3e → message « Compte verrouillé 15 min après 3 codes erronés », bouton désactivé avec compte à rebours ; **ne pas réessayer** | puis P7 avec `AUDIT001` : ligne `account_locked` sur `UNIT001` dans le journal (filtre agent retiré). Limite auth : 2 connexions + 4 OTP dans la minute → joué **seulement** avec le compose de démo à `30/minute` (checklist § B) ; à `5/minute`, ce moment saute. Si un compte de séance est verrouillé par erreur : `DOCS/exploitation/deverrouiller-compte.md`. | PR **#83** |

Les lots 4 (critères contenu/date) et 5 (surveillance d'un répertoire) n'ont pas de moment : sans PR au 10/11, ils restent des phrases d'écart (moment n° 1 du § 3).

## 2. Repli par parcours (checklist § C : une tentative F5, sinon bascule < 60 s, sinon captures ; jamais de redémarrage)

| Parcours | Repli **manuel** (même poste) | Repli **API** (poste de secours, client REST préparé, jeton jamais affiché) | Capture (plan B, rapport Playwright du 27 ouvert en onglet 2) |
|---|---|---|---|
| P1 | OTP refusé → relire le code dans la réponse `development` ; 429 → attendre 60 s en commentant l'écran (checklist) | `POST /auth/login` puis `/auth/verify-otp` : montrer le jeton tronqué, puis recharger A | `auth.spec` : écran OTP + en-tête connecté |
| P2 | import qui échoue → déposer **3 fichiers** à la main via `/ingestion` étape 1 (dont un doublon), en fenêtre B avec `MINFI001` | `POST /documents/ingest-directory` sur `/data/ingest/live` ; 403 hors racine = **argument**, pas incident | `ingestion.spec` : compteur + doublons refusés |
| P3 | simulation vide → simuler la règle seed active (résultat garanti) | `POST …/simulate` : lire `moved` / destinations dans la réponse | `rules-simulation.spec` : tableau avant/après |
| P6 | liste vide (P2 a tout classé) → ouvrir un des ≈ 15 « à revoir » du seed | `POST /documents/{id}/resolve-review` puis `/spaces` | `needs-review.spec` |
| P4 | filtres absents → arbre + ouverture d'un document seulement ; pagination → « tout tient sur une page » | `GET /spaces/documents?limit=…` : montrer `total` | `spaces.spec` |
| P5 | corbeille UI absente → le document a été mis en corbeille **à H-30** (checklist § C) et on le dit | `GET /search?q=…` avec les deux comptes (`MGR001`, `READ001`) : `took_ms` et `total` différents ; c'est aussi là que se montre le temps de réponse (REC-09) | `search-scope.spec` (SC-SEC-01/02) |
| P8 | 422 ou action refusée → visa seul ; motif absent → dire l'écart 17 | `GET /workflows/pending` puis `POST …/actions` : statut dans la réponse | `validation-cycle` du `smoke` : tâche, motif, statut |
| P7 | filtre vide → retirer le filtre agent, garder la journée | `GET /documents/{id}/audit-logs` d'un document de P6 | `audit.spec` |

Un repli API ne se montre **qu'une fois** par séance : au second incident, captures directement.

## 3. Les deux moments où l'on dit volontairement ce qui manque

1. **Fin de P3 (≈ 7:15)**, écran de simulation encore affiché : « La V1 classe sur type, origine, nom et format ; les critères contenu et date, la surveillance continue d'un répertoire et les tags arrivent en V1.1. » (écarts 2, 4, 16 du plan § 3). Dit ici parce que le jury vient de voir une règle : la limite est concrète, pas défensive. **Révision du 10/11** (DEC-002) : critères contenu/date, export/import des règles et surveillance continue sont réouverts, **livrés si fusionnés le 19/11 18:00, sinon V1.1** ; un élément livré se montre dans P3 et sort de la phrase, les autres y restent.
2. **Fin de P8 (≈ 13:45)**, statut Rejeté + motif à l'écran : « Le manager vise ou rejette avec motif ; le renvoi pour correction avec nouvelle version arrive en V1.1, le modèle de données le permet déjà. Le cycle de vie reste manuel : corbeille, restauration, purge par l'administrateur ; les durées de conservation automatiques sont une suite. » (écarts 17 et 9). Dit ici parce que c'est la question que Maarch inspire au jury (`sources/concurrents-ged.md` § 3).

Les autres écarts se disent au bloc 15:00–17:00, jamais pendant un parcours. **Révision du 10/11** (DEC-002) : le compteur KPI doublons, l'export du journal d'audit et le verrou après 3 OTP suivent la même règle, livré si fusionné le 19/11 18:00, sinon annoncé en V1.1 dans ce bloc.

## 4. Questions probables et réponse en une phrase (texte complet : plan § 4 ; comparatif : concurrents § 2-3)

| Question | Réponse en une phrase | Renvoi |
|---|---|---|
| Un agent de la DAF voit-il les documents de la DRH ? | « Non : portée par service, étanchéité entre administrations, vous l'avez vu au P5. » | SC-SEC-01/02 (pas d'écart) |
| Et si on supprime par erreur ? | « Corbeille puis restauration ; la purge est réservée à l'administrateur, et la restauration complète de la base a été rejouée deux fois, le 18 et le 20/11. » | écart 9 ; C7 |
| Pourquoi pas Paperless ou Alfresco ? | « Paperless est fait pour un individu, sans service ni validation ; Alfresco exige une JVM et une équipe d'exploitation que le cahier des charges exclut. » | concurrents § 2 ; écarts 8/14/16 pour ce qu'ils font mieux |
| L'OCR lit-il le manuscrit ou les scans dégradés ? | « L'imprimé oui ; un moteur plus léger pour les scans dégradés a été mesuré le 14/11, livraison V1.1. » | écart 14 (+ chiffre OCR-0 si bon, D3) |
| Ces identifiants affichés à la connexion ? | « Volontaire pour la démo, retirés en V1.1 ; le code OTP reste obligatoire. » | écart 15 |
| Combien de documents tient le système ? | « 420 aujourd'hui avec ces temps de réponse ; les 100 000 fichiers du cahier des charges sont mesurés en décembre sur un corpus étalon. » | écart 1 ; C3 du 27 |
| Pourquoi pas de démo en ligne ? | « Décision du 9/11 : mêmes conteneurs que chez vous, aucune donnée exposée sur Internet. » | écart 5 ; `decision-po-vps-b6.md` |
| Êtes-vous conformes à ISO 15489 ? | « Alignés sur les principes et le vocabulaire ; pas de certification, l'archivage réglementaire est la trajectoire annoncée. » | écart 9 ; `sources/ged-normes.md` |

Si la question porte sur un écart déjà dit : « c'est l'écart n° … annoncé », sans redévelopper.

## 5. Ce que le 27/11 doit confirmer avant de figer ce déroulé

- Durée réelle de chaque ligne du § 1 (chrono O) ; P2 est la seule ligne élastique.
- Route de l'écran des tâches de validation (P8) et libellés exacts Viser / Rejeter (F, `fix/validation-cycle-ui`) ; ajouter la route aux 7 favoris de la checklist § B si elle n'y est pas.
- Tenue de la session administrateur ouverte à H-5 (fenêtre B).
- Mot-clé P5 : « facture » ; requête de contrôle n° 10 : « lettre » (révision du 21/11, REC-10). Le jeu de requêtes C3 figé (`c3-queries.txt`) n'a pas été écrit : la liste la plus proche est `gestion-projet/recette/c3-queries-repetition-d1.txt`, avec « lettre » en n° 10 ; Q fige le jeu définitif ; le chiffre C3 dit au jury est celui du 27 (`protocole-mesures-criteres.md`).
- Captures du plan B regénérées depuis le run du 27, pas du 21.

## Sources

`parcours-demo.md` § 2 (P1–P8) ; `matrice-recette.md` (états, PR #45/#46/#47, P8 VAL-D1..D3) ; `plan-presentation.md` § 1 (minutage), § 3 (écarts 1–17), § 4 (questions) ; `checklist-demo.md` § B (favoris, données, comptes), § C (H-30, Pendant) ; `jeu-donnees-demo.md` § 3 (`demo-import/live`, 420 documents, ≈ 15 à revoir) ; `protocole-mesures-criteres.md` (C3, `c3-queries.txt`) ; `spec-limite-upload.md` § 5 (`/data/ingest`) ; `sauvegarde-restauration.md` § 6.3 (rejeux 18 et 20/11) ; `sources/concurrents-ged.md` § 2-4 ; `instruction-decisions-14-11.md` D2, D3.
