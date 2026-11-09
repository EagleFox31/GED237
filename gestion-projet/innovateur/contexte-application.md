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

## Ce qui reste pour le 30/11 (révisé après l'audit fonctionnel du 2026-11-09)

Source : `../walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md` (32 fonctionnalités CDC,
17–19 j-p d'écarts, top 10). Arbitrage : `../decisions/DEC-2026-002`.

1. **Sécurité (non négociable)** : recherche bornée au seul tenant et corbeille incluse
   (`core/search/postgres_engine.py:82-97`, `search.py` sans portée service) ; `MAX_UPLOAD_SIZE`
   (`config.py:46`) jamais appliqué par l'API. Vérifié le 2026-11-09.
2. **Recette** : 0 e2e exécuté en CI ; 25 specs, IDs UAT désalignés, 12 `skip`, 4 avec mocks ;
   ~13 scénarios couverts au niveau API seulement, ~17 sans preuve. Cible : 8 parcours de démo verts.
3. **Lot C9** : filtres + pagination serveur des Espaces (en cours, dev-backend).
4. **Sauvegarde / restauration** : absentes (seules les politiques authz ont un script) ; `purge`
   définitive disponible → une erreur en démo est irréversible.
5. **Démo VPS + HTTPS** : non prouvés ; dossier `deployment/` cité par le RACI absent ; accord PO requis.
6. Décisions PO B6 ; garde de routes frontend ; jeu de données de démo ; release taguée.

Faits acquis (audit, niveau Constaté) : moteur de règles avec priorité + simulation, arborescence
service > domaine > activité > année, upload, versionnage, verrouillage, corbeille, journal, OCR,
workflows, rapports. Partiels : règles sans critère contenu/date ni export, KPI doublons absent,
ingestion de dossier ponctuelle (pas de watcher), tags sans écran de gestion. Non mesurés : ≥ 95 %
classés, recherche < 2 s, 100 k fichiers < 20 min, responsive, disponibilité 99 %.

Dependabot : tranché dans `../decisions/DEC-2026-001` (#26/#28/#32/#33 fusion, #27/#31 fermées,
#29/#30 reportées, PR sécurité ciblée python-multipart/starlette).

## Risques (Déduit, sauf mention)

- Recette : le vrai inconnu est le nombre de défauts révélés entre le 18 et le 20/11 ; marge de 1 j-p
  et ordre de sacrifice définis dans DEC-2026-002.
- VPS 3,7 Go partagé : worker OCR torch/EasyOCR → risque mémoire ; désactiver l'OCR lourd en démo.
- Données : aucune sauvegarde tant que l'ordre 5 de DEC-2026-002 n'est pas livré.
- Ressources Docker limitées : tests backend ≈ 13 min ; ne pas paralléliser deux suites.
- Frontend : bundle 1,56 Mo, 488 avertissements lint plafonnés, 0 test unitaire (Documenté).
