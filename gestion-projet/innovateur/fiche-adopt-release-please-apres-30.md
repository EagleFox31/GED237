# Fiche Adopt / Adapt / Build : release automatique de GED237 après le 30/11

Instruit par l'innovateur le 2026-11-17, pour O. Sources lues en lecture seule avec `gh`, sans recherche web :
- dans `EagleFox31/appfactory-project-automation` : `README.md`, `docs/product-release-automation.md`, `docs/RELEASING.md`, `.github/workflows/reusable-release.yml`, `examples/product-release.yml` ;
- dans GED237 sur `origin/main` : `.github/workflows/release-integrity.yml`, `.github/appfactory-impact.json`, `frontend/package.json`, `backend/.env.example`, ainsi que les règles de la branche `main`.

**Rien ne change avant le 30.** Le tag `v1.0.0-rc.1` du 24 est posé à la main par O, selon `checklist-tag-rc1-24-11.md` § 3.

## 1. Ce que fournit la brique

`reusable-release.yml` est un `workflow_call` qui appelle `googleapis/release-please-action@v4`. Il a deux modes :
- **direct** : `release-type`, `path`, `versioning-strategy` et `release-as` ;
- **manifest** : `config-file` et `manifest-file`. Dans ce mode, l'entrée `release-as` n'est pas transmise.

Son fonctionnement :
1. Il lit les Conventional Commits depuis la dernière release : `fix:` donne un patch, `feat:` une mineure, `!` ou `BREAKING CHANGE` une majeure.
2. Il tient une **PR de release** à jour, qui contient `CHANGELOG.md`, `version.txt` et le manifest.
3. Une fois cette PR fusionnée, il pose le tag `vX.Y.Z` et publie la GitHub Release.

Il renvoie en sortie `release_created`, `tag_name`, `version` et `release_sha`. Il ne construit rien et ne signe rien.

Côté GED237, le terrain est déjà prêt :
- **274 des 282** commits hors fusion du dernier mois suivent déjà le format Conventional Commits ;
- aucune release n'existe encore sur le dépôt ;
- `APP_VERSION` est fixé au déploiement par variable d'environnement, sans fichier versionné ;
- `frontend/package.json` est à `0.0.0`.

## 2. Ce qu'il faudrait pour GED237

Ces fichiers sont dans `.github/` et à la racine, et l'innovateur n'y touche pas. Ce travail revient à B ou à Q après le 30.

| Point | Proposition |
|---|---|
| **Config** | Mode manifest, avec un seul paquet racine. `release-please-config.json` : `{"packages": {".": {"release-type": "simple", "include-component-in-tag": false}}}`. `.release-please-manifest.json` : `{".": "1.0.0-rc.1"}`, c'est-à-dire la dernière version publiée, comme l'appfactory l'a fait à son lancement (« seeded at v1.1.0 »). On ne versionne ni `frontend/package.json` ni le backend en V1 : `version.txt` suffit, et le déploiement continue de lire `APP_VERSION`. |
| **Passage à 1.0.0** | Le calcul automatique à partir d'une pré-version n'a pas été vérifié ici. Pour la version finale, on ajoute une seule fois `"release-as": "1.0.0"` dans la config, puis on le retire après la fusion de la PR de release. En mode manifest, l'entrée `release-as` du workflow est ignorée. |
| **Workflow appelant** | `.github/workflows/release.yml`, repris de `examples/product-release.yml` : `on: push: main` et `workflow_dispatch`, `with: config-file: release-please-config.json`. |
| **SHA épinglé** | `uses: EagleFox31/appfactory-project-automation/.github/workflows/reusable-release.yml@0523510a8e42290df3bae5749d034b1637569af5  # v1.4.0`. C'est le commit de la release `v1.4.0`, qui est aussi le commit de l'alias `v1` aujourd'hui. Le mode manifest y est déjà présent. `main` (e912a8a) a 187 commits d'avance, mais n'ajoute pour ce workflow que le choix du runner, dont nous n'avons pas besoin. |
| **Permissions** | Sur le workflow appelant : `contents: write`, `pull-requests: write`, `issues: write`. Un workflow appelé ne peut pas obtenir plus que ce que l'appelant lui accorde. Le reste du dépôt reste en `contents: read`. |
| **Jeton** | Sans `release_token`, la brique utilise le `GITHUB_TOKEN` du dépôt. Voir le § 3 pour ses deux effets de bord. |
| **CI proportionnelle** | `version.txt`, `release-please-config.json` et `.release-please-manifest.json` ne correspondent à aucune surface de `appfactory-impact.json`. Comme `fallback` vaut `all`, chaque PR de release lancerait **tous les gates**. Il faut ajouter ces trois fichiers à `ignorePaths`. `CHANGELOG.md` y est déjà couvert par `**/*.md`. |

