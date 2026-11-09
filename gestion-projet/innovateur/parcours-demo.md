# Parcours de démo — 8 parcours cibles (ordre 3 de DEC-2026-002)

- **Statut** : PROPOSÉ (innovateur, 2026-11-09) → ged-dev-frontend (F) et ged-ci-qa (Q) pour exécution ; orchestrateur pour arbitrage du classement et des 3 décisions du § 3.
- **Niveaux de preuve** : `Vérifié` = lu dans le code ce jour (routes, specs, seed) ; `Constaté` = déclaré par l'audit fonctionnel du 2026-11-09 sans exécution ; `À vérifier` = point que F/Q doit confirmer en lançant l'application.
- **Sources** : `MATRICE_UAT_E2E_2026-07-22.md`, `frontend/e2e/specs/*` (25 specs), `frontend/App.tsx` (routes), `backend/app/api/v1/endpoints/*`, `backend/scripts/seed_db.py`, `backend/scripts/test_real_export_v2.py`.
- **Contraintes** : zéro mock réseau dans les 8 specs retenues ; exécution dans la pile Docker e2e (branche `ci/e2e-smoke`) ; `ENVIRONMENT=development` pour que le code OTP soit renvoyé dans la réponse de login (`Vérifié`, `auth_service.py`), sinon lecture du code dans Redis.

## 0. Socle commun (Vérifié)

| Élément | Valeur |
|---|---|
| Tenants seed | MINFI (démo principale), MINESUP (isolation) |
| Unités MINFI | DRH, DAF, DSI |
| Comptes seed | `admin@minfi` (tenant admin), `manager@minfi` (DAF, validateur), `collab@minfi` (DAF, rédacteur), `reader@minfi` (DSI, lecteur), `auditor@minfi`, super-admin plateforme ; mots de passe dans `seed_db.py` (ne pas copier ici) |
| Corpus démo | `test_real_export_v2.py` : 300–500 documents, 3 services, arborescence service > domaine > activité > année ; à générer le 20/11 (DEC-002) |
| Fixture e2e | `e2e/fixtures/auth.fixture.ts` → `loginAs(role)` ; à conserver comme unique point d'entrée d'authentification |
| Routes frontend | `/spaces`, `/rules`, `/needs-review`, `/ingestion`, `/audit`, `/documents`, `/admin/*` |

Point d'attention transverse (`Vérifié`) : le frontend n'expose **aucun bouton** « nouvelle version », « verrouiller », « corbeille », « restaurer ». Les routes backend existent (`documents.py` : `POST /{id}/trash`, `/restore`, `DELETE /{id}/purge`, `POST /{id}/versions`, `/lock`, `/unlock`, `GET /trash`, `GET /{id}/versions`) ; l'onglet « Historique des Versions » de `DocumentDetailModal` est en lecture seule. Conséquence : le parcours P8 se joue **API + écran**, ou exige un ajout UI (voir § 3).

**Limite de débit sur `/login` et `/verify-otp` (`Vérifié`, `endpoints/auth.py:35,71` : 5/min par IP hors `DEBUG`, fenêtre fixe slowapi, clé = adresse client) — note du 2026-11-09 pour la démo avec `DEBUG=false`.** Le déroulé enchaîne 9 connexions et 10 saisies OTP en 13 min (P1 collab + 1 OTP faux volontaire, P2 admin→collab, P3 admin, P6/P4 manager, P5 collab→reader, P8 collab, P7 auditor) ; pic autour de la minute 4 : 3 connexions + 4 OTP en 60 s, et **5 dès qu'une saisie échoue ou qu'on rejoue P1**, donc 5/min suffit de justesse à l'oral et **casse à coup sûr** la répétition du 27/11, le plan B Playwright (8 parcours connectés en < 2 min) et tout rejeu après incident, le 429 comptant lui-même comme tentative. Recommandation : exposer la limite par variable d'environnement (`AUTH_LOGIN_RATE_LIMIT`, `AUTH_OTP_RATE_LIMIT`, défaut **`5/minute` inchangé en production**), la régler à **`30/minute`** dans le compose de démo et e2e (0,25 j B, même PR que `DEBUG=false`) ; à vérifier au passage que derrière nginx la clé n'est pas l'IP du proxy (sinon toute la salle partage le même compteur).

