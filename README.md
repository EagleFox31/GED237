# GED237 - E-Dossier Cameroun

GED237 est une plateforme de gestion electronique de documents et de circuits de validation, concue pour des organisations multi-entites exigeant souverainete, tracabilite et gouvernance d'acces.

Le produit cible en priorite les administrations, institutions publiques, grands comptes et organisations distribuees qui doivent centraliser leurs documents, automatiser leur classement et encadrer les validations sensibles.

## Proposition de valeur

GED237 reunit dans une seule plateforme :

- import documentaire web et ingestion centralisee
- classement logique des documents par organisation, domaine, activite et annee
- workflows de validation et de visa
- controle d'acces multi-tenant et RBAC centralise
- auditabilite des actions critiques
- recherche, OCR et vues metier par role

## Ce que le produit couvre deja

### Gouvernance et securite

- authentification avec MFA
- isolation multi-tenant
- RBAC centralise
- journalisation d'audit
- pipelines de securite CI

### GED et exploitation documentaire

- depot et versioning de documents
- corbeille logique et verrouillage applicatif
- categories documentaires
- recherche et OCR
- analytics et notifications

### Workflow et routage

- templates de workflow
- regles GEDRules de routage
- bannettes de traitement
- assignations manuelles des cas non resolus

### V1 classement documentaire

- fondations de classification en base
- moteur backend de simulation de classement
- premiers ecrans d'import et d'espaces documentaires

## Positionnement actuel

Le projet dispose d'un socle technique substantiel et d'une base credible pour une mise en pilote, mais la V1 "Import, Classement et Espaces GED" n'est pas encore completement alignee entre le plan de conception et l'implementation finale.

Le point d'entree de reference pour l'etat reel du projet est :

- `AUDIT.md`

## Architecture

### Frontend

- React 19
- TypeScript
- Vite
- Zustand
- Playwright

### Backend

- FastAPI
- SQLAlchemy Async
- PostgreSQL
- Redis
- Celery
- Casbin

### DevOps

- Docker / Docker Compose
- GitHub Actions
- Bandit, pip-audit, npm audit, gitleaks
- couverture et quality gate

## Structure du depot

```text
backend/                API, services, modeles, migrations, workers
frontend/               application web React/TypeScript
nginx/                  reverse proxy
DOCS/                   gouvernance documentaire et archives
Phase de Conception/    plans, backlog, PERT, guides de recette
.github/workflows/      pipelines CI/CD et securite
```

## Demarrage rapide

### Option 1 - Stack complete via Docker Compose

```bash
docker compose up --build
```

Points d'acces attendus :

- application : `http://localhost:8080`
- backend : `http://localhost:8000/api/docs` selon le mode de lancement retenu

### Option 2 - Developpement local module par module

Backend :

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

Frontend :

```bash
cd frontend
npm ci
npm run dev
```

## Verification qualite

Frontend :

```bash
cd frontend
npm run build
npm run typecheck
npm run lint
```

Backend :

```bash
cd backend
python -m pytest
```

Note : la suite backend exige un environnement prepare, en particulier `TEST_DATABASE_URL`, et selon les cas Redis.

## Documentation utile

- etat reel du projet : `AUDIT.md`
- index documentaire : `DOCS/README.md`
- plan technique V1 : `Phase de Conception/PLAN_TECHNIQUE_V1_IMPORT_CLASSEMENT_GED.md`
- backlog V1 : `Phase de Conception/BACKLOG_SPRINT_V1_IMPORT_CLASSEMENT_GED.md`
- quickstart backend : `backend/QUICKSTART.md`
- runbook AuthZ : `backend/docs/AUTHZ_ROLLOUT_RUNBOOK.md`

## Message produit

GED237 n'est pas un simple espace de depot de fichiers. C'est un socle de gouvernance documentaire, de validation et de tracabilite, construit pour des contextes ou la maitrise des acces, l'alignement organisationnel et la preuve d'action sont des exigences de premier rang.
