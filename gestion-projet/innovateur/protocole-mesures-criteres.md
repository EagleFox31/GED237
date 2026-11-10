# Protocole de mesure des trois critères jamais mesurés (C2, C3, C6) — exécutable par ci-qa le 20/11

- **Pour** : Q (exécute sur le jeu de démo du 20/11, puis consigne), O (reporte dans `matrice-recette.md` colonne État et dans `point-2026-11-14.md` § 4 / verdict du 21), PO (lit le seuil GO/NO-GO). Instruit par l'innovateur le 2026-11-09 19:50 ; aucune commande exécutée.
- **Pré-requis communs** : pile Docker **de démo** (`docker-compose.yml` avec ses caps : api 1 Gio/1,5 cpu, pg 768 Mio/1 cpu, worker 2 Gio), jeu de démo chargé par `e2e_reset.sh demo` (`demo-manifest.json`, `jeu-donnees-demo.md` § 5), corpus pré-OCRisé **la veille** (worker allumé la nuit du 19, éteint le 20 : `checklist-demo.md`), aucune **suite e2e** en cours (règle « e2e annoncé chez ci-qa », `goulot-vm-docker.md` mise à jour du 09/11 ; VM à 11,7 Gio, les piles étrangères peuvent rester). Rien n'écrit dans le dépôt : les sorties vont dans `gestion-projet/recette/mesures-2026-11-20/` (dossier à créer par Q, fichiers `.txt`/`.csv`, jamais de jeton ni de mot de passe).
- **Reuse** : `backend/scripts/e2e_reset.sh` + `seed_e2e.py` (Q, `ci/e2e-seed`), `demo-manifest.json` section `expected` (mêmes assertions que `E2E-VOL`), `psql` du conteneur `edossier_postgres`, `GET /search` (`took_ms` déjà renvoyé, `search.py:79`), `GET /health` (`main.py:88`), générateur `test_real_export_v2.py` (`GED_EXPORT_AMBIGUITY_RATE`). Rien à coder côté B ; Q écrit deux petits scripts shell (≈ 40 lignes) dans `backend/scripts/` de sa branche.

## C2 — ≥ 95 % des documents classés selon les règles

**Définition (à figer avant la mesure, sinon le chiffre se discute)**

- **Numérateur** = documents dont `classification_status = 'classified'` **et** dont la destination (service, domaine, activité, année) est celle attendue par le manifeste (`expected.destination` par fichier, déjà prévu pour `E2E-VOL`). Un document classé au mauvais endroit compte **zéro**.
- **Dénominateur** = documents importés par le seed **couverts par une règle active** = total − doublons refusés (12, jamais créés) − documents **volontairement ambigus ou sans mot-clé** déclarés `expected.status = needs_review` dans le manifeste (35-45). Ces derniers sont exclus parce que le CDC dit « classés **selon les règles définies** » : un fichier qu'aucune règle ne vise n'est pas un échec de classement, c'est l'objet de P6. Ils sont comptés **à part** (indicateur C2b) pour que le jury voie le chiffre brut.
- Tolérance : un document ambigu classé par une règle (au lieu de `needs_review`) est un **faux classé** s'il atterrit au mauvais endroit, un succès sinon. Les documents en corbeille (8) et `live/` (30) sont hors mesure.

