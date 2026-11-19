# DEC-2026-011 : fusion par « trains » et tests non refaits sur un contenu identique

- **Date** : 19/11/2026, 12:35 (réponse directe du PO, relayée par O).
- **Statut** : décidé par le PO ; procédure à valider par O.

## Décisions

1. **Fusion par trains.** O réunit sur une branche les PR prêtes (CI verte et OK de Q pour chacune), les teste **une seule fois** ensemble, puis fusionne le train. `main` reçoit le contenu exact qui a été testé. La règle « branche à jour » sur `main` reste. Si le train est rouge, O retire la PR fautive et relance.
2. **Tests non refaits.** `main` ne rejoue plus les tests d'un contenu identique déjà validé dans la PR (comparaison de l'empreinte du contenu). Q prépare la PR, B la relit.

## Écartés, et pourquoi

- **File de fusion GitHub** : réservée aux organisations ; le dépôt est sur un compte personnel.
- **File tierce** : application externe avec droit d'écriture, trop de nouveauté avant la recette.
- **Lever la règle « branche à jour »** : refusé par le PO.

## Mise en œuvre

Procédure en 10 points, ordre des trains V1.1 et conflits simulés : `gestion-projet/innovateur/procedure-trains-fusion.md`. Mode de poussée sur `main` (protection de branche) : à confirmer par O et Q avant le 24/11.

Pour mémoire, B écrit une proposition de découpage des tests du serveur (16 min aujourd'hui) ; rien n'est décidé.
