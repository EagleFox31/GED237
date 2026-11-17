# Protocole : preuve d'installation sur site (item 28 du CDC)

- **Pour** : Q (exécute), B (corrige si un écart touche le code), O (planifie, porte la décision au PO). Innovateur, 2026-11-17, sur `main` c216141. Rang 6 du carnet `carnet-suite-fonctionnalites.md`, lancé par O le 17/11.
- **Exigence** : item 28 « Déploiement on-site + démo VPS », `non vérifiable` à l'audit du 9/11 (`gestion-projet/walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md` l. 40). Le VPS a été écarté le 9/11 ; ce protocole remplace la démo VPS par une installation rejouée sur un poste vierge.
- **Cadre** : on suit `DOCS/exploitation/installation.md` **tel qu'il est écrit**. Tout geste absent du manuel est un écart, noté dans la grille (§ 4). Docker seulement, plafonds de mémoire et de CPU du compose conservés. `Vérifié` = lu dans `main` ou dans le dossier de Q ; `Déduit` = raisonnement ; `Proposé` = à valider par O.

## 0. Ce que la preuve doit établir

Une personne qui n'a jamais vu GED237 installe l'application à partir du manuel seul, sur une machine où rien de GED237 n'existe, et arrive à l'écran de connexion puis au tableau de bord. On mesure combien de temps cela prend, et on note tout ce que le manuel ne dit pas.

## 1. Deux postes

| Poste | Système | Voie du manuel | Quand | Exécutant |
|---|---|---|---|---|
| **P1, Windows** | Windows 11 + WSL 2, distribution Ubuntu 24.04 neuve et jetable | § 2 à § 5 en ligne (`build` depuis Internet) | **18/11, 07:30–10:30**, déjà planifié par Q | Q, avec son script `wsl-proof.sh` (**Adopt**) |
| **P2, Ubuntu** | Ubuntu 24.04 installé à neuf, sans WSL ni autre pile Docker | § 9 **sans Internet** (images sur clé USB), puis § 5 à § 7 et un redémarrage | après la fusion de #154 et du garde-fou de B (empilé sur #154, après le tag du 24), sur le premier tag qui les contient | Q |

**P1 reprend la preuve WSL de Q** (`GED237-c6/wsl-proof/CHECKLIST.md`, `Vérifié`). Elle tient pour l'item 28 si les compléments du § 3 sont faits, notamment la connexion : la phase `verify` du script contrôle `/health`, `alembic current`, `/` et `/api/docs`, mais pas la connexion au tableau de bord (`Vérifié`, `wsl-proof.sh` l. 135-138).

**Pourquoi P2 passe par la voie hors ligne** : sur site, l'accès à Internet n'est pas garanti, et le premier `build` télécharge environ 180 Mo de paquets PyTorch (manuel § 9). La voie de la clé USB est donc la plus probable chez le client, et elle n'a jamais été rejouée sur une machine neuve (`Déduit` : aucune trace dans `gestion-projet/recette/`).

**Machine de P2 : Décision O.**
- Le VPS est exclu : 3,7 Go de RAM, sous les 8 Go du manuel (§ 1).
- Ce PC est exclu : la VM WSL est déjà partagée avec Docker Desktop, et la règle de RAM de Q donnait 631 Mo de marge le 17 à 09:27.
- `academy-server` : **injoignable depuis ce PC le 17/11 à 11:08**. SSH a expiré et le ping n'a obtenu aucune réponse. Le serveur est sur 192.168.10.x, alors que ce PC est sur 192.168.1.x : il faut être sur le réseau de l'académie. Système et mémoire restent `À vérifier`, en lecture seule, depuis ce réseau.
- Repli retenu par O : un poste prêté par le PO. **Remplacé le 17/11** : le PO ne prête pas de poste. Q fait l'essai le 25/11 sur une machine simulée sans réseau (une VM sans carte réseau, ou réseau coupé après la copie des fichiers), avec Ubuntu 24.04 neuf, au moins 8 Go de RAM libres et au moins 10 Go de disque libres (manuel § 1).

## 2. Poste vierge : contrôles avant de commencer

| Contrôle | Attendu | Commande |
|---|---|---|
| Système | Ubuntu 24.04 (P1 : distribution créée pour la preuve ; P2 : installation neuve) | `lsb_release -d` |
| Docker | Engine ≥ 24 et `docker compose` v2, seuls logiciels ajoutés (prérequis du manuel § 1) | `docker version`, `docker compose version` |
| Rien de GED237 | aucun clone, aucune image, aucun volume, aucun conteneur `edossier_*` | `docker images`, `docker volume ls`, `docker ps -a` |
| Mémoire | ≥ 8 Go libres (manuel § 1) ; P1 suit la règle de RAM de O du 17/11 | `free -m` |
| Disque | ≥ 10 Go libres (manuel § 1), plus la taille de la clé pour P2 | `df -h` |
| Port | `8080` libre (P1 : `8180`, déjà noté par Q comme écart) | `ss -ltn` |
| Version | P1 : SHA de `main` noté ; P2 : tag `v1.0.0-rc.1` | `git rev-parse --short HEAD` |

