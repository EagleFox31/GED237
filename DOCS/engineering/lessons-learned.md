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

### LESSON-2026-033 — Reprise de la page quittée (#97) cassée par une lecture destructive dans un effet React, invisible sans StrictMode

- **Date :** 2026-11-16
- **Catégorie :** testing
- **Statut :** prevention-added (sous réserve de fusion de #123 et #108)
- **Liens :** PR #97 (fusionnée le 2026-11-10), PR #123 (correctif), PR #108 (lève le `test.fixme` SC-AUTH-02 E1), `frontend/App.tsx` (`AppLayout`, l. 188-197), `frontend/services/http/session.ts` (`takePostLoginDestination`), `frontend/index.tsx` (`React.StrictMode`)

**Contexte** — #97 mémorise l'URL en cours quand la session expire et y ramène le même utilisateur après reconnexion. Fusionnée avec tsc et ESLint propres ; seul test ajouté : `e2e/specs/safe-path.spec.ts` (garde anti-redirection ouverte), « listé, non exécuté » ; le parcours complet SC-AUTH-02 E1 restait en `test.fixme`, à lever après fusion.
**Échec / near miss** — Six jours plus tard, la levée du fixme (#108) fait échouer `auth-2fa -g destination` sur la pile e2e : après reconnexion, l'URL finale est `/dashboard` au lieu de la page quittée. La fonctionnalité livrée par #97 ne marchait pas dans l'environnement de recette.
**Cause racine** — (1) **Lecture destructive dans un effet** : `AppLayout` appelle `takePostLoginDestination` (lit puis efface la clé) dans un `useEffect`. En développement, `React.StrictMode` rejoue les effets ; le second passage, avant que `justLoggedIn` repasse à `false`, lit `null` et navigue vers l'accueil du profil. Un build de production ne rejoue pas l'effet : le défaut y est probablement masqué (non vérifié), d'où sa discrétion. L'effet n'était pas idempotent alors que React exige qu'un effet supporte d'être rejoué. (2) **Preuve qui ne couvrait pas le parcours** : le seul test touchait la fonction pure de validation du chemin, pas l'enchaînement expiration → reconnexion → navigation ; le test du parcours réel existait mais en `fixme`, donc la PR a été fusionnée sans aucune exécution du chemin livré.
**Résolution** — #123 : la destination est lue une seule fois par connexion (`ref` remis à zéro quand `justLoggedIn` redevient `false`), sans changer le contrat de `takePostLoginDestination`. `auth-2fa` complet : 8 réussis / 1 ignoré (E3, fixme existant), cas « autre compte » vert.
**Prévention** — (1) SC-AUTH-02 E1 actif (#108), décliné en « même compte → page quittée » et « autre compte → accueil » : contrôle = `npx playwright test --project=uat auth-2fa` vert. (2) Règle de relecture frontend : un appel `take*`/`consume*` (lecture qui efface) dans un `useEffect` exige une garde de rejeu (`ref` ou état) ; contrôle : `git grep -n "take[A-Z]\w*(" frontend -- '*.tsx'` relu à chaque PR qui en ajoute. (3) Une fonctionnalité dont le test de parcours est en `fixme` n'est pas « vérifiée » : la PR l'écrit en limite, et le fixme est levé **avant** fusion ou dans une PR liée exécutée avant la recette.
**Leçon généralisée** — Tester la brique pure ne prouve pas le parcours : la preuve d'une fonctionnalité est l'exécution de son chemin réel dans l'environnement le plus strict disponible (StrictMode, pile e2e). Et toute opération à effet de bord placée dans un hook rejouable doit être idempotente, comme une commande `apply`.

### LESSON-2026-034 — Spec e2e d'export/import des règles écrit contre l'ancien écran `/rules`, jamais exécuté avant six jours

- **Date :** 2026-11-16
- **Catégorie :** testing / process
- **Statut :** captured (spec corrigé dans #108 ; déclencheur du projet `uat` à décider)
- **Liens :** PR #84 (`feat(classement)`, fusionnée le 2026-11-10), commit 5b836d2 dans PR #108, `frontend/e2e/specs/uat/classification-admin.spec.ts`, `frontend/e2e/pages/rules.page.ts` (`goto` → `rules`), `frontend/profiles/tenant-admin/pages/ClassementPage.tsx`, `docker-compose.e2e.yml` (`E2E_ARGS` par défaut `--project=smoke`)

**Contexte** — Lot 2 V1.1 : export/import des règles de classement. Depuis le 2026-10-28 (0d7a38c), l'onglet « Règles de classement » (`ClassificationSettingsTab`, qui porte `RulesTransferControls`) est servi par l'écran « Plan de classement » `/classement`. L'écran `/rules` (Automates & Règles) existe toujours.
**Échec / near miss** — Le spec UAT de #84 réutilisait l'objet de page `RulesPage` (`goto('rules')`, `openRulesTab()`) : il cherchait le bouton « Exporter » sur un écran qui ne l'a jamais porté. Découvert le 2026-11-16 seulement, en exécutant le projet `uat` pour #108 ; corrigé par 5b836d2 (navigation vers `/classement`, onglet « Règles de classement »).
**Cause racine** — (1) **Spec non exécuté** : le projet Playwright `uat` n'est lancé ni par la CI (la pile e2e lance `--project=smoke` par défaut) ni systématiquement avant fusion (mémoire de la machine) ; un spec UAT faux reste vert par absence. (2) **Objet de page choisi par le nom métier, pas par l'écran** : « règles » a mené à `RulesPage`, alors que la fonctionnalité vit sur `ClassementPage` ; le déplacement de l'onglet n'a laissé aucune trace dans les objets de page. Ce n'est donc pas un spec « devenu » périmé : il l'était à sa naissance.
**Résolution** — Spec réécrit sur `/classement` dans #108 (helper `openClassementRules`), à valider par le run `--project=uat` de #108.
**Prévention** — (1) Un spec e2e ajouté ou modifié est **exécuté** avant fusion : la PR cite la commande et le résultat (`E2E_ARGS="--project=uat <spec>"`) ; « listé, non exécuté » = limite écrite, pas preuve. (2) Run `uat` complet obligatoire avant chaque tag rc (checklist de recette), à défaut d'un job CI planifié — à trancher par ci-qa (`ci.yml` hors de ce lot). (3) Objet de page = un écran : la fonctionnalité testée doit être rendue par la route du `goto()` choisi ; contrôle en relecture : `git grep -n "<Composant>" frontend/profiles` mène bien à la page de la route visée.
**Leçon généralisée** — Un test qui ne tourne jamais n'est pas un filet, c'est une dette silencieuse : tout ensemble de tests hors CI doit avoir un déclencheur explicite (avant release, planifié) sinon il pourrit sans bruit. Et quand une fonctionnalité change d'écran, ses objets de page et ses specs font partie du changement.

### LESSON-2026-035 — Comparaison visuelle avec API simulée « réussie » sur une page plantée

- **Date :** 2026-11-17
- **Catégorie :** testing
- **Statut :** prevention-added (#138 : script versionné `frontend/e2e/visual/`, garde `screen-guard.ts` et test qui la prouve)
- **Liens :** PR #122 (migration Tailwind compilé), `frontend/components/Dashboard.tsx`, `frontend/App.tsx` (`ProfileDashboard`)

**Contexte** — Pour vérifier #122 sans pile complète, les écrans login, dashboard et règles ont été comparés (build CDN vs build compilé) avec une API simulée répondant `{}` ou `[]` à toute requête, sur la base de styles calculés et de captures.
**Échec / near miss** — Le « dashboard » comparé était l'écran d'erreur de l'application : la réponse `{}` faisait planter le composant (`metrics.workflows.completed` sur un objet vide), et le profil de test (`tenant`) n'affichait de toute façon pas ce composant, réservé aux profils hors des sept rôles connus. Les deux builds affichaient la même page d'erreur, donc « aucune différence ». Le défaut n'a été vu qu'en cherchant les tuiles au survol.
**Cause racine** — (1) La comparaison mesurait l'égalité de deux pages, pas la présence de la page voulue. (2) Une maquette d'API trop pauvre ne respecte pas le contrat de type attendu par l'écran. (3) Aucun contrôle ne confirmait que l'écran visé était celui rendu.
**Résolution** — Maquette complète (forme de `TenantMetrics`, `[]` pour les listes), profil adapté à l'écran, puis comparaison refaite : tuiles et sélecteur identiques. Seuls login et règles du premier passage étaient réellement rendus.
**Prévention** — Avant toute capture ou comparaison de styles : (1) asserter un sélecteur métier de l'écran visé (titre ou tuile visible) ; (2) asserter l'absence de l'écran d'erreur (texte « Une erreur est survenue ») ; (3) faire échouer le script sinon ; (4) bâtir la maquette depuis le type du contrat (`types.ts`), pas depuis `{}`. Le script de capture n'est pas versionné : la règle vaut pour tout script futur sous `e2e/` ou `scripts/`.
**Leçon généralisée** — Une comparaison « sans différence » ne prouve rien tant qu'on n'a pas prouvé que ce qui est comparé est bien l'objet visé.

### LESSON-2026-036 — Specs unitaires purs rattachés à un projet e2e dépendant d'une pile : jamais exécutés en CI

- **Date :** 2026-11-17
- **Catégorie :** testing / ci
- **Statut :** prevention-added (PR #143)
- **Liens :** PR #97 (`safe-path.spec.ts`), PR #140 (`account-key.spec.ts`), PR #143, `frontend/playwright.config.ts` (projet `chromium` → `setup`), `frontend/playwright.unit.config.ts`, `.github/workflows/frontend.yml`

**Contexte** — Les specs purs (aucun navigateur, aucune API) tournaient sous `@playwright/test`, dans le projet `chromium`, qui dépend de `setup` (connexion sur une pile réelle). La CI ne lance que `--project=smoke`.
**Échec / near miss** — Un cas de `safe-path.spec.ts` était rouge depuis #97 sans que personne le voie : `'/\evil.example'` vaut `/evil.example` en JS, donc il testait une URL sûre. Découvert le 2026-11-17 en lançant ces specs à la main pour #140.
**Cause racine** — Même schéma que LESSON-2026-034 : un ensemble de tests sans déclencheur. Le rattachement à un projet qui exige une pile rendait leur exécution coûteuse, donc jamais faite.
**Résolution** — #143 : `playwright.unit.config.ts` (sans pile ni `webServer`), `npm run test:unit` lancé dans le job Frontend Lint & Typecheck ; cas antislash corrigé (`'/\evil.example'`). 12/12 verts.
**Prévention** — Un spec pur s'ajoute au `testMatch` de `playwright.unit.config.ts` (commentaire dans le fichier) ; contrôle en relecture : `git grep -L "page\|request" frontend/e2e/specs/*.spec.ts` doit renvoyer seulement des fichiers listés dans ce motif.
**Leçon généralisée** — Un test unitaire ne doit pas dépendre de l'infrastructure d'un test d'intégration : sinon il en hérite le coût et sort de la CI.

### LESSON-2026-037 — Commande git lancée dans le checkout partagé après un `cd` raté : passations non commitées mises de côté

- **Date :** 2026-11-17
- **Catégorie :** process / tooling
- **Statut :** rule-added
- **Liens :** checkout partagé `GED237` (branche `main`), worktrees `GED237-prc*`, `PASSATION*.md`

**Contexte** — Chaque session travaille dans son worktree ; le checkout partagé `GED237` porte les passations non commitées de toutes les sessions. Une seule commande Bash enchaînait `cd <worktree>; git fetch …; git merge …`.
**Échec / near miss** — Le chemin du worktree était faux : `cd` a échoué, mais `;` a laissé s'exécuter le reste dans le répertoire de départ. `git merge` a tourné sur `main` du checkout partagé, a mis de côté les modifications locales (autostash), puis s'est arrêté (« Index was not unstashed »). Les cinq `PASSATION*.md` sont revenues à l'état de `HEAD` pendant environ 7 minutes.
**Cause racine** — Enchaînement par `;` après un `cd` : un échec de navigation ne coupe pas la suite. Le répertoire de départ par défaut est justement le checkout partagé.
**Résolution** — L'autostash a été retrouvé (`git fsck --no-reflog`, commit « WIP on main »). Chaque fichier a été rétabli dans l'état de l'autostash, puis les entrées ajoutées entre-temps par les autres sessions y ont été remises. Contrôle : uniquement des ajouts par rapport à `HEAD`, et `HEAD` inchangé. Une deuxième session a vérifié.
**Prévention** — Commandes git hors du checkout partagé : `git -C <worktree> …` systématique, ou `cd <worktree> && …` ; `set -e` en tête des scripts. Dans le checkout partagé, aucune écriture git hormis `pull --ff-only`. Contrôle en relecture des scripts de session : `grep -nE 'cd [^&|]+; *git' <script>` ne doit rien renvoyer.
**Leçon généralisée** — Une navigation qui peut échouer doit conditionner la suite (`&&`, `set -e`, chemin explicite). Sinon, la commande s'applique là où l'on ne voulait pas agir, et c'est souvent le répertoire le plus partagé.

### LESSON-2026-040 — Entrée du menu admin sans page : « Recherche » ouvrait la page introuvable

- **Date :** 2026-11-17
- **Catégorie :** frontend / testing
- **Statut :** prevention-added
- **Liens :** `frontend/profiles/tenant-admin/menuConfig.ts`, `frontend/App.tsx` (`TAB_TO_ROUTE`, repli `/${tab}`, `NotFoundPage`), `frontend/e2e/specs/route-guard.spec.ts` (GUARD-07)

**Contexte** — Le menu admin est déclaré dans `menuConfig.ts` par identifiants d'onglet. `App.tsx` traduit l'identifiant en route via `TAB_TO_ROUTE`, et à défaut navigue vers `/${tab}`.
**Échec / near miss** — L'entrée « Recherche » (`search_config`) n'avait ni route ni page : `/search_config` affichait « Espace en Travaux ». Signalé pendant la recette rc.1.
**Cause racine** — Le menu et les routes sont deux listes séparées, sans contrôle qui les relie. Le repli `/${tab}` masque l'absence de correspondance au lieu de la signaler.
**Résolution** — Entrée retirée : aucune page de recherche n'existe. La recherche plein texte passe par le bandeau, et le filtre par l'Explorateur documentaire. Ensuite, la version durcie de GUARD-07 a trouvé un 2e lien mort, « Accès & Permissions » (`security_config`). La 1re version l'avait laissé passer. L'entrée est retirée elle aussi : `/authz` est réservé au super admin, et les rôles et permissions sont gérés dans « Agents & Rôles ».
**Prévention** — GUARD-07 (projet `smoke`, CI des PR) clique chaque entrée de `TENANT_ADMIN_MENU`. Il attend que l'entrée soit active (`aria-current="page"`, posé par `Sidebar`), puis échoue si la page introuvable s'affiche. Une entrée de menu ajoutée sans route fait donc échouer la CI.
**Leçon généralisée** — Deux déclarations qui doivent rester alignées (menu et routes, config et code) ont besoin d'un test qui les parcourt ensemble. Un repli silencieux transforme l'écart en défaut visible du seul utilisateur. Une assertion négative (« rien de tel n'apparaît ») n'a de valeur qu'après une attente positive qui prouve que l'état visé est atteint. Sinon elle passe trop tôt : la 1re version de GUARD-07 a laissé passer `security_config`.

### LESSON-2026-041 — Table de fermeture des unités jamais alimentée : « unité et sous-unités » réduit en silence à « son unité »

- **Date :** 2026-11-17
- **Catégorie :** data / authz
- **Statut :** test-added
- **Liens :** #195, #196, `app/services/reports_scope.py`, `org_unit_closure`

**Contexte** — La règle des rapports (D-L12-1) borne les rôles d'unité à leur unité et à ses sous-unités ; les sous-unités étaient lues dans `org_unit_closure`.
**Échec / near miss** — Aucun chemin de l'application n'écrit cette table (ni migration, ni seed, ni création d'unité ; pas même la ligne de profondeur 0). Les tests l'alimentaient à la main. En production, la règle « unité et sous-unités » se réduisait donc à « son unité » sans erreur visible. Trouvé en préparant #195, avant tout signalement.
**Cause racine** — Une structure dérivée (fermeture transitive) consommée sans propriétaire qui la tienne à jour ; les tests fabriquaient la donnée au lieu de passer par le chemin de création réel.
**Résolution** — Une seule règle de sous-arbre, `unit_subtree_ids` / `is_within_unit_tree` : CTE récursive sur `org_units.parent_id`, toujours tenu. Les rapports, les listes de documents, la recherche, les statistiques et les imports l'utilisent.
**Prévention** — `tests/api/test_unit_admin_read_scope.py` construit l'arbre A > A1 > A2 **sans aucune ligne de fermeture** et exige que les rapports et les listes atteignent A2. Les deux lecteurs restants de la table (`classification_rule_engine`, `space_path_builder`) sont suivis dans #201.
**Leçon généralisée** — Avant de s'appuyer sur une table dérivée, vérifier qui l'écrit (`grep` des écritures, pas des lectures). Un test qui remplit lui-même une donnée dérivée prouve la requête, pas la règle.

### LESSON-2026-073 — Un rôle d'unité avec `manage` agit sur toute l'institution : Casbin ne connaît pas l'arbre

- **Date :** 2026-11-17
- **Catégorie :** authz
- **Statut :** test-added
- **Liens :** #215, `app/services/unit_admin_scope.py` (`assert_unit_admin_in_tree`, `assert_unit_admin_object_in_tree`, `unit_admin_scope_ids`), `policy.csv` (classification_reviews, workflows)

**Contexte** — `policy.csv` donne à `unit_admin` `classification_reviews, manage` et `workflows, manage`. Le matcher accepte `p.act == "manage"` pour toute action.
**Échec / near miss** — Casbin vérifie le tenant, pas l'unité : un unit_admin pouvait lister et trancher les revues, valider, réassigner et lire les circuits de toute l'institution. #195 avait borné les lectures, pas ces écritures. Trouvé en revue (#215), sans incident signalé.
**Cause racine** — Le périmètre « son unité et ses sous-unités » vit dans le code (#195), alors que le droit vient de la politique. Chaque nouvelle route sous `manage` hérite de la portée tenant si elle n'appelle pas la règle d'arbre.
**Résolution** — Une seule règle pour les rôles bornés : celle de `unit_admin_scope` (contrôles fermés par défaut, `unit_admin_scope_ids` pour les listes), partagée avec #202 ; pas de seconde copie ailleurs. Ressource hors arbre : 404 ; cible hors arbre : 403. Un acteur explicitement assigné garde son droit.
**Prévention** — `tests/api/test_unit_admin_tree_writes.py` et `test_unit_admin_write_scope.py` : un unit_admin d'une autre branche reçoit 404, une cible hors arbre 403, un parent n'est jamais atteint depuis une sous-unité ; tenant_admin et super_admin gardent toute l'institution. Sans les gardes, 9 tests sur 14 échouent.
**Leçon généralisée** — Un droit de politique (`manage`) dit *quoi*, pas *où*. Toute route ouverte à un rôle borné doit passer par la règle de périmètre, et son test doit inclure un acteur du même rôle dans une autre branche.

### LESSON-2026-044 — Un tenant_admin pouvait se nommer super_admin

- **Date :** 2026-11-17
- **Catégorie :** security / backend
- **Statut :** prevention-added
- **Liens :** `backend/app/api/v1/endpoints/users.py` (`_assert_role_grantable`, `update_user`), `backend/tests/api/test_users.py`

**Contexte** — POST et PATCH /users acceptent `role_id` (ou `role_code` à la création). Le droit `users:create`/`users:update` était le seul contrôle.
**Échec / near miss** — Relevé en revue de #222 : un tenant_admin pouvait donner le rôle super_admin à un agent ou à lui-même, donc l'accès à toutes les institutions.
**Cause racine** — L'autorisation portait sur l'action (« modifier un agent »), pas sur la valeur écrite. Le rôle attribué n'était comparé à rien.
**Résolution** — Seul un super_admin attribue super_admin ; personne n'attribue un rôle plus élevé que le sien (`hierarchy_level` plus bas) ; personne ne change son propre rôle. Refus en 403 explicite (`ROLE_GRANT_FORBIDDEN`, `OWN_ROLE_CHANGE_FORBIDDEN`). PATCH refuse aussi un e-mail déjà pris (409 `USER_EMAIL_TAKEN`).
**Prévention** — Tests de non-régression en POST et en PATCH : tenant_admin vers super_admin refusé (sur lui-même et sur un agent), rôle inférieur et super_admin autorisés.
**Leçon généralisée** — Un droit d'écriture sur une ressource ne couvre pas les champs qui portent eux-mêmes un privilège (rôle, institution, rattachement). Chaque champ de ce type a son contrôle de valeur et son test de refus.

### LESSON-2026-046 — Données e2e partagées consommées par une spec : la suite dépendait de l'ordre de lancement

- **Date :** 2026-11-17
- **Catégorie :** testing / e2e
- **Statut :** prevention-added
- **Liens :** `frontend/e2e/specs/uat/validation-cycle.spec.ts`, `frontend/e2e/specs/seed.spec.ts`, `frontend/e2e/data/seed-manifest.json` (`pendingTasks`), `frontend/e2e/specs/demo-counters.spec.ts`, `frontend/e2e/data/demo.ts` (`DEMO_P8_TITLES`)

**Contexte** — Le seed e2e crée 3 tâches de visa pour MGR001 (`E2E-VAL-*`). `seed.spec` vérifie qu'elles sont en attente ; `validation-cycle` les validait et les rejetait. Cette spec est dans deux projets (`smoke` et `uat`).
**Échec / near miss** — Suite complète du 17/11 sur f8f1d75 : `seed.spec:58` et SC-VAL-01 [smoke] en échec. MGR001 n'avait plus qu'une tâche sur trois : le 1er passage de `validation-cycle` avait consommé les deux autres. Même jour, `demo-counters:113` attendait 357 documents et en trouvait 359 : les 2 documents P8, ajoutés après le jeu de démo par `e2e_reset.sh demo`.
**Cause racine** — Une spec qui modifie l'état consommait des données partagées, créées une seule fois par remise à zéro. Le passage n'était donc ni rejouable ni indépendant de l'ordre. Pour demo-counters : le manifeste P8 annonce que ses documents ne comptent pas dans `expected`, mais la spec ne les excluait pas.
**Résolution** — `validation-cycle` crée ses 3 tâches à chaque passage, par l'API (le collaborateur dépose 3 documents uniques et les soumet au visa du manager), avec des titres propres au passage et à la reprise. Les tâches du seed restent intactes. `demo-counters` écarte les titres de `demo-p8-manifest.json`, dans les documents et dans les revues ouvertes : les 2 bordereaux P8 ne trouvent aucune règle et ont chacun une revue, ce qui donnait 43 revues au lieu de 41.
**Prévention** — Vérifié sur une pile isolée : smoke (48), `validation-cycle` deux fois (5 + 5), `seed` (3) et `responsive` (13), tous verts dans cet ordre sur la même base ; puis reset démo et `--project=demo` 8/8. Convention déjà écrite pour le projet `uat` (« chaque spec crée ses données par l'API ») et désormais appliquée à la seule spec qui la contournait.
**Leçon généralisée** — Les données d'un seed se lisent ; elles ne se consomment pas. Une spec qui change l'état crée ses propres données, avec un identifiant de passage. Un test rejoué deux fois de suite sur la même base est la preuve la moins chère de cette indépendance.

### LESSON-2026-051 — Clé de stockage dérivée du nom de fichier : un dépôt de même nom écrasait un autre fichier

- **Date :** 2026-11-18
- **Catégorie :** data-loss / backend
- **Statut :** prevention-added
- **Liens :** `backend/app/services/storage/base.py` (`unique_storage_name`), `local.py`, `s3.py`, `backend/tests/api/test_version_storage_keys.py`

**Contexte** — `save_file_with_checksum` rangeait chaque dépôt sous `{tenant}/{unité}/{nom du fichier}`, en local comme en S3/MinIO.
**Échec / near miss** — Relevé pendant le chantier de restauration de version (V1.2) : deux dépôts de même nom dans la même unité s'écrasaient. Une nouvelle version au nom identique détruisait les octets de la version précédente ; deux dépôts directs de même nom, ceux d'un autre document. Les branches « identique à la version courante » supprimaient ensuite le fichier partagé, donc la version courante elle-même.
**Cause racine** — La clé de stockage venait d'une donnée utilisateur non unique (le nom), et aucun test ne déposait deux fois le même nom.
**Résolution** — Clé `{uuid}_{nom}` (le motif de l'import) dans les deux backends, via un seul point (`unique_storage_name`). Aucune migration : les fichiers existants ne sont pas touchés.
**Prévention** — Tests : même nom deux fois avec octets différents (deux chemins, deux lectures, sha256 = checksum), dépôt identique refusé sans perdre la version courante, retour à une ancienne version refusé, deux dépôts directs de même nom, clé S3 distincte.
**Leçon généralisée** — Une clé de stockage ne se dérive jamais d'une donnée fournie par l'utilisateur sans élément unique. Tout stockage testé avec deux entrées de même nom, et toute suppression « de nettoyage » vérifie que le fichier n'est pas partagé.

### LESSON-2026-052 — Disque C: saturé pendant une nuit de sessions parallèles : écritures et commits gelés

- **Date :** 2026-11-18
- **Catégorie :** infra / poste de développement
- **Statut :** open
- **Liens :** données Docker de WSL (`docker_data.vhdx`), scripts e2e, `images_export.sh`, builds compose. Numéro 051 laissé à la leçon en cours côté backend.

**Contexte** — Cinq sessions de travail tournaient en parallèle sur un même poste au disque de 476 Go. Les données Docker vivent dans le disque virtuel de WSL (`docker_data.vhdx`). Vers 02:36, il ne restait plus que 0 à 300 Mo libres.
**Échec / near miss** — Aucune perte constatée. Risques : objets git tronqués, base PostgreSQL abîmée en écriture, faux rouges en e2e. L'orchestration a gelé toute écriture locale et tout commit jusqu'au retour de l'espace.
**Cause racine** — Personne ne surveille l'espace libre, et aucune tâche lourde (build, e2e, export d'images) ne le vérifie avant de démarrer. Le disque virtuel de WSL grossit et ne rend jamais la place : `docker system prune` libère de l'espace dans WSL, pas sur C:. S'y ajoutent les caches d'outils (paquets, navigateurs de test, compilations).
**Classification** — Capacité de l'environnement ; near miss ; répétable tant que plusieurs piles tournent sur le même poste.
**Résolution** — Place libérée par le PO sur le poste ; 49 Go libres (90 % utilisés) au contrôle du 18/11 au matin, au-dessus du seuil de 20 Go. Détail des éléments libérés : à compléter par le PO.
**Prévention** —
1. Garde réutilisable `scripts/ensure_free_space.sh`, seuil `MIN_FREE_GB` (20 par défaut). Elle contrôle le disque du dépôt et celui des données Docker, et elle est appelée par les scripts e2e, `images_export.sh` et les builds compose. En cas de refus, elle affiche un message qui dit quoi faire, et ne propose jamais `down -v`. Test : valeur simulée sous le seuil → code de sortie 1 ; au-dessus → 0. Porteur : backend, ≈ 0,25 h-s ; relecture : QA.
2. `df -h` noté dans chaque passation et chaque point de reprise : alerte sous 50 Go, aucune charge lourde sous 20 Go.
3. Le compactage de `docker_data.vhdx` est documenté comme une action du PO, jamais celle d'une session.
4. Plafonds de journaux (`max-size`, `max-file`) vérifiés sur toutes les piles compose.
**Leçon généralisée** — Une ressource partagée se vérifie avant chaque charge lourde. Une garde qui refuse coûte une ligne ; un disque plein coûte une nuit de travail gelée.

### LESSON-2026-053 — Initialisation immédiate avec effet de bord réseau : un moteur facultatif faisait tomber toute la chaîne OCR

- **Date :** 2026-11-18
- **Catégorie :** reliability / backend
- **Statut :** prevention-added
- **Liens :** `backend/app/services/ocr/easyocr_engine.py`, `backend/app/services/ocr/strategy.py`, `backend/Dockerfile` (`EASYOCR_MODEL_DIR`), `backend/tests/services/test_ocr_strategy.py`

**Contexte** — `OCRStrategy()` construit les deux moteurs ; `EasyOCREngine.__init__` chargeait ses modèles, que l'image ne contenait pas : ils se téléchargeaient au premier usage.
**Échec / near miss** — Relevé par Q pour le 25/11 : sans réseau, `easyocr.Reader` lève `URLError` dans le constructeur, `OCRStrategy()` échoue et toute la tâche OCR tombe, Tesseract compris, alors qu'il aurait lu le scan seul. Sur un réseau coupé sans réponse, le téléchargement n'a pas de délai.
**Cause racine** — Un composant de repli construit de façon immédiate, avec un effet de bord réseau, et une dépendance d'exécution (les modèles) absente de l'image.
**Résolution** — Constructeur sans effet de bord ; lecteur chargé à la demande avec `download_enabled=False` ; modèles fr+en cuits dans l'image (couche cachée, `EASYOCR_MODEL_DIR`) ; modèle absent = un avertissement, résultat vide, repli sur Tesseract.
**Prévention** — Test : sans modèle, `OCRStrategy()` se construit et le texte Tesseract est conservé ; essai en conteneur `--network none`.
**Leçon généralisée** — Un composant facultatif ou de repli ne doit jamais faire échouer la construction de la chaîne ni dépendre du réseau à l'exécution : initialisation paresseuse, dépendances dans l'image, échec = dégradation journalisée. Tester une fois avec le réseau coupé.

### LESSON-2026-054 — Moteur lourd en premier choix et deux processus dans 2 Go : le worker était tué, le document restait « en traitement »

- **Date :** 2026-11-18
- **Catégorie :** reliability / capacity
- **Statut :** prevention-added
- **Liens :** `backend/app/services/ocr/strategy.py` (`_select_engines`), `backend/app/core/config.py` (`OCR_PRIMARY_ENGINE`), `docker-compose.yml` (worker `--concurrency=1`), `backend/tests/services/test_ocr_strategy.py`

**Contexte** — Les photos et captures passaient d'abord par EasyOCR (torch), Tesseract n'étant que le repli. Le worker Celery tournait avec `--concurrency=2` et `mem_limit: 2g`.
**Échec / near miss** — Chaque processus enfant charge son propre lecteur EasyOCR (~1,3 Go) : deux lecteurs dépassent 2 Go, le noyau tue le processus (OOM). La tâche est perdue et le document reste « en traitement » indéfiniment, sans erreur visible.
**Cause racine** — Moteur le plus lourd choisi par défaut sans budget mémoire par processus, et concurrence réglée sur les CPU sans tenir compte de la mémoire par enfant.
**Résolution** — `OCR_PRIMARY_ENGINE` (défaut `tesseract`) : EasyOCR n'est plus qu'un repli chargé à la demande, `easyocr` reste possible en option ; worker en `--concurrency=1`. Aucun moteur retiré.
**Prévention** — Tests : une photo ne charge pas EasyOCR quand le moteur principal est tesseract ; avec `easyocr`, comportement inchangé ; valeur du réglage validée. Reste en V1.1 : un statut d'échec explicite quand une tâche OCR est perdue (un OOM ne doit plus laisser « en traitement »).
**Leçon généralisée** — Concurrence × mémoire du composant le plus lourd doit rester sous la limite du conteneur ; le chemin par défaut utilise le moteur le plus léger, le lourd est un repli ou une option. Une tâche tuée doit laisser un état d'échec visible, jamais un état « en cours » éternel.

### LESSON-2026-055 — Revue limitée aux diffs : les écrans non modifiés gardaient des contrôles morts et des fenêtres natives

- **Date :** 2026-11-18
- **Catégorie :** qualité / revue
- **Statut :** prevention-added
- **Liens :** `frontend/.eslintrc.json` (`no-alert`), `frontend/e2e/fixtures/noNativeDialog.ts`, `frontend/e2e/fixtures/auth.fixture.ts`, `frontend/e2e/fixtures/authenticated.fixture.ts`

**Contexte** — Les relectures de PR portaient sur les fichiers modifiés. Des écrans d'accueil par rôle, jamais touchés par les PR récentes, contenaient des contrôles sans action et des `alert` / `confirm` / `prompt` natifs, visibles seulement en parcourant l'application comme un utilisateur de chaque rôle.
**Échec / near miss** — Relevé en recette avant le gel V1.0 : la revue de diff ne pouvait pas voir ce qui n'était pas dans le diff.
**Cause racine** — Angle mort de la revue limitée aux diffs ; règle `no-alert` désactivée, aucun garde-fou automatique contre les fenêtres natives.
**Classification** — Couverture de revue ; near miss ; répétable à chaque nouvel écran.
**Résolution** — Contrôles morts corrigés et fenêtres natives remplacées par `ConfirmationModal` / `RejectReasonDialog` (PR #334, #336). Écrans d'administration corrigés dans une PR dédiée.
**Prévention** —
1. `no-alert` en erreur, sans exception.
2. Garde Playwright automatique (`noNativeDialog`) dans les fixtures communes : tout test qui ouvre une fenêtre native échoue.
3. Grille de recette : parcours par persona sur l'accueil de chaque rôle, tout élément cliquable agit, aucune fenêtre native.
**Leçon généralisée** — Une revue de diff ne couvre pas les écrans non modifiés : ce qu'on interdit doit l'être par une règle automatique, et la recette doit parcourir l'application par persona.

### LESSON-2026-056 — Périmètre restreint sur les listes, ouvert par id : unit_admin modifiait les documents d'autres unités

- **Date :** 2026-11-18
- **Catégorie :** security / authz
- **Statut :** prevention-added
- **Liens :** `backend/app/api/v1/endpoints/documents.py` (`_ensure_in_unit_tree`, `_can_read_document`, `_can_mutate_document`, `_can_trash_document`, `_can_manage_lock`), `backend/tests/api/test_unit_admin_read_scope.py`

**Contexte** — Le périmètre de unit_admin (son unité et les unités en dessous) était appliqué par le filtre des listes (`visible_document_scope`).
**Échec / near miss** — Relevé en relecture avant fusion : les routes par id (`GET`, `PATCH`, `DELETE`, corbeille, verrou, nouvelle version) ne vérifiaient que le type de droit Casbin. Un unit_admin lisait, modifiait ou supprimait par id un document de toute l'institution.
**Cause racine** — Deux chemins pour une même règle : le filtre de liste et les prédicats par objet. Seul le premier avait été adapté, et les tests ne couvraient que les listes.
**Résolution** — Les prédicats par objet appliquent le sous-arbre à unit_admin ; hors sous-arbre, le document est traité comme inconnu (404). Une étape de circuit assignée ouvre toujours la lecture.
**Prévention** — Tests 404 sur `GET` et `PATCH` par id hors sous-arbre, avec témoins 200 dans le sous-arbre.
**Leçon généralisée** — Toute règle de périmètre se teste sur les deux chemins : la liste et l'accès par id (lecture et écriture). Un filtre de liste n'est pas un contrôle d'accès.

### LESSON-2026-057 — Ensemble de rôles trop large : unit_admin lisait et écrivait à l'échelle de l'institution

- **Date :** 2026-11-18
- **Catégorie :** security / authz
- **Statut :** prevention-added
- **Liens :** `backend/app/services/unit_admin_scope.py`, `backend/app/api/v1/endpoints/analytics.py`, `classification.py`, `classification_reviews.py`, `imports.py`, `workflows.py`, `backend/tests/api/test_unit_admin_write_scope.py`

**Contexte** — Le périmètre de unit_admin (unité et sous-unités) avait été posé sur les documents, la recherche et les rapports (#195, LESSON-2026-056).
**Échec / near miss** — Relevé par l'audit de routes : `/analytics/tenant`, le circuit d'un document, la cible d'un import, la file de revue et les règles de classement acceptaient unit_admin avec la portée de l'institution, y compris en écriture (créer ou supprimer une règle valable pour toute l'institution).
**Cause racine** — Ces routes testaient un ensemble de rôles (`ADMIN_ROLES`, `TENANT_WIDE_READ_ROLES`) qui range unit_admin avec tenant_admin ; l'ajout d'un rôle intermédiaire n'a pas relu les routes qui s'appuient sur ces ensembles.
**Résolution** — Une seule définition de l'arbre (`reports_scope`), des aides asynchrones partagées ; analytics calculé sur le sous-arbre, hors arbre = 403/404, règles hors arbre en lecture seule ou masquées.
**Prévention** — `test_unit_admin_write_scope.py` : chaque route concernée est jouée avec unit_admin d'une sous-unité et témoin tenant_admin ; `test_unit_admin_crawl` vérifie qu'aucun identifiant d'une autre unité ne sort.
**Leçon généralisée** — Ajouter un rôle intermédiaire impose de relire chaque ensemble de rôles qui le contient et de jouer les routes avec ce rôle. Un ensemble « admin » n'est pas un périmètre.

### LESSON-2026-058 — Repli automatique vers un moteur trop lourd : un texte déjà lu était perdu avec la tâche

- **Date :** 2026-11-18
- **Catégorie :** reliability / ocr
- **Statut :** prevention-added
- **Liens :** `backend/app/services/ocr/strategy.py` (`_should_use_fallback`), `backend/app/core/config.py` (`OCR_FALLBACK_ENABLED`), `backend/tests/services/test_ocr_strategy.py`, [LESSON-2026-054](#lesson-2026-054)

**Contexte** — Tesseract lit les photos de la démo en environ 1 s, mais avec une confiance de 57 % ; une confiance faible déclenchait le repli sur EasyOCR.
**Échec / near miss** — Le worker (2 Go) était tué par SIGKILL en 3 s au chargement d'EasyOCR : la tâche était perdue, `ocr_content` restait vide et aucune photo n'était indexée (363 SIGKILL sur le corpus), alors que le texte de Tesseract était correct.
**Cause racine** — Le repli était un chemin automatique sans réglage ni borne mémoire : un texte exploitable était remplacé par une tentative qui dépasse la limite du conteneur.
**Résolution** — Réglage `OCR_FALLBACK_ENABLED` (défaut `false`, déclaré en config, compose et `.env.example`) : désactivé, le texte du premier moteur est conservé tel quel.
**Prévention** — Tests : réglage à `false`, EasyOCR n'est jamais appelé (images et pages de PDF) ; à `true`, le comportement précédent est inchangé.
**Leçon généralisée** — Un repli plus lourd que le chemin principal doit être configurable et borné par la mémoire disponible ; ne jamais le laisser remplacer un résultat déjà exploitable au risque de tuer la tâche. La perte d'une tâche tuée (pas d'`acks_late`) reste à traiter en V1.1.

### LESSON-2026-059 — Modèles chargés à la première inférence : un build « réussi » n'embarquait pas les modèles attendus

- **Date :** 2026-11-18
- **Catégorie :** build / ocr
- **Statut :** prevention-added
- **Liens :** `backend/app/services/ocr/rapidocr_params.py` (`download_models`), `backend/app/services/ocr/rapidocr_engine.py`, `backend/Dockerfile`, `backend/tests/services/test_rapidocr_engine.py`

**Contexte** — RapidOCR devait être livré avec ses modèles PP-OCRv5 latin dans l'image, sans téléchargement à l'exécution (hors ligne).
**Échec / near miss** — Le premier build instanciait seulement le moteur : dossier de modèles vide (la version 3.10.0 charge chaque modèle à la première inférence, et le recognizer seulement si du texte est détecté). Les fichiers `.onnx` visibles dans le paquet étaient les modèles PP-OCRv6 intégrés à la roue, pas ceux choisis. L'étape de contrôle du Dockerfile a arrêté le build ; sans elle, le moteur aurait téléchargé au premier appel en production.
**Cause racine** — Hypothèse non vérifiée : « instancier = télécharger ». Les paramètres de version n'étaient posés que pour le recognizer ; le détecteur gardait la version par défaut.
**Résolution** — `download_models()` exécute une inférence sur une image contenant du texte, pour forcer les deux téléchargements ; versions et type de modèle posés pour le détecteur et le recognizer ; le build vérifie la présence du modèle latin.
**Prévention** — Contrôle de présence dans le Dockerfile (`ls | grep -i latin`) ; essai réel avec `--network none` ; test unitaire de l'absence de modèle (moteur indisponible, aucun accès réseau).
**Leçon généralisée** — Pour toute bibliothèque qui télécharge ses modèles, forcer l'usage réel au build et prouver l'absence de réseau à l'exécution. Mesurer la mémoire par le pic du conteneur (`memory.peak`) et régler la taille d'entrée en conséquence : 2000 px donnait 755 à 895 Mo, 1600 px 609 à 695 Mo, 1800 px 626 Mo (défaut retenu après le banc de Q : rappel -0,64 point par rapport à 2000).

### LESSON-2026-061 — PR de base entrée dans la file alors que trois PR la ciblaient encore

- **Date :** 2026-11-18
- **Catégorie :** process
- **Statut :** captured (contrôle à ajouter par O dans le script de file)
- **Liens :** `gestion-projet/innovateur/runbook-coupe-19-11.md` § 8.2 (étape 1) et § 8.4, PR #203, #358, #266, #241

**Contexte** — Il n'y a pas de file de fusion GitHub. Un script d'O met la branche à jour, attend que le CI Gate soit vert, puis lance `gh pr merge --merge`. Le ruleset ne protège que la branche par défaut. Le 18/11, #203 (`feat/post-rc1-195-unit-admin-scope`) est entrée dans la file alors que #358, #266 et #241 avaient encore cette branche comme base.
**Échec / near miss** — La relecture du runbook (§ 8.2, étape 1) l'a détecté, et O a reciblé les trois PR sur `main` avant la fusion. Sans cela :
- si la branche avait été supprimée à la main (`git push --delete`), les PR qui la ciblent auraient pu être fermées. GitHub ne retarget automatiquement que si la branche est supprimée après la fusion de sa PR ([changelog GitHub, 19/05/2020](https://github.blog/changelog/2020-05-19-pull-request-retargeting)). Ici, `delete_branch_on_merge` vaut `false` ;
- **risque plus probable, et silencieux** : les trois PR restent ouvertes sur une branche déjà fusionnée. Leur fusion ultérieure atterrit sur cette branche et pas sur `main`, hors du ruleset, donc sans CI Gate obligatoire. Les changements manquent alors à la release sans aucune erreur.
**Cause racine** — Le script de file ne regarde que la PR à fusionner, pas les PR qui dépendent de sa branche. Le reciblage des PR empilées était une règle orale (mémoire « re-cibler avant fusion »), sans contrôle automatique.
**Classification** — Processus ; near miss ; répétable à chaque pile de PR. La règle de reciblage existait déjà, mais sans contrôle : il faut donc un contrôle plus fort.
**Résolution** — #358, #266 et #241 reciblées sur `main` par O le 18/11, avant la fusion de #203. #360 et #361, empilées sur #358, ont été reciblées sur `main` avant sa fusion ; #358 et #360 sont fusionnées le 18/11.
**Prévention** — Dans le script de file, avant `gh pr merge` : `gh pr list --repo $REPO --base <headRefName> --state open --json number -q 'length'` doit renvoyer `0`. Sinon, refus avec la liste des PR à recibler. Vérifiable : lancer le script à blanc sur #358 tant que #360 la cible, il doit refuser.
**Leçon généralisée** — On ne fusionne jamais une branche qui sert encore de base à une PR ouverte. Le contrôle doit être dans l'outil de fusion, pas dans la mémoire de l'opérateur : une PR qui cible une branche non protégée échappe aux contrôles obligatoires.

### LESSON-2026-062 — Procédure d'exploitation écrite par déduction : le rejeu a trouvé un écart

- **Date :** 2026-11-18
- **Catégorie :** process
- **Statut :** captured (point à ajouter à la grille de relecture de Q)
- **Liens :** `DOCS/exploitation/donnees-demo.md` (étape 2), PR #363, PR #408 (item 31, #273), `docker-compose.yml` (`name: edossier`, `container_name: edossier_*`)

**Contexte** — La remise à zéro du jeu de démo sur la pile complète a été écrite à partir de la lecture de `docker-compose.yml`, sans l'exécuter. Le texte le disait (« procédure déduite, pas encore rejouée »).
**Échec / near miss** — Le rejeu de Q (18/11 : 26 s, 408 documents) a buté sur un cas que la lecture n'avait pas vu : une autre pile tourne déjà sur le poste. La première correction proposée, lancer avec un autre nom de projet (`-p`), était elle aussi déduite et elle ne suffit pas. `container_name` fixe le nom du conteneur quel que soit le projet, donc les noms `edossier_*` restent en conflit. La version poussée sur #363 demande une copie du fichier sans `container_name`, avec `-p` et un autre `APP_PORT`.
**Cause racine** — Une procédure d'exploitation déduite a été traitée comme une procédure prête. La correction est passée par le même chemin (déduction), sans rejeu.
**Classification** — Documentation ; near miss, corrigé avant la fusion ; répétable sur toute procédure d'exploitation (installation, remise à zéro, sauvegarde, test hors ligne).
**Résolution** — #363 corrigée (dbca5d0) avec le résultat du rejeu et la note sur une pile concurrente. La même correction est reportée sur `docs/scenario-demo-30-11` et dans le runbook (f5f5d25). #363 est fusionnée le 18/11.
**Suivi (18/11, item 31)** — Le même manuel d'installation, relu sur papier contre le compose et la config, comptait 3 écarts bloquants, 9 gênants et 8 mineurs (corrigés par #408). `docker compose config` a confirmé que `-p` ne change pas les `container_name`. Le rejeu sur poste neuf du 20/11 passe donc par une surcharge hors dépôt (`container_name: !reset null`, port de l'hôte déplacé), vérifiée elle aussi avec `config` avant le lancement.
**Prévention** —
1. Aucune procédure d'exploitation (`DOCS/exploitation/`, runbooks, protocoles) n'est fusionnée sans la mention explicite « rejouée le JJ/MM : résultat » ou « non rejouée ».
2. Q vérifie ce point dans sa grille de relecture.
3. Une correction de procédure suit la même règle que la procédure : elle est rejouée, ou marquée « non rejouée ».
4. Contrôle plus fort, à décider : un hook pre-commit ou un job CI qui échoue si un fichier modifié sous `DOCS/exploitation/` ne contient ni « rejouée le » ni « non rejouée ».
**Leçon généralisée** — Une procédure qu'on n'a pas exécutée est une hypothèse. Elle le dit, et on ne la fusionne qu'avec l'état de son rejeu. Le correctif d'une procédure est lui aussi une procédure.

### LESSON-2026-063 — Pools d'adresses Docker épuisés : un KO e2e sans test en échec est un faux rouge

- **Date :** 2026-11-18
- **Catégorie :** infrastructure / testing
- **Statut :** captured (surcharge compose et consigne de lecture des logs, à porter par F et Q)
- **Liens :** piles e2e lancées en parallèle par session, mémoire « charges Docker en parallèle » (3 au plus)

**Contexte** — Plusieurs sessions lancent chacune une pile compose e2e, jusqu'à 3 en parallèle. Compose crée un réseau par projet. Les pools d'adresses par défaut du démon Docker n'offrent qu'une trentaine de réseaux : les /16 de 172.17 à 172.31, plus 192.168.0.0/16 découpé en /20. Les réseaux des piles précédentes, jamais supprimés, s'y ajoutent.
**Échec / near miss** — Le démarrage d'une pile a échoué sur « all predefined address pools have been fully subnetted ». La passe e2e a été lue comme KO, alors qu'aucun test n'avait tourné : c'est un faux rouge. Le temps est passé à chercher une régression dans le code, pas dans l'environnement.
**Cause racine** — Les réseaux compose s'accumulent : la pile est arrêtée sans être supprimée, ou chaque session prend un nom de projet différent. L'adressage est laissé au pool par défaut. La conclusion « échec de test » a été tirée du code de retour, sans lire le log.
**Classification** — Environnement et diagnostic ; faux rouge ; répétable dès que plusieurs piles tournent sur le même poste.
**Résolution** (F, 18/11) — Le premier lot e2e de #364 était tombé en KO, sans aucun test en échec, alors qu'environ 32 réseaux étaient présents, dont certains de projets arrêtés.
- Seuls les réseaux de F (préfixe `gedtest-f`) ont été supprimés. Aucun réseau d'un autre pair n'a été touché.
- Un sous-réseau fixe dédié a été ajouté dans la surcharge compose de la passe : `networks.default.ipam.config`, subnet `10.231.77.0/24`, dont on a vérifié qu'il était libre.
- Relance : #364 est verte (`notifications.spec` : 9 passed ; tsc et tests unitaires OK).
**Prévention** —
1. Chaque session déclare un sous-réseau fixe dans sa surcharge compose, par exemple `10.231.77.0/24` (un /24 distinct par session). La pile ne puise plus dans le pool par défaut.
2. En fin de passe, `docker compose -p <projet de session> down -v --remove-orphans` est obligatoire. C'est valable pour les piles de session uniquement : la pile `edossier_*` reste gelée jusqu'au 22/11, sans `down -v` ni redémarrage.
3. Avant de conclure à un échec de test, on lit le log : un KO sans test en échec dans le rapport est classé « environnement », pas « régression ».
4. Contrôle vérifiable : le script e2e échoue avec un message explicite si le rapport ne contient aucun test exécuté. Cela distingue « pile non démarrée » de « tests rouges ».
**Leçon généralisée** — Un rouge sans test en échec n'est pas un résultat de test. Les ressources partagées d'un poste (réseaux, ports, noms de conteneurs) s'attribuent de façon fixe par session et se libèrent en fin de passe.

### LESSON-2026-064 — Boucle `echo | while read` : docker avale l'entrée standard et la passe s'arrête sans erreur

- **Date :** 2026-11-18
- **Catégorie :** automation / testing
- **Statut :** captured (règle d'écriture des boucles, à porter par F et Q)
- **Liens :** passes e2e en série sur une liste de PR

**Contexte** — Une passe de vérification parcourt une table de PR avec `echo "$table" | while read ...; do ...; done`. Le corps de la boucle appelle une commande docker.
**Échec / near miss** — La passe s'est arrêtée après 2 PR, sans erreur et avec un code de retour 0. Les PR suivantes n'ont pas été vérifiées, et rien ne le signalait.
**Cause racine** — La commande docker du corps de boucle hérite de l'entrée standard de la boucle. C'est le cas de `docker compose exec` sans `-T`, de `docker run -i`, et aussi de `ssh`. Elle lit donc le reste de la table, et le `read` suivant trouve une entrée vide : la boucle se termine normalement.
**Classification** — Outillage ; échec silencieux, un faux vert par omission ; répétable avec toute commande qui lit l'entrée standard dans une boucle `while read`.
**Résolution** (F, 18/11) — La passe s'était arrêtée après #353. #355, #356, #357 et #361 n'avaient pas été lancées, et `summary.txt` comptait 2 lignes au lieu de 6.
- Correctif : la table est lue sur un descripteur dédié, `while read -u 3 ...; done 3<<<"$TABLE"`.
- Relance : toutes les PR sont de nouveau parcourues (#364, #355 et #356 lancées ensuite).
- À noter, sans lien avec la leçon : le KO de #355 venait d'un paramètre du spec (`undefined` redevenait `true`), pas du code. Deux lancements du même script ont aussi tourné en parallèle par erreur, car `pkill` est absent sous Git Bash. L'un a été tué par PID et ses conteneurs nettoyés. Un seul lot de F tourne à la fois.
**Prévention** —
1. On lit la table par un descripteur dédié : `while read -u 3 ...; do ...; done 3< fichier` (ou `3< <(commande)`). Sinon, on coupe l'entrée de chaque commande du corps : `docker ... </dev/null`, `docker compose exec -T`.
2. En fin de passe, on compare le nombre d'éléments traités au nombre de lignes de la table. Un écart fait échouer le script.
3. Contrôle vérifiable : une table de 5 lignes factices avec un corps qui appelle `docker compose exec` doit afficher 5 traitements.
**Leçon généralisée** — Une boucle qui se termine sans erreur n'a pas forcément tout traité. Toute boucle d'outillage compte ses éléments et isole son entrée standard des commandes qu'elle appelle.

### LESSON-2026-065 — Réglage ajouté au code et à la doc, mais jamais transmis par Docker (deux fois le 18/11)

- **Date :** 2026-11-18
- **Catégorie :** release-deployment / ci-cd
- **Statut :** captured (contrôle écrit dans #389, à fusionner en V1.1 après la coupe)
- **Liens :** PR #378 (`VITE_DEMO_PROFILES`), PR #383 (`AUDIT_EXPORT_MAX_ROWS`), PR #389 (contrôle de parité), `backend/app/core/config.py`, `docker-compose.yml`, `.env.example` racine, mémoire « grille de relecture Q » (compose et `.env.example`)

**Contexte** — Les services `api` et `worker` de `docker-compose.yml` ont un bloc `environment` explicite. Une variable du `.env` n'atteint donc le conteneur que si le compose la cite. Côté frontend, une variable `VITE_*` est figée au build : elle doit être déclarée en `ARG` dans le Dockerfile et passée par `build.args` dans le compose. Sur `main`, `Settings` compte 45 champs et le `.env.example` racine 11 variables.
**Échec / near miss** — La même erreur est arrivée deux fois dans la journée :
- #378 : `VITE_DEMO_PROFILES` a été ajoutée au code sans être passée au Dockerfile ni au compose ;
- #383 : `AUDIT_EXPORT_MAX_ROWS` a été ajoutée à `Settings` sans être reprise dans le bloc `environment` du service `api` ni dans le `.env.example` racine.
Dans les deux cas, la documentation décrit un réglage qui ne fait rien en Docker. L'application tourne avec la valeur par défaut, sans erreur ni avertissement.
**Cause racine** — Ajouter un réglage touche trois ou quatre fichiers (code, `.env.example`, compose, Dockerfile pour `VITE_*`). Rien ne relie ces fichiers. Les tests tournent hors Docker ou avec la valeur par défaut, donc ils restent verts. La seule barrière était la relecture : la grille de Q cite bien compose et `.env.example`, mais à la main.
**Classification** — Configuration ; défaut silencieux, attrapé en relecture avant la fusion ; **répété deux fois le même jour**. Une checklist existait déjà : il faut un contrôle automatique.
**Résolution** — Les deux PR, encore ouvertes, sont corrigées avant leur fusion. #378 passe la variable par le Dockerfile du frontend, le compose et les deux `.env.example`. #383 la reprend dans le compose et les deux `.env.example`.
**Prévention** — Un test CI de « parité de configuration », écrit dans #389 (`scripts/check-config-parity.py`, exceptions dans `scripts/config-parity-exceptions.txt`, tests dans `scripts/test_check_config_parity.py`, OK de Q en 3d3ad2e). Il est fusionné en premier en V1.1 : toute PR qui ajoute une variable passe ensuite ce contrôle. Ce qu'il vérifie :
1. **Inventaire** :
   - lire les champs de `Settings` dans `backend/app/core/config.py`, par analyse statique, sans importer l'application ;
   - lire les `import.meta.env.VITE_*` utilisés dans `frontend/`.
2. **Contrôles** :
   - chaque champ `Settings` est présent dans le `.env.example` racine et transmis par le compose au service qui le lit (`api` ou `worker`, ou les deux) ;
   - chaque `VITE_*` est présent dans le `.env.example`, déclaré en `ARG` dans le Dockerfile du frontend et passé par `build.args` dans le compose.
3. **Exceptions explicites** : un fichier versionné, une ligne par variable avec sa raison. Exemples : réglage interne à valeur fixe, variable fournie par la plateforme, variable propre aux tests. Une exception sans raison fait échouer le test.
4. **Reprise de l'existant** : au premier passage, les écarts actuels (environ 34 champs `Settings` absents du `.env.example`) sont triés un par un. Chacun est ajouté au compose et au `.env.example`, ou passe en exception justifiée. On ne met pas d'exception en masse sans tri.
5. **Périmètre d'exécution** : le test est un gate de la carte d'impact. Il se déclenche sur `config.py`, `docker-compose*.yml`, `.env.example`, le Dockerfile du frontend et tout fichier du frontend qui lit `import.meta.env`. Il tourne aussi en pre-commit, car il est rapide et ne dépend pas de Docker.
6. **Preuve que le test fonctionne** : un cas qui ajoute un champ factice à `Settings` sans le compose doit échouer, avec un message qui nomme la variable et le fichier à compléter.
**Leçon généralisée** — Un réglage existe pour l'utilisateur seulement s'il traverse tous les fichiers qui le transportent jusqu'au conteneur. Quand une erreur de liaison entre fichiers se répète, la checklist ne suffit plus : un test qui compare ces fichiers et n'accepte que des exceptions écrites doit la remplacer.

### LESSON-2026-066 — Motif `testMatch` sur une seule ligne : 30 PR V1.1 en conflit sur la même ligne

- **Date :** 2026-11-18
- **Catégorie :** testing / process
- **Statut :** resolved (dossier `frontend/e2e/unit/`)
- **Liens :** `frontend/playwright.unit.config.ts`, `frontend/e2e/unit/`, LESSON-2026-036

**Contexte** — Les specs purs étaient enregistrés dans une seule regex `testMatch` (ligne 7 de `playwright.unit.config.ts`).
**Échec / near miss** — Chaque PR qui ajoutait un spec pur modifiait cette même ligne : 30 PR V1.1 en conflit sur ce fichier, résolues une à une par union manuelle.
**Cause racine** — Un registre centralisé sur une ligne unique pour une liste qui grandit à chaque PR.
**Résolution** — Les specs purs vivent dans `frontend/e2e/unit/` ; la config pointe `testDir` sur ce dossier, sans `testMatch`. Liste des tests exécutés identique avant/après (nombre et noms, preuve dans la PR).
**Prévention** — Ajouter un spec pur = le créer dans `e2e/unit/`, sans toucher la config (commentaire en tête du fichier).
**Leçon généralisée** — Une liste que chaque contributeur allonge ne doit pas tenir sur une ligne partagée : préférer une convention (dossier, suffixe) à un registre.
