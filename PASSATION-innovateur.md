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

## 2026-11-09 20:20 — D2 variante PO, instruction seed (§ 7 jeu-donnees-demo), relecture LESSON-024
- point-2026-11-14.md bloc D2 : variante O/PO « (b) conditionnel, seuil ≥ 0,25 j sur une ligne S1 le 14 » ajoutée en une ligne.
- jeu-donnees-demo.md § 7 : chemin de seed pile démo (compose = migrate seul ; seed_db.py garde SKIP sur roles, create_all l.35 à retirer) ; options A one-shot seed / B commande documentée / C seed dans migrate ; reco A, preuve down -v → up -d → login MGR001, second up -d = [SKIP]. Envoyé à ged-dev-backend et O. README ligne mise à jour.
- LESSON-024 (brouillon O, fichier non modifié) : remarques envoyées à O (hypothèse SHA appfactory inaccessible, preuve datée, dommage réel, prévention vérifiable = runbook + règle revue .github + script ci-status, reformulation agnostique du titre).
- O ouvre la PR docs sur l'état actuel du checkout ; mes modifs suivantes → PR suivante. Prochaine étape : attendre O (réponse PO sur D2, choix B sur le seed).

## 2026-11-09 20:23 — runbook CI rouge livré
- DOCS/engineering/runbook-ci-rouge.md (31 lignes) : étape 0 arbre plateforme/nous (components.json, PR témoin, annotations, SHA appfactory joignable, modification seulement avec annotation citée), étape 1 gates impact-aware (6 gates de appfactory-impact.json, gh run view --log-failed), étape 2 rejeu Docker avant PR, règle de revue .github, mémoire lessons-learned ; lien ajouté dans DOCS/engineering/README.md. Pour la PR docs suivante (avec LESSON-024, après #47).
- O a intégré mes remarques LESSON-024 (incident GitHub tp8cghg7tlc4) ; reco A seed retenue, dev-backend l'applique dans la PR rôles.
- Prochaine étape : attendre O.

## 2026-11-09 20:26 — runbook 0.1 corrigé, contexte actualisé, brouillon semaine 10–14
- runbook-ci-rouge.md 0.1 : composants Actions + API Requests (O : Checks API n'existe pas).
- contexte-application.md : items 2, 3, 4, 6 et 3 risques actualisés au 09/11 soir (P8 VAL-D1..D3, C9 API livrée, sauvegarde lun 17 + 18/20, #46, seed one-shot, ordre #39→#42→#47→#48→rôles, marge 0,05, VM 12 Go, D2 seuil 0,25).
- plans/semaine-2026-11-10.md (brouillon, à valider par O) : un tableau par jour 10→14 par session (livrable, dépendance, preuve), Déduit marqué ; signale que le 10/11 est un lundi (libellés mar 10/mer 11/jeu 12 des passations décalés d'un jour, dates font foi).
- Prochaine étape : retour de O sur le brouillon semaine.
- Correctif : 10/11 = mardi (les passations avaient raison) ; en revanche 14/11 = samedi, 17/11 = mardi, 30/11 = lundi → libellés lun 17 / sam 29 / dim 30 de DEC-002 et checklist faux ; signalé à O pour trancher dates vs jours ; en-têtes du plan semaine corrigés.

## 2026-11-09 20:31 — seed : état livré PR #50 reporté
- dev-backend : option A livrée (PR #50) ; écarts justifiés : api/worker dépendent de migrate (scale seed=0 possible), create_all gardé jusqu'à la bascule ci-qa « upgrade head puis seed » ; bloc e2e → ci-qa.
- jeu-donnees-demo.md § 7 : paragraphe « État livré » ajouté (+ consigne H-30 : attendre Exited 0 du conteneur seed avant login MGR001) ; README mis à jour. Message à O.

## 2026-11-09 22:15 — calendrier tranché par O, plan semaine validé et corrigé
- O : dates font foi partout ; point S1 ven 13 soir (sam 14 en réserve PO). Script f15.py : libellés de jours recalés sur les dates (regex jour+date, 9→30/11) dans innovateur/*.md, DEC-002 et les blocs innovateur de point-2026-11-14.md : 71 lignes (bien > 10 : le décalage était systémique, toutes les fiches supposaient 10/11 = lundi) ; matrice : ven 14 → ven 13.
- Lignes 13-59 de point-2026-11-14.md (texte d'O) portent le même décalage : non touchées, signalé à O.
- semaine-2026-11-10.md : 6 corrections d'O appliquées (#42/#44/#46 retirées, O mar #45→#47→#39, jeu #48→#50, B mer = #50 relue, Q bascule préparée mer, I mar PR #49, F mer SMK-10+a11y, samedi fondu dans vendredi soir + ligne réserve sam 14, mar 17) ; 48 lignes.
- Consigne O : rien de nouveau sans demande → attente.

## 2026-11-09 22:19 — contrôle liens/tableaux (lecture seule) pour O
- Script scratchpad lint_md.py (python -I -X utf8) sur 36 fichiers (innovateur/, plans/, DOCS/engineering/) : 0 lien relatif cassé ; 1 tableau irrégulier : goulot-vm-docker.md:37 (ligne E, 5 cellules au lieu de 6, « 0 j, accord PO » fusionne prérequis et coût). Non corrigé (consigne lecture seule), signalé à O.
- Attente : PR docs suivante après #47.
- 22:21 : goulot-vm-docker.md:37 scindée (prérequis | coût), lint rejoué = aucun ; note « contrôle liens/tableaux markdown : candidat check CI docs V1.1 » ajoutée dans DOCS/engineering/README.md (Pattern catalog) ; lint_md.py gardé en scratchpad. Attente : compte rendu point S1 ven 13 ou imprévu.

## 2026-11-09 22:27 — spec-a11y-contrast.md pour dev-frontend
- Détail axe absent des .md du rapport (compte seul) mais présent dans les traces (trace.zip → attachments axe-login.json / axe-dashboard.json), extraites en scratchpad (traces/, axe.py). 5 nœuds color-contrast : login slate-400 « Espace Démo Interactif » 2,56 ; dashboard admin Logo slate-400 2,53, OrgDashboard green/blue/red-500 2,17 / 3,37 / 3,44 (requis 4,5). Un run comptait 5 sur dashboard : 5e non tracée, candidat Header.tsx:191 (Déduit).
- Fiche : tableau par nœud (page, sélecteur, couleurs, ratio, composant grep, token cible, ratio recalculé WCAG), jeu unique slate-400→500, *-500→*-700 (-600 insuffisant vert/rouge), preuve attendue. README à jour, lint = aucun. Message à O. Attente.

## 2026-11-09 22:35 — spec-ingest-racines-autorisees.md pour dev-backend
- Fiche complète (développe spec-limite-upload § 5) : risque CWE-22, état actuel Vérifié (documents.py:1440-1459, ingestion.py:113/151-169, config.py:45-46 sans racine, aucun montage /data/ingest dans les deux compose), contrat INGEST_ALLOWED_ROOTS (défaut vide = tout refusé, os.pathsep, realpath+commonpath, relatif vers la première racine, symlinks fichiers ignorés + errors, 403 INGEST_PATH_FORBIDDEN justifié vs 400), impact démo (montage :ro, reset demo dépend de la PR B), 9 tests, SC-ADM-08 + SC-SEC-05 à ajouter à la matrice à la fusion, 0,25 j.
- README à jour, lint = aucun. Message à O. État : toutes les demandes d'O traitées, aucun verrou ; prochaine étape : attendre (point S1 ven 13 ou imprévu), puis ajouter SC-SEC-05 dans matrice-recette.md quand la PR B est fusionnée.

## 2026-11-09 22:36 — en cours : spec-validation-cycle-ui.md (P8, dev-frontend)
- Demande O : fiche 6 sections (parcours écran par écran, écarts Vérifié fichier:ligne, sélecteurs des specs, états, acceptation/budget +0,7 j, ordre pour e2e jeu 12). Sources : PASSATION-dev-backend 20:16, gh pr diff 51 et 48, frontend/e2e/validation-cycle.spec.ts, écrans frontend. Verrous : aucun. Si reprise : vérifier si la fiche existe déjà avant de la réécrire.

## 2026-11-09 22:43 — livré : spec-validation-cycle-ui.md (P8, dev-frontend)
- Fiche 6 sections (parcours, écarts Vérifié fichier:ligne, sélecteurs spec, états, acceptation/budget 0,45 j F, ordre mar 10 → jeu 12). Point clé : la spec SC-VAL-01 écran cherche l option `MGR001` alors que `/validators` ne renvoie que `full_name` → spec à faire évoluer (sélection par `value`), contrat gelé respecté. `ValidationHub.tsx:36` lit des champs inexistants → `item.document?.current_version_id`. Ligne README ajoutée, lint relancé. Message O envoyé. Verrous : aucun. À suivre : attente O (point S1 ven 13) ; SC-SEC-05 dans la matrice à la fusion de la PR ingest.

## 2026-11-09 22:54 — livré : lignes matrice SC-SEC-05 / SC-A11Y-01-02 + dependabot-35.md
- matrice-recette.md : SC-A11Y-01/02 (l.27, PR F fix/recette-smoke-2, mer 11) et SC-SEC-05 (l.38, PR B fix/ingest-allowed-roots, jeu 12) marquées « À livrer ». dependabot-35.md : aucun GHSA ; zustand mineure sans impact (create seul) ; @playwright/test 1.65 casse l image `mcr.microsoft.com/playwright:v1.64.1-noble` épinglée dans ../GED237-e2e/docker-compose.e2e.yml:100 → reco reporter après le 30/11, PR laissée ouverte. README mis à jour, lint vert, message O. Verrous : aucun. Prochaine étape : attente réelle jusqu au point S1 ven 13.

## 2026-11-09 23:19 — jeu-donnees-demo.md § 7 : écart (c) types d unité (#50, 6698241)
- Une phrase ajoutée au paragraphe « État livré » : seed réconcilie les 7 codes majuscules des migrations, compteurs de preuve, conséquence D1 = aucun nouveau type. Lint vert. Verrous : aucun. Prochaine étape : attente réelle jusqu au point S1 ven 13.

## 2026-11-10 00:45 — protocole-ocr-0.md : 5 écarts ci-qa (répétition à blanc) reportés
- § 2 T-best dossier /opt/tessdata_best + --tessdata-dir ; § 2 R PP-OCRv6 small multilingue, pas de lang_type, BGR ; § 3 ligne Threads = quota cgroup ; § 4 ligne EasyOCR OOM à 1 Go ; § 6.1 GED_EXPORT_OUT à vérifier, seed e2e = outillage seul ; § 7 outillage ci/ocr-0-bench. Lint vert. Réponse à ged-ci-qa + copie O. Verrous : aucun. Prochaine étape : attente point S1 ven 13 (OCR-0 exécuté ven matin).

## 2026-11-10 00:47 — DEC-2026-003 : ligne critère révisé « Proposé » (PO, point S1)
- Ligne ajoutée au tableau des lots (E hors budget mémoire ; D3 = pic R < 1 Go ET CER R ≤ CER T-best, débit R noté) ; protocole-ocr-0.md § 4 aligné. Statut Proposé, le PO tranche au point S1 ; O l ajoute aux verrous PO. Lint vert. Verrous : aucun. Prochaine étape : attente réelle jusqu au point S1 ven 13.

## 2026-11-10 00:49 — accusé ci-qa OCR-0
- ci-qa : points notés pour le walkthrough du 13 (R vs T-fast/T-best, verdict « E hors budget mémoire ») ; rapidocr==3.10.0 épinglé dans Dockerfile.bench, versions.txt ; outillage commité en local sur ci/ocr-0-bench (057802e). Rien à produire. Verrous : aucun. Prochaine étape : attente réelle jusqu au point S1 ven 13 (vérif des 6 conditions avant le point).

## 2026-11-10 00:52 — fiche dependabot-35 : mise à jour externe constatée
- `dependabot-35.md` : section « Mise à jour du 2026-11-09 (nuit) » ajoutée par une autre session (#35 fermée, remplacée par **#56** : + @axe-core/playwright 4.11.3 → 4.14.0 ; CI 1 rouge / 8 verts). Décision inchangée (report après le 30/11, image Playwright à monter en même temps). Lint vert, rien à produire. Prochaine étape : attente réelle jusqu au point S1 ven 13.

## 2026-11-10 07:49 — OCR-0 : re-mesure ci-qa threads = 2 reportée
- `protocole-ocr-0.md` § 3 Threads : R 3,2 s/page propre, 2,5 dégradé, pic 721 Mo, démarrage 3,0 s (avant 9,7 s/page, 858 Mo) ; § 4 EasyOCR : OOM à la 1re page A4 200 dpi après 19,3 s de chargement, même à 2 threads (inférence, pas threads). DEC-003 ligne Proposé inchangée (débit « ≈ 10 s/page » à corriger par O s il le souhaite : ≈ 3 s/page). Message O + ci-qa. Prochaine étape : attente réelle jusqu au point S1 ven 13.

## 2026-11-10 07:49 — DEC-003 : débit R mis à jour (ligne Proposé)
- Ligne « OCR-0, critère révisé » : débit R ≈ 3 s/page propre (P95 7,7), 2,5 dégradé, pic 721 Mo, threads alignés (re-mesure 10/11) ; statut Proposé inchangé. O recopie protocole + DEC dans la PR docs #57. Prochaine étape : attente réelle jusqu au point S1 ven 13.
