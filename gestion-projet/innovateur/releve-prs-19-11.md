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

## 2. Tableau (état du 2026-11-17 12:35, main = b701314)

Hors tableau : **#206** (déclencheurs `release/**` dans `ci.yml`), fusionnée le 17/11 à 11:09 UTC (e871532). Le préalable « pas de coupe avant la PR ci.yml de Q » est donc levé.

CI : V = checks verts, R = rouges, A = en attente, S = sautés. « Ordre » est l'ordre de fusion du 17/11 (`plan-fusion-post-rc1.md` § 8.6). Chaque PR exige la relecture de Q et une CI verte.

| Ordre | PR | Groupe | Titre | Statut | Base | CI | Tête | Relue Q | Ligne cible | Dépend de |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | #208 | file | test(e2e): play the OTP lock and the V1.1 lots for real in t | MERGED 2026-11-17T11:17 | `main` | V7 R0 A0 S5 | `99742a3` | oui (verte, nightly verte, PASSATION-ci-qa l. 835, 841) | main avant la coupe, donc dans release/v1.0.0 | - |
| 2 | #104 | file | docs(release): notes v1.0.0-rc.1 et relevé de coupure — dépe | OPEN (brouillon) | `main` | V4 R0 A0 S7 | `7302e3c` | - | main, puis coupe release/v1.0.0 sur son SHA de fusion | #208 |
| 3 | #179 | étape 1 (B) | feat(documents): annuler un déplacement par le même PATCH, r | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `cf4e434` | oui (l. 606) | main | - |
| 4 | #153 | étape 1 (B) | post-rc1-L3 : file de validation unifiée (GET /workflows/inb | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `4fe8136` | non | main | - |
| 5 | #155 | étape 1 (B) | post-rc1-L6 : notifications en temps réel sur plusieurs inst | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `bbfc852` | non | main | - |
| 6 | #197 | étape 2 (B), remplace #161 fermée | feat(reports): official report as PDF (L5) | OPEN (brouillon) | `main` | V10 R0 A0 S2 | `02cada3` | oui avec remarques (l. 864) | main | - |
| 7 | #162 | étape 2 (B) | post-rc1-L8 qualité documentaire (indicateurs et listes) | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `4395ab1` | non | main | - |
| 8 | #180 | étape 2 (B) | feat(reports): rapports officiels programmés (L9, tranche 1) | OPEN (brouillon) | `main` | V11 R0 A0 S2 | `f5d9180` | réserves (l. 607) | main | #197, #162 |
| 9 | #183 | étape 2 (B) | feat(analytics): alertes sur les indicateurs de qualité (L9  | OPEN (brouillon) | `main` | V9 R0 A0 S3 | `2348a1d` | verte sur a642c38 (l. 649), verdict à confirmer | main | #180 |
| 10 | #154 | étape 2 (B) | post-rc1-L4 : canal d'envoi du code de vérification (port +  | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `2693cd9` | non | main | - |
| 11 (écart B : down_revision) | #193 | étape 2 (B) | feat(auth): application d'authentification (TOTP), obligatoi | OPEN (brouillon) | `main` | V9 R0 A0 S3 | `f2cc377` | oui avec remarques sur f2cc377 (l. 882), à relire après rebasage | main | #154, #183 |
| 12 | #186 | étape 2 (B) | post-rc1-L14 : reprise d'un import de dossier interrompu | OPEN (brouillon) | `main` | V10 R0 A0 S3 | `6559c49` | non (à corriger, l. 625, 655) | main | #193 |
| 13 | #165 | étape 2 (B) | post-rc1-L7 favoris, récents, partagés (/me) | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `f104eb1` | non | main | #186 |
| 14 | #192 | étape 2 (B) | feat(backup): sauvegarde planifiée nocturne, rétention et al | OPEN (brouillon) | `main` | V13 R0 A0 S0 | `7f2dfc1` | non | main | #165 |
| 15 | #209 | étape 3 (F) | feat(front): official report copy screen (issue, register, r | OPEN (brouillon) | `feat/post-rc1-l9-scheduled-reports` | aucun check | `1e5381c` | non | main, via #180 | #180 |
| 16 | #194 | étape 3 (F) | feat(front): onglet Qualité des rapports et alertes de quali | OPEN (brouillon) | `feat/post-rc1-l9-quality-alerts` | aucun check | `5790e5e` | non | main, via #183 | #183 |
| 17 | #205 | étape 3 (F) | post-rc1 #165 UI : favoris, récents, partagés | OPEN (brouillon) | `feat/post-rc1-l7-my-documents` | aucun check | `66d50fa` | non | main, via #165 | #165 |
| 18 | #152 | étape 4 (B) | post-rc1-L2 : corbeille — DELETE vers la corbeille, purge sû | OPEN (brouillon) | `main` | V10 R0 A0 S3 | `7fa8a3d` | non | main | - |
| 19 | #181 | étape 4 (F) | feat(corbeille): écran Corbeille, restauration et purge selo | OPEN (brouillon) | `feat/post-rc1-l2-trash` | aucun check | `ca54b13` | oui (l. 608) ; défaut du menu contextuel (l. 877) | main, via #152 | #152 |
| 20 | #184 | étape 4 (F) | feat(explorer): undo last trash or move from the explorer (# | OPEN (brouillon) | `feat/post-rc1-trash-ui` | aucun check | `a0fee53` | non validée tant que la nightly est rouge (l. 880) | main, via #181 | #181, #179 |
| 21 | #211 | étape 4 (F) | feat(front): multi-select in the explorer with grouped trash | OPEN (brouillon) | `feat/post-rc1-undo-ui` | aucun check | `191074f` | non | main, via #184 | #184 |
| 22 | #182 | étape 4 (Q) | test(e2e): passe post-rc1 L4 — annuler une suppression ou un | OPEN (brouillon) | `main` | V10 R0 A0 S3 | `3594aa5` | non validée, nightly rouge (l. 876-880) | main | #211 |
| 23 | #190 | étape 4 (F) | feat(front): file de validation unifiée à onglets (#153) | OPEN (brouillon) | `feat/post-rc1-trash-ui` | aucun check | `0cdad27` | non | main, via #181 | #181, #153 |
| 24 (écart E) | #196 | étape 5, après le PO du 23 (B) | fix(reports): sub-unit for unit-scoped roles, institution-wi | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `e760d79` | non | main | accord PO |
| 25 (écart E) | #203 | étape 5, après le PO du 23 (B) | fix(scope): unit_admin reads its unit and sub-units, one sub | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `3dc5300` | oui avec remarques (l. 870) | main | #196, accord PO |
| 25 bis | #213 | étape 5, après le PO (B), correctif de sécurité #202 | fix(scope): unit_admin opens and changes documents only in i | OPEN (brouillon) | `feat/post-rc1-195-unit-admin-scope` | aucun check | `0cf3fa2` | non | main, via #203 | #203, accord PO |
| 26 | #171 | étape 5, après le PO du 23 (B) | feat(documents): vue doublons, garder un document et mettre  | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `13c5aee` | oui avec remarques (l. 894) | main | accord PO |
| 27 | #199 | étape 5, après le PO du 23 (F) | feat(front): duplicates screen (#171) | OPEN (brouillon) | `feat/post-rc1-trash-ui` | aucun check | `3db25d5` | non | main, via #181 | #182, #171, accord PO |

