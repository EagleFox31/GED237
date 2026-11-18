# Note de décision — OCR adaptatif : régler l'OCR d'après l'image, pas d'après le nom du fichier

| | |
|---|---|
| Statut | **Décidé le 18/11/2026 par le PO** : palier 1 en V1.2 ; palier 2 tranché sur les chiffres du palier 1 (§ 11) |
| Date | 18/11/2026 |
| Auteur | Innovateur |
| Cible | V1.2. Rien n'entre avant la démo du 30/11. |
| Liens | [decision-vote-ocr.md](decision-vote-ocr.md) · [protocole-ocr-0.md](protocole-ocr-0.md) (dossier `gestion-projet/innovateur/`) |
| Niveaux de preuve | `Vérifié` : lu ou mesuré ce jour · `Documenté` : doc de l'éditeur · `Déduit` : raisonnement, à mesurer · `Proposé` |

## Réponse courte au PO

**Nous utilisons l'OCR presque en brut.**

- Il existe un petit aiguillage : le **nom du fichier** choisit le moteur, et une **confiance basse** déclenche un second moteur.
- Rien ne regarde l'image. Aucun réglage du moteur ne change d'un document à l'autre.
- Aucune préparation de l'image : ni redressement, ni contraste, ni orientation.

Proposition : mesurer l'image, choisir un **profil** de réglages écrit dans un fichier de configuration, et ne relire une page qu'en cas de besoin, dans un budget de mémoire et de temps.

## 1. Constat vérifié dans le code

Branche lue : `feat/v11-ocr-rapidocr` (commit `7ff7628`, 18/11). La branche `main` n'a pas encore RapidOCR (`Vérifié`). Chemins relatifs à `backend/app/`.

| Constat annoncé | Verdict | Preuve | Précision |
|---|---|---|---|
| Type deviné par le nom du fichier | **Confirmé** | `services/ocr/strategy.py:171-206` | Le test porte sur le chemin complet (`:185`), par morceau de mot. « form » est dans « formation », « information », « conforme ». Une photo nommée par sa date (`20261118_101500.jpg`) tombe en « inconnu » et part chez Tesseract. |
| Tesseract toujours en `--psm 3`, `fra+eng` | **Confirmé** | `services/ocr/tesseract_engine.py:36-37`, `:82` | Tesseract est lancé **deux fois par page** : pour le texte (`:79`), puis pour la confiance (`:86`). Aucun délai maximal. |
| Aucun prétraitement | **Confirmé** | Recherche vide dans `backend/app` (redressement, binarisation, orientation, EXIF) | Seule opération : réduction de taille avant RapidOCR (`rapidocr_engine.py:88-97`). L'orientation EXIF des photos n'est pas appliquée (`tesseract_engine.py:62`, `rapidocr_engine.py:100`). Le classifieur d'orientation de RapidOCR est coupé (`rapidocr_params.py:13`). |
| Repli sur la confiance | **Confirmé, avec deux limites** | `strategy.py:48-69` ; seuil 0,70 (`base.py:22-25`) | (a) Le repli lourd est coupé par défaut (`core/config.py:171`) : un scan ou un fichier « inconnu » mal lu par Tesseract n'a **aucune seconde chance** (`strategy.py:231-236`). (b) On compare la confiance de deux moteurs qui ne la calculent pas de la même façon (`Déduit`). |
| Taille RapidOCR fixe, 1800 px | **Confirmé** | `core/config.py:149-151` ; `docker-compose.yml:195` | Réglable par variable d'environnement, mais identique pour toutes les images. |
| Pic mémoire ≈ 630 Mo | **Confirmé, à préciser** | Banc de Q, 18/11 15:05 : 626 Mo | C'est le moteur seul. Sur la pile complète, le worker a culminé à **997 Mo**, puis **811 Mo** une fois les moteurs chargés à la demande (#374), sans arrêt mémoire (Q, 18/11 15:31 et 15:42). |
| Worker 2 Go, une tâche à la fois | **Confirmé** | `docker-compose.yml:171-174` | Sur le serveur de démonstration, le plafond prévu est **1 200 Mo** (`decision-vote-ocr.md` § 0). C'est lui qui dimensionne. |

