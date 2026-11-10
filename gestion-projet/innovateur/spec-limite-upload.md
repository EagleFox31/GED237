# Spécification — plafond d'upload `MAX_UPLOAD_SIZE` appliqué (ordre 2 de DEC-2026-002, jeudi 12/11, B 0,5 j)

- **Pour** : dev-backend (correctif), dev-frontend (message), ci-qa (test). Instruit par l'innovateur le 2026-11-09 21:45. **Livré** : #52 fusionnée le 10/11 (`FileTooLargeError` 413 `FILE_TOO_LARGE`, `core/errors/domain.py:230-237` ; `MAX_UPLOAD_SIZE_MB` opérateur, `core/config.py:65-66`).
- **Niveaux** : `Vérifié` = lu dans le dépôt ce jour ; `Documenté` = doc éditeur / avis de sécurité ; `Déduit` = raisonnement ; `Proposé` = conception.
- **Exigence DEC-002** : « plafond d'upload : 413 pendant l'écriture par blocs ; test 413 sur un fichier > `MAX_UPLOAD_SIZE` ». Même PR « sécurité » que l'ordre 1 ou PR séparée, au choix de B.

## 1. Constat (`Vérifié`)

| Fait | Où | Conséquence |
|---|---|---|
| `MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024` déclaré et **jamais lu** (seule occurrence : `backend/app/core/config.py:46`) | config | le réglage ment : il n'existe aucun plafond applicatif |
| `client_max_body_size 100M` | `nginx/nginx.conf:13` | seul plafond réel, et seulement derrière nginx ; l'API exposée directement (tests, pile e2e sans nginx, `docker compose` dev) n'a **aucune** limite |
| Trois entrées multipart : `POST /documents/upload` (`documents.py:519`, un fichier), dépôt de version (`documents.py:1602`, un fichier), `POST /imports/…/analyze` (`imports.py:177`, `list[UploadFile]`) | API | trois chemins à couvrir avec **un seul** mécanisme |
| Écriture déjà en flux par blocs (`CHUNK_SIZE`, SHA-256 au fil de l'eau, « never loads the full file into RAM ») dans `storage/local.py:40-48` et `storage/s3.py:49-55`, contrat commun `storage/base.py` | stockage | l'endroit naturel pour compter les octets : le fichier n'est jamais entier en mémoire, on peut s'arrêter au premier bloc qui dépasse |
| Fichier écrit **directement** à son chemin final (`open(file_path, "wb")`) | `local.py:38-41` | en cas d'abandon, un fichier partiel resterait sur disque : il faut le supprimer (ou écrire dans un `.part` puis renommer) |
| Erreurs API au format RFC 9457 (`type`, `title`, `status`, `detail`, `error_code`, `severity`, `retryable`, `correlation_id`) consommées par `frontend/lib/errors/ApiError.ts` et le bus `pushApiError` | frontend | le 413 doit être un **Problem Details JSON**, pas une page HTML nginx, pour que le message français s'affiche |
| Aucun traitement de `413` ni texte « trop volumineux » dans `frontend/` | frontend | message utilisateur à ajouter |
| `fastapi==0.117.1`, `starlette==0.48.0`, `python-multipart==0.0.33` | `requirements.txt` | voir § 2 : pas de plafond **par fichier** fourni par la pile |

## 2. Ce que la pile offre déjà (Reuse-first)

| Brique | Ce qu'elle fait | Verdict |
|---|---|---|
| Starlette `request.form(max_files=1000, max_fields=1000, max_part_size=1 Mo)` (`Documenté`, présent depuis 0.40 ; `max_file_size` renommé `spool_max_size` en 0.46) | borne le **nombre** de parties et la taille des parties **non fichier** ; les parties fichier sont spoulées sur disque **sans limite de taille** | ne répond pas au besoin ; FastAPI 0.117 n'expose pas ces paramètres sur `File()` |
| CVE-2026-54283 (starlette < 1.3.1, `contexte-application.md`) : limites ignorées pour `application/x-www-form-urlencoded` | DoS post-auth sur les endpoints `Form(` | **non corrigé par ce correctif** (il porte sur les fichiers) ; mitigation = plafond nginx + slowapi ; reste en V1.1 avec l'exception datée |
| nginx `client_max_body_size` | coupe la requête **avant** l'API, réponse HTML 413 brute | garder comme première ligne, mais **au-dessus** du plafond applicatif (§ 3.4) pour que l'utilisateur voie le message de l'application |
| Pattern OSS « receive wrapper » (`ContentSizeLimitMiddleware` des tests FastAPI ; `helper/LimitUploadSize.py` de kaspa-ng/kaspa-rest-server ; `src/paste/middleware.py` de FOSS-Community/paste.py — `Vérifié` via `gh search code`) | middleware ASGI pur qui compte les octets de chaque message `http.request` et lève 413 au dépassement, après un pré-contrôle de `Content-Length` | **Learn** : bon pour un plafond **global** de corps de requête ; ne distingue pas les fichiers d'un import multiple, et lever une exception dans `receive` dépend du serveur. Recommandé en **V1.1** (il couvrirait aussi la CVE urlencoded sans nginx) |
| Uvicorn | aucune limite de corps par défaut (`Documenté`) | rien à attendre de lui |

**Choix** : **Build minimal** dans le stockage (contrat commun local / S3), là où les octets passent déjà un à un ; pré-contrôle `Content-Length` en complément sur les deux endpoints mono-fichier. Pas de middleware en V1.

## 3. Conception (`Proposé`)

### 3.1 Valeur

- **Défaut inchangé : 100 Mo** (`MAX_UPLOAD_SIZE`, contrat existant, RAIDER-D). Le jeu de démo (`jeu-donnees-demo.md`) produit des PDF reportlab et bureautiques de quelques dizaines de Ko ; les PDF image pré-OCRisés et le lot B de scans réels (`protocole-ocr-0.md`) restent sous 20–30 Mo par fichier (`Déduit` : 200 dpi, ≤ 10 pages). Aucune raison de baisser le plafond pour la démo ; la **preuve** du 413 se fait par test, pas en séance.
- Exposer la valeur en **Mo** côté exploitation (`MAX_UPLOAD_SIZE_MB=100` dans `.env.example`, conversion dans `config.py` en gardant `MAX_UPLOAD_SIZE` en octets pour le code) : une valeur en octets dans un `.env` est une source d'erreur.

### 3.2 Où l'appliquer

1. **Source de vérité : `save_file_with_checksum`** (`local.py`, `s3.py`), paramètre `max_bytes: int | None = settings.MAX_UPLOAD_SIZE`. Dans la boucle de blocs : `received += len(chunk)` ; si `received > max_bytes` → fermer, **supprimer le partiel** (local : écrire dans `<fichier>.part` puis `os.replace` en fin de boucle, supprimer le `.part` en cas d'échec ; S3 : le `tmp` est déjà jetable), lever `FileTooLargeError(filename, received_at_least, max_bytes)` (exception métier dans `services/storage/base.py`, indépendante de HTTP : RAIDER-E). Comportement **identique** local / S3 (contrat `base.py`).
2. **Pré-contrôle `Content-Length`** sur `/documents/upload` et le dépôt de version : si l'en-tête est présent et `> MAX_UPLOAD_SIZE + 1 Mo` (marge d'enveloppe multipart) → 413 **avant** toute lecture. `Déduit` : évite d'écrire 100 Mo pour rien quand le client annonce la taille ; **ne remplace pas** le compteur (en-tête absent ou mensonger, corps en `chunked`). Pas de pré-contrôle sur l'import multiple : la somme des fichiers peut légitimement dépasser le plafond unitaire.
3. **Import multiple** (`imports.py`) : le plafond est **par fichier** ; au premier fichier trop gros, la requête entière répond 413 en nommant le fichier (le job d'analyse est atomique ; `Déduit` : plus simple à tester et à expliquer que des résultats partiels). Les fichiers déjà écrits pour ce job sont supprimés.
4. **Handler d'exception** `FileTooLargeError → 413` dans la couche API (là où les autres Problem Details sont produits), **une seule fois**, pas dans chaque endpoint.

### 3.3 Réponse API attendue

```http
HTTP/1.1 413 Content Too Large
Content-Type: application/problem+json

{
  "type": "https://ged237/errors/file-too-large",
  "title": "Fichier trop volumineux",
  "status": 413,
  "detail": "Le fichier « rapport_2025.pdf » dépasse la taille maximale autorisée (100 Mo).",
  "error_code": "FILE_TOO_LARGE",
  "severity": "warning",
  "retryable": false,
  "max_upload_size_bytes": 104857600,
  "filename": "rapport_2025.pdf",
  "correlation_id": "…"
}
```

Le frontend lit `max_upload_size_bytes` : aucune constante dupliquée côté client (RAIDER-A).

### 3.4 nginx et compose

- `client_max_body_size` doit être **≥ plafond applicatif + 1 Mo**, sinon l'utilisateur reçoit la page HTML 413 de nginx et le bus d'erreurs affiche un message générique. Aligner par variable : image `nginx:alpine` lit `/etc/nginx/templates/*.template` avec `envsubst` ; `client_max_body_size ${NGINX_MAX_BODY};` et `NGINX_MAX_BODY=101m` dans le compose (0,1 j, même PR ou PR compose avec `DEBUG=false` / `AUTH_*_RATE_LIMIT`). Si B préfère ne pas toucher au template : laisser `100M` et documenter que le 413 applicatif se déclenche avant pour tout fichier ≤ 99 Mo (`Déduit`).
- Pile e2e (`ci/e2e-smoke`) et tests pytest attaquent l'API sans nginx : c'est **là** que le plafond applicatif est la seule protection, et là que le test le prouve.

### 3.5 Frontend (F, 0,1 j, peut suivre dans la PR UI de la semaine 2)

- Mapping `error_code === 'FILE_TOO_LARGE'` → message utilisateur : « **Fichier trop volumineux.** La taille maximale est de 100 Mo (fichier : rapport_2025.pdf). » (valeur formatée depuis `max_upload_size_bytes`, pas en dur) ; présentation `toast` ou `banner` selon la page (dépôt simple : toast ; import : banner, la liste reste affichée).
- Pré-contrôle **optionnel** côté client (`file.size`) avant envoi : seulement si la valeur est disponible (ex. endpoint public de configuration) ; sinon ne pas inventer une constante locale. V1.1.

### 3.6 Test minimal (B dans la PR ; Q rejoue en Docker)

```python
async def test_upload_rejects_file_over_limit(auth_client, db_seed, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "MAX_UPLOAD_SIZE", 1024)          # plafond 1 Kio pour le test
    payload = b"x" * 2048
    r = await auth_client.post("/api/v1/documents/upload",
                               files={"file": ("big.bin", payload, "application/octet-stream")},
                               data={"title": "trop gros"})
    assert r.status_code == 413
    body = r.json()
    assert body["error_code"] == "FILE_TOO_LARGE" and body["max_upload_size_bytes"] == 1024
    # aucun résidu : pas de fichier partiel, pas de ligne document
    assert not any(p.suffix == ".part" or p.stat().st_size for p in storage_dir.rglob("big.bin*"))
    assert await count_documents(db_seed.tenant_id) == documents_before

async def test_upload_accepts_file_at_limit(...):   # borne : 1024 octets exactement → 201
```

- Variante import multiple : deux fichiers dont un > plafond → 413 nommant le fichier, aucun job créé.
- Le test `Content-Length` n'est pas séparé : httpx envoie l'en-tête, donc le premier test passe par le pré-contrôle ; pour exercer le **compteur**, ajouter un cas avec `monkeypatch` du pré-contrôle désactivé ou un corps `chunked` (optionnel, 0,1 j).
- Critère DoD : les deux tests verts en Docker ; suite complète (≈ 13 min) toujours verte ; `MAX_UPLOAD_SIZE` lu au moins une fois hors `config.py` (grep dans la revue).

## 4. Effort et risques

| Qui | Quoi | Effort |
|---|---|---|
| B | compteur + `.part` + exception + handler 413 + pré-contrôle + 2–3 tests | 0,4 j |
| B | `MAX_UPLOAD_SIZE_MB`, `.env.example`, `NGINX_MAX_BODY` (template) | 0,1 j |
| F | message `FILE_TOO_LARGE` | 0,1 j (semaine 2) |

Risques : S3 — vérifier que le `tmp` est bien fermé/supprimé au dépassement ; renommage `.part` → nom final sur Windows (développement local) : `os.replace` suffit ; un fichier **exactement** à la limite doit passer (test de borne). Hors périmètre, annoncé si demandé : plafond global de corps (middleware V1.1), quota par tenant déjà prévu par `DEFAULT_TENANT_STORAGE_QUOTA_MB` (non vérifié ici).

## 5. Fiche courte — `POST /documents/ingest-directory` : racine autorisée (constat ci-qa du 09/11, tranché O)

**Constat (`Vérifié`, `main` a4b8dbe)** : l'endpoint (`backend/app/api/v1/endpoints/documents.py:1440-1459`) exige seulement `documents:create` (rôle collaborateur inclus) puis passe `request.directory_path` tel quel à `DirectoryIngestionService.ingest` (`services/ingestion.py:87-120`). Le schéma `DirectoryIngestRequest.directory_path: str` (`schemas/document.py:88-94`) n'est pas contraint ; le service vérifie uniquement `os.path.isdir` (`ingestion.py:113`) avant de **parcourir et importer** tout fichier supporté. Conséquence : tout compte capable de déposer un document peut faire importer dans son tenant **n'importe quel dossier lisible par le processus api** (`/app`, `/etc`, le volume de stockage des autres tenants s'il est monté), c'est-à-dire lire des fichiers du serveur à travers la GED. Aucun test ne couvre ce cas.

**Conception (`Proposé`, même esprit que § 3 : la règle vit dans le service, pas dans l'endpoint)**

1. **Réglage** `INGEST_ALLOWED_ROOTS: str = ""` dans `core/config.py` (+ `.env.example`, + compose de démo) : liste de chemins absolus séparés par `:` (ou `;` sous Windows, `os.pathsep`). **Vide = l'endpoint refuse tout** (sûr par défaut, RAIDER-E moindre privilège) ; **tranché O 09/11** : un seul chemin conteneur, **`/data/ingest`**, monté en lecture seule dans les deux compose (démo et e2e ; seul le dossier hôte source change : `frontend/e2e/data/demo-import/` côté e2e, le corpus de démo côté J0), `INGEST_ALLOWED_ROOTS=/data/ingest` dans les deux. Ce qui est testé en e2e est exactement ce qui est montré le jour J ; la PR 2a de ci-qa (qui prévoyait `/srv/e2e-import`) s'aligne.
2. **Contrôle dans le service** (`ingest`, avant `isdir`) : `real = os.path.realpath(source_dir)` ; accepté si `os.path.commonpath([real, os.path.realpath(root)]) == os.path.realpath(root)` pour au moins une racine. `realpath` des deux côtés neutralise `..` et les liens symboliques ; `commonpath` évite le piège du préfixe (`/data/ingest-autre`). Refus → exception métier `IngestPathForbiddenError(path)` (dans `services/`, indépendante de HTTP), traduite **une fois** en **403** Problem Details `error_code=INGEST_PATH_FORBIDDEN`, `detail` sans révéler l'existence du chemin (« Dossier hors des emplacements autorisés »). Dossier inexistant **dans** une racine : comportement actuel conservé (rapport d'erreur), pour ne pas casser `uat/directory-import.spec.ts`.
3. **Tests (B, pytest)** : dossier sous une racine → 200 ; dossier hors racine → 403 ; `racine/../etc` → 403 ; lien symbolique depuis la racine vers l'extérieur → 403 ; `INGEST_ALLOWED_ROOTS` vide → 403. Q rejoue le parcours P2 (SC-ADM-08) en Docker avec la variable renseignée.
4. **Frontend (F, 0 j)** : le 403 passe par `pushApiError` ; aucun texte nouveau si `detail` est en français.

**Ordre et coût** : correctif B **après** le 413 (§ 3-4), même semaine, **≈ 0,25 j** ; PR dédiée `fix/ingest-allowed-roots`. Non régression : `uat/directory-import.spec.ts` et `ingestion.spec.ts` inchangés, variable ajoutée dans les deux compose (`docker-compose.yml`, `../GED237-e2e/docker-compose.yml`). Annonce : intégré à l'écart sécurité **10** du plan de présentation (pas de nouveau numéro).

## Sources

- Dépôt GED237 (2026-11-09) : `backend/app/core/config.py`, `nginx/nginx.conf`, `backend/app/services/storage/{base,local,s3}.py`, `backend/app/api/v1/endpoints/{documents,imports}.py`, `frontend/lib/errors/{ApiError,errorBus}.ts`, `backend/tests/api/test_documents.py`.
- Starlette `request.form` limites et CVE-2026-54283 (GHSA-82w8-qh3p-5jfq, corrigé 1.3.1) : https://osv.dev/vulnerability/CVE-2026-54283 ; notes 0.40.0 / 0.46.0 : https://newreleases.io/project/github/encode/starlette/release/0.46.0
- Pattern middleware : https://sources.debian.org/data/main/f/fastapi/0.118.0-1/tests/test_custom_middleware_exception.py ; https://github.com/kaspa-ng/kaspa-rest-server (`helper/LimitUploadSize.py`) ; https://github.com/FOSS-Community/paste.py (`src/paste/middleware.py`)
- Pré-contrôle Content-Length + compteur : https://blog.filestack.com/fastapi-upload-file-multipart-streaming/
