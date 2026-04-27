# E-Dossier Cameroun - Backend API

## Description
Backend FastAPI pour la solution GED multi-tenant E-Dossier Cameroun.

## Stack Technique
- **Framework**: FastAPI 0.110+
- **ORM**: SQLAlchemy 2.0 (Async)
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Workers**: Celery
- **Auth**: JWT + MFA

## Installation

### Prérequis
- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### Setup Local

```bash
# Créer environnement virtuel
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Installer dépendances
pip install -r requirements.txt

# Configurer variables d'environnement
cp .env.example .env
# Éditer .env avec vos valeurs

# Initialiser la base de données
alembic upgrade head

# Lancer le serveur
uvicorn app.main:app --reload
```

## Structure du Projet

```
app/
├── core/           # Configuration & sécurité
├── models/         # Modèles SQLAlchemy
├── schemas/        # Schémas Pydantic
├── api/            # Routes API
├── services/       # Logique métier
├── storage/        # Gestion fichiers
├── workers/        # Celery workers
└── utils/          # Utilitaires
```

## Documentation API

Une fois le serveur lancé :
- Swagger UI: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

## Tests

```bash
pytest
```

## AuthZ Production Runbook

- Rollout/rollback guide: `docs/AUTHZ_ROLLOUT_RUNBOOK.md`
- Backup policies: `python scripts/backup_policies.py`
- Restore policies: `python scripts/restore_policies.py --backup-dir <path>`
- CSV vs SQL latency benchmark: `python scripts/benchmark_authz.py`
- Statut P6b AuthZ: ✅ Terminé (validation locale: `63 passed` sur `tests/api/test_authz.py`)

## Licence
Propriété de l'État du Cameroun - ANTIC
