# DEC-2026-013 : trois correctifs d'écran entrent dans `main` pour l'UAT du 23, après la coupe

- **Date** : 19/11/2026, vers 14:57 (décision directe du PO, relayée par O).
- **Statut** : décidé par le PO. Exécution : Q (preuve sur `main`), O (re-ciblage et fusion), F (V1.1).
- **Dérogation** : à la règle « PR V1.1 à partir du 24/11 », pour ces trois PR seulement.

## Constat

Le 19/11, l'outil d'audit UX (G) a joué la journée d'un fonctionnaire pressé sur `main` = f890b3cb, en 1366×768. Il relève 6 frictions. L'instruction de l'innovateur a vérifié, dans le code des PR, celles qui sont déjà couvertes :

| Friction | PR | Poids pour l'UAT |
|---|---|---|
| Bouton « Envoyer » de la fenêtre de dépôt sous le bas de l'écran | #450, empilée sur #441 (clavier) | gênant à bloquant |
| Pas de compteur sur « Tâches » | #442 (base `main`, autonome) | gênant |
| Document rejeté : motif absent de la carte, pas de bouton « Corriger / resoumettre », pas de filtre « Rejeté » | serveur #438, filtre #440, bandeau #455 ; **aucune PR pour la carte et le bouton** | bloquant si l'UAT joue un rejet |
| Recherche sans accent (« decret ») sans résultat | #436 (migration) ; #457 l'embarque avec #445 | gênant |
| Aucun message après un dépôt ou une soumission ; « Soumettre » absent de « Mes Documents » | aucune | gênant |
| Valideur et institution non mémorisés | #362, #359 (en conflit) | confort |
| Expéditeur absent du parapheur ; confirmation sur un écran de visa et pas sur l'autre | #466 pour « Tâches » seulement | gênant |

Le score CDC ne change pas (30/32 avant la lecture C6).

## Décisions

1. **#441, #450 et #442 entrent dans `main` pour l'UAT du 23.** Ce sont des PR d'écran, sans migration, avec un OK de Q (#450 0638e016, #442 c294453d).
2. **Fusion seulement après la décision de coupe de ce soir**, une par une. Chacune exige une nouvelle preuve de Q sur `main`.
3. **Ordre** : #441, puis re-ciblage de #450 sur `main`, puis #450, puis #442.
4. **Si la coupe a lieu ce soir**, ces trois PR ne sont pas dans la V1.0 coupée. L'UAT les voit sur `main`.
5. **Les autres frictions partent en V1.1 chez F dès maintenant.** La première est le motif sur la carte et le bouton « Corriger / resoumettre », à poser sur le serveur de #438.
6. **Le script d'UAT annonce les frictions restantes comme connues** (`gestion-projet/recette/checklist-recette-20-23-11.md`, § 6). Les testeurs ne les notent pas en KO.

## Ce que l'utilisateur voit

- Pendant l'UAT : le bouton « Envoyer » reste visible sur un écran d'ordinateur portable, et le menu « Tâches » affiche le nombre de tâches en attente.
- Dans la V1.0 coupée : ni l'un ni l'autre, tant qu'un correctif n'est pas recopié sur la release.

## Risques

- **L'UAT ne porte plus exactement sur le SHA coupé.** L'écart se limite à ces trois PR d'écran. Il est noté dans le relevé de l'UAT.
- **Ordre d'empilement** : #450 et #484 (badges lisibles, V1.1) sont empilées sur #441. O les re-cible sur `main` **avant** de fusionner #441 (signal de Q, règle des PR empilées). #484 reste en V1.1 : seul son re-ciblage est avancé.
- **Rien n'est fusionné avant la lecture C6 de 18:00**, qui fixe le SHA de la coupe.

## Suites

- Q : preuve sur `main` de chaque PR avant sa fusion.
- O : fusion dans l'ordre de la décision 3. #441, #450 et #442 sortent de la file V1.1 (`innovateur/file-v1.1.md`).
- F : en V1.1, d'abord le motif sur la carte et le bouton « Corriger / resoumettre », puis les autres frictions.
- I : section 6 de la checklist d'UAT ajustée.
