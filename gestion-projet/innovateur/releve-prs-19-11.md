# Relevé des PR du 19/11 (après 18:00)

- **Pour** : O. Ce relevé fixe l'état des PR au gel, avant la coupe de `release/v1.0.0`.
- **Contenu** : PR en file d'attente de fusion, PR post-rc1 et dépendances. Dependabot est exclu.
- **Outil** : `releve-prs-19-11.sh` (lecture seule, `gh pr view`) régénère le tableau du § 2. Les colonnes « relue Q », « ligne cible », « ordre » et « dépend de » sont tenues à la main dans le tableau `META` du script.
- **Règles appliquées** :
  - décision du PO du 17/11 : coupe sur le SHA de fusion de #104, puis main rouvre ;
  - du 20 au 23, ne fusionnent sur main que les PR déjà relues par Q ;
  - `plan-fusion-post-rc1.md` § 8.

## 1. Procédure du 19, après 18:00 (≈ 0,15 h-s)

1. Avant de lancer le script, relire les dernières entrées de `PASSATION-ci-qa.md` et `PASSATION.md` (O), puis mettre à jour `META` :
   - colonne relue Q : `oui`, `non` ou `réserves`, avec la ligne de passation qui le prouve ;
   - ordre et ligne cible, si O a décidé autrement.
2. Lancer `bash gestion-projet/innovateur/releve-prs-19-11.sh EagleFox31/GED237`, puis remplacer le § 2 par la sortie.
3. Contrôler les points de vigilance du § 3, puis consigner les écarts au § 4.
4. Faire un commit local et envoyer à O un résumé de 3 lignes : ce qui est fusionné, ce qui est prêt pour le 20, ce qui est bloqué.

## 2. Tableau (état du 2026-11-17 12:20, main = b701314)

Hors tableau : **#206** (déclencheurs `release/**` dans `ci.yml`), fusionnée le 17/11 à 11:09 UTC (e871532). Le préalable « pas de coupe avant la PR ci.yml de Q » est donc levé.

CI : V = checks verts, R = rouges, A = en attente, S = sautés. « Ordre » est l'ordre de fusion décidé par O le 17/11 (`plan-fusion-post-rc1.md` § 8.6). Chaque PR exige la relecture de Q et une CI verte.