## 3. Étapes chronométrées

Deux temps par étape :
- **machine** : de la commande au retour de la main ;
- **opérateur** : le temps où la personne lit, tape ou décide.

On relève l'heure de début et de fin de chaque étape.

| # | Étape (§ du manuel) | P1 | P2 | Fin d'étape |
|---|---|---|---|---|
| E1 | Récupérer le code (§ 2) | `git clone` | clone copié depuis la clé, ou `git clone` si le site a un accès ; `git checkout v1.0.0-rc.1` | dossier présent, SHA noté |
| E2 | Configurer (§ 3) | `.env` : `DB_PASSWORD`, `SECRET_KEY`, `APP_PORT`, `APP_VERSION` | idem | `.env` rempli ; **aucune valeur recopiée dans le relevé** |
| E2 bis | Contrôler la clé (§ 3, l. 40) | `SECRET_KEY` générée par `openssl rand -hex 32`, et égale à aucun défaut connu | idem | contrôles de la clé ci-dessous réussis, avant E4 ; seuls les **compteurs** vont dans le relevé |
| E3 | Charger les images (§ 9) | — | `images_import.sh` depuis la clé, puis `docker compose config --images` | liste identique à `IMAGES.txt` |
| E4 | Démarrer (§ 4) | `docker compose up -d --build` | `docker compose up -d` (sans `--build`) | `migrate` et `seed` en `Exited (0)` |
| E5 | Vérifier (§ 5), **cinq contrôles** | les cinq, dont la **connexion** avec un compte de démonstration (identifiant seul dans le relevé) | idem | tableau de bord affiché après le code |
| E6 | Sauvegarder (§ 7) | `bash ops/backup.sh` | idem | dossier `ged237-<horodatage>` créé |
| E7 | Redémarrer la machine | — (pas de `wsl --shutdown`, interdit par Q) | redémarrage complet, **aucune commande** ensuite | tableau de bord accessible |
| E8 | Désinstaller (§ 7) | `docker compose down -v`, puis le teardown de Q | `docker compose down -v` | aucun volume ni conteneur GED237 |

### Contrôle de la clé (E2 bis), décision O du 17/11

**Pourquoi** : le compose et le code n'ont pas le même défaut de `SECRET_KEY`. Le compose utilise `dev-secret-key-change-in-production` (`docker-compose.yml` l. 70, 96, 134), le code `dev-secret-key-change-this-in-production` (`config.py` l. 46). Le contrôle au démarrage (`config.py` l. 226-235) ne compare qu'à la seconde valeur, et seulement en `production`. Si le `.env` n'a pas de clé, l'API démarre donc sans erreur et signe les jetons avec une clé publique (`Vérifié`, `inventaire-environment-production.md` n° 3 et 4). En rc.1, le code ne change pas : la vérification se fait sur le terrain.

**Étape** : la `SECRET_KEY` du `.env` est générée par `openssl rand -hex 32` (`DOCS/exploitation/installation.md` l. 40) et ne vaut aucun des défauts connus.

**Commandes** (à la racine du dépôt). Elles n'affichent que des compteurs, **jamais la valeur** :

```bash
# 1. Aucun défaut connu, ni valeur vide : doit afficher 0
grep -c -E '^SECRET_KEY=(dev-secret-key-change-in-production|dev-secret-key-change-this-in-production)?$' .env

# 2. Une seule ligne, au format de openssl rand -hex 32 (64 caractères hexadécimaux) : doit afficher 1
grep -c -E '^SECRET_KEY=[0-9a-f]{64}$' .env

# 3. Après E4, la valeur réellement reçue par l'API : doit afficher OK
docker compose exec -T api sh -c 'case "$SECRET_KEY" in ""|dev-secret-key-*) echo DEFAUT;; *) echo OK;; esac'
```

Les contrôles 1 et 2 sont tous deux nécessaires. Si la ligne `SECRET_KEY` manque dans le `.env`, le contrôle 1 affiche aussi 0, mais le compose applique alors son défaut. Seul le contrôle 2 le détecte. Les contrôles 1 et 2 supposent un `.env` en fins de ligne LF : un `.env` édité sous Windows (CRLF) fait échouer le contrôle 2 par erreur, il faut alors le convertir avec `sed -i 's/\r$//' .env`. Les trois commandes ont été testées le 17/11 sur des `.env` d'essai : clé générée, défaut du compose, valeur vide, ligne absente. Chaque fois, le résultat attendu a été obtenu.

