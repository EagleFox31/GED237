# PASSATION — GED237

## Objectif en cours
Lots A et B clos (hors décisions PO du B6). Prochain chantier : Lot C (`AUDIT.md` items 9-10) ou dette restante.

## Fait (2026-10-30)
- PR #20 fusionnée (a170e73) : politique de protection de `main` versionnée (`.github/project-config.json`),
  `CONTRIBUTING.md`, LESSON-2026-017.
- PR #21 fusionnée (50081e2) : `define` GEMINI_API_KEY retiré de `frontend/vite.config.ts` (plus de secret
  injecté dans le bundle). CI ciblée constatée : frontend + gitleaks seuls, backend/Trivy/Bandit sautés.
- PR #22 fusionnée (2333eb7) : Lot B item 8 volet frontend. `eslint --fix` 605 → 488 avertissements,
  7 règles rendues à `error`, cliquet `--max-warnings 488` dans `npm run lint`, LESSON-2026-018,
  walkthrough B8 complété.
- PR #18 fusionnée (ba71e2a) : 11 dépendances npm + types recharts ; CI verte sous le plafond 488.
- Branches locales fusionnées supprimées ; local = `main` seul, à jour.

## Décisions prises
- Dette ESLint héritée : plafonnée, pas réécrite. Le plafond baisse au chiffre mesuré après chaque
  nettoyage, jamais relevé (`CONTRIBUTING.md`).
- Les 11 règles encore en `warn` (`frontend/.eslintrc.json`) ne sont pas corrigeables automatiquement.
- Ordre de fusion : un changement de lint avant une montée de dépendances, pour que la CI de la seconde
  vérifie le plafond.

## Reste à faire
1. Après fusion de cette PR doc : constater que seuls gitleaks + `Tracked files` ont tourné (item 3).
2. Suivre appfactory #140 (toujours ouverte le 2026-10-30) ; à sa correction, mettre à jour le SHA épinglé
   dans `ci.yml` (2 occurrences).
3. PO : trancher les constats du walkthrough Lot B6 (`assignable-roles` sans RBAC, `standard` sans
   `users:update_own`, upsert du snapshot par `user_id` seul). Gate de couverture 70 % : décision à part.
4. PO : supprimer les branches distantes fusionnées (chore/gitattributes, chore/lint-blocking,
   ci/impact-aware-ci, feat/schema-head-check, test/api-coverage-lot-b6…) et trier les 4 branches
   `dependabot/*` restantes (une ESLint resolver, un groupe npm, deux pip).
5. Lancer une fois `release-integrity.yml` à la main.
6. Évaluer `reusable-project-automation.yml` (board GitHub Project) : dernier écart de `RAIDER.md`.
7. Dette frontend (Lot D) : 488 avertissements (215 `no-explicit-any`, 87 `button-has-type`, 83 `no-console`),
   bundle ~1,56 Mo sans code-splitting.

## Pièges / contexte
- **Tout s'exécute dans Docker**, plafonné (`--memory`, `--cpus=1`, `--log-opt max-size=1m`). Tests :
  `bash backend/scripts/test-in-docker.sh` (≈ 13 min, gate 70 %). `docker prune` : refusé par le PO.
- Frontend en Docker : copier `frontend/` (sans `node_modules`, `dist`) dans le conteneur `node:20-alpine`
  monté en `:ro`, `npm ci`, puis lint/typecheck/build. Pour rapatrier un `--fix` : tar des fichiers modifiés
  vers un volume du scratchpad, extraire sur l'hôte, `git add` puis `git checkout -- frontend/` (fins de ligne).
- `eslint --fix` sur `object-property-newline` casse l'indentation (règle `indent` à `off`) : relire le diff.
- Plus de push direct sur `main` : tout passe par PR, `CI Gate` vert et branche à jour (`gh pr update-branch`).
- Gouvernance / moteur d'impact en local : tarball appfactory v1.4.0 (`gh api repos/EagleFox31/appfactory-project-automation/tarball/0523510…`)
  extrait **dans** un conteneur `node:24-alpine` ; env `INPUT_GOVERNANCE_MODE`, `INPUT_GOVERNANCE_TOKEN`
  (via `"$(gh auth token)"`, jamais affiché), `INPUT_CONFIG_PATH`, `GITHUB_REPOSITORY`,
  `GITHUB_EVENT_NAME`, `GITHUB_EVENT_PATH`. `MSYS_NO_PATHCONV=1` et `pwd -W` sous Git Bash.
- `gh` : préfixer `export GODEBUG=;`. pre-commit : `export PATH="$HOME/.local/bin:$PATH"`.
- pre-commit refuse de tourner si `.pre-commit-config.yaml` a des modifs non indexées : `git stash push --keep-index -- <fichiers>`.
- Husky (`frontend/.husky`, lint-staged `--max-warnings=0`) n'est pas actif : seul le hook pre-commit tourne.
- Sous Windows, relire `git status` après un `git add` global : collision de casse possible (LESSON-2026-014).
- Ne jamais écrire de Markdown via `echo`/`>>` PowerShell (LESSON-2026-013).
- Trivy peut virer au rouge sans changement de code (nouvelle CVE dans une image de base).
- Fusions et changements de réglages GitHub : autorisation explicite du PO à chaque fois.
- Identité git : AKAA Jennifer. Aucune mention d'IA dans commits/PR.
- Fichier non suivi `gestion-projet/walkthrough/[Gemini] Etat de sante du projet - 2026-10-29.md` : pas à nous, ne pas commiter.

