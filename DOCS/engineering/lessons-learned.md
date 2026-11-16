# Engineering Lessons Learned — GED237

Mémoire d'échecs RAIDER du projet (cf. [`RAIDER.md`](../../RAIDER.md)).

On n'y consigne pas chaque faute de frappe : seulement les échecs ou near misses qui
révèlent un angle mort, ont causé du retravail ou un risque réel, ou peuvent se reproduire.
**Avant un travail proche d'un incident connu, chercher ici d'abord.**

Les notes de conception (patterns, arbitrages) restent dans [`tasks/lessons.md`](../../tasks/lessons.md).

## Classification

`architecture` · `security` · `ci-cd` · `data` · `dependency` · `infrastructure` ·
`release-deployment` · `automation` · `ux` · `performance` · `testing` · `process`

## Modèle d'entrée

```markdown
### LESSON-AAAA-NNN — Titre court

- **Date :** AAAA-MM-JJ
- **Catégorie :** architecture | security | ci-cd | ...
- **Statut :** captured | prevention-added | generalized
- **Liens :** issue / PR / walkthrough / commit

**Contexte** — Que cherchait-on à faire ?
**Échec / near miss** — Que s'est-il passé ou a failli se passer ? Impact ?
**Cause racine** — Quelle hypothèse, lacune de conception ou de process l'a permis ?
**Résolution** — Qu'est-ce qui a corrigé le problème immédiat ?
**Prévention** — Quel test, garde, règle CI, checklist réduit la récidive ?
**Leçon généralisée** — Que doit-on retenir au-delà de cet incident ?
**Évolution de standard** — Règle projet, ADR ou sous-principe RAIDER à proposer ?
```

## Règles

- Cause racine, pas seulement le symptôme.
- Préférer une prévention vérifiable à un simple rappel.
- Ne jamais consigner de secret, jeton, ni donnée de production sensible.
- Même échec qui revient → renforcer la prévention, pas ajouter une entrée identique.
- Leçon valable au-delà de GED237 → la proposer au registry (`project-registry`).

## Leçons

### LESSON-2026-001 — Table absente masquée en erreur réseau côté client

- **Date :** 2026-10-27 (reprise de `CLAUDE.md` « Lessons récentes »)
- **Catégorie :** data
- **Statut :** prevention-added
- **Liens :** `CLAUDE.md` § Lessons récentes ; `backend/app/core/schema_check.py` ;
  `backend/tests/services/test_schema_check.py`

**Contexte** — Fonctionnalité livrée avec une nouvelle table (migration Alembic).
**Échec / near miss** — Base cible non migrée : `UndefinedTableError` → HTTP 500, affiché
côté client comme une erreur réseau ou générique, ce qui oriente mal le diagnostic.
**Cause racine** — Aucune vérification que le schéma de la base est à `head` au démarrage
ou en CI ; la migration dépend d'une action manuelle par environnement (`edossier`, `test_ged`).
**Résolution** — `alembic upgrade head` sur chaque base utilisée.
**Prévention** — Actuellement un rappel documentaire (insuffisant selon RAIDER). À ajouter :
contrôle « schéma à jour » (ex. `alembic check` / comparaison `current` vs `head`) en CI et
au démarrage de l'API, avec message d'erreur explicite.
*Ajouté le 2026-10-29* : au démarrage (`lifespan`), l'API compare `alembic_version` aux heads
des scripts et refuse de démarrer (`SchemaNotAtHeadError`, message avec la commande à lancer) ;
`SCHEMA_CHECK_MODE=fail|warn|off` (défaut `fail`). `alembic check` reste en CI (`backend.yml`) ;
le compose démarre `api`/`worker` seulement après le service `migrate`.
**Leçon généralisée** — Un écart de schéma doit échouer tôt et lisiblement, pas à la
première requête utilisateur.
**Évolution de standard** — Règle GED237 : toute PR avec migration coche « Idempotent »
(migration rejouable) et « Retroactive » (données existantes migrées).

### LESSON-2026-002 — Deux lignes de travail divergentes pendant deux mois

- **Date :** 2026-10-27
- **Catégorie :** process
- **Statut :** captured
- **Liens :** PR #1, `AUDIT.md` (2026-10-27)