## 3. Les deux effets de bord du `GITHUB_TOKEN`

GitHub ne déclenche pas de nouveaux workflows pour les événements créés avec `GITHUB_TOKEN`. La documentation de l'appfactory le dit dans « Token behavior ». Cela a deux conséquences.

1. **La CI ne tournerait pas d'elle-même sur la PR de release.** Le ruleset « AppFactory default branch governance » exige des checks, donc la PR resterait bloquée.
   - Pour la débloquer sans secret, un humain ferme puis rouvre la PR. Les releases sont rares, ce geste suffit.
   - L'autre voie est un jeton dédié `APPFACTORY_RELEASE_TOKEN`, à portée fine (contenu et PR de ce seul dépôt). Ce serait un PAT, ce qui contredit la règle « zéro PAT ». Il faudrait donc une dérogation écrite.
   - La brique n'accepte pas d'App GitHub pour ce jeton. C'est un manque à remonter à l'appfactory : O ouvre l'issue, car les sessions ne peuvent pas en créer.
2. **`release-integrity.yml` ne serait pas lancé**, parce que son déclencheur `release: published` ne réagit pas à une release publiée avec `GITHUB_TOKEN`. Le SBOM, le manifeste et la signature manqueraient alors en silence.
   - Le remède tient dans le workflow appelant : un second job `needs: release`, avec `if: needs.release.outputs.release_created == 'true'`, qui lance `gh workflow run release-integrity.yml --ref "${{ needs.release.outputs.tag_name }}"`. Ce job demande `actions: write`. Un `workflow_dispatch` lancé par `GITHUB_TOKEN` est bien exécuté.
   - Autre option : ajouter `workflow_call` à `release-integrity.yml` et l'appeler directement.

## 4. Effet sur les tags existants

- Le dépôt n'a encore **aucun tag ni aucune release**. Le premier sera `v1.0.0-rc.1`, posé à la main le 24.
- Release Please **ne réécrit ni ne supprime** de tag. Il part de la version du manifest (`1.0.0-rc.1`) et de la release qui porte ce tag pour délimiter les commits du prochain changelog.
- Le format doit être identique, `v` + version et sans composant : c'est la valeur par défaut de la brique (`include-v-in-tag: true`) avec `include-component-in-tag: false`.
- **Risque** : si Release Please ne trouve pas la release `v1.0.0-rc.1`, par exemple parce que c'est une pré-release ou que le format diffère, il reprend tout l'historique dans le changelog. Il faut donc le vérifier avant d'activer l'automatisation, par une exécution à blanc en Docker sur `main` : `release-please release-pr --dry-run`. Si besoin, on fixe `"last-release-sha"` sur le commit de rc.1 (point à confirmer pendant cette exécution à blanc).

## 5. Compatibilité avec la pose manuelle de rc.1

- **Compatible.** rc.1 reste entièrement manuel le 24 : O le pose, puis `release-integrity` se déclenche normalement, puisque la release est publiée par un humain.
- L'automatisation n'arrive qu'après le 30, avec un manifest qui démarre à `1.0.0-rc.1`. Elle reprend donc là où la pose manuelle s'arrête.
- **Il ne doit y avoir qu'un seul propriétaire des tags** : une fois `release.yml` fusionné, on ne pose plus de release à la main avec `gh release create`, sauf en retour arrière documenté. Les deux voies ne doivent jamais viser la même version.
- `checklist-tag-rc1-24-11.md` reste valable pour rc.1. Les contrôles `ci_gate()` et nightly sur le SHA final s'appliquent ensuite à la PR de release, qui passe dans la file de fusion comme les autres PR.

## 6. Coût en heures de session

| Étape | Qui | h-s |
|---|---|---|
| Config, manifest, `release.yml` épinglé et job qui chaîne `release-integrity` | B ou Q | 0,25 |
| `ignorePaths` dans `appfactory-impact.json` | B ou Q | 0,1 |
| Exécution à blanc de Release Please en Docker sur `main` (changelog borné à rc.1) | Q | 0,25 |
| Première PR de release `1.0.0` (`release-as`), fermer et rouvrir, vérifier les checks, la fusion et `release-integrity` | Q, puis O pour la fusion | 0,25 |
| Revue croisée et entrée « RAIDER review » dans la PR | Q | 0,15 |
| **Total** | | **≈ 1 h-s** |

À cela s'ajoute 0,1 h-s pour O afin de trancher le jeton et d'ouvrir l'issue sur l'appfactory, si l'option est retenue. Il faut prévoir +0,25 h-s si l'exécution à blanc ne trouve pas rc.1 et qu'il faut fixer `last-release-sha`.

