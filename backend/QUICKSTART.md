# E-Dossier Cameroun - Quick Start Guide

## 🚀 Démarrage Rapide avec Docker

### 1. Prérequis
- Docker Desktop installé
- Git

### 2. Lancer l'application

```bash
# Depuis le dossier backend
cd backend

# Lancer tous les services (PostgreSQL + Redis + API)
docker-compose up -d

# Voir les logs
docker-compose logs -f api
```

### 3. Accéder à l'application

- **API**: http://localhost:8000
- **Documentation Swagger**: http://localhost:8000/api/docs
- **ReDoc**: http://localhost:8000/api/redoc
- **Health Check**: http://localhost:8000/health

### 4. Tester l'API

```bash
# Test health check
curl http://localhost:8000/health

# Test login (mock)
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "institution": "MINFI",
    "matricule": "CM001",
    "password": "test123"
  }'
```

### 5. Arrêter les services

```bash
docker-compose down
```

## 🛠️ Développement Local (sans Docker)

### 1. Installer PostgreSQL et Redis localement

### 2. Créer environnement virtuel Python

```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

### 3. Installer dépendances

```bash
pip install -r requirements.txt
```

### 4. Configurer .env

Éditer le fichier `.env` avec vos paramètres locaux.

### 5. Lancer le serveur

```bash
uvicorn app.main:app --reload
```

## 📝 Prochaines Étapes

1. Implémenter les modèles SQLAlchemy (Tenant, User, Document, etc.)
2. Créer les migrations Alembic
3. Implémenter la logique d'authentification complète
4. Ajouter les endpoints CRUD pour les ressources
5. Intégrer le moteur de règles
6. Configurer Celery pour les tâches asynchrones

## 🔗 Ressources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy 2.0](https://docs.sqlalchemy.org/en/20/)
- [Alembic](https://alembic.sqlalchemy.org/)
