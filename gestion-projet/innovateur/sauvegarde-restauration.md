# Sauvegarde / restauration (ordre 5 de DEC-2026-002) — étude Reuse-first et plan d'exécution

- **Pour** : dev-backend (lundi 17/11, 0,75 j script + compose), ci-qa (rejeu sur base vierge, 0,5 j, dans l'enveloppe 1,5 j de DEC-002). Instruit par l'innovateur le 2026-11-09 20:05.
- **Niveaux** : `Vérifié` = dépôt GED237 et dépôts GitHub lus ce jour ; `Documenté` = doc éditeur ; `Proposé` = plan.
- **Exigence DEC-002** : `pg_dump` + archive du stockage, restauration rejouée sur base vierge, preuve datée avec checksum avant/après. Cible : **sauvegarde complète < 5 min, restauration < 10 min** sur le jeu de démo (≤ 500 documents, base < 1 Go).

## 1. Ce qu'il faut sauvegarder (`Vérifié`, `docker-compose.yml`)

| Donnée | Emplacement | Méthode | Pourquoi |
|---|---|---|---|
| Base PostgreSQL `edossier` (utilisateur `edossier_user`), `postgres:15-alpine`, conteneur `edossier_postgres`, volume `postgres_data` | service `postgres` | **`pg_dump -Fc`** (format custom, compressé, restaurable table par table avec `pg_restore`) | seule méthode cohérente à chaud ; copier le volume brut est interdit à chaud |
| Fichiers des documents (`STORAGE_TYPE=local`, `STORAGE_PATH=/var/storage_data`) | volume `storage_data`, monté dans `api` et `worker` | archive tar du volume | les métadonnées sans fichiers (ou l'inverse) sont inutilisables |
| Redis (OTP, blacklist) | volume `redis_data` | **non sauvegardé** | données éphémères, perdre une session est acceptable |
| Variante S3/MinIO (`STORAGE_TYPE=s3`) | bucket externe | hors périmètre V1 : le bucket est sauvegardé par son hébergeur ; documenter seulement | pas de MinIO dans le compose |

Cohérence base / fichiers : le dump et l'archive doivent être pris **dans la même fenêtre, api et worker arrêtés** (ou au minimum worker arrêté et import interdit) ; sinon un document importé entre les deux a une ligne sans fichier. Pour la démo, la sauvegarde se prend hors séance : l'arrêt de 1–2 min est acceptable.

## 2. Candidats étudiés (`Vérifié` sur GitHub le 2026-11-09)

| Outil | Étoiles / activité / licence | Ce qu'il fait | Verdict |
|---|---|---|---|
| **offen/docker-volume-backup** v2.50.1 (2026-10-30) | ★ 4 070, poussé le 04/11, MPL-2.0, image < 25 Mo | Conteneur compagnon : archive tar.gz de volumes montés, vers dossier local / S3 / WebDAV / SSH, rotation (`BACKUP_RETENTION_DAYS`), GPG/age, notifications ; labels `docker-volume-backup.stop-during-backup=true` (arrêt des conteneurs pendant l'archive) et `docker-volume-backup.archive-pre=<cmd>` (exécuter `pg_dump` dans le conteneur postgres juste avant l'archive) ; déclenchement manuel `docker exec backup backup` | **Adopt** pour la sauvegarde : couvre base + fichiers en un seul artefact, planification et rotation, zéro code |
| eeshugerman/postgres-backup-s3 | ★ 666, **dernier push 2024-08**, MIT | `pg_dump` planifié vers S3 (+ `restore.sh`), GPG | Écarté : base seule, S3 obligatoire, projet dormant |
| tiredofit/docker-db-backup (nfrastack) | ★ 1 565, poussé le 09/11, licence non standard | multi-moteurs, chiffrement, checksums, restauration guidée | Écarté : base seule (il faudrait un second outil pour `storage_data`), image lourde, licence à analyser |
| Script maison `pg_dump` + `tar` (sacrifice prévu par DEC-002, 0,25–0,5 j) | — | deux commandes dans un `backup.sh`, cron hôte | **Adapt comme repli** : garder le même format d'artefact pour que la restauration soit identique |

Choix : **Adopt offen/docker-volume-backup pour produire l'artefact ; Build un seul script `restore.sh`** (l'outil ne restaure pas : sa doc décrit une procédure manuelle `tar` + conteneur temporaire). La restauration est la partie qui doit être **prouvée**, donc scriptée et rejouée par ci-qa.

## 3. Conception (`Proposé`, prête à appliquer)

### 3.1 Service compose `backup` (profil `ops`, fichier `docker-compose.backup.yml` pour ne pas toucher au compose principal)

- Image `offen/docker-volume-backup:v2.50.1` épinglée ; `mem_limit: 128m` ; montages : `postgres_data`… **non** (on ne copie pas le volume Postgres brut), à la place un volume `backup_dump:/backup/db:ro` partagé avec postgres, `storage_data:/backup/storage:ro`, `./backups:/archive` (local) ; `/var/run/docker.sock:ro` pour les labels.
- Variables : `BACKUP_CRON_EXPRESSION="0 2 * * *"`, `BACKUP_FILENAME="ged237-%Y-%m-%dT%H-%M-%S.tar.gz"`, `BACKUP_RETENTION_DAYS=14`, `BACKUP_PRUNING_PREFIX=ged237-`, option `AWS_*`/`S3_ENDPOINT` laissée vide (activable vers MinIO sans changer le script : RAIDER-A), `GPG_PASSPHRASE` lue depuis `.env` (jamais versionnée).
- Labels sur `postgres` : `docker-volume-backup.archive-pre=/bin/sh -c 'pg_dump -U edossier_user -Fc edossier > /backup/db/edossier.dump && sha256sum /backup/db/edossier.dump > /backup/db/edossier.dump.sha256'` ; sur `api` et `worker` : `docker-volume-backup.stop-during-backup=true`.
- Déclenchement manuel (avant la démo, après la répétition) : `docker compose --profile ops exec backup backup`.
- Artefact résultant : un `tar.gz` contenant `db/edossier.dump` (+ `.sha256`) et `storage/…` ; manifeste `MANIFEST.json` écrit par `archive-pre` (date, version Alembic via `SELECT version_num FROM alembic_version`, nombre de documents, taille du stockage) pour le contrôle après restauration.

### 3.2 `scripts/restore.sh <archive.tar.gz>` (Build, ~60 lignes, idempotent)

1. Vérifier la somme SHA-256 de l'archive et du dump ; refuser si absente.
2. `docker compose stop api worker` ; `docker compose up -d postgres` sur une base **vierge** (`docker compose down -v` au préalable dans le rejeu ci-qa ; en exploitation, `DROP DATABASE`/`CREATE DATABASE` explicite demandée par option `--wipe`).
3. `pg_restore -U edossier_user -d edossier --clean --if-exists --no-owner /backup/db/edossier.dump` via `docker compose exec -T postgres`.
4. Restaurer `storage_data` : conteneur temporaire `alpine` montant le volume, `tar -xzf` du sous-dossier `storage/` (procédure recommandée par l'outil).
5. **Pas d'`alembic upgrade`** si le dump contient `alembic_version` (la table est restaurée) ; afficher la version et comparer à `alembic heads` ; si plus ancienne → `alembic upgrade head` explicite (leçon : une table manquante se voit comme une erreur réseau).
6. Contrôles de sortie : `SELECT count(*) FROM documents`, nombre de fichiers dans le volume, comparaison avec `MANIFEST.json` ; code de retour non nul si écart.
7. `docker compose up -d api worker` ; sonde `GET /health`.

### 3.3 Preuve attendue (ci-qa, walkthrough `DONE`)

| Étape | Mesure | Cible |
|---|---|---|
| Sauvegarde sur le jeu de démo (≈ 420 documents) | durée, taille de l'archive, SHA-256 | < 5 min |
| `docker compose down -v` puis `restore.sh` | durée | < 10 min |
| Après restauration | `count(*)` documents, nombre de fichiers, `alembic_version`, login `admin@minfi`, ouverture d'un PDF, recherche plein texte sur un mot connu | identiques au manifeste ; parcours P1 et P5 verts |
| Second `restore.sh` sur la même archive | aucun écart (RAIDER-I) | idempotent |

## 4. Effort et découpage

| Qui | Quoi | Effort |
|---|---|---|
| B (lundi 17) | `docker-compose.backup.yml`, labels, `restore.sh`, `DOCS/exploitation/sauvegarde.md` (5 commandes), variables dans `.env.example` | 0,75 j |
| Q (mardi 18 ou mercredi 19) | rejeu complet sur base vierge en Docker plafonné, tableau § 3.3, LESSON si écart | 0,5 j |
| Repli si l'ordre 5 est sacrifié | garder **uniquement** `backup.sh` manuel (`pg_dump -Fc` + `tar` du volume, même format d'artefact) + `restore.sh` : la restauration reste prouvée | 0,25–0,5 j |

Hors périmètre V1, à annoncer : chiffrement GPG activé par défaut, copie hors site (S3/MinIO), test de restauration périodique automatisé, sauvegarde du bucket en mode S3.

## 5. Risques

- Arrêt d'`api`/`worker` pendant l'archive : 1–2 min d'indisponibilité ; acceptable hors séance, à documenter dans le manuel d'exploitation.
- `pg_restore --clean` sur une base non vierge peut échouer sur des dépendances : le rejeu ci-qa se fait toujours sur base vierge ; l'option `--wipe` est la seule voie supportée en V1.
- Taille : les PDF image du corpus pèsent le plus ; l'archive tar.gz des 420 documents devrait rester < 1 Go ; vérifier l'espace disque du poste de démo (sur le VPS, 8,9 Go libres seulement : argument supplémentaire pour la démo sur place).
- Secrets : `DB_PASSWORD` passe par l'environnement du conteneur postgres (`pg_dump` l'y lit), jamais en argument de commande ni dans le compose versionné.

## Sources

- https://github.com/offen/docker-volume-backup (README, `docs/how-tos/run-custom-commands.md`, `stop-containers-during-backup.md`, `restore-volumes-from-backup.md`, release v2.50.1)
- https://github.com/eeshugerman/postgres-backup-s3 ; https://github.com/tiredofit/docker-db-backup
- PostgreSQL 15 : `pg_dump -Fc`, `pg_restore --clean --if-exists --no-owner`
