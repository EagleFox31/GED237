# Fiche de décision — Adopt `fakeredis` comme substitut Redis unique des tests

- **Date :** 2026-11-10
- **Demandeur :** orchestrateur (prévention (1) de LESSON-2026-031)
- **Décideur :** orchestrateur
- **Statut :** à trancher
- **Périmètre :** `backend/tests/` uniquement ; aucun changement de code applicatif

## 1. Question

Remplacer les faux Redis écrits à la main dans les tests (`FakeRedis`, `MemoryRedis`, `_FakeRedis`) par une seule bibliothèque de référence, `fakeredis`, pour que toute méthode Redis appelée par un service soit disponible dans tous les tests sans réécriture (cause racine de la CI rouge de #83). Faut-il le faire **maintenant** (avant la coupure du 19) ou en **V1.1** ?

## 2. Faits vérifiés (PyPI, 2026-11-10)

| Élément | Valeur |
|---|---|
| Paquet / version à épingler | `fakeredis[lua]==2.40.0` (publiée le 2026-10-14) |
| Licence | BSD-3-Clause (compatible avec le dépôt, sans obligation) |
| Python requis | ≥ 3.8 ; image backend `python:3.11-slim` : OK |
| Dépendances | `redis>=4.3` (projet : `redis==8.1.0`, OK), `sortedcontainers>=2` |
| Extra `lua` | `lupa>=2.1` → `lupa==2.8`, licence MIT, roues binaires manylinux cp311 x86_64 : **aucune compilation** dans l'image |
| Client asynchrone | `fakeredis.FakeAsyncRedis`, même interface que `redis.asyncio.Redis` (celle que `get_redis()` renvoie) |

Couverture des méthodes utilisées ou à venir dans `backend/app` :

| Méthode | Appelant | `fakeredis` | Faux maison actuels |
|---|---|---|---|
| `get` / `setex` / `delete` | OTP, blacklist JWT (`auth_service`) | oui | `FakeRedis` (patterns) |
| `ttl` | verrou OTP #83 (`_raise_if_locked`) | oui | **absent** → CI rouge #83 (B ajoute `ttl`) |
| `set(nx=True, ex=…)` | verrou `ingest_watch:lock` #101 | oui | `MemoryRedis` (#101) |
| `eval` (Lua compare-and-delete) | libération du verrou #101 | **oui, réellement exécuté** avec l'extra `lua` | `MemoryRedis.eval` = stub Python, script Lua jamais exécuté |
| `exists` / `scan_iter` | tests #83 (nettoyage) | oui | vrai Redis dans #83 |
| `pipeline` | aucun appel sur `main` aujourd'hui | oui (transactions `MULTI/EXEC`) | — |
| `hincrby` / `hgetall` | métriques authz | oui (client synchrone `fakeredis.FakeRedis`) | `_FakeRedis` (authz, l. 1269) |

Limites connues : pas de persistance ni de réplication (sans objet ici) ; `decode_responses` à passer comme sur le vrai client ; les scripts Lua sont exécutés par `lupa`, pas par le moteur Redis (sémantique identique pour `redis.call`, `KEYS`, `ARGV`).

## 3. Inventaire des substituts à migrer (liste des fichiers)

| Fichier | Substitut | Injection | Action |
|---|---|---|---|
| `backend/tests/services/test_backend_engineering_patterns.py` (l. 99) | `class FakeRedis` : `get`, `setex`, `delete` (+ `ttl` par B dans #83) | `monkeypatch` de `get_redis` | supprimer la classe, utiliser la fixture commune |
| `backend/tests/api/test_ingest_watch.py` (#101, pas encore sur `main`) | `class MemoryRedis` : `set nx ex`, `get`, `eval` stub | `monkeypatch` de `get_redis` | supprimer, fixture commune ; le test de libération exerce alors le vrai script Lua |
| `backend/tests/api/test_authz.py` (l. 1269) | `class _FakeRedis` : `hincrby`, `hgetall`, `delete` (synchrone) | `authz_metrics._redis_client` | remplacer par `fakeredis.FakeRedis()` ; facultatif (fonctionne tel quel) |
| `backend/tests/conftest.py` | aucun faux ; remise à zéro du singleton `redis_client` + `TEST_REDIS_URL` | — | **ajouter** la fixture unique `fake_redis` (`FakeAsyncRedis` + `monkeypatch` de `get_redis`) |

Hors périmètre (vrai Redis **volontairement**, à conserver) : `tests/test_celery_enqueue_bounded.py` (LESSON-026, port fermé), les 5 tests de #83 (`scan_iter`, `exists`, verrou de bout en bout) et tout test d'intégration qui s'appuie sur le service `redis:7-alpine` de la CI. Règle : `fakeredis` pour les tests unitaires de service, vrai Redis pour l'intégration.

Contrôle vérifiable après migration : `grep -rn "^class \w*Redis" backend/tests` ne renvoie **aucune** ligne (contre 2 sur `main` + 1 avec #101).

## 4. Coût de migration (heures de session)

| Étape | h-s |
|---|---|
| `requirements.txt` + fixture `fake_redis` dans `conftest.py` | 0,25 |
| `test_backend_engineering_patterns.py` : suppression de `FakeRedis`, adaptation des 14 usages | 0,25 |
| `test_ingest_watch.py` (#101) : suppression de `MemoryRedis`, test de libération Lua réel | 0,25 |
| `test_authz.py` : `_FakeRedis` → `fakeredis.FakeRedis` | 0,10 |
| Preuve : suite complète en Docker (258 tests) + reconstruction de l'image (nouvelle dépendance) | 0,25 |
| Relecture + passage en file | 0,25 |
| **Total** | **≈ 1,25–1,5 h-s** (B ≈ 1,1 ; relecture 0,25) |

Au-dessus du seuil « ≤ 1 h-s » fixé par l'orchestrateur, de peu.

## 5. Risques avant le 19

| Risque | Gravité | Détail |
|---|---|---|
| Conflits avec les PR en vol | **moyen** | Les deux fichiers à migrer sont ceux de #83 (`FakeRedis`, en cours de correction) et de #101 (`MemoryRedis`, en file) : une PR `fakeredis` ouverte avant leur fusion force un rebase des deux, ou l'inverse. |
| `requirements.txt` unique prod + tests | faible | La dépendance de test entre dans l'image de production (comme `pytest` déjà) ; déclenche la porte `dependencies` de la CI d'impact et une reconstruction de l'image. Séparer `requirements-dev.txt` est un chantier à part (V1.1). |
| Roue `lupa` | faible | Roues manylinux cp311 x86_64 disponibles ; CI `ubuntu` x86_64. Sans roue, compilation C dans `python:3.11-slim` (pas de `gcc`) : échec de build. À vérifier une fois dans le Docker local avant d'ouvrir la PR. |
| Divergence sémantique `fakeredis` / Redis 7 | faible | Cas limites (`ttl` → -2 / -1, encodage) identiques ; le test réel du verrou #101 reste au plan de recette du 20 (vrai Redis). |
| Capacité | moyen | La file de fusion est sérialisée et déjà chargée jusqu'au 19 ; 1,5 h-s de B et un créneau de file sont pris sur les lots V1.1 restants. |

Bénéfice avant le 19 : faible. La suite redevient verte avec l'ajout de `ttl` (0 h-s supplémentaire, déjà en cours) ; aucun service prévu d'ici la coupure n'appelle une méthode Redis nouvelle. Le seul gain fonctionnel immédiat serait le test réel du script Lua de #101, couvert par la recette du 20.

## 6. Options (reuse-first)

| Option | Coût | Avantages | Inconvénients |
|---|---|---|---|
| **A — Adopt `fakeredis[lua]`** (recommandée) | 1,25–1,5 h-s | une seule implémentation de référence, maintenue, `ttl`/`pipeline`/Lua couverts d'avance | dépendance nouvelle, rebuild image |
| B — Adapt : une classe `FakeRedis` unique dans `conftest.py` | ≈ 0,5 h-s | zéro dépendance | même fragilité qu'aujourd'hui (méthodes ajoutées à la main), Lua toujours simulé |
| C — Vrai Redis partout (service CI déjà présent, `flushdb` par test) | ≈ 1 h-s | sémantique exacte | tests unitaires dépendants d'un service ; isolation entre tests à gérer ; plus lent |

## 7. Recommandation

**V1.1**, première PR technique après le tag `v1.0.0-rc.1`, pour trois raisons : le coût dépasse le seuil (≈ 1,25–1,5 h-s contre ≤ 1), les fichiers à toucher sont ceux de deux PR encore en vol (#83, #101), et le bénéfice d'ici le 19 est nul une fois `ttl` ajouté.

D'ici là, rien d'autre à faire que ce qui est déjà engagé : correctif `ttl` dans #83 (B) et règle de LESSON-031 (pas de nouveau faux Redis dans un fichier de tests ; `MemoryRedis` de #101 est toléré jusqu'à la migration).

Variante si l'orchestrateur veut la prévention avant la coupure : ouvrir la PR `tests/fakeredis` **après la fusion de #83 et #101**, uniquement si la file est vide le 17 ou le 18, avec preuve de build Docker (`lupa`) jointe. Sinon, V1.1 sans regret.

## 8. Contrat de la PR V1.1 (pour B, le moment venu)

- `fakeredis[lua]==2.40.0` épinglé dans `requirements.txt` (ou `requirements-dev.txt` s'il existe alors).
- Fixture unique `fake_redis` dans `tests/conftest.py` ; suppression des trois classes maison ; contrôle `grep -rn "^class \w*Redis" backend/tests` = 0 ligne.
- Test de libération du verrou #101 exécutant le script Lua réel (jeton bon → clé supprimée ; jeton étranger → clé conservée).
- Preuve : suite complète en Docker, CI verte sur la tête relue (LESSON-031, règle (2)).
- RAIDER : R (un substitut réutilisable), I (tests sans état partagé), D (suite complète verte, aucun test supprimé), E (reuse-first tranché ici : Adopt), failure memory (LESSON-031 passe en `prevention-verified`).
