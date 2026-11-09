# Passation — session innovateur

## 2026-11-09 18:06 — DEC-001/002, parcours de démo, plan de présentation, veille OCR

- Livré dans `gestion-projet/` : `decisions/DEC-2026-001`, `decisions/DEC-2026-002`, `innovateur/parcours-demo.md`,
  `innovateur/plan-presentation.md`, `innovateur/contexte-application.md` (révisé), `innovateur/sources/github-agents-skills.md`
  (ligne Unlimited-OCR). Les trois premiers partent en PR `docs/point-2026-11-09` depuis le worktree `../GED237-docs`
  (orchestrateur) : ne plus les modifier dans le checkout partagé avant fusion.
- Amendements DEC-002 envoyés à l'orchestrateur (adresse `uds:\.\pipe\LOCAL\cc-msg-eb4dfb372f123f17153bacb6dc2fb03f`) :
  rôles MAJUSCULES migration 001 (0,25 j, 11/11, obligatoire) ; verrou OTP abandonné → annoncé ; D3 journal d'audit
  login/upload/import (0,5 j, 12/11) ; D4 export journal annoncé V1.1. Budget 9,75/10 j. Sacrifice : 6 → 5 → pagination de 4.
- En attente PO : P8 (corbeille/version sans UI → recommandation cycle de validation), VPS/OCR, B6, liste annoncée.
- En cours : recherche approfondie OCR léger/CPU open source demandée par l'utilisateur (piste RapidOCR/PP-OCRv5 ONNX
  déjà identifiée, 0,5 j, remplacerait EasyOCR+torch dans `services/ocr/strategy.py`). Résultat à consigner dans
  `innovateur/sources/ocr-leger.md` puis proposer Adapt à l'orchestrateur.
- Règles : pas de code, pas de git, jamais `backend/`, `frontend/`, `.github/`.

## 2026-11-09 18:40 — veille OCR livrée, note starlette, DEC-002 acceptée

- DEC-2026-002 ACCEPTÉE par le PO avec amendements (PR #36 fusionnée 621e3d7) ; checkout partagé à jour, fichiers modifiables.
- Livré : `innovateur/sources/ocr-leger.md` (Adapt RapidOCR/PP-OCRv6 ONNX + Adopt OCRmyPDF, retrait EasyOCR/torch ;
  rien avant le 30/11 sauf OCR-0 mesure CER 0,5 j et pré-OCRisation du corpus la veille) ; note starlette dans
  `contexte-application.md` (6 CVE, aucune pré-auth, montée fastapi ≥ 0.133 / pydantic ≥ 2.7 estimée 1–1,5 j → V1.1,
  exception pip-audit datée 15/12) ; README indexé. Non commité : partira dans la prochaine PR docs de l'orchestrateur.
- Prochaine sollicitation prévue : point S1 du 14/11 ; questions PO ouvertes jusqu'au 17/11 (VPS/on-site, B6).
- Prochaine étape utile si sollicité : proposer OCR-0 à ci-qa (mesure sans code produit) et, si VPS retenu, OCR-1 en remplacement de l'ordre 6.

## 2026-11-09 18:55 — DEC-2026-003 RapidOCR acceptée par le PO

- PO a validé RapidOCR : `decisions/DEC-2026-003 - Moteur OCR leger RapidOCR en remplacement d EasyOCR.md` écrite en
  ACCEPTÉ ; lots OCR-0 (Q, mesure) → OCR-1 (B, moteur + retrait torch + couche texte + cache) → OCR-2/3 V1.1.
  Transmise à l'orchestrateur pour inscription au plan (OCR-1 avant le gel seulement si VPS retenu, à la place de l'ordre 6).
- Non commité ; prochaine PR docs de l'orchestrateur. En veille jusqu'au point S1 (14/11).

## 2026-11-09 19:00 — file de 4 tâches reçue de l'orchestrateur (consigne PO : enchaîner)

1. Dossier décisions PO (a) VPS vs on-site, (b) B6 garde de routes → `innovateur/decision-po-vps-b6.md` ; 2. triage Dependabot #35 ;
3. spéc jeu de données démo (20/11) ; 4. étude reuse-first sauvegarde/restauration (ordre 5). Un fichier par tâche, message orchestrateur avec chemin.

## 2026-11-09 19:15 — tâche 1 livrée : `innovateur/decision-po-vps-b6.md`

