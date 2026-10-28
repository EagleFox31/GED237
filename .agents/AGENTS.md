# Règles de comportement des agents

## Suivi obligatoire dans Walkthrough

Avant de commencer toute tâche, l'agent doit créer un fichier Markdown :

- dans `walkthrough/` pour une tâche produit ou technique ;
- dans `gestion-projet/walkthrough/` pour une tâche de gouvernance ou de gestion.

Le nom identifie l'agent et la tâche :

```text
[Cursor] Nom de la tâche - AAAA-MM-JJ.md
[Claude] Nom de la tâche - AAAA-MM-JJ.md
[Gemini] Nom de la tâche - AAAA-MM-JJ.md
```

Cursor utilise obligatoirement le préfixe `[Cursor]`.

## Contenu avant exécution

Le fichier est créé avec le statut `EN COURS` et précise :

- ce qui va être fait ;
- pourquoi la tâche est réalisée ;
- comment elle sera exécutée ;
- le résultat attendu ;
- les fichiers ou zones concernés ;
- les vérifications prévues.

## Mise à jour après exécution

Avant d'annoncer la tâche terminée, l'agent met à jour le même fichier avec :

- le statut `DONE` ;
- ce qui a été trouvé ;
- ce qui a été modifié, fichier par fichier ;
- comment les modifications ont été réalisées ;
- le résultat observable maintenant ;
- les tests ou commandes exécutés et leurs résultats ;
- les limites, risques ou travaux restant à effectuer.

Une tâche ne peut pas être déclarée `DONE` sans preuve proportionnée au risque.
Si elle est interrompue, le statut devient `BLOQUÉ` ou `ABANDONNÉ`, avec la
cause et la prochaine action recommandée.

## Coordination et verrou logique (savoir qui fait quoi)

Le fichier `EN COURS` n'est pas qu'un journal : c'est un **signal d'occupation**.

**Avant de démarrer**, l'agent :

1. lit les deux dossiers de walkthrough (`walkthrough/` et
   `gestion-projet/walkthrough/`) et repère les fichiers encore `EN COURS` ;
2. relève les **fichiers / zones déclarés** par ces tâches en cours ;
3. ne démarre pas une tâche qui modifierait un fichier déjà déclaré `EN COURS`
   par un autre agent : il attend le passage `DONE` / `BLOQUÉ` / `ABANDONNÉ`, ou
   choisit une autre tâche, ou se coordonne via le Product Owner.

**Le fichier `EN COURS` liste explicitement les fichiers/zones qu'il va modifier.**
Cette liste vaut **verrou** : les autres agents évitent ces fichiers jusqu'à la
clôture. Un seul agent modifie un fichier à la fois (rappel `REGLES_DE_TRAVAIL`
§2). Un agent ne modifie pas le fichier de walkthrough d'un autre agent ; il ne
peut que signaler un conflit dans le sien.

**Règles anti-collision :**

- le fichier de walkthrough est créé **avant** toute lecture ou modification liée
  à la tâche ; un compte rendu `DONE` **rétroactif** n'est toléré qu'une seule
  fois, pour amorcer la règle, jamais comme fonctionnement normal ;
- si deux tâches d'un même agent portent la même date, ajouter un court suffixe
  d'heure `HHhMM` ou un slug au nom de fichier pour garder l'unicité ;
- un statut `EN COURS` laissé sans mise à jour après interruption doit passer à
  `BLOQUÉ` (sur quoi + prochaine action) pour libérer le verrou ;
- avant d'annoncer `DONE`, l'agent revérifie qu'aucun autre agent n'a modifié
  ses fichiers verrouillés entre-temps ; toute divergence est signalée.

## Standard d'ingénierie RAIDER (obligatoire)

GED237 applique RAIDER (source canonique : `EagleFox31/project-registry` → `RAIDER.md`).
Déclinaison projet : [`RAIDER.md`](../RAIDER.md). Avant une évolution structurante
(architecture, migration, intégration, CI/CD, données) :

1. relire [`RAIDER.md`](../RAIDER.md) et chercher dans
   [`DOCS/engineering/lessons-learned.md`](../DOCS/engineering/lessons-learned.md) ;
2. **reuse-first** : évaluer l'existant et noter Adopt / Adapt / Learn / Build dans le walkthrough ;
3. échec ou near miss significatif → entrée dans `lessons-learned.md` (cause racine + prévention vérifiable) ;
4. walkthrough `DONE` et PR : checklist RAIDER (couvert / non applicable / dérogation justifiée).

## Validation d'un travail (Definition of Done)

Un travail n'est `DONE` (niveau Vérifié) qu'après ses tests, proportionnés au
risque et couvrant les niveaux pertinents :

- **tests unitaires** — logique isolée (services, moteurs de règles, utils) ;
- **tests d'intégration** — DB réelle, sessions, migrations, dépendances ;
- **tests de contrat** — schémas API request/response, codes HTTP, compat
  front/back ;
- **tests e2e** — parcours utilisateur bout en bout (Playwright), non mockés.

Pour un **parcours critique GED237, les quatre niveaux sont requis**. « Ça
compile » ne prouve pas un parcours métier. Détail :
`gestion-projet/REGLES_DE_TRAVAIL.md` §8.
