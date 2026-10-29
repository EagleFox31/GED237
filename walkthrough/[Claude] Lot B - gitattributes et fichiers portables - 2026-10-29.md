# [Claude] Lot B — `.gitattributes` et fichiers suivis portables — 2026-10-29

> Statut : EN REVUE — branche `chore/gitattributes`

## Ce qui va être fait

Imposer LF dans le dépôt (`.gitattributes` + renormalisation isolée), puis bloquer en local et en CI les
défauts de fichiers suivis découverts en route : encodages cassés et chemins qui ne diffèrent que par la casse.

## Pourquoi

LESSON-2026-003 laissait la prévention « à faire » : 76 fichiers CRLF et 1 mixte dans l'index, avertissements
`LF will be replaced by CRLF` à chaque commit. L'inventaire a révélé deux défauts invisibles sous Windows :
`tasks/lessons.md` vu comme binaire (trois encodages mélangés) et `docs/engineering/` suivi à côté de
`DOCS/engineering/` (deux dossiers sous Linux, liens relatifs cassés).

## Comment

1. `2d88228` — réparation de `tasks/lessons.md` (script conteneurisé, assertions sur chaque remplacement) :
   double encodage cp1252/UTF-8 annulé, bloc UTF-16LE décodé, accents et lettres mangées par les
   échappements PowerShell restaurés d'après le contexte.
2. `65e6080` — `.gitattributes` : `* text=auto eol=lf`, CRLF pour `*.bat`/`*.cmd`, binaires déclarés.
3. `1d95776` — `git add --renormalize .` seul (77 fichiers, diff vide avec `--ignore-cr-at-eol`), ajouté à
   `.git-blame-ignore-revs`.
4. `eafff21` — `docs/engineering/*` → `DOCS/engineering/*` (renommage d'index, aucune référence à modifier).
5. `f1c0546` — `scripts/check-tracked-files.sh` : collisions de casse, fichier vu binaire sans règle
   `binary`, caractères de contrôle et U+FFFD ; hook pre-commit et job CI `Tracked files` requis par le
   `CI Gate`. Reuse-first : `pre-commit-hooks`, `Lucas-C/pre-commit-hooks` et `texthooks` couvrent CRLF ou
   bidi, pas ces cas → script maison de 40 lignes, une seule source de vérité pour hook et CI.

## Fichiers / zones concernés (verrou)

- `.gitattributes`, `.git-blame-ignore-revs`, `.pre-commit-config.yaml`, `.github/workflows/ci.yml`
- `scripts/check-tracked-files.sh`, `tasks/lessons.md`, `DOCS/engineering/`
- 77 fichiers renormalisés (fins de ligne uniquement)

## Vérifications prévues

- Script : exit 0 sur l'index réel, exit 1 sur un index temporaire contenant l'ancien `lessons.md`,
  l'ancien `docs/engineering/README.md`, un ESC, un U+FFFD et un CRLF ; même résultat sous Linux (`mawk`).
- `pre-commit run --all-files` vert ; CI GitHub verte sur la PR.

## Résultats

- Index : tout le texte en `i/lf`, 10 binaires déclarés, 0 CRLF, 0 mixte, 0 chemin `docs/`.
- Script : cas négatifs tous détectés (exit 1), index réel exit 0 sous Windows et dans
  `buildpack-deps:bookworm-scm`.
- `pre-commit run --all-files` : tous les hooks `Passed` (dont actionlint sur `ci.yml`).
- Aucun code applicatif touché : suite backend non relancée (fins de ligne seules dans `backend/`).

## Checklist RAIDER

- **R — Reusable** : le script ne dépend d'aucun chemin GED237 ; règles déclaratives dans `.gitattributes`.
- **A — Agnostic** : LF imposé par le dépôt, indépendant de `core.autocrlf` ; script bash + awk POSIX
  (testé Git Bash et `mawk`).
- **I — Idempotent** : un second `git add --renormalize .` est un no-op ; le script est en lecture seule.
- **D — Durable** : diff de renormalisation vide hors CR ; liens relatifs de `DOCS/engineering/` réparés
  sous Linux ; `pre-commit run --all-files` vert.
- **Failure memory** : LESSON-2026-003 en `prevention-added`, LESSON-2026-013 et 014 ajoutées.
- **E — Engineering-grade** : commits isolés (réparation, attributs, renormalisation, déplacement,
  garde-fou) ; messages d'erreur actionnables ; renormalisation ignorée par `git blame`.
- **Scoped execution** : job léger (< 1 min) toujours exécuté, volontaire car il porte sur tout l'index.
- **Reuse-first** : hooks existants évalués (voir « Comment ») ; Build justifié.
- **R — Retroactive** : working copies existantes intactes (CRLF disque accepté, normalisé à l'ajout) ;
  backticks de code perdus dans `tasks/lessons.md` non réinventés.
