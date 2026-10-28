# [Cursor] Règle de suivi Walkthrough — 2026-07-22

> Statut : DONE
> Agent : Cursor
> Note : ce premier compte rendu est créé rétroactivement, car la règle de
> création préalable n'existait pas encore au début de cette tâche.

## Intention

### Ce qui devait être fait

Mettre à jour la règle persistante des agents afin que toute tâche soit annoncée
et clôturée dans un fichier Markdown de walkthrough portant le nom de l'agent.

### Pourquoi

Conserver une trace lisible des intentions, modifications, résultats et preuves
produites par Cursor, Claude et Gemini.

### Méthode prévue

- lire la règle existante ;
- la généraliser aux trois agents ;
- imposer le préfixe `[Cursor]` pour Cursor ;
- définir les contenus obligatoires avant et après exécution.

### Résultat attendu

Une règle claire empêchant de déclarer une tâche terminée sans compte rendu ni
preuve.

### Fichier concerné

- `.agents/AGENTS.md`

### Vérification prévue

- relire le fichier après modification ;
- vérifier que les statuts `EN COURS`, `DONE`, `BLOQUÉ` et `ABANDONNÉ` sont
  définis ;
- vérifier que les trois préfixes d'agents sont documentés.

## Résultat

### Ce qui a été trouvé

La règle existante imposait déjà un walkthrough, mais uniquement avec le préfixe
`[Gemini]` et sans modèle complet pour les tâches bloquées ou abandonnées.

### Ce qui a été modifié

`.agents/AGENTS.md` a été généralisé à Cursor, Claude et Gemini. La règle précise
désormais :

- le dossier à utiliser selon le type de tâche ;
- la nomenclature avec agent et date ;
- le contenu obligatoire avant exécution ;
- le compte rendu obligatoire après exécution ;
- les statuts et la preuve nécessaire avant `DONE`.

### Résultat observable

Les prochaines tâches de Cursor devront commencer par un fichier
`[Cursor] ... - AAAA-MM-JJ.md` dans le walkthrough adapté, puis mettre à jour ce
même fichier avant clôture.

### Tests et contrôles

- lecture de `.agents/AGENTS.md` avant modification ;
- application de la règle dans ce compte rendu ;
- aucune commande ou test logiciel requis pour ce changement documentaire.

### Limites

Le présent fichier est rétroactif. À partir de la prochaine tâche, le fichier de
walkthrough devra réellement être créé avant toute analyse ou modification.
