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

Appliquees sur `main` par un ruleset GitHub (voir [Branch Protection](#branch-protection)) :

1. **PR obligatoire** (pas de push direct)
2. **CI verte** : le status check `CI Gate` doit passer, branche a jour avec `main`
3. **Conversations resolues** avant merge
4. **Force-push et suppression interdits**
5. Aucune approbation requise (mainteneur unique)

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

Chaque PR declenche `ci.yml`. Le job `Change impact` (`reusable-impact-analysis.yml` de
`EagleFox31/appfactory-project-automation`, epingle par SHA) lit `.github/appfactory-impact.json` et ne
lance que les jobs dont la surface est touchee :

```
ci.yml
  |-- Change impact  (fichiers modifies -> surfaces -> gates)
  |-- backend.yml    gate backend          (pytest + migrations + coverage >= 70% + benchmark)
  |-- frontend.yml   gate frontend         (typecheck + eslint + build)
  |-- security.yml   gitleaks toujours ; bandit (sast), pip-audit + npm audit (dependency-audit),
  |                  trivy (container-scan)
  |-- actionlint     gate workflow-lint    (+ scripts/check-impact-gates.py)
  |-- Tracked files  toujours
  |
  +-- CI Gate        (status check unique ; echoue si l'analyse d'impact echoue)
```

- Doc seule (`*.md`, `DOCS/`, `gestion-projet/`, `walkthrough/`...) : seuls gitleaks et Tracked files tournent.
- `.github/**`, `scripts/**`, `.pre-commit-config.yaml`, `.gitattributes` : tout tourne.
- Chemin absent de la carte : tout tourne (fallback de securite).
- Tout relancer : `Run workflow` sur `CI` (`workflow_dispatch`, mode `all`).
- Nouveau job lourd : ajouter son gate a une surface de la carte et
  `if: ${{ contains(fromJSON(needs.impact.outputs.gates), '<gate>') }}` sur le job. Le hook
  `impact-gates` et le job actionlint refusent un gate present d'un seul cote.

## Branch Protection

La politique est declaree dans `.github/project-config.json` (`repository.governance`, preset `solo` +
`requiredStatusChecks`) et appliquee par la Repository Governance de
`EagleFox31/appfactory-project-automation` sous forme d'un ruleset unique, « AppFactory default branch
governance », sur la branche par defaut.

Modifier la politique : PR sur `.github/project-config.json`, puis un admin lance `plan` (lecture seule),
relit, lance `apply`, et relance `plan`, qui doit repondre `NO-OP`. Le depot n'a pas de secret de
gouvernance : l'admin execute le moteur localement avec son jeton `gh`, dans Docker
(`INPUT_GOVERNANCE_MODE=plan|apply`, `INPUT_GOVERNANCE_TOKEN`, `INPUT_CONFIG_PATH`, `GITHUB_REPOSITORY`).
Reference : `docs/repository-governance-quick-start.md` du depot appfactory.

Un nom de check absent de `requiredStatusChecks` ne bloque rien ; un nom qu'aucun workflow ne produit
bloque toutes les PR. `CI Gate` tourne sur chaque PR (`if: always()`), meme quand l'analyse d'impact
saute les autres jobs.
