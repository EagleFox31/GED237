# Guide utilisateur par profil — GED237

## Objectif du guide

Ce document explique, pour chaque profil utilisateur de GED237 :

- sur quelles pages il travaille au quotidien ;
- dans quel ordre il passe d'une page a l'autre ;
- ce qu'il doit comprendre des notions metier qui influencent l'usage ;
- les differences entre des ecrans qui se ressemblent mais ne servent pas au meme besoin.

Le guide est redige pour un usage administratif de type ministere, direction, service ou organisme public.

## A qui s'adresse ce guide

- `Super Admin` : pilote la plateforme et ouvre les institutions.
- `Admin Institution` : configure le tenant, les services, les roles, le classement et les imports.
- `Admin Service` : suit l'activite documentaire d'un service.
- `Responsable` : vise, approuve ou signe.
- `Collaborateur` : depose et soumet les documents.
- `Lecteur` : consulte les documents autorises en lecture seule.
- `Auditeur` : controle la tracabilite et les actions effectuees.

## Avant de commencer

### Vocabulaire commun

**Institution**
: organisation hebergee dans GED237, par exemple un ministere ou une agence.

**Service**
: unite organisationnelle de l'institution. Il peut s'agir d'une direction, sous-direction ou cellule.

**Role**
: droit principal donne a l'utilisateur. Le role dit ce que la personne peut faire.

**Perimetre**
: niveau organisationnel sur lequel s'exerce l'action. Le perimetre dit ou la personne peut agir.

**Espace documentaire**
: vue des documents ranges par unite organisationnelle.

**Plan de classement**
: logique de rangement documentaire. Il determine dans quel domaine, activite, annee et cible un document doit etre range.

**Circuit**
: suite d'etapes de visa, approbation, signature ou prise de connaissance.

**Bannette**
: file d'elements a traiter. Dans GED237, une bannette peut concerner le classement a arbitrer, des etapes en attente ou des affectations manuelles.

**Audit**
: journal de preuve des actions realisees sur les documents, les utilisateurs ou les regles.

## Principes metier a retenir

### 1. Le role ne suffit pas, le rattachement organisationnel compte aussi

Dans GED237, le role donne le droit d'action, mais la structure hierarchique determine le bon niveau d'intervention.

Exemple :

- un `Responsable` dans un service ne joue pas le meme role organisationnel qu'un `Responsable` au niveau direction ;
- le moteur peut rechercher le bon valideur selon le niveau vise par le circuit.

### 2. Ne pas confondre structure, espace documentaire et classement

Ces trois notions sont liees, mais distinctes :

- **Structure hierarchique** : organise les services et les utilisateurs ;
- **Explorateur documentaire** : permet de consulter les documents deja ranges dans les espaces ;
- **Plan de classement** : definit les regles de rangement pour que les documents arrivent au bon endroit.

### 3. L'import en masse se fait en deux temps

L'import n'envoie pas directement les fichiers dans le fonds documentaire final :

1. analyse des fichiers et proposition de classement ;
2. verification puis import reel.

Ce fonctionnement limite les erreurs de masse.

### 4. Une bannette n'est pas une corbeille

Une bannette est une file de traitement. Elle contient des elements qui attendent une action humaine :

- arbitrer un classement ambigu ;
- affecter une etape restee sans destinataire ;
- traiter une etape de validation.

### 5. L'audit sert d'abord a prouver

L'audit ne remplace pas les ecrans de travail. Il sert a :

- verifier qui a fait quoi ;
- expliquer pourquoi un document a change d'etat ;
- produire une trace de controle.

## Parcours par profil

## 1. Super Admin

### Mission principale

Ouvrir et administrer les institutions sur la plateforme, sans gerer le contenu metier quotidien de chaque institution.

### Pages principales

- `Dashboard Global`
- `Institutions`
- `Utilisateurs`
- `Gestion AuthZ`
- `Audit`

### Parcours typique

