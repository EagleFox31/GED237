# GED237 Backend API

Backend FastAPI de GED237, responsable de l'authentification, de la GED, du workflow, de l'autorisation, de l'audit et des integrations techniques.

## Stack

- FastAPI
- SQLAlchemy 2 Async
- PostgreSQL
- Redis
- Celery
- Casbin

## Installation locale

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload
```

## Documentation API

Une fois le serveur lance :

- Swagger UI : `http://localhost:8000/api/docs`
- ReDoc : `http://localhost:8000/api/redoc`

## Tests

```bash
pytest
```

Important : la suite de tests exige un environnement prepare.

- `TEST_DATABASE_URL` doit etre defini
- certains tests utilisent Redis

## Outils et runbooks

- runbook AuthZ : `docs/AUTHZ_ROLLOUT_RUNBOOK.md`
- benchmark AuthZ : `python scripts/benchmark_authz.py`
- backup policies : `python scripts/backup_policies.py`
- restore policies : `python scripts/restore_policies.py --backup-dir <path>`

## Reference projet

Pour l'etat reel du projet et les constats courants, voir `../AUDIT.md`.
