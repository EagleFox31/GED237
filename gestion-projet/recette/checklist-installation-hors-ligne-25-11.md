# Checklist — essai d installation sans Internet (exigence 28 du CDC), mercredi 25/11 après le tag

Validé par l orchestrateur le 17/11, option Playwright incluse (2 h-s). Exécution : session CI/QA. Cocher chaque ligne et noter la durée.

Base : DOCS/exploitation/installation.md §9 (50215de), scripts/images_export.sh et images_import.sh.
Règle : une seule charge lourde (vérifier `docker ps` et les piles de B et F), rien de lourd avant le 25.

## P — Préparation sur poste connecté (après le tag TAG)
- [ ] 1. Créer un worktree propre au tag : `git worktree add ../GED237-offline-trial/GED237 TAG`. Le nom du dossier est fixe (§9 : nom du projet compose). `../GED237-offline` est déjà pris par un autre worktree, d où `GED237-offline-trial`.
- [ ] 2. `.env` du protocole d'installation de site : SECRET_KEY générée par `openssl rand -hex 32`, jamais affichée. Contrôles par compteur uniquement : les mêmes que E2 bis.
- [ ] 3. Images : `docker compose build`, puis `docker compose pull --ignore-buildable`, puis `IMAGES_DIR=../GED237-offline-trial/usb/ged237-images bash scripts/images_export.sh`.
- [ ] 4. Code source sur la « clé » : `git archive --prefix=GED237/ TAG | gzip > ../GED237-offline-trial/usb/ged237-src.tar.gz`, plus son sha256. Écart au guide : le §9 suppose le clone déjà présent sur la cible, voir la remarque à I.
- [ ] 5. Image « machine » : un Dockerfile de 2 lignes, `FROM docker:27-dind` puis `RUN apk add --no-cache bash coreutils curl`. Les scripts exigent bash, absent de l'image alpine, et `apk` ne marchera plus hors ligne.
- [ ] 6. Contrôle : `docker run --rm ged-offline-host docker compose version` doit répondre v2.

## M — Machine simulée sans réseau
```
docker run -d --name ged-offline --privileged --network none \
  --memory 7g --memory-swap 7g --cpus 2 \
  -v ged-offline-docker:/var/lib/docker \
  -v <abs>/GED237-offline/usb:/media/usb:ro \
  ged-offline-host
```
La somme des mem_limit de compose vaut 5,9 Go (migrate et seed sont ponctuels), pour 8 Go de RAM au prérequis du guide. 7 Go est un écart assumé, à vérifier par `free -m` côté WSL avant le lancement. Le réseau interne de compose fonctionne sans accès extérieur.

## E — Déroulé dans la machine (`docker exec -it ged-offline bash`), chronométré
- [ ] 1. **Réseau absent :**
   - `docker inspect -f '{{.HostConfig.NetworkMode}}' ged-offline` doit valoir `none` ;
   - `ip route` ne doit montrer aucune route par défaut ;
   - `curl -m5 https://github.com` et `curl -m5 https://pypi.org` doivent échouer.
- [ ] 2. **Aucune image au départ :** `docker images -q | wc -l` doit valoir 0.
- [ ] 3. **Code :** `sha256sum -c`, puis `tar xzf /media/usb/ged237-src.tar.gz -C /opt`, puis `cd /opt/GED237` et copie du `.env`.
- [ ] 4. **Import :** `bash scripts/images_import.sh /media/usb/ged237-images`, sortie conservée. Ensuite, `docker compose config --images` doit correspondre exactement à IMAGES.txt.
- [ ] 5. **Démarrage :** `docker compose up -d --pull never`, sans `--build`. Le `--pull never` prouve que rien n'est téléchargé.
- [ ] 6. **Vérifications §5 :**
   - `docker compose ps` : api, postgres et redis healthy ; migrate et seed Exited (0) ;
   - `docker compose exec api alembic current` doit donner head ;
   - dans api, `getent hosts pypi.org` doit échouer.
- [ ] 7. **Smoke fonctionnel en curl, sur http://localhost:8080 depuis la machine :**
   - front : `/` en 200, avec l'asset JS et la police `material-symbols-outlined.woff2` en 200 ;
   - connexion 2FA : login ; le code OTP est dans la réponse en development (rc.1) ; vérification, puis jeton ;
   - dépôt d'un document (multipart) en 201, relu par GET, puis présent dans la liste ;
   - OCR : statut traité par le worker en moins de N minutes, et recherche plein texte qui retrouve un mot du fichier.
- [ ] 8. **Smoke Playwright (retenu) :** smoke Playwright 45 dans la machine. Cela demande d'exporter aussi l'image e2e (`images_export.sh -f docker-compose.yml -f docker-compose.e2e.yml` : les arguments sont ceux de compose) et coûte environ 0,5 h-s de plus.
- [ ] 9. **Idempotence :** un second `images_import.sh` ne charge rien (preuve du §9).

## Preuves à archiver (gestion-projet/walkthrough, dossier daté)
- Sorties des étapes E1, E2, E4, E5, E6 et E7, avec codes HTTP et identifiants des images.
- Durée par étape.
- Aucun secret affiché : seuls les compteurs de E2 bis apparaissent.

## Démontage
`docker rm -f ged-offline`, puis `docker volume rm ged-offline-docker`, puis `git worktree remove ../GED237-offline-trial/GED237`. La « clé » est gardée jusqu'à la recette. Aucune autre pile n'est touchée.

## Durée estimée
- P : 0,5 h-s, dont environ 20 à 30 min de build et d'export.
- M + E : 0,75 h-s.
- Preuves et rapport : 0,25 h-s.
- **Total retenu : environ 2 h-s (Playwright compris).**

## Écarts relevés dans le guide (transmis à I le 17/11)
- [ ] 1. Le §9 suppose le code déjà cloné sur la cible. Hors ligne, il faut aussi apporter l'archive du code au tag (git archive avec un sha256), avec le même nom de dossier.
- [ ] 2. Les prérequis de la cible pour les scripts (bash, sha256sum) ne sont pas listés au §1.
- [ ] 3. Recommander `docker compose up -d --pull never` au §9 : en cas d'image manquante, l'échec est franc au lieu d'une tentative de téléchargement.
