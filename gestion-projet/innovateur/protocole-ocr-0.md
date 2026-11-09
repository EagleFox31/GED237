# Protocole OCR-0 — benchmark Tesseract vs RapidOCR vs EasyOCR (pour ci-qa, exécution le 14/11)

- **Réf.** : DEC-2026-003 (lot OCR-0, 0,5 j, condition de go pour OCR-1 : **CER RapidOCR ≤ CER EasyOCR** et **pic mémoire du worker < 1 Go**). Instruit par l'innovateur le 2026-11-09 20:30.
- **Principe** : rien à concevoir, rien dans le code produit. Un script de mesure autonome sur la branche ci-qa (`backend/scripts/bench_ocr_0.py`, non importé par l'application), une image Docker dérivée, un tableau. Tout en Docker, plafonné (`--memory=1g --cpus=2` pour reproduire la contrainte VPS).
- **Niveaux** : `Vérifié` = lu dans le dépôt ce jour ; `Documenté` = doc éditeur ; `Déduit` = à confirmer par ci-qa à l'exécution.

## 1. Corpus (30 pages, deux lots)

| Lot | Pages | Source | Vérité terrain | Pourquoi |
|---|---|---|---|---|
| **A — synthétique dégradé** | 20 | `backend/scripts/test_real_export_v2.py` : fonction `build_ocr_text` produit le texte complet de chaque document, `create_real_pdf_reportlab` l'écrit en PDF (`Vérifié`). Prendre les 20 premiers PDF du run `GED_EXPORT_SEED=237` (10 pages RH/Finances/Informatique, 10 pages ambiguës) | **exacte, sans saisie** : le texte généré est sauvegardé dans `truth/<nom>.txt` par le script de bench au moment de la génération (ou extrait du PDF natif par `pdftotext -layout`) | mesure propre du moteur, indépendante du scanner |
| **B — scans réels** | 10 | PDF ou JPEG de documents administratifs réels fournis par le PO / l'équipe (courriers, factures, arrêtés), anonymisés, **jamais versionnés** (dossier `bench/real/` dans `.gitignore`) | **sans saisie manuelle** : pour chaque scan, l'original numérique s'il existe (`pdftotext`) ; sinon vérité terrain = consensus : texte Tesseract `tessdata_best` à 300 dpi **relu** 5 min par ci-qa (correction des seules erreurs visibles). À défaut de scans réels le 14/11 : lot B = 10 pages du lot A **imprimées puis photographiées / scannées** au téléphone | représentativité (bruit, inclinaison, tampons) |

Dégradation du lot A pour simuler des scans (Pillow, déterministe, graine 237) : rendu 200 dpi (`pdftoppm -r 200`), rotation aléatoire ±2°, flou gaussien rayon 0,6, bruit gaussien σ = 8, compression JPEG qualité 55, 4 pages sur 20 en niveaux de gris seuillés (photocopie). Les 20 images dégradées **et** les 20 rendus propres sont évalués (40 mesures pour le lot A ; le tableau final garde les deux colonnes).

## 2. Moteurs et configurations (une ligne = une configuration)

| Code | Moteur | Installation | Appel |
|---|---|---|---|
| T-fast | Tesseract 5 `fra+eng`, tessdata par défaut de l'image | déjà dans `backend/Dockerfile` (`tesseract-ocr-fra`, `tesseract-ocr-eng`, `Vérifié`) | `pytesseract.image_to_string(img, lang="fra+eng", config="--psm 6")` (même usage que `tesseract_engine.py`) |
| T-best | Tesseract 5, `tessdata_best/fra.traineddata` | `curl` du fichier depuis github.com/tesseract-ocr/tessdata_best dans `/usr/share/tesseract-ocr/5/tessdata/` de l'image de bench | idem, `--oem 1` |
| E | EasyOCR 1.7.2 `['fr','en']`, CPU | déjà dans l'image (`torch==2.6.0` CPU, `Vérifié`) | `reader.readtext(img, detail=0, paragraph=True)` |
| R | RapidOCR 3.10 (ONNX Runtime), modèles PP-OCRv6 small, reconnaissance latin/français | `pip install rapidocr==3.10.0 onnxruntime` dans l'image de bench ; sélection du modèle de reconnaissance latin/français selon `rapidai.github.io/RapidOCRDocs/main/model_list/` (`Déduit` : paramètre `params={"Rec.lang_type": "latin"}` ou équivalent v6 ; noter la valeur exacte utilisée dans le tableau) | `RapidOCR()(img_path)` → `result.txts` joints par `\n` |

Image de bench : `Dockerfile.bench` = `FROM` l'image `api` déjà construite + `pip install rapidocr onnxruntime jiwer` + téléchargement `tessdata_best/fra`. Aucun changement à `backend/Dockerfile`.

## 3. Mesures

| Mesure | Comment | Unité |
|---|---|---|
| **CER** (taux d'erreur caractères) | `jiwer` 4.0 (`Vérifié` sur PyPI) : `jiwer.cer(truth, hyp)` après normalisation identique des deux textes : NFKC, espaces multiples → un, retours à la ligne → espace, minuscules ; **sans** retirer les accents (ils comptent) | % ; moyenne par lot et médiane |
| WER (indicatif) | `jiwer.wer` même normalisation | % |
| **Temps par page** | `time.perf_counter()` autour de l'appel moteur seul (chargement des modèles mesuré une fois à part, en « temps de démarrage ») | s/page, moyenne et P95 |
| **Pic mémoire** | le script est lancé **par moteur** dans un conteneur distinct `docker run --rm --memory=1g --memory-swap=1g --cpus=2` ; à la fin, lire `/sys/fs/cgroup/memory.peak` (cgroup v2, `Déduit` : si absent, utiliser `docker stats --no-stream` en boucle toutes les 0,5 s depuis l'hôte et garder le maximum) ; noter aussi un éventuel OOM (code de sortie 137) | Mo |
| Taille installée | `pip show` + `du -sh` de `site-packages/torch` vs `onnxruntime` + modèles | Mo |

Un run complet = 4 configurations × 50 images (20 propres + 20 dégradées + 10 réelles) ; à 1–3 s/page, < 15 min de calcul.

## 4. Seuils de décision (DEC-2026-003)

| Critère | Seuil | Si non atteint |
|---|---|---|
| CER R ≤ CER E sur le **lot B** (réel) **et** sur le lot A dégradé | go OCR-1 | si R est pire de ≤ 1 point de CER mais 2× plus rapide et sous 1 Go : go avec mention ; au-delà : no-go, rester Tesseract-first + EasyOCR en V1, revoir en V1.1 |
| Pic mémoire conteneur R < **1 Go** (modèles chargés + 1 page A4 300 dpi) | go | no-go pour le VPS ; OCR-1 peut rester utile pour la taille d'image mais ne résout pas la RAM |
| Temps R par page ≤ temps E | attendu (`Documenté` : 0,6 s vs ~2 s) | information seulement |
| T-best vs T-fast | si T-best réduit le CER de ≥ 2 points, l'adopter immédiatement (changement de fichier de données, 0 code) | — |

## 5. Format du tableau de résultat (walkthrough ci-qa, à copier tel quel)

| Config | Lot | CER moy. | CER méd. | WER | s/page moy. | s/page P95 | Démarrage (s) | Pic RAM (Mo) | OOM | Taille (Mo) |
|---|---|---|---|---|---|---|---|---|---|---|
| T-fast | A propre / A dégradé / B | | | | | | | | | |
| T-best | … | | | | | | | | | |
| E | … | | | | | | | | | |
| R (modèle : …) | … | | | | | | | | | |

Suivi de : version exacte des paquets (`pip freeze | grep -i -E "rapidocr|onnxruntime|easyocr|torch|pytesseract"`), `tesseract --version`, machine (CPU, Docker), graine, date, et **verdict** en une phrase par critère du § 4. Le CSV brut (`bench_ocr_0_results.csv`, une ligne par image × config) est joint au walkthrough.

## 6. Déroulé pour ci-qa (0,5 j)

1. (30 min) Générer le lot A dans le conteneur `api` : `GED_EXPORT_OUT=/tmp/bench GED_EXPORT_DOC_COUNT=20 python -I scripts/test_real_export_v2.py` (si la variable de sortie n'est pas encore acceptée par le script, copier les 20 PDF depuis le chemin par défaut) ; sauvegarder la vérité terrain ; rendre et dégrader les images.
2. (30 min) Déposer le lot B dans `bench/real/` avec sa vérité terrain ; anonymisation vérifiée (aucun nom réel, aucun NIU).
3. (30 min) Construire `Dockerfile.bench` ; vérifier que les 4 configurations tournent sur une image.
4. (60 min) 4 runs plafonnés, un par configuration ; CSV + mémoire.
5. (60 min) Tableau § 5, verdict § 4, walkthrough `DONE`, message à l'orchestrateur et à l'innovateur (si no-go : DEC-2026-003 à amender).

## 7. Pièges connus

- Ne pas mesurer la mémoire du conteneur `worker` complet (Celery + 2 processus) : la cible DEC-003 est le **moteur** ; la mesure worker se fera en OCR-1.
- `jiwer` exige des chaînes non vides : une page vide côté hypothèse donne CER = 1,0, à garder (c'est une vraie défaillance).
- Tesseract `--psm 6` suppose un bloc uniforme ; pour les scans réels avec colonnes, noter si `--psm 3` fait mieux, sans en faire une configuration de plus.
- EasyOCR télécharge ses modèles au premier appel : les inclure dans l'image de bench (`Dockerfile.bench`) pour que le temps de démarrage ne compte pas le réseau.
- RapidOCR : vérifier que les modèles téléchargés sont bien la variante **PP-OCRv6 small** et la langue latin/français ; le nom du modèle figure dans le tableau.
