# Vérification sur papier du manuel d'installation (item 31, #273)

- **Quand** : 18/11 au soir, sur `main` dd232f6, sans Docker. C'est l'étape 1 de la feuille de route de l'item 31. Le vrai rejeu sur poste neuf a lieu le 20/11 et son compte rendu sera `rejeu-installation-2026-11-20.md`.
- **Cible** : `DOCS/exploitation/installation.md`, et les fiches vers lesquelles il renvoie.
- **Méthode** : chaque commande, prérequis, variable, port et nom de service est comparé à `docker-compose.yml`, au `.env.example` racine, à `backend/app/core/config.py`, aux Dockerfiles et aux scripts.
- **Résultat** : 3 écarts bloquants, 9 gênants et 8 mineurs. Colonne « Suite » : **PR** = corrigé dans la PR de l'item 31 ; **B** = demande un changement de code ; **tag** = se règle avec la pose du tag.

## Écarts bloquants (le rejeu échoue)

| # | Où | Constat | Suite |
|---|---|---|---|
| 1 | L74, renvoi vers `donnees-demo.md` § « Plateforme vide » | La variante « plateforme vide » ne se rejoue pas. Aucune route de l'API ne crée un premier compte sans être connecté. `scripts/init_db.py` crée le tenant de démonstration, pas un administrateur, et ne fait rien si un tenant existe déjà. | **Décision d'O (18/11)** : variante retirée de la rc.1 (PR) ; commande « premier administrateur » en V1.1 (B : commande, test, doc) |
| 2 | L142, export des images avec le profil `tls` | `docker-compose.tls.yml` exige `TLS_CERT_DIR` : sans elle, `docker compose config --images` échoue. Le profil `tls` n'ajoute de toute façon aucune image (`nginx:alpine` est déjà dans la pile de base). | **PR** : retirer l'exemple |
| 3 | L28 et L136, `v1.0.0-rc.1` | Le tag n'existe pas encore : `git checkout` et `git archive` échouent avant le 24/11. | **tag** (rejeu du 20 : remplacer par le SHA de la release) |

## Écarts gênants (l'installateur hésite ou fait un détour)

| # | Où | Constat | Suite |
|---|---|---|---|
| 4 | L38-50, tableau des réglages | Aucune variable OCR n'y figure. Il faudrait au moins `OCR_PRIMARY_ENGINE` (`rapidocr`), `OCR_FALLBACK_ENABLED` (`false`) et les trois `OCR_RAPIDOCR_*`. Elles ne vont qu'au `worker` : après une modification du `.env`, faire `docker compose up -d worker`, car `restart` ne relit pas le `.env`. `RAPIDOCR_MODEL_DIR` est intégré à l'image et ne se règle pas. | **PR** |
| 5 | L116, dépannage OCR | Le symptôme décrit est celui d'EasyOCR, alors que le moteur par défaut est RapidOCR et que le repli EasyOCR est coupé. La ligne cite aussi `api`, alors que seul le `worker` lit les documents. | **PR** |
| 6 | L115 | Conseille `--concurrency=1`, qui est déjà la valeur réglée. Le vrai levier est `OCR_RAPIDOCR_MAX_SIDE` ou `OCR_RAPIDOCR_ENABLED=false`, puis `relancer-ocr.md` pour le document resté sans texte. | **PR** |
| 7 | L45, L140, L150 ; `.env.example:11` | Le nom de projet est fixé à `edossier` (`name:` du compose) : il ne dépend pas du dossier. La contrainte « dossier cible du même nom » ne sert donc à rien. | **PR** |
| 8 | L80 | `docker compose ps` ne montre pas `migrate` ni `seed` terminés : il faut `docker compose ps -a`. | **PR** |
| 9 | L15, accès réseau au premier build | La liste est incomplète : il manque GitHub (modèles EasyOCR) et l'hôte des modèles RapidOCR (à confirmer pendant le rejeu). | **PR**, puis confirmation au rejeu |
| 10 | L5 et § 8 | Aucun renvoi vers `relancer-ocr.md`, `deverrouiller-compte.md` ni `astreinte-diagnostic.md`. Il manque aussi les lignes « compte verrouillé (423) » et « document resté sans texte ». | **PR** |
| 11 | L50 | La durée des jetons et la taille maximale d'envoi ne sont pas dans le compose : ce sont des défauts de `config.py`. À l'inverse, `AUTH_*` et `ALLOWED_ORIGINS` sont écrits en dur dans le compose, donc les mettre dans `.env` est sans effet. Même remarque pour `deverrouiller-compte.md:20`. | **PR** (dire ce qui se règle et où) |
| 12 | L70, ordre de démarrage | `api` et `worker` attendent `migrate`, pas `seed` : en réalité, migrate, puis seed en parallèle d'api et worker. | **PR** |

