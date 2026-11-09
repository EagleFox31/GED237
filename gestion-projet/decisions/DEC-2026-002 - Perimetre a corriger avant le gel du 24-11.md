# DEC-2026-002 — Périmètre à corriger avant le gel du 24/11 vs écarts à annoncer en démo

- **Statut** : ACCEPTÉ (PO, 2026-11-09 18:07) — périmètre des 6 écarts + amendements ci-dessous ; questions (c), (d), (e) acceptées ; (a) démo VPS/on-site et (b) B6 ouvertes jusqu'au 17/11 (hypothèse de travail : démo on-site Docker, VPS seulement si confirmé).
- **Source** : `walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md` (17–19 j-p d'écarts, top 10 § 2).
- **Capacité** (hypothèse orchestrateur, `Documenté`) : ~10 j-p de dev du 10 au 23/11 = `ged-dev-backend` (B) et `ged-dev-frontend` (F), 2 sessions × 10 jours ouvrés à rendement réel ≈ 0,5 j-p/jour/session (CI 13 min en Docker, une suite à la fois, revues, PR) ; `ged-ci-qa` (Q) en support e2e, hors compte.
- **Contrainte** : sécurité d'abord (rang 1 non négociable) ; gel fonctionnel le 24/11 ; après le gel, seules corrections de recette.
- **Vérifications faites ce jour** (`Vérifié`) : `search.py` sans contrôle de portée service ; `core/search/postgres_engine.py:82-97` filtre tenant + `org_unit_id` optionnel, aucun `deleted_at` ; `_can_read_document` (`documents.py:112-123`) porte déjà la règle service à réutiliser ; `MAX_UPLOAD_SIZE` défini (`config.py:46`) et jamais lu ; 25 specs e2e, aucun workflow Playwright.

## 1. Principe de tri

Un écart est **corrigé** s'il est (a) une faille de sécurité visible en démo, (b) un critère de recette CDC qu'on ne peut pas raconter sans preuve, ou (c) déjà engagé et à moins d'un jour de la fin. Tout le reste est **annoncé** honnêtement, avec un chiffre ou une capture, et inscrit au plan post-démo. Budget cible **≤ 9 j-p** pour garder 1 j-p de marge : la recette S2 révélera des défauts (risque « Déduit » de la fiche contexte).

## 2. Ce qu'on corrige (ordre, session, jours)

| Ordre | Écart (rang audit) | Session | j-p | Preuve de clôture attendue |
|---|---|---|---|---|
| 1 | **Recherche** : portée par service (réutiliser `_can_read_document` / `ORG_UNIT_READ_ROLES` dans le moteur) + `deleted_at IS NULL` + tests de bornes par rôle (1) | B | 1 | pytest : lecteur du service A ne voit aucun hit de B ; document en corbeille absent des résultats |
| 2 | **Plafond d'upload** : 413 pendant l'écriture par blocs (10) — même PR « sécurité » que l'ordre 1 | B | 0,5 | test 413 sur un fichier > `MAX_UPLOAD_SIZE` |
| 3 | **Parcours de démo e2e** : figer 8 parcours (AUTH-01/02/03, RED-01, VAL-01, ADM-01, SEC-01, E2E-01), réaligner les IDs, zéro mock, exécution Docker ; Playwright dans un workflow (branche `ci/e2e-smoke` de Q) (2) | F + Q | 3,5 | run Playwright vert daté, joint au walkthrough ; 8/37 UAT « Vérifié » |
| 4 | **Espaces** : filtres + pagination serveur, `SpacesPage` branchée (5, Lot C9 déjà en cours) | B | 2 | tests API filtres ; page qui pagine sur un corpus de 500 documents |
| 5 | **Sauvegarde / restauration** : `pg_dump` + archive du stockage, restauration rejouée sur base vierge, preuve datée (3) | B (script) + Q (rejeu) | 1,5 | walkthrough avec horodatage et checksum avant/après |
| 6 | **Garde de routes** par profil (9, Lot D13) — après décision B6 ; sinon garde minimale admin/non-admin | F | 0,5 | lecteur sur `/admin/*` → redirection ; e2e SEC |
| **Total** | | | **9** | marge 1 j-p |

Ordonnancement : B enchaîne 1 → 2 → 4 → 5 ; F enchaîne 3 → 6 ; Q porte l'infra e2e dès le 10/11 et le rejeu de restauration le 20/11.

## 3. Plan de capacité jour par jour (10 → 24/11)

| Jour | ged-dev-backend (B) | ged-dev-frontend (F) | ged-ci-qa (Q) |
|---|---|---|---|
| Lun 10 | PR sécurité dépendances (DEC-001, #31-bis) puis début recherche bornée | Inventaire des 8 parcours, réalignement des IDs AUTH/RED | Workflow Playwright Docker (`ci/e2e-smoke`), jeu de données e2e |
| Mar 11 | Recherche bornée + corbeille + tests de bornes → PR | AUTH-01/02/03 + RED-01 sans mock | Pile Docker e2e stable, premier run |
| Mer 12 | Plafond upload 413 → PR ; revue croisée | VAL-01, ADM-01 | Corrige l'infra selon retours de F |
| Jeu 13 | Lot C9 : filtres serveur `GET /spaces/documents` | SEC-01, E2E-01 | Run complet des 8 ; rapport d'écarts |
| Ven 14 | Lot C9 : pagination + tests API → PR | Correctifs des 8 parcours | Playwright dans la CI (gate non bloquant) |
| **Point S1** | *Livré : sécurité recherche/upload, Lot C9 côté API, 8 parcours verts en local. Alerte le jour même si l'un glisse de plus d'un jour.* | | |
| Lun 17 | Script `pg_dump` + archive du stockage ; doc de restauration | Brancher `SpacesPage` sur filtres/pagination serveur | Rejeu des 8 parcours sur `main` |
| Mar 18 | Restauration testée sur base vierge → preuve | Garde de routes (selon B6) | Recette élargie : les 13 scénarios couverts par l'API rejoués manuellement, défauts tracés |
| Mer 19 | Corrections de recette backend | Corrections de recette frontend | Recette, suite |
| Jeu 20 | Corrections ; jeu de données de démo (300–500 documents, 3 services) | Corrections ; code-splitting des 2 routes les plus lourdes si < 0,5 j, sinon annoncé | Rejeu restauration + 8 parcours sur le jeu de démo |
| Ven 21 | Marge (1 j-p partagée B/F) | Marge | Rapport de recette, verdict GO/NO-GO par parcours |
| Sam 22 – Dim 23 | Aucun engagement (tampon non planifié) | | |
| **Lun 24** | **Gel fonctionnel.** Tag release candidate ; ensuite correctifs de recette seulement. Démo VPS (si accord PO) : Caddy + compose plafonné en RAM le 24–25 ; répétition générale le 27. | | |

## 4. Ce qu'on annonce honnêtement en démo (et comment)

| Écart (rang) | Formulation proposée | Appui |
|---|---|---|
| Chiffres CDC non mesurés (6) | « Les trois objectifs chiffrés (≥ 95 % classés, recherche < 2 s, 100 k fichiers < 20 min) seront mesurés sur un corpus étalon en décembre ; aujourd'hui nous montrons le temps de réponse réel de la recherche sur le jeu de démo. » | `took_ms` à l'écran ; plan de mesure daté |
| Règles sans critère contenu/date, export/import absent (7) | « La V1 classe sur type, origine, nom et format ; les critères "contenu OCR" et "date" et l'export des règles sont le lot Mois 5 du CDC. » | écran règles + simulation |
| KPI doublons (8) | « La détection bloque les doublons à l'upload et à l'import (démo en direct) ; le compteur au tableau de bord arrive en V1.1. » | démo du refus d'un doublon |
| Surveillance continue d'un dossier (§ 1 n° 7) | « Ingestion d'un dossier à la demande ; le watcher continu est une option on-site à arbitrer. » | démo `/ingest-directory` |
| HTTPS / VPS (4) | Si accord PO : URL HTTPS via Caddy. Sinon : « démo on-site Docker, HTTPS porté par le reverse-proxy du client ». | question PO 1 |
| Disponibilité 99 %, docs d'exploitation (29, 31) | « Sonde `/health` disponible ; supervision et manuel d'exploitation livrés avec le pilote. » | `/health` |
| Responsive (24) | « Interface desktop-first ; mobile vérifié sur les écrans lecteur uniquement. » | 1 run Playwright mobile si Q dispose de 0,5 j, sinon annoncé |

Ne **pas** annoncer : le détail des constats B6, les 488 avertissements lint, les specs e2e historiques désalignées (dette interne, pas périmètre produit).

## 5. Trois questions à poser au PO (par l'orchestrateur)

1. **VPS de démo** : accord pour déployer GED237 sur le VPS OVH partagé (Caddy + compose, limites RAM ; le worker OCR EasyOCR/torch est le risque principal sur 3,7 Go) le 24–25/11, ou démo on-site Docker sur le poste de présentation ? Si VPS : OCR lourd désactivé ou Tesseract seul pour la démo.
2. **B6** : trancher `assignable-roles` sans RBAC, `standard` sans `users:update_own`, snapshot par `user_id` — ou reporter en V1.1 et n'appliquer que la garde de routes admin/non-admin (ordre 6). Réponse attendue avant le 17/11.
3. **Écarts annoncés** : valider la liste du § 4 (notamment « contenu OCR / date / export des règles » hors V1 et chiffres CDC mesurés en décembre). Si le PO exige l'un d'eux avant le 30/11, il retire l'équivalent en jours de la liste § 2 ; candidat à sacrifier : la sauvegarde automatisée, remplacée par un `pg_dump` manuel documenté (0,5 j).

## 6. Risques et réversibilité

- Le plan tient si la recette (18–20/11) révèle ≤ 1 j-p de défauts bloquants ; au-delà, l'innovateur propose une réduction (ordre de sacrifice : 6 → 5 → pagination de 4).
- Chaque correction est une PR séparée, revertable ; aucune migration de schéma nécessaire (les ordres 1, 2, 4, 5, 6 n'ajoutent pas de table — `Déduit` du code lu).
- Dérogation RAIDER-D : Playwright entre en CI en gate **non bloquant** jusqu'au 21/11, puis bloquant sur les 8 parcours (versionné dans le workflow).

## Résumé pour l'orchestrateur

Corriger 6 écarts pour 9 j-p (sécurité recherche + upload d'abord, 8 parcours e2e verts, Espaces serveur, sauvegarde testée, garde de routes) ; annoncer 7 écarts avec formulation et appui ; 3 questions PO (VPS/OCR, B6, liste annoncée). Gel le 24/11, 1 j-p de marge, ordre de sacrifice défini.

## Amendements acceptés avec la décision (2026-11-09)

- Migration de normalisation des rôles en minuscules (`001_initial_schema.py:67-72`) : obligatoire, 0,25 j B, mardi 11, test « `alembic upgrade head` seul puis login du compte seed », LESSON-2026-020.
- D3 journal d'audit sans connexion / dépôt / import : corrigé, 0,5 j B, mercredi 12 avec le plafond upload ; test « login + upload + ingest = 3 lignes visibles par l'auditeur ».
- D4 export du journal : annoncé en V1.1 (écart 8) ; SC-AUD-02 retiré de P7.
- Verrou par compte après 3 OTP erronés : abandonné et annoncé (écart 9 : « 5 tentatives/min par IP ; verrou par compte en V1.1 ») ; `DEBUG` vérifié faux sur l'environnement de démo.
- P8 (corbeille / version sans UI) : remplacé par le cycle de validation, 0 j.
- Budget : 9,75 / 10 j-p, marge 0,25 j. Ordre de sacrifice : 6 (garde de routes) → 5 (sauvegarde automatisée remplacée par pg_dump manuel documenté, 0,25 j) → pagination de 4.