Reco (a) : démo sur place en Docker + poste de secours (VPS : 198 Mo libres, disque 77 %, compose ≈ 5,3 Go ; option C « URL vitrine » +1 j si le PO l'exige). Reco (b) : garde admin/non-admin seule (ordre 6, 0,5 j F mardi 18), 3 constats backend B6 → V1.1. Suite : tâche 2 (triage #35).

## 2026-11-09 19:28 — tâche 2 livrée : `innovateur/triage-dependabot-35.md`

#35 : zustand 5.1.0 et @playwright/test 1.65.0, deux mineurs, CI Gate verte → fusionner (0 j). Attention : branches ci-qa `ci/e2e-*` absentes du remote à 19:20 ; si elles épinglent une image Playwright, viser 1.65. Suite : tâche 3 (jeu de données démo).

## 2026-11-09 19:45 — tâche 3 livrée : `innovateur/jeu-donnees-demo.md`

Reuse : seed existant (DRH/DAF/DSI du MINFI), `test_real_export_v2.py` adapté (sortie par variable d env), manifeste au format ci-qa (`demo-manifest.json`, codes DEMO-…). 420 docs cible, 9 règles actives + 1 inactive pour P3, états déclarés (≈330 classés, 35–45 à revoir, 12 doublons, 8 corbeille, 3 verrous, 5 versions, 30 réservés au direct). Suite : tâche 4 (sauvegarde).

## 2026-11-09 19:55 — tâche 2b livrée (limite slowapi en démo) dans `parcours-demo.md` § 0

9 connexions / 10 OTP en 13 min, pic 3 connexions + 4 OTP par minute ; 5/min casse répétition et plan B → variables d env AUTH_LOGIN_RATE_LIMIT / AUTH_OTP_RATE_LIMIT, défaut 5/min, 30/min en démo et e2e. Message orchestrateur envoyé (tâches 2, 2b, 3). Suite : tâche 4.

## 2026-11-09 20:10 — tâche 4 livrée : `innovateur/sauvegarde-restauration.md` ; file des 4 tâches close

Adopt offen/docker-volume-backup v2.50.1 (labels archive-pre pg_dump -Fc + stop-during-backup, archive tar.gz base + storage_data, rotation) ; Build restore.sh (pg_restore --clean sur base vierge, volume restauré, contrôles vs MANIFEST.json). Cibles : sauvegarde < 5 min, restauration < 10 min ; B 0,75 j lundi 17, Q 0,5 j. README innovateur mis à jour (6 fiches). Message orchestrateur envoyé. En attente de la prochaine demande.

## 2026-11-09 20:20 — nouvelle file orchestrateur (3 tâches)

1. `innovateur/protocole-ocr-0.md` (benchmark OCR-0 pour ci-qa, exécution 14/11) ; 2. `innovateur/branches-distantes.md` (inventaire lecture seule, aucune suppression) ; 3. `innovateur/checklist-demo.md` (J-1/J0, cases à cocher, qui/quand). Message orchestrateur après chaque fichier. Les 7 fichiers précédents partent dans la PR docs de l orchestrateur.

## 2026-11-09 20:45 — tâches 1 et 2 de la nouvelle file livrées

`protocole-ocr-0.md` (corpus A synthétique dégradé + B réel, 4 configs, jiwer, memory.peak, seuils DEC-003, tableau) et `branches-distantes.md` (19 branches : 12 fusionnées + 1 fermée à supprimer sur accord PO, 6 gardées ; reco « auto delete head branches »). Reste : `checklist-demo.md`, puis README innovateur à compléter (3 fiches).

## 2026-11-09 20:55 — tâche 3 livrée : `innovateur/checklist-demo.md` ; file close

Checklist J-1/J0 par rôle (O/B/F/Q/P), hypothèse démo sur place, variante VPS en section F. README innovateur à 9 fiches. Orchestrateur informé (3 messages). Aucune écriture git ; rien dans backend/, frontend/, .github/. État : disponible, en attente de la prochaine file.

## 2026-11-09 21:00 — file 3 : propagation décisions PO (go tout : sur place + garde minimale) et point S1

1. Mettre à jour decision-po-vps-b6.md (TRANCHÉ 09/11), checklist-demo.md (hypothèse retirée, F sans objet), contexte-application.md (point 5, risque VPS), plan-presentation.md § 3 (écarts consolidés : B6 backend, D4, OTP lockout, starlette, OCR-1, identifiants démo dans LoginPage.tsx). 2. gestion-projet/plans/point-2026-11-14.md (attendus par rôle, preuve, décisions, colonne constaté vide). Message orchestrateur après chaque fichier ; file close ensuite.

## 2026-11-09 19:09 — file 3 livrée, file close

- Décisions PO (A sur place + B1 garde minimale) propagées : decision-po-vps-b6.md (TRANCHÉ 09/11), checklist-demo.md (A.1 coché, F sans objet), contexte-application.md (point 5, risque VPS levé), plan-presentation.md § 3 = 15 écarts consolidés (10 B6 backend, 12 verrou OTP, 13 starlette exp. 15/12, 14 OCR-1, 15 identifiants démo dans frontend/components/LoginPage.tsx) + § 4 ; README mis à jour. Aucun mot de passe recopié.
- Créé gestion-projet/plans/point-2026-11-14.md : attendus par rôle avec preuve, colonne Constaté vide, décisions D1–D5, glissements, budget.
- Signalé à O : numérotation écart OTP (DEC-002 dit 9, plan dit 12) à harmoniser. Deux messages envoyés à l orchestrateur. Rien en attente.

## 2026-11-09 19:16 — file 4 reçue : spec-limite-upload.md puis release-demo.md

## 2026-11-09 19:22 — file 4 livrée, file close

- spec-limite-upload.md : MAX_UPLOAD_SIZE jamais lu (Vérifié), nginx 100M seul plafond ; reco compteur dans save_file_with_checksum (.part, exception FileTooLargeError → 413 Problem Details FILE_TOO_LARGE), pré-contrôle Content-Length mono-fichier, nginx ≥ plafond + 1 Mo, message FR frontend, test pytest ; middleware ASGI = V1.1.
- release-demo.md : 0 tag, release-integrity.yml jamais exercé mais secrets GPG présents ; reco A = tag manuel v1.0.0-rc.1 le 24/11 (pré-release, gh release create, artefact SBOM joint), rc.2 avant le 27, v1.0.0 après démo ; Release Please appfactory en V1.1 ; note de version jury en 7 sections ; bump version APP_VERSION (B+F 0,1 j).
- README mis à jour. Messages envoyés. Rien en attente.

## 2026-11-09 19:23 — file 5 reçue : D6 release + checklist rc.N, puis spec-garde-routes.md et spec-espaces-filtres-ui.md

- Reco release A retenue par O. À faire : D6 dans plans/point-2026-11-14.md § 2 ; item checklist A « v1.0.0-demo » → v1.0.0-rc.N + artefact release-integrity. Puis 2 specs frontend (garde de routes mardi 18 ; SpacesPage filtres C9 lundi 17, PR #38). Message O après chaque fichier.

## 2026-11-09 19:31 — file 5 livrée : D6, checklist rc.N, spec-garde-routes.md, spec-espaces-filtres-ui.md

- D6 ajouté dans plans/point-2026-11-14.md § 2 ; item release de checklist-demo.md renommé v1.0.0-rc.N + artefact release-integrity.
- innovateur/spec-garde-routes.md : 8 routes admin (super : /tenants, /tenants/:id, /platform-users, /authz ; super+tenant : /org, /rules, /classement, /users), garde sur userProfile.id (resolveTemplate déjà insensible à la casse, indépendant de la migration B2), redirection defaultRouteForProfile + pushClientOperationError, 6 cas Playwright GUARD-01..06. Pas de vitest dans frontend.
- innovateur/spec-espaces-filtres-ui.md : contrat #38 (fusionnée 17:44), 5 filtres ordonnés avec aria-labels repris de e2e/specs/spaces.spec.ts (spec sur mockAuth décrivant une UI inexistante : à signaler à Q), état dans l'URL, q envoyé au serveur (filtre local l. 297-314 supprimé), seul reste client = séparation service / sous-services, pagination 50 en § 3.4 séparé (sacrifiable D2), lecture X-Total-Count via fetchWithRefresh.
- README mis à jour (2 lignes). Messages envoyés à O après chaque fichier. File vide : attendre la prochaine demande de O.

## 2026-11-09 19:32 — file 6 reçue : matrice-recette.md puis goulot-vm-docker.md

- O : 1) innovateur/matrice-recette.md (8 parcours × scénarios UAT, spec Playwright existante skip/mock/réelle, preuve, responsable, état 9/11, date cible ; scénarios sans preuve possible avant le 24 pour D2) ; 2) innovateur/goulot-vm-docker.md (mesures VM Docker lecture seule, options xdist / marqueurs / parallélisme front / créneaux, reco chiffrée). Message O après chaque fichier.

