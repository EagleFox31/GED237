# PERT P0 - Remediation GED237

> Date : 2026-04-13
> Scope : priorisation des correctifs P0 avant execution

## Objectif

Corriger les blocages P0 dans l'ordre qui minimise les reworks entre backend et frontend.

## Taches

| ID | Tache | Duree estimee | Depend de | Sortie attendue |
|---|---|---:|---|---|
| T1 | Stabiliser la boucle locale minimale d'execution | 0.5 j | - | environnement de verification exploitable |
| T2 | Aligner le contrat d'authentification backend | 0.75 j | T1 | login, refresh et identite coherents |
| T3 | Verrouiller permissions documents | 0.75 j | T2 | CRUD documents conforme aux roles |
| T4 | Verrouiller machine d'etat workflow/documents | 1 j | T2, T3 | transitions et validations maitrisées |
| T5 | Aligner le store/auth UI sur les roles backend | 0.75 j | T2 | login reel ouvre les bons espaces |
| T6 | Corriger refresh token et session frontend | 0.25 j | T2, T5 | session stable sur 401 |
| T7 | Corriger credentials demo et incoherences UX bloquantes auth | 0.25 j | T5 | demo coherent avec la seed |
| T8 | Verification de bout en bout et mise a jour de suivi | 0.5 j | T4, T6, T7 | checks + rapport d'avancement |

## Graphe de dependances

- T1 -> T2
- T2 -> T3
- T2 -> T4
- T3 -> T4
- T2 -> T5
- T2 -> T6
- T5 -> T6
- T5 -> T7
- T4 -> T8
- T6 -> T8
- T7 -> T8

## Chemin critique

Chemin critique retenu :

`T1 -> T2 -> T3 -> T4 -> T8`

Pourquoi :

- tant que le contrat auth n'est pas stable, le frontend et les permissions reposent sur une base mouvante ;
- les permissions documents et la machine d'etat workflow portent le risque metier principal ;
- les corrections frontend doivent se brancher sur ce contrat final, pas l'inverse.

## Ordre d'execution retenu

1. T1 `stabilisation locale minimale`
2. T2 `contrat auth backend`
3. T3 `permissions documents`
4. T4 `machine d'etat workflow/documents`
5. T5 `mapping auth UI`
6. T6 `refresh/session frontend`
7. T7 `demo auth`
8. T8 `verification finale`

## Strategie sous-agents

- Sous-agent backend : T3 puis T4, ownership backend `documents/workflows/schemas`.
- Sous-agent frontend : T5 puis T6/T7, ownership frontend `LoginPage/authStore/App/api`.
- T2 reste pilote localement car c'est la base contractuelle de tous les autres lots.

## Regles de mise en oeuvre

- On ne touche pas au frontend auth tant que T2 n'est pas fige.
- On ne touche pas a la machine d'etat workflow avant d'avoir verrouille les permissions de base sur documents.
- Toute correction doit laisser une trace dans le rapport d'avancement apres T8.

## Statut d'execution

### 2026-04-13

- [x] T2 `contrat auth backend`
- [x] T3 `permissions documents`
- [x] T4 `machine d'etat workflow/documents`
- [x] T5 `mapping auth UI`
- [x] T6 `refresh/session frontend`
- [x] T7 `demo auth`
- [~] T1 `stabilisation locale minimale`
- [~] T8 `verification finale`

Notes:

- T1 est partiellement couvert: le build frontend passe maintenant, mais la boucle de tests backend reste limitee par l'environnement WSL + venv Windows + DSN PostgreSQL fixe.
- T8 est partiellement couvert: verification statique backend OK (`py_compile` avec `PYTHONPYCACHEPREFIX=/tmp`), build frontend OK. Les tests backend de bout en bout restent non executes dans cet environnement.

## Validation Backend Locale

### 2026-04-13

Environnement de test backend rendu executable localement sous Linux/WSL.

Actions:

- `backend/tests/conftest.py` lit maintenant `TEST_DATABASE_URL` depuis l'environnement.
- `backend/tests/conftest.py` utilise `NullPool` et un `test_engine` scope fonction pour eviter les erreurs de boucle async et de connexions partagees.
- `backend/pytest.ini` a ete simplifie pour rester compatible avec le runner pytest/pytest-asyncio utilise.
- `backend/app/workers/tasks.py` charge `OCRStrategy` de maniere lazy pour ne pas imposer la stack OCR lourde au simple import de l'API pendant les tests.
- Runner Python Linux cree hors repo dans `/tmp/ged237-backend-venv`.
- Base locale PostgreSQL utilisee: `postgresql+asyncpg://postgres:Postgresql@localhost:5432/test_ged`.

Commande de reference:

```bash
cd /mnt/e/GED237/backend
PYTHONPATH=/mnt/e/GED237/backend \
TEST_DATABASE_URL='postgresql+asyncpg://postgres:Postgresql@localhost:5432/test_ged' \
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 \
/tmp/ged237-backend-venv/bin/pytest -s -q -p pytest_asyncio.plugin -o cache_dir=/tmp/pytest-ged237
```

Resultat:

- `10 passed in 110.82s`
