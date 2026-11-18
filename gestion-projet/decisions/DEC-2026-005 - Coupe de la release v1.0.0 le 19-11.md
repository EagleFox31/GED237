# DEC-2026-005 — Coupe de `release/v1.0.0` le 19/11 : périmètre de la rc.1 et règles jusqu'au tag

- **Statut** : BROUILLON, préparé par l'innovateur le 18/11 au soir, à la demande d'O. O le publie vers 18:40 le 19/11, une fois la coupe faite, après avoir rempli les champs `‹…›`. Numéro confirmé par O le 18/11 (DEC-2026-004 reste celle du secours TOTP).
- **Décideurs** : O pour l'exécution ; le PO pour le périmètre (§ 8b du plan de fusion : toutes les PR hors lot en V1.1, 18/11).
- **Sources** : `runbook-coupe-19-11.md` (§ 0 et § 8 font foi pour les horaires), `deroule-coupe-19-11.md`, `checklist-tag-rc1-24-11.md`, `plan-fusion-v1.1.md`, DEC-2026-002 (gel du 24/11).

## 1. Décision

1. **Point de coupe : la fusion de #104** (notes de version et relevé). `release/v1.0.0` est créée sur ce commit, noté `M`.
   - `M` = `‹sha court›`, fusion de #104 à `‹hh:mm›`.
   - Gel des fusions sur `main` à 17:15, tête notée : `‹sha court›`.
2. **Le périmètre de la rc.1 est le contenu de `main` en `M`, sans autre ajout.** Ce qui n'est pas fusionné à la coupe passe en V1.1, sauf décision contraire écrite d'O et du PO.
3. **Après la coupe, la release ne reçoit que des correctifs de recette** (constats du 20 au 23/11) :
   - PR vers `release/v1.0.0`, avec l'accord d'O, **sans migration** ;
   - fusion en squash, puis recopie sur `main` le même jour par `cherry-pick -x` (runbook § 6) ;
   - une seule exception : #121 (version `1.0.0-rc.1` dans `frontend/package.json`), qui va sur la release seulement et en dernier, le 24 au matin.
4. **La release est protégée** par un ruleset `release/**` construit sur le modèle d'AppFactory : plan en lecture seule, apply, puis plan de contrôle sans écriture (runbook § 4).
5. **`main` rouvre aussitôt** : DEC-2026-004 d'abord, puis #179. Le contrôle d'étanchéité (`release/v1.0.0` ne bouge pas quand `main` avance) est fait à chaque fusion sur `main`.
6. **Démo du 30/11** : elle tourne sur la rc.1 (tag sur `release/v1.0.0`), pas sur `main`.

## 2. Ce qui est dans la rc.1 (relevé du 18/11, 16:40, à compléter à la coupe)

| Sujet | PR | État |
|---|---|---|
| L'administrateur de service limité à son service et ses sous-services | #196, #203, #358, #360 | fusionnées le 18/11 |
| OCR : RapidOCR pour les photos, captures et formulaires ; Tesseract pour les scans, les PDF et en secours ; repli EasyOCR coupé ; relance d'une lecture perdue | #365, #368, #369, #374 | fusionnées le 18/11 |
| Fiche d'astreinte de la recette | #375 | fusionnée le 18/11 |
| Corrections UX des parcours d'administration et de fin de journée (audits Lot 5 et 5 bis) | #390 | fusionnée le 18/11 |
| Fusions du 19/11 avant 17:15 | `‹liste›` | `‹à relever›` |

Le détail, rangé par bénéfice pour l'utilisateur, est dans `notes-version-v1.0.0-rc.1-utilisateurs.md`. Pour le tag, ce sont les notes de #104 qui font foi.

## 3. Ce qui n'est pas dans la rc.1

| Sujet | PR | Destination |
|---|---|---|
| E2e du scénario de démo (tests seuls) | #356 | `‹fusionnée avant 17:15 / V1.1›`. Sans effet sur la coupe |
| Robustesse OCR (acquittement après coup, tentatives bornées) | #370 | V1.2 (OCR-1) |
| Lot 4 UX (tâches répétitives) | #362 | V1.1, relecture de Q après le tag |
| Brouillons V1.1 et V1.2, dont la série post-rc1 | ≈ 105 PR | V1.1 ou V1.2, selon `plan-fusion-v1.1.md` |
| Mises à jour Dependabot | #29, #30, #110 à #113, #141 | V1.2 (DEC-2026-001) |

## 4. Pourquoi

- **Une branche de release** isole la recette du 20 au 23/11 et le tag du 24/11 du travail V1.1, qui reprend sur `main` dès le 19 au soir. Sans elle, il faudrait geler `main` pendant cinq jours avec plus de cent PR en attente.
- **#104 comme point de coupe** : la rc.1 et ses notes partent du même commit. Ce qui est décrit est ce qui est livré.
- **Pas de migration après la coupe** : la base de la recette et celle de la démo gardent la même tête alembic (`‹tête relevée par Q à 18:30›`). Un correctif qui exige une migration attend la V1.1.
- **`cherry-pick -x`** : chaque correctif de la release est tracé sur `main`, et la V1.1 ne perd aucun correctif de recette.

## 5. Conséquences

- Du 20 au 23/11, toute anomalie de recette suit le runbook § 6 ; O décide si elle est corrigée sur la release ou notée en limite connue.
- Les auteurs de PR V1.1 travaillent sur `main` sans contrainte de calendrier liée au tag.
- Le 24/11 : fusion de #121 sur la release, puis tag `v1.0.0-rc.1` (`checklist-tag-rc1-24-11.md`).

## 6. Retour arrière

Voir le runbook § 7. En résumé :
- tant que rien n'est fusionné sur la release, une coupe sur le mauvais commit se corrige en replaçant la branche ;
- ensuite, on corrige par des PR de revert, jamais en réécrivant la branche ;
- l'annulation complète (retour à un tag sur `main`) est une décision d'O seulement.

## 7. À remplir par O le 19/11 avant publication

- [ ] `M`, l'heure de fusion de #104, et la tête de `main` au gel de 17:15.
- [ ] La liste des fusions du 19/11 (§ 2, dernière ligne) et le sort de #356 (§ 3).
- [ ] La tête alembic relevée par Q sur la release.
- [ ] Le résultat du plan de contrôle du ruleset (« rien à faire »).
- [ ] Le statut passe à « DÉCIDÉ le 19/11 à ‹hh:mm› ».
