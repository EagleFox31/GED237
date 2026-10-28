# AUDIT PROJET - SOURCE DE VERITE UNIQUE

> Date de reference : 2026-07-22
> Statut : document autoritatif sur l'etat reel du projet
> Scope : depot complet (`frontend`, `backend`, CI/CD, documentation de conception)
> Methode : inventaire code (`@router.*` dans `backend/app/api/v1/endpoints`, fichiers `tests/api/test_*.py`, revisions Alembic), lecture ciblee des endpoints critiques (`spaces`, `reports`, `imports`), commandes locales `npm run typecheck`, `npm run build`, `python -m compileall app`

## Regle documentaire

Ce fichier est la seule source de verite pour l'audit courant du projet.

- Les snapshots d'audit precedents sont archives dans `DOCS/Archives/`.
- Les documents de `Phase de Conception/` restent des documents de cadrage et de planification, pas une preuve de livraison.
- Toute nouvelle evaluation du projet doit mettre a jour ce fichier, pas creer un nouvel audit concurrent.

## Synthese executive

GED237 dispose d'un socle applicatif substantiel : authentification MFA, RBAC centralise, multi-tenant, gestion documentaire, workflow, audit, OCR, recherche, CI/CD, mecanismes V1 d'import, classement et espaces documentaires.

Par rapport a l'audit precedent, le depot integre notamment :

- un **module Rapports & Statistiques** backend (`/api/v1/reports/*`) avec service dedie, filtres serveur `domain_id`, `activity_id`, `document_category_id`, bornes temporelles pour l'evolution, et une **page tenant-admin** `/reports` (KPI, graphiques, exports, generation documentaire cote UI)
- des **evolutions du modele et du moteur de regles de classement** (migrations `a3b9c5d2e7f1_classification_rule_multi_filters`, `6f2b1c4d9e70_add_classification_rule_origin_exclusions`, champs JSONB multi-cibles sur `ClassificationRule`)
- la **hierarchie fonctionnelle N+1** utilisateurs via `reports_to_user_id` (migration `f4b5c6d7e8a9_add_reports_to_user`) et integration dans les ecrans agents

Les constats structurants des audits precedents restent valides sur la **V1 Espaces / Import** :

- `GET /api/v1/spaces/documents` expose toujours uniquement `org_unit_id` et `recursive` ; le **contrat riche filtres metier** du plan V1 pour cet endpoint **n'est pas implemente** (filtrage domaine / activite / annee / statut principalement **apres chargement** cote frontend)
- la **suite `pytest` integrale** n'a pas ete rejouee dans cette passe (dependance `TEST_DATABASE_URL` + Redis selon tests ; tentative locale non concluante)
- le **build frontend** conserve des **memes signaux de finition** (warning sur `/index.css` absent, taille du chunk principal)

### Verdict court

- **Backend** : enrichi (rapports, regles de classement, lien hierarchique utilisateurs) ; **spaces/documents** toujours en deca du contrat planifie V1.
- **Frontend** : module Rapports operationnel au niveau navigation et composition d'ecrans. Warnings `/index.css` toujours presents dans `index.html`.
- **V1 Import / Classement** : toujours **fonctionnellement tres couvert** dans le code ; **recette execution / pytest** a rejouer pour affirmer la stabilisation bout en bout.
- **Documentation** : ce fichier actualise la photographie code ; les plans `Phase de Conception/` peuvent mentionner des lots (rapports) en parallele de la V1.

## Mesures observees

| Indicateur | Observation au 2026-07-22 |
|---|---|
| Routes backend (decorateurs `@router.get/post/put/patch/delete` dans `app/api/v1/endpoints`) | 117 |
| Fonctions de test dans `backend/tests/api/test_*.py` | 118 |
| Fichiers spec Playwright `frontend/e2e/specs/*.spec.ts` | 25 |
| Fichiers de revision Alembic `backend/alembic/versions/*.py` | 26 |
| Build frontend | OK — warning `/index.css` + chunk > 500 kB |
| Typecheck frontend | OK (`tsc --noEmit`) |
| Compilation Python `compileall app` | OK |
| README racine | present |

## Verifications executees

### Frontend