## 1. Classement des candidats (valeur démo)

Critères : (a) répond à un critère CDC qu'il faut prouver, (b) visible par le PO en moins de 3 minutes, (c) faisable sans développement frontend nouveau, (d) couvre un ID UAT non encore `Vérifié`.

| Rang | Candidat | a | b | c | d | Retenu |
|---|---|---|---|---|---|---|
| 1 | Connexion + OTP + déconnexion | ✔ | ✔ | ✔ | ✔ | **P1** |
| 2 | Import de dossier + classement automatique par règle | ✔ | ✔ | ✔ | ✔ | **P2** |
| 3 | Simulation d'une règle avant activation | ✔ | ✔ | ✔ | ✔ | **P3** |
| 4 | Espaces : navigation + filtres C9 | ✔ | ✔ | dépend Lot C9 (ordre 4) | ✔ | **P4** |
| 5 | Recherche plein texte bornée au service, corbeille exclue | ✔ sécurité | ✔ | dépend ordre 1 | ✔ | **P5** |
| 6 | Revue manuelle d'un document non classé | ✔ | ✔ | ✔ | ✔ | **P6** |
| 7 | Journal d'audit (qui a fait quoi) | ✔ | ✔ | ✔ | ✔ | **P7** |
| 8 | Corbeille → restauration (cycle de vie) | ✔ | ✔ | ✘ (API) | ✔ | **P8** |
| 9 | Versionnage + verrouillage | ✔ | ✔ | ✘ (API) | ✔ | fusionné dans P8 (variante B) |
| 10 | Cycle de validation complet (rédacteur → validateur) | ✔ | ✔ | ✔ | ✔ | réserve : remplace P8 si l'UI corbeille n'est pas livrée |
| 11 | Isolation inter-tenant (MINFI ne voit pas MINESUP) | ✔ | ✘ (négatif, peu parlant) | ✔ | ✔ | intégré à P5 (étape 8) |
| 12 | Upload unitaire + refus de doublon | ✔ | ✔ | ✔ | partiel | intégré à P2 (étape 8) |

Correspondance avec la liste de DEC-002 (AUTH-01/02/03, RED-01, VAL-01, ADM-01, SEC-01, E2E-01) : AUTH → P1 ; RED-01/E2E-01 → P2 ; ADM → P3, P6 ; SEC-01 → P5 ; VAL-01 → réserve (candidat 10) ; AUD → P7. Les IDs de la colonne « UAT » ci-dessous sont ceux de la matrice ; F réaligne les `test.describe` sur ces IDs.

## 2. Les 8 parcours

### P1 — Connexion, code OTP, déconnexion

- **Rôle** : `collab@minfi` (rédacteur DAF).
- **Étapes** : 1) ouvrir `/login` ; 2) saisir e-mail + mot de passe → « Se connecter » ; 3) écran OTP : saisir le code (renvoyé dans la réponse en `development`, sinon lu dans Redis) ; 4) arrivée sur le tableau de bord du profil rédacteur ; 5) rafraîchir la page : session conservée ; 6) menu utilisateur → « Déconnexion » ; 7) retour sur `/login`, le jeton n'ouvre plus `/documents` (blacklist Redis).
- **Résultat observable** : nom et rôle affichés dans l'en-tête ; après déconnexion, redirection vers le login ; variante : code OTP faux → message d'erreur, pas de session.
- **UAT** : SC-AUTH-01 (connexion 2FA), SC-AUTH-02 (OTP erroné), SC-AUTH-03 (déconnexion/blacklist).
- **Spec** : `auth.spec.ts` à **réutiliser** (`Vérifié` : sans mock) ; ajouter le cas OTP erroné et la vérification post-logout.
- **Données** : seed uniquement. Preuve : `Vérifié`.

