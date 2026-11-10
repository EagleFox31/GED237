# Checklist de démo — J-1 (dimanche 29/11) et J0 (lundi 30/11)

- Consolide les décisions du 2026-11-09 : DEC-2026-002 (amendée), DEC-2026-003, `decision-po-vps-b6.md` (**décision PO du 2026-11-09 : démo sur place en Docker, poste de secours, VPS écarté**), § 0 de `parcours-demo.md` (limites auth), `jeu-donnees-demo.md`, `sauvegarde-restauration.md`, `plan-presentation.md`.
- Rôles : **O** orchestrateur, **B** dev-backend, **F** dev-frontend, **Q** ci-qa, **P** présentateur (PO ou personne désignée). Une case = un item, une personne, un moment. Preuve attendue entre parenthèses quand elle n'est pas évidente.
- Instruction de l'innovateur, 2026-11-09 20:50 ; à transformer en issue GitHub épinglée par O.

## A. Avant J-1 (à vérifier le samedi 28/11, O)

- [x] **O** — Décisions PO (a) démo sur place et (b) B6 garde minimale consignées en fin de DEC-2026-002 (2026-11-09) ; section F sans objet.
- [ ] **B** — `DEBUG=false` dans le compose de démo (PR séparée fusionnée) ; `ENVIRONMENT=development` conservé **uniquement** si l'on veut le code OTP dans la réponse de login ; sinon procédure de lecture du code dans Redis (`redis-cli get otp:<…>`) répétée par P.
- [ ] **B** — Limites auth exposées par variables (`AUTH_LOGIN_RATE_LIMIT`, `AUTH_OTP_RATE_LIMIT`), défaut `5/minute` inchangé, compose de démo à `30/minute` ; clé de limitation vérifiée derrière nginx (pas l'IP du proxy).
- [ ] **B** — Migration des codes de rôle en minuscules appliquée (`alembic upgrade head` sur base vierge puis login du compte seed : preuve dans le walkthrough).
- [ ] **B** — D3 : connexion, dépôt et import tracés dans le journal d'audit ; sinon formulation de repli de `plan-presentation.md` (séquence 13–15) validée par P.
- [ ] **Q** — Jeu de démo `demo-manifest.json` + `docker compose exec api sh scripts/e2e_reset.sh demo` rejoués deux fois avec compteurs identiques à `expected` (preuve : walkthrough du 20/11).
- [ ] **Q** — 8 parcours Playwright verts sur la pile Docker (run du 21/11) ; rapport HTML + traces archivés comme **plan B** (`frontend/e2e-out` copié hors du dépôt, sur le poste de démo et le poste de secours).
- [ ] **Q** — OCR-0 exécuté (14/11) ; décision OCR-1 actée (V1.1 par défaut) ; moteur de démo = pile actuelle Tesseract-first.
- [ ] **O** — **Coupure ferme mer 19/11 18:00** (DEC-002, révision du 10/11) : pour chacun des 5 écarts réouverts (critères contenu OCR/date, export/import des règles, KPI doublons, surveillance continue, export du journal + verrou 3 OTP), état relevé à 18:00 : *fusionné sur `main`* = livré, sinon *V1.1* ; déroulé § 3, critères et plan de présentation § 3 mis à jour le 19 au soir ; aucune fusion de ces lots après cette heure.
- [ ] **F** — Garde de routes admin/non-admin livrée (18/11) ; `SpacesPage` branchée sur les filtres serveur (17/11).
- [ ] **B + Q** — Sauvegarde/restauration : `restore.sh --wipe` prouvé **deux fois** (10/11 pile e2e, avancé, 20/11 jeu de démo sur le poste de secours ; `sauvegarde-restauration.md` § 6.3) ; durée mesurée < 10 min ; second passage sans écart.
- [ ] **O** — Release `v1.0.0-rc.N` publiée en pré-release GitHub (dernier rc avant le 27 matin, `release-demo.md` § 3), artefact `release-integrity` (SBOM + manifeste signé) joint ; **Q** : images Docker construites depuis ce tag, `docker save` des 7 images sur une clé USB (`ged237-v1.0.0-rc.N-images.tar` + `.sha256`) ; `/health` affiche la version du tag.
- [ ] **P** — Répétition générale du 27/11 chronométrée (13 min de direct ± 1) ; écarts et réponses jury relus.

## B. J-1 — dimanche 29/11

### Postes

- [ ] **O** — Poste principal : Docker Desktop (ou Engine) démarré, ≥ 16 Go RAM, ≥ 20 Go libres, mode avion testé (la démo ne dépend d'aucun accès réseau : vérifier qu'aucune image ne se re-télécharge, `docker compose up` avec `--pull never`).
- [ ] **O** — Poste de secours préparé **à l'identique** depuis la clé USB (`docker load`, même `.env`, même jeu de données), démarré une fois, parcours P1 joué, puis éteint ; câble HDMI/USB-C et adaptateur dans le sac.
- [ ] **O** — Navigateur : profil dédié, zoom 110–125 %, favoris des 7 routes (`/login`, `/ingestion`, `/rules`, `/needs-review`, `/spaces`, `/documents`, `/audit`), notifications et mises à jour désactivées, onglets fermés.
- [ ] **O** — Alimentation secteur + batterie chargée sur les deux postes ; veille et économiseur d'écran désactivés.

### Données

- [ ] **Q** — `docker compose exec api sh scripts/e2e_reset.sh demo` exécuté sur le poste principal ; compteurs affichés = `expected` (classés ≈ 330, à revoir 35–45, corbeille 8, verrous 3, versions 5).
- [ ] **Q** — Dossier `demo-import/live/` (30 fichiers, dont 2 doublons volontaires) monté **en lecture seule** dans le conteneur api à **`/data/ingest`** (seul chemin conteneur, identique en e2e et en démo ; `INGEST_ALLOWED_ROOTS=/data/ingest`, tranché O 09/11, `spec-limite-upload.md` § 5) ; **non importé**.
- [ ] **Q** — Pré-OCRisation complète du corpus (worker actif jusqu'à file vide : `celery inspect active` vide, `ocr_content` non nul sur les PDF image) ; recherche P5 testée sur le mot-clé prévu (résultat attendu noté).
- [ ] **Q** — Règle 10 « Rapports financiers » **créée inactive** ; les ~15 documents cibles sont bien « à revoir ».
- [ ] **B** — **Sauvegarde fraîche** après le reset et la pré-OCRisation : `ops/backup.sh` (répertoire horodaté `backups/ged237-…/` sur l'hôte, `SHA256SUMS`) copié sur la clé USB et sur le poste de secours ; `restore.sh --wipe` rejoué sur le poste de secours (c'est ainsi qu'on le synchronise : **il est le point de reprise**).
- [ ] **O** — Journal d'audit vidé des traces de préparation ou date de filtre convenue pour P7 (sinon le journal montre les actions de Q).

### Comptes et accès

- [ ] **P** — Mots de passe des 5 comptes de démo (`admin`, `manager`, `collab`, `reader`, `auditor` @minfi) connus de P, **jamais dans un fichier du dépôt** ; gestionnaire de mots de passe ou fiche papier dans la pochette.
- [ ] **P** — Procédure OTP répétée : lecture du code dans la réponse (`development`) ou dans Redis ; un **OTP faux volontaire** prévu en P1 et compté dans la limite (3 connexions + 4 OTP max par minute dans le déroulé).
- [ ] **P** — Si un compte est verrouillé pendant la démo (3 codes OTP erronés → 423 pendant 15 min, lot 3b) : suivre `DOCS/exploitation/deverrouiller-compte.md` (arrive avec #83) ; en répétition, ne jamais dépasser 2 OTP faux sur le compte de démo.
- [ ] **P** — Ordre des changements de compte affiché sur une fiche : collab → admin → collab → admin → manager → collab → reader → collab → auditor.

### Arrêt de la veille

- [ ] **Q** — **Worker OCR arrêté** (`docker compose stop worker`) après la pré-OCRisation ; l'import en direct P2 n'a donc pas d'OCR : vérifier que les compteurs d'import et le classement ne dépendent pas du worker (sinon laisser le worker actif avec `--concurrency=1` et le noter).
- [ ] **B** — **Redis et backend de résultats Celery sains** avant la démo : `CELERY_BROKER_URL` et `CELERY_RESULT_BACKEND` du conteneur api pointent vers le Redis de la pile (`redis-cli ping` = `PONG` depuis l'api). Sinon la validation d'un import reste bloquée sans message (LESSON-2026-026) ; test : un import d'un fichier en P2 répété la veille.
- [ ] **O** — Pile laissée **éteinte** la nuit (`docker compose stop`, pas `down -v`) ; redémarrage chronométré le matin (< 3 min attendu).

## C. J0 — lundi 30/11

### H-90 min (sur place)

- [ ] **O** — Branchement écran/projecteur, résolution 1920×1080, test de lisibilité du dernier rang.
- [ ] **O** — `docker compose up -d --pull never` ; `GET /health` OK ; login `collab@minfi` + OTP + déconnexion joués une fois (chauffe des caches, vérification de la limite auth : pas de 429).
- [ ] **O** — Poste de secours allumé, pile démarrée, login joué, puis laissé en veille écran seulement.
- [ ] **P** — Fiche de déroulé (minute par minute, `plan-presentation.md` § 1) et fiche des comptes à portée de main ; chronomètre.

### H-30 min

- [ ] **O** — Vérification des 4 écrans « sensibles » : `/rules` (règle 10 inactive visible), `/needs-review` (compteur), `/spaces` DAF (pagination), `/audit` (filtre date prêt).
- [ ] **O** — Seed vérifié : connexion `MGR001` réussie après le seed explicite (le compose ne seed pas ; `jeu-donnees-demo.md` § 2), puis déconnexion.
- [ ] **Q** — Rapport Playwright du plan B ouvert dans un second onglet (local, `file://`), captures des 8 parcours vérifiées.
- [ ] **O** — Téléphones en silencieux, notifications système coupées, Docker Desktop réduit (pas de fenêtre « mise à jour disponible »).
- [ ] **O** — Point de reprise vérifié : `/health` = 200 sur les deux postes, même nombre de documents affiché sur `/spaces` DAF (poste de secours = restauration de la sauvegarde J-1).

### Pendant (P présente, O au clavier de secours)

- [ ] **O** — Si un écran casse : **une** tentative (F5), sinon bascule sur le poste de secours (< 60 s), puis plan B captures si la bascule échoue ; **jamais** de redémarrage de conteneur en séance.
- [ ] **P** — Pas plus de 4 connexions par minute ; si 429 : attendre 60 s en commentant l'écran courant.
- [ ] **O** — Aucune purge définitive (`DELETE /purge`) pendant la séance. **Si une purge ou une suppression définitive part quand même** : aucune restauration en séance ; bascule sur le poste de secours (état J-1) ; P commente « en corbeille, restaurable par l'administrateur » sans le faire en direct ; restauration du poste principal après la séance (`sauvegarde-restauration.md` § 6.5).

### Après

- [ ] **B** — Sauvegarde post-démo (`ops/backup.sh`) pour conserver l'état montré ; journal d'audit exporté en SQL pour le compte rendu.
- [ ] **O** — Compte rendu : questions du jury non prévues ajoutées à `plan-presentation.md` § 4 ; incidents → `DOCS/engineering/lessons-learned.md`.

## F. Variante VPS — **sans objet** (VPS écarté par le PO le 2026-11-09)

Conservée pour mémoire : si la décision était rouverte, il faudrait OCR-1 avant le gel, limites mémoire réduites, Caddy + certificat 48 h avant, test de charge 2 utilisateurs, réseau de la salle vérifié J-1, repli = poste principal en local. Aucune case à cocher.