1. Ouvrir **Institutions**.
2. Creer une nouvelle institution.
3. Ouvrir le detail de l'institution.
4. Creer le premier `Admin Institution`.
5. Verifier que l'institution peut ensuite creer ses services et ses utilisateurs metier.
6. En cas de besoin, controler les utilisateurs reseau, les politiques d'autorisation et l'audit.

### Ce que ce profil doit comprendre

- Le `Super Admin` cree le cadre, mais n'organise pas le classement quotidien de chaque institution.
- Il doit verifier l'etancheite entre institutions : une institution ne doit pas voir les donnees d'une autre.
- La page `Gestion AuthZ` concerne les politiques d'autorisation transverses, pas les circuits documentaires metier.

### Points d'attention UX

- La creation d'une institution se fait dans un ordre volontairement guide : institution, admin principal, services, puis utilisateurs.
- Si une institution n'a pas encore d'admin ou de services, certaines actions restent volontairement masquees.

## 2. Admin Institution

### Mission principale

Configurer le fonctionnement documentaire de l'institution et resoudre les cas que les autres profils ne peuvent pas traiter seuls.

### Pages principales

- `Tableau de bord`
- `Ma bannette`
- `A distribuer`
- `Structure hierarchique`
- `Explorateur documentaire`
- `Agents & Roles`
- `Traitement des documents`
- `Plan de classement`
- `Import en masse`
- `Audit & Tracabilite`
- `Parametres`

### Parcours recommande de mise en service

1. Aller dans **Structure hierarchique**.
2. Creer les services et sous-services.
3. Aller dans **Agents & Roles** et creer les utilisateurs.
4. Aller dans **Traitement des documents** pour definir :
   - les types de documents ;
   - les circuits de validation ;
   - les regles d'aiguillage ;
   - les simulations.
5. Aller dans **Plan de classement** pour definir :
   - les domaines ;
   - les activites ;
   - les regles de classement ;
   - les tests de classement.
6. Aller dans **Import en masse** pour reprendre les fonds existants.
7. Aller dans **Explorateur documentaire** pour verifier le resultat concret dans les espaces documentaires.
8. Aller dans **Ma bannette** et **A distribuer** pour traiter les cas non resolus automatiquement.

### Parcours recommande au quotidien

1. Ouvrir **Tableau de bord** pour reperer les alertes.
2. Consulter **Ma bannette** pour traiter les documents a arbitrer.
3. Consulter **A distribuer** pour affecter les etapes orphelines.
4. Verifier **Explorateur documentaire** pour controler le rangement effectif.
5. Consulter **Audit & Tracabilite** en cas d'anomalie ou de besoin de preuve.

### Ce que ce profil doit comprendre

#### Structure hierarchique

La page sert a organiser l'institution :

- creation des services ;
- rattachement des agents ;
- lecture des documents lies a une unite ;
- base de travail pour les circuits et l'isolation des acces.

Cette page n'est pas le lieu de rangement final du document, mais le point de reference organisationnel.

#### Explorateur documentaire

La page sert a parcourir les documents selon l'espace du service.

Elle permet notamment de :

- choisir une unite ;
- voir les documents du service ;
- etendre la vue aux sous-services ;
- verifier le chemin logique de classement ;
- ouvrir un apercu ;
- relancer une correction de classement si necessaire.

En pratique, c'est la page de controle du rangement reel.

#### Traitement des documents

Cette page regle la circulation des documents :

- quels types de documents existent ;
- quels circuits sont autorises ;
- quelles regles d'aiguillage orientent les dossiers ;
- comment tester la configuration avant mise en service.

Elle repond a la question : "Qui doit traiter quoi, et dans quel ordre ?"

#### Plan de classement

Cette page regle le rangement :

- domaine metier ;
- activite ;
- annee ;
- cible de rangement ;
- simulation de classement.

Elle repond a la question : "Ou le document doit-il etre range ?"

#### Import en masse

La page suit une logique d'assistant :

1. selection des fichiers ou d'un dossier ;
2. choix du contexte de destination ;
3. verification du classement propose ;
4. import final.

Deux choix ont un impact fort :