### P2 — Import d'un dossier et classement automatique par règle

- **Rôle** : `admin@minfi` pour la règle, puis `collab@minfi` pour l'import.
- **Étapes** : 1) admin → `/rules` → vérifier qu'une règle « Factures → DAF/Comptabilité » (critère type + nom de fichier) est **active** avec sa priorité ; 2) collab → `/ingestion` ; 3) étape 1 : choisir le dossier de démo (sous-ensemble du corpus, ~30 fichiers, 3 domaines) ; 4) étape 2 : lancer l'import ; 5) attendre la fin (compteur importés / doublons / en attente) ; 6) `/spaces` → DAF → Comptabilité : les factures sont rangées dans l'année attendue ; 7) un fichier sans règle apparaît dans `/needs-review` (prépare P6) ; 8) ré-importer le même dossier → tous refusés comme doublons.
- **Résultat observable** : compteur d'import, documents visibles dans la bonne arborescence, doublons refusés, reste à classer non nul.
- **UAT** : SC-ADM-08 (ingestion de répertoire), SC-RED-01 (dépôt rédacteur), SC-E2E-01 (chaîne import → classement).
- **Spec** : `ingestion.spec.ts` existe mais **mocke** l'API (`Vérifié`) → **réécrire** sans mock ; `bulk-upload.spec.ts` à fusionner ou retirer.
- **Données** : règle seed active ; dossier `demo-import/` de ~30 fichiers dont 2 hors règle et 1 doublon volontaire ; monté dans le conteneur backend (`/ingest-directory` lit un chemin serveur, `Vérifié`). Preuve : `Vérifié` (routes), `Constaté` (compteurs à l'écran).

### P3 — Simuler une règle avant de l'activer

- **Rôle** : `admin@minfi`.
- **Étapes** : 1) `/rules` → « Nouvelle règle » ; 2) condition : extension `.pdf` et nom contient « contrat » ; action : classer dans DRH/Contrats ; 3) « Simuler » ; 4) lire le tableau : documents qui seraient déplacés, destination actuelle vs proposée ; 5) ajuster un critère, re-simuler, observer la différence ; 6) « Enregistrer et activer » ; 7) `/needs-review` : « Relancer le workflow » sur un document concerné (`Vérifié` dans `ClassificationReviewPage`) → il prend la nouvelle destination.
- **Résultat observable** : liste de simulation non vide avec avant/après ; aucun déplacement tant que la règle n'est pas activée.
- **UAT** : SC-ADM-05 (création de règle), SC-ADM-06 (simulation).
- **Spec** : `rules.spec.ts` et `classification-admin.spec.ts` **mockent** `/simulate` (`Vérifié`) → **réécrire** un seul `rules-simulation.spec.ts` sans mock ; `rules-setup.spec.ts` sert de préparation.
- **Données** : corpus démo avec ≥ 5 PDF « contrat » répartis dans 2 services. Preuve : `Vérifié` (endpoints `classification.py:742` et `gedrules.py:458`, deux routes `simulate` : F confirme laquelle l'UI appelle), `Constaté` (écran avant/après).

### P4 — Espaces : parcourir, filtrer, paginer (Lot C9)

- **Rôle** : `manager@minfi` (DAF).
- **Étapes** : 1) `/spaces` ; 2) arbre : DAF → Comptabilité → 2025 ; 3) filtre type = « Facture » ; 4) filtre période ; 5) tri par date ; 6) pagination : page 2 sur un corpus de 500 ; 7) ouvrir un document → `DocumentDetailModal` : métadonnées, onglet « Historique des Versions », onglet workflow ; 8) « Télécharger ».
- **Résultat observable** : compteur de résultats cohérent après chaque filtre ; pagination serveur (une requête réseau par page) ; téléchargement.
- **UAT** : SC-LEC-02 (navigation espaces), SC-VAL-03 (consultation par le manager), critère CDC « arborescence service > domaine > activité > année ».
- **Spec** : `spaces.spec.ts` **mocke** (`Vérifié`) → **réécrire** sans mock après livraison de l'ordre 4 (B : API 13–14/11 ; F : UI 17/11). Avant cette date : spec limité à la navigation et à l'ouverture d'un document.
- **Données** : corpus complet 300–500 documents. Preuve : `Vérifié` (route `workspace`, modale), `Proposé` pour filtres/pagination (dépend du Lot C9).

