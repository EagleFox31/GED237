# Critères d'acceptation — ce que le PO vérifie le 14/11 et le 30/11 (I2)

- **Pour** : PO (lit un critère par scénario et dit oui/non), orchestrateur (verdict), Q/F/B (chaque critère dit comment il se prouve). Instruit par l'innovateur le 2026-11-09 20:10, sans exécuter de test.
- **Règle** : un critère = une phrase **observable** (ce qu'on voit à l'écran ou dans une réponse API), **une donnée de départ**, **une preuve** nommée. Les colonnes spec / responsable / date sont dans `matrice-recette.md` et ne sont pas répétées ici ; les deux fichiers partagent les mêmes ID.
- **Sources** : CDC fonctionnel (septembre 2025, `Phase de Conception/Cahier Charges Doc Manager.docx`, § 3.1, § 4, § 5), cadrage « Cdc + Plan + Budget » (21/09/2025, § 3, § 8 *Critères de recette*, § 9), `GUIDE_TEST_FONCTIONNEL.md` (37 scénarios : pré-conditions, séquence, exceptions E*, post-conditions, Partie 13 Go/No-Go), `AUDIT.md` (état V1, Lot C), `matrice-recette.md`, `parcours-demo.md`.

## 0. Mise à jour du 17/11 pour la recette du 20 au 23