Commandes :

```powershell
Set-Location frontend
npm run typecheck
npm run build
```

Resultat :

- `npm run typecheck` : succes (execution observee ~3 min sur la machine d'audit — acceptable mais a surveiller en CI).
- `npm run build` : succes.

Warnings de build observes :

- `/index.css doesn't exist at build time` — la reference `<link rel="stylesheet" href="/index.css">` dans `frontend/index.html` ligne ~79 reste non resolue au build.
- Rollup : chunk principal `dist/assets/index-*.js` ~1,3 Mo minifie — suggestion Vite de code-splitting.

### Backend

Commande :

```powershell
Set-Location backend
.\venv\Scripts\python.exe -m compileall app
```

Resultat : aucune erreur de compilation sur l'arbre `app/`.

Limite :

- `pytest` non valide dans cet audit : `conftest.py` impose `TEST_DATABASE_URL` ; pas de preuve d'execution integrale sur cette passe.

## Etat reel de la V1 Import, Classement et Espaces GED

References produit :

- `Phase de Conception/PLAN_TECHNIQUE_V1_IMPORT_CLASSEMENT_GED.md`
- `Phase de Conception/BACKLOG_SPRINT_V1_IMPORT_CLASSEMENT_GED.md`

### Sprint 1 - Fondations de classification

Statut : implemente (inchangé).

Elements constates :

- modeles `classification_domain`, `classification_activity`, `classification_rule`
- enrichissement du modele `Document`
- migration historique `7d6e5c4b3a21_add_document_classification_foundations.py`
- schemas `document.py`, `classification.py`, `classification_admin.py`, `classification_review.py`

### Sprint 2 - Moteur de classification backend

Statut : implemente et **enrichi**.

Elements constates :

- `backend/app/services/classification_rule_engine.py`
- `backend/app/services/space_path_builder.py`
- `POST /api/v1/classification-rules/simulate`
- migrations complementaires sur les regles : multi-filtres JSONB (`document_category_ids`, `source_org_unit_ids`, exclusions, etc.) et exclusions d'origine — alignes avec `app/models/classification_rule.py`

### Sprint 3 - Import batch pilote

Statut : structure presente dans le code ; **fiabilite runtime / pytest** non revalidée dans cet audit.

Elements constates :

- modeles `ImportJob`, `ImportJobItem`
- endpoints `POST /api/v1/imports/analyze`, `POST /api/v1/imports/{job_id}/commit`, `GET .../imports/{job_id}`, `GET .../items`
- services `import_analysis_service.py`, `import_execution_service.py`
- `backend/tests/api/test_imports.py`

### Sprint 4 - Refonte UI import de masse

Statut : largement implemente.

### Sprint 5 - Espaces documentaires V1

Statut : **partiellement implemente** — **ecart majeur toujours ouvert**.

Elements constates :

- `GET /api/v1/spaces/tree`, `GET /api/v1/spaces/documents`
- `SpacesPage.tsx` avec filtres UI riches

Constat technique au 2026-07-22 (`spaces.py`) :

- `list_space_documents` ne proxifie que `org_unit_id` et `recursive` vers `list_workspace_documents`.

Note transverse : les **rapports** (`/api/v1/reports/*`) appliquent des filtres `domain_id` / `activity_id` / categorie **cote serveur** pour les agregats — ce qui **ne substitute pas** un listing pagine/filtre pour la vue Espaces documents.

### Sprint 6 - Revue manuelle de classement

Statut : structure implementee ; pytest non rejoue ici.

### Sprint 7 - Administration des regles de classement

Statut : implemente avec **surface UI et modele etendus** (multi-criteres, trace de simulation cote frontend dans les composants lies au classement).

### Sprint 8 - Stabilisation et recette

Statut : **toujours en cours** au sens recette pytest / parcours non mockes systematiques.

---

## Perimetre complementaire : Rapports & Statistiques

Hors decoupage sprint V1 strict du backlog import/classement, le depot contient un **lot Rapports** coherent :

| Zone | Fichiers / elements observes |
|---|---|
| API | `backend/app/api/v1/endpoints/reports.py` — `GET /evolution`, `/document-activity`, `/workflow-activity`, `/service-activity` ; prefix routeur `/reports` |
| Authz | Permission `analytics.tenant` / `read` ; regles super_admin / manager / reader avec bornage `org_unit` |
| Service | `backend/app/services/reports_service.py` |
| Schemas | `backend/app/schemas/reports.py` |
| Frontend | `frontend/profiles/tenant-admin/pages/ReportsPage.tsx` et sous-modules `pages/reports/*` ; entree menu `menuConfig.ts` id `reports` ; route `/reports` dans `App.tsx` |
| Client API | `frontend/services/resources/reports.api.ts` |

Lacune observee : **aucun** `backend/tests/api/test_reports.py` dans le depot au moment de l'audit — risque de non-regression non couvert par tests API automatises.

---

## Perimetre complementaire : hierarchie N+1 (agents)

- Migration `f4b5c6d7e8a9_add_reports_to_user.py` — colonne `users.reports_to_user_id`
- Integration UI : `AgentsListTab.tsx`, usages super-admin (`UserTable`, `OrgUnitDrawer`)

---

## Forces du projet

1. Socle backend couvrant auth MFA, RBAC, multi-tenant, documents, workflow, audit, notifications, recherche, OCR, analytics, import batch, classement.
2. **Reporting metier** avec filtres serveur sur axes domaine / activite / categorie pour les indicateurs — utile pour le pilotage meme si la vue Espaces reste a epaissir cote API.
3. Architecture repo lisible ; CI/DevSecOps present (workflows, scans, gates — inchangé qualitativement).

## Findings actuels

### P1 - Important

#### 1. Contrat `spaces/documents` toujours en deca du plan V1

Le plan technique visait un listing filtre serveur (`scope`, `domain_id`, `activity_id`, `year`, statuts, `q`). L'implementation actuelle **ne expose pas** ces parametres sur `GET /api/v1/spaces/documents`.

Impact : perf et coherence documentaire sur gros corpus ; decalage plan / code persistant.

#### 2. Tests backend non turnkey et non rejoues sur cet audit

Dependance `TEST_DATABASE_URL` obligatoire ; Redis pour partie des tests. Aucune campagne pytest rapportee comme executee avec succes dans cette mise a jour.

#### 3. Signaux de finition frontend

`/index.css` absent au build ; chunk principal volumineux.

#### 4. Lot Rapports sans tests API dedies

Les quatre endpoints rapports ne disposent pas de fichier `test_reports.py` observe — couverture automatisee a ajouter.

### P2 - Documentation

Les documents de `Phase de Conception/` peuvent ne pas encore refleter le lot Rapports ni les migrations de regles recentes ; `AUDIT.md` reste la reference d'implementation realisee.

## Findings clos par rapport a l'audit du 2026-04-30

Sans prejudice d'une reverification ponctuelle :

- Presence dans le code du module **Rapports** backend + frontend et menu dedie.
- Evolutions **ClassificationRule** (multi-filtres / exclusions) materialisees en migrations et modele.

Les findings non clos concernant **spaces**, **pytest**, **warnings build** restent **ouverts** au 2026-07-22 sauf mention contraire ci-dessus.

## Decision documentaire

### Source de verite courante

- `AUDIT.md`

### Archives historiques

- `DOCS/Archives/AUDIT_2026-04-13_snapshot.md`
- `DOCS/Archives/AUDIT_2026-04-18_snapshot.md`
- `DOCS/Archives/AUDIT_2026-04-30_snapshot.md`
- `DOCS/Archives/AUDIT_2026-05-09_snapshot.md`

## Prochaines actions recommandees

1. Rejouer `pytest` sur environnement PostgreSQL + Redis configures (`TEST_DATABASE_URL`, `TEST_REDIS_URL`).
2. Decider : **enrichir** `GET /api/v1/spaces/documents` selon le plan V1 **ou** **reduire** explicitement la promesse dans `PLAN_TECHNIQUE_V1_*`.
3. Corriger ou retirer la reference `/index.css` ; planifier le **code-splitting** du bundle principal.
4. Ajouter **tests API** pour `reports` (cas nominaux + bornes authz manager/reader vs tenant-admin).
