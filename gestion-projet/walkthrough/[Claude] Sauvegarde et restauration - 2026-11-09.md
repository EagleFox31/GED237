# Sauvegarde et restauration — `ops/backup.sh`, `ops/restore.sh`

Statut : **EN REVUE** · Branche `ops/backup-restore` · Spec : `gestion-projet/innovateur/sauvegarde-restauration.md` § 6 · Instruction orchestrateur du 2026-11-09 soir (avancé du 17/11, budget 0,25 j).

## Objectif

Scripts reproductibles de sauvegarde (dump PostgreSQL compressé + archive du volume de stockage, horodatés, rétention configurable, conteneur utilitaire plafonné) et de restauration vers une base et un stockage désignés, jamais sur la pile en cours sans drapeau explicite ; procédure et preuve chiffrée dans `DOCS/exploitation/sauvegarde-restauration.md`.

## Livré

| Fichier | Rôle |
|---|---|
| `ops/lib/common.sh` | Découverte de la cible (compose ou `PG_CONTAINER`/`STORAGE_VOLUME`), `psql`/`pg_dump` dans le conteneur (mot de passe jamais lu), conteneur utilitaire `--network none` plafonné (256 Mo, 1 CPU, logs bornés), arrêt/redémarrage des seuls services qui tournaient. |
| `ops/backup.sh` | `pg_dump -Fc -Z 6` → `db.dump` ; `tar --sort=name --mtime=… --owner=0` + `gzip -n` → `storage.tar.gz` reproductible ; `SHA256SUMS` ; `MANIFEST.txt` (alembic_version, tenants, users, documents, storage_files) sans horodatage ; rétention `BACKUP_RETENTION`. |
| `ops/restore.sh <dir> [--wipe] [--yes]` | Vérifie l'empreinte avant toute écriture ; refuse une cible non vide (code 3) sans `--wipe` ; `--wipe` = `DROP DATABASE … WITH (FORCE)` + volume vidé, confirmation `oui` sauf `--yes` ; `pg_restore --exit-on-error` ; compare les 5 comptages au manifeste (code 2 si écart). |
| `.env.example` (racine) | Variables compose (`DB_PASSWORD`, `SECRET_KEY`, `APP_PORT`, `COMPOSE_PROJECT_NAME`) et `BACKUP_*`, `PG_CONTAINER`, `STORAGE_VOLUME`. |
| `.gitignore`, `backups/.gitkeep` | `backups/*` ignoré, dossier présent. |
| `DOCS/exploitation/sauvegarde-restauration.md` | Commandes, variables, contenu d'une sauvegarde, déroulé, tableau de preuve. |

## Résultats (2026-11-09, machine partagée avec une suite pytest 2 Go et une campagne e2e)

| Étape | Résultat | Durée |
|---|---|---|
| Sauvegarde (3 tenants, 8 users, 6 documents, 24 fichiers) | ok, 622 Ko | 3 s |
| Restauration sur base et volume vierges | code 0, 5 comptages identiques | 11 s |
| Restauration sans `--wipe` sur cible non vide | code 3, rien écrit | — |
| Restauration `--wipe --yes` | code 0, comptages identiques | 12 s |
| Seconde sauvegarde, état inchangé, `BACKUP_RETENTION=1` | manifeste identique, même empreinte d'archive, ancienne sauvegarde supprimée | 3 s |
| Archive altérée d'un octet | code 1 avant tout écrasement | — |
| Sans pile compose ni `PG_CONTAINER` | code 1, message actionnable | — |

Couple sauvegarde + restauration : **≈ 15 s** sur le jeu de démonstration. Détail dans le tableau de preuve de la doc.

## Écarts par rapport à la spec § 6 (assumés)

- Chemins `ops/backup.sh`, `ops/restore.sh`, `DOCS/exploitation/sauvegarde-restauration.md` (instruction orchestrateur plus récente) au lieu de `backend/scripts/` et `DOCS/exploitation/sauvegarde.md` : les scripts pilotent Docker depuis la racine, pas le backend Python.
- Bash (tableaux, `mapfile`, `SECONDS`) plutôt que POSIX sh : déjà la convention de `backend/scripts/test-in-docker.sh` ; Git Bash sous Windows, bash natif sur le VPS.
- Manifeste sans horodatage (porté par le nom du dossier) pour qu'un état inchangé donne un manifeste identique : preuve d'idempotence et de non-régression du contenu.

## Constat annexe

`backend/scripts/seed_db.py` échoue (`UniqueViolationError org_unit_types_pkey`) sur une base migrée par Alembic : les migrations insèrent déjà les données de référence. Il ne fonctionne que sur un schéma vide via `create_all`, donc sans `alembic_version`. À signaler pour le jeu de données des 18–19/11 (le reset par l'API de ci-qa n'est pas concerné).

## RAIDER

- **R** : cible et plafonds par variables ; aucun nom de conteneur ou de volume codé en dur ; `PG_CONTAINER`/`STORAGE_VOLUME` pour toute autre pile (e2e, VPS).
- **A** : utilisateur et base lus dans l'environnement du conteneur ; projet compose découvert par label ; chemins hôte via `cygpath` quand présent ; image utilitaire remplaçable.
- **I** : archive et manifeste identiques pour un état inchangé ; restauration refusée sur cible non vide, `--wipe` explicite ; seuls les services qui tournaient sont redémarrés.
- **D** : aucun fichier applicatif touché ; `backend/.env.example` inchangé ; `.gitignore` étendu sans retirer de règle.
- **Failure memory** : seed incompatible avec une base migrée consigné ci-dessus ; proposition de leçon à ajouter à `DOCS/engineering/lessons-learned.md` à la fusion.
- **E** : moindre privilège (helper sans réseau, volume source monté `:ro`), empreintes vérifiées avant écriture, codes de sortie distincts, secrets jamais lus ni journalisés, `--exit-on-error`.
- **Scoped execution** : fichiers `ops/`, docs et `.env.example` seulement ; aucune surface CI backend/frontend impactée.
- **Reuse-first** : outils standards (`pg_dump -Fc`, GNU tar reproductible, `sha256sum`), pas de dépendance ajoutée ; modèle de conteneur plafonné repris de `test-in-docker.sh`.
- **R (rétroactif)** : fonctionne sur la pile compose existante sans modification de `docker-compose.yml`.