**Ordre** (§ 8.6 du plan ; accepté par O le 17/11, commit 1152a1a) :
1. #179, #153, #155 ;
2. chaîne des migrations #197 → #162 → #180 → #183 → #154 → #193 → #186 → #165 → #192. #161 est fermée, remplacée par #197 ;
3. #209 après #180, #194 après #183, #205 après #165 ;
4. #152 → #181 → #184 → #211 → #182 → #190. #179 avant #184, #153 avant #190 ;
5. après l'accord écrit du PO : #196 → #203 → #213 (écart E ; #213, correctif de sécurité #202, peut remonter si le PO tranche la question manager/lecteur avant le 23), #171 → #199 (décision D).

**Règle de chaînage (O)** : après chaque fusion de la chaîne, l'auteur de la PR suivante repose son `down_revision` sur la nouvelle tête de `main`. Aucune PR à migration en file sans `alembic heads` à une seule tête. Garde-fou : `test_schema_check.py` l. 34-35, sur l'état combiné, car la règle de `main` exige une branche à jour (`strict`).

**Écarts** (§ 8.6 du plan) : A à E tranchés par O le 17/11.

Empilements vérifiés le 17/11 (`git merge-base --is-ancestor`, commit par commit) :
- #161 ⊂ #197 ; #162 (1 sur 2) ⊂ #180 ; #180 ⊂ #183 ⊂ #194 ; #180 ⊂ #209 ; #154 ⊂ #193 ; #165 ⊂ #205 ;
- #181 ⊂ #184, #182, #190 et #199 ; #184 ⊂ #182 ; #179 (1 sur 2) ⊂ #184 et #182 ; #153 ⊂ #190 ;
- #196 (2 sur 2) ⊂ #203 ⊂ #213 (6 sur 6) ; #171 (2 sur 4) ⊂ #199.

## 3. Points de vigilance à contrôler le 19

| # | Point | Contrôle |
|---|---|---|
| 1 | #208 : fusionnée le 17/11 à 11:17 UTC (CI V7 R0) | Fait ; vérifier que main contient son SHA au moment de la coupe |
| 2 | #104 : un seul push après 18:00, puis seulement `gh pr ready 104` | `Tête` change une seule fois entre le 17 et la fusion |
| 3 | #193 : relue par Q sur f2cc377 (OK avec remarques, CI verte). `down_revision` à reposer sur `c3e8a5d1f2b7` (écart B), donc nouveau SHA à relire | CI verte sur le SHA rebasé ; `alembic heads` renvoie une seule tête ; Q relit ce SHA |
| 4 | #182 embarque #184, qui embarque #181 : pas de check sur les PR empilées (#181, #184, #211, #199, #205, #209) | Leur CI ne compte qu'une fois rebasées sur main |
| 5 | #180 : la PR embarque des commits de #161 et #162 (l. 607). #161 est fermée, remplacée par #197 | #197 et #162 fusionnent avant le rebasage de #180, puis #209 |
| 6 | Migrations : post-rc1 sur main seulement, jamais vers release (`plan-fusion-post-rc1.md` § 8.4) | La colonne « ligne cible » ne mentionne jamais release pour une PR post-rc1 |

## 4. Écarts constatés le 19

| PR | Écart | Décision O |
|---|---|---|
| | | |
