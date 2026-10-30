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
