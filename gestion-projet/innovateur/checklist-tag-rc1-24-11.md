# Check-list du tag v1.0.0-rc.1 : fusions du 19 au 24/11, tag, retour arrière, captures

- **Exécutant** : O. Q pour les captures (§ 5). Préparé par l'innovateur le 17/11 sur `main` 33b2425, en lecture seule.
- **Mise à jour du 17/11, après la décision du PO** (`plan-fusion-post-rc1.md` § 8) :
  - le tag est posé sur **`release/v1.0.0`**, coupée par O sur `main` le 19 juste après #104 ;
  - toutes les étapes après E1 visent donc `$BR`, et non `main` ;
  - `main` rouvre aux PR post-rc1 dès la coupure ; ses fusions ne concernent pas cette check-list.
- **Référence** : `gestion-projet/releases/plan-tag-rc1.md` (#131). Ses § 2 à 5 s'appliquent le 24, avec **`main` remplacé par `$BR`** dans toutes ses commandes (`origin/main`, `--ref main`, `-b main`). Ils ne sont pas recopiés ici. Cette check-list ajoute l'ordre des fusions qui précèdent, les contrôles de chaque étape et les captures.
- **Commandes** : les commandes de contrôle sont en lecture seule. Les seules écritures sont faites par O : la coupure de `$BR`, les fusions, `gh workflow run`, `gh release create/edit/upload`. **Aucune file de fusion ne protège `$BR`** (§ 0.7) : O fusionne à la main, seulement après un `ci_gate` vert.
- **Copier les commandes depuis la vue GitHub rendue, pas depuis le fichier brut.** Dans les tableaux, `\|` est un échappement markdown. Copié depuis le brut, `grep -E` le lit comme un `|` littéral, et le filtre ne filtre plus rien.

```bash
export MSYS_NO_PATHCONV=1 GODEBUG=
REPO=EagleFox31/GED237 TAG=v1.0.0-rc.1 BR=release/v1.0.0
ci_gate() { gh pr view "$1" --json isDraft,mergeStateStatus,headRefOid,statusCheckRollup \
  -q '"draft=\(.isDraft) etat=\(.mergeStateStatus) tete=\(.headRefOid[0:7])", (.statusCheckRollup[]|select(.name=="CI Gate")|"CI Gate \(.status) \(.conclusion)")'; }
```

## 0. Constats du relevé du 17/11, à connaître avant le 19

1. **Pas de Release Please.** `.github/workflows/` contient `ci`, `backend`, `frontend`, `security`, `e2e-playwright`, `e2e-uat-nightly` et `release-integrity`. Il n'y a ni configuration ni workflow Release Please. Le tag est donc créé **à la main** par `gh release create --target $SHA` (plan § 3). La version du frontend vient de #121 (`package.json`). Celle du backend vient d'`APP_VERSION` au déploiement (#58). `release-integrity.yml` part sur `release: published`.
2. **#131 est déjà fusionnée** (17/11) : c'est le plan du tag lui-même. L'étape « #131 selon le plan » consiste à suivre ce plan le 24 ; il n'y a rien à fusionner.
3. **`tag_preflight.sh` (#156) est trop indulgent sur la recette nocturne.** Il affiche `OK nightly … (antérieur à ce SHA)` quand le dernier run vert porte sur un SHA plus ancien (l. 116-117). Le plan exige un run sur ce SHA. **Seule la ligne `OK nightly dernier run vert, sur ce SHA` compte.** Le script se corrige après le 30, sans PR avant le tag.
4. **Un run vert ne produit aucune capture.** `frontend/playwright.config.ts` règle `screenshot: 'only-on-failure'` et `trace: 'on-first-retry'`. Le rapport nocturne d'un run vert n'a donc aucune image des parcours. L'item 16 de la check-list de démo exige un run dédié (§ 5).
5. **Les notes de #104 ont encore l'en-tête interne** (« brouillon vivant », puces « Pour », « Format », « Périmètre »). Le contrôle bloquant du plan § 3 répond aujourd'hui `STOP`. Aucune PR de documentation n'est possible après #121 : l'innovateur retire donc cet en-tête dans le push unique du 19.
6. **PR Dependabot ouvertes et non brouillon** : #29, #30, #110 à #113, #141. Elles sont gelées (`note-gel-dependances-rc1.md`) et n'entrent jamais sur `$BR`. Leur sort sur `main` est une décision d'O (`plan-fusion-post-rc1.md` § 8.3).
7. **`$BR` n'est pas protégée.** Le seul ruleset du dépôt vise `~DEFAULT_BRANCH`. Une PR vers `$BR` n'exige donc aucun check, et la branche peut être poussée directement, réécrite ou supprimée. **Décision O du 17/11** : O crée un ruleset `release/**` séparé, juste après la coupure (E1 bis-2). Dans tous les cas, `ci_gate` doit être vert avant chaque fusion.
8. **`ci.yml` part aussi sur `release/**` : c'est fait, et c'est déjà sur `main`** (#206, l. 5-8, dans `push` et `pull_request`). La release en hérite donc à la coupure. Sans cet ajout, la PR vers `$BR` n'a pas de CI Gate, et la fusion de #121 sur `$BR` n'a pas de `Frontend / Build` : `tag_preflight` répond alors KO `dist`.
9. **La recette nocturne planifiée ne tourne que sur `main`** (cron). Sur `$BR`, elle se lance toujours par `gh workflow run e2e-uat-nightly.yml --ref $BR`.
10. **`tag_preflight.sh` accepte la branche en second argument** (l. 6-8, 49 et 107 : la tête de la branche et le nightly `-b` de cette branche) : `bash scripts/tag_preflight.sh $TAG $BR`.

## 1. Ordre des fusions

E1 se fait sur `main`, et tout ce qui suit sur `$BR`. Aucune autre fusion sur `$BR` entre ces étapes. Une PR n'est fusionnée (sur `main` par la file, sur `$BR` à la main par O) que si son contrôle est vert. Les fusions post-rc1 sur `main` après la coupure ne bloquent aucune étape (`plan-fusion-post-rc1.md` § 8.2).

| # | Quand | PR | Contrôle avant d'entrer dans la file | Commande (lecture seule) | Si KO |
|---|---|---|---|---|---|
| E1 | 19/11 après 18:00 | **#104**, notes de version et relevé de coupure (I pousse une fois, puis `gh pr ready 104`) | plus en brouillon ; CI Gate `COMPLETED SUCCESS` ; pas `BEHIND` (sinon la file la met à jour) ; notes sans en-tête interne | `ci_gate 104` puis `gh pr diff 104 --name-only \| grep -vE '^(gestion-projet/\|CHANGELOG\.md$\|DOCS/engineering/lessons-learned\.md$)'` (sortie vide attendue ; corrigé le 17/11 : #104 porte aussi LESSON-032 et 044 dans `lessons-learned.md`) et `git fetch -q origin docs/notes-version-rc1 && git show origin/docs/notes-version-rc1:gestion-projet/innovateur/notes-version-v1.0.0-rc.1.md \| head -n 5 \| grep -Eiq 'brouillon\|Pour\**[[:space:]]*:' && echo STOP \|\| echo OK` | I corrige dans la soirée (nouveau push accordé par O seulement) ; E2 attend |
| E1 bis | 19/11, juste après E1 | aucune PR : **O coupe `$BR`** sur la fusion de #104 | la tête de `main` est la fusion de #104 ; `ci.yml` déclenche déjà `release/**` (§ 0.8) | `git fetch -q origin && M=$(gh pr view 104 --json mergeCommit -q .mergeCommit.oid) && [ "$M" = "$(git rev-parse origin/main)" ] && echo OK-tete` ; `git show origin/main:.github/workflows/ci.yml \| grep -cE '^\s*branches:.*release/\*\*'` (attendu : `2`, un par déclencheur ; sans `branches:`, le commentaire de la l. 3 donne `3`) ; coupure (écriture d'O) : `gh api repos/$REPO/git/refs -f ref=refs/heads/$BR -f sha=$M` ; contrôle : `gh api repos/$REPO/branches/$BR -q .commit.sha` = `$M`, **avant** de créer le ruleset (E1 bis-2) | pas d'OK-tete : retrouver le SHA de fusion de #104 et couper dessus. Pas de `release/**` : attendre la PR de Q, ou couper puis la recopier sur `$BR` (décision O) |
| E1 bis-2 | 19/11, juste après la coupure | aucune PR : **ruleset `release/**` actif**, créé par O, distinct de celui d'AppFactory (décision O du 17/11) | ruleset actif sur `refs/heads/release/**`, avec `deletion`, `non_fast_forward`, `pull_request` (0 approbation, fils résolus) et CI Gate strict (`do_not_enforce_on_create`) | `gh api repos/EagleFox31/GED237/rulesets` ; puis, pour l'id trouvé : `gh api repos/$REPO/rulesets/<id> -q '.enforcement, .conditions.ref_name.include, [.rules[].type]'` (attendu : `active`, `refs/heads/release/**` et `["deletion","non_fast_forward","pull_request","required_status_checks"]`) | pas de fusion sur `$BR` tant que le ruleset n'est pas actif ; O corrige puis relit. **Coupure sur un mauvais SHA vue après E1 bis-2** : la règle `deletion` empêche de supprimer puis recréer la branche. O désactive d'abord le ruleset (`enforcement` à `disabled`), recoupe, contrôle `= $M`, puis le réactive |
| E1 ter | 19/11, après la coupure | aucune fusion : **reciblage** de #121 et de la PR des notes de B (par leurs auteurs) | base = `$BR` | `gh pr edit 121 --base $BR` (auteur) ; `gh pr view 121 --json baseRefName -q .baseRefName` = `$BR` ; idem pour la PR de B | l'auteur rebase sa branche sur `$BR` si le diff montre des commits de `main` |
| E2 | avant le 20/11 12:00 | **PR des notes de B** (worktree `GED237-notes-rc1`, rebasée sur `$BR`, n° à reporter : `____`) | base = `$BR` ; contient #104 ; CI Gate verte ; documentation seule | `ci_gate <n>` ; `gh pr view <n> --json baseRefName -q .baseRefName` = `$BR` ; `gh pr diff <n> --name-only` ; `git merge-base --is-ancestor $M $(gh pr view <n> --json headRefOid -q .headRefOid) && echo base-OK` | B rebase ; la recette du 20 part quand même (elle ne dépend pas des notes) |
| E3 | 20 au 23/11 | **Correctifs de recette**, s'il y en a, **vers `$BR`**, puis recopiés vers `main` | un constat de recette cité dans la PR ; accord O ; CI Gate verte ; périmètre limité au constat ; **aucune migration** ; PR de recopie vers `main` ouverte le même jour (`cherry-pick -x`, n° cité dans la PR de la release) | `ci_gate <n>` ; `gh pr view <n> --json baseRefName -q .baseRefName` = `$BR` ; `gh pr diff <n> --name-only \| grep -c alembic/versions` = `0` | pas de fusion ; constat noté comme écart annoncé |
| E3 bis | 23/11 au soir, après le dernier correctif | aucune fusion : **recette nocturne sur la tête de `$BR`** avant #121 | run vert, sur ce SHA | `gh workflow run e2e-uat-nightly.yml --ref $BR`, attendre que le nouveau run apparaisse, puis `gh run watch $(gh run list -w e2e-uat-nightly.yml -b $BR -L 1 --json databaseId -q '.[0].databaseId') --exit-status` (forme du § 2.2) ; ensuite `git fetch -q origin && [ "$(gh run list -w e2e-uat-nightly.yml -b $BR -L 1 --json headSha -q '.[0].headSha')" = "$(git rev-parse origin/$BR)" ] && echo OK-sha`. Juste après `gh workflow run`, `-L 1` peut encore montrer le run précédent | rouge : correctif en E3 **avant** #121. C'est la raison de cette étape : après #121, tout correctif casse la règle « #121 en dernier » |
| E4 | — | **#131**, déjà fusionnée | le plan est sur `main`, donc sur `$BR` | `gh pr view 131 --json state -q .state` = `MERGED` | — |
| E5 | 24/11 matin, accord PO obtenu | **#121 en dernier** (version du frontend), **sur `$BR`** | seule PR ouverte vers `$BR` ; #121 pas `BEHIND` | `gh pr list --base $BR --state open --json number,title -q '.[]\|"\(.number) \(.title)"'` (attendu : #121 seule) ; `ci_gate 121` ; après fusion : `git fetch -q origin && git show origin/$BR:frontend/package.json \| grep '"version"'` = `1.0.0-rc.1` | ne pas fusionner ; § 4 |

Après E5, **aucune fusion sur `$BR`** jusqu'au tag, même de documentation. `main` n'est pas concerné. #121 n'est **pas** recopiée sur `main` : la version du frontend sur `main` sera gérée par Release Please après le 30.

## 2. Contrôles sur le SHA final (24/11, après E5)

Plan § 2, dans l'ordre :

1. Tête de `$BR` = fusion de #121 : `git fetch -q origin && [ "$(gh pr view 121 --json mergeCommit -q .mergeCommit.oid)" = "$(git rev-parse origin/$BR)" ] && echo OK`.
2. Recette nocturne relancée sur ce SHA (plan § 2, en remplaçant `main` par `$BR`) : `gh workflow run e2e-uat-nightly.yml --ref $BR`, puis `gh run watch $(gh run list -w e2e-uat-nightly.yml -b $BR -L 1 --json databaseId -q '.[0].databaseId') --exit-status`.
3. `bash scripts/tag_preflight.sh $TAG $BR` depuis un clone à jour (§ 0.10). Attendu : uniquement des `OK`, avec **`OK nightly dernier run vert, sur ce SHA`** (§ 0.3), et la dernière ligne `PRÊT : … <SHA>`.
4. Noter le SHA : `________`. C'est le seul SHA autorisé pour le tag.

## 3. Pose du tag

- **Qui** : O, après l'accord du PO.
- **Sur quel SHA** : celui du § 2.4, la fusion de #121 **sur `$BR`**. `SHA=$(git rev-parse origin/$BR)` ; le SHA de `main` ne doit jamais servir.
- **Comment** : à la main, avec la pré-version GitHub (plan § 3) : `gh release create $TAG --repo $REPO --target $SHA --title "E-Dossier Cameroun $TAG" --notes-file /tmp/notes-rc1.md --prerelease`. GitHub crée le tag sur ce SHA, quelle que soit la branche. Contrôle : `git fetch -q --tags origin && [ "$(git rev-list -n1 $TAG)" = "$SHA" ] && git merge-base --is-ancestor $TAG origin/$BR && echo OK-tag`. Release Please n'est pas en place (§ 0.1). Son adoption (`reusable-release.yml` d'appfactory) est décidée pour **après le 30**, sur `main` seulement (`fiche-adopt-release-please-apres-30.md` § 9).
- **rc.2 éventuelle** : même procédure sur la nouvelle tête de `$BR`, avec `TAG=v1.0.0-rc.2`.
- **Ensuite** : notes contrôlées (plan § 3), publication, vérification `release-integrity` et preuves jointes à la release (plan § 4). Écrire le tag, le SHA, le n° de run et `exit=0` dans la passation d'O.

## 4. Retour arrière si un contrôle échoue

| Moment | Échec | Geste |
|---|---|---|
| Avant une fusion (E1 à E5) | contrôle rouge | ne pas fusionner ; la PR revient à son auteur ; l'étape suivante attend |
| Après une fusion fautive sur `$BR`, avant #121 | régression constatée en recette | PR de retour arrière vers `$BR` (`git revert` du commit de fusion) par son auteur, avec l'accord d'O, puis E3 bis. Si le correctif avait été recopié sur `main`, on annule aussi la recopie. |
| Coupure de `$BR` sur un mauvais SHA (E1 bis) | `$BR` ≠ fusion de #104 | avant toute fusion sur `$BR` : O supprime puis recrée la branche sur `$M`. Après une fusion : décision O |
| Recette nocturne rouge sur le SHA final (§ 2.2) | test rouge | **pas de tag**. Q qualifie. Un seul `gh run rerun <id>` est permis si l'échec est une instabilité prouvée. Un second rouge impose un correctif, ce qui casse « #121 en dernier » : décision O (§ 4 bis) |
| Fusion passée après #121 | `tag_preflight` KO `dist` (pas de `Frontend / Build` sur le SHA) | **Stop** (plan § 2) ; décision O (§ 4 bis) |
| Après publication | signature ou manifeste KO | plan § 5 : `gh release edit $TAG --draft=true` d'abord, puis cas A à D. Suppression du tag (cas D) seulement avec l'accord du PO |
| Non résolu le 24 à 18:00 | — | release laissée en brouillon, PO prévenu ; la démo du 30 ne dépend pas du tag (images sur clé USB, checklist H-30) |

**§ 4 bis. Option d'O si une fusion est passée après #121.** `ci.yml` a un `workflow_dispatch` qui lance **toutes** les gates (`mode: all`, l. 8 et 29). `gh workflow run ci.yml --ref $BR` reconstruit donc `Frontend / Build` et l'artefact `frontend-build` sur la nouvelle tête de `$BR`. On relance ensuite la recette nocturne puis `tag_preflight.sh`. C'est préférable à une nouvelle fusion de #121, qui est impossible, ou à un tag sur un SHA non contrôlé.

## 5. Captures de secours régénérées sur le tag (item 16 de `checklist-demo.md`)

L'item 16 cite « le run du 21/11 ». Les captures doivent porter sur la **version taguée**, sinon le plan B montre une autre version que la démo. Un run vert n'en produit pas (§ 0.4) : il faut un run dédié avec les traces activées.

- **Qui** : Q, le 24 après le tag (ou le 25 au plus tard). **Où** : un worktree détaché, jamais le checkout partagé. **Mémoire** : vérifier la RAM libre avant la pile e2e (`free -m` sous WSL, ou le Gestionnaire des tâches), avec la règle des conteneurs bornés.

```bash
git fetch -q --tags origin && git worktree add --detach ../GED237-tag-rc1 "$TAG"
cd ../GED237-tag-rc1 && git rev-parse HEAD          # = SHA du § 2.4
E2E_ARGS="--project=seed --project=uat --trace on" \
  docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e
docker compose -f docker-compose.e2e.yml down -v
```

- `frontend/e2e-out/` contient alors le rapport HTML et une trace par test (captures pas à pas). Le copier **hors du dépôt**, dans un dossier nommé `planB-v1.0.0-rc.1-<SHA court>`, sur le poste de démo et sur le poste de secours.
- Garder aussi le rapport nocturne du § 2.2. Son artefact expire après 14 jours : `gh run download <id> -n e2e-uat-report -D planB-nightly-<SHA court>`.
- **À vérifier par Q le 24** (`Déduit`, non testé) : le visualiseur de traces peut refuser de s'ouvrir en `file://`. Dans ce cas, ouvrir le rapport par `npx playwright show-report <dossier>`, qui fonctionne en local sans Internet, et corriger la ligne H-30 « ouvert en `file://` » de `checklist-demo.md`.
- Enfin, cocher l'item 16 en citant le tag, le SHA et le dossier.

## Sources

`gestion-projet/releases/plan-tag-rc1.md` (#131) ; `scripts/tag_preflight.sh` l. 24-31 et 106-117 (#156) ; `.github/workflows/ci.yml` l. 1-29 ; `release-integrity.yml` l. 3-6 ; `e2e-uat-nightly.yml` ; `e2e-playwright.yml` l. 40-59 ; `docker-compose.e2e.yml` l. 1-7, 105-125 ; `frontend/playwright.config.ts` l. 15-22 ; `gestion-projet/innovateur/checklist-demo.md` l. 16, 77, 84 ; PR #121 (corps) ; `gh pr list --state open` du 17/11. Tout est lu sur `main` 33b2425.