- **Juste les ranger** : reprise d'archives sans lancement de circuit ;
- **Les ranger et lancer le circuit** : import puis mise au travail documentaire.

Il faut reserver le second mode aux dossiers qui doivent encore suivre un traitement actif.

#### Ma bannette

Dans l'etat actuel de l'application, cette entree renvoie surtout a la **revue de classement**.

Elle doit etre utilisee pour :

- comprendre pourquoi un document n'a pas ete classe automatiquement ;
- corriger le domaine, l'activite, l'annee, la cible ou la categorie ;
- relancer le workflow si le document etait en mode `process`.

Autrement dit, cette bannette sert d'abord a arbitrer les exceptions de classement.

#### A distribuer

Cette page sert a traiter les **etapes orphelines** :

- le systeme a cree une etape ;
- mais aucun utilisateur n'a pu etre resolu automatiquement.

L'admin doit alors designer manuellement l'acteur qui reprend l'etape.

#### Audit et tracabilite

Cette page permet de :

- rechercher une action ;
- filtrer par acteur, objet ou type d'action ;
- expliquer un incident ;
- preparer un controle.

Elle ne sert pas a modifier un document. Elle sert a prouver l'historique.

### Points d'attention UX

- Un document peut etre bien range mais mal route, ou l'inverse.
- Un import "propre" n'est pas seulement un import sans erreur technique ; c'est un import dont le classement est coherent et exploitable.
- La revue de classement doit etre traitee rapidement pour eviter que les documents restent invisibles ou mal places.

## 3. Admin Service

### Mission principale

Suivre l'activite documentaire et la charge de traitement d'un service.

### Page principale

- `Tableau de bord service`

### Parcours typique

1. Ouvrir le **Tableau de bord service**.
2. Verifier les volumes documentaires et les workflows en attente.
3. Identifier les besoins de permission ou de coordination locale.
4. Relayer vers l'`Admin Institution` si le probleme releve du classement global, des roles ou du parametage central.

### Ce que ce profil doit comprendre

- Il supervise un perimetre local, pas toute l'institution.
- Il peut etre implique dans les circuits, mais son role principal ici est le pilotage de proximite.
- Si un dysfonctionnement concerne une regle de classement, un circuit global ou un import de masse, l'escalade doit se faire vers l'`Admin Institution`.

## 4. Responsable

### Mission principale

Prendre une decision sur les etapes de validation, d'approbation, de visa ou de signature.

### Page principale

- `Tasks` / espace de validation

### Parcours typique

1. Ouvrir la pile des dossiers en attente.
2. Identifier le document et l'action attendue.
3. Ouvrir ou consulter le document.
4. Choisir l'action :
   - viser ;
   - approuver ;
   - signer ;
   - rejeter ;
   - accuser reception selon le type d'etape.
5. Verifier ensuite que le dossier disparait de la pile ou passe a l'etape suivante.

### Ce que ce profil doit comprendre

- Le type d'action depend du circuit, pas d'une preference utilisateur.
- Une meme personne peut etre `Responsable` a plusieurs niveaux, mais le bon dossier lui arrive selon la structure hierarchique et le perimetre.
- Si une etape n'arrive pas au bon acteur, ce n'est pas toujours un probleme de role ; cela peut etre un probleme de rattachement organisationnel ou de regle d'assignation.

### Point d'attention UX

- Une pile vide ne veut pas toujours dire "aucun document dans le systeme" ; cela veut dire "aucune decision en attente pour ce profil a cet instant".

## 5. Collaborateur

### Mission principale

Creer ou deposer un document, puis le soumettre au bon circuit.

### Page principale

- `Mon Atelier`

### Parcours typique

1. Ouvrir **Mon Atelier**.
2. Creer un nouveau document.
3. Saisir le titre, la categorie, les tags et joindre le fichier.
4. Enregistrer le document.
5. Une fois le document pret, cliquer sur **Soumettre**.
6. Choisir le valideur si le circuit le demande.
7. Suivre l'etat du document :
   - brouillon ;
   - en validation ;
   - rejete ;
   - signe ou valide.