### P5 — Recherche plein texte bornée au service, corbeille exclue (sécurité)

- **Rôle** : `collab@minfi` (DAF) puis `reader@minfi` (DSI).
- **Étapes** : 1) collab : barre de recherche de l'en-tête (`Header.tsx`, `Vérifié`) → « marché public » ; 2) résultats avec `took_ms` affiché (appui démo du critère < 2 s) ; 3) ouvrir un résultat ; 4) mettre un document DAF à la corbeille (API `POST /documents/{id}/trash`, ou UI si livrée) ; 5) relancer la même recherche : le document a disparu ; 6) se déconnecter, se connecter en `reader@minfi` (DSI) ; 7) même recherche : aucun document DAF dans les résultats ; 8) isolation tenant : un terme présent uniquement chez MINESUP ne renvoie rien.
- **Résultat observable** : même requête, deux listes différentes selon le service ; document en corbeille absent ; temps de réponse affiché.
- **UAT** : SC-LEC-01 (recherche lecteur), SC-RED-05 (recherche rédacteur ; collision d'ID à résoudre par F), SC-SEC-01 (cloisonnement service), SC-SEC-02 (cloisonnement tenant).
- **Spec** : `redacteur.spec.ts` (recherche en `skip`) et `security-isolation.spec.ts` à **réécrire** en `search-scope.spec.ts` ; dépend de l'ordre 1 de DEC-002 (B, PR le 11/11). Avant : le test échoue volontairement et documente la faille (gate non bloquant).
- **Données** : corpus avec le même terme dans DAF et DSI ; 1 document DAF à mettre en corbeille ; 1 document MINESUP avec un terme unique. Preuve : `Vérifié` (faille et plan de correction), `Proposé` (comportement après correctif).

### P6 — Revue manuelle d'un document non classé

- **Rôle** : `manager@minfi` ou `admin@minfi` (rôle autorisé sur `/needs-review` : `À vérifier`).
- **Étapes** : 1) `/needs-review` : les documents « sans règle » de P2 sont listés avec la raison ; 2) ouvrir un document ; 3) choisir manuellement service/domaine/activité/année ; 4) « Résoudre » (`POST /documents/{id}/resolve-review`, `Vérifié`) ; 5) le document quitte la liste ; 6) `/spaces` : il apparaît à la destination choisie ; 7) option : « Relancer le workflow » sur un second document après activation d'une règle (lien avec P3).
- **Résultat observable** : compteur « à classer » décrémenté ; document visible dans l'espace cible ; entrée d'audit créée (prépare P7).
- **UAT** : SC-ADM-07 (revue manuelle) ; critère CDC « ≥ 95 % classés » raconté comme « reste à classer visible et traitable ».
- **Spec** : `needs-review.spec.ts` et `classification-reviews.spec.ts` → **réutiliser** après retrait des `skip` et vérification de l'absence de mock (`À vérifier`).
- **Données** : 2 fichiers hors règle importés en P2. Preuve : `Vérifié` (routes, page), `Constaté` (déroulé écran).

### P7 — Journal d'audit : qui a fait quoi

