# Checklist d'exécution de la recette — ven 20 → lun 23/11

- **Pour** : Q (exécute et coche), O (relit, tranche), F et B (jouent leurs parcours). Q, 2026-11-16, sur `main` 35425db.
- **Rôle** : transforme `plan-recette-20-23-11.md` (calendrier, critères § 2, tri § 3, heure PO § 4) en liste cochable, avec pour chaque ligne la commande, la preuve à archiver et la mémoire requise. Elle n'ajoute aucun critère : en cas d'écart, le plan fait foi. Le plan de l'innovateur (#104 : restauration, HTTPS, `deroule-demo-https.md` § 4, `releve-coupure-19-11.md`) y est repris tel quel ; tant que #104 n'est pas fusionnée, ses lignes sont marquées **(#104)**.
- **Convention** : `[ ]` à faire, `[x]` fait avec preuve nommée, `[~]` partiel (écart noté), `[-]` sans objet (raison). Anomalie = `REC-nn` (plan § 3). Une ligne n'est cochée qu'avec sa preuve archivée dans `gestion-projet/recette/`.

## 0. Avant vendredi — pré-requis (jeu 19, avant 18:00)

| # | Ligne | Qui | Preuve |
|---|---|---|---|
| 0.1 | Mémoire libre ≥ 5 Go sur le poste (plateau Docker : une seule pile `edossier_*`, aucun conteneur d'un autre projet touché) | Q + O | `free` relevé dans le compte rendu |
| 0.2 | Sonde C6 démarrée au plus tard le mer 18 matin (`sh scripts/probe_stack.sh start`, #117) ; ≥ 6 relevés verts consécutifs du 17 matin au 19 soir = item 29 `partiel` | Q | `mesures-2026-11-20/c6.tsv` |
| 0.3 | Relevé de coupure rempli à 18:00 (commande de `releve-coupure-19-11.md` § 3), SHA reportés ; une ligne non fusionnée bascule en V1.1 | O | `releve-coupure-19-11.md` (#104) |
| 0.4 | Statuts relevés : #99, #100, #115, #116, #117, #108, #104 | O | relevé 0.3 |
| 0.5 | `main` figé : `git rev-parse origin/main` noté ; toute PR ultérieure est un `fix/rec-nn-*` | O | SHA dans l'en-tête du rapport run 1 |
| 0.6 | Rejeu manuel #105/#107 sur pile vierge fait (item 31 → `fait`) | Q | message à I avec commandes, messages, durées |

## 1. Vendredi 20 — matin (Q)

| # | Ligne | Commande / geste | Preuve | Mém. |
|---|---|---|---|---|
| 1.0 | Pile de recette vérifiée debout après le redémarrage de la veille (Docker passé de 12 à 16 Go à 18:15, arrêt de tous les conteneurs) | `docker compose ps` (tous les services `running`/`healthy`), `/health` en 200, connexion d'un compte de démo | état de la pile et durée du redémarrage | — |
| 1.1 | Pile neuve depuis `main` : `git clone` propre, `docker compose up -d --build`, attendre `/health` 200 | manuel d'installation `DOCS/exploitation/installation.md` | durées notées | 5 Go |
| 1.2 | Jeu D1 : `e2e_reset.sh demo` | `sh backend/scripts/e2e_reset.sh demo` (voir `DOCS/exploitation/donnees-demo.md`) | compteurs | — |
| 1.2 bis | **#485 fusionnée, `main` = 32c6552b** (ticket #483) : rattrapage des revues de classement pour les documents déjà en base. Se joue après chaque `alembic upgrade head` ou restauration (1.3, 3.9) | `docker compose exec api python scripts/sync_classification_reviews.py` (plan, sans écriture) ; même commande avec `--apply` ; un second `--apply` ne trouve plus rien à faire | sortie des trois passes | — |
| 1.3 | **Restauration n° 2** sur le poste de secours **(#104)** — **déplacée au 21/11, 09:00–10:00** (repli le 22, même créneau), voir 3.9 | `bash ops/backup.sh` ; `bash ops/restore.sh backups/ged237-<horodatage> --wipe` ; `alembic current` ; `/health` (version attendue) | `restauration-2026-11-21.txt` | 5 Go |
| 1.4 | Procédure « Retour arrière » des notes rc.1 jouée par la ligne 1.3 **(#104)** | mêmes commandes | mention dans 1.3 | — |
| 1.5 | **HTTPS** : mkcert (`DOCS/exploitation/https-local.md`), puis `sh scripts/prove_tls.sh` vert (`OK: HTTPS …`, code 0) | idem | sortie datée `recette/https-2026-11-20.txt` | 5 Go |
| 1.6 | Redirection : `curl -skI https://localhost:8443/api/v1/categories` → 307 dont `Location` garde `https` et `:8443` | idem | même fichier | — |
| 1.7 | WebSocket : poignée de main avec jeton valide → 101 ; sans jeton → refus | idem | même fichier | — |
| 1.8 | Version visible : pied de page / `/health` = `1.0.0-rc.1` attendue ou `dev` documenté (#94) | navigateur + `curl /health` | capture recadrée | — |
| 1.9 | Polices : woff2 servis en 200 avec bon type MIME ; aucun contenu mixte sur :8443 (#116) | `curl -sI` des 3 fichiers ; console navigateur | `https-2026-11-20.txt` | — |
| 1.10 | **Étape 8 de la démo, à la main** (le test automatique est reporté en V1.1) : document validé par visa ; `tenant_admin` le cherche dans la barre de recherche de l'en-tête, clique « Ouvrir <titre> » → l'URL devient `/documents?open=<id>` et la fiche s'ouvre ; « Archiver » puis « Oui, archiver » → badge « Archivé » ; fermer la fiche retire `?open=` | navigateur sur :8443 (après 1.5) ; statut contrôlé par `GET /api/v1/documents/<id>` = `archived` | capture recadrée de la fiche + statut dans `https-2026-11-20.txt` | — |

## 2. Vendredi 20 — après-midi

| # | Ligne | Qui | Commande / geste | Preuve |
|---|---|---|---|---|
| 2.1 | Run 1 **uat** puis **smoke**, **séparément** (le projet `validation-cycle` correspond aux deux ; les lancer ensemble consomme deux fois les tâches) | Q | `E2E_ARGS="--project=uat --retries=0 --reporter=dot" docker compose -p e2e1 -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e`, puis `down -v --remove-orphans`, idem `--project=smoke` | rapport HTML + traces archivés |
| 2.2 | #108 exécutée (E1 destination, D3 audit) ; `fixme` levés vérifiés | Q | `--project=uat` | résultat dans le rapport |
| 2.3 | 8 parcours rejoués **en HTTPS** à la suite, chronométrés, dans l'ordre P1, P2, P3, P6, P4, P5, P8, P7 **(#104)** | Q | `deroule-demo-https.md` § 2 | walkthrough daté (écarts, durées) |
| 2.4 | Même rejeu partiel sur le poste de secours **(#104)** | Q | autorité mkcert installée sur ce poste | walkthrough |
| 2.5 | C2 et C3 | Q | `measure_c2.py`, `measure_c3.py` (cf. `mesures-outillage.md`) | `c2-2026-11-20.txt`, `c3-2026-11-20.txt` |
| 2.6 | Compteurs D1 = section `expected` du manifeste | Q | `measure_counters.py` | `compteurs-2026-11-20.txt` |
| 2.7 | Recette manuelle P1, P2, P3, P6 | F | `deroule-demo.md` § 1 et § 1 bis | anomalies `REC-nn` |
| 2.8 | Recette manuelle P4, P5, P7, P8 + lots fusionnés (tuile doublons, export/import règles, CSV audit, verrou `UNIT001`, dossier surveillé si #100 : exige `INGEST_WATCH_FOLDERS` et le corpus monté sur `/data/ingest`, chemin live `/data/ingest/live`. **Écart connu tant que la PR de correctif de B (V1.0, après #171) n'est pas fusionnée** : les DOCX, XLSX, TXT et CSV déposés dans le dossier surveillé restent « non classés ». Le noter `REC-nn` « connu », pas comme une nouvelle anomalie. Les PDF et les images, eux, sont classés. P6 : 51 « à revoir » attendus, `expected.toReview`) ; verrou `ingest_watch:lock` libéré dans les logs du worker | B | idem | anomalies `REC-nn` |
| 2.8 bis | Preuve de l'item 19 (doublons) : un doublon ne se crée ni par un second dépôt (refusé), ni par nouvelle version, import par dossier ou CSV/ZIP | Q | 4 gestes : déposer `A.pdf` ; le mettre à la corbeille ; redéposer `A.pdf` (accepté, l'original est en corbeille) ; restaurer l'original. Attendu : deux documents actifs identiques, visibles dans la vue Doublons. **Rejoué par Q le 19/11 sur la vraie API (#171, 4b4741d6)** : la vue Doublons affiche 1 groupe de 2 avec le document à garder suggéré, et un 3e dépôt identique est refusé. La résolution du groupe depuis l'écran est prouvée avec #199 (fusionnée le 19/11 à 13:21, main = cffb7a4b, test duplicates.spec.ts) | capture de la vue Doublons |
| 2.9 | OCR-0 : un document déposé est classé via le worker démarré (ne se joue qu'avec le profil `worker`/`ocr` ; mémoire à vérifier avant) | Q | `--profile ocr`, SC-V11-04 si #92 + #95 fusionnées | rapport |
| 2.10 | Liste d'anomalies classée bloquant / majeur / mineur (plan § 3) | O | — | liste `REC-nn` |

## 3. Samedi 21

| # | Ligne | Qui | Preuve |
|---|---|---|---|
| 3.1 | Rejeu des parcours touchés par les correctifs de la veille | Q | rapport |
| 3.2 | Run 2 uat + smoke (séparés) | Q | rapport HTML + traces |
| 3.3 | Rejeu reset D1 : mêmes compteurs et mêmes SHA-256 qu'au run 1 | Q | `compteurs-2026-11-21.txt` |
| 3.4 | Checklist H-30 (`innovateur/checklist-demo.md` § C) jouée en entier : login, OTP, `/health`, pas de 429, limite auth `30/minute` ; ajouter : certificat mkcert valide, `prove_tls.sh` vert | Q | `h30-2026-11-21.md` |
| 3.5 | Recette croisée : F rejoue les parcours de B, B ceux de F | F, B | anomalies |
| 3.6 | Heure PO (16:00–17:00 proposé, à confirmer) : 10 étapes du plan § 4 | PO, O | verdict par parcours dans `matrice-recette.md` |
| 3.7 | **Sonde C6 : 10/10** relevés matin/soir (17–21) → item 29 `fait` ; sinon `partiel` avec le relevé KO | Q | `c6.tsv`, ligne C6 de `criteres-acceptation.md` |
| 3.8 | E3 (verrou OTP) rejoué après #83/#88 : 3 codes faux → session bloquée | Q | rapport `auth-2fa` |
| 3.9 | 09:00–10:00 (repli le 22) : restauration n° 2 (ligne 1.3), sur une pile dédiée de la rc, jamais celle de la sonde C6 | Q | `restauration-2026-11-21.txt` |

## 4. Dimanche 22 — lundi 23

| # | Ligne | Qui | Preuve |
|---|---|---|---|
| 4.1 | Run 3 **seulement si** un correctif a été fusionné le 21 après le run 2 | Q | rapport |
| 4.2 | Relevé 18:00 : les 8 critères du plan § 2 cochés un par un, preuve par critère | Q | tableau ci-dessous |
| 4.3 | Message daté Q → O : GO ou NO-GO argumenté | Q | message + passation |
| 4.4 | 23/11, avant la séance — Prépa 1 : rapport du jour, jeu remis à zéro, dossier `live` présent ; compte jetable du verrou créé (`VERROU-23`, rôle reader), jamais un compte de la démo | Q | rapport + compteurs |
| 4.5 | Prépa 2 : MINFI002 soumet **deux** documents au visa de MGR001, depuis « Tableau de Bord » (« Mon Atelier ») : un à valider (SC-VAL-02), un à rejeter (SC-VAL-03, SC-VAL-04) | Q | capture de la corbeille de visa |
| 4.6 | UAT manuelle du 23 selon la fiche de passage `gestion-projet/innovateur/fiche-uat-manuelle-23-11.md` (branche docs/scenario-demo-30-11) : ★ indispensables (≈ 65 min), verrou après 3 codes faux en dernier sur `VERROU-23`. Q fournit à O pour le § 6 : SC-AUTH-03 (API), SC-ESP-01 (API), Corbeille exclue, SC-RED-04, SC-RED-05/06 ; constat SC-RED-01 (manager) | O, Q | fiche § 6 |

### Relevé des critères (lun 23, 18:00)

| Critère (plan § 2) | Preuve | État |
|---|---|---|
| 1. 0 bloquant ouvert, décision PO écrite par majeur | liste `REC-nn` | [ ] |
| 2. smoke + uat verts sur 2 runs consécutifs, sans `skip` ajouté | rapports runs 1+2 (ou 2+3) | [ ] |
| 3. Reset D1 identique (compteurs + SHA-256) | `compteurs-*.txt` | [ ] |
| 4. C2 ≥ 95 %, C3 p95 ≤ 2 000 ms | `c2-*`, `c3-2026-11-20.txt` | [ ] |
| 5. Restauration n° 2 prouvée ; `prove_tls.sh` vert et 8 parcours HTTPS (sinon repli HTTP, item 27 `partiel`) | `restauration-2026-11-21.txt`, `https-2026-11-20.txt` | [ ] |
| 6. H-30 rejouée sans incident | `h30-2026-11-21.md` | [ ] |
| 7. Heure PO faite | verdicts dans `matrice-recette.md` | [ ] |
| 8. CHANGELOG « Limites connues » complété avec le relevé du 19 | PR docs du 19 au soir | [ ] |

## 5. Garde-fous d'exécution (rappel)

- Une seule charge Docker à la fois ; plafonds mémoire conservés ; aucun conteneur d'un autre projet touché (`gedtest-*`, `cfao-*`, `fm-*`, `deploy-*`…).
- Mémoire libre < 1 Go : arrêt de la pile (`sh scripts/probe_stack.sh stop`) et message à O. Les lignes marquées 5 Go ne démarrent pas en dessous.
- Un spec qui se déconnecte ou verrouille un compte déclare `test.use({ freshLogin: true })` (sinon la session en cache meurt pour le worker).
- Aucun correctif pendant la fenêtre sans `REC-nn` (plan § 3) ; jamais de `--no-verify` sur `main`.
- Écrits dans `gestion-projet/recette/` : fichiers datés, jamais de mot de passe ni de clé mkcert.

## 6. Comportements de `main` à annoncer aux testeurs (ne pas les noter en KO)

Les comportements sans mention viennent du tri de l’audit du 19/11 (`innovateur/tri-audit-quotidien-fonctionnaire-19-11.md`). Ils sont connus et traités en V1.1. Les comportements marqués « audit du fonctionnaire » viennent du parcours joué le 19/11 sur f890b3cb (DEC-2026-013). Ils sont connus et partent en V1.1 chez F.

**Corrigés pour l'UAT (DEC-2026-013), si les PR sont fusionnées sur `main` avant le 23** : le bouton « Envoyer » reste visible dans la fenêtre de dépôt (#441, #450), et le menu « Tâches » affiche le nombre de tâches en attente (#442). Q note au relevé le SHA de `main` joué. Si l'une n'est pas fusionnée, le comportement d'avant reste annoncé ci‑dessous.

- **« Tâches & Suivi » valide en un seul clic, sans confirmation.** Préparer un document de rechange en attente (SC-VAL-03), et toujours cliquer d'abord sur « Voir le document ». Le tableau de bord, lui, demande une confirmation (audit du fonctionnaire).
- **Le dépôt se fait un fichier à la fois.** La fenêtre se ferme après chaque envoi. Sans #450 : à 1366×768, le bouton « Envoyer » peut sortir de l'écran ; faire défiler la fenêtre de dépôt. Le libellé « règle d'aiguillage » est affiché tel quel (audit du fonctionnaire).
- **Document rejeté.** Le motif se lit dans l'onglet « Circuit de Validation » de la fiche, pas sur la carte de « Mon Atelier ». Aucun bouton ne permet de le corriger et de le renvoyer, et le filtre « Statut » de « Mes Documents » ne propose pas « Rejeté ». C'est conforme à SC-VAL-04 (audit du fonctionnaire).
- **Pas de message de confirmation après un dépôt ou une soumission.** La fenêtre se ferme sans message : vérifier dans « Mes Documents » que le document est arrivé, sans le redéposer (audit du fonctionnaire).
- **Recherche sans accent.** « decret » ne trouve pas « Décret » : taper le mot avec ses accents (audit du fonctionnaire).
- **Rien n'est mémorisé d'un envoi à l'autre.** Le valideur est à choisir à chaque soumission, et l'institution à chaque connexion. « Soumettre » se trouve dans « Mon Atelier » (tableau de bord), pas dans « Mes Documents » (audit du fonctionnaire).
- **Le nom de l'expéditeur n'apparaît pas** dans le parapheur du tableau de bord ni dans « Tâches & Suivi » : ouvrir la fiche pour le voir (audit du fonctionnaire).
- **« Mes Documents » affiche les 100 premiers documents.** Un document au-delà n'est pas perdu. Sur cet écran, la barre de recherche en haut cherche dans tous vos documents, par titre, mot-clé ou catégorie. Pour un mot du texte d'un scan ou d'une photo, taper le mot dans la même barre depuis « Tableau de Bord ». Il n'y a pas de menu « Recherche ».
- **Pas de « Renvoyer le code ».** Si le code a expiré, recommencer la connexion.
- **Restaurer un document peut recréer un doublon.** La restauration depuis la corbeille ne vérifie pas les doublons. Le document se retrouve dans la vue « Doublons ». Ne pas le noter en KO (décision du PO, 19/11, 11:40).
