# Fiche — installer la rc.1 sans Internet sur une machine simulée sans réseau (Q, 25/11)

**Décision du PO du 17/11** : pas de poste prêté. Q fait l'essai le mercredi 25/11 sur une machine simulée, selon son protocole validé par O (`gestion-projet/recette/checklist-installation-hors-ligne-25-11.md`, #244) : un conteneur `docker:27-dind` avec `bash` et `coreutils` ajoutés, lancé en `--network none`, 7 Go de mémoire et 2 CPU. Docker y est déjà : rien ne s'installe pendant l'essai, et tout ce qui suit vient de la clé.

Une page, tirée de `DOCS/exploitation/installation.md` (§ 1 à 9), `sauvegarde-restauration.md`, `https-local.md` et du « Retour arrière » des notes rc.1. Pas de secret ici : seulement des noms de variables. Les mots de passe des comptes sont ceux du jeu de démo et ne figurent pas ici.

## 1. Prérequis (vérifier avant de partir)

| Élément | Minimum | Contrôle |
|---|---|---|
| Système | conteneur `docker:27-dind` (#244, étape P 5) | `docker exec -it ged-offline bash` |
| Outils | `bash`, `sha256sum`, `tar` | `command -v bash sha256sum tar` |
| Docker | Engine ≥ 24 et `docker compose` v2 | `docker compose version` |
| Mémoire | 8 Go au guide ; 7 Go pour l'essai, écart assumé dans #244 | `free -m` côté WSL avant le lancement |
| Disque | 10 Go libres, plus la sauvegarde de démo | `df -h` |
| Réseau | **aucun** : le code et les images viennent de la clé (§ 2 a et b) | `ip route` sans route par défaut |
| Port | `8080` libre (sinon `APP_PORT`) ; `8443` pour le HTTPS | — |

Apporter sur clé : la sauvegarde de démo, **celle de la restauration n° 2 du 21/11**, la seule dont la restauration est vérifiée (décision de O du 17/11). Dossier `ged237-<à compléter le 21>/` (4 fichiers) ; empreinte de `db.dump` (`SHA256SUMS`) : `<à compléter le 21>`. Apporter aussi l'archive du code au tag (`ged237-code-v1.0.0-rc.1.tar.gz` et son `.sha256`, `installation.md` § 9), le dossier d'images (`images.tar.gz`, `IMAGES.txt`, `SHA256SUMS`), exporté **avec le profil `tls`** (`installation.md` § 9 : `build`, `pull --ignore-buildable` et `images_export.sh` avec `-f docker-compose.yml -f docker-compose.tls.yml --profile tls`), et le binaire `mkcert` (Linux amd64, avec son sha256), qui ne s'installe pas sans Internet.

## 2. Installer depuis le tag

a. Pas de clone : `sha256sum -c ged237-code-v1.0.0-rc.1.tar.gz.sha256` (sur la clé) doit afficher « OK », puis `tar -xzf <clé>/ged237-code-v1.0.0-rc.1.tar.gz -C ~` et `cd ~/GED237`. Garder le nom de dossier `GED237` : il donne le nom des volumes et des images.
b. `bash scripts/images_import.sh <clé>/ged237-images`, puis `docker compose config --images` doit lister exactement `IMAGES.txt`.
c. `cp .env.example .env`, puis renseigner `DB_PASSWORD` et `SECRET_KEY` (`openssl rand -hex 32`) **avant** le premier démarrage, et `APP_VERSION=1.0.0-rc.1`. Ne jamais copier `.env` ailleurs que sur ce poste.
d. Démarrer : `docker compose up -d --pull never --no-build`. Sans `--no-build`, compose reconstruit une image manquante d'un service à `build:`, et cette reconstruction échoue hors ligne sans nommer l'image.
e. `docker compose ps` : `api`, `postgres` et `redis` sont `healthy` ; `migrate` et `seed` sont `Exited (0)`.
f. `docker compose exec api printenv ENVIRONMENT` doit donner `development`. En rc.1, ne pas le changer : avec `production`, le code de connexion n'est ni affiché ni envoyé et personne ne peut se connecter (l'envoi par e-mail arrive en V1.1).

## 3. Restaurer la base de démo

1. `bash ops/restore.sh <clé>/ged237-<horodatage> --wipe`, puis répondre `oui`. La base créée par `seed` est écrasée ; les empreintes sont vérifiées avant tout écrasement (code 1 si la copie est altérée).
2. Attendu : code 0, et les comptages `tenants`, `users`, `documents` et `storage_files` égaux au `MANIFEST.txt` (code 2 au moindre écart).
3. `docker compose exec api alembic current` doit donner la révision `head`. Sinon : `docker compose run --rm migrate`.
4. HTTPS : `sha256sum -c` du binaire `mkcert` de la clé, puis `install -m 755 <clé>/mkcert /usr/local/bin/` ; à défaut, un certificat `openssl` auto-signé pour `localhost` et `127.0.0.1`. Ensuite `mkcert -install`, `mkcert -cert-file certs/tls.crt -key-file certs/tls.key localhost 127.0.0.1`, puis `TLS_CERT_DIR=./certs docker compose -f docker-compose.yml -f docker-compose.tls.yml --profile tls up -d --pull never --no-build`, puis `sh scripts/prove_tls.sh` (« OK »).

## 4. Contrôle en 5 minutes

| Contrôle | Geste | Attendu |
|---|---|---|
| Version | `curl -s http://localhost:8080/health` | `healthy`, version `1.0.0-rc.1` |
| Connexion | `https://localhost:8443`, `MINFI001`, « Étape Suivante », code pré-rempli, « Confirmer l'identité » | « Tableau de bord », menu d'administration complet |
| Dépôt | `MINFI002` : « Mes Documents » → « Nouveau Document », un PDF de moins de 1 Mo | document en **Brouillon** |
| Recherche | `MGR001` : mot-clé du jeu dans la barre de recherche | 3 résultats DAF en moins de 2 s |
| Cloisonnement | `MINFI001` : un terme présent seulement dans MINESUP | 0 résultat |

Ne se contrôlent pas sur la rc.1 : l'application d'authentification de l'administrateur (#193) et l'écran Corbeille (#181) arrivent après le 30/11.

## 5. Retour arrière

- **Données abîmées pendant la séance** : rejouer le § 3.1 avec la même sauvegarde.
- **Rendre le poste** : `docker compose down -v`, qui supprime les conteneurs et les volumes (base, fichiers) ; puis supprimer le dossier `GED237` (`.env` et `certs/` compris) et les images (`docker image rm`, liste dans `docker compose config --images`) ; enfin `mkcert -uninstall` si l'autorité locale a été installée pour la séance.
- **On ne descend pas les migrations à la main** : la restauration de la sauvegarde est le seul retour arrière garanti.