Constats voisins, relevés pendant la lecture (`Vérifié` sauf mention) :

- **PDF scannés** : rendus à 200 DPI (`strategy.py:143`), lus par Tesseract seul (`:148`). Jamais de RapidOCR, jamais de détection de type.
- **Aucun plafond de threads** dans le code ni dans la pile (recherche vide). Le banc a mesuré 9,7 s/page sans plafond contre 3,2 s avec (`protocole-ocr-0.md` § 3).
- **Trois anomalies à traiter à part** (tickets, hors de cette note) : toutes les pages d'un PDF sont rendues en mémoire d'un coup (≈ 11,6 Mo par page A4, `Déduit`) ; un PDF mixte n'est pas lu sur ses pages scannées dès qu'une page porte du texte (`strategy.py:137-139`) ; le moteur enregistré pour un PDF scanné est faux (`workers/tasks.py:106`).

## 2. Analyser l'image, sans se fier au nom

Principe : une seule lecture du fichier. Les mesures se font sur une **vignette grise** (plus grand côté 1000 px). L'image doit de toute façon être décodée pour l'OCR.

Les coûts ci-dessous sont des ordres de grandeur (`Déduit`). Q les mesure au lot 2.

| Signal | Comment on le mesure | Coût CPU | Coût RAM | Sert à |
|---|---|---|---|---|
| Taille et résolution | Largeur, hauteur, DPI déclaré dans le fichier | < 5 ms (en-tête) | nul | Agrandir une petite image ; réduire une très grande |
| Appareil photo | EXIF : marque et modèle présents | < 5 ms (en-tête) | nul | Indice fort de photo |
| Orientation déclarée | EXIF : orientation | < 5 ms | nul | Remettre la photo droite. Gratuit. |
| Netteté | Variance du Laplacien sur la vignette | ≈ 5 ms | ≈ 6 Mo | Écarter une 2e passe inutile ; signaler « à revoir » |
| Contraste | Écart entre les tons clairs et sombres (histogramme) | ≈ 1 ms | négligeable | Décider d'un rehaussement ou d'une binarisation locale |
| Éclairage inégal | Écart de luminosité du fond entre les zones de la page | ≈ 5 ms | négligeable | Indice de photo ; binarisation locale |
| Couleur | Saturation moyenne | ≈ 2 ms | ≈ 2 Mo | Photo (couleur) ou scan (gris, noir et blanc) |
| Inclinaison | Angle dominant des lignes de texte (Hough ou rectangle englobant) | 10 à 50 ms | ≈ 5 Mo | Redresser avant Tesseract |
| Orientation 90/180/270 | Détecteur d'orientation de Tesseract (OSD) | 0,5 à 2 s (un lancement de plus) | ≈ 100 Mo | Réservé à la 2e passe : trop cher pour chaque page |
| Traits de formulaire | Nombre de longs traits horizontaux et verticaux | compris dans l'inclinaison | — | Indice de formulaire |

**Photo ou scan** : un score, pas un seul critère.

- Vers « photo » : marque et modèle EXIF (fort) ; couleur et éclairage inégal (moyen) ; pas de DPI (faible).
- Vers « scan » : DPI déclaré ; format proche de l'A4 ; gris ou noir et blanc ; fond uniforme.
- Vers « capture d'écran » : PNG ; ni EXIF ni DPI d'impression ; très net ; grandes zones unies.
- Score incertain : profil « inconnu », c'est-à-dire le comportement actuel.

Limite connue : les messageries retirent souvent l'EXIF (`Déduit`, à vérifier sur les 7 photos de messagerie du banc). La couleur et l'éclairage prennent alors le relais.

Budget total de l'analyse : **≤ 0,3 s et ≤ 50 Mo par page** (critère S5).

## 3. Table de décision : signal → prétraitement → moteur → paramètres

Les seuils sont des **points de départ**. La calibration (§ 5) les fixe. Le profil par défaut reproduit le comportement actuel.

