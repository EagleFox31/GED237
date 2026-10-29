# [Claude] Impact-Aware CI — 2026-10-29

> Statut : EN REVUE — PR à fusionner (CI GitHub bloquée par la facturation du compte, voir Résultats)

## Ce qui va être fait

Ne lancer en CI que les contrôles requis par les fichiers modifiés, avec la brique maison
`EagleFox31/appfactory-project-automation` (Impact-Aware CI), et retirer le pipeline dupliqué.

## Pourquoi

Écart RAIDER « Scoped execution » noté dans `RAIDER.md`. `ci.yml` lançait tout à chaque push/PR et
`quality-gate.yml` relançait les mêmes workflows derrière des filtres `paths:` copiés : 34 runs CI et
32 runs Quality Gate sur 30 jours (LESSON-2026-016).

## Comment

Reuse-first : **Adopt** de `reusable-impact-analysis.yml`, épinglé sur le SHA de la release v1.4.0
(`0523510`, moteur identique à `main`). Dépôt public : appelable depuis GED237 privé.

1. `.github/appfactory-impact.json` — cinq surfaces :

   | Surface | Chemins | Gates |
   |---|---|---|
   | `ci-platform` | `.github/**`, `scripts/**`, `.pre-commit-config.yaml`, `.gitattributes` | `workflow-lint` (+ toutes les surfaces qui en dépendent) |
   | `backend` | `backend/**`, `backend/**/.*` | `backend`, `sast` |
   | `frontend` | `frontend/**`, `frontend/**/.*`, `frontend/.husky/**` | `frontend` |
   | `dependencies` | `backend/requirements*.txt`, `frontend/package*.json` | `dependency-audit` |
   | `containers` | Dockerfiles, `.dockerignore`, `nginx/**`, `frontend/nginx.conf`, compose | `container-scan` |

   `ignorePaths` : documentation (`**/*.md`, `DOCS/`, `gestion-projet/`, `walkthrough/`,
   `Phase de Conception/`, `tasks/`, `.agents/`) et fichiers sans job (`extract_docx.py`, `.gitignore`,
   `.git-blame-ignore-revs`, `.gitleaks.toml`). `fallback: all`.
2. `ci.yml` — job `Change impact` ; `backend`, `frontend`, `workflows` gardés par leur gate ;
   `security` reçoit les gates ; `Tracked files` toujours ; `workflow_dispatch` en mode `all`.
   `CI Gate` : échoue si l'analyse échoue, accepte `success` et `skipped`, refuse le reste
   (`cancelled` passait avant).
3. `security.yml` — entrée `gates` (défaut : tous les scans) : bandit, audit de dépendances et Trivy
   suivent l'impact, gitleaks tourne toujours. Lancement manuel inchangé.
4. `quality-gate.yml` supprimé. Aucune protection de branche ne l'exige (indisponible sur ce plan :
   l'API renvoie 403).
5. `scripts/check-impact-gates.py` — hook pre-commit `impact-gates` + étape du job actionlint : refuse
   un gate utilisé mais jamais émis, déclaré mais jamais utilisé, ou absent du défaut d'une entrée
   `gates`. Build justifié : appfactory ne fournit pas ce contrôle côté consommateur.

## Fichiers / zones concernés (verrou)

- `.github/appfactory-impact.json`, `.github/workflows/{ci,security,quality-gate}.yml`
- `.pre-commit-config.yaml`, `scripts/check-impact-gates.py`
- `CONTRIBUTING.md`, `RAIDER.md`, `DOCS/engineering/lessons-learned.md`, `PASSATION.md`

## Vérifications prévues

- actionlint 1.7.7 et garde-fou dans Docker ; garde-fou sur trois mutations.
- Moteur v1.4.0 réel (Node 24 et 20) sur des commits historiques, puis sur chaque fichier suivi.
- PR : CI complète attendue (le diff touche `.github/**`).

## Résultats

- actionlint : exit 0. `pre-commit` au commit : tous les hooks `Passed`, dont `impact-gates`.
- Garde-fou : exit 1 sur gate mal orthographié, gate déclaré non utilisé, défaut incomplet ; exit 0 sur
  l'état réel et sur une copie CRLF.
- Moteur sur commits réels (résultats identiques sous Node 24 et 20) :

  | Commit | Changement | Gates |
  |---|---|---|
  | `5f64adc`, `93805b2` | doc seule | aucun |
  | `35de807` | tests backend | `backend`, `sast` |
  | `42a279a` | `docker-compose.yml` | `container-scan` |
  | `2a226fb` | `requirements.txt` | `backend`, `sast`, `dependency-audit`, `container-scan` |
  | `fc75407` | workflows | tous |
  | cette branche | `.github/**` | tous |

- 534 fichiers suivis passés un par un : aucun en fallback ; un chemin inconnu (`newdir/x.py`) déclenche
  tout. Écart corrigé en route : `backend/**` ne couvrait pas les dotfiles (`backend/.coveragerc`).
- Limite amont : le moteur lit `git diff --name-only` sans `core.quotePath=false`, donc un chemin
  non ASCII (8 fichiers de doc) arrive entre guillemets et déclenche le fallback. Sûr mais coûteux : à
  corriger dans appfactory (`git -c core.quotePath=false diff -z`).
- CI GitHub : non exécutée. Depuis le 2026-10-29, tous les jobs du compte échouent sans démarrer
  (« recent account payments have failed or your spending limit needs to be increased »).

## Checklist RAIDER

- **R — Reusable** : moteur et workflow réutilisés tels quels ; GED237 ne possède que sa carte
  déclarative ; nouveau job = un gate + un `if`.
- **A — Agnostic** : aucune branche ni dépôt codé dans le garde-fou ; chemins relatifs ; Python stdlib.
- **I — Idempotent** : analyse en lecture seule et déterministe ; garde-fou en lecture seule.
- **D — Durable** : noms des jobs et du `CI Gate` inchangés ; `security.yml` lancé seul ou sans `with:`
  exécute toujours tous les scans ; validation complète manuelle possible.
- **Failure memory** : LESSON-2026-016 (CI dupliquée, dotfiles).
- **E — Engineering-grade** : action tierce épinglée par SHA, `contents: read` ; un fichier inconnu
  déclenche tout ; erreurs du garde-fou actionnables.
- **Scoped execution** : c'est l'objet du lot ; gitleaks et `Tracked files` toujours exécutés, car ils
  portent sur tout le dépôt.
- **Reuse-first** : Adopt appfactory v1.4.0 ; Build limité au garde-fou de cohérence.
- **R — Retroactive** : aucun job retiré hors du doublon ; les surfaces couvrent tous les fichiers existants.
