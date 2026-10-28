# Règles de travail — GED237

Ces règles s'appliquent aux analyses, plans, handoffs et décisions déposés dans
`gestion-projet/`. Elles complètent `CLAUDE.md` sans le remplacer.

## 1. Responsabilités

### Product Owner

- fixe le problème à résoudre, le résultat attendu et l'ordre du backlog ;
- arbitre le périmètre, les compromis et les décisions métier ;
- accepte ou refuse le résultat à partir de critères explicites ;
- ne prescrit pas seul la solution technique.

### Claude Code

- intervient par défaut sur l'analyse technique approfondie, l'architecture, les
  changements multi-fichiers et la vérification de production ;
- recherche les causes racines, documente les risques et fournit les preuves
  d'exécution ;
- ne transforme pas une hypothèse en fait.

### Gemini CLI — Product Analyst & Frontend Explorer

- intervient par défaut sur l'exploration large, la recherche documentaire, les
  options de solution, les prototypes et la seconde opinion ;
- cartographie le frontend : routes, menus, composants, appels API, dépendances,
  pages orphelines et écarts avec les parcours attendus ;
- analyse l'UX, le responsive et l'accessibilité, puis prépare les scénarios
  Playwright et les options de découpage ;
- cite ses sources et sépare clairement observation, déduction et proposition ;
- travaille en lecture seule sur le code de production sauf attribution
  explicite ; Claude reste redevable de l'architecture et de l'intégration ;
- ne déclare pas un changement livré après avoir seulement produit un plan ou
  une cartographie.

### Contrôle croisé

- l'agent qui n'a pas produit le changement examine les risques et cas oubliés ;
- l'auteur répond aux constats ou corrige avant présentation au Product Owner ;
- une revue IA ne remplace jamais les tests ni la validation humaine.

## 2. Workflow obligatoire

1. **Cadrer** : objectif, hors périmètre, critères d'acceptation et risques.
2. **Observer** : lire le code et les sources de vérité avant de proposer.
3. **Planifier** : découper les tâches non triviales et identifier les décisions.
4. **Attribuer** : un responsable unique par tâche et par fichier modifié.
5. **Exécuter** : changement minimal, sans nettoyage adjacent non demandé.
6. **Vérifier** : tests ciblés, puis contrôles proportionnés au risque.
7. **Revoir** : contrôle croisé pour sécurité, migrations et changements métier.
8. **Rendre compte** : résultat, preuves, limites, fichiers touchés et suite.

Deux agents ne modifient pas simultanément le même fichier. Le second agent
travaille en lecture seule jusqu'au handoff.

## 3. Niveaux de preuve

Toute affirmation importante porte l'un des niveaux suivants :

- **Vérifié** : commande réussie ou comportement reproduit, avec date et résultat ;
- **Constaté** : présent dans le code, avec fichier et lignes ;
- **Documenté** : présent dans une source, sans preuve runtime ;
- **Déduit** : conclusion argumentée à confirmer ;
- **Proposé** : option non décidée.

Les mots « terminé », « corrigé », « fonctionnel » et « prêt » exigent une preuve
de niveau **Vérifié**. Une compilation réussie ne prouve pas un parcours métier.

## 4. Format commun des livrables

Chaque nouveau rapport ou plan commence par :

```markdown
# [Auteur] Type de livrable — Sujet — AAAA-MM-JJ

> Statut : Proposé | Décidé | En cours | Vérifié | Bloqué | Abandonné
> Auteur :
> Date :
> Objectif :
> Périmètre :
> Sources :
> Environnement :
```

Le corps contient au minimum :

1. synthèse ;
2. constats et niveaux de preuve ;
3. risques et impacts utilisateur ;
4. décisions attendues du Product Owner ;
5. actions ordonnées ;
6. vérifications exécutées et résultats ;
7. limites ou travaux non réalisés.

## 5. Nommage et rangement

- plans : `plans/[Auteur] sujet - AAAA-MM-JJ.md` ;
- audits et comptes rendus : `walkthrough/[Auteur] sujet - AAAA-MM-JJ.md` ;
- décisions : `decisions/DEC-AAAA-NNN - sujet.md` ;
- ne pas écraser un audit daté pour faire disparaître une ancienne conclusion ;
- les noms de fichiers et contenus sont en français clair, encodés en UTF-8.

Les dossiers `plans/` et `decisions/` sont créés lorsqu'un premier livrable de ce
type doit effectivement y être enregistré.

## 6. Sources de vérité et conflits

1. Le code et les commandes exécutées sur l'environnement courant priment.
2. `AUDIT.md` reste la source autoritative sur l'état global du dépôt.
3. Un audit daté peut signaler une divergence, mais ne remplace pas silencieusement
   `AUDIT.md`.
4. Un plan décrit une intention ; seul le code vérifié décrit une livraison.
5. En cas de désaccord Claude/Gemini, conserver les deux analyses, comparer les
   preuves et soumettre l'arbitrage au Product Owner.

## 7. Sécurité et opérations

- ne jamais afficher ou versionner secrets, `.env`, jetons ou identifiants réels ;
- ne jamais exécuter une commande destructive sans autorisation humaine explicite ;
- ne pas créer de commit ni pousser vers un remote sans demande explicite ;
- vérifier l'isolation `tenant_id` et l'autorisation Casbin pour toute nouvelle API ;
- après une migration, exécuter `alembic upgrade head` sur chaque base concernée,
  notamment `edossier` et `test_ged`, puis vérifier le head ;
- ne jamais versionner `venv/`, `.venv/`, caches, builds ou données locales.

## 8. Definition of Done

Une tâche n'est **Vérifiée** que si :

- les critères d'acceptation sont satisfaits ;
- les tests de validation passent, proportionnés au risque et couvrant les
  niveaux pertinents parmi :
  - **tests unitaires** — logique isolée (services, moteurs de règles, utils) ;
  - **tests d'intégration** — DB réelle, sessions, migrations, dépendances ;
  - **tests de contrat** — schémas API request/response, codes HTTP, compat
    front/back ;
  - **tests e2e** — parcours utilisateur bout en bout (Playwright), non mockés ;
- typecheck, build ou compilation pertinents passent ;
- les migrations sont appliquées et contrôlées lorsqu'elles existent ;
- les erreurs introduites ont été corrigées ;
- les limites restantes sont documentées ;
- le Product Owner dispose d'une preuve compréhensible.

Pour un **parcours critique GED237, les quatre niveaux ci-dessus (unitaire,
intégration, contrat, e2e) sont requis**, plus une recette bout en bout avec le
rôle, le tenant, les données d'entrée, le résultat attendu et la trace d'audit.

## 9. Handoff entre collaborateurs

Le passage de relais contient :

```markdown
## Handoff
- Objectif :
- État exact :
- Fichiers lus ou modifiés :
- Commandes exécutées :
- Résultats :
- Hypothèses restantes :
- Risques :
- Prochaine action recommandée :
```

Le destinataire relit les fichiers actuels et ne suppose pas que le résumé est à
jour. Toute divergence entre le handoff et le dépôt est signalée immédiatement.
