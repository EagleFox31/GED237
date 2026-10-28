# AUDIT PROJET - SOURCE DE VERITE UNIQUE

> Date de reference : 2026-10-27
> Statut : document autoritatif sur l'etat reel du projet
> Scope : depot complet (`main` + modifications non commitees) et branche distante `fix/runtime-ocr-hardening` (PR #1)
> Methode : mesures et executions dans la session (aucun chiffre repris de l'audit precedent) — inventaire code, `tsc`, `vite build`, `eslint`, `alembic upgrade head` sur base vierge, `pytest` sur PostgreSQL 15 + Redis 7 + Python 3.12 (Docker, meme pile que la CI), historique GitHub Actions

## Regle documentaire

Ce fichier est la seule source de verite pour l'audit courant du projet.

- Les snapshots d'audit precedents sont archives dans `DOCS/Archives/` (precedent : `AUDIT_2026-07-22_snapshot.md`).
- Les documents de `Phase de Conception/` restent des documents de cadrage et de planification, pas une preuve de livraison.
- Toute nouvelle evaluation du projet doit mettre a jour ce fichier, pas creer un nouvel audit concurrent.

## Synthese executive

Le produit est **largement code** mais **le depot n'est pas dans un etat verifiable** : deux lignes de travail divergent depuis juillet et aucune n'est integree a `main`.

| Ligne de travail | Contenu | Etat |
|---|---|---|
| Branche `fix/runtime-ocr-hardening` (PR #1, ouverte) | 57 commits du 2026-09-01 : migrations defensives, correctifs CI/securite, fixtures de test realignees, OCR durci, `index.css` retire | CI : **129 tests OK, 1 KO** ; scan Trivy KO (502 Docker Hub, non lie au code) |
| `main` + modifications locales non commitees | 38 fichiers modifies (+6 106 / -2 138), plus de nombreux fichiers nouveaux non suivis : 4 migrations, module Rapports, Usage, rangement local, regles multi-filtres | **Jamais commite, jamais passe en CI** |

Les deux lignes partent de la meme revision Alembic `f8e9d7c6b5a4` : les fusionner telles quelles cree **deux tetes Alembic**. Fichier modifie des deux cotes : `backend/app/api/v1/endpoints/classification.py`.

### Avancement estime

| Axe | Estimation | Base |
|---|---|---|
| Code fonctionnel V1 (Import, Classement, Espaces) | **~80 %** | Sprints 1, 2, 4 et 7 faits ; S3 et S6 codes ; S5 partiel (filtres serveur absents) ; S8 non commence en pratique |
| Etat prouve sur `main` | **~25 %** | 30 tests sur 118 passent ; base vierge non migrable ; CI rouge |
| Pret pour un pilote | **~40 %** | Atteignable rapidement en integrant PR #1 et le travail local (voir plan) |

## Mesures observees (2026-10-27)

| Indicateur | Valeur |
|---|---|
| Routes backend (`@router.*` dans `api/v1/endpoints`) | 122 |
| Fonctions de test backend | 119 (dont 64 dans `test_authz.py`) |
| Endpoints sans aucun fichier de test | `users` (12 routes), `org_units` (7), `categories` (5), `reports` (4), `usage` (4), `notifications` (3), `audit` (1) |
| Revisions Alembic (`main` + local) | 26 (+3 sur la branche) |
| Specs Playwright / tests | 25 / 120 (non executes dans cet audit) |
| Tests unitaires frontend | 0 |
| Pages par profil | tenant-admin 16 (~7 000 lignes) ; super-admin 6 ; auditor, collaborator, manager, reader, unit-admin : 1 tableau de bord chacun (67 a 334 lignes) |
| Plus gros composants | `DirectoryIngestion.tsx` 2 427 lignes ; `ClassificationSettingsTab.tsx` > 2 000 ; `SpacesPage.tsx` 916 |

## Verifications executees

| Verification | Resultat |
|---|---|
| `tsc --noEmit` | **OK**, 0 erreur (17 s) |
| `vite build` | **OK** ; warning `/index.css` toujours present sur `main` (corrige sur la branche) ; chunk principal **1 565 kB** (410 kB gzip), en hausse |
| `eslint` | **KO** : 615 problemes dont 200 erreurs (`key-spacing` 88, `react/no-unstable-nested-components` 25, `no-void` 25, `import/first` 18) |
| Venv `backend/venv` | **Inutilisable** : pointe vers `C:\Users\XEPTION NETWORK\...\Python312` ; seul Python 3.14 est installe, incompatible avec les dependances figees (torch 2.2.2, asyncpg 0.29) |
| `alembic upgrade head` sur base vierge | **KO** : `0285c23ae874_add_notification_model` echoue sur `DROP CONSTRAINT users_matricule_key` (inexistante). Corrige sur la branche |
| `pytest` (collecte) | **KO** : `email-validator` absent de `requirements.txt`. Corrige sur la branche |
| `pytest` (avec `email-validator` ajoute a la main) | **30 OK, 1 KO, 87 erreurs** ; cause commune : fixture `tests/conftest.py:201` construit `RoutingRule(document_category_id=...)` desaligne du modele. Corrige sur la branche |
| GitHub Actions | 7 echecs et 2 annulations sur les 9 derniers runs `CI` ; aucun run vert recent |

## Etat de la V1 Import, Classement et Espaces GED

| Sprint | Etat constate | Preuve |
|---|---|---|
| S1 Fondations | fait | modeles + migrations |
| S2 Moteur | fait, enrichi (multi-filtres JSONB, exclusions d'origine — local non commite) | `classification_rule_engine.py` |
| S3 Import batch | code present | tests en erreur sur `main` (fixture) |
| S4 UI import | fait | `DirectoryIngestion.tsx` |
| S5 Espaces | **partiel** | `GET /spaces/documents` n'accepte que `org_unit_id`, `recursive` ; filtres domaine/activite/annee/statut/q appliques cote client |
| S6 Revue manuelle | code present | tests en erreur sur `main` |
| S7 Admin regles | fait | UI + API |
| S8 Stabilisation / recette | **non atteint** | CI rouge, pas de campagne UAT executee (matrice UAT : 4/37 scenarios couverts de facon convaincante) |

Hors V1 (locaux, non commites) : module Rapports (`/reports/*`), Usage (`/usage/*`), bibliotheque et rangement local (`services/localOrganizer`, evenements et snapshots serveur), hierarchie N+1.

## Findings

### P0 - Bloquant

1. **Travail non versionne et divergent** — ~8 000 lignes et 4 migrations n'existent que sur ce poste ; la PR #1 (57 commits) n'est pas fusionnee. Risque de perte et de conflit de schema (deux tetes Alembic).
2. **`main` non installable sur base vierge** — migrations non defensives ; `requirements.txt` incomplet.
3. **Tests `main` non executables** — fixture partagee desalignee : 87 erreurs sur 118.
4. **Environnement local non reproductible** — venv lie a un autre poste, pas de Python 3.12.

### P1 - Important

5. Contrat `GET /spaces/documents` en deca du plan V1 (filtrage serveur absent).
6. Lint frontend en echec (200 erreurs).
7. Zones sans tests API : users, org_units, categories, reports, usage, notifications.
8. Aucune preuve e2e executee ; recette UAT non realisee.
9. Pas de controle « schema a `head` » au demarrage ni en CI locale (cf. `DOCS/engineering/lessons-learned.md` LESSON-2026-001).

### P2 - Dette

10. Bundle 1,56 MB sans code-splitting.
11. Composants geants (`DirectoryIngestion.tsx` 2 427 lignes) ; `PLAN_REFACTOR_FRONTEND_SRP.md` base sur des tailles perimees (1 010 lignes).
12. CI non proportionnelle (`ci.yml` lance tout a chaque push) — cf. `RAIDER.md`.
13. Routes frontend non gardees par profil (seul le menu filtre ; la securite repose sur l'authz backend).

## Plan d'action

### Lot A — Consolider le depot (P0, prealable a tout le reste)

1. Commiter le travail local sur une branche `feat/v1-local-consolidation` en commits thematiques (rapports, usage, rangement local, regles multi-filtres, UI) et la pousser.
2. Corriger le test restant de la PR #1 (`test_classification_rule_engine_patterns`), relancer Trivy, fusionner la PR #1 dans `main`.
3. Rebaser la branche de consolidation sur `main` : rechainer `a3b9c5d2e7f1.down_revision` sur `c9a2d4e6f8b0` (une seule tete), resoudre `classification.py`, realigner les fixtures.
4. Preuve : `alembic upgrade head` sur base vierge, second `upgrade` = no-op, `alembic check` OK ; `pytest` complet vert ; CI verte.
5. Environnement : documenter Python 3.12 (ou le lancement des tests via Docker) et recreer le venv.

### Lot B — Fiabiliser (P1)

6. Tests API : reports, users, org_units, usage (nominal + bornes authz).
7. Controle « schema a `head` » au demarrage de l'API et en CI.
8. Lint : corriger les 200 erreurs (majorite auto-fixable) puis rendre le lint bloquant.

### Lot C — Fermer la V1 (P1)

9. `GET /spaces/documents` : filtres serveur `domain_id`, `activity_id`, `year`, statut, `q`, pagination ; brancher `SpacesPage`.
10. Recette : executer Playwright sur la pile Docker, aligner les 37 scenarios UAT, corriger les ecarts.

### Lot D — Dette (P2)

11. Code-splitting par route ; mise a jour puis execution du plan SRP.
12. Impact-Aware CI (`appfactory-project-automation`).
13. Garde de route par profil cote frontend.
