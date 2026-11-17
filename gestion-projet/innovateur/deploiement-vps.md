# Déploiement de GED237 sur le VPS OVH — instruction

- **Pour** O, puis le PO, qui donne son accord avant toute écriture sur le VPS. B écrit le fichier de déploiement, Q mesure et rejoue la restauration. Innovateur, 17/11/2026.
- **Sert** :
  - l'item 27 du cahier des charges (HTTPS), avec un vrai certificat ;
  - l'item 28 (installation), parce que l'installation sur le VPS suit le chemin des images exportées, sans construction sur place.
- **Ne remplace pas** `empreinte-pile-rc1-vps.md` (17/11), dont il reprend les chiffres. `checklist-demo.md` § F dit « VPS écarté le 09/11 » : cela vaut pour la **démo du 30/11**, qui reste sur place. Le VPS est le **premier hébergement**, après la démo.
- **Règle de ce travail** : lecture seule sur le VPS. Aucune écriture, aucun conteneur lancé, aucun fichier Caddy créé. Tout ce qui suit est `Proposé`, et chaque écriture demande l'accord du PO.
- **Niveaux** : `Mesuré` = relevé en lecture seule le 17/11 à 21:09 ; `Vérifié` = lu dans le code de `main` 18a1018 ; `Déduit` = calculé ; `À mesurer` = attend une mesure de Q.

## 0. Ajout du 17/11, soir : ce qui existe déjà (#248) et deux phases

B a déjà écrit la surcouche, dans la **PR #248**, en brouillon post-rc1 (lot 12 de `plan-v1.1.md`) :
- `docker-compose.vps.yml` : projet `ged237-vps`, plafonds, `seed` réservé au profil `demo-seed`, `DB_PASSWORD` et `SECRET_KEY` obligatoires ;
- `DOCS/exploitation/installation.md` § 10 ;
- s'y ajoutent #267 (`nginx-vps.conf`, en-têtes de sécurité) et #268 (contrôle de la surcouche en CI).

Ce document s'aligne sur #248. Les écarts sont ci-dessous ; c'est **#248 qui fait foi pour la configuration**.

