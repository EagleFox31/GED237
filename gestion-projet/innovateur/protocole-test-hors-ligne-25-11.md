# Protocole du test hors ligne (25/11)

- **Exécution** : Q. Rédaction : innovateur, 18/11, relu par Q et O.
- **Version testée** : le tag du 24/11 (nom et SHA notés au moment de l'exécution). S'il n'y a pas de tag, noter « `main` à `<SHA>` ».
- **Poste** : celui de démonstration, qui est aussi celui où Q exécute (`À vérifier` : confirmation du PO). Si un autre poste est retenu, quelqu'un doit être sur place pour l'exécuter.
- **But** : prouver que la démo du 30/11 se joue en entier sans Internet, dans le navigateur, sur le vrai poste.
- **Ne remplace pas** `gestion-projet/recette/checklist-installation-hors-ligne-25-11.md` (exigence 28, machine simulée, contrôles en `curl`). Ordre le 25/11 : la check-list d'abord, son démontage, puis ce protocole. **Une seule charge lourde à la fois.**
- Aucun mot de passe, aucun code et aucune clé dans les relevés : identifiants et compteurs seulement.
- Notation : `DC` = `docker compose -p <projet de démo> -f docker-compose.yml -f docker-compose.tls.yml --profile tls` (mêmes fichiers et profil que la check-list). C'est la **pile complète**, avec le service `worker`, celle de la démo (scénario § 12.1, décision de O du 18/11). La pile e2e n'a pas de worker : elle ne convient pas.
- **Mise à jour du 18/11** (décisions du jour) :
  - pas de vote OCR, ni en V1.0 ni en V1.1 ; RapidOCR seul, avec repli sur Tesseract, entre en V1.0 seulement si sa PR passe avant le 19 à 16:00 (`decision-vote-ocr.md`) ;
  - les modèles EasyOCR sont maintenant intégrés à l'image (000940e, sur `main`) ;
  - les photos de démo (`demo-ocr`, scénario § 12) sont testées réseau coupé (P3c, P5, E5 bis).

## P. Préparation (réseau encore branché, rien n'est tiré d'Internet)

- **P0. Place et charge** :
  - `df -h` : au moins **20 Go libres** sur le disque du dépôt et sur celui des données Docker. Sinon, stop : le signaler à O ;
  - `free -m` noté ;
  - aucune autre pile lourde en marche, et l'étape C6 de la check-list terminée.
- **P1. Pile à zéro** :
  - `DC ps -a` d'abord : vérifier que c'est bien la pile de démo ;
  - puis `DC down -v` ;
  - noter la liste `docker images` pour le retour (R4) ;
  - **jamais** un projet `edossier_*` sans décision écrite de O, et une telle décision ne vaut qu'à partir du 22/11 (fenêtre C6).
- **P2. Images depuis l'archive** de la check-list (profil tls compris) : `bash scripts/images_import.sh <dossier de l'archive>`. OK si `DC config --images` correspond à `IMAGES.txt`.
- **P3. Démarrage sans tirage** : `DC up -d --pull never --no-build`.
  - OK si `DC ps -a` montre api, postgres et redis healthy, worker, frontend, nginx et nginx-tls démarrés, et migrate et seed **Exited (0)** ;
  - le worker n'a pas de healthcheck : `DC exec -T worker celery -A app.workers.celery_app inspect ping` doit répondre `pong` (scénario § 12.1) ;
  - KO si une image manque : noter son nom, ne pas la tirer.
- **P3a. Mode de la pile** : `DC exec -T api printenv ENVIRONMENT DEBUG` doit donner `development` puis `false` (`checklist-demo.md`).
- **P3b. Clé de signature** : `DC exec -T api sh -c 'printenv SECRET_KEY | grep -cE "^[0-9a-f]{64}$"'`.
  - OK si la commande renvoie 1 ; la clé n'est jamais affichée.
  - Pourquoi : en mode `development`, la garde contre la clé par défaut est désactivée (`backend/app/core/config.py`).
  - Si KO : `DC down` (sans `-v`), régénérer la clé dans le fichier d'environnement avec `openssl rand -hex 32`, puis reprendre en P3.
- **P3c. Moteurs et modèles OCR**, réseau encore branché :
  - moteur configuré : `DC exec -T worker printenv OCR_PRIMARY_ENGINE`, à noter. Il vaut `tesseract` par défaut (#350). Il vaut `rapidocr` seulement si la PR RapidOCR est dans le tag **et** si son activation a été décidée le 20/11 à 09:00 ;
  - modèles EasyOCR (moteur de repli) : `DC exec -T worker sh -c 'ls "$EASYOCR_MODEL_DIR" | wc -l'`. Attendu : au moins 1. Depuis 000940e, l'image les intègre à la construction (`/opt/easyocr`) ;
  - modèles RapidOCR, **seulement si la PR est dans le tag** : vérifier qu'ils sont dans l'image, avec la commande donnée par B dans sa PR (`À vérifier` : selon sa version, RapidOCR peut télécharger ses modèles au premier usage) ;
  - KO = un modèle manquant. On ne le télécharge pas : on le signale à O dès P3c.
- **P4. Jeu de démo** : remise à zéro selon `DOCS/exploitation/donnees-demo.md` (`seed_demo.py` échoue si un compte diffère du manifeste).
  - Chronométrer la durée : c'est la mesure n° 1 du § 5 du scénario, encore inconnue.
  - OK si l'accueil de MINFI001 affiche 351.
- **P5. Fichiers** sur le disque du poste, à un chemin court :
  - le dossier `live` (30 fichiers) et le sous-dossier de secours (5 fichiers, dont 1 doublon) ;
  - les fichiers OCR du scénario § 12.4 : `IMG_0412.jpg`, `IMG_0413.jpg` et `SCAN_0412.pdf`. Ils sont dans `frontend/e2e/data/demo-ocr/` une fois commités ; le 18/11, ils ne sont pas encore sur `main`.
- **P5b. Prérequis du worker** (scénario § 12.1) :
  - envoyer une copie de D1 sous un autre nom, ou une copie de `SCAN_0412.pdf` si on joue le plan B ;
  - attendre que la fiche affiche un texte lu, vérifier que la recherche `photocopieurs` la trouve ;
  - la mettre à la corbeille, puis la supprimer définitivement.
- **P6. Étape 8 du scénario** : le bordereau P8, visé par MGR001 puis signé par MINFI001.
- **P7. Navigateurs** : profils B à E préconnectés, A sur l'écran de connexion. Adresse `https://localhost:8443`, certificat local installé (pas d'avertissement).

## C. Coupure du réseau

- **C1.** Wi-Fi coupé, câble débranché, mode avion.
- **C2.** `curl -m5 https://github.com` échoue, et `DC ps` répond toujours. OK si les deux sont vrais.
- **C3.** Sur chaque fenêtre : outils de développement, onglet Réseau, journal conservé pendant tout le parcours. Le relevé final ne doit montrer aucune requête vers une autre adresse que localhost.
- **C4. Côté serveur**, à la fin du parcours : `DC logs api worker | grep -ciE 'Name or service not known|Temporary failure in name resolution|ConnectionError|ConnectTimeout'`. Attendu : 0 ; le code de sortie 1 de `grep -c` quand il compte 0 n'est pas une erreur.
  - Envoi d'e-mails : il n'a lieu que si `EMAIL_ENABLED` est vrai **et** la clé d'API d'envoi est renseignée (`backend/app/services/email_service.py`). Chaque envoi tente alors un appel externe, qui ne lève pas d'erreur mais peut attendre son délai d'expiration et ralentir P6 et E5.
  - Relevé : `DC exec -T api printenv EMAIL_ENABLED` ; pour la clé, seulement vide ou non vide : `DC exec -T api sh -c 'test -n "$RESEND_API_KEY" && echo non-vide || echo vide'`. **Jamais sa valeur.**
- **Règle** : on ne rebranche pas le réseau avant R1. Si une étape ne passe qu'en rebranchant, elle est KO, et le protocole s'arrête là (étape notée).

## E. Parcours de démo hors ligne (scénario § 1), chronométré

- **E0. Ressources** : partout, les icônes et les polices s'affichent (pas de carrés ni de noms d'icônes en texte). KO = ressource chargée depuis Internet.
- **E1. Connexion de A** (code, puis « Confirmer l'identité »). OK si l'en-tête montre « Admin Institution ».
  - D'où vient le code : avec `ENVIRONMENT=development`, il est rendu dans la réponse de connexion (`backend/app/services/auth_service.py`). Il est stocké dans Redis, et rien n'est envoyé.
  - En secours, il se lit dans Redis, sans jamais le recopier dans le rapport.
- **E1 bis. Envoi des photos** (scénario § 12.2, au début de l'étape 1) : « Nouveau Document » dans A, destination DAF, `IMG_0412.jpg` puis `IMG_0413.jpg`. En plan B : `SCAN_0412.pdf` seul.
  - Noter l'heure d'envoi.
  - On envoie **avant** de lancer E2, jamais après : le worker traite un document à la fois.
- **E2. Import en vrac** : dossier `live`, « Juste les ranger », DAF.
  - OK si l'analyse donne 16 prêts, 12 à revoir et 2 doublons, et l'import 16 importés, 12 revues, 0 erreur.
  - Relevé : temps de l'analyse, temps de l'import, temps total jusqu'aux cartes finales (même méthode qu'au § 10 du scénario).
- **E3. Rangement** : l'arbre DAF → domaine → activité → année est rempli, et un document importé s'ouvre avec son aperçu.
- **E4. Règles** : une règle avec un critère de contenu ou d'année s'affiche ; le « Simulateur » montre l'avant et l'après sans rien déplacer.
- **E5. Bannette** : un des 12 « à revoir » du direct (pas un bordereau P8), « Classer et relancer ». OK s'il quitte la bannette et apparaît dans l'arbre.
- **E6. Recherche « courrier »** dans E, puis dans C. OK si :
  - les deux listes diffèrent (DAF pour E, DSI pour C) ;
  - le menu de C n'a ni « Rapports », ni « Plan de classement », ni « Import en masse » ;
  - aucun document en corbeille n'apparaît.
  - Relevé : temps d'affichage des résultats.
- **E6 bis. Recherche dans le texte lu** (étape 5 bis), dans A :
  - `photocopieurs` doit donner **1 résultat**, `IMG_0412.jpg` ;
  - `agrafeuses` doit donner **1 résultat**, `IMG_0413.jpg` (étape sautée en plan B) ;
  - relevé : le délai entre l'envoi (E1 bis) et le premier résultat ;
  - si l'une des fiches est encore « en cours », la noter et passer à E7, sans nouvel essai.
- **E7. Historique** : dans A, l'onglet « Historique des Versions » ; dans D, « Audit », filtre « Effectuée par », puis « Exporter (CSV) ». OK si le fichier se télécharge et si l'import et la revue de la séance figurent au journal.
- **E8. Rapports dans E** : « Traitement & délais », puis « Services ». OK s'il n'y a que des chiffres de la DAF.
- **E9. Archivage**, si l'étape est gardée au 19/11 : « Archiver » sur le bordereau validé, puis « Mes documents », filtre « Archivé ». OK si le badge « Archivé » s'affiche et si le document reste consultable.
- **E10. Accueil de MINFI001** : le total attendu se note après E5, **à partir d'une mesure**, pas d'une supposition.
  - 367 n'est sûr qu'après E2, et E5 peut le porter à 368.
  - Les photos d'E1 bis, envoyées hors du dossier `live`, comptent aussi dans ce total.

## M. Ce qu'on relève (tableau du rapport), après E10

- **OCR**, sur les fichiers d'E1 bis (les photos de démo, pas un autre document) :
  - le moteur se lit dans les journaux du worker, ligne `OCR Strategy: Using …`. Il doit correspondre à celui noté en P3c (le repli sur Tesseract est permis s'il est inscrit au journal) ;
  - aucun téléchargement : `DC logs worker | grep -ciE 'downloading|download'` doit renvoyer 0 (un nombre, pas les lignes elles-mêmes) ;
  - temps entre l'envoi et le statut « traité », pour chaque fichier, et résultats d'E6 bis ;
  - limite : 30 s par page sur le poste. C'est le critère C3 de `decision-vote-ocr.md`, repris pour un moteur seul. Au-delà, le signaler à O, car l'envoi en avance de l'étape 1 ne suffirait plus.
- **Recherche** : temps de E6, pour E et pour C.
- **Import** : les trois temps de E2, comparés à ceux du § 10 (807 à 884 ms au total sur la version compilée).
- **Temps** :
  - durée de chaque étape E1 à E9, comparée au § 1 (12:30 de direct, cible sans la marge de 2:00) ;
  - durée de la remise à zéro (P4).
- **Réseau** : nombre de requêtes hors localhost (attendu : 0) et résultat de C4.

## B. Plan B si une étape échoue

- Règle du scénario § 4 : une tentative (F5), sinon on note KO et on passe à l'étape suivante. On ne redémarre pas la pile pendant le parcours.
- **KO hors ligne** (ressource ou appel externe, onglet Réseau ou C4) : capture de la requête, URL notée, puis étape suivante. C'est un défaut à corriger avant le 30 : le signaler tout de suite à O.
- **KO fonctionnel** qui échoue aussi en ligne : le plan B du scénario § 4 s'applique (sous-dossier de 5 fichiers, fenêtre B, captures). Ce n'est pas un défaut hors ligne.
- **Image manquante en P3** : stop. Pas de tirage ; l'archive est refaite sur un poste connecté, après le protocole.
- **Proposition à O et au PO** (ce n'est pas une règle du protocole) : si tous les KO sont fonctionnels, la démo se fait réseau coupé. S'il reste un KO hors ligne non corrigé le 29 au soir, la démo se fait aussi réseau coupé, et l'étape concernée passe en captures.

## R. Retour à l'état initial

- **R1.** Rebrancher le réseau.
- **R2.** Supprimer le CSV téléchargé en E7. Les photos d'E1 bis disparaissent avec la remise à zéro de R3.
- **R3.** Remise à zéro du jeu (comme en P4), puis contrôle : 351 à l'accueil de MINFI001. P6 est à refaire la veille de la démo.
- **R4.** Images gardées (ce sont celles du 30/11). `docker images` doit être identique à la liste notée en P1, plus les images du tag. Aucune autre pile n'est touchée.

## Preuves

Rapport dans `gestion-projet/walkthrough/` (dossier daté) :
- tableau OK/KO de P0 à E10 ;
- relevés M et résultat de C4 ;
- captures des KO ;
- captures de secours de l'étape 5 bis, prises en E6 bis : la fiche avec le texte lu et les résultats de recherche (`checklist-tag-rc1-24-11.md` § 5) ;
- export de l'onglet Réseau.

## Durée

Exécution par Q : **1,25 h-s** (dont 0,25 pour P5b, E1 bis et E6 bis), si l'archive d'images de la check-list est prête (P2 se réduit alors à son import). L'inconnue est P4, la remise à zéro, dont la durée n'a jamais été mesurée.

## Annexe A. Machine simulée : pile ged-replay construite depuis release/v1.0.0 (demande d'O, 18/11)

Le PO n'a pas prêté de poste (fiche PO, réponse 1 du 17/11). L'exigence 28 se prouve donc sur la machine simulée de Q, notée « vérifiée sur machine simulée » (fiche PO, question 15, option B). Cette annexe ne remplace pas `gestion-projet/recette/checklist-installation-hors-ligne-25-11.md` (Q) : elle en fixe la référence de code, le nom de pile, les parcours du CDC, les seuils de mémoire et le nettoyage. Ordre le 25 : check-list de Q étapes P et M, puis A1 à A6 ci-dessous, puis le protocole principal (P à R) sur le poste de démo.

### A1. Référence du code

- `git ls-remote origin release/v1.0.0`. Si la branche existe, la prendre. Sinon, prendre le tag rc.1 du 24/11. Sinon, le SHA de `main`, noté dans le rapport avec la raison.
- Le 18/11 au soir, `release/v1.0.0` n’existe pas encore.
- Worktree propre : `git worktree add ../GED237-offline-trial/GED237 <réf>` (étape P1 de la check-list). Jamais dans le checkout partagé.

### A2. Pile `ged-replay`

- Sur l'hôte, `COMPOSE_PROJECT_NAME=ged-replay` dans le `.env` du worktree : les images construites s'appellent `ged-replay-*` et ne se mélangent ni aux images ni aux volumes `edossier_*`.
- Sur l'hôte, on ne fait que `build`, `pull --ignore-buildable` et l'export (check-list P3). Jamais `up` : les conteneurs gardent le nom fixe `edossier_*` et entreraient en conflit avec la pile en place (guide d'installation, § 8).
- Dans la machine (`--network none`, démon Docker isolé), le même `.env` est copié : `docker compose config --images` doit redonner exactement `IMAGES.txt`, avec les noms `ged-replay-*`.
- Écart au guide à noter dans le rapport : le guide suppose un dossier du même nom que le clone ; ici, le nom vient de `COMPOSE_PROJECT_NAME`.

### A3. Machine sans réseau

- Contrôles E1 de la check-list : mode réseau `none`, aucune route par défaut, échec de `curl` vers github.com et pypi.org, échec de `getent hosts pypi.org` dans l'api.
- En plus : `docker compose logs --no-color | grep -ci 'name resolution\|getaddrinfo\|timed out'` relevé après A4. Toute ligne trouvée est un appel sortant à expliquer (modèles OCR, polices, télémétrie).

### A4. Parcours du CDC à rejouer, dans la machine

Les parcours passent par `curl` sur `http://localhost:8080`, ou par le smoke Playwright de la check-list (E8). Le navigateur de l'hôte n'atteint pas la machine. Numéros : items de l'audit fonctionnel du 09/11, § 1.

| # | Item du CDC | Parcours | Preuve attendue |
|---|---|---|---|
| A4.1 | 32, 25 | Page d'accueil, asset JS, police d'icônes | 200 sur les trois. Aucun appel vers un CDN dans le HTML (`grep -c 'https://'` sur les balises `link` et `script` = 0) |
| A4.2 | 9 | Connexion en 2FA, code OTP lu dans la réponse (mode development de la rc.1), puis jeton | 200 puis jeton. Un mauvais code donne 401 |
| A4.3 | 9, 10 | Un lecteur d'un autre service demande un document de MINFI | 404 « document introuvable » (pas 403, pas 500) |
| A4.4 | 6 | Dépôt d'un PDF de test | 201, puis GET 200, puis le document est présent dans la liste |
| A4.5 | 15, 13 | OCR du document déposé, puis recherche plein texte d'un mot du fichier | Statut traité en moins de 5 min. La recherche le retrouve. Les modèles OCR viennent de l'image, aucun téléchargement dans les logs du worker |
| A4.6 | 1, 3, 4 | Classement d'un dépôt par une règle active, puis arborescence service > domaine > activité > année | Le document est rangé dans la bonne branche |
| A4.7 | 17, 16 | Nouvelle version du même document, puis verrouillage d'édition | Version 2 listée. Un second compte voit le document verrouillé et ne peut pas le modifier |
| A4.8 | 22 | Circuit de validation : soumission, puis visa | Statut final « validé » |
| A4.9 | 11 | Journal : l'action A4.4 y figure, puis export CSV | Ligne présente. Le CSV s'ouvre et contient la ligne |
| A4.10 | 23, 20 | Tableau de bord et rapport du chef de service | 200. Les compteurs bougent après A4.4 |

Items non rejoués hors ligne (rien à prouver sans réseau, ou non vérifiable sur une machine simulée) : 2, 8, 14, 24, 26 à 31.

### A5. Mémoire : seuils `free -m` (colonne available, côté WSL)

- La machine compte pour toute la capacité : 7 Go, au-delà de deux charges de 3 Go. Pendant l'essai, aucune autre charge Docker lourde : ni build, ni tests, ni rejeu.
- Avant chaque build sur l'hôte (A2) : au moins 2048 Mo disponibles. Sinon, attendre ou prévenir O.
- Avant le `docker run` de la machine : au moins 9216 Mo disponibles (7 Go pour la machine, 2 Go de marge pour l'hôte). Sinon, STOP et prévenir O. La limite de 7 Go n'est pas abaissée en silence : ce serait un autre essai.
- Pendant A4 : relevé toutes les 10 min. Dans la machine, `free` montre l'hôte et pas la limite : lire `/sys/fs/cgroup/memory.current` et `memory.max`. Si l'hôte passe sous 1024 Mo disponibles, `docker stop ged-offline` et noter l'étape en cours.
- Pic de `memory.current` noté dans le rapport, à comparer aux 5,9 Go des `mem_limit` de compose.

### A6. Nettoyage, sans prune

- Relevé AVANT l'essai : `docker ps -a --format '{{.Names}}'` et `docker images --format '{{.Repository}}:{{.Tag}}'`, gardés dans le rapport.
- Après l'essai :
  - démontage de la check-list : `docker rm -f ged-offline`, puis `docker volume rm ged-offline-docker`, puis `git worktree remove ../GED237-offline-trial/GED237` ;
  - images de l'hôte : `docker images --format '{{.Repository}}:{{.Tag}}' | grep '^ged-replay-'`, puis `docker image rm` une à une, puis `docker image rm ged-offline-host` ;
  - les images tirées pour l'export (postgres, redis, nginx) restent si elles figuraient au relevé AVANT. Sinon, `docker image rm` une à une.
- Interdits : `docker system prune`, `docker image prune`, `docker volume prune`, `down -v` sur une autre pile, et toute action sur `edossier_*`, avant comme après.
- Contrôle de fin : les deux relevés sont identiques à ceux d'AVANT. Tout écart est expliqué dans le rapport.
- La « clé » (archives d'images et de code) est gardée jusqu'à la recette.

### A7. Preuves et durée

- Rapport dans `gestion-projet/walkthrough/` : la référence prise en A1 et son SHA, la sortie de `docker compose config --images`, le tableau A4 (OK ou KO, code HTTP, durée), les relevés A5, le résultat de `grep` en A3, les relevés AVANT et APRÈS d'A6. Aucun secret : seuls les compteurs de la check-list (E2 bis) apparaissent.
- Durée : celle de la check-list (≈ 2 h-s), plus ≈ 0,5 h-s pour A4 au-delà du smoke et pour les relevés A5 et A6.
