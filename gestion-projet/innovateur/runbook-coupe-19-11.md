# Runbook de la coupe du 19/11 : `release/v1.0.0`, ruleset, correctifs après la coupe

- **Pour** : O, qui exécute toutes les écritures sur GitHub. Préparé par l'innovateur le 18/11, sur `main` 2f15b6e, en lecture seule : rien n'a été appliqué.
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
