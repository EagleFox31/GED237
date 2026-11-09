# Déroulé minute par minute de la séance du 30/11 (file 12)

- **Pour** : P (présente), O (clavier de secours, chrono), Q (plan B captures). Rédigé par l'innovateur le 2026-11-09 soir ; à chronométrer le 27/11 (répétition générale) et à corriger **par ajout daté**.
- **Règle de lecture** : ce déroulé **renvoie**, il ne recopie pas. Étapes détaillées d'un parcours → `parcours-demo.md` § 2 ; état et preuves → `matrice-recette.md` ; phrases d'écart et questions complètes → `plan-presentation.md` § 3-4 ; préparation des postes et conduite de séance → `checklist-demo.md` § B-C. Les comptes sont désignés par **identifiant seul** (`seed_db.py`), jamais par mot de passe.
- **Cadre** (plan § 1) : 20 min = ouverture 2 + **direct 13 ± 1** + écarts 2 + questions 3. Deux fenêtres de navigateur sur le poste principal : **fenêtre A** = rédacteur `MINFI002` (collaborateur DAF), connectée en direct au P1 et gardée jusqu'à la fin ; **fenêtre B** = profils qui changent (administrateur du seed → `MGR001` → `READ001` → `AUDIT001`), l'administrateur étant connecté **avant** la séance (H-5). Quatre connexions en direct au total, loin de la limite « 4 par minute » (checklist § C Pendant). *À vérifier le 27* : la session administrateur ouverte à H-5 tient-elle 20 min sans reconnexion (durée du jeton d'accès) ? sinon la connecter à H-1 min.

## 1. Chronologie

| Min | Parcours | Durée | Fenêtre / profil | Données du seed utilisées | Ce que le jury doit voir | Phrase de transition (vers la suite) |
|---|---|---|---|---|---|---|
| 0:00–2:00 | Ouverture | 2:00 | aucune (diapositive « où se situe GED237 », `sources/concurrents-ged.md` § 4) | — | le problème, la promesse, les 4 rôles (plan § 1 ligne 0–2) | « Entrons comme un agent de la DAF. » |
| 2:00–3:30 | **P1** connexion OTP | 1:30 | A — `MINFI002` | compte seed, code OTP | écran de connexion, code, nom et rôle dans l'en-tête ; **ne pas** cliquer un profil pré-rempli (écart 15 : le dire si le jury le remarque) | « Ce rédacteur reçoit une trentaine de fichiers d'un service : importons-les. » |
| 3:30–6:00 | **P2** import + classement | 2:30 | B — administrateur : `/rules`, règle seed « Factures → DAF/Comptabilité » **active** (10 s) ; puis A — `/ingestion` → `/data/ingest/live` | `demo-import/live/` (≈ 30 fichiers, doublons et hors règle compris, `jeu-donnees-demo.md` § 3), chemin **`/data/ingest`** (seul autorisé, spec upload § 5) | compteur d'import, documents dans l'arborescence, **doublons refusés**, « reste à classer » non nul | « Rien n'a été classé par magie : voici la règle, et ce qui se passe avant qu'on en active une. » |
| 6:00–7:30 | **P3** simulation de règle | 1:30 | B — administrateur, `/rules` | règle 10 « Rapports financiers » du seed, **inactive** : la simuler plutôt que créer (gagne 40 s) ; corpus 420 documents, 4 services | tableau avant/après, **aucun déplacement** tant que la règle est inactive | **Moment d'écart n° 1** (§ 3) puis : « Ce que la règle ne sait pas classer attend un humain. » |
| 7:30–8:30 | **P6** revue manuelle | 1:00 | B — administrateur, `/needs-review` | les « sans règle » du P2 (+ ≈ 15 documents à revoir du seed) | raison affichée, choix service/domaine/activité/année, le document quitte la liste | « Le document est à sa place ; allons le retrouver comme un chef de service. » |
| 8:30–10:00 | **P4** espaces | 1:30 | B — `MGR001` (manager DAF), `/spaces` | arbre DAF → Comptabilité → 2025 ; corpus 420 | arborescence 4 niveaux, ouverture d'un document (métadonnées, historique des versions) ; filtres/pagination **seulement si livrés** (D2 : premier sacrifice, phrase « tout tient sur une page ») | « Et quand on ne sait pas où il est ? On cherche. » |
| 10:00–12:00 | **P5** recherche + cloisonnement | 2:00 | A — `MINFI002` : recherche ; puis B — `READ001` (lecteur DSI), même recherche | mot-clé présent dans DAF **et** DSI (requête n° 10 de `c3-queries.txt`, figée le 18) ; 1 document DAF à mettre en corbeille avant la seconde recherche | **temps de réponse affiché** (C3), deux listes différentes pour la même requête, document en corbeille absent | « Un document n'est pas seulement rangé : il est validé. » |
| 12:00–14:00 | **P8** cycle de validation | 2:00 | A — `MINFI002` soumet au circuit ; B — `MGR001` vise un document, en **rejette** un autre avec motif ; retour A | circuit `E2E-WF-VALID`, 2 documents DAF dédiés (seed PR 2 de Q) | choix du validateur, tâche en attente côté manager, **motif saisi**, statut Visé / Rejeté visible chez le rédacteur | **Moment d'écart n° 2** (§ 3) puis : « Tout ce que vous venez de voir a laissé une trace. » |
| 14:00–15:00 | **P7** journal d'audit | 1:00 | B — `AUDIT001`, `/audit`, filtre `MINFI002` + aujourd'hui | traces produites par P1→P8 | connexion, import, corbeille, revue, visa/rejet dans l'ordre de la séance ; rôle **lecture seule** | « Voilà ce qui marche. Voici ce qui manque. » |
| 15:00–17:00 | Écarts | 2:00 | aucune | — | les écarts non encore dits de la liste plan § 3 (1, 5, 6, 8, 12, 13, 14, 15) : une phrase chacun, date ou appui | « Vos questions. » |
| 17:00–20:00 | Questions | 3:00 | — | — | § 4 | — |

Direct = 13:00 (P1 1:30 + P2 2:30 + P3 1:30 + P6 1:00 + P4 1:30 + P5 2:00 + P8 2:00 + P7 1:00). Tampon ± 1 min : se prend sur P2 (import plus long) et se rend sur P4/P7. Si le direct dépasse 14:00 à la fin de P5, **P8 réduit à visa seul** (le rejet motivé passe en capture) et P7 à 0:45.

## 2. Repli par parcours (checklist § C : une tentative F5, sinon bascule < 60 s, sinon captures ; jamais de redémarrage)

| Parcours | Repli **manuel** (même poste) | Repli **API** (poste de secours, client REST préparé, jeton jamais affiché) | Capture (plan B, rapport Playwright du 27 ouvert en onglet 2) |
|---|---|---|---|
| P1 | OTP refusé → relire le code dans la réponse `development` ; 429 → attendre 60 s en commentant l'écran (checklist) | `POST /auth/login` puis `/auth/verify-otp` : montrer le jeton tronqué, puis recharger A | `auth.spec` : écran OTP + en-tête connecté |
| P2 | import qui échoue → déposer **3 fichiers** à la main via `/ingestion` étape 1 (dont un doublon) | `POST /documents/ingest-directory` sur `/data/ingest/live` ; 403 hors racine = **argument**, pas incident | `ingestion.spec` : compteur + doublons refusés |
| P3 | simulation vide → simuler la règle seed active (résultat garanti) | `POST …/simulate` : lire `moved` / destinations dans la réponse | `rules-simulation.spec` : tableau avant/après |
| P6 | liste vide (P2 a tout classé) → ouvrir un des ≈ 15 « à revoir » du seed | `POST /documents/{id}/resolve-review` puis `/spaces` | `needs-review.spec` |
| P4 | filtres absents → arbre + ouverture d'un document seulement ; pagination → « tout tient sur une page » | `GET /spaces/documents?limit=…` : montrer `total` | `spaces.spec` |
| P5 | corbeille UI absente → le document a été mis en corbeille **à H-30** (checklist § C) et on le dit | `GET /search?q=…` avec les deux comptes : `took_ms` et `total` différents | `search-scope.spec` (SC-SEC-01/02) |
| P8 | 422 ou action refusée → visa seul ; motif absent → dire l'écart 17 | `GET /workflows/pending` puis `POST …/actions` : statut dans la réponse | `validation-cycle` du `smoke` : tâche, motif, statut |
| P7 | filtre vide → retirer le filtre agent, garder la journée | `GET /documents/{id}/audit-logs` d'un document de P6 | `audit.spec` |

Un repli API ne se montre **qu'une fois** par séance : au second incident, captures directement.

## 3. Les deux moments où l'on dit volontairement ce qui manque

1. **Fin de P3 (≈ 7:15)**, écran de simulation encore affiché : « La V1 classe sur type, origine, nom et format ; les critères contenu et date, la surveillance continue d'un répertoire et les tags arrivent en V1.1. » (écarts 2, 4, 16 du plan § 3). Dit ici parce que le jury vient de voir une règle : la limite est concrète, pas défensive.
2. **Fin de P8 (≈ 13:45)**, statut Rejeté + motif à l'écran : « Le manager vise ou rejette avec motif ; le renvoi pour correction avec nouvelle version arrive en V1.1, le modèle de données le permet déjà. Le cycle de vie reste manuel : corbeille, restauration, purge par l'administrateur ; les durées de conservation automatiques sont une suite. » (écarts 17 et 9). Dit ici parce que c'est la question que Maarch inspire au jury (`sources/concurrents-ged.md` § 3).

Les autres écarts se disent au bloc 15:00–17:00, jamais pendant un parcours.

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
- Mot-clé P5 et requête n° 10 identiques à celles de `c3-queries.txt` ; le chiffre C3 dit au jury est celui du 27 (`protocole-mesures-criteres.md`).
- Captures du plan B regénérées depuis le run du 27, pas du 21.

## Sources

`parcours-demo.md` § 2 (P1–P8) ; `matrice-recette.md` (états, PR #45/#46/#47, P8 VAL-D1..D3) ; `plan-presentation.md` § 1 (minutage), § 3 (écarts 1–17), § 4 (questions) ; `checklist-demo.md` § B (favoris, données, comptes), § C (H-30, Pendant) ; `jeu-donnees-demo.md` § 3 (`demo-import/live`, 420 documents, ≈ 15 à revoir) ; `protocole-mesures-criteres.md` (C3, `c3-queries.txt`) ; `spec-limite-upload.md` § 5 (`/data/ingest`) ; `sauvegarde-restauration.md` § 6.3 (rejeux 18 et 20/11) ; `sources/concurrents-ged.md` § 2-4 ; `instruction-decisions-14-11.md` D2, D3.
