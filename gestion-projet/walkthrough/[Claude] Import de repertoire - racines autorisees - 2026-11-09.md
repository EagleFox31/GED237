# Import de répertoire : racines autorisées (`INGEST_ALLOWED_ROOTS`)

**Branche** : `fix/ingest-allowed-roots` · **Statut** : EN REVUE · **Date** : 2026-11-09

## Contexte

`POST /documents/ingest-directory` lisait n'importe quel dossier accessible au processus `api`
(`/etc`, `/app`, le stockage d'un autre tenant) et copiait les fichiers supportés dans la GED de
l'appelant. Écart sécurité 10 du plan de présentation, CWE-22/73, instruit dans
`gestion-projet/innovateur/spec-ingest-racines-autorisees.md`. Seul garde : `isdir`.

## Changements

| Fichier | Changement |
|---|---|
| `backend/app/core/config.py` | `INGEST_ALLOWED_ROOTS` (chaîne, séparateur `os.pathsep`, espaces ignorés) → propriété liste, sur le modèle d'`ALLOWED_ORIGINS`. **Défaut vide = tout refusé.** |
| `backend/app/core/errors/domain.py`, `__init__.py` | `IngestPathForbiddenError(AppError)` : 403, `INGEST_PATH_FORBIDDEN`, détail « Dossier hors des emplacements autorisés » ; le chemin demandé reste dans le détail technique (journal), jamais dans la réponse. |
| `backend/app/services/ingestion.py` | `resolve_source_dir` avant `isdir` : relatif résolu contre la première racine ; `realpath` des deux côtés puis `commonpath` ; racine déclarée mais absente ignorée avec avertissement. `_scan_directory(..., root)` : `os.walk(followlinks=False)`, chaque fichier re-vérifié sur sa cible réelle ; lien sortant ignoré et compté dans `errors` (« Lien hors des emplacements autorisés »). |
| `backend/app/api/v1/endpoints/documents.py` | Journal serveur (utilisateur + chemin demandé) sur refus ; l'exception est traduite par le handler Problem Details existant. |
| `docker-compose.yml` | Service `api` : montage `${INGEST_SOURCE_DIR:-./data/ingest}:/data/ingest:ro` et `INGEST_ALLOWED_ROOTS=/data/ingest`. |
| `data/ingest/README.md` | Dossier source versionné (vide) pour que le montage existe sur un clone neuf. |
| `backend/.env.example` | `INGEST_ALLOWED_ROOTS=/data/ingest` documenté. |
| `backend/tests/api/test_ingest_allowed_roots.py` | 9 cas de la spec §5 : racine ok, relatif, hors racine, traversée `..`, préfixe trompeur `root-bis`, symlink dossier sortant, symlink fichier sortant (200 + 1 erreur), liste vide, autorisé mais absent (200 + rapport inchangé). Symlinks `skipif` sous Windows, preuve en Docker. |

## Décisions

- **403 et non 400** : requête bien formée, décision d'autorisation sur la ressource visée ; même
  traitement frontend (`pushApiError`) que les autres 403.
- **Exception dans `core/errors/domain.py`** plutôt que dans `services/` (écart assumé avec la
  spec) : sous-classe d'`AppError`, donc traduite une seule fois par le handler existant, sans
  bloc `try/except` HTTP dans l'endpoint ni import croisé.
- **Racine absente ignorée à l'appel** (avertissement journalisé à chaque import) plutôt qu'au
  démarrage : pas de crochet de démarrage à ajouter, même effet pour l'opérateur.
- **Dossier autorisé mais absent → 200 + rapport** inchangé : contrat de `uat/directory-import.spec.ts`.
- **Montage via `INGEST_SOURCE_DIR`** (défaut `./data/ingest`) : l'opérateur pointe le corpus démo
  sans éditer le compose ; lecture seule car l'import ne fait que copier.
- `../GED237-e2e/docker-compose.yml` (branche ci-qa, absent de `main`) : montage et variable à
  reporter par ci-qa dans sa PR, prévenu à l'ouverture de celle-ci.

## Preuves

- Docker (`test-in-docker.sh`) : voir Résultats.
- pre-commit (ruff, ruff-format, bandit, gitleaks) : vert.
- `docker compose exec api printenv INGEST_ALLOWED_ROOTS` et capture UI du 403 : à produire par
  ci-qa au rejeu P2 (pas de pile démo lancée depuis cette session).

## Hors périmètre

- Quota de fichiers par import, extensions, `worker` : inchangés (spec §3.6).
- Saisie UI restreinte au sous-dossier : dev-frontend, le relatif est déjà accepté côté API.

## RAIDER

- **R / A** : racines configurables par environnement, aucun chemin codé en dur ; séparateur
  `os.pathsep` donc portable.
- **I** : refus sans effet de bord (aucune copie, aucune ligne) ; rejouer avec le bon chemin suffit.
- **D** : rapport, codes et champs inchangés pour les chemins autorisés ; cas « absent » conservé.
- **Failure memory** : aucun incident ; le défaut vide empêche qu'une pile oublie la variable
  sans s'en apercevoir (403 explicite au premier import).
- **E** : moindre privilège (refus par défaut, montage `:ro`), message public sans fuite, journal
  avec utilisateur et chemin, 9 tests ciblés.
- **Change-scoped** : backend, tests, compose, `.env.example`.
- **R (rétroactif)** : documents déjà importés non concernés ; piles existantes doivent renseigner
  la variable et le montage (section Changements).

## Résultats

- `tests/api/test_ingest_allowed_roots.py` en Docker : **9 passed** (symlinks inclus), 29 s (2026-11-09 soir).
- Suite complète backend en Docker : résultat consigné dans la PR.
- pre-commit (ruff, ruff-format, bandit, gitleaks) : vert.