## 2026-11-09 17:10 — Modèle d'équipe d'agents (4 sessions) et base Innovateur

- Créé `gestion-projet/EQUIPE_AGENTS.md` (statut PROPOSÉ) : 4 sessions max (`orchestrateur`,
  `innovateur`, `dev-backend`, `dev-frontend`), PO humain décideur + sous-agent `product-owner`,
  protocole de décision (Innovateur d'abord → DEC → PO si impact produit), communication (messagerie
  inter-sessions, repli fichiers), plan hebdo jusqu'au 30/11 (gel le 24/11).
- Créé `gestion-projet/innovateur/` : README, `contexte-application.md`, `sources/anthropic-agents.md`,
  `sources/github-agents-skills.md` (13 dépôts évalués Adopt/Adapt/Learn/Écarté), `sources/ged-normes.md`.
- Créé `.claude/agents/orchestrateur.md`, `innovateur.md` (mémoire projet, `claude --agent <nom>`),
  `product-owner.md` (sous-agent Sonnet).
- Rien de commité : attendre validation du PO, puis PR `docs/equipe-agents`.
- État dépôt : branche `chore/node-24`, PR #26 verte en attente d'accord PO ; #27 (Node 26) à fermer
  après #26 ; majors Dependabot #29/#30/#32 à instruire par l'innovateur. Messagerie inter-sessions :
  vérifier `/list-agents` (Windows natif ≥ 2.1.234).

## 2026-11-09 17:45 — Orchestrateur : lancement de l'équipe, tri Dependabot exécuté

- Session `orchestrateur-ged` active ; sessions `innovateur`, `ged-dev-backend`, `ged-dev-frontend`,
  `ged-ci-qa` (ex-`ged237-b7`, CI e2e, mission PO). Messagerie inter-sessions fonctionnelle.
- PO a validé le modèle (`EQUIPE_AGENTS.md` → ACCEPTÉ) et DEC-2026-001 : #26 fusionnée (3e05d6c), #27 et
  #31 fermées, #28/#32/#33 à fusionner à CI verte, #29/#30 reportés après le 30/11, PR sécurité ciblée
  (python-multipart, fastapi/starlette, python-dotenv, pypdf) assignée à ged-dev-backend.
- PR #34 (`docs/equipe-agents`) : + `.claude/**` ignoré dans `appfactory-impact.json` (motif `**/*.md` ne
  traverse pas les dossiers à point → repli `all`), DEC-2026-001, walkthrough Node 24 DONE. À fusionner à CI verte.
- Audit fonctionnel profond en cours (sous-agent) → `gestion-projet/walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md`.
- Règle apprise : aucune écriture git dans le checkout partagé, worktrees obligatoires (`../GED237-<sujet>`).
  À ajouter dans `EQUIPE_AGENTS.md` §4 et comme LESSON-2026-019.
- Point du jour : `gestion-projet/plans/point-2026-11-09.md`.
- 18:05 — Audit fonctionnel livré (`gestion-projet/walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md`,
  non commité) : 17-19 j-p d'écarts pour ~10 j de capacité ; top 1 = recherche sans autorisation par service.
  DEC-2026-002 (périmètre démo) demandée à l'innovateur. #28 fusionnée ; #32/#33/#34 en CI après rebranchage.

## 2026-11-09 17:55 — Orchestrateur : #34 fusionnée, DEC-2026-002 et parcours de démo reçus

- #34 fusionnée (a92e34d) : modèle d'équipe, base innovateur, agents, DEC-2026-001. Branche locale supprimée, checkout partagé sur `main`.
- #33 (spacy) rebranchée, CI en cours ; fusion au vert (accord PO du 17:30). #29/#30 reportées après le 30/11.
- DEC-2026-002 (PROPOSÉ, innovateur) soumise au PO : 6 écarts corrigés pour 9 j-p, 7 écarts annoncés, gel le 24/11.
  Questions PO ouvertes : (a) démo VPS ou on-site, (b) B6 avant le 17/11, (c) liste des écarts annoncés,
  (d) parcours P8 (corbeille/version sans UI) : recommandation = cycle de validation à la place, 0 j-p.
- `gestion-projet/innovateur/parcours-demo.md` : 8 parcours de démo retenus sur 12 ; P4 attend Lot C9, P5 attend l'ordre 1.
  Décisions orchestrateur : ordre d'exécution avec reset de base tenu par ci-qa ; doublon de routes `simulate` vérifié par dev-backend.
- Règle worktrees écrite (`EQUIPE_AGENTS.md` §4, LESSON-2026-019). Ces docs partent en PR `docs/point-2026-11-09` depuis `../GED237-docs`.
- Reprise : fusionner #33 au vert ; relancer le PO sur (a)-(d) ; dispatcher les ordres 1-2 de DEC-002 à dev-backend une fois acceptée.
