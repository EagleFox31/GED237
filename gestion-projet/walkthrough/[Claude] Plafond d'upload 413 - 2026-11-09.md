# Plafond d'upload : 413 FILE_TOO_LARGE sur tous les chemins de dépôt

**Branche** : `fix/upload-size-limit` · **Statut** : EN REVUE · **Date** : 2026-11-09

## Contexte

`MAX_UPLOAD_SIZE` existait dans la configuration mais n'était appliqué nulle part : un fichier de
taille quelconque était accepté par l'API dès lors que nginx le laissait passer (DEC-2026-002,
`gestion-projet/innovateur/spec-limite-upload.md`). Le plafond doit être appliqué par l'API sur
les trois chemins de dépôt (document, nouvelle version, import en masse) avec une erreur 413
actionnable et sans fichier résiduel.

## Changements

| Fichier | Changement |
|---|---|
| `backend/app/core/config.py` | `MAX_UPLOAD_SIZE_MB` (réglage opérateur, entier positif) dérive `MAX_UPLOAD_SIZE` en octets ; défaut 100 Mio inchangé. |
| `backend/app/core/errors/domain.py` | `FileTooLargeError(AppError)` : 413, `FILE_TOO_LARGE`, message utilisateur avec le nom du fichier et le plafond en Mo ; `AppError.extras_public` (champs sûrs aplatis dans le Problem Details). |
| `backend/app/core/errors/handlers.py`, `problem.py`, `__init__.py` | Handler existant transmet `extras_public` ; titre `413 Content Too Large` ; export. |
| `backend/app/services/storage/base.py`, `local.py`, `s3.py` | `save_file_with_checksum(..., max_bytes=None)` : compteur pendant le streaming, arrêt au premier bloc qui dépasse. Local : écriture dans `<nom>.part` puis `os.replace` ; S3 : spool temporaire supprimé en `finally`. |
| `backend/app/api/v1/endpoints/documents.py` | Pré-contrôle `Content-Length` (> plafond + 1 Mio d'enveloppe multipart → 413 avant lecture) sur `POST /documents/upload` et `POST /documents/{id}/versions`. |
| `backend/app/services/import_analysis_service.py`, `endpoints/imports.py` | Import en masse atomique : un fichier trop gros → fichiers déjà mis en attente supprimés, transaction annulée, 413 nommant le fichier tel qu'envoyé ; aucun `ImportJob` créé. |
| `backend/.env.example`, `nginx/nginx.conf` | `MAX_UPLOAD_SIZE_MB=100` documenté ; nginx à `101M` pour que l'API, et non nginx, réponde le 413. |
| `backend/tests/api/test_upload_limit.py` | 5 tests (plafond abaissé à 1 Kio) : dépassement → 413 sans résidu ni ligne `Document` ; pré-contrôle `Content-Length` ; exactement à la limite → 201 sans `.part` ; nouvelle version trop grosse → 413, version courante inchangée ; import en masse → 413 nommant le fichier, aucun job, dossier de staging vide. |

Réponse type :

```json
{"type": "...", "title": "Content Too Large", "status": 413, "error_code": "FILE_TOO_LARGE",
 "detail": "Le fichier « rapport.pdf » dépasse la taille maximale autorisée (100 Mo).",
 "severity": "warning", "retryable": false,
 "max_upload_size_bytes": 104857600, "filename": "rapport.pdf", "correlation_id": "..."}
```

## Décisions

- **Exception dans `core/errors/domain.py`, pas dans `storage/base.py`** (écart assumé avec la
  spec) : une sous-classe d'`AppError` est traduite par le handler Problem Details existant, sans
  second handler ni import croisé `storage → errors → storage`.
- **Plafond appliqué dans le stockage** : un seul point de vérité pour local et S3, et tout futur
  appelant de `save_file_with_checksum` est couvert sans y penser.
- **Pré-contrôle `Content-Length`** seulement sur les endpoints mono-fichier : évite d'écrire jusqu'à
  100 Mio pour rien ; marge d'enveloppe 1 Mio ; un `Content-Length` absent ou faux retombe sur le
  compteur de streaming, qui reste la référence.
- **Import en masse atomique** plutôt qu'un item `failed` : l'utilisateur voit immédiatement quel
  fichier retirer, rien n'est stocké ni enregistré pour un lot refusé.
- **nginx 101M** : avec 100M, un fichier de 100 Mio pile serait refusé par nginx (page HTML) au lieu
  du Problem Details de l'API. L'opérateur qui change `MAX_UPLOAD_SIZE_MB` ajuste nginx à +1M.

## Preuves

- Docker (`test-in-docker.sh`) : `test_upload_limit.py` + `test_documents.py` +
  `test_documents_extended_coverage.py` + `test_imports.py` : 21 passed, 35 s.
- Suite complète en Docker : voir section Résultats.
- pre-commit (ruff, ruff-format, bandit, gitleaks) : voir section Résultats.
- S3 : logique identique au local, non exercée localement (pas de bucket de test) ; couverte par
  relecture seulement.

## Hors périmètre

- Limite côté frontend avant envoi (message immédiat) : relève de dev-frontend, qui peut lire
  `max_upload_size_bytes` dans la réponse 413.
- Plafond par tenant ou par catégorie : non demandé.

## RAIDER

- **R / A** : plafond configurable (`MAX_UPLOAD_SIZE_MB`), contrat de stockage commun local/S3,
  aucune valeur codée en dur hors défaut.
- **I** : refus sans effet de bord (`.part` supprimé, rollback) ; rejouer l'envoi corrigé suffit.
- **D** : signature étendue avec défaut (`max_bytes=None`), réponses existantes inchangées ;
  `test_documents*.py`, `test_imports.py` et suite complète rejoués.
- **Failure memory** : aucun incident ; la non-application d'un réglage existant est déjà couverte
  par la leçon « réglage sans consommateur » si elle existe, sinon à ajouter lors de la revue.
- **E** : erreur actionnable (nom, plafond), détail technique journalisé seulement, pas de donnée
  sensible dans `extras_public`, tests par chemin et à la limite exacte.
- **Change-scoped** : backend, tests, `.env.example`, nginx.
- **R (rétroactif)** : documents existants non concernés ; défaut 100 Mio identique à l'ancien.

## Résultats

- Suite complète backend en Docker : **263 passed**, 9 warnings, 13 min 10 (2026-11-09 soir).
- pre-commit (ruff, ruff-format, bandit, gitleaks) : vert.
