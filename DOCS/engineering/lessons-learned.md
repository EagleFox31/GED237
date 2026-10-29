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
- **Statut :** captured
- **Liens :** `CLAUDE.md` § Lessons récentes

**Contexte** — Fonctionnalité livrée avec une nouvelle table (migration Alembic).
**Échec / near miss** — Base cible non migrée : `UndefinedTableError` → HTTP 500, affiché
côté client comme une erreur réseau ou générique, ce qui oriente mal le diagnostic.
**Cause racine** — Aucune vérification que le schéma de la base est à `head` au démarrage
ou en CI ; la migration dépend d'une action manuelle par environnement (`edossier`, `test_ged`).
**Résolution** — `alembic upgrade head` sur chaque base utilisée.
**Prévention** — Actuellement un rappel documentaire (insuffisant selon RAIDER). À ajouter :
contrôle « schéma à jour » (ex. `alembic check` / comparaison `current` vs `head`) en CI et
au démarrage de l'API, avec message d'erreur explicite.
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
- **Statut :** captured
- **Liens :** commit `chore: normalize line endings to LF…` (lot A)

**Contexte** — Consolidation de deux mois de travail fait sous Windows.
**Échec / near miss** — Des fichiers entiers apparaissaient modifiés (CRLF ↔ LF), masquant les vrais changements et rendant la revue impossible.
**Cause racine** — `core.autocrlf` variable selon les postes, pas de normalisation imposée par le dépôt.
**Résolution** — Commit dédié de normalisation LF, isolé des commits fonctionnels.
**Prévention** — À faire : `.gitattributes` (`* text=auto eol=lf`) suivi d'un commit `git add --renormalize` isolé. En attendant : un commit de normalisation est toujours séparé.
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
