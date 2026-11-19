# Bancs OCR (V1.1, hors application)

Outils de mesure des moteurs OCR (Tesseract, EasyOCR, RapidOCR) : rappel/précision pondérés, CER, temps,
pic mémoire cgroup. Rien ici n'est importé par l'application.

| Fichier | Rôle |
|---|---|
| `bench_ocr_0.py` / `.sh` | protocole OCR-0 : préparation des lots (PDF → propre/dégradé), mesure par moteur sous plafond 1 Go / 2 cpu, tableau Markdown |
| `bench2.py` | variantes (tesseract, rapidocr), réduction `maxside`, lots au choix |
| `bench3.py` | vote multi-moteurs |
| `bench_real.py` | mesure avec le vrai `RapidOCREngine` de l'image (réglages par défaut) |
| `base_rss.py`, `order_free.py` | mémoire de base ; comparaison indépendante de l'ordre des mots |
| `synth_photos.py` | lot « photo dégradée » synthétique, à graine fixe (237), reproductible |
| `Dockerfile.bench`, `Dockerfile.r2` | image de mesure dérivée de l'image API ; modèles v5 latin au build (le run n'a pas de réseau) |

## Lancer

```
BASE_IMAGE=<image API construite> backend/scripts/bench_ocr/bench_ocr_0.sh <dossier de travail> [dossier de PDF]
```

Le dossier de travail reçoit `truth/` (texte de référence, `<nom image>.txt`), `clean/`, `degraded/` et
`results/`. Les autres scripts attendent leurs lots montés en `/bench/<lot>` et la vérité en
`/bench/truth` dans l'image de mesure, avec `--memory=2g --cpus=1 --network=none` pour reproduire la prod.
Les images et les résultats restent dans le dossier de travail, hors du dépôt (`.gitignore`).

## Photos réelles (règle stricte)

Les photos réelles (WhatsApp, téléphone) ne sont jamais dans le dépôt :

- dossier local hors dépôt, son chemin est passé en paramètre (aucun chemin utilisateur en dur) ;
- jamais commité, jamais copié ailleurs, jamais envoyé (pas de CI, pas d'artefact, pas de serveur distant) ;
- seuls des chiffres agrégés vont dans les rapports. Les scripts n'écrivent jamais le nom d'un fichier de
  lot privé (`B`, `photo`, `real*`, `photo-whatsapp*`, `photo-reel*`) : ils écrivent `<lot>-NN` (`report_name`).
