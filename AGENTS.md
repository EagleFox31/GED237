# AGENTS.md — GED237

> **Source de vérité canonique : [`.agents/AGENTS.md`](.agents/AGENTS.md).**
> Ce fichier racine est une **exposition** pour l'auto-découverte par les runners
> d'agents (Cursor, Claude, Gemini, …). En cas de doute, `.agents/AGENTS.md` fait
> foi ; **garder les deux synchronisés** lors de toute évolution de la règle.

## Rôles (résumé)

- **Cursor — Product Owner** : décide périmètre, priorités, Go/No-Go.
- **Claude — Tech Lead / QA** : implémente et **prouve** (tests, recette technique).
- **Gemini — Product Analyst** : Discovery, recherche sourcée, traçabilité, revue
  indépendante en **lecture seule** sur le code.

Détail : `gestion-projet/[Claude] RACI + Roadmap GED237.md`, `gestion-projet/REGLES_DE_TRAVAIL.md`.

## Suivi obligatoire dans Walkthrough

**Avant de commencer toute tâche**, l'agent crée un fichier Markdown :

- dans `walkthrough/` pour une tâche produit ou technique ;
- dans `gestion-projet/walkthrough/` pour une tâche de gouvernance.

Nom : `[Cursor|Claude|Gemini] Nom de la tâche - AAAA-MM-JJ.md`.

**Contenu avant exécution** (statut `EN COURS`) : ce qui va être fait ; pourquoi ;
comment ; résultat attendu ; **fichiers/zones concernés (= verrou)** ; vérifications
prévues.

**Mise à jour après exécution** (statut `DONE`) : ce qui a été trouvé ; ce qui a été
modifié, **fichier par fichier** ; comment ; résultat observable maintenant ; **tests
ou commandes exécutés et leurs résultats** ; limites / risques / reste à faire.

Statuts : `EN COURS` · `DONE` · `BLOQUÉ` · `ABANDONNÉ`. Une tâche n'est jamais
`DONE` sans preuve proportionnée au risque.

## Coordination et verrou logique (savoir qui fait quoi)

Le fichier `EN COURS` est un **signal d'occupation**. Avant de démarrer, l'agent :

1. lit `walkthrough/` **et** `gestion-projet/walkthrough/` et repère les fichiers
   encore `EN COURS` ;
2. relève les **fichiers/zones déclarés** par ces tâches en cours ;
3. ne modifie **pas** un fichier déjà déclaré `EN COURS` par un autre agent
   (attendre `DONE`/`BLOQUÉ`, choisir une autre tâche, ou se coordonner via le PO).

Un seul agent modifie un fichier à la fois. Un agent ne modifie pas le walkthrough
d'un autre. `DONE` rétroactif toléré **une seule fois** (amorçage). Revérifier
l'absence de modification concurrente sur ses fichiers verrouillés avant `DONE`.

## Standard d'ingénierie RAIDER (obligatoire)

GED237 applique RAIDER (source canonique : `EagleFox31/project-registry` → `RAIDER.md`).
Déclinaison projet : [`RAIDER.md`](RAIDER.md). Avant une évolution structurante
(architecture, migration, intégration, CI/CD, données) :

1. relire [`RAIDER.md`](RAIDER.md) et chercher dans
   [`DOCS/engineering/lessons-learned.md`](DOCS/engineering/lessons-learned.md) ;
2. **reuse-first** : évaluer l'existant et noter Adopt / Adapt / Learn / Build dans le walkthrough ;
3. échec ou near miss significatif → entrée dans `lessons-learned.md` (cause racine + prévention vérifiable) ;
4. walkthrough `DONE` et PR : checklist RAIDER (couvert / non applicable / dérogation justifiée).

## Validation d'un travail (Definition of Done)

Un travail n'est `DONE` qu'après ses tests, proportionnés au risque : **tests
unitaires**, **tests d'intégration**, **tests de contrat**, **tests e2e**
(Playwright, non mockés). Les **quatre sont requis pour un parcours critique
GED237** ; « ça compile » ne prouve pas un parcours métier. Détail :
`gestion-projet/REGLES_DE_TRAVAIL.md` §8.

---

*Règle complète, statuts détaillés et anti-collision : [`.agents/AGENTS.md`](.agents/AGENTS.md).*
