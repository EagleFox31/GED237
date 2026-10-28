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