- **Rôle** : `auditor@minfi`.
- **Étapes** : 1) `/audit` ; 2) filtrer sur `collab@minfi` et la journée ; 3) retrouver : connexion (P1), import (P2), mise en corbeille (P5), revue (P6) ; 4) ouvrir un document → historique → `GET /documents/{id}/audit-logs` (`Vérifié`) ; 5) exporter le journal (si `auditor-export.spec.ts` correspond à une fonction réelle : `À vérifier`) ; 6) tenter une écriture en auditeur (upload) → refus 403 visible.
- **Résultat observable** : chronologie complète de la démo dans le journal ; lecture seule du rôle auditeur.
- **UAT** : SC-AUD-01 (consultation du journal), SC-AUD-02 (export) si réel.
- **Spec** : `audit.spec.ts` et `auditor-export.spec.ts` → **réutiliser**, exécutés **après** P1–P6 dans le même run (dépendance d'ordre à déclarer dans le projet Playwright).
- **Données** : traces produites par les parcours précédents. Preuve : `Vérifié` (route, page), `Constaté` (filtres).

### P8 — Cycle de vie : corbeille, restauration ; version et verrou (variante B)

- **Rôle** : `collab@minfi` (ses documents) ; purge réservée à `admin@minfi`.
- **Variante A — corbeille/restauration** : 1) mettre un document à la corbeille ; 2) il disparaît des espaces et de la recherche (lien P5) ; 3) `GET /documents/trash` : il y figure ; 4) restaurer ; 5) il réapparaît à sa place avec ses métadonnées ; 6) admin : montrer que la purge existe et annoncer qu'elle est désactivée en démo (irréversible, DEC-002 ordre 5).
- **Variante B — version/verrou** : 1) verrouiller un document (`POST /lock`) ; 2) un second utilisateur du même service tente une modification → refus ; 3) déposer une nouvelle version (`POST /versions`) ; 4) `DocumentDetailModal` → « Historique des Versions » : V1 et V2 listées, V2 courante ; 5) déverrouiller.
- **Résultat observable** : liste corbeille puis retour du document ; historique à deux versions affiché dans l'UI existante.
- **UAT** : SC-RED-04 (versionnage), SC-RED-05/06 (corbeille, restauration ; IDs à réaligner), critère CDC « cycle de vie ».
- **Spec** : `redacteur.spec.ts` (cas en `skip` : « bouton absent », `Vérifié`) → **créer** `lifecycle.spec.ts` en API-first : appels `request` Playwright + assertions écran (espace, modale versions). `documents.spec.ts` sert de base.
- **Données** : 2 documents DAF dédiés (un par variante). Preuve : `Vérifié` (routes backend) ; **`À vérifier` pour l'UI** : aucun bouton corbeille/version/verrou dans le frontend ce jour.

## 3. Décisions demandées à l'orchestrateur

1. **P8 sans UI** : accepter une démo « API + écran » (requête à l'écran puis constat dans l'interface), ou ajouter au budget de F un **mini-menu d'actions** (corbeille, restaurer, nouvelle version, verrou) dans `DocumentDetailModal` : estimation 1 j-p, non prévu dans DEC-002. Si refusé et démo API jugée peu lisible pour le PO : remplacer P8 par le **cycle de validation** (candidat 10 ; `full-cycle.spec.ts` et `validation.spec.ts` existent, aucun ajout UI).
2. **Ordre d'exécution** : P1 → P2 → P3 → P6 → P4 → P5 → P8 → P7 (P7 lit les traces des autres). Les specs doivent être rejouables sur une base réinitialisée : Q fournit un script de reset (seed + corpus) avant chaque run.
3. **Deux routes `simulate`** (`classification.py`, `gedrules.py`) : F confirme laquelle l'UI appelle ; l'autre est signalée à B comme doublon.

## 4. Couverture obtenue si les 8 sont verts

| Parcours | IDs UAT passés en `Vérifié` |
|---|---|
| P1 | SC-AUTH-01, 02, 03 |
| P2 | SC-ADM-08, SC-RED-01, SC-E2E-01 |
| P3 | SC-ADM-05, 06 |
| P4 | SC-LEC-02, SC-VAL-03 |
| P5 | SC-LEC-01, SC-SEC-01, 02 (+ RED-05 si réaligné) |
| P6 | SC-ADM-07 |
| P7 | SC-AUD-01 (+ 02) |
| P8 | SC-RED-04, 05/06 |

Soit 17–20 scénarios sur 37 (contre 4 aujourd'hui), au-delà de la cible « 8/37 » de DEC-002 parce que chaque parcours enchaîne plusieurs scénarios de la matrice.
