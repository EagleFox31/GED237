# Database Migration & Setup Guide

## 🚀 Quick Start

### 1. Start Docker Services

```bash
cd backend
docker-compose up -d postgres redis
```

### 2. Create Virtual Environment (if not done)

```bash
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
pip install psycopg2-binary  # For Alembic migrations
```

### 4. Run Migrations

```bash
# Apply all migrations
alembic upgrade head

# Check current version
alembic current

# View migration history
alembic history
```

### 5. Seed Database with Test Data

```bash
python scripts/init_db.py
```

This will create:
- 1 Tenant (MINFI)
- 3 Org Units (MINFI → DGI → Service Informatique)
- 3 Users (Super Admin, Tenant Admin, Collaborator)
- All default roles

## 📝 Test Credentials

After running `init_db.py`, you can use these credentials:

| Role | Matricule | Password |
|------|-----------|----------|
| Super Admin | SUPER001 | admin123 |
| Tenant Admin (MINFI) | MINFI001 | minfi123 |
| Collaborator | MINFI002 | user123 |

## 🔄 Common Migration Commands

### Create a New Migration

```bash
# Auto-generate migration from model changes
alembic revision --autogenerate -m "description of changes"

# Create empty migration
alembic revision -m "description"
```

### Apply Migrations

```bash
# Upgrade to latest
alembic upgrade head

# Upgrade to specific version
alembic upgrade <revision_id>

# Upgrade one step
alembic upgrade +1
```

### Rollback Migrations

```bash
# Downgrade one step
alembic downgrade -1

# Downgrade to specific version
alembic downgrade <revision_id>

# Downgrade all
alembic downgrade base
```

### View Migration Info

```bash
# Current version
alembic current

# History
alembic history

# Show SQL without executing
alembic upgrade head --sql
```

## 🗄️ Database Schema

### Tables Created

1. **tenants** - Multi-tenant organizations
2. **roles** - User roles with hierarchy
3. **org_unit_types** - Organization unit types
4. **org_units** - Hierarchical organization structure
5. **org_unit_closure** - Closure table for fast queries
6. **users** - User accounts
7. **documents** - Document metadata
8. **workflow_steps** - Document validation workflows
9. **ged_rules** - Automation rules
10. **audit_logs** - Audit trail

### Default Data Inserted

**Roles** (7):
- SUPER_ADMIN (level 1)
- TENANT_ADMIN (level 2)
- UNIT_ADMIN (level 3)
- AUDITOR (level 3)
- MANAGER (level 4)
- COLLABORATOR (level 5)
- READER (level 6)

**Org Unit Types** (7):
- MINISTRY (level 1)
- SEC_GEN (level 2)
- DIRECTION (level 2)
- DEPARTMENT (level 3)
- SERVICE (level 4)
- BUREAU (level 5)
- CELLULE (level 5)

## 🧪 Testing the Database

### Connect with psql

```bash
docker exec -it edossier_postgres psql -U edossier_user -d edossier
```

### Sample Queries

```sql
-- List all tenants
SELECT * FROM tenants;

-- List all users with their roles
SELECT u.matricule, u.first_name, u.last_name, r.label as role
FROM users u
JOIN roles r ON u.role_id = r.id;

-- View org hierarchy
SELECT code, name, level, path FROM org_units ORDER BY path;

-- Check migration version
SELECT * FROM alembic_version;
```

## ⚠️ Troubleshooting

### Migration Fails

```bash
# Check database connection
docker ps  # Ensure postgres is running

# Check .env file
cat .env  # Verify DATABASE_URL

# Reset database (CAUTION: Deletes all data)
docker-compose down -v
docker-compose up -d postgres
alembic upgrade head
```

### Seed Data Already Exists

If you run `init_db.py` twice, you'll get unique constraint errors. To reset:

```bash
# Drop all tables
alembic downgrade base

# Re-create
alembic upgrade head
python scripts/init_db.py
```

## 📚 Next Steps

1. Start the API server: `uvicorn app.main:app --reload`
2. Test authentication with seed credentials
3. Implement remaining endpoints
4. Add more test data as needed
