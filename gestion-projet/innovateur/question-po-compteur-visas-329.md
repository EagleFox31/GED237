# Question au PO : le compteur « visas » de « mes documents » (#329, V1.2)

Instruite par l'innovateur le 19/11, à la demande d'O, après une remarque de Q. Non bloquante. À poser au PO à un moment calme, après la coupe.

## Ce que fait #329 aujourd'hui

- La portée « mine » ne retient que **les documents dont l'utilisateur est l'auteur**. La courbe « visas » compte les visas rendus **sur ces documents**, quelle que soit la personne qui a visé (`trends.py`, filtre `Document.owner_id`).
- Elle ne compte **pas** les visas que l'utilisateur donne sur les documents de ses collègues.
- Le mélange relevé par Q n'existe que dans un cas : l'auteur vise lui-même son propre document. Son visa compte alors comme « reçu ». Le test de #329 joue précisément ce cas : l'auteur et le viseur sont la même personne.
- C'est conforme à la spec de l'élément 10 (`spec-element-10-tendances.md`, ligne 26) : « Issue de mes documents : visés, et rejetés ou renvoyés ».

## Ce que dit le CDC

Une seule ligne : « Tableau de bord de suivi (doublons, fichiers non classés, activités) ». Le CDC ne parle ni de visas reçus ni de visas donnés. Le choix relève du produit, sans effet sur le score.

## Ce qu'un fonctionnaire attend

Deux questions différentes, posées par deux personnes différentes :
- **L'agent qui dépose** veut savoir où en sont ses documents : combien sont visés, combien sont revenus. C'est la courbe actuelle.
- **Le chef qui vise** veut savoir combien il en a traité. La spec lui donne un tableau de bord à l'échelle de son unité : #298, brouillon V1.1, et la portée « unit » de #329. Les visas de l'unité y sont comptés.

## Réponse proposée

1. **Garder le compteur tel quel** : « mes documents » = les visas reçus sur mes documents. Le libellé à l'écran le dit clairement : « Mes documents visés » et « Mes documents rejetés ou renvoyés », et non « Visas ».
2. **Ne pas compter le visa qu'un auteur pose sur son propre document.** Correction d'une ligne pour B dans #329 : exclure `performed_by = owner_id`, plus un test.
3. **Pas de compteur « visas que j'ai donnés » en V1.2.** Le chef verra l'activité de son unité dans la portée « unit ». Si le PO le veut quand même, c'est une courbe de plus, filtrée sur `performed_by`, à mettre en V1.3.

## Question à poser au PO

« Sur l'accueil d'un agent, le compteur montre ce qui est arrivé à **ses** documents (visés, rejetés) et pas les visas qu'il donne lui-même. On garde ce choix, en retirant le cas où quelqu'un vise son propre document ? »
☐ Oui ☐ Non, je veux aussi voir les visas que je donne (V1.3)
