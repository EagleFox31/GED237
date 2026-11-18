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
