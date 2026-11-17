# E-Dossier Cameroun — version 1.0.0-rc.1 : ce qui change pour vous

*Brouillon du 17/11/2026, à joindre au tag du 24/11. À relire le 19 au soir : une ligne peut changer si un lot n'est pas fusionné à la coupe de 18:00.*

E-Dossier range, retrouve et fait valider les documents de votre institution. Cette version est la première présentée en démonstration, le 30/11.

## Ce que vous pouvez faire

**Vous connecter**

- La connexion se fait en deux temps : votre mot de passe, puis un code à usage unique.
- Après trois codes faux, le compte est bloqué 15 minutes. Un compte à rebours s'affiche. Pour être débloqué plus tôt, adressez-vous à votre administrateur.
- Si votre session a expiré, vous revenez sur la page que vous aviez quittée.

**Ranger les documents**

- L'administrateur importe un dossier entier en une fois. Les doublons sont écartés et signalés.
- Les documents sont classés automatiquement par service, domaine, activité et année, selon des règles. L'administrateur peut tester une règle avant de l'activer.
- Un dossier peut être surveillé : ce qui y arrive est importé sans action de votre part.
- Ce que les règles ne savent pas classer attend dans « Ma bannette », où l'administrateur le classe à la main.

**Retrouver un document**

- Chaque service a son espace, rangé par domaine, activité et année, avec des filtres.
- La recherche porte sur le texte des documents. Elle ne montre que ce que vous avez le droit de lire, jamais les documents d'une autre institution. Les documents en corbeille n'y figurent pas.

**Faire valider**

- Vous soumettez un document à votre responsable. Il le vise ou le rejette ; un rejet est toujours motivé.
- « Tâches & Suivi » montre ce qui attend votre action.

**Contrôler**

- L'auditeur consulte le registre des actions (connexions, dépôts, imports, consultations) sans pouvoir rien modifier. Il peut l'exporter dans un tableur.
- Les responsables consultent les rapports de leur service.

**Protéger les données**

- Les données se sauvegardent et se restaurent. Une restauration complète a été rejouée en exercice avant la livraison.
- La connexion à l'application est chiffrée (adresse en https).

## Ce qui a changé dans les droits

- Un administrateur ne peut plus donner à quelqu'un un rôle plus élevé que le sien.
- Les rapports de l'administrateur d'un service ne couvrent plus que son service et ses sous-services. Les collaborateurs n'ont plus accès aux rapports.

## Limites connues de cette version

- **Administrateur d'un service** : ses documents et sa recherche couvrent toute l'institution, et pas seulement son service. Ses rapports, eux, se limitent à son service. Corrigé dans la version suivante (#215).
- **Code de connexion** : en démonstration, il s'affiche directement à l'écran. Son envoi par e-mail arrive dans la version suivante.
- **Mot de passe oublié** : le lien « Oublié ? » ne fait encore rien. Demandez un nouveau mot de passe à votre administrateur.
- **Corbeille** : elle n'a pas encore d'écran. Pour récupérer un document supprimé, adressez-vous à votre administrateur. Les documents en corbeille comptent encore dans les statistiques de l'institution (#218).
- **Conservation** : aucun document n'est supprimé automatiquement au bout d'une durée ; c'est l'administrateur qui vide la corbeille.
- **Documents numérisés** : la lecture du texte d'un scan reste simple. Un scan de mauvaise qualité peut échapper à la recherche ; cherchez alors par titre ou par dossier.
- **Autre poste que celui de la démonstration** : le navigateur peut afficher un avertissement de sécurité tant que le poste n'a pas été préparé par l'équipe technique.
- **Gros volumes** : la version a été mesurée sur 420 documents. L'essai sur 100 000 documents est prévu en décembre.

## Prévu dans la version suivante (V1.1)

**Connexion**

- Envoi du code de connexion par e-mail, avec un bouton pour le renvoyer (#154).
- Application d'authentification sur téléphone, obligatoire pour les administrateurs. En cas de téléphone perdu, le niveau supérieur réinitialise l'accès après vérification de votre identité (#193).
- Réinitialisation de votre mot de passe depuis l'écran de connexion.

**Droits et profil**

- L'administrateur d'un service ne voit et ne modifie que les documents de son service et de ses sous-services. Il dispose d'un tableau de bord de son service (#215).
- Chacun peut modifier lui-même son nom, son prénom et son téléphone. Les autres informations du compte restent gérées par l'administrateur (#222).
- L'application cache d'elle-même les fonctions que votre administrateur a désactivées (#214, #224).

**Documents**

- Un écran Corbeille : restaurer, vider, traiter plusieurs documents à la fois, annuler une suppression ou un déplacement.
- Un écran Doublons : garder un exemplaire et mettre les autres à la corbeille.
- Favoris, documents récents et documents partagés avec vous (#165).
- Un import de dossier interrompu reprend là où il s'était arrêté (#186).
- Une seule liste de validation, avec un onglet par type de demande.

**Rapports**

- Rapports officiels en PDF, numérotés, que l'on peut réimprimer et programmer (#197, #180).
- Indicateurs de qualité des documents, et alertes quand un indicateur se dégrade (#162, #183).
- Statistiques de l'institution sans les documents en corbeille (#218).

**Exploitation**

- Sauvegarde automatique chaque nuit, avec alerte en cas d'échec (#192).
- L'application refuse de démarrer si sa configuration de production est incomplète ou peu sûre (#212).