## 2026-11-09 19:45 — file 6 livrée : matrice-recette.md et goulot-vm-docker.md

- innovateur/matrice-recette.md : 8 parcours x 22 scénarios, SMK-01..10 de ci-qa intégrés (B 04/05/10, F 01/02/06/07/10-front, Q 08, 03/09 clos), 2 scénarios sans preuve avant le 24 (AUD-02 export, pagination P4), collisions d'ID à acter par F. Message O envoyé.
- innovateur/goulot-vm-docker.md : mesures lecture seule (VM 4 Go RAM, 16 cpu, 29 conteneurs dont 25 hors GED237 ; caps compose 5,3 Gio > VM) ; cause probable des 18 min = fixture autouse drop_all/create_all par test ; reco A fixture session + TRUNCATE (0,25 j B), B xdist 2 workers base par worker (0,25 j B), D pytest et tsc coexistent / e2e exclusif, H pas de --cov en local, E arrêt des piles étrangères sur accord PO. Message O à envoyer.
- README : 2 lignes ajoutées. Aucun fichier hors gestion-projet/ et PASSATION-innovateur.md touché. Prochaine étape : attendre la file 7 de l'orchestrateur ; sinon I2 (CDC en critères d'acceptation).

## 2026-11-09 19:46 — I2 livré : criteres-acceptation.md

