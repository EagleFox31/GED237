# OCR léger sur CPU — veille du 2026-11-09 (évaluation Reuse-first)

Niveau : `Documenté` (sources web listées en fin de fiche, consultées le 2026-11-09) ; état GED237 `Vérifié`
(`backend/app/services/ocr/strategy.py`, `requirements.txt`, `Dockerfile`). Chiffres de vitesse et de RAM
repris tels que publiés par les éditeurs ; **aucun n'a été mesuré sur le VPS**.

## Contrainte

VPS 2 vCPU, 3,7 Go RAM, sans GPU, Docker ; scans administratifs français (courriers, factures, contrats,
tableaux), quelques fichiers anglais. Besoins : texte brut pour l'index TSVECTOR aujourd'hui, structure
(tableaux, champs, dates) pour les règles par contenu en V1.1.

## État GED237 (Vérifié)

- Stratégie existante : extraction du texte natif des PDF (PyPDF2, en cours de remplacement par pypdf), sinon
  rendu `pdf2image` 200 dpi de **toutes** les pages, Tesseract fra/eng en premier, EasyOCR en secours si la
  confiance est faible. Interface `OCREngine` propre : ajouter un moteur = une classe.
- Manques : pas de détection page par page de la couche texte ; pas de cache par empreinte ; pas de
  pré-traitement (redressement, binarisation) ; EasyOCR impose torch + torchvision + torchaudio CPU dans l'image.
- EasyOCR 1.7.2 : dernière release septembre 2024, 2 à 3 fois plus lent que Tesseract (sources ci-dessous).

## Comparatif (extrait ; détail complet dans le rapport de veille)

| Moteur | Licence | Activité | Sans torch | Français | CPU (éditeur) | Structure | Verdict |
|---|---|---|---|---|---|---|---|
| **RapidOCR + PP-OCRv6 small (ONNX)** | Apache-2.0 | rapidocr 3.10, 2026-10-08 | oui (onnxruntime) | oui (`multi_PP-OCRv6` inclut `french`) | 0,61 s/page sur Xeon, ONNX Runtime ; RAM non publiée | non | **Adapt, moteur principal** |
| **OnnxTR** (docTR en ONNX) | Apache-2.0 | 0.9.0 | oui | vocabulaire fr à confirmer | 0,38 s/page en 8 bits sur i7 ; RAM non publiée | layout/tables via docTR | Alternative si RapidOCR déçoit ; exige Python ≥ 3.11 |
| **OCRmyPDF 17.14 + Tesseract 5.5 `tessdata_best/fra`** | MPL-2.0 / Apache-2.0 | 2026-11-08 / 2026-10-28 | oui | oui | multi-cœurs ; non chiffré | PDF/A « sandwich » | **Adopt, pré-traitement + secours** (`--deskew --rotate-pages --clean --skip-text`, moteur `rapidocr` natif depuis 17.14) |
| PP-OCRv5 moteur Paddle | Apache-2.0 | 2025 | non (Paddle) | modèle `latin` | mobile 1,75 s/page, pic RAM 2,2 Go ; server 4,3 s, 4 Go | non | Écarté : trop lourd en Paddle, préférer la voie ONNX |
| Docling 2.149 (TableFormer) | MIT | 2026-11-08 | non | via moteur OCR | non chiffré | **oui** | Phase 2 tableaux, tâche différée |
| MinerU 4.1 « basic ONNX » | Apache + conditions | 2026 | partiel | non documenté | 2 Go RAM annoncés | oui | Phase 2, licence à relire |
| Surya 2.5 / Marker, Chandra | OpenRAIL-M (plafond de revenus) | 2026 | non | fr 90,9 % (bench interne) | RSS 4,3 Go en Q8 | oui | Écarté : licence non permissive, RAM |
| VLM ≥ 0,9 Md (PaddleOCR-VL, dots.ocr, DeepSeek-OCR 2, olmOCR 2, Nanonets, GOT, Unlimited-OCR) | variées | 2025–2026 | non | souvent non listé | GPU requis, aucune mesure CPU fiable | oui | Écarté pour la V1 ; veille V1.1 on-site GPU |
| EasyOCR 1.7.2 | Apache-2.0 | 2024-09 | non | oui | ~2 s/page | non | **Retirer** |
| MMOCR, Florence-2, Kraken, SmolDocling | — | stagnants ou anglais / patrimoine | — | — | — | — | Écartés |
| Mistral OCR 3 (API) | propriétaire | 2025-12 | — | oui | API | oui | Écarté : données administratives hors du pays (souveraineté) ; référence qualité seulement |

Réserve de lecture : OmniDocBench et les classements publics notent le chinois et l'anglais ; aucun benchmark
public ne compare ces moteurs sur du français administratif. Un **CER mesuré sur 30 pages GED237 réelles**
est le seul critère de bascule acceptable.

## Architecture « subtile » recommandée (Proposé)

