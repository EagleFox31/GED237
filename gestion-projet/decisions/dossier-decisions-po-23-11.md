# Décisions à prendre par le PO après la recette (23/11 au soir)

Présenté par O. Préparé par l'innovateur, 2026-11-17. Répondez par oui ou non, ou choisissez une option. La recommandation de l'équipe est indiquée quand elle existe. Le détail est dans la fiche citée, rangée dans `gestion-projet/innovateur/`.

## 1. Vue « Doublons » (#171)

Fiche : `fiche-po-171-doublons.md`.

1. Les copies en trop vont **seulement à la corbeille**, d'où on peut les restaurer, sans suppression définitive ? Recommandé : **oui**.
2. Pour une copie présente dans deux services, l'administrateur décide seul en V1.0, et le propriétaire sera prévenu en V1.1 ? Recommandé : **oui**.
3. Une copie en cours de validation **ne peut pas** être mise à la corbeille ? Recommandé : **oui**.

> Accord PO du JJ/11 : vue « doublons » en corbeille seulement, sans suppression définitive. Entre deux services, l'administrateur seul résout en V1.0 ; le propriétaire est prévenu en V1.1. Une copie en cours de validation n'est pas mise à la corbeille. Fusion après le 30.

## 2. Critères de succès : « − 70 % du temps de recherche » et « 90 % d'adoption en 3 mois »

Fiche : `protocole-mesure-criteres-succes.md`.

1. Le client mesure le temps de recherche actuel **avant** de remettre les comptes aux agents ? Recommandé : **oui**. Sans cette mesure, le « − 70 % » ne pourra jamais être prouvé.
2. On compte comme collaborateurs les agents de la liste remise par le client à la mise en service, sans les comptes techniques ni de démonstration ? Recommandé : **oui**.
3. Un agent est « actif » s'il consulte ou dépose au moins un document dans 3 des 4 dernières semaines du 3e mois ? Recommandé : **oui**.

> Accord PO du JJ/MM : les critères « − 70 % du temps de recherche » et « adoption ≥ 90 % en 3 mois » sont mesurés après la mise en service, selon `protocole-mesure-criteres-succes.md`. La mesure de départ est faite avant la remise des comptes. Les collaborateurs comptés sont ceux de la liste remise par le client à la mise en service.

## 3. Poste prêté pour l'essai d'installation sans Internet (P2)

Fiche : `protocole-installation-site.md`. L'essai a lieu après le 24, une fois l'envoi du code par e-mail en place.

1. Pouvez-vous **prêter un poste** avec Ubuntu 24.04 neuf, au moins 8 Go de mémoire libre et 10 Go de disque libre ? Il sera occupé pendant environ une demi-journée.
2. Acceptez-vous l'installation sur ce poste et sur le PC Windows (P1) **comme preuve à la place du serveur en ligne** pour l'item 28 du cahier des charges ? Recommandé : **oui**. Si c'est non, l'item 28 reste non vérifiable.

> Accord PO du JJ/MM : l'installation sur site est acceptée comme preuve à la place du VPS pour l'item 28 du CDC, sur la base des relevés P1 (Windows 11 + WSL 2) et P2 (Ubuntu 24.04, hors ligne). Le PO prête le poste de P2.

## 4. Responsable d'unité (#195), rapports d'un manager (#196, #203) et documents à valider (#165)

Questions 1 à 3 : seulement si vous n'avez pas encore répondu. Questions 4 et 5 : nouvelles.

Fiche : `fiche-po-195-portee-unit-admin.md`.

