# Checklist de démo — J-1 (dimanche 29/11) et J0 (lundi 30/11)

- Consolide les décisions du 2026-11-09 : DEC-2026-002 (amendée), DEC-2026-003, `decision-po-vps-b6.md` (**décision PO du 2026-11-09 : démo sur place en Docker, poste de secours, VPS écarté**), § 0 de `parcours-demo.md` (limites auth), `jeu-donnees-demo.md`, `sauvegarde-restauration.md`, `plan-presentation.md`.
- Rôles : **O** orchestrateur, **B** dev-backend, **F** dev-frontend, **Q** ci-qa, **P** présentateur (PO ou personne désignée). Une case = un item, une personne, un moment. Preuve attendue entre parenthèses quand elle n'est pas évidente.
- Instruction de l'innovateur, 2026-11-09 20:50 ; à transformer en issue GitHub épinglée par O.
- Révision du 2026-11-10 : items marqués *(lot n, si fusionné)* = nouveautés V1.1 de la fenêtre du 19/11 ; ils ne s'appliquent que si la ligne correspondante est **TIENT** au relevé de coupure (`plans/releve-coupure-19-11.md`), sinon les barrer le 19 au soir.

## A. Avant J-1 (à vérifier le samedi 28/11, O)

- [x] **O** — Décisions PO (a) démo sur place et (b) B6 garde minimale consignées en fin de DEC-2026-002 (2026-11-09) ; section F sans objet.
- [ ] **B** — `DEBUG=false` dans le compose de démo (PR séparée fusionnée) ; `ENVIRONMENT=development` conservé **uniquement** si l'on veut le code OTP dans la réponse de login ; sinon procédure de lecture du code dans Redis (`redis-cli get otp:<…>`) répétée par P.
- [ ] **B** — Limites auth exposées par variables (`AUTH_LOGIN_RATE_LIMIT`, `AUTH_OTP_RATE_LIMIT`), défaut `5/minute` inchangé, compose de démo à `30/minute` ; clé de limitation vérifiée derrière nginx (pas l'IP du proxy).
- [ ] **B** — Migration des codes de rôle en minuscules appliquée (`alembic upgrade head` sur base vierge puis login du compte seed : preuve dans le walkthrough).
- [ ] **B** — D3 : connexion, dépôt et import tracés dans le journal d'audit ; sinon formulation de repli de `plan-presentation.md` (séquence 13–15) validée par P.
- [ ] **Q** — Jeu de démo `demo-manifest.json` + `docker compose exec api sh scripts/e2e_reset.sh demo` rejoués deux fois avec compteurs identiques à `expected` (preuve : walkthrough du 20/11).
- [ ] **Q** — 8 parcours Playwright verts sur la pile Docker (run du 21/11) ; rapport HTML + traces archivés comme **plan B** (`frontend/e2e-out` copié hors du dépôt, sur le poste de démo et le poste de secours).
- [ ] **F** — Bloquants de l’audit UX Lot 14, en V1.0 avant le gel : `/spaces` ne s’ouvre plus sur « 0 document » (risque 15) ; badge « EN COURS » au lieu de « CURRENT » sur `/tasks` (risque 16). Contre-test dans le navigateur sur le jeu de démo.
- [ ] **B** — Bloquant de l’audit UX Lot 14 : descriptions en français clair des règles `DEMO_RULE_01` à `10` du jeu de démo (risque 17). Contrôle après `e2e_reset.sh demo`.
- [ ] **O** — Script de l’animateur à jour pour les replis des risques 15 à 18 si un correctif manque (clic « Inclure les sous-services », arrivée de MGR001 sur `/tasks`).
- [ ] **Q** — OCR-0 exécuté (14/11) ; décision OCR-1 actée (V1.1 par défaut) ; moteur de démo = pile de la rc.1 : RapidOCR pour les photos, captures et formulaires, Tesseract pour les scans, les PDF et en secours (#368, 9b32c30, voulu par O le 18/11). Repli sans changement de code : `OCR_PRIMARY_ENGINE=tesseract`, puis redémarrage du worker.
- [ ] **O** — **Coupure ferme jeu 19/11 18:00** (DEC-002, révision du 10/11) : pour chacun des 5 écarts réouverts (critères contenu OCR/date, export/import des règles, KPI doublons, surveillance continue, export du journal + verrou 3 OTP), état relevé à 18:00 : *fusionné sur `main`* = livré, sinon *V1.1* ; déroulé § 3, critères et plan de présentation § 3 mis à jour le 19 au soir ; aucune fusion de ces lots après cette heure.
- [ ] **F** — Garde de routes admin/non-admin livrée (18/11) ; `SpacesPage` branchée sur les filtres serveur (17/11).
- [ ] **B + Q** — Sauvegarde/restauration : `restore.sh --wipe` prouvé **deux fois** (10/11 pile e2e, avancé, 20/11 jeu de démo sur le poste de secours ; `sauvegarde-restauration.md` § 6.3) ; durée mesurée < 10 min ; second passage sans écart.
- [ ] **O** — Release `v1.0.0-rc.N` publiée en pré-release GitHub (dernier rc avant le 27 matin, `release-demo.md` § 3), artefact `release-integrity` (SBOM + manifeste signé) joint ; **Q** : images Docker construites depuis ce tag, `docker save` des 7 images sur une clé USB (`ged237-v1.0.0-rc.N-images.tar` + `.sha256`) ; `/health` affiche la version du tag.
- [ ] **P** — Répétition générale du 27/11 chronométrée (13 min de direct ± 1) ; écarts et réponses jury relus.

## B. J-1 — dimanche 29/11

### Postes

- [ ] **O** — Poste principal : Docker Desktop (ou Engine) démarré, ≥ 16 Go RAM, ≥ 20 Go libres, mode avion testé (la démo ne dépend d'aucun accès réseau : vérifier qu'aucune image ne se re-télécharge, `docker compose up` avec `--pull never`).
- [ ] **O** — Poste de secours préparé **à l'identique** depuis la clé USB (`docker load`, même `.env`, même jeu de données), démarré une fois, parcours P1 joué, puis éteint ; câble HDMI/USB-C et adaptateur dans le sac.
- [ ] **O** — Navigateur : profil dédié, zoom 110–125 %, favoris des 7 routes (`/login`, `/ingestion`, `/rules`, `/classification-reviews`, `/spaces`, `/documents`, `/audit`), notifications et mises à jour désactivées, onglets fermés.
- [ ] **O** — Alimentation secteur + batterie chargée sur les deux postes ; veille et économiseur d'écran désactivés.

### Données

- [ ] **Q** — `docker compose exec api sh scripts/e2e_reset.sh demo` exécuté sur le poste principal ; compteurs affichés = `expected` du manifeste (classés 357, à revoir 51, total 408 fichiers ; corbeille 8, verrous 3, versions 5), et accueil de `MINFI001` à 351 documents (avec #260 ; scénario § 2).
- [ ] **Q** — *(17/11, scénario § 5 n° 21)* Juste après la remise à zéro, **avant la sauvegarde J-1** pour que le poste de secours ait le même état : `MGR001` vise le bordereau P8, puis `MINFI001` le signe. C'est le document validé de l'étape 8 « Archivage ». Un autre document doit rester en attente chez `MGR001` (n° 18). Identifiant du bordereau noté.
- [ ] **Q** — Dossier `demo-import/live/` (30 fichiers, dont 2 doublons volontaires) monté **en lecture seule** dans le conteneur api à **`/data/ingest`** (seul chemin conteneur, identique en e2e et en démo ; `INGEST_ALLOWED_ROOTS=/data/ingest`, tranché O 09/11, `spec-limite-upload.md` § 5) ; **non importé**. Dossiers surveillés : exigent `INGEST_WATCH_FOLDERS` (`docker-compose.yml`) **et** le corpus monté sur `/data/ingest` ; chemin live `/data/ingest/live`.
- [ ] **Q** — Pré-OCRisation complète du corpus (worker actif jusqu'à file vide : `celery inspect active` vide, `ocr_content` non nul sur les PDF image) ; recherche P5 testée sur le mot-clé prévu (résultat attendu noté).
- [ ] **Q** — Règle 10 « Rapports financiers » **créée inactive** ; les documents cibles sont bien « à revoir » (P6 : 51 à revoir au total, `expected.toReview` du manifeste, et non ≈ 15).
- [ ] **Q** — *(lot 2, si fusionné au relevé du 19)* Les 9 règles actives du seed + la règle 10 visibles sur `/rules` ; **export** du fichier de règles puis **réimport à blanc** du même fichier : résultat « 0 créée, 0 mise à jour » (zéro écriture, `updated_at` inchangé) ; le fichier exporté est gardé dans la pochette (reprise des règles sur le poste de secours).
- [ ] **Q** — *(lot 1, si fusionné)* Tuile « Doublons refusés » du tableau de bord = **12** après le reset (valeur `expected` du jeu D1) ; elle passera à **14** après l'import P2 (2 doublons volontaires) : les deux valeurs notées sur la fiche de P.
- [ ] **Q** — *(lot 3a, si fusionné)* Export CSV du journal d'audit téléchargé sur le poste principal et **ouvert dans Excel** (accents lisibles, colonnes séparées, dates au bon format) ; Excel installé et testé **sur les deux postes**.
- [ ] **Q** — *(lot 4, si fusionné)* Un fichier de `demo-import/live/` dont le **nom contient l'année** (ex. `…_2025.pdf`) désigné pour le moment lot 4, nom noté sur la fiche ; la règle « contenu + année » le prend après reconnaissance (vérifié une fois la veille, puis le document remis dans `live/` par le reset).
- [ ] **B** — **Sauvegarde fraîche** après le reset et la pré-OCRisation : `ops/backup.sh` (répertoire horodaté `backups/ged237-…/` sur l'hôte, `SHA256SUMS`) copié sur la clé USB et sur le poste de secours ; `restore.sh --wipe` rejoué sur le poste de secours (c'est ainsi qu'on le synchronise : **il est le point de reprise**).
- [ ] **Q** — *(18/11)* Fichiers de l'étape 5 bis copiés depuis `frontend/e2e/data/demo-ocr/` (#363) sur les deux postes, **hors** du dossier `live` : `IMG_0412.jpg`, `IMG_0413.jpg` et, pour le plan B, `SCAN_0412.pdf`.
- [ ] **O** — *(18/11)* Sur le poste de secours, ouvertes et prêtes : la fiche d'astreinte `DOCS/exploitation/astreinte-diagnostic.md` (#375 : worker tué, document bloqué « en cours », erreur 500) et `DOCS/exploitation/relancer-ocr.md` (#369). Relancer une lecture se fait pendant la préparation, **jamais en séance**.
- [ ] **O** — Journal d'audit vidé des traces de préparation ou date de filtre convenue pour P7 (sinon le journal montre les actions de Q).

### Comptes et accès

- [ ] **P** — Mots de passe des 5 comptes de démo (`admin`, `manager`, `collab`, `reader`, `auditor` @minfi) connus de P, **jamais dans un fichier du dépôt** ; gestionnaire de mots de passe ou fiche papier dans la pochette.
- [ ] **P** — Procédure OTP répétée : lecture du code dans la réponse (`development`) ou dans Redis ; un **OTP faux volontaire** prévu en P1 et compté dans la limite (3 connexions + 4 OTP max par minute dans le déroulé).
- [ ] **P** — Si un compte est verrouillé pendant la démo (3 codes OTP erronés → 423 pendant 15 min, lot 3b) : suivre `DOCS/exploitation/deverrouiller-compte.md` (arrive avec #83) ; en répétition, ne jamais dépasser 2 OTP faux sur le compte de démo.
- [ ] **O** — Après la dernière répétition : **compteurs de verrou purgés** pour les 5 comptes (`docker compose exec redis redis-cli DEL lock:<user_id> otp_fail:<user_id>`, `DOCS/exploitation/deverrouiller-compte.md`) ; contrôle `redis-cli --scan --pattern 'lock:*'` et `--scan --pattern 'otp_fail:*'` sans résultat.
- [ ] **P** — Ordre des changements de compte affiché sur une fiche : collab → admin → collab → admin → manager → collab → reader → collab → auditor.

### Arrêt de la veille

- [ ] **Q** — Worker arrêté pour la nuit avec le reste de la pile (ligne « Pile laissée éteinte » ci-dessous). **Mise à jour du 18/11** : il **doit tourner pendant la séance**, car l'étape 5 bis (photo lue, puis cherchée) dépend de lui (scénario § 12.1). `docker compose up -d` le relance le matin. Sa concurrence est déjà à 1 sur `main` (#350).
- [ ] **B** — **Redis et backend de résultats Celery sains** avant la démo : `CELERY_BROKER_URL` et `CELERY_RESULT_BACKEND` du conteneur api pointent vers le Redis de la pile (`redis-cli ping` = `PONG` depuis l'api). Sinon la validation d'un import reste bloquée sans message (LESSON-2026-026) ; test : un import d'un fichier en P2 répété la veille.
- [ ] **O** — Pile laissée **éteinte** la nuit (`docker compose stop`, pas `down -v`) ; redémarrage chronométré le matin (< 3 min attendu).

## C. J0 — lundi 30/11

### H-90 min (sur place)

- [ ] **O** — Branchement écran/projecteur, résolution 1920×1080, test de lisibilité du dernier rang.
- [ ] **O** — `docker compose up -d --pull never` ; `GET /health` OK ; login `collab@minfi` + OTP + déconnexion joués une fois (chauffe des caches, vérification de la limite auth : pas de 429).
- [ ] **O** — **Version affichée = `1.0.0-rc.1`** aux deux endroits : `GET /health` (champ `version`, variable `APP_VERSION` du compose) et pied de la barre latérale (`VITE_APP_VERSION`, #94 : valeur figée **à la construction de l'image**, donc `APP_VERSION=v1.0.0-rc.1` posé dans `.env` **avant** `docker compose build`, pas seulement avant `up`) ; un « 0.0.0-dev » ou « dev » = image ou build de la mauvaise étiquette, reconstruire avant H-30.
- [ ] **O** — Limites d'authentification de la démo : `docker compose exec api printenv AUTH_LOGIN_RATE_LIMIT AUTH_OTP_RATE_LIMIT` = **`30/minute`** chacune (`docker-compose.yml`, pas la valeur e2e `300/minute` ni le défaut `5/minute`).
- [ ] **O** — *(18/11, étape 5 bis)* OCR prêt sur les deux postes :
  - `docker compose exec worker celery -A app.workers.celery_app inspect ping` répond `pong` ;
  - `docker compose exec worker printenv OCR_PRIMARY_ENGINE OCR_FALLBACK_ENABLED` donne `rapidocr` et `false` (#368, #365) ;
  - tâche de contrôle du scénario § 12.1 : une copie de D1 sous un autre nom est lue, puis trouvée par `photocopieurs`, puis supprimée définitivement. En cas d'échec : plan B du § 12.5, ou étape 5 bis retirée.
- [ ] **O** — Poste de secours allumé, pile démarrée, login joué, puis laissé en veille écran seulement.
- [ ] **P** — Fiche de déroulé (minute par minute, `plan-presentation.md` § 1) et fiche des comptes à portée de main ; chronomètre.

### H-30 min

- [ ] **O** — Vérification des 4 écrans « sensibles » : `/rules` (règle 10 inactive visible), `/classification-reviews` (compteur), `/spaces` DAF (pagination), `/audit` (filtre date prêt) ; *(lots fusionnés)* tableau de bord (tuile doublons = 12), `/rules` (bouton export/import visible), `/audit` (bouton CSV visible).
- [ ] **O** — `redis-cli --scan --pattern 'lock:*'` sans résultat (aucun compte verrouillé par la chauffe H-90) ; sinon purge ci-dessus (§ B « Comptes et accès »).
- [ ] **O** — *(lot 5 fusionné, #101)* Dossiers surveillés : **un seul** service `worker` porte `-B` (`docker compose ps` : un seul conteneur worker ; deux beat = passages en double, le verrou Redis n'évite que la simultanéité) ; le worker monte `/data/ingest` **en lecture-écriture** (il déplace les fichiers traités vers `_traites/` et `_erreurs/`), l'API le garde en lecture seule ; `docker compose exec worker printenv INGEST_WATCH_FOLDERS` **ne contient pas** `/data/ingest/live` (sinon le worker vide le dossier de l'import en direct avant P2) — vide `[]` si le lot 5 n'est pas montré.
- [ ] **O** — Seed vérifié : connexion `MGR001` réussie après le seed explicite (le compose ne seed pas ; `jeu-donnees-demo.md` § 2), puis déconnexion.
- [ ] **Q** — Rapport Playwright du plan B ouvert dans un second onglet (local, `file://`), captures des 8 parcours vérifiées.
- [ ] **O** — Téléphones en silencieux, notifications système coupées, Docker Desktop réduit (pas de fenêtre « mise à jour disponible »).
- [ ] **O** — Images **construites la veille** (J-1) ou chargées depuis la clé USB : **pas de `docker compose build` ni de `--build` le jour J** (le build de l'image api télécharge ~180 Mo de wheels torch ; un téléchargement coupé échoue au contrôle de hash pip : incident du 17/11).
- [ ] **O** — Point de reprise vérifié : `/health` = 200 sur les deux postes, même nombre de documents affiché sur `/spaces` DAF (poste de secours = restauration de la sauvegarde J-1).

### Pendant (P présente, O au clavier de secours)

- [ ] **O** — Si un écran casse : **une** tentative (F5), sinon bascule sur le poste de secours (< 60 s), puis plan B captures si la bascule échoue ; **jamais** de redémarrage de conteneur en séance.
- [ ] **P** — Pas plus de 4 connexions par minute ; si 429 : attendre 60 s en commentant l'écran courant.
- [ ] **P** — *(18/11, étape 8)* Le bordereau à archiver s'ouvre **par la barre de recherche du bandeau** (son titre), pas par l'explorateur : l'aperçu de l'explorateur n'a pas le bouton « Archiver » (scénario § 1 et § 14).
- [ ] **O** — Aucune purge définitive (`DELETE /purge`) pendant la séance. **Si une purge ou une suppression définitive part quand même** : aucune restauration en séance ; bascule sur le poste de secours (état J-1) ; P commente « en corbeille, restaurable par l'administrateur » sans le faire en direct ; restauration du poste principal après la séance (`sauvegarde-restauration.md` § 6.5).

### Après

- [ ] **B** — Sauvegarde post-démo (`ops/backup.sh`) pour conserver l'état montré ; journal d'audit exporté en SQL pour le compte rendu.
- [ ] **O** — Compte rendu : questions du jury non prévues ajoutées à `plan-presentation.md` § 4 ; incidents → `DOCS/engineering/lessons-learned.md`.

## F. Variante VPS — **sans objet** (VPS écarté par le PO le 2026-11-09)

Conservée pour mémoire : si la décision était rouverte, il faudrait OCR-1 avant le gel, limites mémoire réduites, Caddy + certificat 48 h avant, test de charge 2 utilisateurs, réseau de la salle vérifié J-1, repli = poste principal en local. Aucune case à cocher.
