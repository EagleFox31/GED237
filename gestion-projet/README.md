# Gestion de projet GED237

Ce dossier centralise les analyses, plans d'action et décisions utiles au pilotage
de GED237. Il ne remplace ni le backlog de développement ni la source de vérité
technique du dépôt.

## Sources de vérité

L'ordre de confiance est le suivant :

1. le code et les résultats de commandes exécutées sur l'environnement courant ;
2. [`../AUDIT.md`](../AUDIT.md), document autoritatif sur l'état réel du projet ;
3. les audits datés présents dans `walkthrough/` ;
4. les plans d'action, qui décrivent un travail proposé et non un travail livré ;
5. les documents de conception, qui décrivent une cible.

Un plan, une case cochée ou une affirmation d'agent ne constitue jamais, seul,
une preuve d'implémentation.

## Contenu actuel

- [`plan-gemini.md`](plan-gemini.md) : plan proposé pour traiter trois écarts
  fonctionnels et de finition avant le 27 juillet 2026.
- [`walkthrough/[Claude] Audit technique GED237 - 2026-07-22.md`](walkthrough/%5BClaude%5D%20Audit%20technique%20GED237%20-%202026-07-22.md) :
  audit technique daté, accompagné de commandes et de résultats.
- [`REGLES_DE_TRAVAIL.md`](REGLES_DE_TRAVAIL.md) : règles communes au Product
  Owner, à Claude, à Gemini et aux contributeurs humains.
- [`ANALYSE_PO_PHASE_CONCEPTION.md`](ANALYSE_PO_PHASE_CONCEPTION.md) : lecture
  consolidée des 17 documents de conception, de leur fiabilité et des décisions
  encore ouvertes.
- [`MATRICE_TRACABILITE_PRODUIT.md`](MATRICE_TRACABILITE_PRODUIT.md) : liaison
  entre promesses, personas, routes, preuves, statuts et backlog de décisions PO.
- [`[Claude] RACI + Roadmap GED237.md`](%5BClaude%5D%20RACI%20%2B%20Roadmap%20GED237.md) :
  modèle de collaboration à trois acteurs — PO, Claude et Gemini.
- [`PLAN_EXECUTION_GED237_2026-07-22.md`](PLAN_EXECUTION_GED237_2026-07-22.md) :
  roadmap ordonnée, tâches attribuées, livrables et Definition of Done.
- [`PERT_EXECUTION_GED237_2026-07-22.md`](PERT_EXECUTION_GED237_2026-07-22.md) :
  dépendances, parallélisme, jalons et chemin critique vers le Go/No-Go pilote.
- [`MATRICE_UAT_E2E_2026-07-22.md`](MATRICE_UAT_E2E_2026-07-22.md) :
  traçabilité des 37 scénarios UAT vers les specs Playwright, collisions d'IDs
  et backlog de fermeture.
- [`DECISION_OTP_2026-07-22.md`](DECISION_OTP_2026-07-22.md) :
  options MFA du pilote, recommandation TOTP/SMS local, critères d'acceptation
  et décisions commanditaire encore requises.
- [`INVENTAIRE_TESTS_API_2026-07-22.md`](INVENTAIRE_TESTS_API_2026-07-22.md) :
  couverture API constatée par lecture et cas prioritaires pour T12–T13.
- [`PROPOSITIONS_EVOLUTION_GEMINI.md`](PROPOSITIONS_EVOLUTION_GEMINI.md) :
  opportunités AIGLES, délégations, complétude et vérification publique, à
  traiter en Discovery après stabilisation.

## Analyse consolidée

### Convergences confirmées

Les deux documents identifient les mêmes trois chantiers :

1. enrichir `GET /api/v1/spaces/documents` avec les filtres métier côté serveur ;
2. créer une couverture API pour le module Rapports ;
3. supprimer ou corriger la référence morte à `/index.css`.

Ces trois points concordent également avec `AUDIT.md`. Ils sont donc pertinents,
mais leur ordre d'exécution doit tenir compte des risques opérationnels.

### Écart majeur de priorisation

Le plan Gemini commence directement par les améliorations fonctionnelles. L'audit
Claude signale deux risques plus urgents :

- une quantité importante de travail qui aurait été non versionnée au moment de
  l'audit ;
- des environnements virtuels Python provenant d'autres postes, empêchant
  l'exécution fiable de `pytest`.

Ces constats sont datés du 22 juillet 2026. Ils doivent être revérifiés avant
action, car l'état Git et l'environnement local peuvent avoir changé.

### Différences de comptage

Les documents ne donnent pas tous les mêmes nombres de routes et de tests.
`AUDIT.md` indique 117 routes et 118 fonctions pytest, tandis que l'audit Claude
annonce 122 routes et 119 fonctions. Cette divergence peut provenir du moment ou
de la méthode de comptage. Les chiffres doivent toujours être accompagnés de la
commande, du périmètre et de la date.

## Priorités consolidées

### P0 — Sécuriser avant de modifier

1. Relever l'état Git courant et confirmer que le travail utile est sauvegardé.
2. Vérifier que `venv/` et `.venv/` ne sont pas suivis et recréer un environnement
   Python local si nécessaire.
3. Confirmer les révisions Alembic appliquées sur les bases utilisées.

### P1 — Restaurer une preuve de qualité

1. Préparer PostgreSQL et Redis de test.
2. Exécuter la suite pytest complète.
3. Ajouter les tests API Rapports, puis couvrir les modules critiques non testés.

### P2 — Fermer les écarts V1

1. Trancher le contrat serveur de l'explorateur documentaire.
2. Implémenter les filtres et la pagination retenus.
3. Retirer la référence `/index.css` et revalider le build.
4. Planifier le découpage du bundle frontend sans le mélanger aux correctifs
   fonctionnels.

## Statuts documentaires

Chaque action doit utiliser un seul de ces statuts :

- **Proposé** : idée ou plan non validé ;
- **Décidé** : arbitrage explicite du Product Owner ;
- **En cours** : travail commencé et responsable identifié ;
- **Implémenté** : code présent, mais validation pas nécessairement terminée ;
- **Vérifié** : preuve d'exécution enregistrée ;
- **Bloqué** : obstacle et prochaine action documentés ;
- **Abandonné** : décision et justification conservées.

## Règle de mise à jour

Les audits et plans datés restent immuables afin de préserver l'historique. Une
nouvelle observation crée un nouveau livrable daté ou met à jour `AUDIT.md`
conformément aux règles du dépôt. Les décisions et changements de statut doivent
être reportés dans le backlog ou le document de pilotage actif.