- **Base** : `main` 33b2425 (#188, #198, #200 fusionnées), relevée en lecture seule. L'état ligne par ligne et les preuves sont dans `matrice-recette.md` § 0.3.
- **⚠ Avant le 15/11** : la colonne « Où on en est (09/11) » et les mentions « livré si fusionné le 19/11 » datent du 09 ou du 10/11. L'état à jour est le tableau 1 bis et les mentions « 17/11 » ajoutées dans les lignes.
- **Limite rc.1, code de connexion** : le code n'est pas reçu. Il est pré-rempli à l'écran et le cadre « Espace Démo Interactif » est visible (mode `development`, `matrice-recette.md` § 0.1). C'est une limite annoncée pour la recette et la démo du 30 ; elle est levée après le 30 pour une installation en production.
- **Récit de la démo du 30 (décision de O du 17/11)** : le narrateur est l'administrateur du ministère `MINFI001` ; le collaborateur `MINFI002` n'est plus joué en direct. Sur la rc.1 (relevé b701314), un collaborateur n'importe pas en masse et ne cherche que dans ses propres documents ; l'import, l'explorateur et la bannette sont réservés à l'administrateur. C'est le cloisonnement voulu : « l'administrateur prépare, chacun ne voit que ce qui le concerne ». Les critères du collaborateur restent recettés du 20 au 23 (SC-AUTH-01, SC-RED-01). Lignes corrigées le 17/11 : SC-ADM-08, SC-RED-01, SC-ADM-06, P3 étape 7, SC-LEC-01, SC-AUD-01, SC-VAL-01, SC-VAL-02. Parcours minuté : `scenario-demo-30-11.md` (branche `docs/scenario-demo-30-11`).
- **Hors rc.1** (PR gelées jusqu'après le 30) : corbeille à l'écran et annulation (#152, #181, #179, #182, #184), numérotation des rapports (#161), envoi du code par e-mail (#154), TOTP (#193). Les critères qui en dépendent ne sont **pas joués** pendant la recette. Liste complète : `matrice-recette.md` § 0.2.

## 1. Les sept critères de recette contractuels (cadrage § 8) traduits en mesures

Le PO n'a signé que ces sept lignes. Tout le reste (37 scénarios) en est la déclinaison.

| # | Critère signé | Mesure proposée pour le 30/11 | Où on en est (09/11) ⚠ avant le 15/11, voir 1 bis | Verdict possible |
|---|---|---|---|---|
| C1 | Front responsive, connecté à l'API en staging/local | les 8 parcours joués sur la pile Docker de démo à 1280×720 **et** 1024×768 sans élément hors écran (SMK-06/07 est précisément un échec de C1) | `Constaté` : modale « Nouveau Document » hors viewport à 1280×720 | GO si SMK-06/07 fermés et a11y SMK-01/02 corrigés |
| C2 | **≥ 95 % des documents classés selon les règles** | sur le jeu de démo (`jeu-donnees-demo.md` : 420 documents, 10 règles), après import : `classés à la destination attendue par le manifeste / (total − 12 doublons − needs_review attendus)` ≥ 0,95 (définition figée dans `protocole-mesures-criteres.md` C2 ; C2b = chiffre brut, informatif) ; lu dans le compteur « à classer » et `GET /spaces/documents?classification_status=` | `Déduit` : le moteur existe (AUDIT S2 fait), le taux n'a jamais été mesuré | mesurable le 20/11 (D1), pas avant |
| C3 | Recherche < 2 s en test | `took_ms` renvoyé par `GET /search` sur 10 requêtes figées du jeu de démo jouées 3 fois (30 mesures, protocole C3), p95 < 2 000 ms ; `time_total` bout en bout informatif ; mesure depuis la pile Docker avec les caps du compose | `Déduit` : TSVECTOR en place ; aucune mesure consignée | mesurable le 20/11 ; risque nul sur 420 documents |
| C4 | **Respect strict des droits par rôle** | SC-SEC-01/02 (ci-dessous) + SC-SEC-03/04 du smoke verts **sur `main`** ; aucune route admin accessible à un non-admin (`spec-garde-routes.md` GUARD-01..06) ; zéro 500 sur un 403 | **Rouge** : recherche non bornée au service (ordre 1, #42 ouverte), upload collaborateur 403 (SMK-04/05), reader perd ses documents sur 403 (SMK-10) | GO seulement après #42 + `fix/authz-collaborator` + garde (18/11) |
| C5 | Déploiement on-site opérationnel **et** accès démo en ligne | PO 09/11 : démo **sur place** ; « en ligne » devient `images docker save + poste de secours` (checklist-demo) ; VPS = écart annoncé (plan-presentation) | `Vérifié` : décision PO consignée | GO conditionnel : l'écart « pas de VPS » est annoncé, pas caché |
| C6 | Disponibilité ≥ 99 % pendant les tests de validation | sur la campagne S2 (17-21/11) : aucun redémarrage non expliqué de `api`, `postgres`, `redis`, `nginx` (le worker, éteint volontairement, est exclu) ; `/health` = 200 et `docker ps` `healthy` relevés matin et soir par Q (10 relevés, GO = 10/10, `probe_c6.sh` du protocole) | non mesuré | mesurable S2, 0 j |
| C7 | **Tests de restauration de sauvegarde réalisés et validés** | `restore.sh --wipe` sur base vierge → les 8 parcours rejouables, **deux rejeux datés (10 et 20/11)**, second passage sans écart (`sauvegarde-restauration.md` § 6.3-6.4) ; **jamais sacrifié** (D2 sacrifie l'automatisation, pas la restauration) | `Proposé` : prévu mer 18 (B) | GO si walkthrough daté de la restauration |

### 1 bis. Où on en est au 17/11 (`main` 33b2425)

| # | État sur `main` | Ce qui reste pour la recette |
|---|---|---|
| C1 | Modale et a11y corrigées (#45, #73) ; barre latérale repliée sous 768 px (#93) ; `uat/responsive.spec.ts` 375/768/1280 px (#89) | rejouer les 8 parcours à 1280×720 et 1024×768 |
| C2 | Jeu de démo déterministe (#70), scripts de mesure (#64) ; taux jamais mesuré | mesure le 20/11 |
| C3 | Scripts de mesure (#64) ; aucune mesure consignée | mesure le 20/11 |
| C4 | Rouge du 09/11 levé : #42, #46, #47, #48 fusionnées ; menu admin sans page introuvable (#198, GUARD-07) ; rapports et compteurs bornés au périmètre (#177, #188). **Réserve** : la portée du responsable d'unité (#195) est gelée, décision PO attendue | jouer SC-SEC-01 à 04 ; noter la réserve `unit_admin` |
| C5 | HTTPS local (#109) ; navigateur sans Internet (#116, #122, #126, #139, #146) ; images de la pile exportables pour un démarrage hors ligne (#144) ; VPS remplacé par l'installation sur site, **à accepter par le PO le 23** (item 28) | essai P2 après le 24 |
| C6 | Sonde `probe_c6.sh` (#106, #117), synthèse par demi-journée (#142) ; frontend redémarré après un reboot de l'hôte (#200) | chiffres de Q le 19 avant 12:00, puis relevés du 20 au 23 |
| C7 | Rejeu de restauration n° 1 le 10/11 (#61, #62) | rejeu n° 2 le 20/11, sans écart |

Hors contrat mais dans le CDC 2025 § 3.1, donc attendus par le jury : tri automatique par type/nom/date/**contenu** (contenu = OCR → DEC-003, V1.1, écart 14), surveillance automatique d'un dossier (non livré : import manuel du dossier, écart à ajouter si absent de la liste des 15), tags (absent), historique des actions (P7). **Révision du 10/11** (DEC-002) : critères contenu/date des règles et surveillance continue réouverts, **livrés si fusionnés le 19/11 18:00, sinon V1.1** ; même règle pour l'export/import des règles (C2 inchangé) et le compteur KPI doublons (SC-ADM-08 inchangé).

## 2. Critères par scénario (mêmes ID que `matrice-recette.md`)

Format : **Donnée** → **Action** → **Alors** (observable) ; *Exception du guide reprise* quand elle est démontrable ; **Preuve**. Les comptes sont désignés par leur rôle et leur identifiant du guide (jamais le mot de passe).

### P1 — Connexion (SC-AUTH)

| ID | Critère vérifiable | Preuve |
|---|---|---|
| SC-AUTH-01 | Compte collab MINFI002 actif → identifiant + mot de passe + code (**rc.1 : code pré-rempli à l'écran, non reçu**, § 0) → le tableau de bord **du profil collab** s'affiche en < 5 s, l'institution affichée est MINFI (D5). *E1* : mauvais mot de passe → « Identifiants invalides » sans dire lequel, pas de session. | e2e `auth` + `uat/auth-2fa` |
| SC-AUTH-02 (sens démo) | OTP erroné → « Code invalide », nouvelle saisie possible, `sessionStorage` sans `access_token`. *E3* : 3 OTP ratés → retour à la connexion (si la limite `AUTH_OTP_RATE_LIMIT` est celle de la démo, pas celle de la pile e2e à 30/min : **à acter**, D4 du point S1). **Révision du 10/11** (DEC-002) : verrou par compte après 3 OTP réouvert, livré si fusionné le 19/11 18:00 (E3 devient alors « compte verrouillé, message explicite »), sinon V1.1. **17/11 : livré** (#83, #88) → *E3* : 3 codes faux → compte verrouillé 15 min, écran avec compte à rebours. Preuve e2e encore en `fixme` (`auth-2fa.spec.ts:83`) : à lever ou à prouver à la main sur un compte dédié. | e2e (ou manuelle) |
| SC-AUTH-03 | Déconnexion → `/login`, bouton Précédent ne rouvre pas l'application, `GET /documents` avec l'ancien jeton → 401 (blacklist Redis). | e2e + API |
| P1 étape 5 | F5 sur n'importe quelle page connectée → même page, même profil, sans passage par `/login`. | e2e |

### P2 — Import et classement (SC-ADM-08, SC-RED-01, SC-E2E-01)

| ID | Critère vérifiable | Preuve |
|---|---|---|
| SC-ADM-05 (partiel) | `/rules` liste au moins la règle de démo avec priorité et état **Active** avant l'import. | e2e |
| SC-ADM-08 | Dossier de démo monté dans l'api (N fichiers dont 2 doublons et 2 hors règle) → « Importer » (**17/11** : `MINFI001`, menu « Import en masse », bouton « Importer les documents » ; assistant réservé à l'administrateur) → compteurs **importés = N−2, doublons = 2, à revoir = 2**, en moins de 60 s pour ≤ 50 fichiers. *E (guide)* : chemin hors racine autorisée → 403 (`spec-limite-upload.md` § 5, après correctif B) ; fichier > limite → refus expliqué (413, `spec-limite-upload.md`). | e2e réel (montage à vérifier par Q) |
| SC-E2E-01 (partie classement) | Les N−4 fichiers couverts par la règle apparaissent dans `/spaces` sous service → domaine → activité → année attendus ; `classification_status=classified`. **Critère C2 local** : ≥ 95 % des fichiers couverts. | e2e |
| P2 étape 8 | Ré-import du même dossier → importés = 0, doublons = N, aucun document créé (compte `GET /documents` inchangé). | API ou manuelle |
| SC-RED-01 | Collab dépose un PDF < 1 Mo avec titre et catégorie → le document existe en **Brouillon**, visible par son auteur, **et** par un autre collab du même service en lecture seule ; `POST /documents/upload` → 201 (SMK-04 ferme). **17/11 (b701314)** : un collaborateur ne lit que ses propres documents (`documents read_own`, `search.py` l. 50-55). Critère corrigé : visible par son auteur, **pas** par un autre collab du même service. Visibilité d'un brouillon par le manager du service : `À vérifier` en recette. Hors démo en direct. *E1* : fichier > limite → message avec la limite. | e2e |

### P3 — Simulation de règle (SC-ADM-05/06)

| ID | Critère vérifiable | Preuve |
|---|---|---|
| SC-ADM-05 | Règle « si nom contient X et type PDF alors domaine D, activité A » enregistrée → visible dans la liste, **inactive** par défaut. | e2e |
| SC-ADM-06 (sens démo) | « Simuler » (**17/11** : étape « Simulateur » du « Plan de classement ») sur la règle inactive → tableau *document / destination actuelle / destination proposée* avec ≥ 1 ligne ; **aucun** document n'a bougé (`GET /spaces/documents` identique avant/après). | e2e + API |
| P3 étape 7 | Activer puis « Relancer le workflow » (**17/11** : à l'écran, « Classer et relancer » dans « Ma bannette », par `MINFI001`) sur un document à revoir → sa destination devient celle de la règle ; une entrée d'audit `document.reclassified` (ou équivalent) existe. | manuelle (ou `manual-review`) |

### P4 — Espaces (SC-LEC-02, SC-ESP-01)

| ID | Critère vérifiable | Preuve |
|---|---|---|
| SC-LEC-02 | Manager MGR001 → arbre service → domaine → activité → année → clic document → fiche avec métadonnées, bouton Télécharger renvoie le fichier d'origine (même taille, même hash). | e2e |
| SC-ESP-01 (filtres) | Choisir domaine puis activité (liste dépendante) puis année → **une requête** `GET /spaces/documents?domain_id&activity_id&year` par changement, liste et compteur `X-Total-Count` cohérents ; « Réinitialiser » vide l'URL ; valeur invalide dans l'URL ignorée sans erreur. | e2e (`waitForRequest`) + API #38 |
| Pagination | > 50 résultats → page 2 charge `offset=50`, compteur inchangé. **17/11 : livrée (#78), plus sacrifiable.** | API (`uat/spaces-filters`) + manuelle à l'écran |

### P5 — Recherche et cloisonnement (SC-LEC-01, SC-SEC-01/02)

| ID | Critère vérifiable | Preuve |
|---|---|---|
| SC-LEC-01 | ~~Collab DAF~~ **17/11 : manager DAF `MGR001`** (un collaborateur ne cherche que dans ses propres documents) cherche un terme présent dans 3 documents DAF → 3 résultats, `took_ms` affiché **< 2 000** (C3), clic ouvre la fiche ; consultation tracée dans l'audit (post-condition du guide). | e2e |
| Corbeille exclue | Un des 3 documents mis en corbeille → la même recherche renvoie 2 résultats ; `GET /search` ne contient pas son id. **Mise en corbeille à l'écran : hors rc.1** ; seule l'exclusion côté API est prouvée. | API #42 |
| SC-SEC-01 (sens démo : service) | Lecteur DSI cherche le même terme → **0** résultat DAF ; `GET /search` → 200 avec liste vide, **jamais** 500. | API #42 + e2e |
| SC-SEC-02 (sens démo : tenant) | Depuis MINFI, un terme présent seulement dans MINESUP → 0 résultat ; `GET /documents/{id}` d'un document MINESUP → 404 ou 403, pas de fuite de titre. Guide SC-SEC-01 « aucune fuite d'information » = ce critère. | API |
| SC-SEC-03/04 (smoke) | Reader : pas de bouton « Nouveau Document », `POST /documents/upload` → 403 ; auditeur : écriture → 403 **et l'écran reste utilisable** (SMK-10 : un 403 sur `/tenants/{id}` ou `/categories/` ne vide pas la liste). | e2e |

### P6 — Revue manuelle (SC-ADM-07)

| ID | Critère vérifiable | Preuve |
|---|---|---|
| SC-ADM-07 | 2 documents « à revoir » avec raison lisible (« aucune règle », « conflit ») → choisir service/domaine/activité/année → « Résoudre » → le document disparaît de la file, apparaît à destination dans `/spaces`, compteur « à classer » −1, entrée d'audit avec l'auteur. Post-condition guide « l'apprentissage peut s'enrichir » : **hors périmètre**, à dire au jury. | e2e |

### P7 — Audit (SC-AUD-01, SC-ADM-09)

| ID | Critère vérifiable | Preuve |
|---|---|---|
| SC-AUD-01 | AUDIT001 ouvre `/audit`, filtre agent = MINFI002 et jour = aujourd'hui (**17/11** : page « Registre Des Actions », filtre de la colonne « Effectuée par » sur le nom de `MINFI001`, qui joue P2, P3 et P6 ; pas de filtre par date à l'écran, les entrées du jour sont en tête) → les actions des parcours P2, P5, P6 jouées ce jour apparaissent (dépôt, consultation, revue ; la mise en corbeille est hors rc.1), chacune avec horodatage, auteur, objet ; l'auditeur n'a aucun bouton d'écriture. Guide Go/No-Go : « la piste d'audit reflète fidèlement chaque action de chaque scénario » → **critère transverse** : chaque ligne des tables ci-dessus qui modifie un document produit une entrée. | e2e `uat/audit-trail` |
| SC-ADM-09 (D3) | Connexion, dépôt, import génèrent chacun une entrée (3 lignes pour login + upload + ingest). | pytest B4 + e2e (`fixme` levé) |
| SC-AUD-02 | **17/11 : livré** (#80, #87). AUDIT001 filtre `/audit` sur un agent → « Exporter (CSV) » → le fichier contient les événements du filtre, avec horodatage, auteur et objet. **Limite** : un utilisateur à la fois. ~~Non livré, V1.1 (D4, écart 8).~~ | e2e `uat/audit-export` (téléchargement d'un CSV UTF-8, séparateur `;`) ; contenu égal au filtre : **manuelle** |

### P8 — Cycle de validation (SC-VAL-01..04) et cycle de vie API

| ID | Critère vérifiable | Preuve |
|---|---|---|
| SC-VAL-01 | MGR001 ouvre « En attente » (**17/11** : page « Tâches & Validations ») → voit le document soumis par MINFI002 (préparé avant la séance, pas en direct) avec l'étape courante ; aucun bouton de modification du contenu. | e2e `uat/validation-cycle` |
| SC-VAL-02 | « Viser » (**17/11** : bouton « Valider ») → statut passe à l'étape suivante (ou Validé/Signé selon le circuit `E2E-WF-VALID`), le rédacteur **ne peut plus modifier** (PUT → 403 ou 409), audit : décision + auteur (post-condition guide). | e2e + API |
| SC-VAL-03 | « Rejeter » avec motif obligatoire (vide → refus) → statut **Rejeté**, motif visible par le rédacteur, document figé (guide : « ne peut être ni modifié ni repris »). | e2e |
| SC-VAL-04 | **Réduit le 09/11 (VAL-D3, « retour pour correction » → V1.1, écart 17)** : le rédacteur rouvre le document → statut **Visé** ou **Rejeté** et le **motif** visibles, aucune action de modification offerte ; notification « Lue » après ouverture (SC-NOT-01) **si** le composant existe, sinon critère réduit à la bannière/compteur. Le sens guide (statut À corriger, nouvelle version) devient critère V1.1. | e2e |
| SC-RED-05/06 (API) | `DELETE /documents/{id}` → `deleted_at` posé, absent des listes et de la recherche, `POST .../restore` par l'admin du ministère → revient (guide : « récupérable par l'administrateur du ministère »). UI absente → **écart annoncé** ; écran Corbeille et annulation **hors rc.1** (#181, #179, #182, #184). | pytest |
| SC-RED-04 (API) | Nouvelle version → `version` +1, l'ancienne reste lisible dans « Historique des versions », verrou d'édition refuse une écriture concurrente (409). UI dépôt de version absente → écart annoncé. | pytest |

## 3. Scénarios du guide **hors** démo : ce qu'on dit au jury

Le guide impose (Partie 13) « tous les scénarios de la Partie 2 pour tous les rôles » et SC-E2E-01 **complet** (jusqu'à la signature). Décalage à assumer explicitement le 30/11 :

| Groupe | Scénarios | Traitement proposé |
|---|---|---|
| Signature finale, scellement | SC-VAL-05, SC-E2E-01 (fin), SC-SEC-03 | **écart 2/4** du plan de présentation (signature → V1.1) ; critère de repli : le cycle s'arrête à « Validé », l'état est figé et tracé |
| Vue d'ensemble, indicateurs, export | SC-ADM-01, SC-ADM-02, SC-PLAT-01 | ⚠ 09/11 : « `/reports` hors V1 ». **17/11** : menu Rapports livré, borné au périmètre de l'appelant (#175, #177, #188), `uat/manager-reports` (3 tests) ; à jouer avec un manager. Rapport numéroté **hors rc.1** (#161) |
| **Hors rc.1** (gelées jusqu'après le 30) | corbeille à l'écran et annulation, numérotation des rapports, envoi du code par e-mail, TOTP | non recettés ; annoncés comme suite au jury ; liste dans `matrice-recette.md` § 0.2 |
| Structure, comptes, affectation | SC-ADM-03, SC-ADM-04, SC-RESP-01, SC-RESP-02 | hors parcours ; critère unique « un compte créé peut se connecter » couvert par le seed |
| Plateforme / Casbin | SC-PLAT-02..04 | super-admin seul ; démontrable si temps, non recetté |
| Session prolongée | SC-AUTH-02 (sens guide) | refresh silencieux : non démontré en direct ; preuve = `fetchWithRefresh` dans le smoke `auth` si un test l'exerce (`À vérifier` F) |
| Notifications | SC-NOT-01 | couvert partiellement par SC-VAL-04 |
| Profil collaborateur (17/11) | SC-AUTH-01, SC-RED-01 | recettés du 20 au 23, pas joués en direct (narrateur `MINFI001`) ; au jury : « l'administrateur prépare, chacun ne voit que ce qui le concerne ; un agent n'importe pas en masse et ne cherche que dans ses documents » |

## 4. Ce que le PO lit le 14/11 et le 30/11

- **14/11** : § 1 ligne C4 (droits) doit être passée de rouge à « corrigé sur `main` » ; § 2 P1, P2, P3, P6, P7 : chaque critère avec un run vert daté (matrice colonne État) ; P4, P5, P8 : état réel et date.
- **30/11** : § 1 complet (C2, C3, C6 mesurés sur le jeu de démo du 20/11 ; C7 walkthrough de restauration) ; § 2 toutes lignes GO ou **écart annoncé** ; § 3 relu pour que rien ne soit découvert par le jury.
- Un critère qui n'a ni preuve ni ligne dans § 3 le 21/11 (GO/NO-GO) est un **NO-GO** du parcours, pas une « réserve ».

## Sources

CDC 2025 § 2-5 ; cadrage 21/09/2025 § 3, § 8, § 9 (texte extrait du `.docx`, le PDF n'étant pas lisible ici) ; `GUIDE_TEST_FONCTIONNEL.md` l. 44-760 (post-conditions l. 64-758, exceptions E1-E4 l. 72-75, 97, 145, Go/No-Go l. 768-776) ; `AUDIT.md` l. 61-75, 116-120 ; `innovateur/matrice-recette.md`, `parcours-demo.md`, `spec-garde-routes.md`, `spec-espaces-filtres-ui.md`, `spec-limite-upload.md`, `sauvegarde-restauration.md`, `jeu-donnees-demo.md`, `checklist-demo.md`, `plan-presentation.md` ; `PASSATION-ci-qa.md` l. 71-80 (SMK).
