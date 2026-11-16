# Plan du tag v1.0.0-rc.1 (mar 24/11)

- **Exécutant** : O. **Durée** : environ 30 min, plus le temps de CI.
- **Prérequis** : #104 fusionnée (notes de version et `CHANGELOG.md`) ; recette du 20 au 23/11 close avec un run uat complet vert (Q) ; accord du PO pour taguer.
- **Shell** : Git Bash, à la racine d'un clone à jour ; `export MSYS_NO_PATHCONV=1 GODEBUG=` avant les commandes `gh`.

```bash
TAG=v1.0.0-rc.1
REPO=EagleFox31/GED237
FPR=7776361468B5DF0CFF903723A00188980F856DF1
```

## 1. Fusion de #121 (version du frontend)

- [ ] `gh pr view 121 --json state,mergeStateStatus,headRefOid` : OPEN, et pas BEHIND (sinon, la file la met à jour).
- [ ] Fusionner #121 via la file.
- [ ] `git fetch -q origin main && git show origin/main:frontend/package.json | grep '"version"'` affiche `"version": "1.0.0-rc.1"`.

## 2. SHA de main, vert

- [ ] `SHA=$(git rev-parse origin/main) && echo $SHA`. Noter le SHA ici : `________`.
- [ ] Aucun run en échec ni en cours sur ce SHA :
  `gh run list -c $SHA --json workflowName,status,conclusion -q '.[]|"\(.workflowName) \(.status) \(.conclusion)"'`
  Attendu : toutes les lignes en `completed success` (ou `skipped`), au minimum CI et Security.
- [ ] Le dernier run `E2E UAT nightly` sur main est vert (`gh run list -w e2e-uat-nightly.yml -b main -L 1`). Sinon, le lancer : `gh workflow run e2e-uat-nightly.yml --ref main`.
- [ ] Le tag n'existe pas encore : `git ls-remote --tags origin $TAG` ne renvoie rien.

**Stop** si une case est rouge : pas de tag sur un SHA non vert.

## 3. Notes de version et publication

- [ ] Prendre les notes de version de #104 (décision O du 16/11) :
  `git show $SHA:gestion-projet/innovateur/notes-version-v1.0.0-rc.1.md > /tmp/notes-rc1.md`
- [ ] **Bloquant** : le fichier versionné est exactement ce qui est publié, donc sans en-tête interne (décision O du 17/11). La commande suivante doit afficher `OK` :
  `head -n 5 /tmp/notes-rc1.md | grep -Eiq 'brouillon|Pour\**[[:space:]]*:' && echo "STOP: en-tête interne présent" || echo OK`
- [ ] Relire `/tmp/notes-rc1.md` : le fichier n'est pas vide et il ne reste aucun texte d'attente (« relevé O reporté ici le 19 au soir », « brouillon vivant ») ni l'en-tête interne (puces « Pour », « Format », « Périmètre » avant `---`).
- [ ] La section `## [1.0.0-rc.1]` de `CHANGELOG.md`, qui fait référence, concorde avec les notes :
  `diff <(git show $SHA:CHANGELOG.md | awk '/^## \[1\.0\.0-rc\.1\]/{f=1} f&&/^## \[/&&!/rc\.1/{exit} f') <(sed -n '/^## \[1\.0\.0-rc\.1\]/,$p' /tmp/notes-rc1.md)` ne renvoie rien, ou seulement des écarts expliqués.
- [ ] Publier (pré-version ; le tag est créé par GitHub sur le SHA vérifié) :
  `gh release create $TAG --repo $REPO --target $SHA --title "E-Dossier Cameroun $TAG" --notes-file /tmp/notes-rc1.md --prerelease`
- [ ] `git fetch -q --tags && git rev-parse $TAG^{commit}` est égal à `$SHA`.

## 4. Vérification de release-integrity (selon `DOCS/exploitation/verifier-release.md`)

La publication déclenche `release-integrity.yml` (`release: published`).

- [ ] Trouver le run : `RUN=$(gh run list -w release-integrity.yml -e release -L 1 --json databaseId,headSha -q '.[0].databaseId') && echo $RUN`
  Vérifier que son `headSha` est égal à `$SHA`.
- [ ] `gh run watch $RUN --exit-status` réussit, et `gh run view $RUN --log | grep "not configured"` ne renvoie rien (sinon, signature absente : aller au §5 cas A).
- [ ] Vérification, dans un dossier vide à la racine du clone :
  ```bash
  curl -fsSL https://github.com/EagleFox31.gpg | gpg --import
  gh run download $RUN -n release-integrity -D release-integrity && cd release-integrity
  gpg --status-fd 1 --verify manifest.sha256.asc manifest.sha256 | grep -Eq "^\[GNUPG:\] VALIDSIG .* $FPR\$" && sha256sum -c manifest.sha256; echo "exit=$?"
  ```
  Attendu : `backend-cyclonedx.json: OK`, `frontend-cyclonedx.json: OK`, `exit=0`.
- [ ] Joindre les preuves à la release (décision O du 17/11), car l'artefact du run expire après 30 jours :
  `gh release upload $TAG backend-cyclonedx.json frontend-cyclonedx.json manifest.sha256 manifest.sha256.asc`
  puis `gh release view $TAG --json assets -q '.assets[].name'` liste les 4 fichiers.
- [ ] Noter dans la passation O : le tag, le SHA, le n° du run et `exit=0`.

## 5. Retour arrière si la vérification échoue

Premier geste dans tous les cas : **retirer la release de la circulation sans toucher au tag**.
`gh release edit $TAG --draft=true`. Le tag reste et rien n'est supprimé. Ne rien diffuser au PO ni au ministère.

| Cas | Symptôme | Action |
|---|---|---|
| A | `manifest.sha256.asc` absent, avertissement `not configured` | Remettre les secrets `RELEASE_GPG_PRIVATE_KEY` et `RELEASE_GPG_PASSPHRASE` (mainteneur), puis republier avec `gh release edit $TAG --draft=false` : la publication relance le workflow. Refaire le §4 sur le **nouveau** run. |
| B | `BAD signature`, ou exit 1 sans ligne `OK` (autre clé que `$FPR`) | Le secret ne contient pas la bonne clé, ou le manifeste a été altéré. Ne pas republier. Le mainteneur vérifie l'empreinte de la clé du secret. Corriger le secret, puis faire comme en A. |
| C | `FAILED` sur une ligne de `sha256sum -c` | L'artefact est incohérent. Relancer le workflow sur le tag (`gh workflow run release-integrity.yml --ref $TAG`), refaire le §4 sur ce run, et republier (`--draft=false`) seulement si c'est OK. |
| D | Mauvais SHA tagué (§3, dernière case) | Seul cas où l'on supprime, **avec l'accord du PO** et avant toute diffusion : `gh release delete $TAG --cleanup-tag --yes`, puis reprendre au §2. |

Si le problème n'est pas résolu le 24 à 18:00, garder la release en brouillon et prévenir le PO. La démo du 30/11 ne dépend pas de la signature : les images viennent de la clé USB, construites la veille (checklist H-30).
