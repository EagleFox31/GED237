# Sauvegarde / restauration (ordre 5 de DEC-2026-002) — étude Reuse-first et plan d'exécution

- **Pour** : dev-backend (mardi 17/11, 0,75 j script + compose), ci-qa (rejeu sur base vierge, 0,5 j, dans l'enveloppe 1,5 j de DEC-002). Instruit par l'innovateur le 2026-11-09 20:05.
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

### 3.1 Service compose `backup` (profil `ops`, fichier `docker-compose.backup.yml` pour ne pas toucher au compose principal) — *option étudiée ; livré #54 (10/11) sous forme de script `ops/backup.sh`, sans service compose*

- Image `offen/docker-volume-backup:v2.50.1` épinglée ; `mem_limit: 128m` ; montages : `postgres_data`… **non** (on ne copie pas le volume Postgres brut), à la place un volume `backup_dump:/backup/db:ro` partagé avec postgres, `storage_data:/backup/storage:ro`, `./backups:/archive` (local) ; `/var/run/docker.sock:ro` pour les labels.
- Variables : `BACKUP_CRON_EXPRESSION="0 2 * * *"`, `BACKUP_FILENAME="ged237-%Y-%m-%dT%H-%M-%S.tar.gz"`, `BACKUP_RETENTION_DAYS=14`, `BACKUP_PRUNING_PREFIX=ged237-`, option `AWS_*`/`S3_ENDPOINT` laissée vide (activable vers MinIO sans changer le script : RAIDER-A), `GPG_PASSPHRASE` lue depuis `.env` (jamais versionnée).
- Labels sur `postgres` : `docker-volume-backup.archive-pre=/bin/sh -c 'pg_dump -U edossier_user -Fc edossier > /backup/db/edossier.dump && sha256sum /backup/db/edossier.dump > /backup/db/edossier.dump.sha256'` ; sur `api` et `worker` : `docker-volume-backup.stop-during-backup=true`.
- Déclenchement manuel (avant la démo, après la répétition) : `docker compose --profile ops exec backup backup`.
- Artefact résultant : un `tar.gz` contenant `db/edossier.dump` (+ `.sha256`) et `storage/…` ; manifeste `MANIFEST.json` écrit par `archive-pre` (date, version Alembic via `SELECT version_num FROM alembic_version`, nombre de documents, taille du stockage) pour le contrôle après restauration.

### 3.2 `scripts/restore.sh <archive.tar.gz>` (Build, ~60 lignes, idempotent) — *livré #54 : `ops/restore.sh <dossier-sauvegarde> [--wipe] [--yes]`*

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
| B (mardi 17) | `docker-compose.backup.yml`, labels, `restore.sh`, `DOCS/exploitation/sauvegarde.md` (5 commandes), variables dans `.env.example` | 0,75 j |
| Q (mercredi 18 ou jeudi 19) | rejeu complet sur base vierge en Docker plafonné, tableau § 3.3, LESSON si écart | 0,5 j |
| Repli si l'ordre 5 est sacrifié | garder **uniquement** `backup.sh` manuel (`pg_dump -Fc` + `tar` du volume, même format d'artefact) + `restore.sh` : la restauration reste prouvée | 0,25–0,5 j |

Hors périmètre V1, à annoncer : chiffrement GPG activé par défaut, copie hors site (S3/MinIO), test de restauration périodique automatisé, sauvegarde du bucket en mode S3.

## 5. Risques

- Arrêt d'`api`/`worker` pendant l'archive : 1–2 min d'indisponibilité ; acceptable hors séance, à documenter dans le manuel d'exploitation.
- `pg_restore --clean` sur une base non vierge peut échouer sur des dépendances : le rejeu ci-qa se fait toujours sur base vierge ; l'option `--wipe` est la seule voie supportée en V1.
- Taille : les PDF image du corpus pèsent le plus ; l'archive tar.gz des 420 documents devrait rester < 1 Go ; vérifier l'espace disque du poste de démo (sur le VPS, 8,9 Go libres seulement : argument supplémentaire pour la démo sur place).
- Secrets : `DB_PASSWORD` passe par l'environnement du conteneur postgres (`pg_dump` l'y lit), jamais en argument de commande ni dans le compose versionné.

## 6. Révision 2026-11-09 soir (file 9 de O) — voie principale ramenée à ≤ 0,25 j, restauration répétée, intégration démo

Ce qui change par rapport aux § 3-4 (non réécrits) : O fixe le portage à **≤ 0,25 j** et exige une restauration **répétée au moins une fois avant le 27** avec preuve. Le service compose `offen/docker-volume-backup` (§ 3.1, 0,75 j) devient donc la **V1.1** (planification, rotation, chiffrement) ; la voie V1 est le **repli du § 4 promu en voie principale** : deux scripts maison, même format d'artefact, pas de conteneur supplémentaire. Rien n'est perdu : `restore.sh` est identique dans les deux voies.

### 6.1 Contrat des scripts (livrés #54 : `ops/backup.sh`, `ops/restore.sh <dossier> [--wipe] [--yes]`, sortie `backups/ged237-<UTC>/` = `db.dump`, `storage.tar.gz`, `SHA256SUMS`, `MANIFEST.txt` ; POSIX sh, Docker uniquement)

