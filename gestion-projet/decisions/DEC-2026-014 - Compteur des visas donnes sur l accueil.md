# DEC-2026-014 : l'accueil montre aussi les visas que j'ai donnés (#329)

- **Date** : 19/11/2026, vers 15:55 (décision directe du PO, relayée par O).
- **Statut** : décidé par le PO. Exécution : B (serveur, PR brouillon à part, après son lot), F (affichage), Q (preuve).
- **Question instruite** : `innovateur/question-po-compteur-visas-329.md`. Le PO a choisi « Ajouter aussi les visas que j'ai donnés ».

## Constat

- Dans #329 (tendances de l'élément 10), la portée « mine » compte les visas rendus **sur les documents de l'utilisateur**.
- Les visas qu'il pose sur les documents des autres ne sont pas comptés.
- Le visa d'un auteur sur son propre document est compté comme « reçu ».
- Le CDC dit seulement « Tableau de bord de suivi (doublons, fichiers non classés, activités) ».

## Décisions

1. **On garde la courbe « Mes documents visés / rejetés ou renvoyés »** (visas reçus sur mes documents).
2. **Le visa de l'auteur sur son propre document est exclu** de cette courbe : une ligne pour B dans #329, plus un test.
3. **On ajoute une deuxième courbe, « Visas que j'ai donnés »** : les visas posés par l'utilisateur sur les documents des autres. Spec ci-dessous.
4. **Pas de report pour une question de charge.** B la fait dans une PR brouillon à part, après son lot. Elle entre en V1.1 si elle est prouvée par Q avant le 05/12 ; sinon, elle part en V1.3.

## Spec de la courbe « Visas que j'ai donnés »

**Ce qu'on compte** : les lignes de `WorkflowAction` qui remplissent toutes ces conditions :
- `performed_by` = l'utilisateur connecté ;
- le document n'est pas le sien : `Document.owner_id` ≠ l'utilisateur ;
- `outcome` dans `accepted`/`acknowledged` (trait « Acceptés ») ou dans `rejected`/`returned` (trait « Rejetés ou renvoyés »), comme les courbes existantes ;
- même `tenant_id` ; documents supprimés exclus (`deleted_at IS NULL`).

**Période et règles** : identiques à l'élément 10. 12 semaines, du lundi au dimanche, heure de Douala, semaines vides à 0 complétées par le serveur.

**Portée** : `scope=mine` seulement. Les portées `unit` et `tenant` ne changent pas.

**Contrat pour B** : deux séries ajoutées à la réponse de `GET /api/v1/analytics/trends?scope=mine` :

```json
"series": {
  "…": "…",
  "visas_given_accepted": [0, 2, 1, "…"],
  "visas_given_rejected_or_returned": [0, 0, 1, "…"]
}
```

Absentes pour `unit` et `tenant`. Aucun champ existant ne change : l'ajout est rétrocompatible.

**Tests attendus** :
- un visa donné sur le document d'un collègue compte ;
- un visa sur son propre document ne compte dans aucune des deux courbes de « mine » ;
- un visa donné dans un autre tenant ne compte pas ;
- un document supprimé ne compte pas ;
- un visa du dimanche à 23 h 30 à Douala tombe dans la bonne semaine.

**Affichage (F)** :
- Titre : « Visas que j'ai donnés ». Légende en mots : « Acceptés » et « Rejetés ou renvoyés ». Même composant SVG que les autres courbes.
- Elle se place à côté de « Mes documents visés / rejetés ou renvoyés ».
- **Elle ne s'affiche que si l'utilisateur a donné au moins un visa en 12 semaines.** La plupart des agents ne visent jamais : une carte vide serait du bruit. C'est la seule exception à la règle « Pas encore d'activité ces 12 dernières semaines. » de l'élément 10.
- Le chef (#298) a la même courbe sur son accueil, avec le même appel `scope=mine`.

## Ce que l'utilisateur voit

- L'agent qui dépose voit ce qui est arrivé à ses documents, comme avant, sans ses propres visas.
- Le chef, ou tout agent qui vise, voit en plus combien de visas il a donnés chaque semaine, acceptés d'un côté et rejetés ou renvoyés de l'autre.

## Risques

- **Dépendance** : la courbe est servie par le même appel que #329. Or #329 est une PR de V1.2. La PR de B doit soit s'empiler sur #329, soit porter elle-même l'appel. **Point ouvert pour O** : si la courbe entre en V1.1, il faut que #329 y entre aussi.

## Suites

- B : correctif de la décision 2 dans #329 ; PR brouillon de la décision 3 après son lot.
- F : affichage, dans la PR d'écran de l'élément 10.
- Q : preuve avant le 05/12, sinon la courbe part en V1.3.
- O : place de la PR dans la file dès qu'elle a un numéro ; arbitre la dépendance à #329.
