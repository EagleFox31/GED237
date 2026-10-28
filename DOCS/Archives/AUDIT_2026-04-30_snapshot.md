# AUDIT PROJET - SOURCE DE VERITE UNIQUE

> Date de reference : 2026-04-30
> Statut : document autoritatif sur l'etat reel du projet
> Scope : depot complet (`frontend`, `backend`, CI/CD, documentation de conception)
> Methode : lecture directe du code, inventaire des endpoints/tests/migrations, verification locale ciblee (`npm run build`, `npm run typecheck`, `python3 -m compileall app`)

## Regle documentaire

Ce fichier est la seule source de verite pour l'audit courant du projet.

- Les snapshots d'audit precedents sont archives dans `DOCS/Archives/`.
- Les documents de `Phase de Conception/` restent des documents de cadrage et de planification, pas une preuve de livraison.
- Toute nouvelle evaluation du projet doit mettre a jour ce fichier, pas creer un nouvel audit concurrent.

## Synthese executive

GED237 dispose d'un socle applicatif substantiel et exploitable : authentification MFA, RBAC centralise, multi-tenant, gestion documentaire, workflow, audit, OCR, recherche, CI/CD et mecanismes V1 d'import, classement et espaces documentaires.

La situation du 2026-04-30 est plus avancee que celle de l'audit du 2026-04-28 :

- le flux backend `imports/analyze -> imports/{job_id}/commit` est present dans le code, mais pas encore fiable a l'execution
- les pages frontend V1 `ingestion`, `spaces`, `classification-reviews` et l'administration de classement sous `/rules` sont presentes
- `npm run typecheck` passe sur le frontend

La V1 n'est toutefois pas totalement "terminee" au sens stabilisation finale :

- le contrat reel de certaines routes diverge du plan initial
- `spaces` n'expose pas encore les filtres metier complets cote backend comme prevu dans le plan
- la recette backend integree n'a pas ete rejouee ici faute d'environnement de test prepare
- le build frontend conserve des warnings de finition

### Verdict court

- Backend : avance, mais avec des incoherences runtime sur certains services V1.
- Frontend : build et typecheck verts au 2026-04-30.
- V1 Import/Classement : surfaces, routes et ecrans principaux presents, mais certaines briques backend restent a corriger avant de parler de flux operationnel de bout en bout.
- Documentation : `AUDIT.md` est remis en phase avec le code ; plusieurs documents de conception ont ete reajustes pour refleter les routes et ecrans reels.

## Mesures observees

| Indicateur | Observation au 2026-04-30 |
|---|---|
| Routes backend detectees | 110 |
| Tests backend detectes | 118 |
| Specs E2E Playwright detectees | 25 |
| Migrations Alembic detectees | 21 |
| Build frontend | OK avec warnings |
| Typecheck frontend | OK |
| Compilation Python a froid | OK via `python3 -m compileall app` |
| README racine | present |

## Verifications executees

### Frontend

Commandes verifiees localement :

```bash
cd frontend
npm run build
npm run typecheck
```

Resultat :

- `npm run typecheck` passe.
- `npm run build` passe.

Warnings de build observes :

- reference a `/index.css` non resolue au build dans `frontend/index.html`
- bundle principal `dist/assets/index-*.js` au-dessus du seuil de warning Vite/Rollup

### Backend

Verification statique executee :

```bash
cd backend
python3 -m compileall app
```

Resultat :

- pas d'erreur de compilation Python detectee sur les modules parcourus

Limite importante :

- la suite `pytest` n'est pas runnable sans preparation de l'environnement, car `backend/tests/conftest.py` exige `TEST_DATABASE_URL`, et certains tests s'appuient sur Redis

## Etat reel de la V1 Import, Classement et Espaces GED

References produit :

- `Phase de Conception/PLAN_TECHNIQUE_V1_IMPORT_CLASSEMENT_GED.md`
- `Phase de Conception/BACKLOG_SPRINT_V1_IMPORT_CLASSEMENT_GED.md`

### Sprint 1 - Fondations de classification

Statut : implemente.

Elements constates dans le code :

- modeles `classification_domain`, `classification_activity`, `classification_rule`
- enrichissement du modele `Document`
- migration `7d6e5c4b3a21_add_document_classification_foundations.py`
- schemas `document.py`, `classification.py`, `classification_admin.py`, `classification_review.py`

### Sprint 2 - Moteur de classification backend

Statut : implemente.

Elements constates dans le code :

- `backend/app/services/classification_rule_engine.py`
- `backend/app/services/space_path_builder.py`
- endpoint `POST /api/v1/classification-rules/simulate`