## 7. Recommandation

**Adopt.** On reprend la brique `reusable-release.yml` **sans la modifier**, épinglée sur `0523510a` (v1.4.0), en mode manifest et avec une graine à `1.0.0-rc.1`. Construire notre propre outil n'apporterait rien : il referait Release Please. Le seul travail propre à GED237 est de la configuration dans notre dépôt :
- les `ignorePaths` ;
- le job qui chaîne `release-integrity` ;
- le geste « fermer puis rouvrir » sur la PR de release.

Ce n'est pas un Adapt de la brique.

Le calendrier :
- l'activation se fait après le 30, dans une PR dédiée de B ou Q ;
- la première release automatique est `v1.0.0`, par un `release-as` unique ;
- l'exécution à blanc doit d'abord montrer un changelog borné à rc.1.

> **Phrase d'accord** : « Accord O du JJ/MM : après le 30, GED237 adopte `reusable-release.yml` d'appfactory, épinglé sur `0523510a` (v1.4.0), en mode manifest avec une graine à `1.0.0-rc.1`. Les permissions sont `contents`, `pull-requests` et `issues` en écriture, sans PAT : la PR de release est fermée puis rouverte pour lancer la CI, et `release-integrity` est chaîné par `workflow_dispatch`. rc.1 reste posé à la main le 24, et toute release suivante passe uniquement par Release Please. Coût ≈ 1 h-s, porté par B ou Q, après une exécution à blanc. »

## 8. Décisions de O du 17/11

1. **Adopt après le 30**, confié à B ou Q pour ≈ 1 h-s, à affecter le 1er décembre.
2. **Pas de PAT.** La PR de release est fermée puis rouverte à la main pour lancer la CI. O ouvre l'issue appfactory, pour qu'une App soit acceptée comme jeton, après le 30.
3. **`release-integrity` est chaîné** par un job `needs: release`, comme au § 3.
4. **L'exécution à blanc en Docker est obligatoire** avant l'activation.

## 9. Complément : si une rc.2 est posée

`plan-fusion-post-rc1.md` (option A, retenue par O) prévoit qu'une rc.2 éventuelle soit posée au plus tard le 27. Un correctif tardif passerait alors par la branche `release/v1.0.0`, créée depuis le dernier tag rc. Il faut donc adapter la mise en place à la date d'activation, sans changer la recommandation :

- **La graine du manifest suit la dernière rc publiée.** Si rc.2 existe, on met `{".": "1.0.0-rc.2"}` au lieu de `1.0.0-rc.1`. Sinon, Release Please calculerait la version suivante à partir d'une version périmée.
- **Si le tag rc.2 est posé sur `release/v1.0.0`, et non sur `main`**, son commit ne fait pas partie de l'historique de `main`. Release Please, qui ne lit que `main` (`target-branch`), ne pourrait pas s'en servir pour délimiter le changelog.
  - Dans ce cas, on fixe `"last-release-sha"` sur le dernier commit de `main` qui figure dans la rc : `git merge-base origin/main v1.0.0-rc.2`.
  - Les cherry-picks de `release/v1.0.0` doivent avoir été reportés sur `main`. Sinon, ils manquent à la `v1.0.0`.
- **Release Please ne gère que `main`.** La branche `release/v1.0.0` reste manuelle jusqu'à sa fermeture, après la `v1.0.0`. On n'y fait tourner aucune deuxième instance de Release Please.
- **L'exécution à blanc** (point 4 du § 8) vérifie les deux cas :
  - le changelog commence après la dernière rc ;
  - la PR propose bien `1.0.0`.

> Accord O du 17/11 : décisions du § 8. L'adaptation de la graine et de `last-release-sha` au § 9 se fait le 1er décembre, selon qu'une rc.2 existe ou non.

## Revue RAIDER (instruction)

- **R (Reusable)** : la brique est reprise telle quelle, et toute la configuration est propre à GED237.
- **A (Agnostic)** : la branche cible est `main` par défaut, et le type `simple` ne suppose pas de stack.
- **I (Idempotent)** : Release Please met à jour une seule PR, sans doublon.
- **D (Durable)** : rc.1 manuel et `release-integrity` restent en place, et le chaînage évite une perte silencieuse.
- **Failure memory** : il n'y a pas d'incident. Le risque d'un `release: published` non déclenché est noté au § 3 et doit être vérifié lors de la première release.
- **E (Engineering-grade)** : le SHA est épinglé, les permissions sont minimales, et on suit plan → exécution à blanc → apply.
- **Scoped** : les `ignorePaths` évitent de lancer tous les gates.
- **Reuse-first** : Adopt.
- **R (Retroactive)** : la graine part de rc.1, sans réécrire les tags.