| Point | Décision |
|---|---|
| Périmètre | `pg_dump -Fc edossier` (dans `edossier_postgres`, mot de passe lu de l'environnement du conteneur) + `tar` du volume `storage_data` via un conteneur temporaire `alpine` ; **Redis ignoré** (OTP et blacklist éphémères : après restauration, tout le monde se reconnecte, c'est voulu). |
| Destination | **hôte, hors conteneur** : `./backups/ged237-AAAAMMJJ-HHMMSS/` (répertoire **ignoré par git**, `.gitkeep` seul suivi) contenant `edossier.dump`, `storage.tar.gz`, `MANIFEST.txt` (date UTC, `alembic_version`, `count(*)` documents, nb de fichiers, taille) et `SHA256SUMS`. Un répertoire par sauvegarde, jamais écrasé. Copie sur clé USB et poste de secours = `cp -r` du répertoire, rien d'autre. |
| Cohérence | `backup.sh` fait `docker compose stop worker api` le temps du dump + tar (1-2 min), puis `up -d` ; pas d'option « sans arrêt » en V1 (un document importé entre les deux = ligne sans fichier). |
| Idempotence (RAIDER-I) | `backup.sh` relancé sur un état inchangé : `MANIFEST.txt` et le `tar` (`--sort=name`, `--mtime` figé) identiques, seul `edossier.dump` diffère (horodatage interne de `pg_dump`) ; c'est ce que Q compare. `restore.sh <répertoire>` : vérifie `SHA256SUMS`, exige `--wipe` pour `DROP/CREATE DATABASE` (sinon refuse si la base n'est pas vide), `pg_restore --clean --if-exists --no-owner`, vide puis remplit le volume, compare `count(*)` et nb de fichiers au `MANIFEST.txt`, code retour non nul si écart ; **second passage sur le même répertoire = même sortie, zéro écart**. |
| Hors périmètre V1 (annoncé) | planification cron, rotation, chiffrement, copie hors site, mode S3 : § 3.1 en V1.1. |

### 6.2 Qui porte

**B écrit les deux scripts (0,25 j, mar 17 matin, PR `ops/backup-restore`, avec `DOCS/exploitation/sauvegarde.md` de 5 commandes)** ; **Q rejoue** (dans son enveloppe « recette élargie », 0,25 j au total pour les deux rejeux) ; aucun travail F. Si B glisse, Q écrit les scripts : ils ne touchent pas au code applicatif, seulement au compose et au dossier `scripts/`.

### 6.3 Preuves attendues (deux restaurations, pas une)

| Quand | Quoi | Preuve consignée (`gestion-projet/recette/`) |
|---|---|---|
| **mar 10** (avancé par ci-qa, #54 sur `main` le 10/11 ; prévu mer 18) | rejeu n° 1 sur la pile e2e : `backup.sh` → `docker compose down -v` → `restore.sh --wipe` → parcours P1 et P5 verts ; puis `restore.sh` une seconde fois sur le même répertoire | `restauration-2026-11-10.txt` : durées, `MANIFEST.txt` avant/après, `SHA256SUMS`, sortie du second passage (zéro écart) |
| **ven 20 soir** (après C2/C3 et pré-OCRisation) | rejeu n° 2 sur le **jeu de démo** : sauvegarde complète, restauration sur le **poste de secours** (c'est ainsi qu'il est synchronisé), 8 parcours Playwright verts dessus | `restauration-2026-11-20.txt` + run Playwright ; cette archive devient le **point de reprise de référence** jusqu'à J-1 |
| **J-1 (dim 29)** | sauvegarde complète après le reset final et la pré-OCRisation ; restaurée sur le poste de secours | ligne de `checklist-demo.md` § B cochée, répertoire copié sur la clé USB |

### 6.4 Critères observables (C7 de `criteres-acceptation.md`)

1. `backup.sh` termine en **< 5 min** sur le jeu de démo ; répertoire horodaté présent sur l'hôte, `sha256sum -c SHA256SUMS` sans erreur.
2. `restore.sh --wipe` termine en **< 10 min** sur une base vierge ; `count(*)` et nb de fichiers = `MANIFEST.txt` ; `/health` = 200 ; connexion d'un compte seed (identifiant seulement dans la preuve), ouverture d'un PDF, recherche d'un mot connu → résultats attendus.
3. Second `restore.sh` sur le même répertoire : zéro écart, code retour 0.
4. Deux preuves datées (18 et 20/11) avant le 27 ; sans la seconde, C7 reste **non validé** le 21 (règle de lecture § 4 des critères).

### 6.5 Intégration à `checklist-demo.md` (lignes ajoutées ce soir)

- **J-1** : sauvegarde complète = ligne existante (§ B Données), commande remplacée par `ops/backup.sh`.
- **Point de reprise avant la séance** : le poste de secours **est** la restauration de la sauvegarde J-1 ; vérification H-30 : `/health` 200 sur les deux postes, même nombre de documents.
- **Si une purge part en démo** (`DELETE /purge` ou suppression définitive) : **aucune restauration en séance** (règle « jamais de redémarrage de conteneur en séance ») ; O bascule sur le **poste de secours** (< 60 s), qui montre l'état J-1 ; la restauration du poste principal se fait **après** la séance depuis le répertoire J-1. P commente « le document est en corbeille, l'administrateur peut le restaurer » et ne tente pas de le faire en direct.

## Sources

- https://github.com/offen/docker-volume-backup (README, `docs/how-tos/run-custom-commands.md`, `stop-containers-during-backup.md`, `restore-volumes-from-backup.md`, release v2.50.1)
- https://github.com/eeshugerman/postgres-backup-s3 ; https://github.com/tiredofit/docker-db-backup
- PostgreSQL 15 : `pg_dump -Fc`, `pg_restore --clean --if-exists --no-owner`
