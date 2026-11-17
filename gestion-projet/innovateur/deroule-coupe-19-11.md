# Déroulé de la coupe du 19/11 : du push de #104 à la réouverture de `main`

- **Pour** : O, qui exécute les écritures ; I, Q et B pour leurs étapes. Rédigé par l'innovateur le 17/11, sur `main` 53d4c40, en lecture seule.
- **Mise à jour du 18/11** : les § 3 et 4 sont remplacés par `runbook-coupe-19-11.md` (coupe sur la fusion de #104, ruleset en plan → apply → plan, correctifs vers la release puis `cherry-pick -x` vers `main`).
- **Sources** : `checklist-tag-rc1-24-11.md` (E1 à E1 ter), `plan-fusion-post-rc1.md` (§ 8.4 à 8.6), `releve-prs-19-11.md` (§ 1).
- **Rôles** : I pousse #104 **une seule fois** et lance `gh pr ready 104`. I ne fusionne rien et ne met aucune branche à jour sur GitHub. Seul O fusionne, coupe la release et crée le ruleset.
- **Horaires** : ce sont des cibles. La CI de `main` a duré entre 1 et 11 min le 17/11 (runs de b701314, bc62fa5 et 53d4c40). Si une étape glisse, les suivantes glissent avec elle, **sans en sauter aucune**.
- **Copier les commandes depuis la vue GitHub rendue, pas depuis le fichier brut.** Dans les tableaux, `\|` est un échappement markdown. Copié depuis le brut, `grep -E` le lit comme un `|` littéral, et le filtre ne filtre plus rien.

## 0. Constats du 17/11 qui changent la procédure (`Vérifié`)

1. **`main` n'a pas de file de fusion.** Le seul ruleset (« AppFactory default branch governance », id 26190959) a quatre règles : `deletion`, `non_fast_forward`, `pull_request` et `required_status_checks` (CI Gate, `strict`). Il n'a pas de règle `merge_queue`, et la requête GraphQL `mergeQueue(branch:"main")` renvoie `null`. La « file » est le **script de file d'O** : il met la branche à jour (update-branch) si elle est en retard, puis lance `gh pr merge N --merge` une fois CI Gate vert. Les PR y entrent dans l'ordre du § 8.6.
2. **`strict` exige une branche à jour.** Une PR en retard sur `main` (`BEHIND`) ne fusionne pas. C'est la file d'O qui la met à jour. Les auteurs ne font pas d'update-branch eux-mêmes.
3. **#104 est aujourd'hui `DIRTY` sur GitHub** (tête distante 7302e3c). La tête locale 0288c02 contient déjà le merge de 53d4c40. Le dry-run sur 53d4c40 est propre, et le push du 19 lève donc le conflit.
4. **Le diff de #104 touche aussi `DOCS/engineering/lessons-learned.md`** (LESSON-032 et 044). Le contrôle E1 de la check-list, « seulement `gestion-projet/` et `CHANGELOG.md` », répondrait KO à tort. Le contrôle corrigé est à l'étape 1.
5. **Tête alembic de `main`** : `a7c8d9e0f1b2`. C'est la seule révision qui n'est le `down_revision` d'aucune autre.

```bash
export MSYS_NO_PATHCONV=1 GODEBUG=
REPO=EagleFox31/GED237 BR=release/v1.0.0
ci_gate() { gh pr view "$1" --json isDraft,mergeStateStatus,headRefOid,statusCheckRollup \
  -q '"draft=\(.isDraft) etat=\(.mergeStateStatus) tete=\(.headRefOid[0:7])", (.statusCheckRollup[]|select(.name=="CI Gate")|"CI Gate \(.status) \(.conclusion)")'; }
```

## 1. Push de #104 et `gh pr ready` — I, 18:00 → 18:05

| Heure | Commande (worktree `GED237-docs-notes-version`) | Contrôle attendu | Si KO |
|---|---|---|---|
| 17:55 | `git fetch -q origin && git rev-parse --short origin/main` | `2f15b6e` (main au gel, le 17/11 au soir ; #104 y est déjà recalée en local, commit 93ed914). Sinon, `main` a encore bougé : faire `git merge origin/main` en local avant le push | conflit : ne rien pousser, prévenir O avec la liste des fichiers en conflit |
| 17:56 | `git merge-tree --write-tree origin/main HEAD` | une seule ligne (un SHA d'arbre), sans `CONFLICT` | idem |
| 17:57 | `head -n 5 gestion-projet/innovateur/notes-version-v1.0.0-rc.1.md \| grep -Eiq 'brouillon\|Pour\**[[:space:]]*:' && echo STOP \|\| echo OK` | `OK` | `STOP` : corriger en local avant le push, qui reste unique |
| 17:58 | `git diff origin/main...HEAD \| grep -cE '@20(25)'` | `0` : aucun mot de passe de démonstration | retirer la ligne, puis faire un nouveau commit local |
| 18:00 | `git push origin docs/notes-version-rc1` | `93ed914` (ou le merge de 17:55) arrive sur GitHub | refus du push : ne pas forcer (`--force-with-lease` interdit) ; prévenir O |
| 18:01 | `gh pr ready 104` | `gh pr view 104 --json isDraft -q .isDraft` = `false` | relancer une fois ; sinon O |
| 18:02 | `gh pr diff 104 --name-only \| grep -vE '^(gestion-projet/\|CHANGELOG\.md$\|DOCS/engineering/lessons-learned\.md$)'` | sortie vide : documentation seule | un fichier hors liste : O décide avant la fusion |
| 18:03 | `gh pr view 104 --json headRefOid -q .headRefOid` | le SHA poussé | — |

À 18:05, I envoie à O une ligne : le SHA poussé, `ready`, et le diff de documentation seule. Le relevé des PR (`releve-prs-19-11.md` § 1) se fait en parallèle, sans bloquer la coupe.

## 2. Fusion de #104 — O, 18:05 → 18:20

| Heure | Commande | Contrôle attendu | Si KO |
|---|---|---|---|
| 18:05 → 18:15 | `ci_gate 104`, à relancer jusqu'à la fin de la CI | `draft=false`, `etat=CLEAN`, `CI Gate COMPLETED SUCCESS` | `BEHIND` : la file d'O met la branche à jour, et I ne pousse rien. CI rouge : I lit le log (`gh run view --log-failed`) ; les corrections se font par commit local, et le push n'a lieu qu'avec l'accord d'O. E2 attend |
| 18:15 | **O met #104 dans sa file** (script de file). Repli manuel : `gh pr merge 104 --merge` | `gh pr view 104 --json state -q .state` = `MERGED` | refus (règle non satisfaite) : relire `ci_gate 104`, ne jamais contourner |
| 18:16 | `git fetch -q origin && M=$(gh pr view 104 --json mergeCommit -q .mergeCommit.oid) && [ "$M" = "$(git rev-parse origin/main)" ] && echo OK-tete` | `OK-tete` | une autre fusion est passée entre-temps : couper quand même sur `$M`, pas sur la tête de `main` |

`--merge` correspond au mode des fusions récentes (« Merge pull request #223 »). Le dépôt autorise aussi `squash` et `rebase` : c'est à O de choisir.

## 3. Création de `release/v1.0.0` — O, 18:20 (remplacé par `runbook-coupe-19-11.md` § 2 et 3)

| Heure | Commande | Contrôle attendu | Si KO |
|---|---|---|---|
| 18:20 | `git show origin/main:.github/workflows/ci.yml \| grep -cE '^\s*branches:.*release/\*\*'` | `2` (#206, fusionnée le 17/11 ; un par déclencheur — sans `branches:`, le commentaire de la l. 3 donne `3`) | `< 2` : couper quand même, puis recopier #206 sur `$BR` (décision O) |
| 18:21 | `gh api repos/$REPO/git/refs -f ref=refs/heads/$BR -f sha=$M` | réponse JSON avec `"ref": "refs/heads/release/v1.0.0"` | `Reference already exists` : lire `gh api repos/$REPO/branches/$BR -q .commit.sha`. Si c'est `$M`, rien à faire. Sinon, **ne pas supprimer** la branche : O tranche |
| 18:22 | `gh api repos/$REPO/branches/$BR -q .commit.sha` | `= $M`, **avant** le ruleset du § 4 | autre SHA : le corriger maintenant, tant que la règle `deletion` du ruleset n'existe pas encore |

## 4. Ruleset de la release — O, 18:25 (remplacé par `runbook-coupe-19-11.md` § 4)

Fichier hors dépôt, par exemple `ruleset-release.json` dans un dossier temporaire :

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

Ce JSON est aligné sur le ruleset d'O. `bypass_actors` est vide, comme dans celui d'AppFactory (`Vérifié` le 17/11). `do_not_enforce_on_create: true` est indispensable : sans lui, la création d'une branche `release/**` par push serait bloquée. L'ordre est fixe : la branche d'abord (§ 3), le ruleset ensuite.

| Heure | Commande | Contrôle attendu | Si KO |
|---|---|---|---|
| 18:25 | `gh api -X POST repos/$REPO/rulesets --input ruleset-release.json -q .id` | un id numérique, à noter : `____` | erreur 422 : lire le message, corriger le JSON, recommencer. **Aucune fusion sur `$BR`** tant que le ruleset n'est pas actif |
| 18:27 | `gh api repos/$REPO/rulesets/<id> -q '.enforcement, .conditions.ref_name.include, [.rules[].type]'` | `active`, `["refs/heads/release/**"]` et `["deletion","non_fast_forward","pull_request","required_status_checks"]` | O corrige (`gh api -X PUT repos/$REPO/rulesets/<id> --input …`), puis relit. Mauvais SHA de coupe découvert après coup : la règle `deletion` empêche de supprimer puis recréer la branche. O désactive d'abord le ruleset (`enforcement` à `disabled`), recoupe, contrôle `= $M`, puis le réactive |
| 18:28 | `gh api repos/$REPO/rulesets/26190959 -q '.conditions.ref_name.include'` | toujours `["~DEFAULT_BRANCH"]` | le ruleset d'AppFactory a été modifié par erreur : le remettre tel quel |

## 5. Tête alembic unique — Q, 18:30

Cette vérification ne nécessite ni base ni conteneur : elle lit les scripts de migration de la release.

| Heure | Commande | Contrôle attendu | Si KO |
|---|---|---|---|
| 18:30 | `git fetch -q origin && git grep -h -E '^(revision\|down_revision) *[:=]' origin/$BR -- backend/alembic/versions \| grep -oE '"[0-9a-f]{12}"' \| sort \| uniq -u` | une seule ligne : `"a7c8d9e0f1b2"` | deux lignes ou plus : plusieurs têtes. Stop : la release ne part pas en recette le 20 tant que B n'a pas proposé une migration de fusion, **sur `$BR` par PR** |
| 18:31 | `gh run list -w ci.yml -c $M -L 1 --json conclusion -q '.[0].conclusion'` | `success` : ce run contient `test_schema_check.py` (une seule tête, l. 34-35) | pas de run : `gh run list -b $BR -w ci.yml -L 1` (la création de la branche déclenche `push` sur `release/**`). Rouge : Q lit le log, puis O décide |
| 18:32 (facultatif, Docker) | depuis un worktree de `$BR` : `docker compose run --rm --no-deps migrate alembic heads` | `a7c8d9e0f1b2 (head)` | — |

Règle du § 8.4 : on ne lance jamais `alembic upgrade head` depuis `main` sur une base de recette ou de démo.

## 6. Push de DEC-2026-004 — I, 18:40

| Heure | Commande (worktree `GED237-docs-dec-2026-004`) | Contrôle attendu | Si KO |
|---|---|---|---|
| 18:38 | `git fetch -q origin && git merge-tree --write-tree origin/main HEAD` | pas de `CONFLICT` (branche partie de bc62fa5 ; elle ne touche qu'un fichier de `gestion-projet/decisions/`) | conflit : merge local de `origin/main`, puis reprendre |
| 18:40 | `git push -u origin docs/dec-2026-004` | branche créée, tête `8a449ee` (ou le merge de 18:38) | refus : prévenir O, sans forcer |
| 18:41 | `gh pr create --base main --head docs/dec-2026-004 --title "docs(decisions): DEC-2026-004, mandatory TOTP for privileged accounts, reset by the level above" --body-file <scratchpad>/pr-dec-2026-004.md` | le numéro de la PR, envoyé à O | — |
| 18:42 | `gh pr diff <n> --name-only` | seulement `gestion-projet/decisions/` | O décide |

La fusion se fait par O, une fois la CI verte. C'est de la documentation seule, sans migration : elle n'occupe aucune place dans l'ordre du § 8.6.

## 7. Première PR de `main` rouvert : #179 — B puis O, 18:45 → 19:10

#179 est la première PR de l'étape 1 du § 8.6. Elle est relue par Q (oui, `PASSATION-ci-qa` l. 606) et n'a pas de migration. À 18:45, `main` est rouvert : la release vit à part.

| Heure | Qui | Commande | Contrôle attendu | Si KO |
|---|---|---|---|---|
| 18:45 | B | `gh pr ready 179` (la file d'O met la branche à jour si elle est en retard) | `gh pr view 179 --json isDraft,baseRefName -q '"\(.isDraft) \(.baseRefName)"'` = `false main` | conflit : B le résout en local ; #179 glisse, et #153 peut passer avant (même étape, sans dépendance) |
| 18:50 → 19:05 | O | `ci_gate 179` | `etat=CLEAN`, `CI Gate COMPLETED SUCCESS`, et une tête identique au SHA relu par Q (sinon, Q relit le delta) | rouge : B corrige ; on ne fusionne pas |
| 19:05 | O | #179 dans sa file. Repli manuel : `gh pr merge 179 --merge` | `MERGED` ; `git fetch -q origin && git rev-parse origin/main` = `mergeCommit` de #179 | — |
| 19:06 | O | `gh api repos/$REPO/branches/$BR -q .commit.sha` | toujours `$M` : la fusion sur `main` n'a pas touché la release | différent : alerte, et O relit l'historique de `$BR` |

**Fin de la coupe** : `main` est rouvert et `$BR` reste figée sur `$M`, protégée. La suite est à E1 ter de la check-list : reciblage de #121 et de la PR des notes de B vers `$BR`, par leurs auteurs.