**Si un contrôle échoue** : ne pas démarrer, ou arrêter la pile avec `docker compose down`, sans `-v`. Régénérer la clé, puis reprendre à E4. L'écart est **bloquant** pour le poste ; il est noté dans la grille du § 4 sans la valeur.

**Secret TOTP (#193, si fusionnée)** : sans `TOTP_ENCRYPTION_KEYS`, la clé qui chiffre les secrets TOTP est **dérivée de `SECRET_KEY`** (`Vérifié` sur le diff de #193). Changer la `SECRET_KEY` après l'enrôlement oblige donc chaque administrateur à **se ré-enrôler**. Il faut fixer la clé définitive **avant** le premier enrôlement, et ne plus y toucher ensuite.

### Préparation de la démo du 30/11

Le contrôle de la clé s'applique aussi au poste de démo, à la mise en place de la pile, avant tout enrôlement TOTP.
- Les contrôles 1 à 3 doivent réussir (0, 1, OK). Ils figurent dans la liste de préparation de la démo, sans la valeur.
- La démo tourne en `development` (décision O du 17/11), et le contrôle du code n'y est pas actif : ce contrôle manuel est le seul garde-fou.
- Si la clé est changée la veille, les jetons en cours sont invalidés (nouvelle connexion) et, avec #193, les comptes enrôlés doivent se ré-enrôler. Il faut donc la fixer au plus tard **avant la répétition générale**.

Point à observer en E7 : `frontend` n'a pas de politique `restart` dans `docker-compose.yml`, alors que les cinq autres services permanents (`postgres`, `redis`, `api`, `worker`, `nginx`) ont `unless-stopped` (`Vérifié`). Sans cette politique, après un redémarrage, nginx répondrait mais l'application ne s'afficherait pas. O l'a confirmé (l. 203) et le fait corriger **en rc.1, avant le gel** : B ouvre une PR courte avec un test de garde. P2, qui tourne sur le tag, ne devrait donc plus le voir. E7 reste dans le protocole pour le prouver ; s'il échoue malgré tout, c'est un écart **bloquant**.

## 4. Grille des écarts

Un écart = tout geste ou toute information dont l'opérateur a eu besoin et que le manuel ne donne pas, ou une consigne du manuel qui ne marche pas telle quelle.

| # | Poste | Étape (§) | Constat | Contournement utilisé | Gravité | Suite (PR du manuel ou correctif, porteur) |
|---|---|---|---|---|---|---|
| 1 | P1 | E2 (§ 3) | port 8080 pris par la pile de la sonde C6 | `APP_PORT=8180` | mineur (prévu par le manuel) | aucune |
| 2 | P1 | § 2 du protocole | exécution en root (distribution créée sans utilisateur) | — | mineur | aucune |
| 3 | P1 | E4 | si `RAM_MODE=soft` : plafonds réduits par un fichier `override` | `docker-compose.override.yml` de Q | **majeur** si utilisé (le manuel n'est plus suivi tel quel) | noter le pic de RAM ; pas de modification du manuel |
| 4 | P1, P2 | E4 (§ 4) | `frontend` en cible `development` (serveur Vite) dans le compose de site | — | majeur, ligne « produit », hors § 5 | build statique servi par nginx, à instruire après le 30 (B) |
| 5 | P1 | E5 (§ 5) | code de connexion prérempli à l'écran : `ENVIRONMENT: development` en dur dans `docker-compose.yml` (l. 141), aucun envoi en rc.1 | — | limite connue de la rc.1, inscrite dans ses notes ; pas un écart de P1 | B après le tag, empilé sur #154 : `ENVIRONMENT` réglable, garde-fou au démarrage en production sans canal d'envoi, § du manuel ; contrôlé par la condition 7 sur P2 |
| … | | | | | | |

Les lignes 1 à 3 viennent de la CHECKLIST de Q (`Vérifié`). Docker installé par les paquets Ubuntu n'est pas un écart : c'est un prérequis du manuel.

**Gravité** :
- **bloquant** : sans le contournement, l'installation n'aboutit pas, ou le contournement exige de lire le code ou d'appeler l'équipe ;
- **majeur** : l'installation aboutit, mais au prix d'un geste qu'un exploitant ne trouverait pas seul en moins de 10 minutes ;
- **mineur** : le manuel donne déjà la parade, ou la gêne est de forme.

## 5. Critère réussi / échoué (`Proposé`, chiffré)

Un poste est **réussi** si les six conditions tiennent, et pour P2 la septième aussi :

1. **0 écart bloquant.**
2. **Au plus 2 écarts majeurs**, chacun avec une PR du manuel ou un correctif ouvert dans les 48 h.
3. **5 contrôles sur 5** au § 5, dont la connexion au tableau de bord.
4. **Durée de E1 à E5** :
   - P1 (en ligne, `build` compris) : **≤ 60 min** de temps machine ;
   - P2 (hors ligne) : **≤ 20 min**.
5. **Temps opérateur de E1 à E5 ≤ 20 min** sur chaque poste.
6. **E6 réussie** (sauvegarde créée) ; et pour P2, **E7** : tableau de bord accessible **≤ 5 min** après le redémarrage, sans aucune commande.
7. **P2 seulement, bloquant** (demande de O, 17/11) : à E5, **le code de connexion n'apparaît pas à l'écran et arrive par e-mail**. Si le code s'affiche, ou si aucun e-mail n'arrive, P2 est échoué, même si tout le reste est réussi. P2 suppose donc #154 fusionnée et le garde-fou de B en place.

Il est **échoué** sinon. La condition qui manque est alors nommée dans le relevé.

| Résultat | Item 28 |
|---|---|
| P1 et P2 réussis | `fait`, avec la décision du PO du § 7 |
| Un seul poste réussi | `partiel` : le poste et la condition manquante sont nommés |
| Aucun | reste `non vérifiable` ; incident consigné dans `DOCS/engineering/lessons-learned.md` |

Pourquoi ces seuils :
- **60 min** : le manuel annonce « plusieurs minutes » de premier `build`. Le seuil de Q tolère déjà 15 min, après le `build`, avant que `api`, `postgres` et `redis` soient `healthy`. Le reste couvre le téléchargement des images.
- **20 min hors ligne** : sans `build`, le manuel annonce moins d'une minute de démarrage. Le reste couvre le chargement de plusieurs Go depuis la clé.
- **20 min d'opérateur** : c'est ce qu'un exploitant peut faire pendant une visite sans immobiliser le site.

## 6. Sortie

- Un relevé par poste : `gestion-projet/recette/installation-site-P1-AAAA-MM-JJ.txt` et `…-P2-…`.
- Contenu : SHA ou tag ; contrôles du § 2 ; tableau E1 à E8 avec les deux temps ; pic de RAM (P1 : `ram.tsv` de Q) ; grille du § 4 ; verdict du § 5.
- Ni mot de passe, ni contenu de `.env`, ni jeton.

## 7. Décision du PO

Phrase à faire valider par le PO, portée par O :

> **L'installation sur site est acceptée comme preuve à la place du VPS** pour l'item 28 du CDC, sur la base des relevés P1 (Windows 11 + WSL 2) et P2 (Ubuntu 24.04, hors ligne), selon le critère du § 5 de `protocole-installation-site.md`.

Si le PO refuse, l'item 28 reste `non vérifiable` jusqu'à une démo sur un serveur d'au moins 8 Go de RAM.

## 8. Hors champ, coût et risques

- **Hors champ** :
  - Docker Desktop sous Windows : ce PC ne peut pas servir de poste vierge, car Docker Desktop y héberge d'autres piles. Le manuel ne l'exige pas.
  - HTTPS local (`https-local.md`).
  - Mise à jour (§ 6), à rejouer avec la rc.2 si elle existe.
- **Écart à instruire après le 30** (constat de O, 17/11) : sur site, le service `frontend` tourne avec la cible `development`, c'est-à-dire le serveur Vite avec le dossier source monté (`Vérifié` l. 203-217). Pour un site, il faudrait un build statique servi par nginx. **Rien ne change avant le 30.** Ce n'est pas un écart au manuel : le relevé l'inscrit dans la grille du § 4 comme ligne « produit » (gravité majeure, sans contournement), sans en faire une condition du § 5.
- **Coût** : I ≈ 1 h-s (ce protocole). Q ≈ 2 h-s : compléments de P1 le 18 ≈ 0,5 ; P2 ≈ 1,5, sans compter le temps machine. B ≈ 0,5 h-s par écart majeur ou bloquant.
- **Reuse-first** :
  - **Adopt** : `wsl-proof.sh` et la CHECKLIST de Q pour P1, et `images_export.sh` / `images_import.sh` pour P2.
  - **Learn** (non retenu) : Ansible ou cloud-init pour automatiser P2. La preuve porte justement sur le manuel lu par une personne ; automatiser la masquerait.
