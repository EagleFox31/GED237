# [Cursor] Préparation T07, T08, T12 et T13 — 2026-07-23

> Statut : DONE
> Agent : Cursor
> Début : 2026-07-23 02:14 UTC+1
> Fin : 2026-07-23 02:14 UTC+1

## Ce qui va être fait

Transformer les résultats d'exploration des sous-agents en livrables de
gouvernance utilisables pour :

- la traçabilité UAT ↔ Playwright ;
- l'arbitrage du canal OTP ;
- la préparation des tests API Rapports et modules critiques.

## Pourquoi

Le PERT attribue T07 et T08 à Gemini, puis T12 et T13 à Claude. Les explorations
étaient disponibles, mais pas encore matérialisées dans `gestion-projet`.

## Comment

- consolider les constats sans annoncer d'exécution non réalisée ;
- distinguer couverture écrite, preuve exécutée et décision PO ;
- attribuer les actions entre PO, Claude et Gemini ;
- indexer les documents dans le README.

## Résultat attendu

Trois documents datés, actionnables et reliés au PERT.

## Fichiers concernés

- `gestion-projet/MATRICE_UAT_E2E_2026-07-22.md`
- `gestion-projet/DECISION_OTP_2026-07-22.md`
- `gestion-projet/INVENTAIRE_TESTS_API_2026-07-22.md`
- `gestion-projet/README.md`

## Vérifications prévues

- présence des documents ;
- cohérence des statuts ;
- aucune tâche de code déclarée terminée ;
- aucune décision OTP présentée comme acquise ;
- liens valides dans l'index.

## Résultat

### Ce qui a été trouvé

- la couverture Playwright contient des collisions d'identifiants et plusieurs
  parcours critiques partiels ou absents ;
- l'OTP existe comme challenge Redis, mais aucun canal pilote complet n'est
  implémenté ;
- plusieurs modules API critiques n'ont pas de fichier de test dédié ;
- Search, Spaces, Usage et Notifications présentent des risques de scope à
  confirmer par tests.

### Ce qui a été modifié

- création d'une matrice UAT ↔ E2E avec backlog P0/P1/P2 ;
- création d'un dossier de décision OTP avec options, recommandation et
  questions commanditaire ;
- création d'un inventaire API avec cas prioritaires pour T12 et T13 ;
- ajout des trois livrables à l'index de gestion de projet.

### Comment

Les contenus ont été synthétisés depuis les explorations du code, des specs
Playwright et des sources officielles. Les affirmations non exécutées portent
explicitement le statut « vérifié par lecture ».

### Résultat observable maintenant

- T07 dispose d'une première matrice, mais nécessite l'arbitrage des IDs ;
- T08 dispose d'un dossier proposé, mais nécessite les réponses commanditaire ;
- T12 et T13 disposent d'un backlog de tests prêt pour Claude après T06.

### Tests et contrôles

- relecture de cohérence documentaire ;
- contrôle des statuts et handoffs ;
- aucun test logiciel exécuté, car cette tâche ne modifie pas le produit.

### Limites et travaux restants

- exécuter Playwright pour transformer la couverture écrite en preuve ;
- valider le canal OTP et les contraintes RH/infrastructure ;
- exécuter T06 avant de démarrer T12 et T13 ;
- faire valider les comportements API attendus par le PO et Claude.
