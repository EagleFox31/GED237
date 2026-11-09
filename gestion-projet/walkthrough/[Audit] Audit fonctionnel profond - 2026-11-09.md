# [Audit] Audit fonctionnel profond — GED237 — 2026-11-09

> Statut : DONE (2026-11-09) — audit lecture seule, aucun test exécuté

- **Périmètre** : CDC « Doc Manager » (sept. 2025) + CDC « GED d'entreprise » (21/09/2025) + Expression de besoin, extraits de `design_docs_content.txt` (texte des `.docx` de `Phase de Conception/`).
- **État lu** : branche `docs/equipe-agents` (= `origin/main` 3e05d6c + docs). Lots A et B clos (`PASSATION.md`), Lot C ouvert.
- **Niveaux de preuve** (`gestion-projet/REGLES_DE_TRAVAIL.md` l. 61-65) : aucun « Vérifié » dans cet audit, faute d'exécution. « Documenté » = résultat consigné par une session antérieure (ex. 226 tests verts, couverture 85,16 %, walkthrough Lot B6 du 2026-10-29).

## 1. Synthèse par fonctionnalité du CDC

| # | Fonctionnalité (CDC) | Statut | Preuve | Écart | Effort (j) | Niveau |
|---|---|---|---|---|---|---|
| 1 | Tri auto par règles (type, nom, date, contenu) | partiel | `classification_rule_engine.py:271-369` (type, origine, agent, mots-clés du nom, MIME) ; tests `test_classification_admin.py` (7), `test_rules.py` (1) | Pas de critère **contenu (OCR)** ni **date** ; aucun test unitaire dédié au moteur | 2-3 | Constaté |
| 2 | ≥ 95 % de documents classés | non vérifiable | aucun jeu étalon, aucun harnais | Critère de recette sans mesure | 2 | Documenté (RACI §5) |
| 3 | Priorité des règles + mode simulation | fait | `classification.py:742` `/simulate` ; égalité de priorité `classification_rule_engine.py:136,461` ; `test_classification_admin.py:248` | — | 0 | Constaté |
| 4 | Arborescence service > domaine > activité > année | fait | `space_path_builder.py:37-54`, `spaces.py:18` ; `test_spaces.py:8` | Ordre différent du CDC « année > catégorie » (acceptable, à dire en démo) | 0 | Constaté |
| 5 | Espaces : filtres + pagination serveur (Lot C9) | partiel | `spaces.py:30-43` (seulement `org_unit_id`, `recursive`) ; filtres côté client `SpacesPage.tsx:299-345` | Pas de `domain_id/activity_id/year/status/q`, pas de pagination | 2 | Constaté |
| 6 | Upload manuel | fait | `documents.py:420-581` ; `test_documents.py:8` | — | 0 | Constaté |
| 7 | Surveillance automatique d'un dossier | partiel | `/ingest-directory` `documents.py:1334`, import par lots `imports.py:171-316`, sélection de dossier navigateur (`DirectoryIngestion.tsx`) ; `test_imports.py` (8) | Ingestion ponctuelle, **aucun watcher continu** | 2-3 ou arbitrage PO | Constaté |
| 8 | 100 000 fichiers en < 20 min | non vérifiable | aucun test de charge (`backend/scripts/benchmark_authz.py` ne concerne que l'authz) | NFR sans mesure | 2 | Constaté |
| 9 | Authentification + rôles (admin / utilisateur / lecteur) | fait | JWT + OTP, 7 profils ; `test_auth.py` (4), `test_authz.py` (64) | Logout non couvert en e2e | 0 | Documenté (226 passed, B6) |
| 10 | Droits stricts par rôle **et par service** | partiel | lecture d'un document bornée au service pour manager/lecteur `documents.py:112-123` ; **recherche bornée au tenant seul** `postgres_engine.py:79-101`, sans `authorize_or_403` `search.py:16-36` | Fuite de titres et d'extraits OCR d'autres services ; constats B6 en attente PO (`assignable-roles` sans RBAC `users.py:245`) ; routes front non gardées `App.tsx:190-213` | 1-1,5 | Constaté |
| 11 | Historique des actions (journal) | fait | `audit.py:132` (authz l. 141), `documents.py:659` ; `test_documents_extended_coverage.py:25` | — | 0 | Constaté |
| 12 | Tags | fait (minimal) | saisie à l'upload `documents.py:428,495`, colonne `models/document.py:58`, filtre de recherche `search.py:25` | Pas d'écran de gestion des tags | 0,5 | Constaté |
| 13 | Recherche avancée (plein texte, filtres, métadonnées) | partiel | `search.py:16` (TSVECTOR + GIN) ; barre globale `Header.tsx` ; `test_search.py` (2) | Documents **en corbeille non exclus** (pas de filtre `deleted_at`, `postgres_engine.py:79-101`) ; pas de test de bornes | 0,5 | Constaté |
| 14 | Recherche < 2 s | non vérifiable | `took_ms` renvoyé (`search.py:79`) mais jamais mesuré | Pas de benchmark sur corpus | 1 | Constaté |
| 15 | OCR (évolutivité CDC) | fait | `services/ocr/` (Tesseract, EasyOCR), tâche Celery `documents.py:581` ; `test_ocr_strategy.py` (3) | Coût RAM sur le VPS (voir §4) | 0 | Constaté |
| 16 | Multi-lecture + verrouillage d'édition | fait | `documents.py:1640-1707` ; `test_documents.py:57` | — | 0 | Constaté |
| 17 | Versionnage | fait | `documents.py:922,1493` (anti-doublon de version l. 1537) | — | 0 | Constaté |
| 18 | Corbeille applicative | fait | `documents.py:616,1417-1464` ; `test_documents.py:29`, `test_documents_extended_coverage.py:115` | — | 0 | Constaté |
| 19 | Détection des doublons | partiel | SHA-256 à l'upload `documents.py:459-488`, à l'import `test_imports.py:104,136` ; `test_documents.py:78` | Détection bloquante seulement, pas de vue « doublons » | 1 | Constaté |
| 20 | Tableau de bord (doublons, non classés, activité) | partiel | non classés : `services/analytics/dashboard_facade.py:89` ; `/documents/stats` `documents.py:372` ; `test_analytics.py` (2) | **KPI doublons absent** | 1 | Constaté |
| 21 | Export / import des règles | absent | aucune route dans `classification.py` / `gedrules.py` | Livrable « Mois 5 » du CDC | 1-1,5 | Constaté |
| 22 | Workflows de validation / visa (hors CDC v1) | fait | `workflows.py` (8 routes) ; `test_workflows.py` (15) | Au-dessus du périmètre | 0 | Constaté |
| 23 | Rapports (manager) | fait | `reports.py` (4 routes) ; `test_reports.py` (6) | — | 0 | Documenté (B6) |
| 24 | Interface responsive | non vérifiable | aucune exécution Playwright mobile | Critère de recette n° 1 sans preuve | 1 | Documenté |
| 25 | Interface en français | fait | libellés FR en dur, pas d'i18n (0 fichier `useTranslation`) | Bilingue non prévu | 0 | Constaté |
| 26 | Limite de taille des fichiers | partiel | `client_max_body_size 100M` `nginx/nginx.conf:13` ; `MAX_UPLOAD_SIZE` `core/config.py:46` **jamais lu** | Appel direct à l'API sans plafond | 0,5 | Constaté |
| 27 | HTTPS | absent (dans le dépôt) | `nginx/nginx.conf` sans TLS | À porter par Caddy sur le VPS, non prouvé | 0,5-1 | Constaté |
| 28 | Déploiement on-site + démo VPS | non vérifiable | `docker-compose.yml` (postgres, redis, migrate, api, worker, frontend, nginx) ; dossier `deployment/` cité par le RACI **absent** | GED237 absent de la liste des services hébergés sur le VPS | 2 | Constaté |
| 29 | Disponibilité ≥ 99 % | absent | `/health` `main.py:86`, aucune sonde | Pas de mesure | 1 | Constaté |
| 30 | Sauvegardes + restauration testée | absent | seuls `backend/scripts/backup_policies.py` / `restore_policies.py` (politiques authz) ; aucun `pg_dump` ni sauvegarde du stockage | Critère de recette explicite non couvert | 2 | Constaté |
| 31 | Docs utilisateur / admin / technique | partiel | `DOCS/GUIDE_UTILISATEUR_PAR_PROFIL_GED237.md`, `Phase de Conception/GUIDE_CREATION_INSTITUTION.md`, `backend/README.md` | Manuel d'installation et d'exploitation incomplet | 1-2 | Documenté |
| 32 | Front connecté à l'API | fait | `frontend/services/resources/*.api.ts` ; `tsc` OK (AUDIT 2026-10-27) | Bundle 1,56 Mo sans découpage | 0 | Documenté |

## 2. Top 10 des écarts bloquants pour la démo du 30/11 (par risque)

| Rang | Écart | Risque démo | Recommandation | Effort (j) |
|---|---|---|---|---|
| 1 | Recherche bornée au tenant seul et corbeille incluse (`postgres_engine.py:79-101`, `search.py:16`) | Un lecteur voit des titres et extraits OCR d'un autre service : contredit « droits stricts » en direct | Réutiliser la portée de `_can_read_document` + filtre `deleted_at IS NULL` dans le moteur, avec test de bornes par rôle | 1 |
| 2 | Aucune campagne Playwright verte : IDs toujours désalignés (`security-isolation.spec.ts:22-47`, `redacteur.spec.ts:50-130`, `super-admin.spec.ts:24-58`), 12 specs avec `skip`, 4 avec mocks, e2e absent de la CI, dernier run `failed` | Parcours de démo jamais répétés de bout en bout | Figer 8 à 10 parcours de démo, les réaligner sans mock et les exécuter dans Docker avant le gel du 24/11 | 3-4 |
| 3 | Sauvegarde et restauration absentes | Critère de recette CDC explicitement « non fait » | Script `pg_dump` + archive du stockage, restauration rejouée sur base vierge, preuve datée | 2 |
| 4 | Démo VPS + HTTPS non prouvés (pas de `deployment/`, pas de TLS) | Pas d'URL de démo stable le jour J | Bloc Caddy + compose plafonné en RAM sur le VPS, répétition documentée (accord PO requis pour toucher au VPS) | 2 |
| 5 | Espaces sans filtres ni pagination serveur (`spaces.py:30-43`) | Lenteur ou chargement complet sur un corpus de démo réaliste | Fermer Lot C9 : filtres + pagination, brancher `SpacesPage` | 2 |
| 6 | Chiffres CDC non mesurés (≥ 95 % classés, < 2 s, 100k < 20 min) | Question attendue du commanditaire sans réponse chiffrée | Corpus étalon + script de mesure ; présenter les résultats réels, même partiels | 3 |
| 7 | Règles sans critère contenu/date ; export/import des règles absent | Écart visible avec la promesse « tri selon type, nom, date, contenu » | Ajouter un critère « mots-clés dans le texte OCR » ; sinon l'annoncer explicitement hors V1 | 2-3 |
| 8 | KPI doublons absent du tableau de bord | Un item nommé du CDC manque à l'écran | Compteur des doublons détectés (import + upload) dans le tableau de bord admin | 1 |
| 9 | Constats authz B6 en attente PO + routes front non gardées (`App.tsx:190-213`) | Un profil non admin qui ouvre une URL admin tombe sur une page vide ou en erreur | Décision PO sur B6, puis garde de route par profil (Lot D13) | 1 |
| 10 | Plafond de taille non appliqué par l'API (`config.py:46` inutilisé) | Faible en démo, réel en pilote | Contrôler `MAX_UPLOAD_SIZE` pendant l'écriture par blocs (`storage/local.py:44`) → 413 | 0,5 |

Total estimé : ~17-19 jours-personne, au-delà de la capacité avant le gel du 24/11 → le PO doit choisir entre corriger et annoncer explicitement l'écart (rangs 6, 7, 8).

## 3. Couverture UAT (matrice : `gestion-projet/MATRICE_UAT_E2E_2026-07-22.md`, 37 scénarios)

Relevé des IDs actuellement présents dans `frontend/e2e/specs/` (dernière modification des specs : 2026-10-28). Aucun spec exécuté dans cet audit.

| Famille | Scénarios | Couvert par un e2e (sens correct) | Couvert seulement au niveau API (pytest) | Non couvert ou désaligné |
|---|---|---|---|---|
| AUTH | 3 | 0 (`auth.spec.ts` sans ID) | 01, 02 (`test_auth.py:58,78`) | 03 (logout) |
| RED | 5 | 0 | 01 (`test_documents.py:8`) | 02-05 désalignés (`redacteur.spec.ts`) |
| VAL | 5 | 01-05 partiels (`validation.spec.ts`, avec `skip`) | 02-04 (`test_workflows.py`) | 05 signature conditionnelle |
| RESP | 2 | 0 | — | 01, 02 |
| ADM | 9 | 0 sous ID UAT (IDs maison `SC-ADM-RULES/REVIEW/USERS…`) | 03 (`test_org_units`), 04 (`test_users`), 05, 07 (`test_classification_reviews`), 08 (`test_imports`) | 01, 02 (export KPI), 06, 09 |
| PLAT | 4 | 01 | — | 02-04 désalignés (`super-admin.spec.ts`) |
| LEC / AUD / NOT | 3 | 0 sous ID UAT (`SC-LEC-02`, `SC-AUD-02` maison) | AUD-01 (`audit.py` via `test_documents_extended_coverage`) | LEC-01, NOT-01 |
| E2E | 3 | 01 partiel (`full-cycle.spec.ts`) | — | 02, 03 |
| SEC | 3 | 0 (sens toujours faux : `security-isolation.spec.ts:22-47`) | 01 isolation (`test_authz.py:202`, `test_users` 404) | 02 approve → 403, 03 doc signé immuable |
| **Total** | **37** | **~7 partiels, 0 couvert de façon convaincante et exécuté** | ~13 au niveau API | ~17 sans aucune preuve automatisée |

Constat : les collisions d'ID signalées en juillet (P0 de la matrice) **ne sont pas corrigées** ; Playwright ne tourne dans aucun workflow (`.github/workflows/` : backend, ci, frontend, release-integrity, security) ; `frontend/test-results/.last-run.json` = `failed` (6 tests). Verdict de la matrice inchangé : NO-GO documentaire.

## 4. Risques transverses

- **Sécurité** : recherche hors portée service et corbeille incluse (§2 rang 1) ; HTTPS hors dépôt ; plafond d'upload seulement au niveau nginx ; constats B6 non arbitrés.
- **Données** : aucune sauvegarde de la base ni du stockage, `purge` définitive disponible (`documents.py:1464`) ; une erreur pendant la démo est irréversible.
- **Performance** : Espaces sans pagination ; bundle 1,56 Mo ; worker OCR (torch/EasyOCR, `--concurrency=2`) sur un VPS de 3,7 Go déjà partagé → risque de manque de mémoire (Déduit, à mesurer avec `free -m`).
- **UX** : profils lecteur / collaborateur / manager limités à un tableau de bord + pages partagées ; composants géants (`DirectoryIngestion.tsx` > 2 400 lignes) ; 488 avertissements lint plafonnés ; pas de garde de route.
- **Qualité** : backend solide (226 tests, 85 % de couverture — Documenté) mais **0 test unitaire frontend et 0 e2e en CI** ; la preuve « parcours métier » repose entièrement sur une répétition manuelle.

## 5. Checklist RAIDER (audit)

- **R / A** : grille réutilisable (fonctionnalité → preuve → niveau), sans hypothèse d'environnement.
- **I** : lecture seule, rejouable ; aucune écriture hors de ce fichier.
- **D** : aucun code modifié ; `AUDIT.md` reste la source de vérité. Ce document l'alimente (Lot C), il ne le remplace pas.
- **Mémoire d'échecs** : consultée (LESSON-2026-001 à 018). Rien de nouveau à consigner.
- **E / exécution ciblée** : non applicable (aucun gate déclenché).
- **Rétroactif** : aucun état existant touché ; le fichier non suivi `[Gemini] Etat de sante…` est laissé tel quel.