1. **Couche texte par page** (pypdfium2, licence permissive ; éviter PyMuPDF AGPL) : page avec texte → extraction
   directe ; sinon rendu 200–300 dpi. Supprime l'OCR inutile sur les PDF mixtes.
2. **Cache par SHA-256** (fichier + version du pipeline) en table Postgres : un second passage est un no-op
   (RAIDER-I) ; les 500 documents de démo sont OCRisés une seule fois, la veille.
3. **Pré-traitement** des seules pages image : OCRmyPDF (`--deskew --rotate-pages --clean --skip-text`) ou
   OpenCV (redressement + binarisation Sauvola).
4. **OCR léger** : RapidOCR PP-OCRv6 small, 1–2 threads ONNX Runtime, file Celery dédiée à concurrence 1,
   limite mémoire du conteneur ; secours Tesseract fra si confiance moyenne sous seuil ou sortie quasi vide.
   torch sort de l'image Docker.
5. **Extraction de champs légère** pour les règles par contenu : regex (dates fr, montants FCFA, références,
   NIU, objet) puis spaCy `fr_core_news_md` (46 Mo, NER F 83) pour organisations, personnes, lieux ; GLiNER
   multilingue INT8 (~130 Mo, Apache) en option zéro-shot pour les libellés métier. Pas de VLM.
6. **Tableaux (phase 2)** : détection heuristique des pages « tableau », puis Docling/TableFormer en tâche
   différée basse priorité.

## Effort et calendrier (Proposé)

| Lot | Contenu | Effort | Quand |
|---|---|---|---|
| OCR-0 | Mesure : CER Tesseract vs RapidOCR vs EasyOCR sur 30 pages réelles ; RAM/temps par page sur le VPS | 0,5 j | avant toute décision ; faisable par Q sans toucher au code produit |
| OCR-1 | `RapidOCREngine` dans la stratégie existante + retrait d'EasyOCR/torch + couche texte par page + cache SHA-256 | 1,5–2 j B | **V1.1** sauf si OCR-0 montre un gain net et que l'ordre 6 est sacrifié (0,5 j minimum pour le seul remplacement de moteur) |
| OCR-2 | OCRmyPDF conteneurisé en pré-traitement | 1–2 j | V1.1 |
| OCR-3 | regex + spaCy → critères « contenu » des règles IFTTT | 2–3 j | V1.1 (lot Mois 5 du CDC) |
| OCR-4 | Tableaux Docling | 3–5 j | V1.2 |

Décision proposée : **Adapt** RapidOCR/PP-OCRv6 + **Adopt** OCRmyPDF, **retrait** d'EasyOCR ; rien avant le
30/11 hormis OCR-0 (mesure) et la pré-OCRisation du corpus de démo la veille (zéro attente en direct, worker
OCR éteint pendant la présentation). Message démo : « OCR imprimé français en local, index plein texte ;
l'extraction de champs par contenu arrive en V1.1 ». Si le PO retient le VPS, OCR-1 devient l'unique moyen de
tenir 3,7 Go avec le worker actif.

## Sources (consultées le 2026-11-09)

- RapidOCR : https://github.com/RapidAI/RapidOCR ; https://pypi.org/project/rapidocr/ ; https://rapidai.github.io/RapidOCRDocs/main/model_list/
- PP-OCRv6 : https://arxiv.org/html/2606.13108v1 ; https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv6/PP-OCRv6.html
- PP-OCRv5 (RAM/vitesse CPU) : http://www.paddleocr.ai/main/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5.html
- OnnxTR / docTR : https://github.com/felixdittrich92/OnnxTR ; https://github.com/mindee/doctr
- OCRmyPDF : https://github.com/ocrmypdf/OCRmyPDF/releases ; Tesseract : https://github.com/tesseract-ocr/tesseract/releases ; https://github.com/tesseract-ocr/tessdata_best
- EasyOCR : https://pypi.org/project/easyocr/
- Docling : https://github.com/docling-project/docling ; MinerU : https://github.com/opendatalab/MinerU
- Surya / Chandra : https://github.com/datalab-to/surya ; https://github.com/datalab-to/chandra
- VLM : https://arxiv.org/pdf/2510.14528 (PaddleOCR-VL) ; https://github.com/rednote-hilab/dots.ocr ; https://github.com/deepseek-ai/DeepSeek-OCR ; https://github.com/allenai/olmocr ; https://github.com/baidu/Unlimited-OCR
- Mistral OCR : https://docs.mistral.ai/capabilities/document_ai/basic_ocr/
- Extraction de champs : https://github.com/urchade/GLiNER ; https://pypi.org/project/fr-core-news-md/
- PDF : https://pypi.org/project/pypdfium2/ ; https://pymupdf.readthedocs.io/en/latest/about.html (AGPL)
- Comparatifs : https://www.docsumo.com/blog/best-ocr-models (2026-09-30) ; https://arxiv.org/html/2510.03570v1 ; https://imagetotable.ai/references/tesseract-vs-paddleocr-receipt-benchmark
