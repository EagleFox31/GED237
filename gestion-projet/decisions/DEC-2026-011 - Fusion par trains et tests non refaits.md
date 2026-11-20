# DEC-2026-011 : fusion par « trains » et tests non refaits sur un contenu identique

- **Date** : 19/11/2026, 12:27 (réponse directe du PO, relayée par O).
- **Statut** : décidé par le PO ; procédure à valider par O.

## Décisions

1. **Fusion par trains.** O réunit sur une branche les PR prêtes (CI verte et OK de Q pour chacune), les teste **une seule fois** ensemble, puis fusionne le train. `main` reçoit le contenu exact qui a été testé. La règle « branche à jour » sur `main` reste. Si le train est rouge, O retire la PR fautive et relance.
2. **Tests non refaits.** `main` ne rejoue plus les tests d'un contenu identique déjà validé dans la PR (comparaison de l'empreinte du contenu). Q prépare la PR, B la relit.

3. **Tests du serveur découpés en 4 parts parallèles** (décision du PO, 19/11, 12:45). B écrit la PR, Q la relit. Cible : 16 min aujourd'hui, environ 6 min ensuite ; la limite de 15 min était dépassée de 3 secondes. La suite « ne plus reconstruire la base à chaque test » est renvoyée après l'UAT.
4. **#489 (Q, OK de B)** : `main` ne reteste plus un contenu identique déjà validé, fusion dès CI verte. Un train, lui, passe toujours en complet sur `main` tant que ce cas n'est pas couvert.
5. **Mode de poussée d'un train** (O, 12:50) : PR ordinaire train vers `main`, fusionnée par `gh pr merge --merge`, jamais par push direct ; la protection de `main` ne change pas.
## Écartés, et pourquoi

- **File de fusion GitHub** : réservée aux organisations ; le dépôt est sur un compte personnel.
- **File tierce** : application externe avec droit d'écriture, trop de nouveauté avant la recette.
- **Lever la règle « branche à jour »** : refusé par le PO.

## Mise en œuvre

Procédure en 10 points, ordre des trains V1.1 et conflits simulés : `gestion-projet/innovateur/procedure-trains-fusion.md`. Mode de poussée : point 5.

Le découpage des tests du serveur est décidé (point 3).