**Commande** (Q, depuis l'hôte, lecture seule) :

```sh
docker exec edossier_postgres psql -U "$POSTGRES_USER" -d edossier -At -c "
SELECT classification_status, COUNT(*) FROM documents
WHERE deleted_at IS NULL AND tenant_id = '<tenant MINFI>'
GROUP BY 1 ORDER BY 1;"
```

puis, pour la destination attendue, un script `scripts/measure_c2.py` (Q) qui lit `demo-manifest.json`, interroge `GET /spaces/documents?limit=200&offset=…` (ou la table `documents` jointe aux unités/domaines/activités) et imprime :

```
C2  total_seed=420 exclus_doublons=12 exclus_attendus_needs_review=40 denominateur=368
    classes_bonne_destination=352 classes_mauvaise_destination=4 non_classes_couverts=12
    C2 = 352/368 = 95,7 %   C2b (brut, tous documents) = 352/408 = 86,3 %
```

**Seuil** : **GO si C2 ≥ 95,0 %** ; NO-GO en dessous → avant de corriger le moteur, lister les 16 écarts (mauvaise destination + non classés couverts) : neuf fois sur dix c'est une règle du jeu mal écrite, pas le moteur (0,25 j Q/B). C2b est **informatif**, annoncé au jury avec l'écart 1 (« chiffres CDC non mesurés » devient « mesurés le 20/11 »).

**Consigner** : ligne `C2` de `criteres-acceptation.md` § 1 et colonne État de la matrice (P2 SC-E2E-01) : `Vérifié 2026-11-20 : C2 = 95,7 % (352/368), C2b 86,3 %, fichier mesures-2026-11-20/c2.txt`.

## C3 — Recherche < 2 s

**Jeu de requêtes figé** (10, écrites dans `mesures-2026-11-20/c3-queries.txt`, **inchangées** entre la répétition et la démo ; Q les choisit dans le corpus généré, exemples de forme) :

1. un mot fréquent (≥ 50 hits) : `facture` · 2. un mot rare (1-3 hits) : un numéro de bordereau · 3. deux mots : `contrat formation` · 4. un nom d'agent du corpus · 5. une année : `2025` · 6. un mot présent **seulement** dans la couche OCR d'un PDF image · 7. un mot absent (0 hit) · 8. une faute volontaire (teste le fallback) · 9. requête + filtre `status=` · 10. requête + `org_unit_id=` du service DAF.

Chaque requête est jouée **3 fois** (la première chauffe le cache PostgreSQL : on la **garde**, le jury n'aura pas de cache chaud), avec le compte collab DAF (`MINFI002`), soit 30 mesures.

**Commande** (`scripts/measure_c3.sh`, Q) :

```sh
TOKEN=$(…login OTP via l'API e2e, jamais écrit dans un fichier…)
while read -r q; do for i in 1 2 3; do
  curl -s -o /tmp/r.json -w '%{time_total}\n' -H "Authorization: Bearer $TOKEN" \
    "http://localhost:8000/api/v1/search/?q=$(printf %s "$q" | jq -sRr @uri)&limit=20" \
    | awk -v q="$q" -v took="$(jq .took_ms /tmp/r.json)" '{printf "%s\t%s\t%d\t%.0f\n", strftime("%FT%T"), q, took, $1*1000}'
done; done < c3-queries.txt > c3.tsv
```

Deux colonnes de temps : **`took_ms`** (serveur, celui que l'UI affiche, critère contractuel) et **`time_total`** (bout en bout vu du poste, informatif : c'est ce que le jury ressent).

**Sortie attendue** : `c3.tsv` (30 lignes) + une ligne de synthèse `C3 took_ms p50=… p95=… max=… ; e2e p95=…` (p95 = 2ᵉ valeur la plus haute sur 30).

**Seuil** : **GO si p95(took_ms) < 2 000 ms** ; alerte (pas NO-GO) si p95 bout en bout > 2 000 ms ou si max > 4 000 ms sur la requête 1 (mot fréquent : vérifier l'index GIN sur le TSVECTOR, `EXPLAIN ANALYZE` par B). Attendu réaliste sur 420 documents : p95 < 200 ms ; si ce n'est pas le cas, le problème est ailleurs (connexion, caps CPU) et doit être compris avant le 27.

**Consigner** : ligne `C3` et matrice P5 SC-LEC-01 : `Vérifié 2026-11-20 : C3 p95 = … ms (30 mesures, c3.tsv)`.

## C6 — Disponibilité ≥ 99 % pendant les tests de validation

Le contrat parle de « tests de validation » : on mesure sur la **campagne S2 (mar 17 → sam 21)**, deux relevés par jour (matin ≈ 09:00, soir ≈ 18:00) = **10 relevés**, plus un relevé avant et après chaque suite e2e (bonus, même format).

**Commande** (`scripts/probe_c6.sh`, Q, ≈ 10 lignes, idempotent : une ligne ajoutée par appel) :

```sh
ts=$(date -u +%FT%TZ)
health=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:8000/health)
ps=$(docker ps --filter name=edossier_ --format '{{.Names}}={{.Status}}' | tr '\n' ' ')
restarts=$(docker inspect -f '{{.Name}}={{.RestartCount}}' $(docker ps -q --filter name=edossier_) | tr -d / | tr '\n' ' ')
printf '%s\thealth=%s\t%s\t%s\n' "$ts" "$health" "$ps" "$restarts" >> c6.tsv
```

**Format d'une ligne** : `2026-11-17T08:02:11Z  health=200  edossier_api=Up 2 hours (healthy) edossier_postgres=Up 2 hours (healthy) …  edossier_api=0 edossier_worker=0 …`

**Règle de calcul** : un relevé est **KO** si `health ≠ 200`, si un conteneur `edossier_api`, `edossier_postgres`, `edossier_redis` ou `edossier_nginx` n'est pas `Up … (healthy)` (le worker peut être éteint volontairement : il est exclu), ou si `RestartCount` a augmenté depuis le relevé précédent **sans** action consignée dans la passation de Q (reset, rebuild). Disponibilité = relevés OK / relevés totaux.

**Seuil** : **GO si 10/10** (99 % sur 10 relevés = 10/10 ; 9/10 = 90 %, NO-GO) ; un KO **expliqué** (rebuild volontaire) ne compte pas, mais il est écrit. C6 est faible statistiquement et on le dit au jury (écart 6 : « sonde de santé disponible ; supervision livrée avec le pilote ») : c'est la mesure que permet le contrat tel qu'écrit, pas une promesse de SLA.

**Consigner** : ligne `C6` de `criteres-acceptation.md` § 1 seulement (la matrice n'a pas de ligne transverse ; O renvoie à cette ligne dans `point-2026-11-14.md` § 4) : `Vérifié 2026-11-21 : C6 = 10/10, 0 redémarrage non expliqué, c6.tsv`.

## Ordre et coût

| Quand | Quoi | Qui | Coût |
|---|---|---|---|
| mar 17 matin | créer `mesures-2026-11-20/`, `probe_c6.sh`, premier relevé ; relevés matin/soir jusqu'au 21 | Q | 0,1 j + 2 min/jour |
| mer 18 | écrire `measure_c2.py` et `measure_c3.sh` sur la pile e2e (données e2e, juste pour valider les scripts) ; figer `c3-queries.txt` dès que le corpus de démo est généré | Q | 0,25 j |
| jeu 19 soir | corpus de démo chargé, worker OCR allumé pour la nuit | Q | (D1) |
| **ven 20** | worker éteint, aucune suite e2e en cours, **C2 puis C3**, 15 min ; synthèse dans `point-2026-11-14.md` § 4 et matrice | Q → O | 0,1 j |
| sam 21 | dernier relevé C6, verdict | Q → O | — |
| **ven 27** (répétition générale) | rejouer C3 sur le poste de démo réel : mêmes 10 requêtes, le chiffre dit au jury est celui-là | Q | 10 min |

Total Q : **≈ 0,5 j**, déjà dans l'enveloppe « recette élargie » de S2 (DEC-002 mer 18). Aucune action B sauf NO-GO.

## Sources

Cadrage 21/09/2025 § 8 (critères de recette) ; `criteres-acceptation.md` § 1 ; `jeu-donnees-demo.md` § 3 (répartition et états, `demo-manifest.json` `expected`), § 5 (procédure) ; `backend/app/services/classification_rule_engine.py:23-28` (statuts `classified`, `needs_review`, `no_rule`, `rejected`, `pending`) ; `backend/app/api/v1/endpoints/search.py:16-32, 79` (`q`, `status`, `org_unit_id`, `limit ≤ 100`, `took_ms`) ; `backend/app/main.py:88-95` (`/health`) ; `../GED237-e2e/backend/scripts/e2e_reset.sh` ; `docker-compose.yml` (caps) ; `checklist-demo.md` (worker éteint, corpus pré-OCRisé) ; `plan-presentation.md` § 3 écarts 1 et 6.
