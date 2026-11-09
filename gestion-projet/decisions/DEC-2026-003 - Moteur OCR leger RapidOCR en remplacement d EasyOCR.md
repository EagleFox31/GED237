# DEC-2026-003 — Moteur OCR léger : RapidOCR (PP-OCRv6 ONNX) en remplacement d'EasyOCR

- **Statut** : ACCEPTÉ par le PO le 2026-11-09 (« je valide ») sur la base de la veille `innovateur/sources/ocr-leger.md` ; placement dans le plan laissé à l'orchestrateur.
- **Instruction** : innovateur, 2026-11-09. Niveau : `Documenté` (sources datées dans la fiche), état GED237 `Vérifié`.

## Décision

1. **Adapt** : ajouter un moteur `RapidOCREngine` (RapidOCR + modèles PP-OCRv6 small multilingues, ONNX Runtime, Apache-2.0) dans la stratégie OCR existante (`services/ocr/strategy.py`, interface `OCREngine`), moteur principal pour les pages image ; Tesseract fra reste le secours.
2. **Retirer** EasyOCR et ses dépendances torch / torchvision / torchaudio de `requirements.txt` et du `Dockerfile`.
3. **Pipeline** : détection de la couche texte page par page (pypdfium2), cache par SHA-256 (fichier + version du pipeline), file Celery dédiée à concurrence 1 avec limite mémoire du conteneur.
4. **Adopt** OCRmyPDF en pré-traitement des pages image (redressement, nettoyage) : lot séparé, V1.1.
5. **Écartés** : modèles vision-langage (GPU requis), Surya/Marker (licence à plafond de revenus), API externes (souveraineté des données).

## Lots et critères de clôture

| Lot | Contenu | Session | Effort | Preuve attendue |
|---|---|---|---|---|
| OCR-0 | Mesure sur 30 pages réelles : CER Tesseract vs RapidOCR vs EasyOCR ; RAM et temps par page sur le VPS (ou conteneur plafonné équivalent) | Q | 0,5 j | tableau chiffré dans un walkthrough ; condition de go pour OCR-1 : CER RapidOCR ≤ CER EasyOCR et RAM du worker < 1 Go |
| OCR-1 | `RapidOCREngine` + retrait EasyOCR/torch + couche texte par page + cache SHA-256 | B | 1,5–2 j | tests unitaires du moteur et du cache ; taille d'image Docker avant/après ; corpus de démo ré-OCRisé |
| OCR-2 | OCRmyPDF conteneurisé en pré-traitement | B | 1–2 j | V1.1 |
| OCR-3 | regex + spaCy fr → critères « contenu » des règles IFTTT | B | 2–3 j | V1.1 (lot Mois 5 du CDC) |

## Placement recommandé (orchestrateur décide)

- **OCR-0** : dès que Q a stabilisé la pile e2e (semaine du 10/11), sans toucher au code produit ; ne consomme pas le budget B/F de DEC-002.
- **OCR-1** : **V1.1** par défaut (budget DEC-002 à 9,75/10 j-p). **Exception** : si le PO retient la démo sur VPS (question (a), réponse attendue le 17/11), OCR-1 passe avant le gel en remplacement de l'ordre 6 (garde de routes, annoncée), car c'est le seul moyen de tenir 3,7 Go avec le worker OCR actif.
- Dans tous les cas : pré-OCRisation du corpus de démo la veille, worker OCR éteint pendant la présentation.

## Risques et réversibilité

- Aucun benchmark public sur du français administratif : OCR-0 est le garde-fou ; si le CER se dégrade, EasyOCR reste disponible une version de plus (retrait en deux temps : désactivé puis supprimé).
- RAM de la voie ONNX non publiée par l'éditeur : mesurée en OCR-0.
- Changement sans migration de schéma hormis la table de cache (nullable, additive) ; revertable par PR.
- RAIDER : R (moteur derrière l'interface existante), A (choix du moteur par configuration, pas de condition codée en dur), I (cache SHA-256 → second passage no-op), D (Tesseract et tests existants inchangés), E (licences permissives, données en local).