### Sprint 3 - Import batch pilote

Statut : structure implementee et corrigee dans le code courant, sans validation `pytest` rejouee dans cet audit.

Elements constates dans le code :

- modeles `ImportJob` et `ImportJobItem`
- migrations `9c3f1a2b4d6e_add_import_jobs_and_items.py`
- endpoints presents :
  - `POST /api/v1/imports/analyze`
  - `POST /api/v1/imports/{job_id}/commit`
  - `GET /api/v1/imports/{job_id}`
  - `GET /api/v1/imports/{job_id}/items`
- services :
  - `backend/app/services/import_analysis_service.py`
  - `backend/app/services/import_execution_service.py`
- couverture :
  - `backend/tests/api/test_imports.py`

Nuance importante :

- le flux applique maintenant le mode metier retenu :
  - `analyze`
  - `commit/import`
  - mise en bannette des items ambigus
  - finalisation des items ambigus apres arbitrage humain
- les items `classified` sont stockes definitivement au `commit`
- les items `pending` et `needs_review` restent en staging et ouvrent des `classification_reviews` lies aux `import_job_items`
- la finalisation de ces items se fait a la resolution de la review

Limite de verification :

- cette correction a ete verifiee par lecture de code, compilation Python a froid et typecheck frontend, pas encore par `pytest`

### Sprint 4 - Refonte UI import de masse

Statut : largement implemente.

Elements constates dans le code :

- `frontend/profiles/tenant-admin/pages/DirectoryIngestion.tsx`
- parcours en 2 temps `analyser -> importer`
- champs : `source_scope`, `processing_mode`, `target_org_unit_id`, `target_user_id`, `default_document_category_id`, `forced_year`
- preview par fichier avec statuts `classified`, `pending`, `needs_review`, `duplicate`, `ignored`
- resultat final de commit
- spec UI :
  - `frontend/e2e/specs/ingestion.spec.ts`

### Sprint 5 - Espaces documentaires V1

Statut : partiellement implemente par rapport au contrat cible.

Elements constates dans le code :

- endpoints :
  - `GET /api/v1/spaces/tree`
  - `GET /api/v1/spaces/documents`
- page :
  - `frontend/profiles/tenant-admin/pages/SpacesPage.tsx`
- filtres UI presents :
  - domaine
  - activite
  - annee
  - statut GED
  - statut de classement
  - type
  - categorie
- affichage :
  - `logical_space_path`
  - `classification_status`
  - labels domaine / activite / annee

Ecart principal :

- `GET /api/v1/spaces/documents` ne porte pas encore les filtres metier serveur promis dans le plan
- l'endpoint delegue aujourd'hui au workspace documentaire existant avec `org_unit_id` et `recursive`
- le filtrage domaine/activite/annee/statut est majoritairement applique cote frontend apres chargement

### Sprint 6 - Revue manuelle de classement

Statut : structure implementee et corrigee dans le code courant, sans validation `pytest` rejouee dans cet audit.

Elements constates dans le code :

- endpoint `GET /api/v1/classification-reviews`
- endpoint `POST /api/v1/classification-reviews/{review_id}/resolve`
- service `backend/app/services/classification_review_service.py`
- page `frontend/profiles/tenant-admin/pages/ClassificationReviewPage.tsx`
- compatibilite legacy : `/needs-review` redirige vers `/classification-reviews`
- couverture :
  - `backend/tests/api/test_classification_reviews.py`
  - `frontend/e2e/specs/classification-reviews.spec.ts`

Nuance d'implementation :

- la revue couvre desormais deux sources :
  - `Document` deja cree
  - `ImportJobItem` encore en staging
- la resolution d'une review sur `ImportJobItem` cree alors le document final, sa version et supprime le staging

Limite de verification :

- cette correction a ete verifiee par lecture de code et compilation, pas encore par execution de la suite backend

### Sprint 7 - Administration des regles de classement

Statut : implemente.

Elements constates dans le code :

- backend :
  - `backend/app/api/v1/endpoints/classification.py`
  - `backend/tests/api/test_classification_admin.py`
- routes reelles :
  - `GET|POST|PATCH|DELETE /api/v1/classification-rules/domains`
  - `GET|POST|PATCH|DELETE /api/v1/classification-rules/activities`
  - `GET|POST|PATCH|DELETE /api/v1/classification-rules/rules`
  - `POST /api/v1/classification-rules/simulate`
