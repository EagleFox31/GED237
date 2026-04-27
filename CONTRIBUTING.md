# Contributing to E-Dossier Cameroun (GED237)

## Git Workflow

### Branches

| Branche | Role | Protection |
|---------|------|------------|
| `main` | Production stable | Push direct interdit, PR obligatoire |
| `develop` | Integration | PR obligatoire, CI doit passer |
| `feature/*` | Nouvelles fonctionnalites | Libre, PR vers `develop` |
| `fix/*` | Corrections de bugs | Libre, PR vers `develop` |
| `hotfix/*` | Corrections urgentes | PR vers `main` + `develop` |

### Regles de merge

1. **PR obligatoire** pour `main` et `develop` (pas de push direct)
2. **1 review approuvee** minimum requise
3. **CI verte** : le status check `CI / CI Gate` doit passer
4. **Conversations resolues** avant merge
5. **Force-push interdit** sur `main`

### Processus de contribution

```bash
# 1. Creer une branche depuis develop
git checkout develop && git pull
git checkout -b feature/ma-feature

# 2. Developper et committer
git add -p
git commit -m "feat: description courte"

# 3. Pousser et creer la PR
git push -u origin feature/ma-feature
gh pr create --base develop --title "feat: description" --body "..."

# 4. Attendre CI verte + review
# 5. Merge via GitHub (squash ou merge commit)
```

## Setup local

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
pip install -r requirements.txt
pre-commit install        # T6.10 — hooks locaux
```

### Frontend

```bash
cd frontend
npm ci
```

### Pre-commit hooks

Les hooks pre-commit sont configures via `.pre-commit-config.yaml` (backend) et `lint-staged` (frontend). Ils verifient automatiquement :
- **ruff** : lint + format Python
- **bandit** : vulnerabilites Python
- **gitleaks** : detection de secrets
- **eslint** : lint TypeScript/React

## CI Pipeline

Chaque PR declenche automatiquement :

```
ci.yml
  |-- backend.yml   (pytest + migrations + coverage >= 70% + benchmark)
  |-- frontend.yml  (typecheck + eslint + build)
  |-- security.yml  (bandit + pip-audit + npm audit + gitleaks + trivy)
  |
  +-- CI Gate       (status check unique pour branch protection)
```

## Branch Protection Setup

Pour un admin du repo, executer le script suivant :

```bash
./scripts/setup-branch-protection.sh
```

Ou manuellement via `gh` CLI :

```bash
gh api repos/{owner}/{repo}/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["CI / CI Gate"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```
