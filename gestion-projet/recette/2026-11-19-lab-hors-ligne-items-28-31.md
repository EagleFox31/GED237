# Lab hors ligne : installation sans Internet (item 28) et rejeu du manuel (item 31)

- **Quand** : 19/11, de 09:24 à 10:15 (heure de l'hôte), session CI/QA.
- **Code et images** : `main` à `103ce48b2ef1f42980d181f3414d3f76a8fb988e` (annexe A1 du protocole).
- **Manuel rejoué** : `DOCS/exploitation/installation.md` de la PR #470, tête `925f00953083808a7a50deadff8be66af18095bb` (base `main` 103ce48b), avec `REF=103ce48b`.
- **Résultat** : item 28 **OK avec le correctif de `scripts/images_import.sh` de cette PR** (avec le script de `main`, échec à la vérification de l'import sur une cible `overlay2`). La pile démarre sans réseau, `/health` répond 200 avec la version `103ce48b`. Item 31 rejoué de bout en bout, sauf ce qui est listé au § 6.
- **Écarts du manuel** : 2 bloquants, dont 1 corrigé dans le script et l'autre dans le manuel ; 7 gênants ; 3 mineurs. Le détail est au § 5.

## 1. Montage du lab

| Rôle | Ce que c'est |
|---|---|
| Poste connecté | Windows 11, Docker Desktop 29.8.0 (magasin d'images containerd), Compose v5.5.1, Git Bash. Worktree de `main` à 103ce48b. |
| « Clé USB » | Un dossier du répertoire temporaire, monté **en lecture seule** dans le poste cible (`/media/usb`). Le `.env` est sur un autre support, lui aussi en lecture seule (`/media/env`). |
| Poste cible « vierge » | Conteneur `qlab-target` : image `docker:27.5.1-dind` + `bash coreutils curl` (prérequis du § 1), `--network none --privileged --memory=3g --cpus=4 --log-opt max-size=1m` (5 Go pour le démarrage de la pile), volume `qlab-target-docker` pour `/var/lib/docker`. Docker Engine 27.5.1, magasin `overlay2`, Compose v2.33.0. |

Pour ne pas toucher à la pile de démonstration (`edossier`), le lab utilise `COMPOSE_PROJECT_NAME=qlab` : sur l'hôte en variable d'environnement, sur la cible dans le `.env`. Les images s'appellent donc `qlab-*` au lieu de `edossier-*`. Aucun `up` n'a été lancé sur l'hôte.

Le `.env` vient de `.env.example`, avec une `SECRET_KEY` (`openssl rand -hex 32`) et un `DB_PASSWORD` générés. Ils n'ont jamais été affichés : leur seul contrôle est `grep -c` sur le format attendu, qui renvoie 1. On y a ajouté `APP_VERSION=103ce48b` et `COMPOSE_PROJECT_NAME=qlab`.

## 2. Poste connecté (§ 2, § 4 et § 9 du manuel)

```bash
git worktree add --no-track -b docs/lab-hors-ligne-items-28-31 ../GED237-q-lab origin/main   # 103ce48b
cp .env.example .env            # + secrets générés, APP_VERSION, COMPOSE_PROJECT_NAME=qlab
COMPOSE_PROJECT_NAME=qlab COMPOSE_PARALLEL_LIMIT=1 docker compose build
COMPOSE_PROJECT_NAME=qlab docker compose pull --ignore-buildable
IMAGES_DIR=<clé>/ged237-images bash scripts/images_export.sh
REF=103ce48b
git archive --format=tar.gz --prefix=GED237/ -o <clé>/ged237-code-$REF.tar.gz $REF
(cd <clé> && sha256sum ged237-code-$REF.tar.gz > ged237-code-$REF.tar.gz.sha256)
```

| Étape | Durée | Sortie utile |
|---|---|---|
| `build` + `pull --ignore-buildable` | 3 min 22 | 5 images construites, toutes depuis le cache ; `nginx:alpine`, `redis:7-alpine` et `postgres:15-alpine` téléchargées. L'option `--ignore-buildable` passe avec Compose v5.5.1 (hôte), et elle existe aussi dans Compose v2.33.0 (cible). |
| `images_export.sh` | 71 s | 8 images ; `images.tar.gz` de **1,2 Go** (1 204 554 994 octets) |
| second `images_export.sh` | 13 s | `déjà à jour … (8 image(s)), rien à écrire` ; date du fichier inchangée |
| `git archive` | < 1 s | `ged237-code-103ce48b.tar.gz`, 5 046 038 octets ; sha256 `b2b4dd87…ca3182c32526` |

`IMAGES.txt` (id = digest de l'index OCI, magasin containerd) :

```
nginx:alpine sha256:0563c36f94a6…
postgres:15-alpine sha256:e18480a22d6e…
qlab-api sha256:f73577123fc2…
qlab-frontend sha256:fe3aee65d71d…
qlab-migrate sha256:7b48df489385…
qlab-seed sha256:6c14642bef1a…
qlab-worker sha256:b77e4b11c5b3…
redis:7-alpine sha256:7f7d30b7fdd0…
```

`SHA256SUMS` : `images.tar.gz` `3cc6c0fa…2b175a911`, `IMAGES.txt` `50770de7…36400c7d20f`.

## 3. Poste cible sans réseau (§ 9)

### 3.1 Absence de réseau

```
NetworkMode=none Memory=3221225472 NanoCpus=4000000000 Privileged=true
/media/env rw=false; /media/usb rw=false; /var/lib/docker rw=true;
ip route    → 172.17.0.0/16 dev docker0 (aucune route par défaut)
interfaces  → lo, docker0 (DOWN)
wget -T 5 https://registry-1.docker.io/v2/   → wget: bad address 'registry-1.docker.io' (code 1)
wget -T 5 http://1.1.1.1/                    → can't connect to remote host (1.1.1.1): Network unreachable (code 1)
curl -m 5 https://github.com                 → Could not resolve host: github.com (code 6)
docker pull alpine:3.20                      → … dial udp 192.168.65.7:53: connect: network is unreachable
touch /media/usb/x                           → Read-only file system
docker images -q | wc -l                     → 0
```

### 3.2 Code, import, contrôle des images

```bash
REF=103ce48b
(cd /media/usb && sha256sum -c ged237-code-$REF.tar.gz.sha256)   # ged237-code-103ce48b.tar.gz: OK
tar -xzf /media/usb/ged237-code-$REF.tar.gz -C ~                 # crée /root/GED237
cd ~/GED237 && cp /media/env/.env .
bash scripts/images_import.sh /media/usb/ged237-images
```

**Avec le script de `main` (103ce48b) : échec.** Les 8 images sont bien chargées (2 min 38), mais la vérification finale refuse tout :

```
à charger : nginx:alpine postgres:15-alpine qlab-api qlab-frontend qlab-migrate qlab-seed qlab-worker redis:7-alpine
Loaded image: … (8 lignes)
ERREUR : après docker load, id différent ou image absente : nginx:alpine postgres:15-alpine qlab-api … redis:7-alpine
```

Cause : l'id d'une image dépend du magasin d'images. Sur l'hôte (containerd), `.Id` est le digest de l'index OCI. Sur la cible (`overlay2`), c'est le digest de la config. Les couches sont les mêmes des deux côtés (`RootFS.Layers` identiques), mais les ids ne coïncident jamais. Le `manifest.json` de l'archive donne bien, pour chaque tag, le digest de config que la cible affiche (par exemple `qlab-api` : `7a37c5274e42…` des deux côtés).

**Avec le script corrigé (cette PR)** : quand l'id diffère, l'import accepte aussi le digest de config que l'archive vérifiée donne pour ce tag. `IMAGES.txt` ne change pas de format.

| Essai (cible `overlay2`, export complet) | Durée | Sortie |
|---|---|---|
| après le chargement par l'ancien script | 56 s | `les 8 image(s) sont déjà présentes avec l'id attendu : rien à charger` |
| second passage | 64 s | idem, aucun `docker load` |
| `qlab-frontend` et `redis:7-alpine` supprimés, puis import | 2 min 12 | `à charger : qlab-frontend redis:7-alpine`, puis `8 image(s) présentes avec l'id attendu (68 s)` |

| Essai (cible containerd, `"containerd-snapshotter": true`, mini-export `redis:7-alpine` + une image construite) | Sortie |
|---|---|
| script de `main` | chargement, puis `2 image(s) présentes avec l'id attendu` : l'id est conservé d'un magasin containerd à l'autre |
| script corrigé, second passage | `rien à charger` |
| script corrigé, magasin vidé, puis 2 passages | chargement, puis `rien à charger` |

Test automatique ajouté : `scripts/test_images_import.sh`, avec un faux `docker` (ni démon, ni réseau). Il couvre les deux magasins (premier et second import), l'ancien format de `manifest.json`, un id inattendu après chargement (code 1) et une copie altérée (code 1, aucun chargement). Il passe sous Git Bash et dans le poste cible. Avec le script de `main`, il échoue sur `overlay2 : premier import`. Il est lancé en CI par le job « Workflow lint », qui suit la porte `workflow-lint` (`scripts/**`).

```
diff <(docker compose config --images | sort) <(cut -d' ' -f1 IMAGES.txt)   → aucune sortie
nginx:alpine postgres:15-alpine qlab-api qlab-frontend qlab-migrate qlab-seed qlab-worker redis:7-alpine
```

### 3.3 Démarrage et contrôles (§ 4, § 5)

Mémoire du poste cible portée à 5 Go pour la fenêtre (`docker update --memory=5g --memory-swap=5g`, volume conservé). Démarrage à 09:55 :

```bash
docker compose up -d --pull never --no-build      # 21 s
```

| Contrôle (manuel) | Résultat sans réseau |
|---|---|
| `docker compose ps -a` (§ 5) | `api`, `postgres`, `redis` : `Up (healthy)` ; `frontend`, `nginx`, `worker` : `Up` ; `migrate` et `seed` : `Exited (0)`. `api` sain 20 s après le `up`. |
| `curl http://localhost:8080/health` | **200** `{"status":"healthy","version":"103ce48b","service":"E-Dossier Cameroun API"}` |
| `curl http://localhost:8080/` | 302 vers `/edossier/`, puis 200, titre `E-Dossier Cameroun \| GED Premium` |
| `/api/docs` | 200 |
| `alembic current` | `a7c8d9e0f1b2 (head)`, égal à `alembic heads` |
| `worker` | `celery@… ready.` |
| `seed` | jeu de démonstration créé, sortie normale |
| résolution DNS depuis `api` (`pypi.org`) | échec (`gaierror`) : la pile tourne bien sans réseau |
| mémoire des conteneurs | `frontend` 303 Mo, `api` 178 Mo, `worker` 119 Mo, `postgres` 60 Mo, `nginx` 13 Mo, `redis` 5 Mo (≈ 680 Mo) ; poste cible entier 1,2 Go sur 5 Go |

Sauvegarde et restauration (§ 7), toujours sans réseau :

| Essai | Résultat |
|---|---|
| `bash ops/backup.sh` (défaut `python:3.12-slim`) | **échec**, code 125 : `Unable to find image 'python:3.12-slim' locally`, puis `network is unreachable`. Les services arrêtés sont relancés, mais un dossier incomplet reste (`db.dump` seul, sans `MANIFEST.txt` ni `SHA256SUMS`). |
| `BACKUP_HELPER_IMAGE=qlab-api bash ops/backup.sh` | OK en 19 s : `tenants=3 users=8 documents=6 fichiers=0 alembic=a7c8d9e0f1b2` |
| `BACKUP_HELPER_IMAGE=qlab-api bash ops/restore.sh backups/ged237-… --wipe --yes` | OK en 18 s : `comptages identiques` au manifeste |
| `/health` juste après | **502** pendant 40 s, alors que `api` est `healthy` : `api` relancé a pris l'adresse 172.18.0.6, et nginx appelle encore 172.18.0.5 (`connect() failed (111)`) |
| `docker compose restart nginx` | `/health` 200 en 2 s |
| `docker compose down` (§ 7) | 3,5 s ; 0 conteneur, volumes `qlab_postgres_data`, `qlab_redis_data` et `qlab_storage_data` conservés |

## 4. Mesures

| Moment | C: libre | MemAvailable (VM) | Disque interne de la VM (utilisé / libre) | Remarque |
|---|---|---|---|---|
| 09:24, avant | 20,7 Go | 8,9 Go | 87,9 / 867,7 Go | `docker_data.vhdx` : 95,1 Go |
| 09:29, après build et pull | 20,1 Go | 9,8 Go | 88,3 / 867,3 Go | |
| 09:31, après export | 19 Go | — | — | export de 1,2 Go sur C: |
| 09:36, après import dans le dind | 15,1 Go | 8,8 Go | 91,7 / 863,9 Go | `/var/lib/docker` du dind : 3,4 Go ; dind 314 Mo de mémoire |
| 09:46, après les essais containerd | 14,1 Go | 8,3 Go | 92,7 / 863,0 Go | |
| 09:56, pile démarrée dans le dind | 13,8 Go | 9,1 Go | 92,6 / 863,0 Go | dind 1,2 Go de mémoire sur 5 Go |
| 10:02, après sauvegarde, restauration et `down` | 18,4 Go | 9,6 Go | 92,6 / 863,0 Go | `/var/lib/docker` du dind : 3,7 Go ; C: remonte à cause d'une autre activité de l'hôte |
| 10:14, après le nettoyage | 14,3 Go | 9,9 Go | 71,6 / 884,0 Go | |

Le vhdx grossit de la place que le dind écrit (environ 3,4 Go pour les images chargées) et ne rétrécit pas. Cette place reste libre à l'intérieur de la VM après le nettoyage, et Docker la réutilise.

## 5. Écarts du manuel (rejeu de la PR #470)

| # | Où | Constat | Gravité | Suite |
|---|---|---|---|---|
| L1 | § 9, `images_import.sh` | Sur une cible en magasin `overlay2` (Docker Engine ≤ 28, magasin par défaut avant la 29), l'import charge tout puis échoue sur « id différent ». | bloquant | **corrigé** (script + test + CI) |
| L2 | § 1, outils de l'hôte | Le `sha256sum` de BusyBox (Alpine, image `docker:dind`) refuse `--quiet` : l'import s'arrête sur « sommes de contrôle invalides ». `bash` et `curl` manquent aussi dans `docker:dind`. Le § 5 utilise `curl`, qui n'est pas listé. | bloquant sur Alpine | **doc** : GNU coreutils et `curl` (ou `wget -qO-`) |
| L3 | § 9, `docker compose config --images` « doit lister exactement les images de IMAGES.txt » | L'ordre diffère, et `IMAGES.txt` porte aussi les ids : la comparaison à l'œil n'est pas fiable. | gênant | **doc** : commande `diff` |
| L4 | § 6, `git pull` | En HEAD détachée (tag ou SHA, § 2 de #470), `git pull` échoue : « You are not currently on a branch » (code 1, constaté). | gênant | **doc** : `git fetch origin` puis `git checkout` |
| L5 | § 6 sur le poste cible | L'archive n'est pas un dépôt Git (`fatal: not a git repository`) : la mise à jour hors ligne passe par une nouvelle archive et un nouvel export, et le manuel ne le disait pas. | gênant | **doc** |
| L6 | § 7 hors ligne | `ops/backup.sh` et `ops/restore.sh` lancent `BACKUP_HELPER_IMAGE` (`python:3.12-slim`), qui n'est pas dans l'export. Sans réseau : code 125 et un dossier de sauvegarde incomplet. Avec l'image `api` de la pile : sauvegarde et restauration OK. | gênant | **doc** : `BACKUP_HELPER_IMAGE=edossier-api`, et supprimer le dossier incomplet |
| L12 | § 7, après sauvegarde ou restauration | `/health` en 502 alors que `api` est sain : nginx garde l'adresse IP de l'ancien conteneur `api`. Pas propre au hors ligne. | gênant | **doc** : `docker compose restart nginx`. Correctif durable proposé (hors de cette PR) : `resolver 127.0.0.11` dans nginx, ou relance de nginx par `ops/lib/common.sh`. |
| L7 | § 3, `APP_VERSION` et `INGEST_SOURCE_DIR` | Absentes de `.env.example` : le tableau dit « mettre la version livrée », mais la ligne est à ajouter. Déjà relevé sur papier (n° 15 du 18/11). | gênant | **doc** |
| L8 | § 9, import sur `overlay2` | Le second import prend environ 1 min au lieu de quelques secondes : sha256 de 1,2 Go, puis relecture de l'archive. | gênant | **doc** (durée annoncée) |
| L9 | § 4, `COMPOSE_PARALLEL_LIMIT=1` | Compose v5.5.1 construit avec bake : les 5 images sont annoncées `Building` en même temps. Avec un cache plein, rien ne permet de dire si la limite est respectée. | mineur | à observer au test à froid du 25/11 |
| L10 | § 9, `sha256sum` sous Git Bash | Le fichier `.sha256` écrit sous Windows contient `*nom` (mode binaire). `sha256sum -c` l'accepte sous Linux. | mineur | rien à faire |
| L11 | journaux des scripts dans un conteneur | L'heure des journaux est en UTC (08:43 pour 09:43 sur l'hôte). | mineur | rien à faire |

Vérifié sans écart : `REF` et `git archive` du § 9 de #470, le nom du dossier `GED237` créé par `tar`, le refus d'une copie altérée, l'export idempotent, `--pull never --no-build`, et le `.env` sur un support séparé.

## 6. Ce qui n'a pas été rejoué, et pourquoi

- **Premier build à froid** (§ 4, 26 min annoncées) : le cache de l'hôte était plein, et vider le cache coûte plusieurs Go sur C:. À mesurer au test du 25/11.
- **Parcours fonctionnel complet** (§ 5 au-delà de `/health` : connexion avec code OTP, dépôt d'un document, OCR, recherche) et **Playwright** : hors du périmètre de la fenêtre de 30 min ; la page d'accueil, l'API et le worker répondent.
- **Profil HTTPS** (`https-local.md`) : déjà rejoué à part le 19/11 au matin (pile isolée), pas dans ce lab.
- **Poste Windows réel** : le poste cible est un conteneur Linux (§ 7).
- **Mise à jour hors ligne** (§ 6 sur le poste cible) : seulement constatée (l'archive n'est pas un dépôt Git, L5), pas déroulée avec un second export.

## 7. Limites du lab

- Le poste cible est un conteneur Linux (Alpine) dans Docker Desktop, pas le poste Windows du PO, ni un Ubuntu nu. Le Docker-in-Docker ajoute une couche (`--privileged`, stockage dans un volume de la VM).
- Le poste « vierge » est simulé. Son Docker est déjà installé, ainsi que `bash`, coreutils et `curl` (prérequis du § 1). Rien n'a été installé hors ligne.
- Le build sur l'hôte a tout repris du cache. Ce n'est pas un premier build à froid : la durée de 26 min du § 4 n'est pas remesurée.
- Le lab tourne sous le nom de projet `qlab`, et non `edossier`. C'est le cas que le § 9 couvre : « le même `.env` des deux côtés ».

## 8. Nettoyage

À 10:14, tout ce que le lab avait créé est retiré :

- le conteneur `qlab-target` et le volume `qlab-target-docker` ;
- les images `qlab-api`, `qlab-seed`, `qlab-worker`, `qlab-migrate`, `qlab-frontend` et `qlab-host:27.5.1`, supprimées une à une par leur nom ;
- les fichiers de la clé simulée et du support du `.env`, supprimés nommément ;
- le `.env` du worktree, puis le worktree lui-même, avec `git worktree remove`.

`nginx:alpine`, `redis:7-alpine` et `postgres:15-alpine` restent sur l'hôte : ce sont des tags partagés, que le pull a mis à jour. Les conteneurs `edossier*`, `cfao-*`, `deploy-*` et `roadmapmentor-*` n'ont pas été touchés ; 17 d'entre eux tournent toujours. Il n'y a eu ni `prune` ni compactage du vhdx.

Après le nettoyage, le disque interne de la VM passe de 92,6 à 71,6 Go utilisés. Le C: libre (14,3 Go) bouge avec l'activité des autres sessions de l'hôte.
