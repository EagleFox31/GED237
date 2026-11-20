# Décisions à prendre par le PO après la recette (23/11 au soir)

Présenté par O. Préparé par l'innovateur le 17/11. Pour chaque question, répondez oui ou non, ou choisissez A ou B. La recommandation de l'équipe est en **gras**. La fiche citée donne le détail, à lire seulement en cas de doute (dossier `gestion-projet/innovateur/`).

## 1. Vue « Doublons » (#171) et corbeille (#152)

Fiche : `fiche-po-171-doublons.md`.

1. Les copies en trop vont seulement à la corbeille, d'où on peut les restaurer, jamais en suppression définitive ? **Oui.**
2. Une copie présente dans deux services : l'administrateur décide seul au début, et le propriétaire sera prévenu dans une version suivante ? **Oui.**
3. Un document en cours de validation, doublon ou non, ne peut pas être mis à la corbeille ? **Oui.** Aujourd'hui, il y va et ses étapes de validation restent ouvertes.
   - Sans réponse le 23 (q. 3) : le document va à la corbeille et sa validation reste ouverte.
   - Sans réponse le 23 (q. 1 à 3) : la vue « Doublons » n'entre pas dans la V1.1 ; elle attend votre accord.

> Accord PO du JJ/11 : vue « doublons » en corbeille seulement, sans suppression définitive. Entre deux services, l'administrateur seul résout au départ (V1.0 livrée le 30), le propriétaire est prévenu en V1.1. Un document en cours de validation, doublon ou non, n'est pas mis à la corbeille. Fusion après le 30.

## 2. Critères de succès : « − 70 % du temps de recherche » et « 90 % d'adoption en 3 mois »

Fiche : `protocole-mesure-criteres-succes.md`.

1. Le client mesure le temps de recherche actuel **avant** de remettre les comptes aux agents ? **Oui.**
   - Sans réponse le 23 : la mesure de départ n'est pas faite, et le « − 70 % » ne pourra jamais être prouvé.
2. On compte les agents de la liste remise par le client à la mise en service, sans les comptes techniques ni de démonstration ? **Oui.**
3. Un agent est « actif » s'il consulte ou dépose au moins un document dans 3 des 4 dernières semaines du 3e mois ? **Oui.**

> Accord PO du JJ/MM : les critères « − 70 % du temps de recherche » et « adoption ≥ 90 % en 3 mois » sont mesurés après la mise en service, selon `protocole-mesure-criteres-succes.md`. La mesure de départ est faite avant la remise des comptes. Les collaborateurs comptés sont ceux de la liste remise par le client à la mise en service.

## 3. Poste prêté pour l'essai d'installation sans Internet

Fiche : `protocole-installation-site.md`.

1. Pouvez-vous prêter un poste neuf (Ubuntu 24.04, 8 Go de mémoire et 10 Go de disque libres) le **mercredi 25/11 de 09:00 à 13:00**, ou sinon le jeudi 26/11 aux mêmes heures ? Q installe, O chronomètre. Répondez par le créneau.
   - Sans réponse le 23 : l'essai sans Internet n'a pas lieu avant la démo du 30.
2. L'installation sur ce poste et sur le PC Windows vaut-elle preuve, à la place d'un serveur en ligne, pour l'exigence 28 du cahier des charges ? **Oui.**
   - Sans réponse le 23 : l'exigence 28 reste impossible à vérifier.

> Réponse du PO du 17/11 : **pas de poste prêté**. Q prouve l'installation sans Internet le 25/11, sur une machine simulée sans réseau (Ubuntu 24.04, 8 Go de mémoire, 10 Go de disque libres), à la place de P2. La question 2 (valeur de preuve pour l'exigence 28, avec P1) reste à confirmer par le PO au vu du relevé du 25 (question 15 de `../innovateur/fiche-decisions-po-19-11.md`).

## 4. Ce que voient le responsable d'unité et le manager (#195, #196, #203, #165)

Fiche : `fiche-po-195-portee-unit-admin.md`. Les questions 1 à 3 portent sur #195 ; les questions 4 et 5 sont nouvelles.

1. Le responsable d'unité voit seulement son service et ses bureaux, partout : liste, recherche, compteurs, imports et rapports ? **Oui.**
2. Ses trois derniers accès aux autres services (lien direct, import au nom d'un autre agent, vue de toute l'institution) seront fermés en V1.1 ? **Oui.**
3. A-t-il besoin, pour son travail, de chercher dans tout l'établissement ? **Non**, sauf si vous citez un cas réel. Si oui, il faut prévoir une autre façon de le faire avant la fusion.
   - Sans réponse le 23 (q. 1 à 3) : rien ne change, il voit encore tout l'établissement dans sa liste et sa recherche.
4. Les rapports d'un manager ou d'un lecteur couvrent : A. son service et ses bureaux, ou B. son service seulement, comme sa liste de documents ? **B** : il voit les mêmes documents partout. Avec A, il voit des chiffres sur des documents qu'il ne peut pas ouvrir.
   - Sans réponse le 23 : si #203 fusionne en l'état, ses bureaux sont comptés dans ses rapports.
5. Un manager doit valider un document d'un autre service. Aujourd'hui, il le voit dans sa liste mais reçoit « accès refusé ». Faut-il A. qu'il puisse le lire pendant sa validation seulement, ou B. que le document n'apparaisse plus dans sa liste ? **A** : sinon, il vise un document sans l'avoir lu.
   - Sans réponse le 23 : le message « accès refusé » reste.

Pour information : B corrige dès maintenant le lien direct (#202). Un responsable d'unité ne pourra plus ouvrir, par un lien, un document d'un autre service.

> Réponse du PO du 17/11, pour la V1.1 (consignée sur #195) : le responsable d'unité (`unit_admin`) voit seulement son service et ses bureaux, en liste, en recherche, dans les compteurs, les imports et les rapports (question 1 : oui). Le lien direct, l'import au nom d'un autre agent et la vue de l'institution seront fermés en V1.1, dans une PR distincte (question 2 : oui). Il n'a pas besoin de chercher dans tout l'établissement (question 3 : non). Fusion après #196 et après le 30.
> Manager et lecteur (question 4) : ils voient leur service et ses sous-services (un niveau), avec le même périmètre dans la liste, la recherche et les rapports. La liste s'élargit donc aux bureaux, au lieu de réduire les rapports.
> Document d'un autre service à valider (question 5) : **A**, le responsable désigné comme lecteur ou signataire peut l'ouvrir.

## 5. Suppression d'un établissement qui a émis des documents officiels (#197) — DÉCIDÉE le 17/11

Pour information, aucune réponse demandée.

> Décision PO du 17/11 : un établissement qui a émis des documents officiels ne peut pas être supprimé, pour garder leur registre. L'application refuse la suppression, et la base de données l'interdit aussi. B l'a fait dans #197, relue par Q.

## 6. Pour information : écran de connexion sur site

Aujourd'hui, l'écran de connexion affiche deux éléments de démonstration :
- le code de connexion déjà rempli ;
- le cadre « Espace Démo Interactif ».

Ils resteront pour la démo du 30. Après le 30, ils seront masqués dès que l'application est installée en mode production. Aucune décision n'est demandée.
