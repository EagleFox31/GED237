# Release taguée pour la démo du 30/11 (ordre 6 « release taguée », DEC-2026-002 ; gel lundi 24/11)

- **Pour** : orchestrateur (déclenche), ci-qa (vérifie), dev-backend / dev-frontend (bump de version). Instruit par l'innovateur le 2026-11-09 22:00.
- **Niveaux** : `Vérifié` = dépôt / API GitHub lus ce jour ; `Constaté` = observé sans vérifier la cause ; `Déduit` ; `Proposé`.
- **Lien** : `checklist-demo.md` § A (« Release taguée … `docker save` des 7 images sur une clé USB »), `plan-presentation.md` § 4 (question « Qui garantit la sécurité du code ? »).

## 1. État réel du dépôt (`Vérifié`, 2026-11-09)

| Fait | Détail | Conséquence |
|---|---|---|
| **Aucun tag**, aucune release GitHub | `git tag -l` vide, `git ls-remote --tags origin` = 0 | le premier tag du projet sera celui de la démo : tout est à définir, rien à casser |
| `release-integrity.yml` (« T6.5 ») existe | déclencheur `release: published` + `workflow_dispatch` ; génère deux SBOM CycloneDX (backend `requirements.txt`, frontend `package-lock.json`), manifeste SHA-256, **signature GPG détachée** si secrets présents, artefact `release-integrity` (rétention par défaut) | une release **publiée** produit automatiquement SBOM + manifeste signé : preuve prête pour le jury, zéro code |
| Secrets `RELEASE_GPG_PRIVATE_KEY` et `RELEASE_GPG_PASSPHRASE` présents (créés le 2026-04-18) | `gh secret list` | la signature se fera ; le workflow n'a jamais tourné sur une release (`Constaté` : aucune release) → **le tester une fois en `workflow_dispatch` avant le 24/11** |
| Pas de Release Please | aucun `release-please-config.json` / `.release-please-manifest.json`, aucun workflow `release.yml` | `reusable-release.yml` d'appfactory serait une **adoption nouvelle**, pas une remise en route |
| CI (`ci.yml`) sur `push`/`pull_request` vers `main` et `develop` seulement ; pas de déclencheur `tags` ; aucune image Docker construite ni publiée par la CI | `.github/workflows/ci.yml` | les images de démo sont construites **localement** depuis le tag (déjà prévu par la checklist : `docker save`) |
| Versions incohérentes : backend `version="1.0.0"` codé en dur (`backend/app/main.py:44,93,104`, exposé par `/health`), frontend `"version": "0.0.0"` (`frontend/package.json`) | code | un jury qui ouvre `/health` ou l'à-propos voit « 1.0.0 » alors que rien n'est tagué ; à aligner sur le tag (§ 3.2) |
| Ruleset « AppFactory default branch governance » actif sur `main` ; messages de commit majoritairement conventionnels (`fix(login):`, `docs:`, `feat…`) mais pas tous (`Constaté` sur les 40 derniers) | GitHub | compatible Release Please à terme ; aujourd'hui un changelog généré serait incomplet |
| appfactory `reusable-release.yml@v1` : Release Please v4, entrées `release-type`, `target-branch`, `path`, `release-as` (override unique), mode manifeste ; sorties `tag_name`, `version`, `release_sha` ; secret optionnel `release_token` ; exemple `examples/product-release.yml` (`push: main` + `workflow_dispatch`) ; existe aussi `reusable-container-release-verify.yml` | dépôt appfactory | Adopt possible en ~30 lignes, mais ajoute un **cycle Release PR** (ouverture, merge) sur `main` pendant la semaine du gel |

## 2. Options

