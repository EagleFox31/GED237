# [Claude] Lot A — Consolidation du dépôt — 2026-10-28

> Statut : DONE (2026-10-28)

## Ce qui va être fait

Lot A de `AUDIT.md` : commiter le travail local en commits thématiques sur
`feat/v1-local-consolidation`, corriger et fusionner la PR #1, rebaser la consolidation
sur `main` (une seule tête Alembic), prouver migrations + tests + CI.

## Pourquoi

Le travail local (~6 000 lignes, 4 migrations) n'existe que sur un poste ; `main` ne
migre pas sur base vierge et la PR #1 diverge. Rien d'autre n'est fiable tant que ce
n'est pas consolidé. Accord PO du 2026-10-28.

## Comment

1. Branche `feat/v1-local-consolidation` depuis `main`, commits thématiques, push.
2. PR #1 : corriger `test_classification_rule_engine_patterns`, relancer Trivy, fusionner.
3. Rebase sur `main` : révision de fusion `e1f2a3b4c5d6` (heads `c9a2d4e6f8b0` + `d4e5f6a7b8c9`)
   plutôt qu'un re-chaînage de `a3b9c5d2e7f1` (sûr pour les bases déjà migrées), résoudre
   `classification.py`, fixtures.
4. Preuves : base vierge `alembic upgrade head`, rerun no-op, `alembic check`, pytest, CI.
5. Documenter le lancement des tests via Docker / Python 3.12.

## Fichiers / zones concernés (verrou)

- historique git (`main`, `fix/runtime-ocr-hardening`, `feat/v1-local-consolidation`)
- `backend/alembic/versions/a3b9c5d2e7f1_*.py`, `backend/app/api/v1/endpoints/classification.py`
- `backend/tests/` (fixtures, test KO de la PR #1)
- docs : `README` / `DOCS/` (lancement des tests), ce fichier

## Vérifications prévues

Base vierge `alembic upgrade head` + rerun no-op + `alembic check` ; pytest complet ; CI verte.

## Résultats

- PR #1 (`fix/runtime-ocr-hardening`) fusionnée : merge commit `77e6cfa` (60 commits conservés).
- PR #2 (`feat/v1-local-consolidation`) fusionnée : merge commit `c3a0514`. CI 16/16 verte.
- Conflit de rebase unique (`classification.py`) : vs `main`, seuls deux `model_dump(...)` remplacés
  par `_rule_column_values` (correctif FK, LESSON-2026-007).
- Migrations : base vierge `upgrade head` OK, rejeu no-op, `alembic check` propre, bases à chaque
  ancienne tête → `head` OK ; une seule tête.
- Tests backend : 155 passed, couverture 70,11 % (seuil 70 %) — marge faible.
- Frontend : 10 erreurs ESLint introduites par la consolidation corrigées (dont un hook appelé après
  un `return` anticipé dans `ReportsWorkflowPanel`).
- Lancement des tests via Docker documenté : `backend/scripts/test-in-docker.sh` + `backend/README.md`.
- Leçons LESSON-2026-003 à 009 dans `DOCS/engineering/lessons-learned.md`.

Restes / dérogations :
- Commits faits avec `SKIP=ruff,ruff-format,bandit` (dette existante, lot B item 8).
- Pas de `.gitattributes` : normalisation des fins de ligne à faire (LESSON-2026-003).
- `alembic heads` = 1 et `alembic check` non automatisés en CI (LESSON-2026-002/006).
- Nettoyage local (branche `tmp/rebase-preview`, worktree `../GED237-pr1`, stash
  `consolidation-wip`) : contenu vérifié intégré à `main`, suppression laissée au PO.

## Checklist RAIDER

- **R — Reusable** : script de test paramétrable par variables d'environnement ; logique reports dans
  `ReportsService`, endpoints minces.
- **A — Agnostic** : script sans chemin machine ; images et préfixes configurables.
- **I — Idempotent** : migration de fusion rejouable (no-op) ; script réutilise réseau/conteneurs/volumes.
- **D — Durable** : suite complète verte (pas seulement les nouveaux tests) ; comportement PR #1 conservé.
- **Failure memory** : 7 leçons consignées avec prévention.
- **E — Engineering-grade** : historique thématique, merge commits, `--force-with-lease` borné au SHA attendu.
- **Reuse-first** : non réévalué (fonctionnalités antérieures à la consolidation).
- **R — Retroactive** : bases déjà migrées sur l'une ou l'autre ligne convergent vers la tête unique.
