# [Claude] Migration Node 20 → Node 24 — 2026-10-30

> Statut : EN REVUE (2026-10-30) — branche `chore/node-24`. Fusion soumise à l'accord du PO.

## Ce qui va être fait

Passer le frontend (CI, image Docker) de Node 20 à Node 24, avec une source unique de version.

## Pourquoi

Node 20 est hors support depuis le 2026-04-30. Projet étatique : aucun runtime hors support. Choix
validé par le PO : Node 24 (maintenance LTS jusqu'au 2028-04-30) ; Node 26 (LTS depuis le 2026-10-28)
écarté pour l'instant, trop récent.

## Comment

1. `frontend/.nvmrc` (`24`) : source unique, lue par `actions/setup-node` via `node-version-file` dans
   `frontend.yml` (2 jobs), `release-integrity.yml` et `security.yml`. Variables `NODE_VERSION` retirées.
2. `frontend/Dockerfile` : `ARG NODE_VERSION=24` avant le premier `FROM`, réutilisé par les étapes
   `development` et `build`. L'image de production (nginx) est inchangée.
3. Garde anti-dérive dans `frontend.yml` (job `Lint & Typecheck`) : échec si le Dockerfile ne contient pas
   exactement `ARG NODE_VERSION=<contenu de .nvmrc>`. Un Dockerfile ne peut pas lire `.nvmrc` ; la garde
   rend les deux valeurs indissociables. Si Dependabot (écosystème docker) ne résout pas l'`ARG` dans le
   `FROM`, la version majeure reste pilotée par `.nvmrc`, et la garde empêche toute divergence.
4. `@types/node` (`^22`) laissé à Dependabot.

## Fichiers / zones concernés (verrou)

- `frontend/.nvmrc` (nouveau), `frontend/Dockerfile`
- `.github/workflows/frontend.yml`, `.github/workflows/release-integrity.yml`, `.github/workflows/security.yml`

## Vérifications prévues

- Lint, typecheck et build dans `node:24-alpine` (Docker).
- Garde : cas conforme (exit 0) et cas divergent (exit 1).
- `actionlint` et `docker build --check` propres.
- CI complète sur la PR (`.github/**` déclenche toutes les surfaces).

## Résultats

- `node:24-alpine` (Node 24.22.2, npm 11.19.1) : `npm ci` OK ; `typecheck` 0 erreur ; `lint` 0 erreur,
  488 avertissements (= plafond, exit 0) ; `build` OK.
- Garde : `.nvmrc` = 24 → OK ; `.nvmrc` simulé à 22 → KO.
- `actionlint` 1.7.7 : aucun constat. `docker build --check frontend` : aucun avertissement.

## Checklist RAIDER

- **R — Reusable** : une seule valeur (`.nvmrc`) consommée par tous les workflows ; aucune copie par job.
- **A — Agnostic** : version lue depuis le dépôt, plus codée dans les workflows ; `ARG` surchargeable
  (`--build-arg NODE_VERSION=…`).
- **I — Idempotent** : sans objet (aucun état distant modifié) ; la garde est une vérification pure.
- **D — Durable** : lint, typecheck et build identiques sous Node 24 ; plafond ESLint inchangé (488) ;
  CI complète requise sur la PR.
- **Failure memory** : pas d'incident pendant le travail ; la dérive Dockerfile/`.nvmrc` est prévenue
  par la garde plutôt que par une leçon a posteriori.
- **E — Engineering-grade** : contrat explicite (`.nvmrc` fait foi), garde CI avec message actionnable.
- **Scoped execution** : `.nvmrc` et `Dockerfile` relèvent de la surface `frontend` ; `.github/**`
  déclenche volontairement toutes les surfaces.
- **Reuse-first** : `node-version-file` natif de `actions/setup-node` (Adopt), aucune action tierce.
- **R — Retroactive** : aucune donnée touchée ; les images existantes restent valides jusqu'à reconstruction.
