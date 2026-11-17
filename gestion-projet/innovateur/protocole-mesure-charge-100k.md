# Protocole : mesure de charge 100 000 fichiers (item 8 du CDC)

- **Pour** : Q (exécute), B (lit les résultats, corrige si NO-GO), O (planifie après le tag du 24/11). Innovateur, 2026-11-17, sur `main` 4972a32. Validé par le PO (relayé par O le 17/11) comme rang 4 du carnet `carnet-suite-fonctionnalites.md`.
- **Exigence** : « traitement de 100k fichiers en < 20 minutes » (Expression de besoin § 5, item 8 du CDC, `absent` à ce jour). Recherche < 2 s (item 14).
- **Cadre** : ce PC, Docker seulement, pile e2e isolée (`docker-compose.e2e.yml`), plafonds de mémoire et de CPU sur chaque conteneur, aucune nouvelle dépendance (gel jusqu'au 30/11). `Vérifié` = lu dans `main` ; `Proposé` = à valider par O ou le PO avant l'exécution.

## 0. Définition retenue (**décision PO du 17/11**, relayée par O)

« Traitement » = **import + classement** (mode `process` de `POST /documents/ingest-directory`), **sans OCR**. L'OCR est mesuré à part sur 1 000 pages (M5) et son débit est **dit** au jury, pas caché. Raison : à 3,2 s par page (mesure du 10/11), l'OCR de 100 000 pages demanderait ≈ 89 h sur un worker ; aucun poste unique ne tient 20 min.

## 1. Préparation (contrôles bloquants)

| Contrôle | Seuil | Commande ou source |
|---|---|---|
| Pile de démo arrêtée (poste unique) | aucun conteneur `edossier_*` actif | `docker ps --format '{{.Names}}'` |
| Mémoire libre | ≥ 6 Go (pile e2e plafonnée à ≈ 3,6 Go + générateur 0,5 Go + marge) | `docker-compose.e2e.yml` : postgres 512m, redis 128m, api 1g, e2e 2g (`Vérifié`) |
| Disque libre | ≥ 25 Go (corpus ≈ 7 Go, copie stockée ≈ 7 Go, base et index, journaux) | `docker system df`, disque hôte |
| Journaux plafonnés | `json-file` avec `max-size` sur chaque service | en-tête de `docker-compose.e2e.yml` (`Vérifié`, l. 10-11) |
| Version mesurée | SHA de `main` noté dans la sortie | `git rev-parse HEAD` |

## 2. Générateur reproductible

- **Approche (Adapt)** : nouveau script `scripts/load_dataset.py`, sur le modèle de `backend/scripts/demo_dataset.py` (`Vérifié` : sortie fonction pure de `GED_EXPORT_SEED`, fichiers écrits avec Pillow, `zipfile` et un écrivain PDF minimal, déjà dans l'image backend). Mêmes règles de nommage, pour que les règles de classement s'appliquent. Lancé dans un conteneur jetable plafonné (512 Mo, 1 CPU).
- **Graine** : `GED_LOAD_SEED=237`. **Preuve de reproductibilité** : deux générations donnent la même empreinte SHA-256 de la liste triée « chemin + empreinte de fichier », écrite dans `load-manifest.json`.
- **Volume** : 100 000 fichiers en **10 lots de 10 000** (`lot-01` … `lot-10`), sous la racine autorisée `INGEST_ALLOWED_ROOTS` de la pile e2e (`/data/ingest`, `Vérifié`). Un lot = une requête d'import, ce qui borne la durée de chaque requête.
- **Répartition des types** : PDF 50 %, DOCX 20 %, XLSX 10 %, images JPG/PNG 15 % (dont 1 000 pages « scannées » réservées à M5), TXT/CSV 5 %.
- **Répartition des tailles** : 80 % de 5 à 50 Ko, 18 % de 50 à 250 Ko, 2 % de 0,25 à 2 Mo ; moyenne ≈ 70 Ko, total ≈ 7 Go ; aucun fichier au-dessus de la limite `MAX_UPLOAD_SIZE` (100 Mio par défaut, `Vérifié`).
- **Contenu** : 2 % de doublons exacts volontaires (la détection doit les refuser et les compter) ; services, domaines et années répartis comme dans le jeu de démo ; le manifeste donne le classement attendu d'un échantillon de 1 000 fichiers.

## 3. Parcours mesurés

Même méthode de centile que `scripts/measure_c3.py` (`Vérifié` : rang le plus proche ; p50 = médiane). Les scripts réutilisent `scripts/measure_lib.py` (bibliothèque standard, identifiants par variable d'environnement, jeton jamais affiché).

| # | Parcours | Comment | Mesure | Seuil GO |
|---|---|---|---|---|
| M1 | **Import et classement** des 100 000 fichiers | les 10 lots à la suite, mode `process`, depuis le conteneur de mesure sur le réseau de la pile (pas par le proxy : pas de coupure de requête longue) | durée totale, de la première requête à la fin du dernier lot ; débit (fichiers/s) ; documents en base | **≤ 20 min** (≥ 84 fichiers/s), documents en base = 100 000 − doublons refusés, 0 erreur non expliquée |
| M1 bis | Même import en mode `archive` | sur une pile remise à zéro | durée, débit | information seulement |
| M2 | **Recherche** sur la base pleine | `measure_c3.py` avec un fichier figé de 30 requêtes, 3 passages (premier à froid gardé) | p50 et p95 du temps de bout en bout | **p95 < 2 s** (item 14) |
| M3 | **Liste** | `GET /documents/` pages 1, 50 et dernière ; `GET /documents/tree` ; 30 appels chacun | p50, p95 | `Proposé`, retenu jusqu'à la mesure (O, 17/11) : p95 < 2 s |
| M4 | **Téléversement unitaire** | 30 envois de 1 Mo par `POST /documents/` **pendant** M1 (lot 5), puis 30 après | p50, p95, échecs | `Proposé`, retenu jusqu'à la mesure (O, 17/11) : p95 < 5 s pendant l'import, 0 échec |
| M5 | **OCR** | 1 000 pages scannées du jeu, worker OCR de la pile principale arrêté ailleurs, profil OCR plafonné | pages par minute, s/page p50 et p95, pic de mémoire du worker | pas de seuil CDC ; comparer à 3,2 s/page (10/11) et noter le temps estimé pour 100 000 pages |
| M6 | **Classement correct** | échantillon de 1 000 fichiers du manifeste, avec `measure_c2.py` | taux de classement | ≥ 95 % (item 2) |

## 4. Ressources (toute la durée)

- `docker stats --no-stream` toutes les 5 s → pic de mémoire et de CPU par conteneur, dans un fichier TSV.
- Après chaque parcours : `docker inspect -f '{{.State.OOMKilled}}'` sur chaque service ; un OOM = **NO-GO** de la mesure en cours, même si la durée tient.
- Taille de la base (`pg_database_size`) et du stockage après M1.

## 5. Verdict et sortie

- **GO item 8** : M1 au seuil, aucun OOM, M2 et M6 au seuil. Item 8 → `fait`.
- **Partiel** : 100 000 fichiers importés sans perte mais au-dessus de 20 min. Item 8 → `partiel`, avec le débit mesuré et le temps projeté.
- **NO-GO** : perte de documents, OOM ou arrêt. L'item reste `absent`, et l'incident est consigné dans `DOCS/engineering/lessons-learned.md`.
- **Sortie** : `gestion-projet/recette/charge-100k-AAAA-MM-JJ.txt` (SHA, empreinte du corpus, contrôles du § 1, tableau M1 à M6, pics de ressources, verdict). Aucune donnée personnelle, aucun mot de passe.

## 6. Remise à zéro

1. `docker compose -f docker-compose.e2e.yml down -v` : supprime seulement les volumes de la pile e2e. **Vérifier le nom du projet compose avant** ; ne jamais viser un volume `edossier_*`.
2. Supprimer le corpus généré sur l'hôte (le générateur le recrée à l'identique).
3. Contrôle : `docker volume ls` ne montre plus de volume e2e, et `docker system df` retrouve l'espace d'avant.
4. Relancer la pile de démo si elle était prévue, puis `sh backend/scripts/e2e_reset.sh demo` avant tout autre test e2e.

## 7. Risques connus avant exécution

- L'import d'un répertoire se fait dans la requête HTTP (`Vérifié`, `documents.py` l. 1500-1528 : le rapport est attendu avant la réponse) et l'API est plafonnée à 1 Go. Un OOM ou une requête très longue sur un lot de 10 000 est possible. C'est **un résultat**, pas une raison de relever les plafonds en silence.
- Aucune reprise d'import interrompu n'a été trouvée dans le code (`Déduit` d'une recherche sans résultat) : un arrêt au lot 7 impose de recommencer depuis une pile remise à zéro. Voir L14 dans `lot-l11-fonctionnalites.md`.
- Durée de l'exercice : ≈ 4 h-s pour Q (générateur 1,5 ; exécution 1,5 ; analyse 1), plus le temps machine.
- Reuse-first : **Adopt** `measure_lib.py` et `measure_c3.py` ; **Adapt** `demo_dataset.py` ; **Learn** (non retenus) Locust et k6 : nouvelle dépendance pendant le gel, et le besoin est un import en masse, pas une charge d'utilisateurs simultanés.
