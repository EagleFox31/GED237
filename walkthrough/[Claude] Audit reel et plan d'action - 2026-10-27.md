# [Claude] Audit réel et plan d'action — 2026-10-27

> Statut : DONE

## Ce qui va être fait

Refaire l'audit du projet par mesures et exécutions (pas par reprise de l'audit du
2026-07-22), estimer l'avancement, produire un plan d'action.

## Pourquoi

Le PO demande un pourcentage de réalisation fondé sur l'état réel ; l'audit de juillet
précède ~6 000 lignes non commitées.

## Comment

Inventaire code (routes, tests, migrations, specs e2e), vérification ciblée des écarts
connus, exécution : `tsc`, `vite build`, `compileall`, `alembic heads`, `pytest` sur
Postgres + Redis (Docker), Playwright si l'environnement le permet.

## Fichiers / zones concernés (verrou)

- `AUDIT.md` (mise à jour, règle documentaire)
- `DOCS/Archives/AUDIT_2026-07-22_snapshot.md` (archive de l'audit précédent)
- ce fichier
- lecture seule : `backend/`, `frontend/`

## Vérifications prévues

Chaque chiffre de l'audit provient d'une commande exécutée dans cette session.

## RÉSULTAT (DONE)

- `AUDIT.md` réécrit à partir de mesures de la session ; ancien audit archivé dans `DOCS/Archives/AUDIT_2026-07-22_snapshot.md`.
- Exécuté : `tsc` OK ; `vite build` OK (1 565 kB) ; `eslint` KO (200 erreurs) ; `alembic upgrade head` base vierge KO (`0285c23ae874`) ; `pytest` sur Postgres/Redis Docker : collecte KO (`email-validator`), puis 30 OK / 1 KO / 87 erreurs (fixture `conftest.py:201`).
- Découvert : PR #1 `fix/runtime-ocr-hardening` (57 commits non fusionnés) corrige ces trois blocages ; fork Alembic avec le travail local.
- Non exécuté : Playwright (pile complète non montée).
- Conteneurs d'audit supprimés ; volume de cache pip `gedaudit-pip` conservé.
- Aucun fichier de code modifié.
