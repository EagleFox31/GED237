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

## 2. Tableau (état du 17/11 12:13, main = e871532)

Hors tableau : **#206** (déclencheurs `release/**` dans `ci.yml`), fusionnée le 17/11 à 11:09 UTC (e871532). Le préalable « pas de coupe avant la PR ci.yml de Q » est donc levé.

CI : V = checks verts, R = rouges, A = en attente, S = sautés.

| Ordre | PR | Groupe | Titre | Statut | Base | CI | Tête | Relue Q | Ligne cible | Dépend de |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | #208 | file | test(e2e): play the OTP lock and the V1.1 lots for real in t | OPEN | `main` | V6 R0 A1 S5 | `99742a3` | oui (verte, nightly verte, PASSATION-ci-qa l. 835, 841) | main avant la coupe, donc dans release/v1.0.0 | - |
| 2 | #104 | file | docs(release): notes v1.0.0-rc.1 et relevé de coupure — dépe | OPEN (brouillon) | `main` | V4 R0 A0 S7 | `7302e3c` | - | main, puis coupe release/v1.0.0 sur son SHA de fusion | #208 |
| 3 | #154 | dépendance (hors liste) | post-rc1-L4 : canal d'envoi du code de vérification (port +  | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `a655f91` | non | main | - |
| 4 | #193 | post-rc1 | feat(auth): application d'authentification (TOTP), obligatoi | OPEN (brouillon) | `main` | V7 R2 A0 S3 | `230c544` | non (CI rouge, revue au prochain SHA de B, l. 836, 843) | main | #154 |
| 5 | #161 | post-rc1 | post-rc1-L5b rapport officiel numéroté (CSV, HTML, registre) | OPEN (brouillon) | `main` | V8 R0 A0 S4 | `5a840dd` | non | main | - |
| 6 | #197 | post-rc1 | feat(reports): official report as PDF (L5) | OPEN (brouillon) | `main` | V10 R0 A0 S2 | `02cada3` | non | main | - |
| 7 | #203 | post-rc1 | fix(scope): unit_admin reads its unit and sub-units, one sub | OPEN (brouillon) | `main` | V5 R0 A2 S4 | `3dc5300` | non | main | - |
| 8 | #184 | post-rc1 | feat(explorer): undo last trash or move from the explorer (# | OPEN (brouillon) | `feat/post-rc1-trash-ui` | aucun check | `a0fee53` | non (relecture après #182, l. 688) | main, via #181 puis #152 | #181, #152 |
| 9 | #182 | post-rc1 | test(e2e): passe post-rc1 L4 — annuler une suppression ou un | OPEN (brouillon) | `main` | V10 R0 A0 S3 | `3594aa5` | non (CI non suivie, gelée, l. 797) | main | #184 |
| 10 | #199 | post-rc1 | feat(front): duplicates screen (#171) | OPEN (brouillon) | `feat/post-rc1-trash-ui` | aucun check | `3db25d5` | non | main, via #181 puis #152 | #181, #152 |
| 11 | #205 | post-rc1 | post-rc1 #165 UI : favoris, récents, partagés | OPEN (brouillon) | `feat/post-rc1-l7-my-documents` | aucun check | `66d50fa` | non | main, via #165 | #165 |
| 12 | #209 | post-rc1 | feat(front): official report copy screen (issue, register, r | OPEN (brouillon) | `feat/post-rc1-l9-scheduled-reports` | aucun check | `1e5381c` | non | main, via #180 | #180 |

**Ordre proposé, à trancher par O** :
- **File** : #208, puis #104. La coupe se fait sur le SHA de fusion de #104.
- **Post-rc1** : les bases d'abord. #154 passe avant #193. La pile corbeille fusionne dans l'ordre #152 → #181 → #184 → #182, puis #199. #165 précède #205 et #180 précède #209. Les PR indépendantes (#161, #197, #203) passent dès leur relecture par Q.
- Du 20 au 23, aucune PR post-rc1 n'est relue par Q à ce jour : **aucune ne devrait fusionner sur main avant le 24**, sauf une relecture de Q entre-temps.

Empilements vérifiés le 17/11 (`git merge-base --is-ancestor` sur les têtes) :
- #154 ⊂ #193 ;
- #181 ⊂ #184, #182 et #199 ;
- #184 ⊂ #182 ;
- #165 ⊂ #205 ;
- #180 ⊂ #209.

## 3. Points de vigilance à contrôler le 19

| # | Point | Contrôle |
|---|---|---|
| 1 | #208 : un check était encore en attente le 17 à 12:13 | La colonne CI doit afficher `R0 A0` avant la fusion |
| 2 | #104 : un seul push après 18:00, puis seulement `gh pr ready 104` | `Tête` change une seule fois entre le 17 et la fusion |
| 3 | #193 : 2 checks rouges (donnée de test, l. 836) | Nouveau SHA de B ; Q relit sur ce SHA |
| 4 | #182 embarque #184, qui embarque #181 : pas de check sur les PR empilées (#184, #199, #205, #209) | Leur CI ne compte qu'une fois rebasées sur main |
| 5 | #180 : la PR embarque des commits de #161 et #162 (l. 607) | #161 et #162 fusionnent avant le rebasage de #180, puis #209 |
| 6 | Migrations : post-rc1 sur main seulement, jamais vers release (`plan-fusion-post-rc1.md` § 8.4) | La colonne « ligne cible » ne mentionne jamais release pour une PR post-rc1 |

## 4. Écarts constatés le 19

| PR | Écart | Décision O |
|---|---|---|
| | | |