| Profil | Reconnu par | Prétraitement | Moteur, 1re passe | Paramètres |
|---|---|---|---|---|
| `scan-propre` | DPI déclaré ou format A4 ; net ; droit ; fond uniforme | aucun | Tesseract | `psm 3` ; un seul lancement |
| `scan-penche` | inclinaison au-dessus du seuil (départ : 1°) | redressement | Tesseract | `psm 3` |
| `scan-bruite` | contraste faible ou fond irrégulier, sans indice de photo | rehaussement du contraste | Tesseract | `psm 3` ; `thresholding_method` 1 ou 2 |
| `photo` | score « photo » | orientation EXIF ; redressement si besoin | RapidOCR | taille 1800 ; `use_cls` coupé |
| `photo-floue` | netteté sous le seuil | orientation EXIF | RapidOCR | pas de 2e passe ; marquée « à revoir » |
| `formulaire` | beaucoup de traits horizontaux et verticaux | orientation EXIF | RapidOCR | taille 1800 ; 2e passe Tesseract `psm 11` |
| `capture` | score « capture d'écran » | agrandissement ×2 si petite | RapidOCR | pas de réduction sous 1800 px |
| `petite-image` | plus grand côté < 1000 px ou DPI < 150 | agrandissement ×2 | selon le type | Tesseract lit mieux vers 300 DPI |
| `inconnu` | score incertain | aucun | Tesseract | `psm 3`. **Comportement actuel.** |

Ce que le banc de Q dit déjà (`Vérifié`, rappel pondéré par mot, `rapport-v2-agg.txt` et passation de Q du 18/11) :

| Lot | Tesseract `psm 3` | RapidOCR | Lecture |
|---|---|---|---|
| Scans propres (14 pages) | 0,867 | 0,879 à 0,935 | Quasi-égalité. Tesseract reste le choix : 3,5 s contre 18,6 s par page sur le serveur de démonstration. |
| Scans bruités (11) | **0,904** | 0,853 à 0,928 | Pas d'avantage net. Tesseract d'abord. |
| Photos de synthèse (5) | 0,888 | **0,957 à 0,966** | RapidOCR. |
| Photo réelle (1) | 0,732 | **0,879 à 0,905** | RapidOCR, mais une seule image. |
| Formulaires FUNSD (5) | 0,465 | **0,743 à 0,820** | Le moteur compte plus que le réglage : `psm 6` donne 0,459 et `psm 11` 0,517. |

Taille envoyée à RapidOCR (`Vérifié`) : 1600 px → 567 Mo ; 1800 → 626 Mo ; 2000 → 758 Mo ; sans réduction → 966 Mo. Le rappel bouge de moins de 1,5 point. **La taille règle surtout la mémoire.**

## 4. Deuxième passe, bornée

Leçon du banc v3 (`decision-vote-ocr.md` § 5) : relire la même image avec un autre moteur et garder la meilleure confiance rapporte **+0,0 point**. Fusionner les mots de deux moteurs fait chuter la précision de 24 points. La 2e passe doit donc **changer l'image ou le réglage**, pas seulement le moteur.