- frontend :
  - integration dans `frontend/profiles/tenant-admin/pages/GEDRulesPage.tsx`
  - sous-module `frontend/profiles/tenant-admin/pages/gedrules/ClassificationSettingsTab.tsx`
  - pas de route frontend dediee `/classification-rules`
- couverture :
  - `frontend/e2e/specs/classification-admin.spec.ts`

### Sprint 8 - Stabilisation et recette

Statut : en cours.

Elements constates dans le code :

- projet Playwright `mocked-chromium` dans `frontend/playwright.config.ts`
- specs mockees dediees :
  - `ingestion.spec.ts`
  - `spaces.spec.ts`
  - `classification-reviews.spec.ts`
  - `classification-admin.spec.ts`
- pipeline frontend avec lint/typecheck/build dans `.github/workflows/frontend.yml`

Reste a faire avant cloture sereine :

- rejouer les tests backend integres sur une vraie base de test preparee
- rejouer les parcours non mockes
- corriger le warning `/index.css`
- reduire le bundle principal ou assumer explicitement le warning

## Forces du projet

### 1. Socle backend deja solide

Le backend couvre deja les domaines critiques suivants :

- auth MFA
- RBAC / authz centralise
- multi-tenant
- gestion documentaire
- workflow
- audit
- notifications
- recherche
- OCR
- analytics
- structures V1 d'import batch
- structures V1 de classement documentaire

### 2. Architecture explicite et lisible

Le depot separe clairement :

- API et services backend
- frontend React/TypeScript
- migrations
- workers
- CI/CD et securite

### 3. Gouvernance DevSecOps presente

Le depot contient deja :

- workflows GitHub Actions backend/frontend/security/gate
- coverage gate backend
- scans de securite (`bandit`, `pip-audit`, `npm audit`, `gitleaks`)
- mecanisme de release integrity / SBOM / signature conditionnelle

## Findings actuels

### P1 - Important

#### 1. Le contrat `spaces` livre reste en dessous du plan fonctionnel cible

Le plan technique de V1 prevoit un endpoint `spaces/documents` capable de filtrer cote serveur par `scope`, `domain_id`, `activity_id`, `year`, `status` et `q`.

Constat au 2026-04-30 :

- l'endpoint reel ne prend que `org_unit_id` et `recursive`
- le frontend applique l'essentiel des filtres metier cote client

Impact :

- contrat backend/frontend moins riche que prevu
- risque de perf et de surchargement reseau sur gros volumes
- decalage entre document de conception et implementation reelle

#### 2. Les tests backend ne sont pas turnkey localement

`backend/tests/conftest.py` exige un `TEST_DATABASE_URL`, et certains tests utilisent Redis. La boucle de verification locale reste donc dependante d'un environnement externe prepare.

#### 3. Le build frontend garde des signaux de dette de finition

Constats observes :

- reference a `/index.css` laissee telle quelle dans `frontend/index.html`
- bundle principal genere au-dela du seuil de warning Rollup/Vite

Impact :

- non bloquant pour builder
- mais signe d'une couche frontend encore a industrialiser

### P2 - Documentation et coherence

#### 4. Plusieurs documents de conception n'etaient plus alignes avec le code

Exemples corriges dans cette mise a jour :

- ancien constat "typecheck frontend KO"
- ancien constat "batch `analyze/commit` absent"
- ancien contrat de routes de classement ne correspondant plus aux endpoints reels
- ancien constat frontend `/needs-review` alors que la route active est desormais `/classification-reviews`

## Findings clos par rapport a l'audit du 2026-04-28

Les constats suivants ne doivent plus etre consideres comme ouverts sans nouvelle reverification :

- `npm run typecheck` frontend est vert au 2026-04-30
- le flux backend `POST /api/v1/imports/analyze` et `POST /api/v1/imports/{job_id}/commit` existe dans le code
- la page frontend d'import en 2 temps existe
- la revue manuelle dediee existe via `/classification-reviews`
- l'administration de classement est exposee dans l'UI via `/rules`

## Decision documentaire

### Source de verite courante

- `AUDIT.md`

### Archives historiques

- `DOCS/Archives/AUDIT_2026-04-13_snapshot.md`
- `DOCS/Archives/AUDIT_2026-04-18_snapshot.md`

## Prochaines actions recommandees

1. Rejouer la suite backend avec `TEST_DATABASE_URL` et Redis prepares pour valider a l'execution le flux `analyze -> import -> review -> finalisation`.
2. Soit enrichir `GET /api/v1/spaces/documents` avec les filtres metier serveur du plan, soit reduire explicitement la promesse documentaire de `spaces`.
3. Corriger le warning `/index.css` et traiter la taille du bundle frontend.