1. Le responsable d'unité ne voit **que son service et ses bureaux** : dans la liste, la recherche, les compteurs et les imports, comme dans ses rapports ? Recommandé : **oui**.
2. Les trois accès restants vers les autres services sont fermés en V1.1, dans une PR séparée : le lien direct, l'import au nom d'un autre agent et la vue de toute l'institution ? Recommandé : **oui**.
3. A-t-il besoin, dans son travail, de **chercher dans tout l'établissement** ? Si oui, il faut prévoir une autre voie avant la fusion.
4. Un **manager** ou un **lecteur** doit-il voir, dans ses rapports, les documents des bureaux rattachés à son service ? Question soulevée par Q en relisant #203.
   - Aujourd'hui, la règle des rapports prévoit « son service et ses bureaux ». Mais la liste des bureaux n'est jamais remplie : en pratique, il ne voit que son service. #203 répare ce calcul. Sans décision, ses rapports compteront donc aussi ses bureaux, alors que sa liste de documents reste limitée à son service.
   - **Option A, oui** : ses rapports couvrent son service et ses bureaux. Conséquence : il voit des chiffres sur des documents qu'il ne peut pas ouvrir dans sa liste. Rien à changer dans #196 et #203.
   - **Option B, non** : ses rapports couvrent son service seulement, comme sa liste. Conséquence : il voit les mêmes documents partout, comme aujourd'hui en pratique. B retire le manager et le lecteur de la règle « service et bureaux » des rapports avant la fusion de #196.
5. Un **manager** qui valide, dans un circuit, un document d'un **autre service** peut-il l'ouvrir pendant la validation ? Question soulevée par Q en relisant #165. Elle suit la même règle que la question 4 : ce que le manager voit en dehors de son service.
   - Constat : le document apparaît dans sa liste « Partagés avec moi », parce qu'il le valide. Quand il l'ouvre, il reçoit « accès refusé ».
   - **Option A, oui, recommandée** : il peut lire le document tant que son étape de validation est en cours. L'accès se ferme dès qu'il a visé ou rejeté, et chaque ouverture est tracée dans le journal. Conséquence : il valide un document qu'il a pu lire. B ajoute cette exception à la règle de lecture avant la fusion de #165.
   - **Option B, non** : le document n'apparaît plus dans sa liste. Conséquence : plus de message « accès refusé », mais il doit viser un document qu'il ne peut pas lire. L'auteur doit donc choisir un valideur de son propre service. B retire de #165 les documents à valider venant d'autres services.
   - Lien avec la question 4 : quelle que soit la réponse à la question 4, l'option A n'ouvre que les documents à valider, et seulement pendant la validation.

Pour information : B corrige dès maintenant le lien direct (#202). Un responsable d'unité ne pourra plus ouvrir, par son lien, un document d'un autre service. Ce travail passe avant les autres chantiers de B.

> Accord PO du JJ/11 : le responsable d'unité (`unit_admin`) voit seulement son service et ses bureaux, en liste, en recherche, dans les compteurs, les imports et les rapports. Le lien direct, l'import au nom d'un autre agent et la vue de l'institution seront fermés en V1.1, dans une PR distincte. Fusion après #196 et après le 30.
> Rapports d'un manager ou d'un lecteur : [son service et ses bureaux | son service seulement].
> Document d'un autre service à valider : [ouvert pendant la validation | absent de la liste].

## 5. Suppression d'un établissement et registre des documents officiels (#197) — DÉCIDÉE le 17/11

Pour information, aucune réponse demandée.

Constat : dans #197, supprimer un établissement effaçait aussi son registre des documents officiels (migration `eff6822a5320`, l. 28 et 40 : suppression en cascade).

> Décision PO du 17/11 : un établissement qui a un registre de documents officiels ne peut pas être supprimé. B l'applique dans #197 avant la fusion : la suppression est refusée (erreur 409) et la base l'interdit aussi (clé étrangère en RESTRICT).

## 6. Pour information : écran de connexion sur site

Aujourd'hui, l'écran de connexion affiche deux éléments de démonstration :
- le code de connexion déjà rempli ;
- le cadre « Espace Démo Interactif ».

Ils resteront pour la démo du 30. Après le 30, ils seront masqués dès que l'application est installée en mode production. Aucune décision n'est demandée.