**Déclenchement** : texte vide, ou confiance sous le seuil du profil (0,70 aujourd'hui).

**Ce qui change à la 2e passe** : une seule variante, écrite dans le profil.

| Après | 2e passe |
|---|---|
| Tesseract sur un scan | orientation corrigée par OSD si l'OSD est sûr ; sinon binarisation locale (`thresholding_method` 2) |
| RapidOCR sur une photo | rotation d'un quart de tour si les lignes sont verticales, sens donné par `use_cls` ; sinon Tesseract `psm 11` |
| RapidOCR sur un formulaire | Tesseract `psm 11` |

**Bornes** :

- **Deux passes au plus par page.** Jamais trois.
- **Mémoire** : passes l'une après l'autre, jamais ensemble. L'image de la 1re passe est libérée avant la 2e. Jamais d'agrandissement pour RapidOCR. Repère mesuré : 795 Mo avec trois moteurs enchaînés dans un même processus (banc v3).
- **Temps** : budget par page, repris de C3 : 30 s en moyenne, 60 s au plus. La 2e passe ne part que si le temps restant couvre sa durée estimée. Tesseract reçoit un délai maximal, absent aujourd'hui.
- **Document long** : plafond du nombre de pages relues par document, pour qu'un PDF de 200 pages ne double pas de durée.

**Règle d'arrêt** :

- Arrêt après la 1re passe si la confiance atteint le seuil.
- Pas de 2e passe sur une page vide ou trop floue : elle ne lira rien de plus.
- Arrêt après la 2e passe, quel que soit le résultat.

**Choix du meilleur résultat** :

- On garde **une page entière**. On ne fusionne jamais deux textes.
- 1re passe vide et 2e non vide : on garde la 2e.
- Même moteur : la confiance la plus haute gagne.
- Moteurs différents : comparaison sur une confiance **ramenée à la même échelle** par la calibration, et sur le nombre de mots plausibles. Jamais la confiance brute.
- On enregistre le profil, le moteur réellement utilisé et le nombre de passes, dans les métadonnées déjà stockées avec le document (`workers/tasks.py:49-53`). Aucune migration.

## 5. Calibration hors ligne et profils déclaratifs

**Les seuils ne sont pas dans le code.** Ils vivent dans un fichier versionné (YAML, emplacement fixé par B), contrôlé au démarrage. Un fichier invalide bloque le démarrage avec un message clair.

Extrait illustratif (valeurs fictives) :

```yaml
profiles:
  photo:
    match: {exif_camera: true, eclairage_inegal_min: 0.15}
    engine: rapidocr
    params: {max_side: 1800, use_cls: false}
```

L'en-tête du fichier porte : version, date, empreinte du corpus, versions des moteurs.

Interrupteur unique proposé : `OCR_ADAPTIVE_MODE` = `off` (défaut, comportement actuel) · `observe` (mesure et journalise, ne change rien) · `on`.

**Procédure de calibration** (Q, sur le banc existant, conteneur plafonné comme aujourd'hui) :

1. **Corpus** : celui du banc (14 propres, 11 bruités, 1 photo, 5 photos de synthèse, 5 formulaires ; 3 manuscrits hors décision). Deux ajouts :
   - au moins **20 photos réelles** de documents prises au téléphone, jamais versionnées. C'est déjà la condition posée dans `plan-v1.2.md` ;
   - un lot « dégradé contrôlé » tiré des pages existantes, à graine fixe : rotations 90/180/270, inclinaisons de 2, 5 et 10°, flou, contraste réduit. La vérité terrain est celle de la page source.
2. **Découpage** : une part pour régler, une part pour valider, par lot, à graine fixe.
3. **Grille courte** : 2 ou 3 valeurs par seuil, pas plus de 8 seuils. Même mécanique que `bench2.py` (variante × taille × lots).
4. **Mesures inchangées** : rappel pondéré par mot (mesure retenue), précision (garde-fou), secondes par page, pic `memory.peak`. Même format de CSV.
5. **Sortie** : le fichier de profils et un rapport par lot, joints au walkthrough de Q.

**Recalibrage** : à chaque changement de version d'un moteur ou d'un modèle, à chaque ajout de 10 pages au corpus, à chaque changement du plafond du worker. Même commande, même rapport. Le diff du fichier est relu en PR.

**Critère de non-régression** (repris de C2) : sur chaque lot, rappel ≥ référence − 1 point et précision ≥ référence − 2 points. La référence est le traitement actuel, sur les mêmes pages, dans le même passage. Mode `off` : sorties identiques à aujourd'hui sur 5 pages témoin.

## 6. Veille

Toutes les pages ont été consultées le **18/11/2026**.

| Sujet | Ce que dit la source | Niveau | Lien |
|---|---|---|---|
| Tesseract, qualité | Meilleur vers 300 DPI. La binarisation interne (Otsu) « peut être sous-optimale ». La segmentation en lignes se dégrade nettement si la page est penchée. Les bords sombres de scan créent de faux caractères. Traits trop gras ou trop fins : érosion ou dilatation. Texte sombre sur fond clair. | `Documenté` | https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html |
| Tesseract, modes `psm` | 14 modes, 0 à 13. 3 = automatique (défaut). 6 = bloc uniforme. 11 = texte épars. 0 = orientation et écriture seulement (OSD). | `Documenté` | https://github.com/tesseract-ocr/tesseract/blob/main/doc/tesseract.1.asc |
| Tesseract, binarisation | `thresholding_method` : 0 Otsu global (défaut) ; 1 Otsu par tuiles, « meilleur en éclairage inégal » ; 2 Sauvola, « pour les documents très dégradés ». Option `--dpi`. | `Documenté` | même page |
| Tesseract, OSD | Demande `osd.traineddata` dans le dossier des modèles. Présence dans notre image **à vérifier**. | `Documenté` | https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html |
| OSD, limite | Échec « Too few characters » sur les pages pauvres en texte ; l'OSD ne donne que des quarts de tour. | Retours d'utilisateurs, non officiel | https://www.github.com/tesseract-ocr/tesseract/issues/4172 |
| pytesseract | `image_to_data` rend boîtes et confiances. `image_to_osd` rend orientation et écriture. `timeout` arrête Tesseract et lève une erreur. Version 0.3.13. | `Documenté` | https://pypi.org/project/pytesseract/ |
| OCRmyPDF, options | `--deskew` (pages penchées). `--rotate-pages` (quarts de tour ; seuil par défaut 14, « prudent »). `--clean` (unpaper, sans toucher au fichier final). `--oversample`. `--tesseract-pagesegmode` (défaut 3). `--tesseract-thresholding` : `auto`, `otsu`, `adaptive-otsu`, `sauvola`. Délai par page : 180 s. | `Documenté` | https://ocrmypdf.readthedocs.io/en/latest/cookbook.html · https://ocrmypdf.readthedocs.io/en/latest/advanced.html |
| OCRmyPDF et RapidOCR | Moteur optionnel depuis la 17.14.0 (08/11) : `--ocr-engine rapidocr`. Environ 1,2 Go par worker à la taille par défaut (2000 px), environ 4 fois le temps de Tesseract. Deux versions correctives depuis (17.14.2 le 16/11). | `Documenté` | https://github.com/ocrmypdf/OCRmyPDF/releases |
| OCRmyPDF, sortie et licence | Licence MPL-2.0. Le fichier texte annexe contient le texte ; aucune confiance n'y est mentionnée. Python 3.11 ou plus. unpaper 6.1 ou plus, optionnel. | `Documenté` | https://github.com/ocrmypdf/OCRmyPDF · https://ocrmypdf.readthedocs.io/en/latest/installation.html |
| unpaper | Nettoyage de pages scannées : bords sombres, centrage, redressement. Licence **GNU GPL v2**. Dépendance obligatoire : ffmpeg. | `Documenté` | https://github.com/unpaper/unpaper |
| RapidOCR, paramètres | `Global.use_cls` : sens des lignes, 0 ou 180° seulement. `Global.max_side_len` 2000. `Det.limit_side_len` 736, `Det.limit_type` min. `Det.box_thresh` 0,5. `Global.text_score` 0,5. Threads ONNX réglables. Le nom `use_angle_cls` vient de PaddleOCR ; ici c'est `Global.use_cls`. | `Documenté` | https://rapidai.github.io/RapidOCRDocs/main/install_usage/rapidocr/parameters/ |
| RapidOCR, dépendances | Version 3.10.0, Apache-2.0. Dépend d'OpenCV (sans interface), numpy, Pillow, PyYAML. **Les briques d'analyse sont donc déjà dans notre image.** | `Documenté` | https://pypi.org/project/rapidocr/ · https://github.com/RapidAI/RapidOCR/blob/main/python/requirements.txt |
| OpenCV, inclinaison | `minAreaRect` rend centre, taille et angle. `HoughLinesP` rend des segments de droite. | `Documenté` | https://github.com/opencv/opencv/blob/4.x/doc/py_tutorials/py_imgproc/py_houghlines/py_houghlines.markdown |
| Flou | Variance du Laplacien (Pech-Pacheco, 2000). Seuil 100 dans l'article, « très dépendant du domaine » : à calibrer chez nous. | Article technique | https://pyimagesearch.com/2015/09/07/blur-detection-with-opencv/ |
| Pillow 13 | `exif_transpose` applique l'orientation EXIF. Le DPI d'un JPEG n'est exposé que si le fichier le déclare en pouces. | `Documenté` | https://pillow.readthedocs.io/en/stable/reference/ImageOps.html |
| Redressement, existant | `sbrunner/deskew` (MIT, 531 étoiles, actif, tire scikit-image) ; `galfar/deskew` (MPL-2.0, outil en ligne de commande) ; `phamquiluan/jdeskew` (MIT) ; `kakul/Alyn` (MIT, arrêté en 2019). | `gh search repos`, 18/11 | https://github.com/sbrunner/deskew |

Limites de cette veille :

- La doc en ligne d'OpenCV a refusé l'accès ; j'ai lu les sources des tutoriels sur GitHub.
- La hauteur idéale des lettres pour Tesseract (20 à 40 px selon des fils de discussion) n'a pas été lue à la source. À mesurer.
- Aucun chiffre de gain publié n'a été retenu : aucun ne porte sur nos documents.

## 7. Trois approches comparées

| Critère | A — Règles et profils calibrés | B — Déléguer à OCRmyPDF | C — Plusieurs passes systématiques et vote |
|---|---|---|---|
| Principe | Analyse → profil → 1 passe, 2e si besoin | OCRmyPDF fait redressement, rotation, nettoyage, OCR | Chaque page est lue 2 ou 3 fois, on garde le meilleur |
| Gain attendu | Ciblé sur les pages mal aiguillées, penchées, tournées (§ 10) | Bon sur les PDF scannés ; gère bien les PDF mixtes | **Mesuré : +0,0 à +0,6 point, ou −15** (banc v3) |
| RAM | + ≤ 50 Mo ; moteurs inchangés | ≈ 1,2 Go par worker avec RapidOCR au réglage par défaut | 795 Mo mesurés |
| Temps | + ≤ 0,3 s par page ; 2e passe seulement si confiance basse | Délai par page de 180 s par défaut ; lance ses propres processus | 25 à 43 s par page au banc local (sous charge, indicatif), pour toutes les pages |
| Complexité | Moyenne : un module d'analyse, un chargeur de profils | Faible pour les PDF. Mais ne choisit ni le moteur ni photo ou scan. | Faible |
| Dépendances, licences | Aucune nouvelle | OCRmyPDF (MPL-2.0) et ses paquets ; `--clean` exige unpaper (**GPL v2**, ffmpeg) | Aucune nouvelle |
| Ce qu'on perd | Rien | La confiance par page, donc le repli et le « à revoir » | La précision (variante par mot) |
| Maintenance | Un fichier de profils, une procédure de recalibrage | Suivre un outil tiers ; RapidOCR y a 10 jours | Trois moteurs à garder alignés |
| Worker 2 Go, 1 200 Mo en démonstration | Oui | À prouver ; juste à 1 200 Mo | Oui en RAM, non en temps |

**Recommandation : approche A.**

> **Adapt** : reprendre les recettes d'OCRmyPDF et les réglages natifs de Tesseract et de RapidOCR dans un petit module de profils. **Learn** : OCRmyPDF passe au banc comme point de comparaison. unpaper écarté (GPL, ffmpeg). Approche C écartée sur mesure.

Pourquoi pas B tout de suite : il ne répond pas à la question du PO (il ne choisit pas le réglage selon l'image), il nous retire la confiance par page, et son moteur RapidOCR est trop récent. S'il bat A de 3 points sur les PDF scannés, on le reconsidère pour la version suivante.

## 8. Lots, coût en heures de session, qui fait quoi

B = backend · Q = QA et banc · I = instruction. Estimations de l'innovateur, à confirmer par B et Q.

| Lot | Contenu | B | Q | I | Total |
|---|---|---|---|---|---|
| 0 — Banc prêt | Ranger les scripts du banc dans un endroit durable (ils sont dans un dossier de travail temporaire). Ajouter les 20 photos réelles et le lot « dégradé contrôlé ». Passage de référence. | — | 2 | 1 | 3 |
| 1 — Corrections sûres, sans profil | Orientation EXIF. Un seul lancement de Tesseract par page. Délai maximal pour Tesseract. Plafond de threads. | 2,5 | 1 | — | 3,5 |
| 2 — Analyse en mode `observe` | Mesurer les signaux, les journaliser, ne rien changer. Coût réel et taux d'erreur photo ou scan. | 3 | 1 | — | 4 |
| **Palier 1** | **Point de décision sur chiffres** | **5,5** | **4** | **1** | **10,5** |
| 3 — Profils et table de décision | Fichier de profils, contrôle au démarrage, prétraitements, interrupteur, pages témoin. | 4 | 2 | 0,5 | 6,5 |
| 4 — Calibration | Grille sur le banc, fichier de profils, rapport, verdict de non-régression. | 0,5 | 3 | 1 | 4,5 |
| 5 — 2e passe bornée | Règle, budgets, tests (délai, texte vide, exception), mesure sur la pile et sur le serveur de démonstration. | 3 | 2 | — | 5 |
| 6 — Documents déjà en base | Relecture ciblée des documents à confiance basse, par petits lots, avec le script de relance existant (`reocr.py`, branche `ci/ops-reocr`). | 0,5 | 1 | — | 1,5 |
| **Palier 2** | | **8** | **8** | **1,5** | **17,5** |
| **Total** | | **13,5** | **12** | **2,5** | **28 h-s** |
| Option — OCRmyPDF au banc | Point de comparaison sur les PDF scannés. | — | 1,5 | 0,5 | 2 |

Coût face au 30/11 : **0 h-s avant la démo**. Réversibilité : totale, par l'interrupteur, sans reconstruire l'image.

## 9. Risques et parades

| Risque | Parade |
|---|---|
| Régression sur les scans propres, le cas courant | Profil par défaut = comportement actuel. Critère S2. Pages témoin. Interrupteur. |
| Dérive du temps de traitement | Budget par page et par document. Deux passes au plus. Délai maximal sur Tesseract. Mesure du temps moyen et du P95. |
| Dépassement mémoire | Passes l'une après l'autre. Pas d'agrandissement pour RapidOCR. Mesure par `memory.peak` du conteneur (leçon 059). Critère S4. |
| Fausse détection photo ou scan | Score à plusieurs signaux. Doute → « inconnu ». Mode `observe` avant toute activation. Critère S5. |
| Surcalibrage sur un petit corpus | Part de validation séparée. 8 seuils au plus. Un seuil ne bouge que pour un gain ≥ 1 point en validation. 20 photos réelles exigées. |
| Redressement qui abîme une page droite (tableaux, images) | Appliqué seulement entre deux bornes d'angle, et si l'estimation est stable. |
| OSD faux sur une page pauvre en texte | OSD en 2e passe seulement, avec un seuil de confiance (départ : 14, la valeur d'OCRmyPDF). |
| Binarisation qui efface tampons et signatures | Elle ne touche que la copie envoyée à l'OCR. Le fichier stocké ne change pas. |
| Activer `use_cls` sans son modèle dans l'image | Le modèle doit être cuit au build, avec contrôle de présence (leçon 059). |
| Banc perdu (dossier temporaire) | Lot 0. |

## 10. Gain attendu par type de document

**Ce sont des hypothèses, à vérifier sur le banc.** Les chiffres « aujourd'hui » sont mesurés (rappel pondéré par mot).

| Type | Aujourd'hui | Levier | Hypothèse |
|---|---|---|---|
| Scan propre | Tesseract 0,867 | Un seul lancement de Tesseract | Qualité inchangée. Temps de lecture réduit d'un tiers à la moitié. |
| Scan penché ou bruité | Tesseract 0,904 (inclinaison de ±2° seulement) | Redressement ; binarisation locale | Faible sous 2°. Net au-delà de 5°. Chiffre inconnu : c'est l'objet du lot « dégradé contrôlé ». |
| Photo de téléphone | RapidOCR 0,905 (1 image) ; Tesseract 0,732 | Détection par l'image ; orientation EXIF | +7 à +17 points pour les photos aujourd'hui envoyées à Tesseract à cause de leur nom. Leur part est inconnue : le lot 2 la mesure. |
| Formulaire | RapidOCR 0,743 à 0,820 ; Tesseract 0,465 | Détection par les traits, pas par le mot « form » | +25 à +35 points pour les formulaires mal aiguillés. `psm 11` seul : +5 points. |
| Capture d'écran | Non mesuré | Agrandissement des petites captures | Inconnu. Lot à créer (texte de l'écran comme vérité). |
| Manuscrit | ≤ 0,10 pour tous les moteurs (3 images) | Aucun | **Reste non lu.** L'OCR adaptatif n'y change rien. Au mieux, la page est marquée « à revoir ». |

## 11. Décision demandée et critères de sortie

**Décision du PO, 18/11/2026** (transmise par O) :

1. **Palier 1 (lots 0 à 2, 10,5 h-s) : oui, en V1.2.** Le lot 0, mettre les bancs à l'abri, est confié à Q (branche `chore/bench-ocr`).
2. **Photos réelles : oui.** Le PO fournit une vingtaine de photos de documents prises au téléphone. Elles vont dans `C:\Users\lawry\Documents\GED237-photos-ocr\`, **hors dépôt**, ne sont **jamais commitées** et ne **quittent jamais la machine**. Le banc les lit à cet emplacement.
3. **unpaper : exclu.**
4. **Palier 2 (17,5 h-s) : non décidé.** Il sera tranché sur les chiffres du palier 1 (critères S1 à S7 ci-dessous).

Questions telles que posées au PO :

1. Lancer le **palier 1** (lots 0 à 2, 10,5 h-s) en V1.2 : oui ou non ?
2. Fournir **20 photos réelles** de documents prises au téléphone, anonymisées : oui ou non ? Sans elles, pas de calibration photo valable.
3. Confirmer l'exclusion d'unpaper (licence GPL).
4. Le palier 2 (17,5 h-s) se décide sur les chiffres du palier 1.

**Critères de sortie**, mesurés sur le banc, mêmes pages, même passage :

| # | Critère | Seuil |
|---|---|---|
| S1 | Rappel sur les pages difficiles (photos, formulaires, lot dégradé) | ≥ +3 points par rapport au traitement actuel |
| S2 | Non-régression sur les scans propres et bruités | rappel ≥ −1 point ; précision ≥ −2 points par lot |
| S3 | Temps sur le serveur de démonstration | ≤ 30 s en moyenne, ≤ 60 s par page ; scans propres pas plus lents qu'aujourd'hui |
| S4 | Mémoire | moteur ≤ 800 Mo au banc ; worker ≤ 1 000 Mo sur la pile ; aucun arrêt mémoire |
| S5 | Analyse | ≤ 0,3 s et ≤ 50 Mo par page ; photo ou scan juste dans ≥ 90 % des cas, le doute allant à « inconnu » |
| S6 | Sécurité | mode `off` identique à aujourd'hui ; tests délai dépassé, texte vide, exception |
| S7 | Profils | fichier versionné, contrôlé au démarrage, rapport de calibration joint ; aucun seuil en dur |

S1 à S4 reprennent les seuils C1 à C4 de `decision-vote-ocr.md`.

## 12. Revue RAIDER

- **Réutilisable** : logique générique, réglages dans le fichier de profils.
- **Agnostique** : les moteurs restent derrière l'interface existante ; chemin du fichier configurable.
- **Idempotent** : même page, même profil, même résultat ; une relecture ne crée aucun doublon.
- **Durable** : défaut inchangé, pages témoin, critère de non-régression, interrupteur.
- **Mémoire d'échecs** : leçon 059 réutilisée. À ajouter : le double lancement de Tesseract et le type deviné par le nom.
- **Ingénierie** : existant recherché avant de construire (§ 6 et § 7) ; moindre dépendance.
- **Rétroactif** : documents déjà en base traités au lot 6, par relecture ciblée, sans relecture de masse.
- **Dérogation** : aucune.
