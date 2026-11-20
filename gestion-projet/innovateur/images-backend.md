# Images backend : ce qui pèse vraiment, et comment les alléger

- **Demande** : alléger les images backend (api, worker, migrate, seed : un seul `backend/Dockerfile`).
- **Instruction** : innovateur, 2026-11-20. Niveau : `Vérifié` pour les mesures (image `gedtest-q-api:rl`, construite depuis `main`, mesurée par `docker history`, `du` et `dpkg-query`) ; `À vérifier` pour les points marqués comme tels.
- **Décision demandée** : à O, pour l'ordre des lots. Le lot principal est déjà décidé par DEC-2026-003.

## 1. Le constat corrigé

La piste « bandit et alembic gonflent l'image » ne tient pas :

| Élément | Poids mesuré | Commentaire |
|---|---|---|
| `bandit` | 2 Mo | outil de dev, à sortir quand même (surface d'attaque) |
| `alembic` | 3 Mo | **nécessaire à l'exécution** : le service `migrate` lance `alembic upgrade head` |
| Outils de dev en tout (bandit, ruff, pytest, pre-commit, virtualenv, pip-audit, fakeredis, coverage…) | ≈ 30 Mo | |

Un build multi-étapes qui ne retire que ces outils gagne environ 1 % de l'image.

## 2. Répartition mesurée

Image décompressée : **3,18 Go** (`edossier-worker` : 3,16 Go).

| Couche | Poids |
|---|---|
| `pip install` (torch + `requirements.txt`) | 1,87 Go |
| `apt-get` (gcc, postgresql-client, tesseract, poppler) | 413 Mo |
| Base Debian `python:3.11-slim` | 88 Mo |

Plus gros paquets Python (site-packages : 1 780 Mo au total) :

| Paquet | Mo | Qui l'amène |
|---|---|---|
| torch | 714 | EasyOCR |
| spacy (+ blis 39, thinc 18) | 183 | classification |
| scipy (+ scipy.libs 30) | 143 | scikit-image ← EasyOCR |
| opencv (cv2 72 + libs 81) | 153 | EasyOCR **et** RapidOCR |
| sympy | 78 | torch |
| numpy (+ libs 28) | 73 | tout l'OCR |
| skimage | 32 | EasyOCR |
| botocore | 26 | stockage S3 |
| networkx | 19 | torch |
| easyocr | 17 | — |

Côté apt, la chaîne de compilation (gcc-14, cpp-14, libgcc-14-dev, binutils, libc6-dev, linux-libc-dev, libasan8) pèse **150 à 200 Mo** et ne sert qu'à construire des roues.

## 3. Les leviers, par gain

| Lot | Contenu | Gain estimé (décompressé) | Porteur | Effort | Preuve attendue |
|---|---|---|---|---|---|
| **IMG-1 = OCR-1** | Retrait d'EasyOCR, torch, torchvision et torchaudio (DEC-2026-003, point 2) : `requirements.txt`, bloc torch et pré-téléchargement `/opt/easyocr` du Dockerfile, moteur `easyocr_engine.py` et son repli | **≈ 1 Go** (torch 714, sympy 78, scipy 143, skimage 32, networkx 19, easyocr 17, plus les modèles `/opt/easyocr`, `À vérifier` : ≈ 100 Mo) | B | 1 h-s | taille `docker image ls` avant / après ; corpus OCR-0 vert sur RapidOCR + Tesseract ; `pip check` |
| IMG-2 | Étape `builder` : roues construites avec gcc, puis copiées dans une étape finale sans gcc. Variante plus simple : vérifier que toutes les dépendances ont une roue binaire et retirer gcc. | 150–200 Mo | B | 0,5 h-s | `docker run … gcc --version` en échec dans l'image finale ; pytest vert |
| IMG-3 | `requirements-dev.txt` (bandit, ruff, pytest*, fakeredis, pip-audit, pre-commit) et cible `test` pour les images `gedtest-*` | ≈ 30 Mo, surtout de la surface d'attaque | B, avec Q pour la CI | 0,5 h-s | `pip show bandit` en échec dans l'image d'exécution ; jobs CI et e2e verts sur la cible `test` |
| IMG-4 (option) | Image API sans OCR ni spacy, le worker garde tout | API vers quelques centaines de Mo | B | 1,5 h-s | démarrage de l'API sans numpy ni cv2 importés ; e2e vert |

**Ordre** : IMG-1 d'abord, car il porte presque tout le gain et il est déjà décidé. IMG-2 et IMG-3 ensuite, dans la même PR si B le juge simple. IMG-4 seulement si le besoin d'une API légère est confirmé.

**Cible réaliste après IMG-1 à IMG-3** : environ **0,9 à 1,1 Go** décompressé par image. Restent spacy, opencv, onnxruntime, tesseract et poppler, tous utilisés. « Quelques centaines de Mo » n'est atteignable que pour l'API, avec IMG-4.

## 4. Pourquoi IMG-4 n'est pas immédiat

- `backend/app/api/v1/documents.py:73` importe `app.workers.tasks` au chargement du module. L'API tire alors la chaîne OCR : `strategy.py` importe `pypdf` et `pdf2image` en tête, et les moteurs importent `numpy` et `PIL` en tête.
- torch, easyocr et rapidocr sont déjà importés à la demande. L'API ne les charge donc pas en mémoire, mais elle doit les avoir sur disque, car l'image est commune.
- Il faut d'abord passer par `celery send_task` (par nom) ou par un import différé, puis faire deux cibles dans le Dockerfile, et adapter le compose (api, worker, migrate, seed).

## 5. Risques

- **Une seule image pour quatre services** : toute cible séparée doit être reportée dans `docker-compose.yml`, le compose e2e et le compose VPS (garde-fou #268).
- **PR ouvertes qui touchent `backend/Dockerfile` ou `requirements.txt`** : #481 (Python 3.13), #110 (Dependabot python 3.15-slim), #491, #478, #113 et #112 (Dependabot pip), ainsi que des PR V1.1 qui ajoutent une dépendance (#458, #468, #197 notamment). Le lot qui fusionne en second doit reprendre la liste. Il faut prévoir un rebase pour les PR concernées, sans les reprendre.
- **OCR** : #384 (moteur PDF) et #284 (`ocr_failed`) touchent la stratégie OCR. IMG-1 retire le repli EasyOCR. Il faut vérifier qu'aucune des deux n'en dépend.
- **Repli** : réversible en remettant les lignes. EasyOCR est déjà désactivé par défaut (`OCR_FALLBACK_ENABLED`, `strategy.py:51-58`), ce qui fait de IMG-1 la seconde étape du retrait prévu par DEC-2026-003.
