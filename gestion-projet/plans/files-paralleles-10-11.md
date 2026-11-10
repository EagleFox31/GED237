# Deux files de fusion parallèles — PR ouvertes au 10/11 13:00

- **Pour** : O (scinde la chaîne). Innovateur, 2026-11-10, sur `main` d82a4f1, non commité. `Vérifié` = `gh pr view N --json files` pour les 17 PR ouvertes ; `Déduit` = dépendances logiques lues dans les corps de PR et les fiches de lot. Lot 5 (B, pas encore ouvert) : fichiers supposés d'après la fiche.
- **Règle** : les deux files n'ont **aucun fichier en commun** ; à l'intérieur d'une file, l'ordre respecte les fichiers partagés et les dépendances. Une PR de la file B qui porte une spec e2e attend la fusion de sa PR backend (la CI e2e de la branche construit le backend de la branche) : ces points de synchronisation sont marqués « après #N ».

## 1. Recouvrements de fichiers (`Vérifié`)

| Fichier partagé | PR | Conséquence |
|---|---|---|
| `backend/app/api/v1/endpoints/audit.py` | #80, #83, #98 | série dans la file A |
| `backend/app/api/v1/endpoints/auth.py`, `services/auth_service.py` | #83, #98 | #98 rebasée après #83 (branche « code faux » de `verify_otp`, voir relecture #98) |
| `endpoints/classification.py`, `schemas/classification_admin.py`, `services/classification_rule_transfer.py`, `tests/api/test_classification_rules_transfer.py` | #79, #92 | #92 est empilée sur #79 : #79 d'abord |
| `docker-compose.yml` | #83, #94 | **pont entre back et front** : #94 (+11 lignes) fusionnée **en tête**, #83 rebase une ligne |
| `frontend/components/Sidebar.tsx` | #94, #93 | #93 après #94 |
| `frontend/App.tsx` | #97, #93 | série dans la file B |
| `frontend/services/index.ts` | #84, #87, #97 | série dans la file B |
| `services/resources/classification.api.ts`, `pages/gedrules/ClassificationSettingsTab.tsx` | #84, #95 | #95 après #84 (et après #92 côté back) |
| Fichiers à une seule PR | #88 (`LoginPage.tsx`), #90, #96 (docs), #91, #89 (une spec chacune), #99 (`HelpHint.tsx`, `Dashboard.tsx`, `OrgDashboard.tsx`) | libres |

Migrations : une seule, `a7c8d9e0f1b2` (#92). Lot 5 : la fiche ne prévoit pas de table ; si B en ajoute une, elle suit `a7c8d9e0f1b2` (file A, après #92).

## 2. File A — backend, compose, docs (`Déduit`)

| Ordre | PR | Pourquoi là | Rebase à prévoir |
|---|---|---|---|
| A1 | #94 version (F) | pont `docker-compose.yml` + `Sidebar.tsx` ; la plus petite, elle passe en premier pour ne gêner personne | aucun |
| A2 | #80 export CSV (B) | libère #87 (file B) | aucun |
| A3 | #83 verrou OTP (B) | libère #88 ; devant #98 | `docker-compose.yml` après A1 (une ligne) |
| A4 | #79 export/import des règles (B) | libère #84 puis #91 ; socle de #92 | aucun |
| A5 | #92 lot 4 (B) | empilée sur #79 ; libère #95 ; seule migration | aucun si #79 fusionnée telle quelle |
| A6 | #98 D3 audit (B) | `audit.py`, `auth_service.py` après #80 et #83 | branche « code faux » de `verify_otp` (ligne `login_failed` avant `_record_otp_failure`) |
| A7 | lot 5 surveillance (B, à ouvrir) | `workers/tasks.py`, `ingestion.py` après #92 ; dépend de D3 selon B | contre #92 si ouvert avant sa fusion |
| libre | #90 plan de recette, #96 checklist H-30 (I) | aucun fichier commun avec quiconque : à glisser n'importe quand dans la file A | aucun |

## 3. File B — frontend et e2e (`Déduit`)

| Ordre | PR | Attend | Pourquoi là |
|---|---|---|---|
| B1 | #88 verrou (F) | — (`LoginPage.tsx` seul ; pas de spec) | libre tout de suite ; l'écran 423 ne se voit qu'après A3, sans casser avant |
| B2 | #97 reconnexion (F) | — | `App.tsx`, `index.ts` : avant #93 et #84/#87 |
| B3 | #93 responsive (F) | **après A1 (#94)** pour `Sidebar.tsx` | `App.tsx` après #97 |
| B4 | #89 e2e responsive (Q) | après B3 (13/13 avec #93) | spec seule |
| B5 | #87 export CSV UI (F) | **après A2 (#80)** : sa spec appelle l'export backend | `index.ts` après #97 |
| B6 | #84 export/import UI (F) | **après A4 (#79)** : sa spec appelle les routes de transfert | `index.ts`, `classification.api.ts` |
| B7 | #91 e2e SC-V11-02 (Q) | après B6 | spec seule, dépend de #79 + #84 |
| B8 | #95 lot 4 UI (F) | **après A5 (#92)** et B6 | `ClassificationSettingsTab.tsx`, `classification.api.ts` après #84 |
| B9 | #99 aide V1.1 (F) | après B5, B6, B8 et B1 si F y ajoute les écrans export/import, CSV, verrou, règles | fichiers propres aujourd'hui (tuile) ; la version étendue touchera `ClassificationSettingsTab`, `AuditLogs`, `LoginPage` |

Chaque PR de la file B refait `merge origin/main` après chaque fusion de la file A (F le fait déjà) ; aucune n'a besoin d'une PR de la file B qui la précède, sauf par les fichiers partagés listés § 1.

## 4. Ce que ça donne (`Déduit`)

- Les deux files démarrent **tout de suite** : A1 (#94), puis A2/A3 d'un côté ; B1, B2 de l'autre. Quatre PR sont fusionnables sans attendre rien d'autre : #94, #80, #88, #97 (+ #90, #96).
- Points de synchronisation B ← A : B3 ← A1, B5 ← A2, B6 ← A4, B8 ← A5. Au rythme observé (13 min de CI par run), la file A tient en **3 à 4 h-s** de chaîne O, la file B en autant, en parallèle au lieu de 7 à 8 h-s en série.
- Vérification avant chaque fusion : `gh pr view N --json mergeable,mergeStateStatus` ; une PR `CONFLICTING` est renvoyée à sa session pour `merge origin/main`, jamais résolue par O.

Sources : `gh pr view N --json files,baseRefName` pour #80, #83, #79, #84, #87, #90, #91, #88, #92, #94, #95, #97, #96, #98, #99, #93, #89 (10/11 13:00) ; corps de PR #92, #95, #91, #89 ; relecture #98 (chevauchement `verify_otp` avec #83) ; fiche `innovateur/specs-v11-avant-gel/lot-5-surveillance-dossier.md` ; `PASSATION-dev-backend.md` 12:25 (lot 5 après D3).
