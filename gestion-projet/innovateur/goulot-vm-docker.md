# Goulot VM Docker — mesure et options pour que trois sessions ne fassent plus la queue

- **Pour** : orchestrateur (arbitre les créneaux), Q (pile e2e), B (suite pytest), F (tsc/lint). Instruit par l'innovateur le 2026-11-09 19:40, **lecture seule** (`docker info`, `docker stats --no-stream`, `docker ps`, `docker system df`, `.wslconfig`, compose, conftest, passations). Aucune commande n'a écrit.
- **Reco en une ligne** : la VM n'est pas saturée en CPU (16 cœurs, 1 cœur actif ce soir) mais en **RAM (3,8 Gio pour 29 conteneurs, dont 25 étrangers à GED237)** ; le vrai temps perdu est dans la suite backend elle-même (**drop_all/create_all de 27 tables avant et après chacun des 194 tests**, plus `--cov`) : corriger la fixture (0,25 j B, gain estimé 50 à 70 %) avant tout parallélisme, puis `pytest-xdist` à 2 workers avec une base par worker (0,25 j B), et arrêter les piles étrangères pendant les créneaux GED237 (0 j, accord PO car ce sont d'autres projets).

## 1. Mesures (2026-11-09 19:35, `Vérifié`)

| Mesure | Valeur | Source |
|---|---|---|
| Moteur | Docker Desktop 29.8.0, WSL2 | `docker info` |
| CPU visibles | 16 | `docker info` |
| RAM VM | **4,1 Go** (`memory=4GB`, `swap=2GB`, `autoMemoryReclaim=gradual`) | `docker info`, `~/.wslconfig` (hôte Windows 8 Go) |
| Conteneurs | 48 créés, **29 en cours**, dont GED237 : `gedtest-pg` (512 Mio, 1 cpu), `gedtest-redis` (128 Mio) ; e2e de Q arrêtée (`down -v` fait) | `docker ps`, `docker inspect` |
| Conteneurs étrangers actifs | 25 : `cfao-projets-*` (4, dont cerbos 106 Mio), 7 piles `*-postgres-1` + `*-wsproxy-1` Neon (fm-*, aa-ci, c7test, fleetmaster), `deploy-*` (3), `roadmapmentor-*` (3), `trigenys-studio-pg`, un `node:24-alpine` anonyme (370 Mio / 1 Gio, 13 % CPU : probablement le tsc/lint de F) | `docker stats` |
| RAM consommée au repos | ≈ 1,1 Gio sur 3,8 (somme des `MemUsage`) ; **9 postgres sans `mem_limit`** (plafond implicite 3,8 Gio chacun) | `docker stats` |
| Disque | images 31,3 Go dont **19,2 Go récupérables**, volumes 9,8 Go dont 7,4 Go récupérables, cache de build 6,2 Go dont 4,9 Go | `docker system df` |
| Caps GED237 (`docker-compose.yml`, identiques dans `GED237-e2e`) | postgres 768 Mio/1 cpu, redis 192 Mio/0,5, migrate 512 Mio/1, api 1 Gio/1,5, worker 2 Gio/2, frontend 768 Mio/1, nginx 64 Mio/0,5 → **somme 5,3 Gio > 3,8 Gio de VM** | compose l. 17-178 |
| Suite backend | 28 fichiers, **194 tests**, dernière suite Docker complète **18 min 33** (243 passed avec les 16 de #38, couverture 85 %), 13 à 19 min selon les passations ; CI GitHub `timeout-minutes: 15` | `PASSATION-dev-backend.md:60`, `PASSATION-dev-frontend.md:127`, `backend.yml:42` |
| Smoke e2e | **9,9 min** (31 tests) + **≈ 15 min** quand `--build` reconstruit `edossier-e2e-api` (pip) | `PASSATION-ci-qa.md:50`, `PASSATION-dev-frontend.md:165` |
| File ce soir | pytest B (15-19 min) → smoke Q (10 min) → uat F, sur signal | `PASSATION-dev-frontend.md:127,142` |

### Où part le temps de la suite backend (`Vérifié` dans le code, durée `Déduit`)

- `backend/tests/conftest.py:61-77` : fixture **`autouse`, scope fonction**, `Base.metadata.drop_all` puis `create_all` **avant** chaque test et `drop_all` **après**. 27 modèles → ≈ 194 × 3 passages DDL sur 27 tables, soit ≈ 16 000 ordres DDL sur un postgres plafonné à 1 cpu / 512 Mio. C'est, à lui seul, la cause la plus probable des 13-19 min pour 194 tests (une suite FastAPI async de cette taille tourne d'ordinaire en 2-4 min).
- `--cov=app --cov-report=term-missing` (commande CI, et vraisemblablement locale) : surcoût typique 20-40 % en async.
- `poolclass=NullPool` (`conftest.py:56`) : une connexion ouverte/fermée par requête ; marginal par rapport au DDL.
- Aucun `pytest.mark` autre que `asyncio`/`parametrize` : **pas de marqueur** permettant de lancer une sous-suite ciblée. Pas de `pytest-xdist` dans `requirements.txt`.