- O a acté la règle de file VM, confié A puis B à dev-backend, remonté l'option E au PO ; m'a demandé I2 en s'appuyant sur la matrice.
- innovateur/criteres-acceptation.md : 7 critères de recette signés (cadrage 21/09/2025 § 8) → mesures datées (C2 taux ≥ 95 % et C3 < 2 s mesurables le 20/11 ; C4 droits rouge jusqu'à #42 + fix/authz-collaborator + garde ; C7 restauration jamais sacrifiée) ; un critère observable par scénario P1-P8 (mêmes ID que la matrice) ; scénarios du guide hors démo (signature, indicateurs, plateforme) avec le traitement à annoncer au jury. CDC lu via extraction du .docx (PDF non rendu ici). README mis à jour. Message O à envoyer.
- Prochaine étape : file 7 de O ; sinon analyse concurrents (Alfresco, Nuxeo, Paperless-ngx, Maarch) annoncée dans le README.

## 2026-11-09 19:49 — file 7 livrée : protocole-mesures-criteres.md ; concurrents ; écart 16

- plan-presentation.md § 3 : écart 16 (tags) ajouté en fin de liste, rien renuméroté ; surveillance de dossier = écart 4 déjà présent, non dupliqué (dit à O).
- innovateur/protocole-mesures-criteres.md : C2 (numérateur = classified à la bonne destination du manifeste ; dénominateur = seed − doublons − needs_review attendus ; C2b brut informatif), C3 (10 requêtes figées × 3, took_ms p95 < 2 000, time_total informatif, rejeu le 27), C6 (probe_c6.sh : /health + docker ps + RestartCount, 10 relevés S2, GO = 10/10). Scripts Q ≈ 0,5 j, zéro B.
- innovateur/sources/concurrents-ged.md : comparatif Alfresco/Nuxeo/Paperless/Maarch, § 3 trois différenciateurs + objections. README : 2 lignes. Message O à envoyer.
- Prochaine étape : file 8 de O ; sinon relecture croisée matrice ↔ critères ↔ protocole (mêmes ID, mêmes chiffres).

## 2026-11-09 20:01 — file 8 livrée : relecture croisée, VM 11,7 Gio, ingest-directory, P4
- goulot-vm-docker.md : note datée après l'ordre (VM 11,7 Gio, .wslconfig 12 Go / swap 4 Go, option E sans objet, règle de file → « e2e annoncé chez ci-qa ») ; § 1 non réécrit.
- Relecture croisée (corrigé directement) : critères C2 (formule alignée sur le protocole : destination attendue, − doublons − needs_review attendus), C3 (10 × 3 = 30 mesures via API), C6 (worker exclu, /health, 10/10) ; protocole pré-requis et ligne jeu 20 (plus « piles étrangères arrêtées »), consigne C6 (pas de ligne transverse dans la matrice) ; matrice : SMK-10 déplacé de SC-SEC-02 (P5) vers SC-SEC-03/04 (P7), numéros #45/#46/#47 posés, P4 précisé (uat/spaces-filters = navigation + contrat C9 API, pas les filtres UI).
- spec-limite-upload.md § 5 : fiche ingest-directory (constat documents.py:1440-1459 / ingestion.py:113 ; INGEST_ALLOWED_ROOTS vide = refus, realpath + commonpath, 403 INGEST_PATH_FORBIDDEN, 5 tests, 0,25 j B après le 413) ; plan-presentation écart 10 enrichi (pas de n° 17) ; critères SC-ADM-08 E ; README ligne spec.
- Prochaine étape : message O envoyé ; attendre file 9 ; sinon relire checklist-demo.md ↔ protocole (chemin /data/ingest, worker éteint).

## 2026-11-09 20:08 — files 9 et 10 livrées : sauvegarde ≤ 0,25 j, D1–D6, P8 VAL-D1..D3, /data/ingest
- /data/ingest tranché O : aligné dans checklist-demo.md (§ B Données), spec-limite-upload.md § 5, matrice SC-ADM-08 (INGEST_ALLOWED_ROOTS=/data/ingest dans les deux compose ; PR 2a Q avait /srv/e2e-import).
- File 9 : pas de nouveau fichier (la fiche sauvegarde-restauration.md existait, O la croyait absente) → § 6 ajouté : voie V1 = backup.sh/restore.sh maison (pg_dump -Fc + tar storage_data, Redis ignoré, répertoire horodaté backups/ged237-… sur l'hôte, SHA256SUMS, MANIFEST.txt, --wipe, second passage zéro écart), B 0,25 j lun 17, Q deux rejeux (18/11 e2e, 20/11 jeu de démo sur le poste de secours = point de reprise), critères C7 alignés, checklist : point de reprise H-30 et conduite si purge en démo (bascule, jamais de restauration en séance). offen/docker-volume-backup → V1.1.
- P8 (message O) : matrice P8 (VAL-D1 validators, VAL-D2 current_version_id + enum ActionType, VAL-D3 motif ; B mar 10, F mer 11, e2e jeu 12, ≈ 0,7 j-p ; specs validation/workflow/full-cycle supprimées), critères SC-VAL-04 réduit, plan-presentation écart 17 « retour pour correction » V1.1.
- File 10 : innovateur/instruction-decisions-14-11.md (D1–D6 : faits, à vérifier le 13 au soir, options, reco, effet présentation, tableau de synthèse). README : 1 ligne + ligne sauvegarde mise à jour.
- Prochaine étape : message O (files 9/10 + P8) ; attendre la suite.

## 2026-11-09 20:16 — files 11 et 12 livrées, corrections ci-qa (matrice § 4, seed non lancé par le compose)
- File 11 : plans/point-2026-11-14.md, deux ajouts datés (rien de réécrit) : avant § 3 → D2 nouvel ordre de sacrifice (pagination P4 → retour pour correction P8 → C2/C3 au 27 → une seule restauration ; jamais restauration prouvée ni 8 parcours) ; avant § 5 → budget : P8 +0,7, ingest +0,25, seed explicite +0,25, ordre 5 sauvegarde 1,5 → 0,5 (−1,0) ; total 9,95/10, marge ≈ 0,05 ; réponse à O : le 0,25 de la ligne B S1 est la migration rôles, la sauvegarde est en S2 ordre 5 ; lignes à reporter B 4,50 / F 3,45 / Q inchangé.
- File 12 : innovateur/deroule-demo.md : 20 min (2 + 13 + 2 + 3), ordre P1→P2→P3→P6→P4→P5→P8→P7 avec durées, fenêtre A (MINFI002) / fenêtre B (admin→MGR001→READ001→AUDIT001), données seed, transitions, repli manuel/API/capture par parcours, 2 moments d'écarts (fin P3 : 2/4/16 ; fin P8 : 17/9), 8 questions en une phrase + écart, points à confirmer le 27. README : 1 ligne.
- Corrections O/ci-qa : matrice § 4 → lignes SC-SEC-03a/03b/04a/04b (#48) et SC-E2E-01 couvert par SC-VAL-01 ; jeu-donnees-demo.md ligne seed → « à lancer explicitement, chemin tranché par dev-backend dans la PR rôles » ; checklist H-30 → login MGR001 vérifié après seed.
- Prochaine étape : attendre la suite de O.
