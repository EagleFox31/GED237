# Spécification — OCR adaptatif, palier 1, lot 1 (#382)

- **Rôle** : I (spécification), B (code), Q (banc et relecture).
- **Date** : 18/11/2026. Relevé sur `origin/main` 1da9cf0, après la fusion de #368 (9b32c30).
- **Sources** : issue #382, `decision-ocr-adaptatif.md` (§ 1 constats, § 8 lots, S1 à S7), `protocole-ocr-0.md` l.35.
- **Lot** : 1, « corrections sûres, sans profil ». Effort : B 2,5 à 3 h-s, Q 1 h-s (banc compris).
- **Version** : V1.2. Ce lot ne fait pas partie de la rc.1 ni de la V1.1.

Le lot apporte quatre corrections, sans profil OCR ni nouveau réglage métier : orientation EXIF, un seul lancement de Tesseract par page, délai maximal pour Tesseract, plafond de threads. Il y ajoute une cinquième correction, qui change des valeurs visibles et demande donc une décision : le calcul de la confiance de Tesseract (§ 4).

## 0. Base et ordre

| Point | Règle |
|---|---|
| Branche | `feat/ocr-adaptatif-lot1`, partie de la tête de `main` au moment du démarrage. |
| À attendre | #284 (`ocr/base.py` : `LOW_CONFIDENCE_THRESHOLD`, `is_low_confidence`). Sans #284, on ne peut pas mesurer l'effet du § 4 sur le drapeau `low_confidence`. |
| Recouvrement | Aucune PR ouverte ne touche `tesseract_engine.py`. `config.py`, `docker-compose.yml` et les deux `.env.example` sont des fichiers chauds : n'y ajouter que des lignes dans le bloc OCR existant, sans rien déplacer ni reformater. |
| Hors du lot | `strategy.py` (#384, #386, #387 y travaillent), les profils, `psm`, la binarisation, le seuil 0,70, le dpi des PDF, EasyOCR. |
| Commits | Un commit par section 1 à 5, dans cet ordre. Le § 4 est isolé pour pouvoir être retiré seul si la décision D1 tombe sur « ne pas corriger ». |

## 1. Orientation EXIF

**Constat** : `tesseract_engine.py:62` (`Image.open(image_path)`) et `rapidocr_engine.py:100` (`with Image.open(image_path) as image`) ignorent l'orientation EXIF. Une photo de téléphone prise en portrait arrive donc couchée au moteur.

**Changement** :

- dans les deux `extract_from_image`, appliquer `ImageOps.exif_transpose(image)` juste après l'ouverture, et passer l'image redressée à `extract_from_pil_image`. Pillow 13.0.0 fournit cette fonction. Sans balise d'orientation, elle rend une copie inchangée ;
- Tesseract : utiliser aussi `with Image.open(...) as image:`, pour fermer le fichier comme le fait déjà RapidOCR ;
- `extract_from_pil_image` ne change pas. Les pages des PDF (`strategy.py:143`, `convert_from_path`) n'ont pas d'EXIF : rien à faire.

**Erreur** : si `exif_transpose` lève une exception (EXIF corrompu), garder l'image telle quelle et écrire un `logger.warning` avec le seul type de l'exception. La lecture ne doit jamais échouer à cause de l'EXIF.

## 2. Un seul lancement de Tesseract par page

**Constat** : `tesseract_engine.py:79-88` lance Tesseract deux fois par page, d'abord `image_to_string` (`--psm 3`) puis `image_to_data`. Chaque appel réécrit l'image dans un fichier temporaire et refait toute la reconnaissance. pytesseract 0.3.10 n'a pas `run_and_get_multiple_output` : ne pas monter de version dans ce lot.

**Changement** : un seul appel, puis reconstruction du texte depuis le TSV.

```python
data = pytesseract.image_to_data(
    image,
    lang=self._lang_string,
    config="--psm 3",
    output_type=pytesseract.Output.DICT,
    timeout=settings.OCR_TESSERACT_TIMEOUT_SECONDS,  # § 3
)
text = _text_from_tsv(data)
```

Fonction de module `_text_from_tsv(data: dict) -> str`, pure et testable sans Tesseract :

1. Ne garder que les lignes de `level == 5` (mots) dont `str(text).strip()` n'est pas vide.
2. Clé de paragraphe : `(page_num, block_num, par_num)`. Clé de ligne : clé de paragraphe plus `line_num`.
3. Dans une ligne, les mots sont joints par une espace. Les lignes d'un même paragraphe sont jointes par `"\n"`. Les paragraphes et les blocs sont séparés par une ligne vide (`"\n\n"`).
4. Pas de `"\f"` final. `image_to_string` en ajoutait un. `word_count` ne change pas, `char_count` peut baisser de quelques caractères.

`word_count` devient le nombre de mots retenus à l'étape 1 et `char_count` reste `len(text)`.

**Parité** : le texte normalisé (`" ".join(t.split())`) doit être identique à celui de `image_to_string(..., config="--psm 3")` sur la même image. C'est vérifié par un test (§ 6, test 10) et par Q sur les 5 pages témoin (§ 7). La mise en page exacte (sauts de ligne) n'est pas un critère : l'index plein texte ne la garde pas.

## 3. Délai maximal pour Tesseract

**Constat** : aucun délai aujourd'hui. Une page pathologique bloque le seul processus du worker (`--concurrency=1`, `docker-compose.yml:171`). Budget S3 : 30 s en moyenne, 60 s au plus par page.

**Changement** :

- nouveau réglage `OCR_TESSERACT_TIMEOUT_SECONDS: float = 60`, où 0 veut dire « sans délai » (c'est la sémantique de pytesseract). Un validateur refuse les valeurs négatives ;
- il est passé à `image_to_data(..., timeout=...)`. Après ce délai, pytesseract 0.3.10 tue le processus et lève `RuntimeError("Tesseract process timeout")` ;
- l'erreur est attrapée dans `extract_from_pil_image`. Le moteur rend un résultat vide (même forme qu'aujourd'hui, `processing_time` réel) et écrit `logger.warning("Tesseract timed out after %ss (%sx%s px).", délai, largeur, hauteur)`. Rien du contenu ni du chemin du fichier n'apparaît dans ce message ;
- les autres exceptions : remplacer le `print` (`tesseract_engine.py:116`) par `logger.warning("Tesseract failed (%s).", type(e).__name__)`. On ne journalise que le type, comme `rapidocr_engine.py`, parce que le message peut contenir du texte du document. Ajouter `logger = logging.getLogger(__name__)` en tête de module ;
- la suite ne change pas : un résultat vide suit les règles de repli actuelles de `strategy.py`.

## 4. Confiance de Tesseract (décision D1)

**Constat**, vérifié dans le source de pytesseract 0.3.10 : avec `Output.DICT`, `file_to_dict` convertit chaque colonne numérique par `int(float(v))`. `conf` est donc un `int`, et le filtre `conf != "-1"` (`tesseract_engine.py:91-96`) ne retire rien.

Les lignes de structure (niveaux 1 à 4 : page, bloc, paragraphe, ligne) valent `-1` et entrent dans la moyenne. Exemple calculé : une page de 200 mots lus à 90, sur 20 lignes, 3 paragraphes et 1 bloc. La moyenne actuelle est (200 × 90 − 25) / 225 ≈ 80, soit 0,80 au lieu de 0,90. Une page vide donne −0,01 au lieu de 0.

**Changement proposé** : la confiance devient la moyenne des `conf` des mots retenus au § 2, étape 1, et seulement ceux dont `conf >= 0`, divisée par 100. Sans mot, elle vaut 0,0.

**Effet visible** : la confiance de Tesseract monte. Moins de pages passent sous 0,70, ce qui touche :

- le repli (`base.py:22-25`) ;
- `ocr_confidence` en base ;
- le drapeau `low_confidence` de #284 et l'état « à revoir ».

Les valeurs déjà en base ne sont pas recalculées. Elles le seront seulement si un document est relu (script de #369).

**D1, à trancher par O** (ou par le PO) avant la fusion, pas avant le code :

| Option | Effet | Avis I |
|---|---|---|
| a. Corriger dans ce lot, sans nouveau réglage | Valeur juste. Le seuil 0,70 reste inchangé dans ce lot, et Q chiffre le décalage. | **Recommandée** : c'est un défaut et non un choix, et garder une formule fausse derrière un réglage coûte plus cher que la mesurer. |
| b. Garder la formule actuelle, corriger dans le lot du recalage du seuil | Aucun effet visible en V1.2 | Acceptable si Q mesure un basculement massif sous ou au-dessus de 0,70. |

Dans les deux cas, le banc de Q calcule les deux formules sur le même corpus (§ 7).

## 5. Plafond de threads

**Constat** (`protocole-ocr-0.md` l.35) : sous `--cpus=2`, onnxruntime et Tesseract dimensionnent leurs threads sur les 16 cœurs de l'hôte. Le banc mesure 9,7 s par page et 858 Mo de pic, contre 3,2 s par page avec 2 threads. Aucun plafond n'existe aujourd'hui, ni dans le code ni dans la pile. Le worker a `cpus: 2.0` (`docker-compose.yml:174`).

**Changement** : un seul réglage, `OCR_THREADS: int = 2`, avec un validateur qui impose une valeur ≥ 1.

- **Tesseract (OpenMP)** : dans `TesseractOCREngine.__init__`, appeler `os.environ.setdefault("OMP_THREAD_LIMIT", str(settings.OCR_THREADS))`. Le sous-processus lancé par pytesseract hérite de cet environnement. `setdefault` laisse gagner une valeur posée explicitement par l'exploitant. L'appel est idempotent.
- **RapidOCR (onnxruntime)** : `rapidocr_params(model_dir, threads: int = -1)` ajoute `"EngineConfig.onnxruntime.intra_op_num_threads": threads` et `"EngineConfig.onnxruntime.inter_op_num_threads": threads`. Ces clés ont été vérifiées dans la `config.yaml` de RapidOCR 3.10.0, où elles valent -1 par défaut. `rapidocr_engine.py:84` passe `settings.OCR_THREADS`. `download_models` (build de l'image) garde la valeur par défaut -1 : le build ne change pas, et `rapidocr_params.py` reste sans import de l'application.
- **EasyOCR (torch)** : hors du lot, puisque le repli lourd est coupé par défaut (`OCR_FALLBACK_ENABLED=False`).

## 6. Réglages et tests

**Réglages** : parité #389, les quatre fichiers dans le même commit.

| Fichier | Ajout |
|---|---|
| `backend/app/core/config.py` | Après `OCR_RAPIDOCR_TIMEOUT_SECONDS` (l.152) : `OCR_TESSERACT_TIMEOUT_SECONDS: float = 60` et `OCR_THREADS: int = 2`, chacun avec un commentaire d'une ligne et un validateur. |
| `docker-compose.yml` | Service worker, bloc l.193-197 : `OCR_TESSERACT_TIMEOUT_SECONDS: ${OCR_TESSERACT_TIMEOUT_SECONDS:-60}` et `OCR_THREADS: ${OCR_THREADS:-2}`. Le commentaire rappelle que `OCR_THREADS` doit suivre `cpus`. |
| `.env.example` (racine, l.37) | Les deux variables, avec les mêmes valeurs. |
| `backend/.env.example` (l.73) | Idem. |

**Tests** : nouveau fichier `backend/tests/services/test_tesseract_engine.py`. Les tests 1 à 9 simulent pytesseract avec `monkeypatch` et n'ont pas besoin du binaire.

| # | Test | Attendu |
|---|---|---|
| 1 | un seul lancement | `image_to_data` appelé une fois, `image_to_string` jamais |
| 2 | délai transmis | `timeout=settings.OCR_TESSERACT_TIMEOUT_SECONDS` |
| 3 | délai dépassé (`RuntimeError("Tesseract process timeout")`) | résultat vide, confiance 0,0, un `warning` sans contenu, aucune exception |
| 4 | autre exception (`TesseractError`) | résultat vide, `warning` avec le seul type |
| 5 | page vide (uniquement des lignes de niveaux 1 à 4) | texte `""`, confiance 0,0 (et non −0,01) |
| 6 | confiance | jeu TSV fixe avec des `-1` de structure et un mot vide : moyenne exacte des seuls mots (option D1-a) |
| 7 | reconstruction | jeu TSV à 2 blocs, 3 paragraphes, 4 lignes : texte exact attendu |
| 8 | EXIF, Tesseract et RapidOCR | JPEG 40×20 avec orientation 6 écrit dans `tmp_path` : l'image reçue par `extract_from_pil_image` mesure 20×40. Même test avec un EXIF illisible : pas d'exception. |
| 9 | threads | `OMP_THREAD_LIMIT` posé s'il est absent et conservé s'il est présent ; `rapidocr_params(d, threads=2)` contient les deux clés à 2 ; `rapidocr_params(d)` les met à -1 ; `Settings` refuse `OCR_THREADS=0` et un délai négatif |
| 10 | parité, avec le vrai binaire (`skipif shutil.which("tesseract") is None`) | image synthétique (texte dessiné par PIL, 3 paragraphes) : texte normalisé identique à `image_to_string` |

Les tests existants ne changent pas et restent verts : `test_ocr_strategy.py`, `test_rapidocr_engine.py`, `test_ocr_lazy_import.py`, `test_reocr_script.py`. Si un test vérifie une confiance de Tesseract simulée, il doit être ajusté dans le commit du § 4, avec une explication.

**Photos** : aucune vraie photo ni capture de document dans le dépôt. Les tests n'utilisent que des images synthétiques. Le corpus du banc reste hors dépôt, sur la machine de Q.

## 7. Critères d'acceptation

| Critère | Mesure | Qui |
|---|---|---|
| CI verte, tests du § 6 inclus | CI ou preuve locale en conteneur, consignée dans la PR | B |
| Parité du texte, mode `off` | 5 pages témoin : texte normalisé identique avant et après les § 2 et 3 | Q (banc #385) |
| Rappel et précision (S2) | Par lot du corpus : rappel ≥ référence − 1 point, précision ≥ référence − 2 points | Q |
| Temps (S3) | Moyenne ≤ 30 s par page, maximum ≤ 60 s par page ; gain attendu par les § 2 et 5 | Q |
| Mémoire (S4) | Pic du worker ≤ 1 000 Mo sur le corpus | Q |
| Robustesse (S6) | Tests 3, 4 et 5 | B |
| EXIF | Photos du corpus tournées : rappel égal ou meilleur | Q |
| Confiance (D1) | Distribution des deux formules, et nombre de pages qui franchissent 0,70 dans chaque sens, dans la PR | Q |
| Threads | Le temps par page à `OCR_THREADS=2` se rapproche des 3,2 s de `protocole-ocr-0.md` ; à défaut, l'écart est expliqué | Q |

## 8. Note de version (V1.2)

> - OCR : les photos prises en portrait sont redressées avant lecture. Tesseract lit chaque page en un seul passage, avec un délai maximal (`OCR_TESSERACT_TIMEOUT_SECONDS`, 60 s par défaut). Les moteurs OCR ne prennent plus de threads au-delà des processeurs du worker (`OCR_THREADS`, 2 par défaut) (#382).
> - Si D1-a : la confiance affichée pour Tesseract ne compte plus les zones sans texte. Elle est plus haute qu'avant pour une même page, et moins de documents passent en « à revoir ». Les documents déjà lus gardent leur ancienne valeur tant qu'ils ne sont pas relus.

## 9. Limite connue, hors du lot

Après un délai dépassé, RapidOCR abandonne l'appel sans l'arrêter (`rapidocr_engine.py:119-128`, `ThreadPoolExecutor` à un thread). Tesseract démarre alors en secours pendant que ce thread tourne encore, et les deux se partagent les 2 CPU. Avec le § 5, chacun reste plafonné, mais le temps de la page de secours s'allonge. À traiter dans un lot ultérieur (processus séparé ou arrêt coopératif) si le banc le montre.

## 10. Revue RAIDER

- **R** : un réglage par besoin (délai, threads), injecté par `settings`. `_text_from_tsv` est pure et réutilisable par un futur profil.
- **A** : aucune hypothèse sur l'hôte. Les threads suivent un réglage, pas le nombre de cœurs détecté. `setdefault` respecte l'environnement de l'exploitant.
- **I** : `setdefault` est idempotent. Aucune donnée n'est réécrite : les confiances déjà en base ne sont recalculées que par une relecture volontaire.
- **D** : contrat `OCRResult` inchangé. Les tests existants restent verts. Parité du texte mesurée. Les effets visibles (§ 4) sont décidés (D1) et annoncés (§ 8).
- **Failure memory** : le filtre `conf != "-1"` sur un `int` est un défaut de type silencieux. Le test 6 le verrouille, et une leçon est à ajouter dans `DOCS/engineering/lessons-learned.md` à la fusion.
- **E** : journaux sans contenu de document, validateurs sur les réglages, parité #389 des fichiers d'environnement.
- **Change-scoped** : backend OCR seulement. Pas de migration, rien côté frontend.
- **Reuse-first** : on adopte `ImageOps.exif_transpose` (Pillow), le `timeout` de pytesseract et les clés onnxruntime de RapidOCR. On ne construit que `_text_from_tsv`, parce que pytesseract 0.3.10 n'offre pas de sortie multiple.
- **R (rétroactif)** : pas de reprise des données existantes. La relecture reste volontaire.
