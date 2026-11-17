# Guide utilisateur par profil — GED237

Version de l'application : **1.0.0-rc.1**. Ce guide décrit seulement ce que fait cette version.

## À quoi sert ce guide

Pour chaque profil, il explique :

- comment se connecter ;
- ce que contient votre menu ;
- par quelle page commencer, et dans quel ordre travailler ;
- ce qu'il faut comprendre pour ne pas se tromper.

Les noms entre « guillemets » ou en **gras** sont écrits comme à l'écran.

## Les profils

| Profil | Ce qu'il fait |
|---|---|
| **Super administrateur** | Ouvre les institutions sur la plateforme. |
| **Administrateur de l'institution** | Règle l'institution : services, agents, classement, circuits, imports. |
| **Chef d'unité** | Suit le travail d'un service. |
| **Responsable** (manager) | Vise, approuve, signe ou rejette les documents. |
| **Collaborateur** | Crée les documents et les envoie en validation. |
| **Lecteur** | Consulte les documents, sans les modifier. |
| **Auditeur** | Vérifie qui a fait quoi, et quand. |

Votre profil est choisi par l'administrateur de votre institution.

## 1. Se connecter

### Première connexion

L'administrateur vous remet votre **matricule** et un **mot de passe provisoire**.

1. Dans « Administration / Organisme », choisissez votre institution.
2. Dans « Matricule Personnel », tapez votre matricule.
3. Dans « Mot de Passe », tapez le mot de passe provisoire.
4. Cliquez sur **Étape Suivante**.
5. L'écran « Code MFA » s'ouvre. Le code à 6 chiffres s'affiche déjà rempli : cliquez sur **Confirmer l'identité**.
6. L'écran « Changer le mot de passe » s'ouvre. Il est obligatoire.
7. Tapez le mot de passe provisoire, puis votre nouveau mot de passe, deux fois.
8. Cliquez sur **Mettre à jour**.

Votre nouveau mot de passe doit avoir :