### Ce que ce profil doit comprendre

- Le depot d'un fichier n'est pas encore une validation administrative.
- Les tags et la categorie ont un impact sur le routage et parfois sur le classement.
- Si le document est bloque ou rejete, il faut verifier le motif et reprendre le contenu, pas simplement reimporter un autre fichier.

## 6. Lecteur

### Mission principale

Consulter les documents autorises sans modifier le contenu ni les circuits.

### Page principale

- `Ma Bibliotheque`

### Parcours typique

1. Ouvrir **Ma Bibliotheque**.
2. Rechercher ou parcourir les documents disponibles.
3. Ouvrir le document pour lecture seule.
4. Verifier le statut et la date si besoin.

### Ce que ce profil doit comprendre

- L'absence de boutons d'action est normale : ce profil consulte, il ne traite pas.
- Selon les politiques internes, un document bloque peut rester visible en lecture seule.
- Si un document attendu n'apparait pas, la cause peut venir :
   - d'un droit d'acces ;
   - d'un classement non finalise ;
   - d'un workflow non acheve ;
   - d'un espace documentaire non partage avec ce profil.

## 7. Auditeur

### Mission principale

Verifier la trace des actions, produire de la preuve et documenter les controles.

### Page principale

- `Audit`

### Parcours typique

1. Ouvrir **Audit**.
2. Filtrer par date, acteur, type d'action ou objet.
3. Reconstituer la chronologie d'un document, d'un utilisateur ou d'une operation d'import.
4. Exporter ou relever les informations utiles au controle.

### Ce que ce profil doit comprendre

- L'audit porte sur les actions, pas sur l'organisation du travail quotidien.
- Une anomalie fonctionnelle doit etre rapprochee d'une trace precise : creation, modification, revue, import, consultation, suppression ou affectation.
- L'audit est aussi utile pour verifier qu'une action automatique du systeme a bien eu lieu.

### Points d'attention UX

- Il faut privilegier les filtres avant d'interpreter les resultats.
- Une action systeme peut apparaitre sans nom d'utilisateur ; ce n'est pas forcement une anomalie.

## Cas transverses a bien expliquer aux utilisateurs

## 1. Difference entre les pages qui parlent de documents

- **Mon Atelier** : je cree et je soumets.
- **Espace de validation** : je decide.
- **Explorateur documentaire** : je controle le rangement et j'ouvre les documents ranges.
- **Bibliotheque** : je consulte en lecture seule.
- **Audit** : je verifie la preuve d'action.

## 2. Difference entre classement et routage

- **Classement** : emplacement logique du document.
- **Routage** : personne ou role qui doit agir sur le document.

Un document peut etre :

- bien classe mais en attente d'affectation ;
- bien route mais mal range ;
- ni bien classe ni bien route, notamment apres un import partiel ou ambigu.

## 3. Difference entre revue de classement et assignation manuelle

- **Revue de classement** : le systeme ne sait pas ou ranger avec certitude.
- **Assignation manuelle** : le systeme ne sait pas a qui confier une etape de circuit.

Ce ne sont pas les memes causes ni les memes actions correctives.

## 4. Import initial vs travail courant

- **Import en masse** sert surtout a reprendre l'existant.
- **Mon Atelier** sert surtout a creer ou deposer des documents courants.

Un utilisateur final ne doit pas utiliser l'import de masse comme substitut du depot quotidien, sauf consigne d'administration.

## 5. Quand consulter l'audit

Consulter l'audit quand il faut repondre a une question de preuve :

- qui a importe ce fichier ;
- qui a valide cette etape ;
- pourquoi le document a change d'etat ;
- quand la revue de classement a ete resolue ;
- si le systeme a bien declenche une action automatique.

## Annexes proposees pour une version suivante

- fiches reflexes "que faire si..."
- captures d'ecran par page
- tableau des statuts documentaires
- tableau des statuts de classement
- matrice simplifiee des droits par profil
- pas-a-pas "onboarding d'une institution"
- pas-a-pas "reprise d'archives par import en masse"