| Point | #248 | Ce document | À trancher |
|---|---|---|---|
| Accès | **VPN seulement** : nginx écoute sur `GED_BIND_ADDR`, une adresse du tunnel WireGuard. **Aucun site Caddy.** | site Caddy public (§ 3) | **Deux phases.** Phase 1 : VPN seulement, comme #248, jusqu'à la fusion de #154 et #212. Phase 2 : adresse publique en HTTPS par Caddy (§ 3), `GED_BIND_ADDR=127.0.0.1`. |
| `ENVIRONMENT` | non surchargé, donc `development` (code affiché à l'écran) | `production` | Phase 2 : B ajoute `ENVIRONMENT: production` à la surcouche (0,25 h-s). #212 refuse alors de démarrer sans canal d'envoi du code. |
| Worker | 1,2 Go | 1 Go | **la mesure du 18 tranche** ; garder 1,2 Go si la pointe dépasse 900 Mo et que la marge le permet |
| Contrôle préalable | `free -m` : **au moins 2,5 Go disponibles** | — | **Bloquant aujourd'hui** : 2 057 Mo disponibles (`Mesuré`). Soit on libère de la mémoire sur le VPS, soit on abaisse le seuil à 2,0 Go avec le worker à 1 Go. À trancher par B et O. |
| Port | `${GED_BIND_ADDR}:${APP_PORT:-8080}` | `127.0.0.1:8095` | 8080 est libre aussi (`Mesuré`). Garder la variable de #248 et choisir sa valeur à l'installation. |

Conséquence pour l'item 27 : en phase 1, le trafic est chiffré par le tunnel WireGuard, mais ce n'est pas du HTTPS. **L'item 27 sur le VPS n'est acquis qu'en phase 2.** Sur le poste, la preuve HTTPS du 20/11 (`docker-compose.tls.yml`) reste celle de la recette.

## 1. Ce qui reste libre sur le VPS (`Mesuré`, 17/11 21:09)

| Ressource | Total | Libre | Remarque |
|---|---|---|---|
| Mémoire | 3 819 Mo | **2 057 Mo disponibles** (même chiffre que le relevé de B : 2 049 Mo) | 15 conteneurs tournent. Les plus gros : WAHA et son bot (≈ 380 Mo), deploy-app (147 Mo), precis-translation (≈ 140 Mo). |
| Swap | 2 047 Mo | 744 Mo | **1 303 Mo déjà utilisés** : le VPS est déjà serré, la pile GED237 ne doit pas swapper. |
| Processeur | 2 vCPU | charge 1,49 au relevé (0,3 à 0,5 en moyenne sur 5 et 15 min) | Les autres services sont calmes. |
| Disque | 38 Go | **12 Go** | Cache de build récupérable : 1,9 Go. Il y a aussi d'anciennes archives `fleet-*.tgz` dans le dossier personnel, à trier avec l'utilisateur. |
| Ports locaux pris | — | — | 2019, 3000, 3001, 5000, 8081, 8090, 8787, 8790, 8791, 8792, 51821. **8095 est libre.** |
| Caddy | service systemd | — | Sites existants : un gestionnaire de comptes, `loveink-mailer`, `precis-translator`, `trigenys-sign`, `vpn-manager`, `vpn`, et `casino-de-la-reine` (désactivé le 16/11). Aucun `ged237`. |
| Tâches planifiées | — | — | La sauvegarde de fleet tourne chaque nuit à 02:30. |

## 2. Ce que demande la pile GED237

**Services réels** (`docker-compose.yml`, `Vérifié`) : api, worker (OCR), postgres, redis, frontend et nginx, plus `migrate` et `seed`, qui ne tournent qu'un moment. **Il n'y a pas de MinIO** : les fichiers vont dans le volume local `storage_data`. Le mode S3 existe dans le code, mais il ne sert pas ici et n'ajoute aucun conteneur.

### 2.1 Plafonds proposés (fichier `docker-compose.vps.yml`, à écrire par B)

| Service | Plafond actuel | **Plafond VPS proposé** | Au repos | Pointe | Réglage de déploiement |
|---|---|---|---|---|---|
| api | 1 Go, 1,5 CPU, `--reload` | **512 Mo, 1 CPU**, sans swap | 233 Mo (`Mesuré` en local) | `À mesurer` | sans `--reload` ; `ENVIRONMENT=production` |
| worker (OCR) | 2 Go, 2 CPU, `--concurrency=2` | **1 Go, 1 CPU, sans swap**, `--concurrency=1` | `À mesurer` | **`À mesurer` le 18 à 22:15** (Q, banc Tesseract et RapidOCR : 1 Go sans swap, 1,5 CPU) | Avec 1 CPU au plus, l'OCR laisse toujours un vCPU aux autres services. |
| postgres | 768 Mo | **384 Mo, 0,5 CPU** | 50 Mo | grandit avec la base | même plafond que `deploy-db-prod-1` |
| redis | 192 Mo | **64 Mo, 0,25 CPU** | 16 Mo | — | — |
| frontend | 768 Mo, serveur Vite de développement | **64 Mo, 0,25 CPU** | `À mesurer` (fichiers statiques) | — | cible `production` du `frontend/Dockerfile` (nginx et fichiers construits, `Vérifié`) |
| nginx | 64 Mo | **64 Mo, 0,25 CPU** | 14 Mo | — | port publié **`127.0.0.1:8095`** seulement (§ 3) |
| migrate | — | 512 Mo, ponctuel | — | — | à chaque mise à jour, puis s'arrête |
| seed | — | **non lancé** (`--scale seed=0`) | — | — | comptes réels créés à la main (`donnees-demo.md`, « Plateforme vide ») |
| **Total** | 4,8 Go | **≈ 2,1 Go de plafonds** | **≈ 0,5 Go** (`Déduit`) | **≈ 1,5 Go pendant un OCR** (`Déduit`) | — |

**Sans swap** (`memswap_limit` égal à `mem_limit`) : si le worker dépasse son plafond, c'est lui qui est arrêté et relancé par Docker. Les autres services du VPS ne sont pas poussés dans le swap. Un document en cours d'OCR est alors repris ou marqué en erreur, et c'est ce que la mesure du 18 doit montrer.

### 2.2 Verdict mémoire (`Déduit`, à confirmer le 18)

- Si tout le monde touchait son plafond en même temps, la pile prendrait 2,1 Go, alors que 2 057 Mo sont libres. Ça ne tient pas, mais ce cas n'arrive pas : postgres, redis, nginx et frontend restent très en dessous de leur plafond.
- Usage réaliste : 0,5 Go au repos, 1,5 Go pendant un OCR. **Il reste donc ≈ 0,5 Go de marge pendant un OCR**, sans swap.
- **Condition** : la mesure de Q du 18 doit donner une pointe du worker ≤ 900 Mo avec la configuration retenue. Au-delà, appliquer le plan B (§ 6).

### 2.3 Disque (`Déduit`)

| Poste | Taille |
|---|---|
| Images : api et worker (3,2 Go), frontend de production (≈ 0,05 Go), postgres, redis et nginx (≈ 0,3 Go) | ≈ 3,6 Go |
| Archive d'images pendant l'installation (`images.tar.gz`), supprimée ensuite | plusieurs Go, ponctuel |
| Données : base et fichiers du jeu de démo | < 1 Go au départ |
| Sauvegardes : 7 gardées sur le VPS (§ 5) | 7 × la taille des données |
| **Total au départ** | **≈ 5 Go sur 12 libres**, et 7 Go pendant l'installation |

On ne construit pas les images sur le VPS : PyTorch y demanderait de la mémoire et du disque en plus. Elles sont construites sur un poste, exportées par `scripts/images_export.sh`, puis chargées sur le VPS. C'est le même chemin que l'essai d'installation hors ligne du 25/11 (item 28).

## 3. HTTPS : `/etc/caddy/sites/ged237.caddy` (contenu proposé, **non créé**)

Le modèle est celui de `trigenys-sign.caddy` (`Mesuré`) : un bloc par site, un reverse proxy vers un port local, rien d'autre. **Aucun site existant n'est touché.** Le `Caddyfile` importe déjà `sites/*.caddy`, donc un fichier ajouté suffit.

```caddy
# GED237 — reverse proxy vers le nginx de la pile (port local uniquement)
<nom-de-domaine> {
	encode zstd gzip
	request_body {
		max_size 101MB
	}
	# Accès restreint tant que #154 et #212 ne sont pas livrés (§ 4)
	@hors_liste not remote_ip <plages autorisées>
	respond @hors_liste 403
	reverse_proxy 127.0.0.1:8095
}
```

| Point | Décision |
|---|---|
| Nom de domaine | **À choisir par le PO** (par exemple un sous-domaine de trigenys.com). Il faut un enregistrement DNS A vers 15.235.90.215 avant de recharger Caddy : Caddy obtient alors seul un certificat Let's Encrypt. |
| Port | `APP_PORT=127.0.0.1:8095` : nginx n'écoute que sur la boucle locale. Les ports publiés par Docker passent outre le pare-feu, donc ne jamais publier `8095` sans `127.0.0.1`. |
| Taille | 101 Mo, comme `client_max_body_size 101M` de nginx et `MAX_UPLOAD_SIZE` (100 Mio) : le refus se fait dans l'application, avec un message clair. |
| En-têtes | La CSP et les autres en-têtes de sécurité sont posés par le nginx de la pile (#267). Caddy n'en ajoute pas, pour ne pas les doubler. |
| `ALLOWED_ORIGINS` | à mettre à `https://<nom-de-domaine>` dans l'environnement de l'api |
| Mise en service | `sudo caddy validate --config /etc/caddy/Caddyfile`, puis `sudo systemctl reload caddy`. Un rechargement ne coupe pas les autres sites ; s'il échoue, Caddy garde l'ancienne configuration. **Avec l'accord du PO.** |
| Retour arrière | supprimer le fichier, puis `validate` et `reload` |

## 4. Sécurité : condition pour ouvrir l'adresse

Reprise du § 4 de l'empreinte, toujours vrai sur `main` :
- `ENVIRONMENT: development` est **écrit en dur** dans `docker-compose.yml` (`Vérifié`), et ce mode affiche le code de connexion à l'écran ;
- `SECRET_KEY` a une valeur par défaut connue de tous ;
- la page de connexion affiche les comptes de démonstration.

| Avant l'ouverture | Qui |
|---|---|
| `docker-compose.vps.yml` remplace `ENVIRONMENT` par `production` et exige un `SECRET_KEY` propre au VPS, dans un `.env` hors dépôt, droits 600. #268 rend `SECRET_KEY` obligatoire (V1.1). | B |
| Envoi du code par e-mail (#154) et garde de démarrage (#212) : sans eux, la double authentification ne protège rien. | V1.1 |
| D'ici là : accès réservé à une **liste d'adresses** (`<plages autorisées>` du § 3 : réseau du ministère, adresse du PO), ou au **VPN** déjà en place (wg-easy). | O choisit, PO valide |
| VPN : quand un client vise l'adresse publique du VPS, sa requête passe-t-elle par le tunnel, et Caddy voit-il alors l'adresse du VPN ? `À vérifier` par B sur un poste client, avant de choisir le VPN. | B |

## 5. Sauvegarde et restauration (protocole du 21/11)

Ce sont les mêmes scripts et le même protocole que la restauration n° 2 du 21/11 (`checklist-recette-20-23-11.md`, ligne 1.3), sur la base de `sauvegarde-restauration.md` § 6.

| Étape | Commande, ou règle | Preuve |
|---|---|---|
| Sauvegarde | `bash ops/backup.sh` → `backups/ged237-<UTC>/` (`db.dump`, `storage.tar.gz`, `SHA256SUMS`, `MANIFEST.txt`) ; api et worker arrêtés 1 à 2 min | `sha256sum -c SHA256SUMS` sans erreur |
| Fréquence | chaque nuit à **03:15**, pour ne pas chevaucher fleet (02:30) ; une tâche cron de l'utilisateur ubuntu, **avec l'accord du PO** | `backups/backup.log` |
| Rotation | pas de rotation dans les scripts V1 (V1.1, `sauvegarde-restauration.md` § 3.1) : on garde les 7 dernières par un `find … -mtime +7` dans la même tâche cron | nombre de dossiers ≤ 8 |
| Copie hors du VPS | chaque semaine, `scp -r` du dernier dossier vers un poste du ministère : **une sauvegarde qui reste sur le VPS ne protège pas d'une perte du VPS** | dossier daté sur le poste |
| Restauration | **jamais sur le VPS** pour l'exercice, faute de mémoire pour une seconde pile. Elle se fait sur un poste, comme le 21/11 : `bash ops/restore.sh backups/ged237-<horodatage> --wipe`, puis `alembic current` et `/health`, puis un second passage sur le même dossier (aucun écart). C'est aussi le scénario réel : un VPS perdu se reconstruit ailleurs. | `restauration-vps-<date>.txt` |
| Critères | C7 : sauvegarde en moins de 5 min ; restauration en moins de 10 min ; `count(*)` et nombre de fichiers égaux au `MANIFEST.txt` | — |

## 6. Risques, et que faire si la mémoire ne suffit pas

| # | Risque | Signal | Parade |
|---|---|---|---|
| 1 | La pointe OCR dépasse 900 Mo | mesure du 18 | plan B, ci-dessous |
| 2 | Un import en masse s'éternise (un seul OCR à la fois) | file Celery qui grossit | importer hors des heures de bureau ; ou plan B 2 |
| 3 | Un autre service du VPS grossit (WAHA) | `free -m` < 400 Mo disponibles | plafonds sur les conteneurs sans limite : WAHA, son bot, eli-bot, sign et mailer sont plafonnés à 3,73 Go, c'est-à-dire sans limite (`Mesuré`). À proposer à leurs propriétaires ; hors GED237 |
| 4 | Le disque se remplit avec les sauvegardes | `df -h` < 3 Go libres | rotation à 7, purge du cache de build (1,9 Go), tri des archives `fleet-*.tgz`, avec l'accord de l'utilisateur |
| 5 | Une erreur dans le fichier Caddy coupe les autres sites | `caddy validate` en échec | `validate` avant `reload` ; un `reload` en échec garde l'ancienne configuration |
| 6 | Adresse ouverte avec le mode développement | code affiché à l'écran | § 4 : liste d'adresses ou VPN tant que #154 et #212 ne sont pas livrés |

**Plan B, si la mémoire ne suffit pas** (dans l'ordre) :
1. **Worker plus petit** : `--concurrency=1` est déjà pris. Ensuite, l'image mince de B (Tesseract et RapidOCR, sans PyTorch) si le banc du 18 la valide. Son passage en production est une décision de B, pas de ce document.
2. **Pas d'OCR sur le VPS** : le worker est arrêté (`--scale worker=0`). L'import et l'OCR se font sur un poste, puis la base et les fichiers arrivent par `backup.sh` et `restore.sh`. C'est déjà la méthode de la démo (pré-OCRisation). Contrepartie : un document déposé sur le VPS n'est pas lisible par la recherche plein texte tant qu'il n'est pas passé par un poste.
3. **Plus de mémoire** : un VPS de 8 Go. OVH ne publie pas de prix pour ce modèle sur ses pages (`À vérifier` sur le configurateur) ; ses pages françaises affichent ≈ 8,65 € TTC par mois pour 4 Go et ≈ 23,95 € TTC pour 24 Go, et annoncent une hausse des prix de la mémoire. Ou un serveur du ministère.

## 7. Ordre de mise en service (chaque étape après l'accord du PO)

| Phase | # | Étape | Qui | Déjà au plan V1.1 ? | Nouveau (h-s) |
|---|---|---|---|---|---|
| 1 | 1 | Mesure OCR du 18 à 22:15 (le PO l'a acceptée pour cette seule mesure) | Q, B | oui (question 14) | — |
| 1 | 2 | Fusion de #248, #267 et #268 ; seuil du contrôle préalable et plafond du worker réglés d'après la mesure (§ 0) | B | oui, lot 12 (B 0,25) | — |
| 1 | 3 | Installation par VPN (`installation.md` § 10) : export des images, copie, chargement, `up -d`, `migrate`, comptes réels créés à la main | B | non | B 0,5 |
| 1 | 4 | Une heure de mesure pendant un import réel (`free -m`, `docker stats`), avant d'ouvrir à des agents | Q | oui, lot 12 (Q 1,5) | — |
| 1 | 5 | Tâche cron de sauvegarde, puis première restauration sur un poste (§ 5) | B, Q | non | B 0,25, Q 0,25 |
| 2 | 6 | Après la fusion de #154 et #212 : `ENVIRONMENT: production` dans la surcouche, `GED_BIND_ADDR=127.0.0.1` | B | non | B 0,25 |
| 2 | 7 | DNS, fichier `ged237.caddy`, `validate`, `reload` ; contrôle HTTPS (`prove_tls.sh` adapté au nom de domaine) | B, Q | non | B 0,25, Q 0,25 |
| | | **Hors plan V1.1** | | | **≈ 1,75 h-s (B 1,25, Q 0,5)** |

Décisions du PO avant la phase 1 : accord pour l'installation et la tâche cron. Avant la phase 2 : nom de domaine, et ouverture publique ou liste d'adresses.

**Décision de O (17/11, 22:30, ticket #288)** : la phase 1 reste en V1.1, et le serveur e-mail à l'écran (lot 8a) sort en V1.2 pour la compenser. La phase 2 passe en V1.2 ; elle revient en V1.1 seulement si #154 et #212 sont fusionnés avant le 01/12.

Le moment se décide après le tag du 24/11 et la démo du 30/11. Rien ne se fait sur le VPS avant.

## Sources

- Relevé du VPS en lecture seule, 17/11 21:09 : `free -m`, `df -h`, `nproc`, `uptime`, `ls /etc/caddy/sites`, `ss -ltn`, `docker stats --no-stream`, `docker system df`, `crontab -l`.
- `docker-compose.yml`, `docker-compose.tls.yml`, `frontend/Dockerfile` et `nginx/app-locations.conf` sur `main` 18a1018.
- `empreinte-pile-rc1-vps.md`, `sauvegarde-restauration.md` § 6, et `checklist-recette-20-23-11.md` ligne 1.3.
- Prix OVH : pages VPS d'ovhcloud.com/fr, consultées le 17/11. Le prix du modèle 8 Go n'y est pas affiché.
