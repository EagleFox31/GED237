# GED237 — contexte application (au 2026-11-09)

Niveau : `Vérifié` (dépôt, `AUDIT.md`, PASSATION, PRs) sauf mention.

## Produit

E-Dossier Cameroun : gestion électronique de documents multi-tenant pour administrations et
institutions. Import de répertoires, classement automatique par règles (moteur IFTTT, filtres JSONB),
espaces par unité organisationnelle, revue manuelle, OCR → recherche plein texte, administration des
règles, RBAC Casbin, authentification JWT + OTP.

## Stack

FastAPI + SQLAlchemy 2.0 async + asyncpg + PostgreSQL ; React + Vite + TypeScript + Tailwind + Zustand ;
Redis (OTP, blacklist) ; stockage local ou S3/MinIO ; Tesseract/EasyOCR. Node 24 (PR #26, en attente
de fusion). Tout s'exécute dans Docker, plafonné en ressources.

## État V1 (AUDIT.md §Etat)

| Sprint | État |
|---|---|
| S1 fondations, S2 moteur, S4 UI import, S7 admin règles | fait |
| S3 import batch, S6 revue manuelle | code présent, tests à consolider |
| S5 espaces | partiel : `GET /spaces/documents` filtre seulement `org_unit_id`/`recursive` ; le reste côté client |
| S8 stabilisation / recette | non atteint : UAT 4/37 scénarios couverts |

Hors V1 mais présent localement : rapports, usage, bibliothèque et rangement local, hiérarchie N+1.

## Gouvernance acquise (Lots A–B clos)

Protection de `main` versionnée, CI impact-aware (gates frontend/backend/security), gitleaks, Trivy,
Bandit, plafond ESLint 488 (cliquet), couverture backend ≥ 70 %, Dependabot, release-integrity.
18 leçons dans `DOCS/engineering/lessons-learned.md`.

## Ce qui reste pour le 30/11

1. **Lot C** : filtres serveur `GET /spaces/documents` (domaine, activité, année, statut, q) ; campagne
   Playwright sur les 37 scénarios UAT.
2. **Lot D** (ciblé) : code-splitting (bundle ≈ 1,56 Mo), route guards, baisse du plafond ESLint.
3. Décisions PO B6 ; tri Dependabot (#27 à fermer, majors #29 TS 7, #30 ESLint 10, #32 redis 8 à
   instruire).
4. Jeu de données de démo, script de présentation, release taguée.

## Risques (Déduit)

- Recette à 4/37 : le vrai inconnu est le nombre de défauts qu'elle révélera. Mitigation : démarrer
  la campagne dès la S2, geler le 24/11.
- Majors Dependabot en pleine période de recette : reporter après le 30/11 sauf CVE.
- Ressources Docker limitées : tests backend ≈ 13 min ; ne pas paralléliser deux suites.