## 2. Options chiffrées (reuse-first)

| # | Option | Décision | Coût | Gain attendu | Risque de faux vert |
|---|---|---|---|---|---|
| **A** | **Réparer la fixture** : `create_all` une fois par session, **`TRUNCATE ... RESTART IDENTITY CASCADE`** (ou rollback de transaction imbriquée, pattern SQLAlchemy « join an external transaction ») par test ; garder le `drop_all` final | **Build** (10 lignes, pattern documenté SQLAlchemy 2.0) | 0,25 j B | 13-19 min → **4-8 min** (`Déduit`) | faible : même isolation par test ; attention aux tests qui dépendent de PK déterministes (`conftest.py:18` le signale, `RESTART IDENTITY` le couvre) |
| **B** | **`pytest-xdist -n 2`** avec **une base par worker** : `TEST_DATABASE_URL` suffixé par `PYTEST_XDIST_WORKER` (`gw0`, `gw1`) créé depuis une base **template** (`CREATE DATABASE test_ged_gw0 TEMPLATE test_ged_tpl`) ; variante schémas (`search_path`) si on refuse plusieurs bases | **Adopt** `pytest-xdist` (standard) + Build 20 lignes | 0,25 j B après A | ÷ 1,7 environ à 2 workers ; au-delà, le postgres à 1 cpu / 512 Mio plafonne : monter `gedtest-pg` à **2 cpu / 768 Mio** | moyen : tests qui partagent Redis (`gedtest-redis`, OTP, blacklist) ou le stockage local → clés/dossiers préfixés par worker, sinon flakiness **et** faux rouges ; `pytest-asyncio` + xdist OK en mode `auto` |
| **C** | **Sous-suites par marqueurs** (`auth`, `documents`, `search`, `spaces`, `rules`, `audit`) + script local `backend/scripts/test-scoped.sh` qui lit les fichiers modifiés (`git diff --name-only main...`) et choisit les marqueurs selon `.github/appfactory-impact.json` (déjà la règle **Impact-Aware CI** du standard) | **Adapt** appfactory-impact (config existe pour la CI, pas d'exécution locale) | 0,5 j B (marqueurs sur 28 fichiers + script) | PR ciblée : **1-3 min** au lieu de la suite complète ; la suite complète reste obligatoire **avant fusion** | **élevé si mal cadré** : une PR « search » qui casse `documents` passe au vert local ; garde-fou = la CI GitHub complète reste le gate de fusion, le local ne sert qu'au cycle de dev |
| **D** | **Frontend en parallèle sous caps** : tsc + ESLint dans `node:24-alpine` avec `--memory=1g --cpus=2` (déjà le cas pour le conteneur anonyme observé : 370 Mio) ; autoriser F à lancer **pendant** la suite backend puisque les deux tiennent dans la RAM (1 Gio + 1 Gio api + 0,5 Gio pg + 0,2 Gio redis = 2,7 Gio < 3,8 Gio) | déjà fait de fait, à **écrire dans la règle de file** | 0 j | F ne fait plus la queue derrière pytest ; seul **e2e** (api + pg + redis + front + nginx + Playwright ≈ 3,3 Gio) reste exclusif | nul (aucun état partagé) |
| **E** | **Libérer la VM** : arrêter (`docker stop`, pas `rm`) les 25 conteneurs étrangers pendant les créneaux GED237 (≈ 0,9 Gio rendus, surtout les 9 postgres sans plafond) ; `docker system prune` des 19 Go d'images et 4,9 Go de cache **hors** volumes | **accord PO** (autres projets : cfao, fleet, roadmapmentor) | 0 j | RAM libre 2,7 → 3,6 Gio : permet l'option B à 3 workers ou e2e + tsc ensemble | nul pour GED237 ; risque pour les autres projets si un service attend un postgres (deploy-*, cfao) → ne toucher que les piles `fm-*`, `aa-*`, `c7test`, `fleetmaster*`, `roadmapmentor*` après vérification |
| **F** | **Créneaux fixes** si rien d'autre : B 09:00-10:00 et 14:00-15:00, Q 10:00-11:00 et 15:00-16:00, F en continu (option D), e2e de Q seul sur son créneau | organisation | 0 j | prévisible, pas de signal manuel | nul techniquement ; coût d'attente inchangé (la suite dure toujours 18 min) |
| G | Monter la VM à 6 Go (`.wslconfig memory=6GB`) | écarté | 0 j | — | hôte 8 Go : Windows + VS Code + 4 sessions Claude < 2 Go restants, swap garanti ; **non** |
| H | Ne pas lancer `--cov` en local (coverage seulement en CI) | trivial | 0 j | −20 à −40 % | nul : la CI garde `--cov-fail-under=70` |

## 3. Ordre proposé

1. **Ce soir / mar 10 (0 j)** : règle de file écrite par O : « e2e exclusif ; pytest et tsc/lint peuvent coexister ; `--cov` seulement en CI » (D + H). Gain immédiat : F ne fait plus la queue, suite B −20 %.
2. **Lun 10 (0,25 j B)** : option **A** (fixture session + TRUNCATE), même PR que B2 (rôles en minuscules) ou PR dédiée `test/db-fixture-session`. Preuve : durée avant/après dans la passation, 243 tests toujours verts, **CI GitHub inchangée** (contrat `TEST_DATABASE_URL` conservé). Gain : suite ≈ 5-8 min.
3. **Mar 11 ou S2 (0,25 j B)** : option **B** xdist 2 workers + `gedtest-pg` 2 cpu / 768 Mio. Preuve : trois exécutions consécutives vertes (flakiness). Gain : ≈ 3-5 min.
4. **S2, si la file reste un problème (0,5 j B)** : option **C**, en gardant la CI complète comme gate.
5. **Option E** à proposer au PO le 14/11 : c'est lui qui possède les autres piles.

> **Mise à jour 2026-11-09 soir (O, après cette fiche)** : la VM Docker est passée à **11,7 Gio** (`.wslconfig` : `memory=12GB`, `swap=4GB`). Conséquences : l'**option E est sans objet** (les 25 conteneurs étrangers ne saturent plus la RAM ; `docker system prune` reste une hygiène, pas une urgence) ; la **règle de file du point 1 est remplacée** par « **e2e annoncé chez ci-qa** » : seule une suite e2e doit être annoncée (dans `PASSATION-ci-qa.md`) avant de la lancer, pytest, tsc et lint coexistent librement. Les options A (fixture) et H (`--cov` en CI seulement) restent valables : elles corrigent la **durée** de la suite, pas la RAM. Les mesures du § 1 décrivent l'état **avant** ce changement et ne sont pas réécrites.

Coût total conseillé : **0,5 j B** (A + B), repris sur la marge S2 (DEC-002 samedi 21), pour passer de ≈ 18 min à ≈ 4 min par suite, soit sur les ≈ 6 suites/jour observées ce soir **plus d'une heure de VM rendue par jour**.

## 4. Ce qu'il ne faut pas faire

- Lancer e2e et pytest en même temps : 3,3 + 1,7 Gio > 3,8 Gio, OOM du postgres e2e, **faux rouge** et base à reconstruire (`down -v`).
- Paralléliser (B) **avant** A : xdist multiplie les `drop_all/create_all` concurrents sur un postgres à 1 cpu ; gain quasi nul, flakiness certaine.
- Baisser les caps des conteneurs GED237 pour faire de la place : `api` 1 Gio et `worker` 2 Gio sont déjà la règle [[feedback-container-resource-caps]] ; c'est l'inventaire étranger qui déborde.
- Toute mesure « temps par test » : relever une fois `pytest --durations=20` (B, lecture seule du résultat) pour confirmer le § 1 avant de coder A ; si les 20 plus lents ne sont pas dominés par le setup DB, revoir ce document.

## Sources

`docker info`, `docker stats --no-stream`, `docker ps -a`, `docker system df`, `docker inspect gedtest-pg` (19:35) ; `C:\Users\lawry\.wslconfig` ; `docker-compose.yml` l. 6-178 et `../GED237-e2e/docker-compose.yml` ; `backend/tests/conftest.py` l. 8-16, 54-77 ; `backend/pytest.ini` ; `backend/requirements.txt` l. 48-52 ; `.github/workflows/backend.yml` l. 9-10, 42-54, 98-108 ; `DOCS/engineering/lessons-learned.md:276` (suite ≈ 13 min en CI) ; `PASSATION-dev-backend.md:60`, `PASSATION-ci-qa.md:50`, `PASSATION-dev-frontend.md:127,142,165`. Pattern SQLAlchemy « Joining a Session into an External Transaction » (docs 2.0, consulté de mémoire : B vérifie la page avant d'implémenter).
