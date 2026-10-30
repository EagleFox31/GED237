# [Claude] Lot B item 8 — Lint ruff/bandit bloquant — 2026-10-29

> Statut : DONE (2026-10-29) — PR #4 CI 18/18 verte, fusionnée dans `main` (6d1999a). Volet frontend
> (ESLint) ajouté le 2026-10-30, branche `chore/frontend-lint-ratchet` : voir la dernière section.

## Ce qui va être fait

Ramener ruff et bandit à zéro sur le backend, puis rendre les deux gates bloquants en local (pre-commit)
et en CI, sans `SKIP`.

## Pourquoi

`AUDIT.md` lot B item 8 et LESSON-2026-008 : les commits du lot A passaient avec
`SKIP=ruff,ruff-format,bandit`. ruff n'était exécuté par aucun workflow CI, et bandit ne bloquait que
sur HIGH en CI alors que le hook bloquait dès LOW.

## Comment

1. Baseline dans Docker (`python:3.12-slim`, ruff 0.6.9, bandit 1.8.3, sur `git archive HEAD`) :
   96 erreurs ruff (44 F401, 33 E402, 13 F541, 3 E712, 2 F841, 1 E741), 43 fichiers à reformater,
   5 alertes bandit LOW (B110 ×2, B112 ×3).
2. Corrections manuelles des cas à risque :
   - E712 : `== True/False` → `.is_(True/False)` (le correctif automatique `is True` casserait SQLAlchemy) ;
   - B110/B112 : les `except: pass/continue` best-effort journalisent désormais (`logger.warning`) ;
   - E402 : `logger` déplacé après les imports dans `auth.py` ; exception déclarée dans
     `backend/ruff.toml` pour `tests/conftest.py` et `scripts/*.py` (bootstrap `sys.path`/environnement) ;
   - F401 `import app.models` dans `alembic/env.py` conservé (`# noqa`, import à effet de bord).
3. `ruff check --fix` (correctifs sûrs uniquement), puis `ruff format` dans un commit isolé, référencé dans
   `.git-blame-ignore-revs`.
4. CI : job `Lint (ruff)` dans `backend.yml` ; bandit dans `security.yml` bloque sur tout constat (même
   config que le hook) ; versions d'outils lues dans `requirements.txt`.
5. `check-json` exclut les `tsconfig*.json` (JSONC) pour que `pre-commit run --all-files` passe.

## Fichiers / zones concernés (verrou)

- `backend/` (correctifs lint, formatage), `backend/ruff.toml`, `backend/.bandit.yml`
- `.github/workflows/backend.yml`, `.github/workflows/security.yml`, `.pre-commit-config.yaml`
- `.git-blame-ignore-revs`, `DOCS/engineering/lessons-learned.md`

## Vérifications prévues

- `ruff check`, `ruff format --check`, `bandit -c .bandit.yml` à zéro (Docker).
- `pre-commit run --all-files` vert, commits sans `SKIP`.
- Suite backend complète + gate couverture 70 % (`backend/scripts/test-in-docker.sh`).
- CI GitHub verte sur la PR.

## Résultats

- ruff : 0 erreur ; ruff format : 0 fichier à reformater ; bandit : 0 constat.
- `pre-commit run --all-files` : tous les hooks `Passed`.
- Suite backend (Docker) : 155 passed, couverture 70,15 % (gate 70 % atteint).

## Checklist RAIDER

- **R — Reusable** : règles dans `backend/ruff.toml` et `backend/.bandit.yml`, partagées par hook et CI.
- **A — Agnostic** : aucune version d'outil dupliquée en CI, lue dans `requirements.txt`.
- **I — Idempotent** : un second `ruff check --fix` / `ruff format` est un no-op (vérifié : 0 changement).
- **D — Durable** : suite complète relancée ; pas de changement de comportement hors journalisation
  des échecs best-effort ; filtres SQL booléens équivalents.
- **Failure memory** : LESSON-2026-010 ajoutée, LESSON-2026-008 passée en `prevention-added`.
- **E — Engineering-grade** : formatage isolé et ignoré par `git blame` ; exceptions explicites (noqa,
  per-file-ignores commentés), pas de seuil relevé.
- **Reuse-first** : outils déjà adoptés (ruff, bandit, pre-commit) ; Impact-Aware CI hors périmètre (lot D).
- **R — Retroactive** : aucune donnée ni migration touchée ; `fix.py` laissé en place (seuls espaces de fin
  retirés par le hook).

## Volet frontend (ESLint) — 2026-10-30

**Constat.** L'item 8 d'`AUDIT.md` vise aussi les 200 erreurs ESLint du frontend. Elles n'avaient pas été
corrigées : le commit 1f1f794 avait passé 18 règles en `warn`, sans plafond. Le lint « bloquant » laissait
donc passer toute nouvelle occurrence de ces règles (605 avertissements mesurés).

**Fait.**
- `eslint --fix` (Docker, `node:20-alpine`) : 605 → 488 avertissements, 8 fichiers. Corrections purement
  syntaxiques (gabarits de chaînes, espaces après les clés, ré-exports déplacés après les imports,
  `x ? x : y` → `x || y`, booléen JSX implicite). Indentation de `EMPTY_RULE` (`RulesTab.tsx`)
  reprise à la main après le fix `object-property-newline`.
- 7 règles tombées à zéro retirées de la liste `warn` de `frontend/.eslintrc.json`, donc rendues à `error`
  par le preset : `prefer-template`, `react/jsx-boolean-value`, `no-useless-escape`, `key-spacing`,
  `no-unneeded-ternary`, `object-property-newline`, `import/first`.
- Cliquet : `npm run lint` porte `--max-warnings 488` (`frontend/package.json`), règle décrite dans
  `CONTRIBUTING.md`. Restent en `warn` : 11 règles héritées (non corrigeables automatiquement) et les règles
  déjà en `warn` par choix (`no-explicit-any`, `no-console`, `react/button-has-type`…).

**Vérifié (Docker).** `npm run lint` : 0 erreur, 488 avertissements, exit 0 ; `--max-warnings 487` : exit 1 ;
`eslint --print-config` : les 7 règles en `error` ; `npm run typecheck` : 0 ; `npm run build` : OK.

**RAIDER.**
- **R / A** : plafond porté par le script `lint`, identique en local et en CI ; aucune config CI dupliquée.
- **I** : un second `eslint --fix` ne modifie plus rien sur ces règles (0 occurrence restante).
- **D** : typecheck et build verts ; fixes ESLint sans effet sur le comportement.
- **Failure memory** : LESSON-2026-018.
- **E** : dette bornée et mesurable ; règles rétablies au niveau du preset plutôt que forcées à la main.
- **Reuse-first** : `--max-warnings` natif d'ESLint (Adopt), pas d'outil de baseline supplémentaire.
- **R — Retroactive** : aucune donnée touchée ; dette restante conservée et plafonnée, pas réécrite.
