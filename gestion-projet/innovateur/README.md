# Base de connaissance de l'Innovateur

Dossier tenu par la session `innovateur` (voir `../EQUIPE_AGENTS.md`). Chaque fiche porte une date de
consultation et un niveau de preuve (`Vérifié` / `Documenté` / `Déduit` / `Proposé`, cf.
`../REGLES_DE_TRAVAIL.md`). Les décisions instruites ici sont consignées dans `../decisions/DEC-*`.

| Fiche | Contenu |
|---|---|
| `parcours-demo.md` | 8 parcours de démo cibles (rôle, étapes, UAT, spec Playwright, données), 12 candidats classés, 3 décisions demandées |
| `contexte-application.md` | Ce qu'est GED237, état réel au 2026-11-09 (audit fonctionnel intégré), risques, ce qui reste pour le 30/11 |
| `plan-presentation.md` | Déroulé 20 min du 30/11, messages ISO 15489, 15 écarts annoncés consolidés le 09/11, questions du jury |
| `decision-po-vps-b6.md` | Dossier PO **tranché le 09/11** : démo sur place (A), B6 garde minimale (B1), constats backend en V1.1 |
| `triage-dependabot-35.md` | PR #35 (zustand 5.1.0, @playwright/test 1.65.0) : fusionner |
| `jeu-donnees-demo.md` | § 7 (09/11 soir) : chemin de seed de la pile démo, reco service one-shot `seed`, état livré PR #50 (api/worker dépendent de migrate, create_all gardé jusqu à la bascule ci-qa, retiré par #60 le 10/11) ; Jeu de démo du 20/11 : arborescence, 420 documents, états, 10 règles IFTTT, procédure ci-qa |
| `sauvegarde-restauration.md` | Ordre 5 : § 6 (09/11 soir) voie V1 = `backup.sh`/`restore.sh` maison ≤ 0,25 j B, deux restaurations prouvées (10 et 20/11), point de reprise démo ; offen → V1.1 ; étude initiale : Adopt offen + `restore.sh`, plan 0,75 j B + 0,5 j Q |
| `protocole-ocr-0.md` | Benchmark OCR-0 pour ci-qa (14/11) : corpus, 4 configurations, CER jiwer, pic mémoire, seuils DEC-003, tableau |
| `branches-distantes.md` | Inventaire des 19 branches distantes : 13 supprimables sur accord PO, 6 gardées ; aucune suppression faite |
| `checklist-demo.md` | Cases à cocher J-1 / J0 (qui, quand) : DEBUG, limites auth, corpus pré-OCRisé, worker éteint, poste de secours, sauvegarde, plan B, comptes |
| `spec-a11y-contrast.md` | Pour dev-frontend (PR fix/recette-smoke-2, mer 11) : 5 violations axe color-contrast mesurées (login 1, dashboard admin 4) + 1 déduite, couleurs/ratios lus dans les pièces jointes des traces, composants retrouvés par grep, un seul jeu de tokens Tailwind (slate-500, *-700), preuve attendue |
| `spec-ingest-racines-autorisees.md` | Pour dev-backend (après le 413, 0,25 j) : risque de lecture arbitraire via l'import de répertoire, comportement actuel fichier:ligne, contrat INGEST_ALLOWED_ROOTS (défaut tout refusé, realpath + commonpath, relatif à la première racine, symlinks, 403 INGEST_PATH_FORBIDDEN justifié), montage /data/ingest:ro dans les deux compose, 9 tests, acceptation SC-ADM-08 |
| `spec-validation-cycle-ui.md` | P8 jouable a l'ecran pour dev-frontend (`fix/validation-cycle-ui`, 0,45 j) : parcours ecran par ecran, ecarts VAL-D1..D3 fichier:ligne, selecteurs de `uat/validation-cycle.spec.ts` a respecter ou faire evoluer, etats (aucun valideur, version nulle, 403, reseau), acceptation SC-VAL-01..04, ordre pour e2e jeu 12 (09/11 soir) |
| `dependabot-35.md` | PR #35 Dependabot (groupe npm frontend : zustand 5.0.16 → 5.1.0, @playwright/test 1.64.1 → 1.65.0) : avis de sécurité, surface réelle, risque de rupture (image `mcr.microsoft.com/playwright:v1.64.1-noble` épinglée dans `docker-compose.e2e.yml`), preuve minimale, recommandation (09/11 soir) |
| `spec-limite-upload.md` | Ordre 2 : plafond d'upload jamais appliqué → compteur dans le stockage, 413 Problem Details, nginx aligné, test minimal (B 0,5 j) ; § 5 : `ingest-directory` borné à `INGEST_ALLOWED_ROOTS` (realpath, 403, B 0,25 j) |
| `release-demo.md` | Ordre 6 : aucun tag à ce jour ; reco tag manuel `v1.0.0-rc.N` + release GitHub (SBOM signé via release-integrity), Release Please appfactory en V1.1 |
| `spec-garde-routes.md` | Ordre 6 (PO : B1) : 8 routes admin gardées par profil (super / tenant), redirection + message court, F5 sans flash, 6 cas Playwright ; confort UI, sécurité = API |
| `spec-espaces-filtres-ui.md` | Ordre 4 UI : SpacesPage sur le contrat #38 (5 filtres ordonnés, état dans l'URL, q serveur, X-Total-Count, pagination 50 sacrifiable, états vides FR) |
| `matrice-recette.md` | Table de vérité 14/11 et 30/11 : 8 parcours × 22 scénarios UAT, spec existante (réelle/skip/mock), preuve, responsable, état 09/11 avec SMK-01..10, cible ; 2 scénarios sans preuve avant le 24 (entrée D2), collisions d'ID à acter |
| `goulot-vm-docker.md` | VM Docker 3,8 Gio / 29 conteneurs (25 étrangers) ; cause réelle = fixture drop_all/create_all par test (194 tests, 18 min) ; reco A fixture session + B xdist 2 workers (0,5 j B), règle de file e2e exclusif / pytest + tsc coexistent |
| `criteres-acceptation.md` | I2 : 7 critères de recette contractuels (cadrage § 8) traduits en mesures + un critère observable par scénario des 8 parcours (mêmes ID que la matrice) ; scénarios du guide hors démo et ce qu'on dit au jury |
| `protocole-mesures-criteres.md` | File 7 : mesure de C2 (≥ 95 % classés : dénominateur, SQL + script manifeste), C3 (10 requêtes figées, took_ms p95 < 2 s, 30 mesures) et C6 (10 relevés /health + docker ps en S2) ; commandes, sortie, seuil GO/NO-GO, où consigner ; ≈ 0,5 j Q |
| `sources/concurrents-ged.md` | Alfresco 26.1, Nuxeo LTS 2025, Paperless-ngx 3.x, Maarch : comparatif, 3 différenciateurs défendables, objections du jury, réponses ; sources datées 09/11 |
| `deroule-demo.md` | File 12 : déroulé minute par minute du 30/11 (20 min) : ordre P1→P2→P3→P6→P4→P5→P8→P7, deux fenêtres navigateur, profils et données du seed par parcours, transitions, repli manuel/API/capture, 8 questions jury en une phrase + écart, deux moments d'écarts dits volontairement ; renvoie à checklist, matrice, plan sans les recopier |
| `decisions-po-2026-11-10.md` | Fiche de décisions PO (une page, 10/11) : D2 seuil 0,25 j, D3 révisée, D5 branches, date du point S1, Celery (LESSON-026 / #75), renommage des 25 fichiers au préfixe proscrit ; options, recommandation, impact si rien n'est décidé avant le 19/11 18:00. |
| `instruction-decisions-14-11.md` | File 10 : D1–D6 du point du 14 : faits au 09/11, à vérifier le 13 au soir, options, recommandation en une phrase, effet sur la présentation ; synthèse à coller en § 2 |
| `sources/anthropic-agents.md` | Sources primaires sur les équipes d'agents, harness, contexte |
| `sources/github-agents-skills.md` | Dépôts GitHub d'agents, skills, outils : évaluation Adopt/Adapt/Learn/Build |
| `sources/ocr-leger.md` | Veille OCR CPU 2026-11-09 : comparatif, architecture légère (RapidOCR/PP-OCRv6 + OCRmyPDF, retrait EasyOCR), lots OCR-0..4 |
| `sources/ged-normes.md` | Normes GED/archivage (ISO 15489, MoReq2010) et contexte Cameroun |

Règles du dossier : une fiche par sujet, URL + date pour chaque affirmation externe, mise à jour en
place (pas de doublon), jamais de secret ni de donnée personnelle.

À compléter en S1 : analyse du CDC (`DOCS/engineering/*.pdf|docx`) en critères d'acceptation,
concurrents (Alfresco, Nuxeo, Paperless-ngx, Maarch) pour positionner la démo, trame de présentation.
| `specs-v11-avant-gel/lot-1-kpi-doublons.md` | Lot 1 (révision DEC-002 du 10/11) : clé `duplicates` de `GET /analytics/tenant`, carte « Doublons refusés », 4 cas pytest + e2e, livré si fusionné le 19/11 18:00 |
| `specs-v11-avant-gel/lot-2-export-import-regles.md` | Lot 2 : export/import JSON des règles de classement par codes (sans UUID), `dry_run` + rapport, 7 cas pytest + e2e, livré si fusionné le 19/11 18:00 |
| `specs-v11-avant-gel/lot-3-export-journal-verrou-otp.md` | Lot 3 : 3a export CSV du journal d'audit (`/audit/logs/export`, export journalisé) ; 3b verrou Redis par compte après 3 OTP (423 `ACCOUNT_LOCKED`, 15 min) ; 10 cas pytest + 2 e2e, livré si fusionné le 19/11 18:00 |
| `specs-v11-avant-gel/lot-4-criteres-contenu-date.md` | Lot 4 : critères `content_pattern` et `year_min`/`year_max` des règles (migration, 2 contrôles de plus, reclassement après OCR des documents restés `pending`), 7 cas pytest + e2e, dépend du lot 2, livré si fusionné le 19/11 18:00. |
| `specs-v11-avant-gel/lot-5-surveillance-dossier.md` | Lot 5 : surveillance continue d'un dossier par tâche Celery beat configurée (`INGEST_WATCH_FOLDERS`), réutilise `DirectoryIngestionService`, déduplication par empreinte, `_traites/`, `GET /documents/ingest-watch/status`, 8 cas pytest + recette, livré si fusionné le 19/11 18:00. |
| `specs-v11-avant-gel/grille-relecture.md` | Grille de relecture des PR des cinq lots : § 0 commun, une checklist par lot (contrat, idempotence, tests, non-régression ; lot 4 avant/après OCR, lot 5 sous racines autorisées), § 6 mises à jour à chaque fusion. |