| Ordre | PR | Groupe | Titre | Statut | Base | CI | Tête | Relue Q | Ligne cible | Dépend de |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | #208 | file | test(e2e): play the OTP lock and the V1.1 lots for real in t | MERGED 2026-11-17T11:17 | `main` | V7 R0 A0 S5 | `99742a3` | oui (verte, nightly verte, PASSATION-ci-qa l. 835, 841) | main avant la coupe, donc dans release/v1.0.0 | - |
| 2 | #104 | file | docs(release): notes v1.0.0-rc.1 et relevé de coupure — dépe | OPEN (brouillon) | `main` | V4 R0 A0 S7 | `7302e3c` | - | main, puis coupe release/v1.0.0 sur son SHA de fusion | #208 |
| 3 (écart A : après #161) | #197 | post-rc1, étape 1 | feat(reports): official report as PDF (L5) | OPEN (brouillon) | `main` | V10 R0 A0 S2 | `02cada3` | non | main | #161 (embarque ses commits) |
| 4 | #203 | post-rc1, étape 1 | fix(scope): unit_admin reads its unit and sub-units, one sub | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `3dc5300` | non | main | - |
| 4 bis | #171 | ajoutée par O, étape 1 | feat(documents): vue doublons, garder un document et mettre  | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `13c5aee` | non | main | - (deleted_at déjà sur main) |
| 5 | #161 | post-rc1, étape 2 | post-rc1-L5b rapport officiel numéroté (CSV, HTML, registre) | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `5a840dd` | non | main | - |
| 6 | #180 | dépendance, étape 2 | feat(reports): rapports officiels programmés (L9, tranche 1) | OPEN (brouillon) | `main` | V11 R0 A0 S2 | `f5d9180` | réserves (l. 607) | main | #161, #162 |
| 7 | #183 | dépendance, étape 2 | feat(analytics): alertes sur les indicateurs de qualité (L9  | OPEN (brouillon) | `main` | V9 R0 A0 S3 | `2348a1d` | verte sur a642c38 (l. 649), verdict à confirmer | main | #180 |
| 8 | #154 | dépendance, étape 2 | post-rc1-L4 : canal d'envoi du code de vérification (port +  | OPEN (brouillon) | `main` | V5 R0 A2 S4 | `2693cd9` | non | main | - |
| 9 (écart B : down_revision) | #193 | post-rc1, étape 2 | feat(auth): application d'authentification (TOTP), obligatoi | OPEN (brouillon) | `main` | V7 R0 A1 S3 | `f2cc377` | non (CI rouge, l. 836, 843) | main | #154, #183 |
| 10 | #186 | dépendance, étape 2 | post-rc1-L14 : reprise d'un import de dossier interrompu | OPEN (brouillon) | `main` | V10 R0 A0 S3 | `6559c49` | non (à corriger, l. 625, 655) | main | #193 |
| 11 | #165 | dépendance, étape 2 | post-rc1-L7 favoris, récents, partagés (/me) | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `f104eb1` | non | main | #186 |
| 12 | #192 | dépendance, étape 2 | feat(backup): sauvegarde planifiée nocturne, rétention et al | OPEN (brouillon) | `main` | V13 R0 A0 S0 | `7f2dfc1` | non | main | #165 |
| 13 | #209 | post-rc1, étape 3 | feat(front): official report copy screen (issue, register, r | OPEN (brouillon) | `feat/post-rc1-l9-scheduled-reports` | aucun check | `1e5381c` | non | main, via #180 | #180 |
| 14 | #205 | post-rc1, étape 3 | post-rc1 #165 UI : favoris, récents, partagés | OPEN (brouillon) | `feat/post-rc1-l7-my-documents` | aucun check | `66d50fa` | non | main, via #165 | #165 |
| 15 | #152 | dépendance, étape 4 | post-rc1-L2 : corbeille — DELETE vers la corbeille, purge sû | OPEN (brouillon) | `main` | V10 R0 A0 S3 | `7fa8a3d` | non | main | - |
| 16 | #181 | dépendance, étape 4 | feat(corbeille): écran Corbeille, restauration et purge selo | OPEN (brouillon) | `feat/post-rc1-l2-trash` | aucun check | `ca54b13` | oui (l. 608), diff final à relire sur main (l. 616) | main, via #152 | #152 |
| 17 | #184 | post-rc1, étape 4 | feat(explorer): undo last trash or move from the explorer (# | OPEN (brouillon) | `feat/post-rc1-trash-ui` | aucun check | `a0fee53` | réserves (après #152, l. 625) | main, via #181 | #181 |
| 17 bis | #211 | ajoutée par O, étape 4 | feat(front): multi-select in the explorer with grouped trash | OPEN (brouillon) | `feat/post-rc1-undo-ui` | aucun check | `191074f` | non | main, via #184 | #184 |
| 18 | #182 | post-rc1, étape 4 | test(e2e): passe post-rc1 L4 — annuler une suppression ou un | OPEN (brouillon) | `main` | V10 R0 A0 S3 | `3594aa5` | non (CI non suivie, gelée, l. 797) | main | #211 |
| 19 | #199 | post-rc1, étape 4 | feat(front): duplicates screen (#171) | OPEN (brouillon) | `feat/post-rc1-trash-ui` | aucun check | `3db25d5` | non | main, via #181 | #182, et #171 fusionnée |

**Ordre décidé par O (17/11)**, détaillé au § 8.6 du plan :
1. #197, #203, #171 ;
2. chaîne des migrations #161 → #180 → #183 → #154 → #193 → #186 → #165 → #192 ;
3. #209 après #180, et #205 après #165 ;
4. #152 → #181 → #184 → #211 → #182 → #199. #199 reste bloquée tant que #171 n'est pas fusionnée.

**Écarts signalés à O** (§ 8.6 du plan) :
- A : #197 embarque #161 ;
- B : `down_revision` de #193 vaut `a7c8d9e0f1b2`, et non `c3e8a5d1f2b7` ;
- C : des PR de l'ancien ordre sont absentes ;
- D : l'accord du PO du 23 conditionnait #171.

Empilements vérifiés le 17/11 (`git merge-base --is-ancestor` sur les têtes, et fichiers communs) :
- #154 ⊂ #193 ;
- #161 ⊂ #197 ;
- #181 ⊂ #184, #182 et #199 ;
- #184 ⊂ #182 ;
- #165 ⊂ #205 ;
- #180 ⊂ #209.

## 3. Points de vigilance à contrôler le 19

| # | Point | Contrôle |
|---|---|---|
| 1 | #208 : fusionnée le 17/11 à 11:17 UTC (CI V7 R0) | Fait ; vérifier que main contient son SHA au moment de la coupe |
| 2 | #104 : un seul push après 18:00, puis seulement `gh pr ready 104` | `Tête` change une seule fois entre le 17 et la fusion |
| 3 | #193 : 2 checks rouges sur 230c544 ; nouveau SHA f2cc377 (A1 R0 à 12:20). `down_revision` à reposer sur `c3e8a5d1f2b7` (écart B) | CI verte sur le SHA rebasé ; `alembic heads` renvoie une seule tête ; Q relit ce SHA |
| 4 | #182 embarque #184, qui embarque #181 : pas de check sur les PR empilées (#181, #184, #211, #199, #205, #209) | Leur CI ne compte qu'une fois rebasées sur main |
| 5 | #180 : la PR embarque des commits de #161 et #162 (l. 607) | #161 et #162 fusionnent avant le rebasage de #180, puis #209 |
| 6 | Migrations : post-rc1 sur main seulement, jamais vers release (`plan-fusion-post-rc1.md` § 8.4) | La colonne « ligne cible » ne mentionne jamais release pour une PR post-rc1 |

## 4. Écarts constatés le 19

| PR | Écart | Décision O |
|---|---|---|
| | | |
