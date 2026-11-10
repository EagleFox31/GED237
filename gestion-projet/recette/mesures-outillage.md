# Outillage des mesures (protocole-mesures-criteres.md)

Scripts Python (bibliothèque standard seule) dans `scripts/`, lancés dans un conteneur jetable sur le réseau de la pile. Le mot de passe du compte de mesure vient de `MEASURE_PASSWORD` (jamais écrit, jamais affiché) ; l'API doit tourner en `ENVIRONMENT=development` (OTP renvoyé).

```sh
R="docker run --rm --memory=128m --memory-swap=128m --cpus=0.5 --network <projet>_default \
   -e PYTHONDONTWRITEBYTECODE=1 -e MEASURE_API=http://api:8000/api/v1 -e MEASURE_PASSWORD=… \
   -v $(pwd -W)/scripts:/s:ro -v <dossier-manifestes>:/m:ro -v <sortie>:/out python:3.12-slim python"
$R /s/measure_c2.py       --manifest /m/demo-manifest.json --threshold 95 --out-dir /out   # C2 / C2b + écarts
$R /s/measure_c3.py       --queries /m/c3-queries.txt --threshold-ms 2000 --alert-max-ms 4000 --out-dir /out
$R /s/measure_counters.py --manifest /m/demo-manifest.json --out-dir /out                  # jeu-donnees-demo § 5 étape 4
```

Sans `--threshold` / `--threshold-ms`, seules les valeurs sont imprimées. Chaque script écrit `<nom>-AAAA-MM-JJ.txt` dans `--out-dir` (à déposer dans `gestion-projet/recette/`).

## Contrat `expected.files` (demo-manifest.json, convenu avec dev-backend)
Une entrée par fichier importé, doublons refusés compris :
`{ "path", "status": "classified"|"needs_review"|"duplicate", "orgUnit", "domain", "activity", "year" }`
- `path` = `documents.source_relative_path` ; destination (`orgUnit`, `domain`, `activity`, `year`) = champs `classification_*` ; `null` = non contrôlé (toujours `null` hors `classified`).
- `measure_c2.py` : dénominateur = fichiers `classified` ; `needs_review` et `duplicate` exclus ; C2b = bonne destination / (total − doublons).
- Les agrégats `documents`, `byOrgUnit` (par `documents.org_unit_id`) sont lus par `measure_counters.py` ; `documents.total` = documents vivants + corbeille.
- `imports`, `locks`, `live` : sans endpoint de lecture, signalés `NON COUVERT` (pas ignorés en silence).
- `measure_c2.py --match title` joint par titre (manifeste sans chemins, ex. seed-manifest).

## Limites connues
- Pas de projet Playwright `smoke` pour les compteurs : le manifeste de démo n'existe pas encore ; `measure_counters.py` est la comparaison, à brancher en spec quand D1 livre le manifeste.
- Les requêtes C3 doivent être figées dans `c3-queries.txt` (une par ligne, filtres après une tabulation : `status=…&org_unit=<CODE>`).