**Contexte** — Correctifs CI/migrations poussés sur une branche (PR #1, 2026-09-01) pendant que des fonctionnalités s'accumulaient sans commit sur `main` d'un autre poste.
**Échec / near miss** — Aucune des deux lignes n'est intégrée ; `main` ne s'installe plus sur base vierge ; les deux chaînes de migrations partent de `f8e9d7c6b5a4` (deux têtes Alembic à la fusion) ; ~8 000 lignes exposées à une perte.
**Cause racine** — Pas de règle « commit + push quotidien sur branche » ni de limite de vie d'une PR ; le walkthrough ne vérifie pas l'état git.
**Résolution** — À faire : lot A de `AUDIT.md`.
**Prévention** — Ajouter au DoD : travail poussé sur une branche distante ; test CI « une seule tête Alembic » (`alembic heads` = 1 ligne).
**Leçon généralisée** — Un travail non poussé n'existe pas pour la CI ni pour les autres agents.

### LESSON-2026-003 — Churn de fins de ligne (CRLF/autocrlf) dans les diffs

- **Date :** 2026-10-28
- **Catégorie :** process
- **Statut :** prevention-added
- **Liens :** commit `chore: normalize line endings to LF…` (lot A), commits 65e6080 et 1d95776 (`chore/gitattributes`)

**Contexte** — Consolidation de deux mois de travail fait sous Windows.
**Échec / near miss** — Des fichiers entiers apparaissaient modifiés (CRLF ↔ LF), masquant les vrais changements et rendant la revue impossible.
**Cause racine** — `core.autocrlf` variable selon les postes, pas de normalisation imposée par le dépôt.
**Résolution** — Commit dédié de normalisation LF, isolé des commits fonctionnels.
**Prévention** — `.gitattributes` (`* text=auto eol=lf`, binaires déclarés) puis `git add --renormalize .` dans un commit isolé (77 fichiers), ignoré par `git blame`. Le dépôt stocke désormais LF quel que soit `core.autocrlf` ; `scripts/check-tracked-files.sh` refuse tout fichier vu comme binaire sans règle `binary`.
**Leçon généralisée** — Les conventions de fins de ligne appartiennent au dépôt, pas au poste.

### LESSON-2026-004 — Propriété Python non requêtable (`select(User.full_name)`)

- **Date :** 2026-10-28
- **Catégorie :** data
- **Statut :** prevention-added
- **Liens :** PR #1, commit 901d312

**Contexte** — Endpoint sélectionnant `User.full_name` en SQL.
**Échec / near miss** — `@property` Python : l'expression SQL plantait à l'exécution.
**Cause racine** — Tests avec utilisateurs mockés (`MagicMock`) qui n'exécutent jamais la requête réelle.
**Résolution** — `hybrid_property` avec expression SQL ; test sur base réelle.
**Prévention** — Test DB réel couvrant la requête.
**Leçon généralisée** — Un attribut utilisé dans `select()` doit être testé contre PostgreSQL, pas contre un mock.

### LESSON-2026-005 — Mock laissé sur une instance partagée

- **Date :** 2026-10-28
- **Catégorie :** testing
- **Statut :** prevention-added
- **Liens :** PR #1, commit 901d312

**Contexte** — Test du moteur de règles.
**Échec / near miss** — `engine._resolve_target = AsyncMock(...)` restait en place pour les assertions suivantes ; le test validait le mock, pas le code.
**Cause racine** — Patch manuel d'attribut d'instance sans restauration.
**Résolution** — `del engine._resolve_target` ; privilégier `monkeypatch.setattr` (restauré automatiquement).
**Prévention** — Revue : pas d'affectation directe de mock sur une instance hors `monkeypatch`.
**Leçon généralisée** — Tout patch doit avoir une portée bornée et un retour automatique à l'état initial.

### LESSON-2026-006 — Dérive index modèle ↔ migration et deux têtes Alembic

- **Date :** 2026-10-28
- **Catégorie :** data
- **Statut :** prevention-added
- **Liens :** commit `chore(db): merge runtime-hardening…` (révision `e1f2a3b4c5d6`)

**Contexte** — Rebase de la consolidation sur la PR #1.
**Échec / near miss** — Deux têtes Alembic ; `alembic check` signalait des index déclarés différemment dans les modèles `local_organize_event` / `user_local_arrangement_snapshot` et dans leurs migrations. `pytest` utilise `create_all` et ne voit pas cet écart.
**Cause racine** — Migrations écrites à la main sans `alembic check` ; tests qui ne passent pas par les migrations.
**Résolution** — Révision de fusion (pas de re-chaînage : sûr pour les bases déjà migrées sur l'une ou l'autre branche) ; index des modèles alignés.
**Prévention** — Vérifié : base vierge → `upgrade head`, rejeu no-op, `alembic check` propre, bases à chaque ancienne tête → `head`. À automatiser en CI (`alembic heads` = 1, `alembic check`).
**Leçon généralisée** — Les tests ORM ne prouvent pas les migrations ; les tester séparément.

### LESSON-2026-007 — `model_dump(mode="json")` sur des colonnes FK

- **Date :** 2026-10-28
- **Catégorie :** data
- **Statut :** prevention-added
- **Liens :** commit `fix(classification): keep FK columns typed…`

**Contexte** — Persistance des règles de classification multi-filtres (listes JSONB).
**Échec / near miss** — `mode="json"` transformait aussi les UUID des FK en chaînes : `domain_name` / `activity_name` cassés à la création.
**Cause racine** — Sérialisation globale appliquée pour le seul besoin des colonnes JSONB.
**Résolution** — Helper `_rule_column_values` : seules les listes JSONB sont converties.
**Prévention** — Test moteur sur `_evaluate_rule(...).matched` ; CRUD classification couvert.
**Leçon généralisée** — Sérialiser au plus près du besoin (colonne), pas tout le payload.

### LESSON-2026-008 — Hooks pre-commit jamais exécutés, seuil de couverture jamais évalué

- **Date :** 2026-10-28
- **Catégorie :** ci-cd
- **Statut :** prevention-added (2026-10-29, branche `chore/lint-blocking` : baseline 0, job CI ruff, bandit CI = hook)
- **Liens :** PR #1, lot A, `AUDIT.md` lot B item 8, LESSON-2026-010

**Contexte** — Premiers commits avec pre-commit réellement installé ; première CI verte depuis des mois.
**Échec / near miss** — ruff/bandit remontent une dette existante sur tout `app/` (commits faits avec `SKIP=ruff,ruff-format,bandit`) ; le gate `--cov-fail-under=70` n'avait jamais été atteint car la CI cassait avant (consolidation à 67,6 %, rattrapée par des tests API reports/usage).
**Cause racine** — Garde-fous déclarés mais jamais exercés ; une CI rouge masque tous les gates en aval.
**Résolution** — Tests ciblés pour repasser le seuil ; dette lint isolée au lot B.
**Prévention** — Lot B item 8 : baseline ruff/bandit puis hooks bloquants ; ne jamais laisser `main` rouge.
**Leçon généralisée** — Un garde-fou qui n'a jamais échoué ni réussi n'est pas un garde-fou.

### LESSON-2026-009 — Wheels CUDA de PyTorch en CI

- **Date :** 2026-10-28
- **Catégorie :** ci-cd
- **Statut :** prevention-added
- **Liens :** PR #1, commit 7d9574f

**Contexte** — Job backend installant `requirements.txt` (EasyOCR → torch).
**Échec / near miss** — pip tirait les wheels CUDA (triton ~253 Mo…) : disque runner saturé / téléchargements en échec.
**Cause racine** — Index PyPI par défaut ; versions torch non contraintes à la variante CPU.
**Résolution** — Installation préalable de torch CPU (`download.pytorch.org/whl/cpu`), versions lues dans `requirements.txt`.
**Prévention** — Étape CI dédiée ; même règle pour l'image Docker backend.
**Leçon généralisée** — Les dépendances lourdes à variantes matérielles doivent être épinglées sur la variante voulue.

### LESSON-2026-010 — Gates lint divergents entre hook et CI

- **Date :** 2026-10-29
- **Catégorie :** ci-cd
- **Statut :** prevention-added
- **Liens :** branche `chore/lint-blocking`, `AUDIT.md` lot B item 8, LESSON-2026-008

**Contexte** — Baseline ruff/bandit avant de rendre les hooks bloquants.
**Échec / near miss** — ruff tournait en pre-commit mais dans aucun workflow CI ; bandit bloquait dès LOW en local mais seulement sur HIGH en CI ; 5 `except: pass/continue` avalaient sans trace des échecs de nettoyage stockage et d'envoi OCR. Le correctif ruff E712 (`== True` → `is True`) aurait cassé les filtres SQLAlchemy s'il avait été appliqué en `--unsafe-fixes`.
**Cause racine** — Deux définitions du même gate (hook et workflow) maintenues à la main, versions d'outils non partagées.
**Résolution** — Job CI `Lint (ruff)` ; bandit CI sans seuil propre (lit `.bandit.yml` comme le hook) ; versions lues dans `requirements.txt` ; E712 corrigé à la main en `.is_(True/False)` ; échecs best-effort journalisés (`logger.warning`).
**Prévention** — Hook et CI lisent la même config (`backend/ruff.toml`, `backend/.bandit.yml`) et la même version épinglée ; pas de `--unsafe-fixes` sans relecture ; exception bandit uniquement via `# nosec BXXX - raison`.
**Leçon généralisée** — Un gate n'a qu'une source de vérité : le hook local et la CI doivent appeler la même config, sinon ils divergent en silence.

### LESSON-2026-011 — CVE publiée dans l'image de base entre deux builds

- **Date :** 2026-10-29
- **Catégorie :** security
- **Statut :** prevention-added
- **Liens :** PR #4, `frontend/Dockerfile`

**Contexte** — PR sans changement frontend ; le job Trivy reconstruit l'image `ged237-frontend:ci`.
**Échec / near miss** — CVE-2026-111497 (CRITICAL, `brotli-libs` 1.2.0-r1) dans `nginx:stable-alpine` : CI rouge sans lien avec le diff.
**Cause racine** — L'image runtime prenait les paquets OS figés au build de l'image amont ; le correctif Alpine (1.2.1-r0) existait déjà.
**Résolution** — `RUN apk upgrade --no-cache` dans l'étape `production`.
**Prévention** — Toute image runtime Alpine/Debian applique les correctifs OS au build ; Trivy reste bloquant sur CRITICAL.
**Leçon généralisée** — Un gate de vulnérabilités sur image peut virer au rouge sans changement de code : appliquer les mises à jour de sécurité au build plutôt qu'attendre l'image amont.

### LESSON-2026-012 — Workflow invalide en échec silencieux à chaque push

- **Date :** 2026-10-29
- **Catégorie :** ci
- **Statut :** prevention-added
- **Liens :** PR #5, `.github/workflows/release-integrity.yml`, `.github/workflows/ci.yml`, `.pre-commit-config.yaml`

**Contexte** — Workflow `release-integrity.yml` (SBOM + signature GPG), déclenché sur release ou à la main.
**Échec / near miss** — Une exécution « failure » sans aucun job à chaque push, sur toutes les branches, depuis le snapshot initial : bruit rouge que l'équipe avait appris à ignorer.
**Cause racine** — `secrets.*` utilisé dans un `if:` de step, contexte non autorisé : GitHub rejette le fichier entier, donc la signature de release n'aurait jamais tourné. Aucune validation des workflows avant fusion.
**Résolution** — Drapeau `HAS_GPG_KEY` calculé dans l'`env` du job, testé par `env.HAS_GPG_KEY` dans les steps ; avertissements shellcheck des workflows corrigés.
**Prévention** — actionlint bloquant : hook `actionlint-docker` dans pre-commit et job `Workflow lint (actionlint)` requis par le `CI Gate`, même version (1.7.7).
**Leçon généralisée** — Un échec rouge permanent masque les vrais échecs : un échec récurrent « connu » se corrige ou s'explique, il ne se tolère pas.

### LESSON-2026-013 — Fichier Markdown corrompu par des écritures PowerShell

- **Date :** 2026-10-29
- **Catégorie :** process
- **Statut :** prevention-added
- **Liens :** commit 2d88228, `scripts/check-tracked-files.sh`, `.github/workflows/ci.yml`

**Contexte** — Ajout du `.gitattributes` (LESSON-2026-003) : inventaire des fins de ligne de l'index.

**Échec / near miss** — `tasks/lessons.md` était vu comme binaire par git : diff illisible, et la renormalisation l'aurait ignoré. Trois dégâts superposés : en-tête relu en cp1252 puis réécrit en UTF-8 (« Ã© »), un bloc en UTF-16LE, et des leçons 16 à 33 où PowerShell avait mangé des lettres (`` `a `` → bell, `` `b `` → backspace, `` `n `` → saut de ligne), remplacé les accents par U+FFFD et « → » par « ? ».
**Cause racine** — Ajouts faits en ligne de commande PowerShell (`>>` / `Add-Content` en encodage par défaut, chaînes entre guillemets doubles où le backtick est un caractère d'échappement), sans aucun contrôle d'encodage avant commit.
**Résolution** — Script de réparation : annulation du double encodage, décodage du bloc UTF-16, restauration des accents et lettres d'après le contexte (assertions sur le nombre d'occurrences). Les backticks de code inline perdus ne sont pas réinventés.
**Prévention** — `scripts/check-tracked-files.sh`, hook pre-commit et job CI `Tracked files` requis par le `CI Gate` : échoue sur un fichier détecté binaire sans règle `binary`, sur tout caractère de contrôle hors tabulation/saut de ligne et sur U+FFFD. Testé sur l'ancien fichier et sur des échantillons ESC/U+FFFD/CRLF.
**Leçon généralisée** — Ne pas écrire de contenu Markdown/code via `echo`/`>>` PowerShell : passer par l'éditeur ou un outil qui écrit en UTF-8 explicite. Un texte que git voit comme binaire est un signal de corruption, pas un détail.

### LESSON-2026-014 — Même dossier suivi sous deux casses (`DOCS/` et `docs/`)

- **Date :** 2026-10-29
- **Catégorie :** process
- **Statut :** prevention-added
- **Liens :** commit eafff21, `scripts/check-tracked-files.sh`

**Contexte** — `git add --renormalize .` sous Windows.
**Échec / near miss** — La commande a indexé en doublon les 5 fichiers de `docs/engineering/` sous `DOCS/engineering/` (retirés avant commit). Le dépôt suivait déjà les deux casses : un seul dossier sous Windows/macOS, deux sous Linux, donc les liens relatifs entre `README.md` et `lessons-learned.md` étaient cassés en CI et sur GitHub.
**Cause racine** — Système de fichiers insensible à la casse : un fichier créé sous `docs/` alors que `DOCS/` existait n'a rien signalé localement.
**Résolution** — Renommage d'index seul (`update-index`) de `docs/engineering/*` vers `DOCS/engineering/*`, chemin utilisé par toutes les références.
**Prévention** — `scripts/check-tracked-files.sh` (pre-commit + CI) refuse les chemins qui ne diffèrent que par la casse, dossiers compris.
**Leçon généralisée** — Sous Windows, relire `git status` après toute commande d'indexation globale (`add .`, `--renormalize`) : des ajouts inattendus signalent souvent une collision de casse.

### LESSON-2026-015 — Configuration de couverture jamais lue

- **Date :** 2026-10-29
- **Catégorie :** testing
- **Statut :** prevention-added
- **Liens :** `backend/.coveragerc`, `backend/tests/test_coverage_config.py`

**Contexte** — Lot B6 (tests API users, org_units, reports, usage) : `users.py` restait à 40 % de couverture alors que presque toutes ses routes étaient testées.
**Échec / near miss** — Les sections `[coverage:run]` et `[coverage:report]` de `backend/pytest.ini` n'ont jamais été appliquées : `app/workers/*` et `app/core/ocr/*` étaient mesurés malgré `omit`, et `skip_covered` n'agissait pas. Le gate de 70 % tenait grâce au seul `--cov-fail-under` de la ligne de commande. En plus, sans `concurrency = greenlet`, les lignes exécutées après une requête SQLAlchemy async n'étaient pas comptées.
**Cause racine** — coverage.py lit `.coveragerc`, `setup.cfg`, `tox.ini` et `pyproject.toml`, jamais `pytest.ini`, et ne signale pas une section qu'il ne lit pas.
**Résolution** — Réglages déplacés dans `backend/.coveragerc` (source unique), avec `concurrency = greenlet, thread`.
**Prévention** — `tests/test_coverage_config.py` charge la configuration comme le fait coverage.py et échoue si `concurrency`, `omit` ou `fail_under` ne sont plus lus.
**Leçon généralisée** — Un réglage d'outil qui ne produit aucun effet visible doit être prouvé chargé, par un test ou une sortie qui en dépend.

### LESSON-2026-016 — CI dupliquée et non ciblée

- **Date :** 2026-10-29
- **Catégorie :** ci-cd
- **Statut :** prevention-added
- **Liens :** `.github/appfactory-impact.json`, `scripts/check-impact-gates.py`, walkthrough `[Claude] Impact-Aware CI - 2026-10-29`

**Contexte** — Adoption de l'Impact-Aware CI (écart RAIDER « Scoped execution »).
**Échec / near miss** — `quality-gate.yml` relançait backend, frontend et sécurité sur les mêmes événements que `ci.yml` dès qu'un fichier `backend/`, `frontend/` ou `.github/workflows/` changeait : 32 runs Quality Gate pour 34 runs CI sur 30 jours, suite backend (≈ 13 min) et Trivy compris. Une PR de doc seule lançait toute la CI. Le 2026-10-29, `main` est rouge : jobs non démarrés pour un motif de facturation (paiement ou plafond de dépenses). Le lien avec cette consommation est probable, non vérifié (facturation illisible avec le jeton `gh` actuel).
**Cause racine** — Pipeline unifié T6.4 (`quality-gate.yml`) laissé à côté de `ci.yml`, qui appelle les mêmes workflows ; aucune règle ne reliait fichiers modifiés et jobs requis.
**Résolution** — `quality-gate.yml` supprimé ; `ci.yml` appelle `reusable-impact-analysis.yml` (appfactory v1.4.0) et garde chaque job lourd par son gate.
**Prévention** — `.github/appfactory-impact.json` est la seule source des chemins ; `scripts/check-impact-gates.py` (hook pre-commit + job `Workflow lint`) refuse un gate utilisé mais jamais émis (job sauté à vie, `CI Gate` vert) ou déclaré mais jamais utilisé ; le `CI Gate` échoue si l'analyse d'impact échoue. Carte validée en passant les 534 fichiers suivis dans le moteur : aucun non couvert.
**Leçon généralisée** — Un pipeline qui en remplace un autre n'est pas terminé tant que l'ancien tourne : vérifier qu'aucun workflow ne relance les mêmes jobs sur les mêmes événements. Dans une carte de globs, `dir/**` ne couvre pas les dotfiles (`dir/.coveragerc`) : les déclarer (`dir/**/.*`).

### LESSON-2026-017 — Protection de branche documentée, jamais appliquée

- **Date :** 2026-10-30
- **Catégorie :** governance
- **Statut :** prevention-added
- **Liens :** `.github/project-config.json`, `CONTRIBUTING.md`, ruleset « AppFactory default branch governance »

**Contexte** — Passage du dépôt en public (Actions refusées en privé faute de facturation) ; vérification de la protection de `main` avant d'y exiger le `CI Gate`.
**Échec / near miss** — `CONTRIBUTING.md` annonçait « push direct interdit, PR obligatoire, 1 review, CI verte » et renvoyait à `scripts/setup-branch-protection.sh`. Le script n'existait pas et `main` n'avait aucune protection (API : 403 en privé gratuit, puis 404 « Branch not protected »). Toute fusion reposait sur la discipline ; 1 review obligatoire aurait en plus bloqué le seul mainteneur.
**Cause racine** — Règle rédigée comme un état acquis sans être appliquée ni vérifiée ; aucune source déclarative de la politique.
**Résolution** — Ruleset géré par la Repository Governance d'appfactory v1.4.0 (preset `solo` + `CI Gate` requis), appliqué en `plan → apply → plan` (dernier `plan` : NO-OP). `CONTRIBUTING.md` décrit la politique réelle.
**Prévention** — Politique versionnée dans `.github/project-config.json` ; un `plan` de gouvernance qui n'est plus NO-OP signale une dérive.
**Leçon généralisée** — Une règle de gouvernance documentée n'existe que si son état distant a été lu : vérifier par l'API avant de la citer, et la déclarer dans un fichier réconcilié plutôt que dans de la prose.

### LESSON-2026-018 — Dette de lint rétrogradée en avertissements, sans plafond

- **Date :** 2026-10-30
- **Catégorie :** quality-gate
- **Statut :** prevention-added
- **Liens :** `frontend/.eslintrc.json`, `frontend/package.json` (`lint`), `CONTRIBUTING.md`, walkthrough `[Claude] Lot B8 - Lint bloquant - 2026-10-29`

**Contexte** — Bilan du Lot B : l'item 8 d'`AUDIT.md` demandait de corriger les 200 erreurs ESLint du frontend puis de rendre le lint bloquant.
**Échec / near miss** — Le lint frontend était vert et réputé bloquant, mais les 200 erreurs n'avaient jamais été corrigées : 18 règles avaient été passées en `warn` (1f1f794). Sans plafond, toute nouvelle occurrence de ces règles passait la CI ; la dette était montée à 605 avertissements.
**Cause racine** — Baseline obtenue en baissant la sévérité des règles, sans borne sur le volume ; « lint vert » a été lu comme « lint corrigé ».
**Résolution** — `eslint --fix` (605 → 488), 7 règles à zéro rendues à `error`, plafond `--max-warnings 488` dans le script `lint`.
**Prévention** — `npm run lint` échoue au-delà du plafond, en local comme en CI ; `CONTRIBUTING.md` impose de baisser le plafond après chaque nettoyage et interdit de le relever.
**Leçon généralisée** — Rétrograder des erreurs en avertissements ne vaut baseline que si le volume est plafonné : toute dette tolérée par un gate doit avoir un cliquet chiffré qui ne peut que baisser.

### LESSON-2026-019 — Checkout git partagé entre sessions d'agents

- **Date :** 2026-11-09
- **Catégorie :** process / multi-agent
- **Statut :** prevention-added
- **Liens :** `gestion-projet/EQUIPE_AGENTS.md` §4, `PASSATION.md` (entrée du 2026-11-09 17:45)

**Contexte** — Passage à quatre sessions Claude Code simultanées sur le même dépôt (orchestrateur, innovateur, dev-backend, dev-frontend) plus une session CI/QA.
**Échec / near miss** — Une session a exécuté `git switch` dans le checkout partagé `GED237/` pour démarrer sa tâche ; toutes les autres sessions se sont retrouvées sur sa branche, avec des fichiers non commités d'autres rôles dans l'index. Aucune perte, mais travail interrompu le temps de comprendre.
**Cause racine** — Un seul répertoire de travail pour N agents : l'état `HEAD` est global, alors que chaque session suppose le sien.
**Résolution** — Les sessions de développement travaillent chacune dans un worktree `../GED237-<sujet>` ; le checkout partagé reste sur `main` en lecture seule.
**Prévention** — Règle écrite dans `EQUIPE_AGENTS.md` §4 et dans les fiches de rôle ; routine de démarrage : `git worktree list` avant toute commande git d'écriture.
**Leçon généralisée** — Tout état global partagé (branche courante, index, fichiers non commités) doit être isolé par agent avant de paralléliser ; sinon la coordination coûte plus que le parallélisme ne rapporte.
---

### LESSON-2026-020 — Conteneurs compose orphelins après l'arrêt d'une tâche de fond

- **Date :** 2026-11-09
- **Catégorie :** process / multi-agent
- **Statut :** prevention-added
- **Liens :** `docker-compose.e2e.yml`, `.github/workflows/ci.yml` (job `e2e`), LESSON-2026-019

**Contexte** — Plusieurs sessions partagent une VM Docker de 4 Go ; les runs lourds (pytest, smoke e2e, recette UAT) sont sérialisés entre elles.
**Échec / near miss** — Deux sessions ont laissé tourner des piles compose qu'elles croyaient arrêtées : arrêter la tâche de fond tue le client `docker compose up`, pas les conteneurs. Une pile UAT a démarré pendant le créneau d'une autre session, et des conteneurs postgres/redis e2e sont restés actifs après un build interrompu. Aucune perte, mais RAM consommée et ordre de passage brouillé.
**Cause racine** — Le cycle de vie des conteneurs est porté par le démon Docker, pas par le processus qui les a lancés ; arrêter le client ne démonte rien.
**Résolution** — `docker compose -f <fichier> down -v --remove-orphans` sur chaque pile concernée, puis vérification par `docker ps`.
**Prévention** — Toute interruption d'un `compose up` lancé en arrière-plan est suivie de `down -v --remove-orphans` ; en CI, le job e2e démonte en `if: always()`. Avant un run lourd, `docker ps` confirme que la VM est libre ; le signal de fin n'est envoyé à la session suivante qu'après le `down`.
**Leçon généralisée** — Arrêter un processus client ne libère pas les ressources qu'il a fait créer côté serveur : chaque lancement en arrière-plan doit avoir un démontage explicite et vérifié.

---

### LESSON-2026-022 — Tests de recherche sans aucun résultat : vert trompeur

- **Date :** 2026-11-09
- **Catégorie :** tests / qualité
- **Statut :** prevention-added
- **Liens :** `backend/app/core/search/postgres_engine.py`, `backend/tests/api/test_search_scope.py`, walkthrough `[Claude] Recherche bornee tenant service corbeille - 2026-11-09.md`

**Contexte** — Mise en place du périmètre de visibilité sur `GET /api/v1/search/` (DEC-2026-002, ordre 2).
**Échec / near miss** — Le premier test qui obtenait un résultat réel a fait échouer la recherche en 500 : la construction d'un résultat lisait `Document.category`, attribut inexistant (la catégorie est une relation `document_category`). Les deux tests historiques de `test_search.py` étaient verts depuis des mois parce qu'ils interrogeaient une base sans aucun document correspondant : ils ne validaient que la forme d'une réponse vide. En production, toute recherche fructueuse aurait échoué.
**Cause racine** — Des tests qui n'exercent que le chemin « zéro résultat » couvrent le code de requête mais jamais le code de sérialisation des résultats ; la couverture ligne ne le signale pas si la boucle n'est simplement pas entrée.
**Résolution** — Code catégorie sélectionné par jointure et filtre `category` corrigé ; `test_search_scope.py` crée des documents qui correspondent et vérifie leurs identifiants, le code catégorie et le total.
**Prévention** — Pour chaque moteur de recherche ou liste filtrée : au moins un test avec des données qui **doivent** remonter et une assertion sur leur contenu, pas seulement sur le code HTTP ou la forme de la réponse. À reprendre dans la revue : « quel test échouerait si la sérialisation d'un résultat était cassée ? »
**Leçon généralisée** — Un test vert sur un ensemble vide ne prouve rien sur le traitement des éléments ; le cas nominal doit produire des données.

### LESSON-2026-023 — Un rôle, trois orthographes : les règles RBAC ne matchaient personne

- **Date :** 2026-11-09
- **Catégorie :** authz / données de référence
- **Statut :** prevention-added
- **Liens :** smoke e2e PR #39 (SMK-04, SMK-05, SMK-10), PR `fix/authz-collaborator`, walkthrough `[Claude] Authz collaborateur, tenant propre, catégories - 2026-11-09.md`

**Contexte** — Le smoke e2e joue les parcours de chaque profil contre la pile Docker. Le collaborateur obtenait 403 à l'upload ; le lecteur voyait « Impossible de charger les données ».
**Échec / near miss** — `policy.csv` déclarait le collaborateur sous le code `standard`, le seed créait `collaborator`, la migration initiale insérait `COLLABORATOR`. Aucune règle Casbin ne matchait le rôle réel : la suite pytest restait verte parce qu'elle utilisait elle aussi `standard`. Les rôles de lecture n'avaient pas `categories read`, pourtant indispensable à l'écran documents.
**Cause racine** — Les codes de rôle vivent dans trois sources (seed, migration, politique) sans test qui les confronte ; les tests d'autorisation testaient la politique contre elle-même, pas contre les données réellement semées.
**Résolution** — Renommage `standard` → `collaborator` dans la politique et les tests ; `categories read` pour les rôles de lecture ; lecture de son propre tenant sans règle Casbin (l'action `tenants read` couvre la liste).
**Prévention** — `test_authz_smoke_fixes.py` : l'ensemble des sujets `p,` de `policy.csv` doit être exactement l'ensemble des codes semés (toute dérive dans un sens ou l'autre échoue) ; tests API par rôle réel (collaborateur 201 à l'upload, lecteur 200 catégories / 403 création / 200 tenant propre / 403 liste).
**Leçon généralisée** — Une donnée de référence dupliquée (codes, enums, identifiants) exige un test de cohérence croisée entre ses sources ; un test qui n'utilise que les valeurs d'une seule source ne prouve rien sur les autres.

### LESSON-2026-021 — Rôles semés en majuscules par la migration, en minuscules partout ailleurs

- **Date :** 2026-11-11
- **Catégorie :** données / migrations / autorisation
- **Statut :** prevention-added
- **Liens :** `backend/alembic/versions/001_initial_schema.py`, `backend/alembic/versions/f0a1b2c3d4e5_lowercase_role_codes.py`, `backend/app/core/authz/roles.py`, LESSON-2026-023 (même famille : `standard` / `collaborator`)

**Contexte** — La migration initiale insérait les rôles en majuscules (`COLLABORATOR`), alors que la politique Casbin, `seed_db.py`, les tests et le code applicatif (`role != "super_admin"`) comparent des codes en minuscules. `init_db.py` cherchait les rôles en majuscules. Une base jouée par `alembic upgrade head` puis peuplée par l'API ou `init_db.py` rattachait ses utilisateurs à des rôles qu'aucune ligne de politique ne connaissait.
**Échec / near miss** — Comptes de démonstration sans aucun droit effectif (403 systématiques) selon la façon dont la base avait été initialisée ; la cause n'apparaissait ni dans les tests (le `conftest` sème ses propres rôles en minuscules) ni dans les logs (un 403 Casbin est un comportement normal).
**Cause racine** — Trois sources indépendantes pour une même donnée de référence (migration, seed, politique), sans constante partagée ni contrainte en base ; aucun test ne confrontait la politique aux codes réellement semés.
**Résolution** — Migration `f0a1b2c3d4e5` idempotente : repointe `users.role_id` et `workflow_template_steps.role_id` vers le jumeau minuscule quand il existe, supprime le doublon, renomme le reste en minuscules, puis pose `CHECK (code = lower(code))`. La migration 001 insère désormais en minuscules (une base vierge n'a rien à réconcilier). `init_db.py` lit les codes en minuscules. `app/core/authz/roles.py` devient la source unique ; `seed_db.py` s'y compare.
**Prévention** — Contrainte CHECK en base (toute insertion en majuscules échoue) ; test `test_every_seeded_role_has_policy_lines_and_no_orphan_role` à brancher sur `ROLE_CODES` ; essai Docker de la migration sur base vierge et sur base portant des doublons avant fusion.
**Second near miss (2026-11-09, détecté par l'exercice de sauvegarde)** — `seed_db.py` ajoutait quatre types d'unité en minuscules (`ministry`, `direction`…) à côté des sept codes en majuscules insérés par la migration 001 : doublons de sens, et `UniqueViolation` dès que le seed tournait sur une base migrée. Même cause racine que les rôles, autre table. Généralisation : un seed convergent **réconcilie par code** toutes les données de référence que les migrations ont déjà insérées (`upsert_by_code`, codes alignés sur la migration) au lieu d'en ajouter. Preuve standard : base vierge → `alembic upgrade head` → seed → comptages par table (`roles`, `org_unit_types`, `tenants`, `org_units`, `users`, `documents`) → second seed = `[SKIP]`, mêmes comptages, ids identiques (walkthrough « Codes de rôle en minuscules », complément 2). Prévention vérifiable : `tests/test_seed_db.py` (codes du seed ⊆ codes de la migration 001 ; deux passes d'`upsert_by_code` = mêmes ids, même nombre de lignes).
**Leçon généralisée** — Une donnée de référence écrite à plusieurs endroits finit par diverger : une seule source, une contrainte qui refuse la divergence, et un test qui confronte les consommateurs à cette source. Un seed ne crée pas les données de référence, il les réconcilie avec celles des migrations.
---

### LESSON-2026-025 — Attente `networkidle` sans fin et budget des parcours multi-connexions

- **Date :** 2026-11-09
- **Catégorie :** tests / e2e
- **Statut :** prevention-added
- **Liens :** `frontend/e2e/specs/full-cycle.spec.ts`, en-tête de `frontend/playwright.config.ts`, LESSON-2026-020

**Contexte** — Levée des fixme du smoke e2e (SMK-04 à 08, SC-E2E-01) sur la pile `docker-compose.e2e.yml`, une fois les correctifs #45 et #47 disponibles.
**Échec / near miss** — `full-cycle` échouait 2 fois sur 3 sans retry, alors que les correctifs métier étaient en place. Deux causes cumulées : le budget par défaut de 30 s ne couvre pas trois connexions, un upload et une soumission ; `waitForLoadState('networkidle')` sur la page des tâches n'aboutissait jamais, même avec un budget de 90 s. Sur une VM saturée par une suite backend concurrente, l'échec a d'abord été pris pour un problème d'environnement.
**Cause racine** — `networkidle` exige 500 ms sans aucune requête : la page n'atteint jamais cet état dans la pile e2e. Cause exacte **non prouvée** : le WebSocket de notifications (`hooks/useNotifications.ts`) est le suspect principal ; le health check de la barre latérale (toutes les 30 s) ne suffit pas à l'expliquer. Le budget de test, lui, est mesuré : le parcours prenait 40 s.
**Résolution** — `networkidle` retiré (l'assertion de visibilité suivante attend la page) et `test.slow()` sur le parcours : 9/9 en `--repeat-each=3 --retries=0`, `full-cycle` en 11 à 14 s.
**Prévention** — Règle en en-tête de `playwright.config.ts` : aucun nouveau `networkidle` (les 20 existants dans 11 specs sont remplacés quand on les touche ; `security-isolation` en garde un qui aboutit), `test.slow()` pour tout parcours multi-connexions, contenu unique par upload. Les fixme sont levés sur preuve `--retries=0` répétée, pas sur un vert obtenu au retry.
**Leçon généralisée** — Un vert obtenu au retry cache un défaut ; prouver la stabilité sans retry et sur une machine calme avant d'attribuer un échec à l'environnement. Attendre un état observable par l'utilisateur, jamais un état global du réseau.

---


## LESSON-2026-024 — CI rouge sans aucun job : vérifier l'état du fournisseur CI avant de toucher aux pipelines

- **Mécanisme** : un échec simultané sur plusieurs branches sans lien, dont une sans aucune surface CI, pointe vers la plateforme, pas vers le code ni les workflows.
- **Contexte** (2026-11-09, heures UTC ; locale = UTC+1) : vers 18:08 les runs des PR #42 (code) et #43 (documentation seule) échouent avec « This run likely failed because of a workflow file issue », aucun job lancé ; `main` passait trois minutes plus tôt et #43 ne touche aucun fichier `.github/`.
- **Cause racine** : panne partielle du fournisseur CI. GitHub incident `tp8cghg7tlc4` « Incident with Actions and Checks API » (https://stspg.io/7yw63xl9ztrv), ouvert 18:12, résolu 18:59 ; composant « Actions » revenu `operational` à 18:47 (`https://www.githubstatus.com/api/v2/components.json`). Aucun défaut dans le dépôt ; le workflow réutilisable épinglé par SHA était joignable (hypothèse écartée, voir arbre).
- **Classification** : cause externe ; near miss confirmé : aucun fichier `.github/` modifié pendant le diagnostic. Dommage réel : ≈ 22 min de diagnostic, fusions #42/#43/#44 décalées d'environ 1 h 30.
- **Résolution** : attente du retour `operational`, puis relance des runs (`gh run rerun`) ; aucune autre action.
- **Arbre de diagnostic « CI rouge sans job »** (dans l'ordre, s'arrêter au premier verdict) :
  1. État du fournisseur : page de statut (GitHub : `components.json`, composant « Actions ») ; `partial_outage`/`major_outage` → attendre, ne rien toucher.
  2. PR témoin sans surface CI (docs-only) rouge en même temps → plateforme.
  3. Annotations du run : `gh api repos/<owner>/<repo>/check-runs/<id>/annotations` ; une erreur de syntaxe ou de référence nommée → défaut interne, corriger.
  4. Workflow réutilisable épinglé joignable : `gh api repos/EagleFox31/appfactory-project-automation/commits/<sha>` (404 = SHA réécrit, dépôt privé ou jeton insuffisant → défaut interne).
  5. Seulement ensuite : modifier un workflow, avec l'annotation citée dans la PR.
- **Prévention vérifiable** : (a) `DOCS/engineering/runbook-ci-rouge.md` porte cet arbre en étape 0 (rédaction innovateur, PR docs suivante) ; (b) règle de revue : aucune modification de `.github/` sans annotation d'erreur citée dans la PR (contrôlable à la relecture) ; (c) optionnel après le 14/11 : `scripts/ci-status.sh` (statut fournisseur + trois derniers runs de `main`), propriétaire ci-qa.
- **Leçon généralisée** : avant de corriger un pipeline qui n'a pas changé, prouver que l'infrastructure qui l'exécute est saine ; la page de statut du fournisseur et une PR témoin sans surface CI sont les deux discriminants, quel que soit le fournisseur.

### LESSON-2026-026 — Validation d'import bloquée sans fin quand le stockage des résultats Celery est injoignable

- **Date :** 2026-11-10
- **Catégorie :** backend / exploitation
- **Statut :** mitigated
- **Liens :** `backend/app/api/v1/endpoints/imports.py` (envoi OCR après commit), `backend/app/workers/celery_app.py`, `backend/scripts/seed_demo.py`

**Contexte** — Preuve du profil `demo` (jeu de données D1) dans le runner de tests, qui ne fournit que `REDIS_URL`.
**Échec / near miss** — Le premier `POST /imports/{id}/commit` n'a jamais répondu : 13 minutes bloqué, sans erreur ni log. `CELERY_BROKER_URL` pointait bien vers Redis ; `CELERY_RESULT_BACKEND` gardait sa valeur par défaut `localhost`.
**Cause racine** — `process_document_ocr.delay()` s'abonne au stockage des résultats avant l'envoi ; `retry_over_time` de kombu réessaie la connexion sans borne. Le `try/except` autour de l'envoi ne sert à rien : aucune exception ne remonte. Les documents sont déjà validés en base, mais la requête HTTP reste suspendue.
**Résolution** — Les deux variables Celery sont posées dans toute exécution hors pile complète (runner, scripts) ; la pile e2e les définit déjà (`docker-compose.e2e.yml`). Diagnostic obtenu par `python -X faulthandler` et `timeout -s ABRT`.
**Prévention** — Section « Jeu de démonstration » de `DOCS/exploitation/donnees-demo.md` ; trace à transmettre au backend pour borner l'envoi (`broker_connection_retry`, `result_backend_transport_options`, ou `ignore_result=True` sur la tâche OCR) dans un ticket séparé, hors gel.
**Leçon généralisée** — Un `try/except` autour d'un appel réseau ne protège pas d'une boucle de reconnexion interne : toute dépendance réseau optionnelle doit avoir un délai borné. Face à un processus muet, prendre une pile (faulthandler) avant de supposer la cause.

---

### LESSON-2026-027 — Import de règles non idempotent : le code normalisé crée un jumeau de la règle d'origine

- **Date :** 2026-11-10
- **Catégorie :** data / backend
- **Statut :** prevention-added
- **Liens :** PR #79 (`feat/rules-export-import`, correctif 1061880), spec e2e SC-V11-02 (#91), `backend/app/services/classification_rule_engine.py`

**Contexte** — Lot 2 V1.1 : export des règles de classement en JSON portable et réimport (`dry_run`, `mode`). Rejeu par la recette (Q) : export des règles du seed, réimport sans modification, nouvel export.
**Échec / near miss** — Le réimport normalisait le code de chaque règle (`E2E-RULE-DEMO` → `e2e_rule_demo`) puis cherchait ce code normalisé en base, où la règle du seed gardait son code brut. Aucune correspondance : une règle jumelle était créée. Le second export était alors rejeté (deux codes identiques une fois normalisés). Un rejeu « sans changement » écrivait en base et rendait la fonction inutilisable : bloquant pour la démo.
**Cause racine** — La normalisation n'était appliquée qu'à un seul côté du rapprochement. Le seul test d'idempotence exerçait des règles déjà créées par l'import lui-même (donc déjà normalisées) : les données héritées, écrites avant la fonction, n'étaient pas représentées.
**Résolution** — Rapprochement sur le code normalisé des deux côtés ; la règle rapprochée garde son code d'origine ; deux codes existants identiques après normalisation font refuser l'import avec un message explicite. 3 tests ajoutés, dont « import des règles héritées = zéro écriture ».
**Prévention** — Pour toute fonction d'import ou de synchronisation : un test avec des données **préexistantes au format hérité** (seed réel) et l'assertion « second passage = 0 création, 0 mise à jour ». Le `dry_run` doit afficher ce zéro avant tout import en démo (checklist H-30, lot 2).
**Leçon généralisée** — L'idempotence (RAIDER I) se prouve sur l'état existant, pas seulement sur ce que la fonction a elle-même produit ; toute normalisation de clé s'applique aux deux membres de la comparaison, et les données rétroactives (RAIDER R) sont le premier jeu de test.

### LESSON-2026-028 — Lot 4 : trois écarts de conception trouvés en relecture, aucun par les tests

- **Date :** 2026-11-10
- **Catégorie :** architecture / testing
- **Statut :** prevention-added
- **Liens :** PR #92 (`feat/rule-content-date`, correctif 2ef66d2), `backend/app/workers/`, `backend/app/services/ingestion.py`, fiche `gestion-projet/innovateur/specs-v11-avant-gel/lot-4.md`

**Contexte** — Lot 4 V1.1 : critères de règle sur le texte OCR et l'année du document ; reclassement par le worker après l'OCR. 7 tests verts à l'ouverture de la PR.
**Échec / near miss** — La relecture a relevé trois écarts que les tests ne voyaient pas : (1) le reclassement s'exécutait dans la même transaction que l'enregistrement de l'OCR, donc un échec du moteur de règles perdait le texte extrait ; (2) l'ingestion de dossier ne stockait pas les entrées de classement, les règles contenu/année ne pouvaient jamais s'y appliquer ; (3) un document sans date retombait sur l'année courante et pouvait matcher une règle d'année par défaut. Sans relecture, les trois seraient partis en recette avec des tests verts.
**Cause racine** — Les tests exerçaient le moteur en isolation (texte et année fournis) ; aucun ne traversait les frontières : échec du reclassement après OCR, chemin d'ingestion, document sans date. La fiche de lot décrivait les critères, pas les cas limites de ces frontières.
**Résolution** — OCR commité avant le reclassement (transaction séparée, échec journalisé) ; l'ingestion stocke `classification_inputs` ; bornes d'année sans repli ; 4 tests ajoutés sur ces trois cas.
**Prévention** — Toute fiche de lot comporte une ligne « cas limites aux frontières » (échec de l'étape suivante, entrée absente, second chemin d'entrée) que la PR doit couvrir par un test nommé ; la relecture § 0 vérifie cette ligne avant le code. Règle de revue : « que se passe-t-il quand la donnée d'entrée manque ? » pour chaque critère nouveau.
**Leçon généralisée** — Un critère ajouté à un moteur s'évalue sur tous ses chemins d'alimentation et sur l'absence de donnée ; un repli silencieux sur une valeur « raisonnable » (année courante) est une décision métier, jamais un défaut de code.

### LESSON-2026-029 — PR empilée fermée par GitHub quand sa branche de base est supprimée à la fusion

- **Date :** 2026-11-10
- **Catégorie :** process / ci-cd
- **Statut :** prevention-added
- **Liens :** PR #95 (base `feat/rule-content-date` = branche de #92), fiche D5 `gestion-projet/innovateur/decisions-po-2026-11-13.md`

**Contexte** — File de fusion en série (ruleset `main` : branche à jour obligatoire). Pour avancer sans attendre, F a ouvert #95 (UI lot 4) avec pour base la branche de #92 (API lot 4) plutôt que `main`. En parallèle, la décision D5 propose la suppression automatique des branches à la fusion.
**Échec / near miss** — Quand la branche de base d'une PR est supprimée, GitHub ferme la PR empilée : ses commits restent mais elle disparaît de la file, sans alerte dans la chaîne. Avec la suppression automatique activée, la fusion de #92 aurait fermé #95 ; le même schéma vaut pour toute PR « empilée » (UI lot 5 sur API lot 5, e2e sur la PR qu'il teste). Repéré avant la fusion de #92.
**Cause racine** — Le découplage « code prêt avant sa dépendance » a été réglé par la base Git de la PR, alors que la file de fusion est gérée hors GitHub (chaînes de l'orchestrateur) ; personne ne portait la règle « rebasculer la base sur `main` avant de fusionner la dépendance ».
**Résolution** — Avant la fusion de la dépendance, l'orchestrateur rebascule : `gh pr edit <n> --base main` (GitHub recalcule le diff ; les commits de la base fusionnée disparaissent du delta). Pas de changement de base par l'auteur pendant que la PR est en file.
**Prévention** — Contrôle de chaîne avant toute fusion : la liste des PR ouvertes dont `baseRefName` n'est pas `main` (`gh pr list --json number,baseRefName`) doit être vide ou chaque ligne traitée par `--base main`. Si D5 active `delete_branch_on_merge`, ce contrôle devient obligatoire et figure dans la procédure de fusion.
**Leçon généralisée** — Une PR empilée est une dépendance implicite portée par l'outil, pas par le plan ; toute automatisation qui supprime une ressource (branche) doit être précédée de l'inventaire de ce qui la référence encore.

### LESSON-2026-030 — Dossier surveillé pouvant englober le dossier de l'import en direct

- **Date :** 2026-11-10
- **Catégorie :** infrastructure / data
- **Statut :** prevention-added
- **Liens :** PR #101 (`feat/ingest-watch`, lot 5), `backend/app/services/ingest_watch.py`, `docker-compose.yml` (worker `-B`, montage `/data/ingest` en lecture-écriture), `gestion-projet/innovateur/checklist-demo.md` H-30

**Contexte** — Lot 5 V1.1 : le worker importe périodiquement les fichiers déposés dans les dossiers de `INGEST_WATCH_FOLDERS` et **déplace** chaque fichier traité dans `_traites/<date>/` ou `_erreurs/`. Pour cela le worker monte `/data/ingest` en lecture-écriture, alors que l'API le lisait en lecture seule pour l'import en direct de la démo (`/data/ingest/live`, parcours P2).
**Échec / near miss** — Une configuration `INGEST_WATCH_FOLDERS` pointant sur `/data/ingest` (ou `/data/ingest/live`, récursif) aurait fait vider par le worker, dès le premier passage, le dossier que l'animateur montre en séance : fichiers déplacés dans `_traites/`, parcours P2 impossible devant le jury. Deux services portant `-B` auraient aussi doublé les passages (le verrou Redis n'empêche que la simultanéité). Repéré en relecture, avant toute pile démo.
**Cause racine** — Le même volume sert deux usages aux droits différents (lecture seule pour l'import à la main, lecture-écriture pour l'import automatique) et rien n'interdit au second d'englober le premier : la séparation est portée par la configuration, pas par le code.
**Résolution** — Garde-fou dans #101 : surveillance **désactivée par défaut** (`INGEST_WATCH_FOLDERS=[]`), l'API garde son montage `:ro`. Checklist H-30 : un seul service porte `-B`, le worker monte `/data/ingest` en lecture-écriture, `printenv INGEST_WATCH_FOLDERS` dans le worker ne contient pas `/data/ingest/live`. Passage réel (dépôt, déplacement, libération du verrou dans les logs) au plan de recette du 20.
**Prévention** — Garde-fou de code dans #101 (demandé par l'orchestrateur, *à confirmer à la fusion de #101*) : un dossier surveillé égal au dossier d'import en direct, le contenant ou contenu dans celui-ci (chemin lu depuis la configuration) est **ignoré** avec un avertissement dans les logs, couvert par un test ; en second rideau, le contrôle H-30 ci-dessus. Reste V1.1 : refus de deux dossiers surveillés imbriqués.
**Leçon généralisée** — Tout traitement qui déplace ou supprime des fichiers sur un volume partagé doit prouver que son périmètre n'englobe pas celui d'un autre usage ; « éteint par défaut » est la bonne valeur quand la configuration peut détruire une donnée de démonstration.

### LESSON-2026-031 — PR relue « conforme » et chaînée alors que sa CI n'a jamais été verte : faux Redis divergents entre tests

- **Date :** 2026-11-10
- **Catégorie :** testing / process
- **Statut :** prevention-added
- **Liens :** PR #83 (`feat/otp-lockout`, runs CI 42799141376 et 42811302993), `backend/tests/services/test_backend_engineering_patterns.py` (`FakeRedis`, l. 99), `backend/app/services/auth_service.py` (`_raise_if_locked`), PR #101 (`MemoryRedis` dans `tests/api/test_ingest_watch.py`)

**Contexte** — Lot 3b : verrou du compte après trois codes OTP erronés. Le service appelle désormais `redis.ttl("lock:<id>")` avant de comparer l'OTP. La PR a été relue (innovateur, orchestrateur), déclarée conforme et placée en file de fusion ; elle est passée rouge « après la mise à jour sur `dc4daae` » et a bloqué la file.
**Échec / near miss** — Lecture des runs : la CI de #83 **n'a jamais été verte**. Le premier run (47b9b07) a été annulé par le push suivant ; les deux runs complets (36c974b à 10:26, 9aa3bc4 à 11:54) échouent sur le même test, `test_auth_service_patterns`, avec la même erreur : `'FakeRedis' object has no attribute 'ttl'`. Aucune fusion de `main` (#80, #82) n'a rendu ce test incompatible : il est rouge depuis le premier commit de la branche. La preuve locale de B portait sur son seul fichier de tests (5 tests, vrai Redis) ; la relecture n'a pas regardé `gh pr checks` ; la PR a été mise en file sans lecture de ses checks. Le contrôle de fusion (`wait_clean`) l'a bien arrêtée sur rouge : le défaut est en amont de la chaîne, pas dans la chaîne.
**Cause racine** — Deux causes. (1) **Faux Redis divergents** : chaque fichier de tests porte son propre substitut (`FakeRedis` de 2026-09 : `get`/`setex`/`delete` ; `MemoryRedis` de #101 : `set nx ex`, `eval`…), chacun ne couvrant que les méthodes connues à sa date ; toute nouvelle méthode Redis appelée par un service casse les tests des autres fichiers, qui monkeypatchent `get_redis` à l'aveugle. Même fichier, même classe d'erreur le même jour sur #92 (2ef66d2) : `test_classification_rule_engine_patterns` construit ses règles en `SimpleNamespace` à la main et échoue sur `content_pattern`, nouvel attribut du modèle ; tout double écrit à la main dans un fichier de tests vieillit avec le modèle. (2) **Preuve partielle acceptée** : « mes tests passent » (un fichier) a tenu lieu de « la suite passe », et la relecture § 0 ne comportait pas la lecture de l'état CI de la tête relue.
**Résolution** — B ajoute `ttl` au `FakeRedis` historique (correctif immédiat) ; #83 repasse en CI complète avant de reprendre sa place en file.
**Prévention** — (1) Un **seul substitut Redis partagé** pour toute la suite : candidat Adopt `fakeredis` (`FakeAsyncRedis`, compatible `redis.asyncio`, `ttl`, pipelines, Lua via l'extra `lua`), ce qui exercerait aussi la libération Lua de #101 aujourd'hui non testée ; à défaut, une classe unique dans `tests/conftest.py` et interdiction de redéfinir un faux Redis dans un fichier de tests (contrôle : `grep -rn "^class \w*Redis" backend/tests` ne renvoie qu'un fichier). (2) **Grille de relecture § 0** : première ligne = `gh pr checks <n>` sur la tête relue ; une PR rouge n'est pas « conforme », elle est « conforme sous réserve de CI ». (3) **Règle de mise en file** : une PR n'entre en file que si son dernier run complet est vert (un run annulé ne vaut pas vert) ; le contrôle de fusion reste le second rideau. (4) Preuve d'un auteur = suite complète en Docker, pas le fichier touché.
**Leçon généralisée** — Un substitut de test écrit « juste pour ce fichier » devient un contrat implicite pour tout le code qui partage la dépendance : mutualiser les doubles d'infrastructure (Redis, S3, horloge) ou adopter un faux de référence. Et un statut CI se lit, il ne se suppose pas : « vert avant » doit être cité avec le numéro de run.