## Écarts mineurs

| # | Constat | Suite |
|---|---|---|
| 13 | L68, L118 : il n'y a pas une « image `backend` » mais quatre images, construites à partir du même Dockerfile. | PR |
| 14 | L46, L120 : le dossier d'import est en lecture seule pour `api`, mais monté en écriture pour `worker` (dossiers surveillés). | PR |
| 15 | `INGEST_SOURCE_DIR`, `APP_VERSION`, `INGEST_WATCH_*`, `TLS_CERT_DIR` et `TLS_PORT` sont absentes du `.env.example` racine. `APP_VERSION` n'a pas le même défaut côté api et côté frontend. | PR pour la doc ; ajout au `.env.example` à confirmer avec Q (contrôle de parité #389) |
| 16 | `.env.example:29-30` : le commentaire dit « tesseract (défaut) », alors que la valeur est `rapidocr`. | PR |
| 17 | Le `worker` ne reçoit pas `SECRET_KEY`. Aucun usage n'a été repéré côté worker. | signalé à B |
| 18 | La pile de référence tourne en mode développement (`--reload`, frontend `development`, code à usage unique affiché par l'API). | à assumer dans la doc de la rc.1 (PR) |
| 19 | « Code affiché par l'API » : exact sur cette pile. | rien à faire |
| 20 | **Une seule pile par hôte** : `docker-compose.yml` fixe `container_name` (`edossier_*`) sur tous les services. Une seconde pile sur le même hôte (rejeu, poste de secours, recette) entre en conflit, même avec `-p`. Le rejeu du 20/11 passe par un override hors dépôt (sans `container_name`, ports de l'hôte déplacés). | constaté ; correctif de fond à décider (V1.1) |

## Vérifié sans écart

Plafonds mémoire, port publié, volumes, `migrate` (`alembic upgrade head`) et `seed` (`--scale seed=0`), contrôles de santé, `/health` et `/api/docs`, verrou à 3 échecs et 900 s, worker en concurrence 1 avec un plafond de 2 Go, `relancer-ocr.md` (commande et arguments conformes à `reocr.py`), `deverrouiller-compte.md` (clés Redis et base 0), fiche d'astreinte (services, file `celery` en base 1), `ops/backup.sh` et `ops/restore.sh`, `scripts/images_export.sh` et `images_import.sh`, profil HTTPS (port 8443, `nginx-tls`, `prove_tls.sh`), langues de Tesseract, PostgreSQL 15.

## Guide utilisateur par profil (`DOCS/GUIDE_UTILISATEUR_PAR_PROFIL_GED237.md`)

Vérifié contre le code de `main` dd232f6 et les diffs de #364, #390 et #356. Il n'existe **pas de guide administrateur distinct** : l'administration fonctionnelle est couverte par les sections 1 et 2 de ce guide. Les fiches de `DOCS/exploitation/` visent l'exploitant technique.

| # | Où | Constat | Suite |
|---|---|---|---|
| G1 | menus Collaborateur et Lecteur | « Ranger / Importer » et « Bibliothèque locale » sont masqués pour ces deux profils (`Sidebar.tsx`). | PR |
| G2 | § Rôles, § Ranger / Importer | Les deux modes d'import sont réservés au Super Admin et à l'Admin Institution ; les autres profils voient l'écran verrouillé. | PR |
| G3 | Admin Service, Auditeur | « seul Ranger sur mon poste vous concerne » : l'option est verrouillée. | PR |
| G4 | Admin Institution, archiver | Pas de « Mes Documents » dans ce menu : chemin réel = recherche du bandeau → « Ouvrir » → « Archiver » (chemin testé par #356) ; filtre « Statut » sur « Explorateur GED ». | PR |
| G5 | Auditeur | Pas de filtre de date (tri seulement) ; l'export reprend tout le journal filtré, pas l'écran. | PR |
| G6 à G12 | divers | Liste de contrôle retirée de « Paramètres » (#390), lien « Oublié ? » disparu, menu en haut ouvert à tous mais non gardé, champs du rapport, « Nouveau Document » aussi pour le Super Admin, filtre « Statut », tuile « Doublons refusés » cliquable. | PR |

Hors guide, signalé : le bouton « Exporter (CSV) » du journal a une infobulle « fichier Excel » (`AuditLogs.tsx`) → F.