| Option | Ce que ça donne | Coût d'ici le 24/11 | Risque |
|---|---|---|---|
| **A — Tag + release GitHub manuels, documentés** (`Proposé`) | `gh release create vX --target <sha> --notes-file …` par O ; `release-integrity.yml` se déclenche sur la publication ; images construites localement depuis le tag | **0,25 j** (0,1 j bump de version B+F, 0,1 j note de version O, 0,05 j test `workflow_dispatch`) | faible : une seule commande, réversible (supprimer la release/tag avant diffusion) |
| B — Adopt `reusable-release.yml` maintenant | Release Please ouvre une Release PR à chaque push sur `main`, version calculée depuis les commits, `release-as` pour forcer la première version | 0,5 j O/Q (workflow, `release_token` ou permissions GitHub Actions « allow PR creation », premier run avec `release-as`, réglage du changelog) | nouveau workflow mis au point **la semaine du gel**, pendant une panne partielle GitHub Actions constatée ce soir ; Release PR = un merge de plus sur `main` au moment où on veut figer ; changelog incomplet (commits non conventionnels) visible par le jury |
| C — Rien (image `latest` locale) | — | 0 | pas de preuve de version, `/health` ment, SBOM non produit ; ordre 6 non tenu |

**Recommandation : A pour la démo, B en V1.1** (première vraie release `v1.0.0` début décembre avec `release-as`, quand les commits de la V1.1 suivront la convention). Le budget DEC-002 est à 9,75/10 j-p : 0,25 j tient dans la marge, 0,5 j non. Décision O, pas de DEC nécessaire ; consigner dans le point S1 (D6).

## 3. Plan option A (`Proposé`)

### 3.1 Nommage et calendrier

| Tag | Quand | Qui | Contenu |
|---|---|---|---|
| `v1.0.0-rc.1` | **lundi 24/11**, après le dernier merge du gel | O | release candidate = périmètre figé ; **pré-release** GitHub (case « pre-release » cochée) |
| `v1.0.0-rc.2` (si correctifs de recette après le 24) | au plus tard **jeudi 27/11 matin**, avant la répétition générale | O | mêmes règles ; **le tag monté sur les postes de démo est le dernier rc** |
| `v1.0.0` | **après** la démo, si GO du PO | O | V1 livrée ; ensuite Release Please (option B) prend la suite |

Semver strict (`v` + `MAJOR.MINOR.PATCH[-rc.N]`) : compatible avec Release Please plus tard et avec le `v` par défaut de l'outil ; pas de suffixe « -demo » (non ordonnable, illisible dans six mois). Règle : **aucune image non taguée** sur le poste principal ni le poste de secours.

### 3.2 Avant le tag (semaine 2, 0,1 j B + F)

- Une seule source de version : `APP_VERSION` lue dans `config.py` (défaut `0.0.0-dev`), injectée par `build-arg`/variable d'environnement dans le compose, affichée par `/health` et l'à-propos frontend (`VITE_APP_VERSION`) ; `frontend/package.json` passe à `1.0.0-rc.1`. Si trop coûteux pour la semaine 2 : au minimum remplacer les trois `"1.0.0"` codés en dur par la valeur du tag dans la même PR que le bump de `package.json` (`Déduit` : 0,1 j).
- Tester `release-integrity.yml` une fois en `workflow_dispatch` (Q, 0,05 j) : vérifier que l'artefact contient `manifest.sha256.asc` (signature réellement produite), sinon ouvrir une issue avant le 24.

### 3.3 Le jour du tag (O, 15 min)

