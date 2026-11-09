# [Claude] PR sécurité dépendances Python — 2026-11-09

> Statut : EN REVUE
> Session : ged-dev-backend
> Début : 2026-11-09 (heure locale)
> Référence : DEC-2026-001 point 4 ; `AUDIT.md` ; mission orchestrateur-ged
> Branche : `fix/deps-security` (worktree `../GED237-secu`)

## Ce qui va être fait

Montée ciblée de quatre dépendances Python dans `backend/requirements.txt`, et rien d'autre :

| Paquet | Avant | Après | Motif |
|---|---|---|---|
| `fastapi` | 0.110.0 | 0.117.1 | première mineure admettant starlette ≥ 0.47.2 sans exiger pydantic ≥ 2.7 (pydantic 2.6.1 conservé) |
| `starlette` (épinglé explicitement) | 0.36.3 (transitif) | 0.48.0 | PYSEC-2026-1941 corrigé en 0.47.2 ; 0.48.0 = plus haute version admise par fastapi 0.117 |
| `python-multipart` | 0.0.9 | 0.0.33 | avis de sécurité multipart |
| `python-dotenv` | 1.0.1 | 1.2.2 | avis de sécurité |
| `PyPDF2` → `pypdf` | 3.0.1 | 7.0.0 | PyPDF2 abandonné, avis non corrigés ; API `PdfReader` identique |

Adaptation de code limitée aux imports : `backend/app/services/ocr/strategy.py` (`from pypdf import PdfReader`)
et libellé moteur dans `backend/app/workers/tasks.py`.

## Pourquoi

Le rapport `pip-audit` de la CI (`security.yml`, `continue-on-error`) liste une dette d'avis de sécurité.
Le PO a validé une PR courte (≤ 1 jour) sur les paquets au périmètre ci-dessus ; les autres paquets
signalés (`python-jose`/`ecdsa`, `pyasn1`, `pytest`, `torch`) restent hors périmètre et sont listés
en « Reste » pour décision ultérieure.

## Comment

1. Baseline : `pip-audit -r requirements.txt` dans `python:3.12-slim` (conteneur borné 1 Go / 1 CPU) **avant** ;
   `spacy>=3.7.0` (non épinglé) exclu de l'entrée d'audit pour les deux passes.
2. Montée des versions, adaptation des imports.
3. `pip-audit` **après**, même procédure.
4. Suite complète `bash backend/scripts/test-in-docker.sh` (gate couverture 70 %), coordonnée avec la session b7.
5. PR vers `main`, modèle du dépôt, pas de fusion.

## Preuves

### pip-audit avant (2026-11-09)

- 73 avis sur 9 paquets : `ecdsa`, `pyasn1`, `pypdf2`, `pytest`, `python-dotenv`, `python-jose`,
  `python-multipart`, `starlette`, `torch`.

### pip-audit après (2026-11-09, même procédure)

- 54 avis sur 6 paquets (−19) : `python-multipart`, `python-dotenv`, `pypdf2` → 0 avis.
- `starlette` 0.48.0 : 14 → 12 avis ; les 12 restants ne sont corrigés qu'en 1.x (1.3.1), inaccessible
  sans fastapi ≥ 0.133 et pydantic ≥ 2.9 → hors périmètre, à instruire séparément.
- Inchangés (hors périmètre) : `torch` 25, `pyasn1` 12, `pytest` 2, `ecdsa` 2, `python-jose` 1.
- Rapports JSON conservés dans le scratchpad de session (`before.json`, `after.json`).

### Suite de tests Docker (2026-11-09)

- `bash backend/scripts/test-in-docker.sh` : **227 passed**, 9 warnings, 13 min 04 ; couverture 85,10 % (gate 70 %).
- Aucune régression liée aux montées (`pypdf` exercé via la stratégie OCR).

## Reste / hors périmètre

- `python-jose` 3.4.0 (+ `ecdsa`, `pyasn1` transitifs), `pytest` 8.0.2, `torch` 2.6.0 : avis ouverts, hors périmètre PO.
- `starlette` : des avis plus récents sont corrigés seulement en 1.x (PYSEC-2026-161/248/249/2280/2281) ;
  nécessite fastapi ≥ 0.129 **et** pydantic ≥ 2.7 → PR dédiée à instruire (innovateur).

## Checklist RAIDER

- **Reusable** : pas de logique ajoutée ; s.o.
- **Agnostic** : audit exécuté dans un conteneur, pas de dépendance à l'hôte.
- **Idempotent** : montée de versions épinglées ; relancer l'install converge.
- **Durable / Non-regressive** : suite complète existante exigée verte ; contrat API inchangé.
- **Failure memory** : s.o. sauf incident pendant la suite (sera consigné).
- **Engineering-grade** : périmètre minimal, preuves avant/après jointes.
- **Reuse-first** : `pypdf` = successeur officiel de PyPDF2 (Adopt).
- **Retroactive** : aucune migration, aucune donnée touchée.
