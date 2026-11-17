# Check-list du tag v1.0.0-rc.1 : fusions du 19 au 24/11, tag, retour arrière, captures

- **Exécutant** : O. Q pour les captures (§ 5). Préparé par l'innovateur le 17/11 sur `main` 33b2425, en lecture seule.
- **Référence** : `gestion-projet/releases/plan-tag-rc1.md` (#131). Ses § 2 à 5 s'appliquent tels quels le 24 et ne sont pas recopiés ici. Cette check-list ajoute l'ordre des fusions qui précèdent, les contrôles de chaque étape et les captures.
- **Commandes** : les commandes de contrôle sont en lecture seule. Les seules écritures sont faites par O : fusions par la file, `gh workflow run`, `gh release create/edit/upload`.

```bash
export MSYS_NO_PATHCONV=1 GODEBUG=
REPO=EagleFox31/GED237 TAG=v1.0.0-rc.1
ci_gate() { gh pr view "$1" --json isDraft,mergeStateStatus,headRefOid,statusCheckRollup \
  -q '"draft=\(.isDraft) etat=\(.mergeStateStatus) tete=\(.headRefOid[0:7])", (.statusCheckRollup[]|select(.name=="CI Gate")|"CI Gate \(.status) \(.conclusion)")'; }
```

## 0. Constats du relevé du 17/11, à connaître avant le 19

1. **Pas de Release Please.** `.github/workflows/` contient `ci`, `backend`, `frontend`, `security`, `e2e-playwright`, `e2e-uat-nightly` et `release-integrity`. Il n'y a ni configuration ni workflow Release Please. Le tag est donc créé **à la main** par `gh release create --target $SHA` (plan § 3). La version du frontend vient de #121 (`package.json`). Celle du backend vient d'`APP_VERSION` au déploiement (#58). `release-integrity.yml` part sur `release: published`.
2. **#131 est déjà fusionnée** (17/11) : c'est le plan du tag lui-même. L'étape « #131 selon le plan » consiste à suivre ce plan le 24 ; il n'y a rien à fusionner.
3. **`tag_preflight.sh` (#156) est trop indulgent sur la recette nocturne.** Il affiche `OK nightly … (antérieur à ce SHA)` quand le dernier run vert porte sur un SHA plus ancien (l. 116-117). Le plan exige un run sur ce SHA. **Seule la ligne `OK nightly dernier run vert, sur ce SHA` compte.** Le script se corrige après le 30, sans PR avant le tag.
4. **Un run vert ne produit aucune capture.** `frontend/playwright.config.ts` règle `screenshot: 'only-on-failure'` et `trace: 'on-first-retry'`. Le rapport nocturne d'un run vert n'a donc aucune image des parcours. L'item 16 de la check-list de démo exige un run dédié (§ 5).
5. **Les notes de #104 ont encore l'en-tête interne** (« brouillon vivant », puces « Pour », « Format », « Périmètre »). Le contrôle bloquant du plan § 3 répond aujourd'hui `STOP`. Aucune PR de documentation n'est possible après #121 : l'innovateur retire donc cet en-tête dans le push unique du 19.
6. **PR Dependabot ouvertes et non brouillon** : #29, #30, #110 à #113, #141. Elles sont gelées (`note-gel-dependances-rc1.md`) et ne doivent pas entrer dans la file avant le tag.

## 1. Ordre des fusions

Aucune autre fusion entre ces étapes. Une PR n'entre dans la file que si son contrôle est vert.

| # | Quand | PR | Contrôle avant d'entrer dans la file | Commande (lecture seule) | Si KO |
|---|---|---|---|---|---|
| E1 | 19/11 après 18:00 | **#104**, notes de version et relevé de coupure (I pousse une fois, puis `gh pr ready 104`) | plus en brouillon ; CI Gate `COMPLETED SUCCESS` ; pas `BEHIND` (sinon la file la met à jour) ; notes sans en-tête interne | `ci_gate 104` puis `gh pr diff 104 --name-only` (seulement `gestion-projet/`, `CHANGELOG.md`) et `git fetch -q origin docs/notes-version-rc1 && git show origin/docs/notes-version-rc1:gestion-projet/innovateur/notes-version-v1.0.0-rc.1.md \| head -n 5 \| grep -Eiq 'brouillon\|Pour\**[[:space:]]*:' && echo STOP \|\| echo OK` | I corrige dans la soirée (nouveau push accordé par O seulement) ; E2 attend |
| E2 | avant le 20/11 12:00 | **PR des notes de B** (worktree `GED237-notes-rc1`, rebasée sur #104, n° à reporter : `____`) | base = `main` qui contient #104 ; CI Gate verte ; documentation seule | `ci_gate <n>` ; `gh pr diff <n> --name-only` ; `git merge-base --is-ancestor $(gh pr view 104 --json mergeCommit -q .mergeCommit.oid) $(gh pr view <n> --json headRefOid -q .headRefOid) && echo base-OK` | B rebase ; la recette du 20 part quand même (elle ne dépend pas des notes) |
| E3 | 20 au 23/11 | **Correctifs de recette**, s'il y en a | un constat de recette cité dans la PR ; accord O ; CI Gate verte ; périmètre limité au constat | `ci_gate <n>` ; `gh pr diff <n> --name-only` | pas de fusion ; constat noté comme écart annoncé |
| E3 bis | 23/11 au soir, après le dernier correctif | aucune fusion : **recette nocturne sur la tête de `main`** avant #121 | run vert, sur ce SHA | `gh workflow run e2e-uat-nightly.yml --ref main` puis `gh run list -w e2e-uat-nightly.yml -b main -L 1 --json status,conclusion,headSha -q '.[0]\|"\(.status) \(.conclusion) \(.headSha)"'` = `completed success $(git rev-parse origin/main)` | rouge : correctif en E3 **avant** #121. C'est la raison de cette étape : après #121, tout correctif casse la règle « #121 en dernier » |
| E4 | — | **#131**, déjà fusionnée | le plan est sur `main` | `gh pr view 131 --json state -q .state` = `MERGED` | — |
| E5 | 24/11 matin, accord PO obtenu | **#121 en dernier** (version du frontend) | plan § 1 : seuls restent ouverts les brouillons `post-rc1` et les PR gelées ; #121 pas `BEHIND` | `gh pr list --state open --json number,isDraft,title -q '.[]\|select(.isDraft\|not)\|"\(.number) \(.title)"'` (attendu : #121 et les Dependabot du § 0.6) ; `ci_gate 121` ; après fusion : `git show origin/main:frontend/package.json \| grep '"version"'` = `1.0.0-rc.1` | ne pas fusionner ; § 4 |

Après E5, **aucune fusion** jusqu'au tag, même de documentation.

## 2. Contrôles sur le SHA final (24/11, après E5)

Plan § 2, dans l'ordre :

1. Tête de `main` = fusion de #121 : `[ "$(gh pr view 121 --json mergeCommit -q .mergeCommit.oid)" = "$(git rev-parse origin/main)" ] && echo OK`.
2. Recette nocturne relancée sur ce SHA (plan § 2, `gh workflow run` puis `gh run watch --exit-status`).
3. `bash scripts/tag_preflight.sh $TAG` depuis un clone à jour. Attendu : uniquement des `OK`, avec **`OK nightly dernier run vert, sur ce SHA`** (§ 0.3), et la dernière ligne `PRÊT : … <SHA>`.
4. Noter le SHA : `________`. C'est le seul SHA autorisé pour le tag.

## 3. Pose du tag

- **Qui** : O, après l'accord du PO.
- **Sur quel SHA** : celui du § 2.4, la fusion de #121.
- **Comment** : à la main, avec la pré-version GitHub (plan § 3). GitHub crée le tag sur `--target $SHA`. Release Please n'est pas en place (§ 0.1) ; son adoption (`reusable-release.yml` d'appfactory) est une piste **après le 30**.
- **Ensuite** : notes contrôlées (plan § 3), publication, vérification `release-integrity` et preuves jointes à la release (plan § 4). Écrire le tag, le SHA, le n° de run et `exit=0` dans la passation d'O.

## 4. Retour arrière si un contrôle échoue

| Moment | Échec | Geste |
|---|---|---|
| Avant une fusion (E1 à E5) | contrôle rouge | ne pas fusionner ; la PR revient à son auteur ; l'étape suivante attend |
| Après une fusion fautive, avant #121 | régression constatée en recette | PR de retour arrière (`git revert` du commit de fusion) par son auteur, par la file, avec l'accord d'O ; puis E3 bis |
| Recette nocturne rouge sur le SHA final (§ 2.2) | test rouge | **pas de tag**. Q qualifie. Un seul `gh run rerun <id>` est permis si l'échec est une instabilité prouvée. Un second rouge impose un correctif, ce qui casse « #121 en dernier » : décision O (§ 4 bis) |
| Fusion passée après #121 | `tag_preflight` KO `dist` (pas de `Frontend / Build` sur le SHA) | **Stop** (plan § 2) ; décision O (§ 4 bis) |
| Après publication | signature ou manifeste KO | plan § 5 : `gh release edit $TAG --draft=true` d'abord, puis cas A à D. Suppression du tag (cas D) seulement avec l'accord du PO |
| Non résolu le 24 à 18:00 | — | release laissée en brouillon, PO prévenu ; la démo du 30 ne dépend pas du tag (images sur clé USB, checklist H-30) |

**§ 4 bis. Option d'O si une fusion est passée après #121.** `ci.yml` a un `workflow_dispatch` qui lance **toutes** les gates (`mode: all`, l. 8 et 29). `gh workflow run ci.yml --ref main` reconstruit donc `Frontend / Build` et l'artefact `frontend-build` sur la nouvelle tête. On relance ensuite la recette nocturne puis `tag_preflight.sh`. C'est préférable à une nouvelle fusion de #121, qui est impossible, ou à un tag sur un SHA non contrôlé.

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
