# Runbook de la coupe du 19/11 : `release/v1.0.0`, ruleset, correctifs après la coupe

- **Pour** : O, qui exécute toutes les écritures sur GitHub. Préparé par l'innovateur le 18/11, sur `main` 2f15b6e, en lecture seule : rien n'a été appliqué. **Mis à jour le 18/11 sur dabeeb2 : le § 8 (état réel et ordre du 19) fait foi pour les horaires.**
- **Remplace** les § 3 et 4 de `deroule-coupe-19-11.md`. Les § 1 et 2 (push et fusion de #104) et les § 5 à 7 (tête alembic, DEC-2026-004, #179) restent valables.
- **Sources** : `checklist-tag-rc1-24-11.md` (E1 à E5), `gestion-projet/releases/plan-tag-rc1.md`, ruleset 26190959 (lu le 18/11), dépôt `appfactory-project-automation` en e912a8a (`src/governance/policy.mjs`, `docs/repository-governance-quick-start.md`).
- **Les commandes sont dans des blocs de code**, pas dans des tableaux : on peut les copier telles quelles, même depuis le fichier brut.

## 0. Décisions

- **Point de coupe : la fusion de #104** (décision O, corrigée le 17/11 au soir). Ce n'est pas #121.
- **#121 va sur la release seulement.** Elle ne change que `frontend/package.json` (`0.0.0` → `1.0.0-rc.1`).
  - Le 19, après la coupe, elle est reciblée sur `release/v1.0.0` (E1 ter).
  - Le 24 au matin, elle est la dernière fusion avant le tag (E5).
  - Elle n'est **pas** recopiée sur `main` : `main` garde `0.0.0`, et sa version sera posée à la release V1.1.
- **Ruleset de `release/**` : Build, sur le modèle d'AppFactory.** Le Repository Governance d'AppFactory V1 ne gère qu'un seul ruleset, ciblé sur la branche par défaut : `policy.mjs` l. 175-184 rejette tout `target.include` autre que `~DEFAULT_BRANCH`. On reprend donc ses règles (ruleset 26190959) et son cycle « plan en lecture seule → apply → plan sans écriture », en commandes `gh api`. Évolution à proposer à AppFactory après le 30 : une cible configurable.
- **Après la coupe, DEC-2026-004 passe en premier sur `main`** (I la pousse à 18:40, `deroule-coupe-19-11.md` § 6), avant #179 (§ 7). Elle ne va pas sur la release : c'est une décision pour la V1.1.

## 1. Variables (une fois, dans le terminal d'O)

```bash
export MSYS_NO_PATHCONV=1 GODEBUG=
REPO=EagleFox31/GED237 BR=release/v1.0.0 RS_NAME="Release branches"
ci_gate() { gh pr view "$1" --json isDraft,mergeStateStatus,headRefOid,statusCheckRollup \
  -q '"draft=\(.isDraft) etat=\(.mergeStateStatus) tete=\(.headRefOid[0:7])", (.statusCheckRollup[]|select(.name=="CI Gate")|"CI Gate \(.status) \(.conclusion)")'; }
rs_id() { gh api repos/$REPO/rulesets -q ".[]|select(.name==\"$RS_NAME\")|.id"; }
```

## 2. Avant la coupe : contrôles (lecture seule)

Tous les contrôles doivent passer. Sinon, on ne coupe pas.

```bash
git fetch -q origin
M=$(gh pr view 104 --json mergeCommit -q .mergeCommit.oid); echo "$M"
```
1. `M` n'est pas vide (#104 est `MERGED`).

```bash
[ "$M" = "$(git rev-parse origin/main)" ] && echo OK-tete
```
2. Attendu : `OK-tete`. Si une autre fusion est passée entre-temps, on coupe quand même sur `$M`, jamais sur la tête de `main`.

```bash
gh pr view 121 --json state,baseRefName -q '"\(.state) \(.baseRefName)"'
```
3. Attendu : `OPEN main`. Si #121 est `MERGED` sur `main`, la version `1.0.0-rc.1` se retrouve sur `main` : arrêter et décider (§ 7).

```bash
git show origin/main:.github/workflows/ci.yml | grep -cE '^\s*branches:.*release/\*\*'
```
4. Attendu : `2` (#206). Un résultat inférieur veut dire que la CI ne tournera pas sur la release : ne pas couper.

```bash
git ls-remote --exit-code --heads origin "$BR"; echo "code=$?"
rs_id
```
5. Attendu : `code=2` (la branche n'existe pas), et `rs_id` ne renvoie rien (pas encore de ruleset). Si l'un des deux existe déjà, c'est un nouveau passage : voir l'idempotence aux § 3 et 4.

```bash
gh run list -w ci.yml -c "$M" -L 1 --json status,conclusion -q '.[0]|"\(.status) \(.conclusion)"'
```
6. Attendu : `completed success`. Si le run est encore en cours, attendre. S'il est rouge, ne pas couper ; Q qualifie l'échec.

## 3. Coupe de `release/v1.0.0` (écriture d'O)

```bash
gh api repos/$REPO/git/refs -f ref=refs/heads/$BR -f sha="$M" -q .ref
```
- **Attendu** : `refs/heads/release/v1.0.0`.
- **Si `Reference already exists`** : lancer `gh api repos/$REPO/branches/$BR -q .commit.sha`.
  - Le SHA vaut `$M` : rien à faire (no-op).
  - Le SHA est différent et le ruleset n'existe pas encore : `gh api -X PATCH repos/$REPO/git/refs/heads/$BR -f sha="$M" -F force=true`.
  - Le ruleset existe déjà : voir § 7.

```bash
[ "$(gh api repos/$REPO/branches/$BR -q .commit.sha)" = "$M" ] && echo OK-coupe
gh run list -b "$BR" -w ci.yml -L 1 --json headSha,status -q '.[0]|"\(.headSha[0:7]) \(.status)"'
```
- **Attendu** : `OK-coupe`, puis un run de `ci.yml` sur `$BR`.
- **Si aucun run n'apparaît après 2 min** : `gh workflow run ci.yml --ref "$BR"` lance toutes les gates (`workflow_dispatch`, `checklist-tag-rc1-24-11.md` § 4 bis).
- **La branche d'abord, le ruleset ensuite** : tant que la règle `deletion` n'existe pas, une coupe ratée se corrige encore.

## 4. Ruleset de `release/**` : plan, apply, plan

Le JSON est à mettre hors dépôt, par exemple dans `$TMP/ruleset-release.json`. Ses règles sont celles du ruleset d'AppFactory (26190959) :
- PR obligatoire, 0 approbation, fils de discussion résolus ;
- CI Gate obligatoire, branche à jour (`strict`) ;
- ni force-push ni suppression ;
- aucun contournement (`bypass_actors` vide).

Une seule différence avec AppFactory : `do_not_enforce_on_create: true`. Sans elle, la création d'une future branche `release/v1.1.0` serait bloquée par l'exigence de CI.

```json
{
  "name": "Release branches",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/release/**"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false, "require_last_push_approval": false,
        "required_review_thread_resolution": true,
        "allowed_merge_methods": ["merge", "squash", "rebase"] } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": true, "do_not_enforce_on_create": true,
        "required_status_checks": [ { "context": "CI Gate" } ] } }
  ],
  "bypass_actors": []
}
```

### 4.1 Plan (lecture seule)

```bash
ID=$(rs_id); echo "id=${ID:-aucun}"
[ -n "$ID" ] && gh api repos/$REPO/rulesets/$ID -q '.enforcement, .conditions.ref_name.include, [.rules[].type]'
```
- `id=aucun` : le plan est **CRÉER**.
- Un id, avec `active`, `["refs/heads/release/**"]` et `["deletion","non_fast_forward","pull_request","required_status_checks"]` : le plan est **RIEN À FAIRE**.
- Un id avec d'autres valeurs : le plan est **METTRE À JOUR** cet id. Ne jamais en créer un second : deux rulesets du même nom rendraient le prochain plan ambigu.

### 4.2 Apply (écriture d'O)

```bash
# CRÉER
gh api -X POST repos/$REPO/rulesets --input "$TMP/ruleset-release.json" -q .id
# METTRE À JOUR
gh api -X PUT repos/$REPO/rulesets/$ID --input "$TMP/ruleset-release.json" -q .id
```
En cas d'erreur 422 : lire le message, corriger le JSON, puis relancer le plan (4.1) avant tout nouvel apply. **Aucune fusion sur `$BR`** tant que 4.3 n'est pas vert.

### 4.3 Plan de contrôle : il ne doit plus rien y avoir à faire

```bash
ID=$(rs_id); gh api repos/$REPO/rulesets/$ID -q '.enforcement, .conditions.ref_name.include, [.rules[].type]'
gh api repos/$REPO/rules/branches/$BR -q '[.[].type]|unique'
gh api repos/$REPO/rulesets/26190959 -q '.conditions.ref_name.include'
```
1. Les valeurs du ruleset sont celles de 4.1 : un nouveau passage du plan donne **RIEN À FAIRE**.
2. Les règles réellement appliquées à `$BR` contiennent `deletion`, `non_fast_forward`, `pull_request` et `required_status_checks`. C'est la preuve en lecture seule : on ne tente pas de force-push pour vérifier.
3. Le ruleset d'AppFactory vaut toujours `["~DEFAULT_BRANCH"]`. S'il a été modifié par erreur, le remettre tel quel ; ne jamais le supprimer.

## 5. Juste après la coupe

1. **`main` rouvre** : DEC-2026-004 d'abord (I, 18:40), puis #179 (B puis O), selon `deroule-coupe-19-11.md` § 6 et 7.
2. **Reciblage vers la release** (E1 ter) : #121 et la PR des notes de B.
   ```bash
   gh pr edit 121 --base "$BR"
   gh pr view 121 --json baseRefName -q .baseRefName
   ```
   Attendu : `release/v1.0.0`. La branche de #121 part de f89fce8 (16/11). Après le reciblage, son diff ne montre que `frontend/package.json`, mais elle sera `BEHIND` : la règle `strict` l'exige à jour. La file d'O la met à jour par `gh pr update-branch 121` une fois la PR reciblée, puis de nouveau le 24 au matin si un correctif est passé sur la release entre-temps. C'est une branche du dépôt, pas un fork : l'auteur n'a rien à faire. Il faut compter le temps d'une CI (1 à 11 min le 17/11) avant E5.
3. **Le contrôle d'étanchéité, à chaque fusion sur `main`** : `gh api repos/$REPO/branches/$BR -q .commit.sha` ne bouge pas.

## 6. Correctif après la coupe : PR vers la release, puis `cherry-pick -x` vers `main`

C'est pour un constat de recette du 20 au 23/11 seulement (E3), avec l'accord d'O et **sans migration**.

### 6.1 La PR vers la release (auteur du correctif)

```bash
git fetch -q origin && git switch -c fix/<constat>-rc1 origin/release/v1.0.0
# ... correctif, tests en Docker, commit ...
git push -u origin fix/<constat>-rc1
gh pr create --base release/v1.0.0 --title "fix(...): ..." --body-file <scratchpad>/pr-<constat>.md
```
Le corps de la PR cite le constat de recette, contient la section « RAIDER review », et annonce : « Recopie vers `main` : PR à suivre, le même jour ».

### 6.2 Contrôles avant la fusion (O)

```bash
ci_gate <n>
gh pr view <n> --json baseRefName -q .baseRefName
gh pr diff <n> --name-only | grep -c alembic/versions
```
Attendu : `CI Gate COMPLETED SUCCESS`, `release/v1.0.0`, puis `0`. Le périmètre du diff se limite au constat.

### 6.3 Fusion (O)

Fusionner en **squash**, pour qu'un seul commit soit recopié. Puis noter son SHA :

```bash
gh pr merge <n> --squash
S=$(gh pr view <n> --json mergeCommit -q .mergeCommit.oid); echo "$S"
```

### 6.4 Recopie vers `main` (auteur, le même jour)

```bash
git fetch -q origin
git log origin/main --oneline --grep "cherry picked from commit $S"     # vide attendu ; sinon déjà recopié, rien à faire
git switch -c fix/<constat>-main origin/main
git cherry-pick -x "$S"                 # si la PR a été fusionnée par merge et non par squash : git cherry-pick -x -m 1 "$S"
git log -1 --format=%B | grep -c "cherry picked from commit $S"         # 1 attendu
git push -u origin fix/<constat>-main
gh pr create --base main --title "fix(...): ... (recopie de #<n>)" --body-file <scratchpad>/pr-<constat>-main.md
```
- **En cas de conflit** : `git cherry-pick --abort`, puis prévenir O. L'auteur résout ensuite en local (`git cherry-pick -x`, résolution, `git cherry-pick --continue`) et décrit la résolution dans la PR.
- **Exception** : un correctif qui n'a de sens que sur la release (comme #121) n'est pas recopié. La PR vers la release le dit en une ligne.

## 7. Retour arrière

| Situation | Action (O) |
|---|---|
| Coupe sur le mauvais SHA, ruleset pas encore créé | `gh api -X PATCH repos/$REPO/git/refs/heads/$BR -f sha="$M" -F force=true`, puis le contrôle du § 3 |
| Coupe sur le mauvais SHA, ruleset déjà actif | `gh api -X PUT repos/$REPO/rulesets/$ID -f enforcement=disabled`, correction comme ci-dessus, puis `-f enforcement=active` et le plan du § 4.3 |
| Ruleset mal formé | `PUT` du JSON corrigé sur le même id (§ 4.2), jamais un second ruleset |
| Ruleset qui bloque une fusion légitime | relire `ci_gate <n>` : la règle a raison tant que la CI n'est pas verte. Pas de contournement. Une désactivation se fait seulement sur décision d'O, et elle est consignée |
| #121 fusionnée sur `main` avant la coupe | ne pas couper. Revert de #121 sur `main` par PR, puis on reprend au § 2 avec le nouveau `M` |
| Correctif fusionné sur la release, qui crée une régression | PR de revert vers `$BR` (`git revert "$S"`, ou `-m 1` pour un merge), puis le même revert sur `main` si la recopie est déjà fusionnée |
| Coupe à annuler entièrement, aucune fusion sur `$BR` | ruleset désactivé, puis `gh api -X DELETE repos/$REPO/git/refs/heads/$BR`. On revient au plan d'avant (tag sur `main`). Décision d'O seulement |

Après une fusion sur `$BR`, la branche n'est plus supprimée : on corrige par des PR de revert.

## 8. État réel du 18/11 (14:00, `main` dabeeb2) et ordre du 19

**Cette section fait foi pour les horaires et l'ordre du 19.** Les § 1 à 7 restent valables pour les commandes. Relevé : `releve-prs-19-11.sh`, exécuté le 18/11 à 13:46. Son tableau META date d'avant la série V1.0 : l'inventaire complet vient de `gh pr list --state open` (118 PR).

### 8.1 Classement des 118 PR ouvertes

| Classe | PR | Responsable | État le 18/11 à 14:00 |
|---|---|---|---|
| V1.0 à fusionner avant 18:00 | #203 | I | prête ; à 14:10 : `main` fusionnée par B sans rebase (2a890d0), 139 tests verts en Docker dont `stats_scope`, une seule tête alembic ; en file depuis 13:53 ; **CI rouge** (`audit-logs` 200 au lieu de 403 sur l'accès par étape), B corrige ; 13 fichiers, aucune migration. #358, #241 et #266 reciblées sur `main` par O ; #360 et #361 restent sur la branche de #358 |
| | #358 | B | brouillon, base = branche de #203, CLEAN ; 11 fichiers, aucune migration ; B corrige les 6 trous relevés par Q |
| | #360 | B | brouillon, base = branche de #358, CLEAN ; 9 fichiers, aucune migration ; 25 tests verts en Docker |
| | #104 (point de coupe) | I | brouillon, DIRTY sur le distant (7302e3c). En local (8eca6b0) : 56 commits d'avance, 70 de retard, et `merge-tree` ne montre aucun conflit avec `main` |
| V1.0 conditionnelle | PR RapidOCR | B | **aucune PR ni branche distante** : seulement un commit local (7cb2dd9). Restent les tests et la mesure mémoire |
| | #356 (e2e du scénario de démo) | F | brouillon, BEHIND ; tests seuls |
| Release seulement (§ 0) | #121 | O | prête, BEHIND, CI verte ; jamais fusionnée sur `main` |
| V1.1 / V1.2, brouillon, hors file | les 105 autres brouillons, dont #241, #266, #359, #361 et toute la série post-rc1 | auteurs | aucune fusion avant la coupe |
| Dependabot | #29, #30, #110, #111, #112, #113, #141 | O | hors file (DEC-2026-001 : V1.2) |

### 8.2 Ordre du 19 : heure au plus tard et critère de passage

Les fusions passent une à une. Avec la règle `strict`, chaque PR demande une mise à jour de branche, une CI de 5 à 13 minutes, puis la fusion : 15 à 20 minutes en tout. **Avant de fusionner une PR qui sert de base, recibler d'abord sur `main` les PR empilées dessus.** Ne jamais supprimer une branche de base (`delete_branch_on_merge` est à `false`).

| # | Étape | Qui | Cible | Au plus tard | Critère de passage | Sinon |
|---|---|---|---|---|---|---|
| 0 | Fusion de `main` dans #203 (merge, sans rebase) ; retrait de `TENANT_ANALYTICS_ROLES` ; alignement de `test_stats_scope` ; tests en Docker | B | — | **fait le 18/11** | 2a890d0 : 139 tests verts, une seule tête alembic | — |
| 1 | Reciblage de #358, #241 et #266 sur `main` | O | **fait le 18/11** | avant la fusion de #203 | `baseRefName` = `main` pour les trois | ne pas fusionner #203 |
| 2 | Fusion de #203 | O | 11:00 | **15:00** | `ci_gate 203` : `draft=false`, CI Gate `COMPLETED SUCCESS` ; relecture de Q | V1.1, avec #358 et #360 |
| 3 | #358 prête (B), puis reciblage de #360 et #361 sur `main` (O) | B, puis O | 12:00 | avant la fusion de #358 | 6 trous corrigés, puis `gh pr ready 358` | — |
| 4 | Fusion de #358 | O | 12:30 | **15:30** | CI Gate vert, OK de Q | V1.1, avec #360. La fuite reste dans les limites connues (question 12 de la fiche jury) |
| 5 | #360 prête, puis fusion | B, puis O | 13:30 | **16:00** | CI Gate vert, OK de Q | V1.1 |
| 6 | PR RapidOCR : décision | O | — | **16:00** | étape 0 de `decision-vote-ocr.md` : PR prête, CI verte, OK de Q, Tesseract toujours moteur par défaut, aucune migration, trois tests de repli | V1.1 (§ 4 de la note) |
| 7 | Fusion de RapidOCR, si l'étape 6 passe | O | 16:30 | **17:00** | CI Gate vert | V1.1 |
| 8 | #356 (tests e2e seuls) | F, puis O | 14:00 | **15:00** (décision d'O) | CI verte et passe de F OK | V1.1 ; sans effet sur la coupe |
| 9 | **Gel des fusions sur `main`** : O note la tête de `main` | O | — | **17:15** | `git rev-parse --short origin/main`, transmis à I | — |
| 10 | Essai à blanc de #104 | I | 17:30 | 17:45 | `deroule-coupe-19-11.md` § 1, ligne de 17:55 : fusion locale de `origin/main` sans conflit, sur la tête notée à 17:15 | conflit : prévenir O avec la liste des fichiers ; ne rien pousser |
| 11 | Push unique de #104, puis `gh pr ready 104` | I | 18:00 | 18:05 | `deroule` § 1 | — |
| 12 | Fusion de #104, **point de coupe** | O | 18:20 | **19:00** | `deroule` § 2 : CI Gate vert | à 19:00, O et le PO décident s'il faut couper sans les notes |
| 13 | #121 reciblée sur la release, après la coupe | O | après le § 3 | 19:30 | `gh pr edit 121 --base "$BR"` | — |

**« #121 en dernier »** désigne le reciblage de l'étape 13, pas une fusion sur `main`. Une fusion sur `main` avant la coupe bloquerait la coupe au contrôle 3 du § 2, et ferait passer `main` en `1.0.0-rc.1` (§ 0).

Reciblage (O) :

```bash
for n in 358 241 266; do gh pr edit $n --repo $REPO --base main; done   # avant la fusion de #203
for n in 360 361; do gh pr edit $n --repo $REPO --base main; done       # avant la fusion de #358
for n in 358 241 266 360 361; do gh pr view $n --repo $REPO --json number,baseRefName -q '"#\(.number) \(.baseRefName)"'; done
```

### 8.3 Après 18:00 : commande ou responsable de chaque étape

| Heure | Étape | Qui | Commande ou renvoi | Résultat attendu |
|---|---|---|---|---|
| 18:00 | Push de #104, puis `gh pr ready 104` | I | `deroule-coupe-19-11.md` § 1 | tête distante = tête locale |
| 18:05 à 18:20 | Fusion de #104 | O | `deroule` § 2 | `M` = mergeCommit de #104 |
| ≈ 18:25 | Contrôles avant la coupe | O | § 2, contrôles 1 à 6 | les 6 passent |
| ≈ 18:30 | Création de `release/v1.0.0` sur `M` | O | § 3 | la branche existe, sur `M` |
| ≈ 18:30 | Tête alembic de la release | Q | `deroule` § 5 | une seule ligne : `"a7c8d9e0f1b2"`. Vérifié sur dabeeb2 le 18/11 ; #203, #358 et #360 n'ajoutent aucune migration |
| ≈ 18:35 | Ruleset `release/**` : plan, apply, plan | O | § 4.1, § 4.2, puis § 4.3 | le dernier plan n'a plus rien à faire ; le ruleset 26190959 vise toujours `~DEFAULT_BRANCH` |
| ≈ 18:40 | Fermeture de #133 | O | bloc ci-dessous | issue CLOSED |
| 18:40 | DEC-2026-004 sur `main` | I | `deroule` § 6. Branche `docs/dec-2026-004` : 143 commits de retard, aucun conflit. Faire `git merge origin/main` en local avant le push | PR ouverte vers `main`, fusionnée par O |
| ≈ 18:45 | #121 reciblée sur la release | O | § 5 : `gh pr edit 121 --base "$BR"` | base = `release/v1.0.0` |
| 18:45 à 19:10 | #179 | O | `deroule` § 7 | — |
| 19:10 | Contrôle d'étanchéité | O | § 5 | — |

Fermeture de #133. L'écart 2 de l'audit HTTPS est traité par la documentation seule (décision d'O), dans `deroule-demo-https.md` § 3, qui arrive avec #104 :

```bash
gh pr diff 104 --repo $REPO --name-only | grep -c deroule-demo-https   # doit afficher 1
gh issue close 133 --repo $REPO --reason completed \
  --comment "Écart 2 de l'audit HTTPS traité par la documentation : deroule-demo-https.md § 3, arrivé avec #104 ($M)."
```

### 8.4 Risques pour 18:00

1. **#203 : risque rouvert le 18/11.** La CI de 2a890d0 est rouge : `audit-logs` renvoie 200 au lieu de 403 sur l'accès par étape. Les 139 tests verts en Docker ne couvraient pas ce cas. B corrige ; Q relit le correctif. #358 et #360 attendent #203. Si la CI n'est pas verte à 15:00 le 19, O décide si les trois PR passent en V1.1. Objectif d'O inchangé : #203, #358 et #360 fusionnées le 18 ou le 19 au matin.
2. **Fusions en série.** Trois PR empilées, puis peut-être RapidOCR et #356, à 15 à 20 minutes chacune. Entre 16:00 et 17:15, la marge ne couvre qu'une seule relance de CI.
3. **RapidOCR** : aucune PR la veille à 14:00. Par défaut, elle passe en V1.1.
4. **#356** (F, tests e2e seuls) : V1.0 si CI verte et passe de F OK avant le 19 à 15:00, sinon V1.1 (décision d'O). Sans effet sur la coupe.
5. **#121** : confirmé par O, reciblée sur `release/v1.0.0` après la coupe ; jamais fusionnée sur `main` (contrôle 3 du § 2).
6. **#104** a 70 commits de retard sur `main`. L'essai à blanc de 17:30 se fait sur la tête notée au gel de 17:15, et non plus sur `2f15b6e`.