- au moins 12 caractères ;
- une lettre majuscule ;
- un chiffre ;
- un caractère spécial (@, #, & …).

### Les fois suivantes

Faites les étapes 1 à 5. Vous arrivez ensuite sur votre page de départ (voir votre profil).

### Si quelque chose bloque

- **Code incorrect** : le code est valable 5 minutes. Revenez à l'étape 1 pour en obtenir un nouveau.
- **Trois codes faux** : votre compte est bloqué 15 minutes. Attendez, puis recommencez.
- **Mot de passe oublié** : le lien « Oublié ? » ne fait rien dans cette version. Demandez un nouveau mot de passe provisoire à l'administrateur de votre institution.
- **Session expirée** : reconnectez-vous. Vous revenez sur la page que vous aviez quittée.
- Ne vous servez pas du cadre « Espace Démo Interactif » sous le formulaire : il sert aux démonstrations.

## 2. Se repérer dans l'écran

- **Le menu** est à gauche. Son contenu dépend de votre profil (voir plus bas).
- **La barre de recherche** est en haut de l'écran. Elle cherche dans la page ouverte :
  - dans « Agents & Rôles » : un agent, par nom, matricule ou e-mail ;
  - dans « Mes Documents » ou l'« Explorateur documentaire » : un document ;
  - dans « À distribuer » : un document ou une étape ;
  - ailleurs : dans tous les documents, y compris le texte lu dans les fichiers scannés.

### Le menu des profils non administrateurs

Le chef d'unité, le responsable, le collaborateur, le lecteur et l'auditeur ont **le même menu** :

| Entrée du menu | À quoi elle sert |
|---|---|
| **Tableau de Bord** | Votre page de travail. Son titre change selon votre profil. |
| **Mes Documents** | La liste des documents que vous pouvez voir (page « Explorateur GED »). |
| **Tâches & Suivi** | Les étapes de validation qui vous attendent (page « Tâches & Validations »). |
| **Ranger / Importer** | Ranger des fichiers de votre ordinateur, ou les importer dans la GED. |
| **Bibliothèque locale** | L'historique de vos rangements faits sur votre ordinateur. |
| **Rapports** | Responsable seulement : les chiffres de votre service. |

## 3. Les mots à connaître

| Mot | Sens |
|---|---|
| **Institution** | Votre organisme : ministère, direction, agence. |
| **Service** (ou unité) | Une partie de l'institution : direction, sous-direction, cellule, bureau. |
| **Profil** | Ce que vous avez le droit de faire. |
| **Rattachement** | Le service auquel vous appartenez. Il décide quels dossiers vous arrivent. |
| **Plan de classement** | Les règles qui disent où ranger un document : domaine, activité, année. |
| **Circuit** | Les étapes qu'un document doit passer : visa, approbation, signature, prise de connaissance. |
| **Bannette** | Une liste de choses à traiter. Ce n'est pas une corbeille. |
| **Audit** | Le journal de toutes les actions. Il sert de preuve. |

## 4. Cinq règles à retenir

1. **Le profil ne suffit pas.** Le service auquel vous êtes rattaché compte aussi. Deux responsables de niveaux différents ne reçoivent pas les mêmes dossiers.
2. **Ranger et faire circuler sont deux choses.** Le classement dit **où** est le document. Le circuit dit **qui** doit agir dessus. Un document peut être bien rangé et attendre encore une décision.
3. **L'import en masse se fait en deux temps.** D'abord l'application propose un rangement. Ensuite, vous vérifiez et vous lancez l'import.
4. **Une bannette n'est pas une corbeille.** Elle contient ce qui attend une action de votre part.
5. **L'audit ne modifie rien.** Il montre seulement ce qui s'est passé.

**Retirer un document** : il n'y a pas de bouton pour mettre un document à la corbeille dans cette version. Demandez à l'administrateur de votre institution.

## 5. Parcours par profil

### 5.1 Super administrateur

**Ce que vous faites** : ouvrir les institutions et leur donner un premier administrateur. Vous ne gérez pas le travail quotidien des institutions.

**À la connexion**, vous arrivez sur **Institutions**.

**Votre menu** :

- « Dashboard Global » ;
- « Institutions » ;
- « Utilisateurs » ;
- « Gestion AuthZ » : les règles d'accès communes à toute la plateforme ;
- « Documents » ;
- « Workflows » ;
- « Import en masse » ;
- « Bibliothèque locale » ;
- « Audit » ;
- « Parametres » (écrit sans accent à l'écran).

**Ouvrir une institution** :

1. Ouvrez **Institutions**.
2. Créez la nouvelle institution.
3. Ouvrez sa fiche.
4. Créez son premier administrateur.
5. Vérifiez que cet administrateur peut se connecter.

L'administrateur de l'institution crée ensuite lui-même les services et les agents.

**À retenir** :

- Une institution ne doit jamais voir les données d'une autre. Vérifiez-le après chaque création.
- Tant qu'une institution n'a ni administrateur ni service, certaines actions restent cachées. C'est normal.

### 5.2 Administrateur de l'institution

**Ce que vous faites** : régler le fonctionnement de votre institution, et traiter les cas que les autres ne peuvent pas régler seuls.

**À la connexion**, vous arrivez sur **Tableau de bord**.

**Votre menu** :

| Entrée | À quoi elle sert |
|---|---|
| **Tableau de bord** | Vue générale et alertes. |
| **Ma bannette** | Les documents à revoir, et ceux qui attendent votre signature. |
| **À distribuer** | Les documents sans destinataire. |
| **Structure hiérarchique** | L'organigramme : services et sous-services. |
| **Explorateur documentaire** | Les documents rangés, service par service. |
| **Agents & Rôles** | Les agents, leurs profils et leurs droits. |
| **Traitement des documents** | Types de documents, circuits de validation, règles d'aiguillage, simulateur. |
| **Plan de classement** | Domaines métier, activités, règles de classement, simulateur. |
| **Import en masse** | Reprendre des archives existantes. |
| **Bibliothèque locale** | L'historique de vos rangements faits sur votre ordinateur. |
| **Audit & Traçabilité** | Le journal des actions. |
| **Rapports & Statistiques** | Les chiffres de toute l'institution. |
| **Paramètres** | Guide des rôles, position du menu, liste de contrôle de l'installation. |

#### Mettre l'institution en service

1. Ouvrez **Structure hiérarchique**. Créez les services et les sous-services.
2. Ouvrez **Agents & Rôles**. Créez les agents et rattachez chacun à son service.
3. Ouvrez **Traitement des documents**. Définissez :
   - les types de documents ;
   - les circuits de validation ;
   - les règles d'aiguillage ;
   - puis testez-les avec le simulateur.
4. Ouvrez **Plan de classement**. Définissez :
   - les domaines métier ;
   - les activités ;
   - les règles de classement ;
   - puis testez-les avec le simulateur.
5. Ouvrez **Import en masse** pour reprendre les archives.
6. Ouvrez **Explorateur documentaire** pour vérifier où les documents sont rangés.
7. Ouvrez **Ma bannette** et **À distribuer** pour traiter ce qui n'a pas été réglé seul.

#### Chaque jour

1. Ouvrez **Tableau de bord** et regardez les alertes.
2. Ouvrez **Ma bannette** : traitez les documents à revoir.
3. Ouvrez **À distribuer** : donnez un destinataire aux documents qui n'en ont pas.
4. En cas de doute ou de besoin de preuve, ouvrez **Audit & Traçabilité**.

#### Les pages en détail

**Structure hiérarchique**

- Elle sert à créer les services et à y rattacher les agents.
- Les circuits et les droits d'accès s'appuient dessus.
- Ce n'est pas l'endroit où les documents sont rangés.

**Explorateur documentaire**

1. Choisissez un service.
2. Regardez ses documents. Vous pouvez inclure ses sous-services.
3. Vérifiez le chemin de rangement de chaque document.
4. Ouvrez un aperçu si besoin.

Un document marqué **À vérifier** se corrige dans **Ma bannette**, pas ici.

**Traitement des documents**

Cette page répond à la question : « Qui doit traiter quoi, et dans quel ordre ? »

**Plan de classement**

Cette page répond à la question : « Où le document doit-il être rangé ? »

**Import en masse**

1. Choisissez les fichiers, ou un dossier complet.
2. Choisissez où les ranger.
3. Vérifiez le rangement proposé.
4. Lancez l'import.

Deux choix possibles :

- **Juste les ranger** : pour des archives. Aucun circuit ne démarre.
- **Les ranger et lancer le circuit** : pour des dossiers qui doivent encore être visés ou signés.

Ne choisissez le second que pour des dossiers encore en cours.

**Ma bannette**

Elle sert surtout à corriger le classement :

1. Ouvrez un document à revoir.
2. Lisez pourquoi il n'a pas été rangé seul.
3. Corrigez le domaine, l'activité, l'année, la destination ou la catégorie.
4. Validez. Si le document devait suivre un circuit, le circuit repart.

Traitez la bannette vite : un document mal rangé est difficile à retrouver.

**À distribuer**

L'application a créé une étape de circuit, mais n'a trouvé personne pour la faire.

1. Ouvrez l'étape.
2. Choisissez l'agent qui doit la faire.

**Audit & Traçabilité**

- Filtrez par date, agent, objet ou type d'action.
- Lisez la suite des actions.
- **Exporter (CSV)** : l'export porte sur **un seul agent à la fois**. Choisissez d'abord un agent dans les filtres.

Cette page ne modifie aucun document.

**Rapports & Statistiques**

1. Choisissez un onglet : « Synthèse », « Activité documentaire », « Traitement & délais » ou « Services ».
2. Choisissez un service, ou « Institution entière ».
3. **Exporter la vue** : télécharge le tableau affiché.
4. **Générer un rapport** : produit un fichier PDF, Excel ou CSV.

**Paramètres**

- Le guide des rôles : quel profil donner à quel agent.
- Le choix du menu : à gauche ou en haut.
- La liste des services créés.
- La liste de contrôle de l'installation.

**À retenir** :

- Un document peut être bien rangé mais envoyé à la mauvaise personne, ou l'inverse.
- Un bon import n'est pas seulement un import sans erreur : les documents doivent être rangés au bon endroit.
- Pour créer une secrétaire ou une assistante : profil **Collaborateur**, dans le même service que son chef. Le profil dit les droits, pas le poste.

### 5.3 Chef d'unité

**Ce que vous faites** : suivre le travail de votre service.

**À la connexion**, vous arrivez sur **Tableau de Bord**, page « Chef Unité ».

**Votre menu** : le menu commun (voir § 2).

**Chaque jour** :

1. Ouvrez **Tableau de Bord**.
2. Regardez les « Indicateurs du Service » : volumes et dossiers en attente.
3. Ouvrez **Tâches & Suivi** pour les étapes qui vous attendent.
4. Si le problème vient du classement, des circuits ou des droits, prévenez l'administrateur de l'institution.

**À retenir** : dans cette version, « Mes Documents » montre aussi les documents des autres services.

### 5.4 Responsable

**Ce que vous faites** : décider sur les documents qui vous sont envoyés.

**À la connexion**, vous arrivez sur **Tâches & Suivi**, page « Tâches & Validations ».

**Votre menu** : le menu commun, avec **Rapports** en plus.

**Décider sur un document** :

1. Ouvrez **Tâches & Suivi**, ou **Tableau de Bord** (page « Espace Manager »).
2. Choisissez un dossier.
3. Lisez le document.
4. Acceptez ou rejetez :
   - Dans « Espace Manager », le bouton porte le nom de l'étape : **Viser**, **Approuver**, **Signer** ou **J'ai pris connaissance**. Confirmez.
   - Dans « Tâches & Validations », le bouton s'appelle **Valider**.
   - Pour refuser : **Rejeter**. Écrivez le motif. Il est obligatoire.
5. Le dossier quitte votre liste ou passe à l'étape suivante.

**Rapports** : vous voyez les chiffres de votre service et de ses bureaux, pas ceux des autres services. C'est normal.

**À retenir** :

- Le type d'étape est fixé par le circuit, pas par vous.
- Un dossier qui n'arrive pas au bon responsable vient souvent d'un mauvais rattachement. Prévenez l'administrateur.
- Une liste vide veut dire : « rien n'attend votre décision maintenant ». Elle ne veut pas dire qu'il n'y a aucun document.

### 5.5 Collaborateur

**Ce que vous faites** : créer les documents et les envoyer en validation.

**À la connexion**, vous arrivez sur **Tableau de Bord**, page « Mon Atelier ».

**Votre menu** : le menu commun (voir § 2).

**Créer un document** :

1. Dans « Mon Atelier », cliquez sur **Nouveau Document**.
2. Remplissez :
   - « Titre du document » ;
   - « Catégorie » ;
   - « Tags (séparés par virgule) », si besoin ;
   - « Fichier (PDF, DOCX) ».
3. Cliquez sur **Créer le Document**. Il est enregistré comme brouillon.

**L'envoyer en validation** :

1. Sur le brouillon, cliquez sur **Soumettre**.
2. Dans « Valideur (Manager/Directeur) », choisissez la personne qui doit valider.
3. Cliquez sur **Soumettre au visa**.
4. Suivez l'état du document sur sa carte : rejeté, ou validé et signé.

**À retenir** :

- Déposer un fichier n'est pas encore une validation.
- La catégorie et les tags aident à envoyer le document à la bonne personne, et à le ranger.
- Si le document est rejeté, lisez le motif et corrigez le contenu. Ne déposez pas simplement un autre fichier.

### 5.6 Lecteur

**Ce que vous faites** : consulter les documents, sans les modifier.

**À la connexion**, vous arrivez sur **Mes Documents**, page « Explorateur GED ».

**Votre menu** : le menu commun (voir § 2).

**Trouver un document** :

1. Dans **Mes Documents**, tapez un mot dans la barre de recherche en haut, ou parcourez la liste.
2. Ouvrez le document. Il est en lecture seule.
3. Vérifiez son état et sa date si besoin.

**Les archives et les documents partagés** sont aussi dans **Tableau de Bord**, page « Ma Bibliothèque ». Elle compte les documents disponibles et ceux qui sont validés.

**À retenir** :

- Vous ne voyez pas de boutons d'action. C'est normal.
- Un document attendu n'apparaît pas ? Les causes possibles :
  - vous n'avez pas le droit de le voir ;
  - il n'est pas encore rangé ;
  - son circuit n'est pas terminé.
  Demandez à l'administrateur.

### 5.7 Auditeur

**Ce que vous faites** : vérifier qui a fait quoi, et en garder la preuve.

**À la connexion**, vous arrivez sur la page du journal d'audit. **Tableau de Bord** ouvre la même page.

**Votre menu** : le menu commun (voir § 2).

**Retracer une action** :

1. Filtrez par date, agent, objet ou type d'action.
2. Lisez la suite des actions sur un document, un agent ou un import.
3. Pour garder une trace, cliquez sur **Exporter (CSV)**. L'export porte sur **un seul agent à la fois** : choisissez-le d'abord dans les filtres.

**À retenir** :

- Filtrez avant de conclure.
- Chaque anomalie doit être reliée à une action précise : création, modification, revue, import, consultation, suppression ou affectation.
- Une action faite par l'application elle-même peut apparaître sans nom d'agent. Ce n'est pas une anomalie.

## 6. Les pages communes

### Mes Documents

- La liste des documents que vous pouvez voir.
- Filtrez par état ou par catégorie.
- Le bouton **Nouveau Document** n'apparaît que pour l'administrateur, le responsable et le collaborateur.

### Tâches & Suivi

- Les étapes de circuit qui vous attendent.
- **Valider** pour accepter, **Rejeter** avec un motif pour refuser.

### Ranger / Importer

La page propose deux choix :

- **Ranger sur mon poste** : l'application range les fichiers de votre ordinateur. Rien n'est envoyé dans la GED. Vous récupérez le résultat dans un dossier de votre ordinateur, ou en ZIP.
- **Importer dans le Serveur de l'Application** : les fichiers entrent dans la GED. Il faut avoir le droit de créer des documents (administrateur, responsable, collaborateur).

Lecteur et auditeur : seul **Ranger sur mon poste** vous concerne.

### Bibliothèque locale

- L'historique de vos rangements faits avec **Ranger sur mon poste**.
- Vos fichiers restent sur votre ordinateur.
- La liste de vos rangements est aussi gardée sur votre compte. Vous pouvez l'effacer : vos fichiers ne sont pas supprimés.
- Ce n'est pas l'**Import en masse** : rien n'entre dans la GED.

## 7. Situations fréquentes

### Quelle page pour quel besoin ?

| Je veux… | J'ouvre… |
|---|---|
| Créer un document et l'envoyer en validation | « Mon Atelier » (Tableau de Bord du collaborateur) |
| Viser, approuver, signer ou rejeter | **Tâches & Suivi**, ou « Espace Manager » |
| Retrouver un document | **Mes Documents**, ou la barre de recherche en haut |
| Contrôler le rangement d'un service | **Explorateur documentaire** (administrateur) |
| Lire les archives et les documents partagés | « Ma Bibliothèque » (Tableau de Bord du lecteur) |
| Savoir qui a fait quoi | **Audit & Traçabilité**, ou la page d'audit de l'auditeur |

### « À revoir » ou « À distribuer » ?

- **Document à revoir** (Ma bannette) : l'application ne sait pas **où** ranger le document.
- **Document sans destinataire** (À distribuer) : l'application ne sait pas **à qui** confier une étape.

Les causes et les corrections ne sont pas les mêmes.

### Import en masse ou Nouveau Document ?

- **Import en masse** : pour reprendre les archives existantes.
- **Nouveau Document** : pour le travail de tous les jours.

N'utilisez pas l'import en masse pour vos dépôts quotidiens, sauf consigne de l'administrateur.

### Quand ouvrir l'audit ?

Quand il faut une preuve :

- qui a importé ce fichier ;
- qui a validé cette étape ;
- pourquoi le document a changé d'état ;
- quand le classement a été corrigé ;
- si l'application a bien fait une action automatique.