1. `main` vert (CI complète), dernière PR du gel fusionnée ; noter le SHA.
2. `gh release create v1.0.0-rc.1 --target <sha> --prerelease --title "GED237 V1 — release candidate 1 (démo du 30/11)" --notes-file gestion-projet/releases/v1.0.0-rc.1.md` (la commande passe par l'API : **aucune écriture dans le checkout partagé**, pas de worktree nécessaire).
3. Attendre `release-integrity` vert ; télécharger l'artefact `release-integrity`, le joindre à la release (`gh release upload`) pour qu'il soit visible sans compte GitHub Actions ; noter les SHA-256 des SBOM dans la note.
4. Q : `git checkout v1.0.0-rc.1` dans **son** worktree, `docker compose build`, `docker save` des 7 images (`edossier_*`, `postgres:15-alpine`, `redis:7-alpine`, `nginx:alpine`) → `ged237-v1.0.0-rc.1-images.tar` + `.sha256` sur la clé USB (checklist A) ; `/health` affiche `1.0.0-rc.1`.

### 3.4 Note de version pour le jury (`gestion-projet/releases/v1.0.0-rc.1.md`, O rédige, innovateur relit)

1. **Périmètre V1** : les 8 parcours de démo (`parcours-demo.md`) et les écrans couverts ; une ligne par parcours avec son statut de recette (GO/NO-GO du 21/11).
2. **Ce que la V1 ne fait pas encore** : renvoi à `plan-presentation.md` § 3 (15 écarts), **même formulation** ; le jury qui lit la note et écoute la présentation entend la même chose.
3. **Sécurité et intégrité** : SBOM backend + frontend (CycloneDX), manifeste SHA-256 signé GPG (empreinte de la clé publique), analyses de dépendances/secrets/conteneurs à chaque PR (Lots A–B), exception pip-audit datée starlette (écart 13), branche `main` gouvernée par ruleset.
4. **Exploitation** : procédure de sauvegarde/restauration prouvée (`sauvegarde-restauration.md` § 3.3, durée mesurée), variables d'environnement de démo (`DEBUG=false`, limites auth), version affichée par `/health`.
5. **Données et comptes de démo** : description du jeu (`jeu-donnees-demo.md`, compteurs `expected`), **aucun identifiant** ; « comptes communiqués hors dépôt ».
6. **Changements depuis le dernier point** : liste des PR fusionnées depuis le 10/11 (`gh pr list --state merged --search "merged:>=2026-11-10"`), triées par ordre DEC-002 (1 → 6).
7. **Connu / corrigé en rc.2** : section vide au rc.1, remplie au rc.2.

### 3.5 Lien avec la checklist J-1

- Checklist A, item « Release taguée (`v1.0.0-demo` ou équivalent) » → devient **`v1.0.0-rc.N` + release GitHub pré-release + artefact `release-integrity` joint** ; `docker save` depuis ce tag ; `/health` = version du tag (vérifié H-90 en C).
- Checklist B « Poste de secours à l'identique depuis la clé USB » : la somme `.sha256` du tar d'images est vérifiée sur les deux postes.

## 4. Preuve attendue (Q, walkthrough `DONE`)

| Élément | Preuve |
|---|---|
| Release `v1.0.0-rc.N` publiée (pré-release) | URL GitHub, SHA ciblé = tête de `main` au gel |
| `release-integrity` vert | run lié à l'événement `release`, artefact avec `manifest.sha256.asc` |
| Images = tag | `docker image inspect` label ou `/health` → `1.0.0-rc.N` sur les deux postes |
| Note de version | relue par l'innovateur (cohérence avec § 3 du plan) et par le PO |

## 5. Risques et réversibilité

- Release publiée par erreur avant le gel : `gh release delete` + `git push origin --delete v…` tant que personne n'a téléchargé ; sinon publier rc.2.
- `release-integrity` échoue sur le premier vrai run (jamais exercé) : d'où le test `workflow_dispatch` en semaine 2 ; en repli, SBOM générés en local avec les mêmes commandes et joints à la main.
- Panne GitHub Actions le 24/11 (comme ce soir) : le tag et la release existent quand même ; relancer le workflow après coup (`gh workflow run release-integrity.yml`), la preuve n'est pas bloquante pour la construction des images.
- Clé GPG : empreinte à publier dans la note ; la clé privée reste dans les secrets, jamais dans le dépôt ni sur la clé USB.

## Sources

- Dépôt GED237 (2026-11-09) : `.github/workflows/release-integrity.yml`, `.github/workflows/ci.yml`, `backend/app/main.py`, `frontend/package.json`, `docker-compose.yml`, `gh secret list`, `git tag`, `git ls-remote --tags`.
- EagleFox31/appfactory-project-automation : `README.md`, `.github/workflows/reusable-release.yml`, `examples/product-release.yml` (lus via `gh api`, 2026-11-09).
- Semver 2.0.0 (pré-versions `-rc.N`) : https://semver.org/lang/fr/
