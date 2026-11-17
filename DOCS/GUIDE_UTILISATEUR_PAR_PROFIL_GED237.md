# Guide utilisateur E-Dossier, par profil

Version décrite : **v1.0.0-rc.1**.

Lisez « Se connecter », puis la page de votre profil. Les noms entre « guillemets » sont ceux que vous voyez à l'écran.

| Votre profil | Votre page |
|---|---|
| Super Admin | [1. Super Admin](#1-super-admin) |
| Admin Institution | [2. Admin Institution](#2-admin-institution) |
| Admin Service | [3. Admin Service](#3-admin-service) |
| Responsable | [4. Responsable](#4-responsable) |
| Collaborateur | [5. Collaborateur](#5-collaborateur) |
| Lecteur | [6. Lecteur](#6-lecteur) |
| Auditeur | [7. Auditeur](#7-auditeur) |

Votre profil est indiqué par l'administrateur qui a créé votre compte.

## Se connecter

1. Dans « Administration / Organisme », choisissez votre institution.
2. Saisissez votre « Matricule Personnel » et votre « Mot de Passe ».
3. Cliquez sur « Étape Suivante ».
4. L'écran « Code MFA » s'ouvre. Le code à 6 chiffres s'affiche déjà rempli : cliquez sur « Confirmer l'identité ». Dans cette version, le code n'est envoyé ni par e-mail ni sur une application de téléphone.
5. Première connexion : choisissez votre mot de passe personnel, puis cliquez sur « Mettre à jour ».
   - Dans « Mot de passe temporaire reçu », tapez le mot de passe donné par l'administration.
   - Votre nouveau mot de passe doit avoir 12 caractères minimum, une majuscule, un chiffre et un caractère spécial.

Bon à savoir :

- Le code est valable 5 minutes. Expiré ? Cliquez sur « Utiliser une autre méthode » et recommencez.
- Après 3 codes faux, le compte est bloqué 15 minutes. L'écran affiche le temps restant.
- « Trop de tentatives » : attendez une minute.
- Mot de passe perdu : le lien « Oublié ? » ne fait rien dans cette version. Demandez un nouveau mot de passe à l'administrateur de votre institution.
- Le cadre « Espace Démo Interactif », sous le formulaire, sert aux démonstrations. Ne vous en servez pas.

## Se repérer

- **Le menu** est à gauche. L'administrateur peut le placer en haut (« Paramètres », « Menu Supérieur »).
- **La barre de recherche** est en haut de l'écran.
  - Sur « Mes Documents », « Explorateur documentaire », « Agents & Rôles » et « À distribuer », elle cherche dans la page ouverte.
  - Ailleurs, elle cherche dans les documents que votre profil peut voir (voir ci-dessous), y compris le texte des fichiers scannés. Les résultats s'affichent sous la barre.
- **Retirer un document** : aucun profil n'a de bouton pour cela dans cette version, et la corbeille n'a pas encore d'écran. Signalez le document à l'administrateur de votre institution : il fait le lien avec l'équipe technique, qui peut aussi récupérer un document supprimé.

## Ce que vous voyez

Chaque profil ne voit que ce qui le concerne. C'est voulu : l'administrateur prépare, chacun travaille sur sa part.

- **Collaborateur** : vos propres documents seulement, dans « Mes Documents » comme dans la recherche.
- **Responsable et Lecteur** : les documents de votre service.
- **Admin Institution, Admin Service et Auditeur** : toute l'institution.
- **Importer pour d'autres agents** (« Import en masse »), l'« Explorateur documentaire » et « Ma bannette » : réservés à l'administrateur. Le Responsable et le Collaborateur n'importent que leurs propres fichiers.

---

## 1. Super Admin

Vous ouvrez les institutions sur la plateforme. Vous ne gérez pas leur travail quotidien.

**À la connexion, vous arrivez sur « Institutions ».**

### Vos 3 gestes

1. **Ouvrir une institution** : dans « Institutions », créez-la, ouvrez sa fiche, puis créez son premier Admin Institution.
2. **Gérer les comptes de la plateforme** : « Utilisateurs ».
3. **Contrôler** : « Audit » pour savoir qui a fait quoi.

### Votre menu

« Dashboard Global », « Institutions », « Utilisateurs », « Gestion AuthZ », « Documents », « Workflows », « Import en masse », « Bibliothèque locale », « Audit », « Paramètres ».

- « Gestion AuthZ » : les règles d'accès communes à toutes les institutions. Ce ne sont pas les circuits de validation.
- « Workflows » : les circuits de validation.

### Bon à savoir

- Ouvrez une institution dans cet ordre : institution, premier administrateur, puis services et agents (par son Admin Institution). Certaines actions restent masquées tant qu'une étape manque.
- Une institution ne doit jamais voir les documents d'une autre. Au moindre doute, consultez « Audit ».

---

## 2. Admin Institution

Vous réglez le fonctionnement de votre institution. Vous traitez les cas que les agents ne peuvent pas régler seuls.

**À la connexion, vous arrivez sur « Tableau de bord ».**

### Vos 3 gestes

1. **« Ma bannette »** : corrigez le rangement des documents que l'application n'a pas su ranger seule (domaine, activité, année, destination), puis cliquez sur « Classer et relancer ».
2. **« À distribuer »** : pour chaque document sans destinataire, choisissez l'agent qui le traite.
3. **« Tableau de bord »** : repérez les alertes du jour.

### Votre menu

« Tableau de bord », « Ma bannette », « À distribuer », « Structure hiérarchique », « Explorateur documentaire », « Agents & Rôles », « Traitement des documents », « Plan de classement », « Import en masse », « Bibliothèque locale », « Audit & Traçabilité », « Rapports & Statistiques », « Paramètres ».

### Mise en service (une seule fois, dans cet ordre)

1. **« Structure hiérarchique »** : créez les services et les bureaux.
2. **« Agents & Rôles »** : créez les comptes et donnez à chacun son profil.
3. **« Traitement des documents »** : qui traite quoi, et dans quel ordre (types de documents, circuits de validation, règles d'aiguillage, simulateur).
4. **« Plan de classement »** : où chaque document est rangé (domaines, activités, règles, simulateur).
5. **« Import en masse »** : reprenez vos archives (voir [Ranger / Importer](#ranger--importer)).
6. **« Explorateur documentaire »** : vérifiez où les documents sont rangés, service par service.

### Les autres pages

- **« Explorateur documentaire »** : les documents rangés, par service. Un document marqué « À vérifier » se corrige dans « Ma bannette ».
- **« Audit & Traçabilité »** : le journal des actions. Voir [7. Auditeur](#7-auditeur).
- **« Rapports & Statistiques »** : les chiffres de toute l'institution.
  - Onglets « Synthèse », « Activité documentaire », « Traitement & délais », « Services ».
  - Choisissez la « Période » et le « Périmètre » (institution entière ou un service).
  - « Exporter la vue » produit un fichier Excel ; sur l'onglet « Activité documentaire », un fichier CSV.
  - « Générer un rapport » produit un fichier Excel, CSV ou PDF. Pour le PDF, la fenêtre d'impression s'ouvre : choisissez « Enregistrer au format PDF ».
- **« Paramètres »** : guide des rôles, position du menu (à gauche ou en haut), liste des unités, liste de contrôle de l'installation. Les sous-titres affichés sous ce menu ne correspondent pas encore à la page.
- **Rechercher un agent** : ouvrez « Agents & Rôles » et tapez dans la barre du haut. Les droits se règlent aussi là.

### Bon à savoir

- « Ma bannette » et « À distribuer » ne traitent pas le même problème :
  - « Ma bannette » : l'application ne sait pas **où ranger** le document ;
  - « À distribuer » : elle ne sait pas **à qui le confier**.
- Un document peut être bien rangé mais sans destinataire, ou l'inverse. Vérifiez les deux.
- Traitez « Ma bannette » vite : un document mal rangé est difficile à retrouver.
- **Archiver un document** : ouvrez le document, cliquez sur « Archiver », puis sur « Oui, archiver ». Seul un document validé ou signé peut être archivé ; son badge passe à « Archivé ». Dans « Mes Documents », le filtre « Archivé » retrouve les documents archivés.

---

## 3. Admin Service

Vous suivez l'activité de votre service.

**À la connexion, vous arrivez sur « Tableau de Bord », dont la page s'appelle « Chef Unité ».**

### Vos 3 gestes

1. **« Tableau de Bord »** : lisez les « Indicateurs du Service » : « Documents », « Workflows en attente » (circuits en cours), « Workflows complétés ».
2. **« Mes Documents »** : consultez les documents. Dans cette version, vous voyez ceux de toute l'institution, pas seulement de votre service.
3. **« Tâches & Suivi »** : traitez les étapes qui vous attendent.

### Votre menu

« Tableau de Bord », « Mes Documents », « Tâches & Suivi », « Ranger / Importer », « Bibliothèque locale ».

### Bon à savoir

- Vous ne créez pas de document. Dans « Ranger / Importer », seul « Ranger sur mon poste » vous concerne.
- Un problème de rangement, de circuit ou d'import concerne toute l'institution : signalez-le à l'Admin Institution.

---

## 4. Responsable

Vous visez, approuvez ou signez les documents.

**À la connexion, vous arrivez sur « Tâches & Suivi », dont la page s'appelle « Tâches & Validations ».**

### Vos 3 gestes

1. **« Tâches & Validations »** : pour chaque document, cliquez sur « Valider » ou « Rejeter ».
2. **« Tableau de Bord »**, page « Espace Manager » : le bouton porte le nom de l'étape : « Viser », « Approuver », « Signer », « J'ai pris connaissance » ou « Valider ».
3. **« Rapports »** : les chiffres de votre service et de ses bureaux.

### Votre menu

« Tableau de Bord », « Mes Documents », « Tâches & Suivi », « Ranger / Importer », « Bibliothèque locale », « Rapports ».

### Bon à savoir

- Pour rejeter, écrivez le motif, puis cliquez sur « Confirmer le rejet ».
- Le type d'action dépend du circuit, pas de vous.
- « Aucune tâche en attente » veut dire : rien à décider pour vous maintenant. Les documents existent toujours.
- Un document ne vous arrive pas, ou arrive à la mauvaise personne ? Signalez-le à l'Admin Institution : c'est souvent un rattachement de service.
- « Rapports » ne montre pas les autres services. C'est normal.
- Vous pouvez aussi déposer un document : « Mes Documents », puis « Nouveau Document ».

---

## 5. Collaborateur

Vous déposez les documents et les envoyez en validation.

**À la connexion, vous arrivez sur « Tableau de Bord », dont la page s'appelle « Mon Atelier ».**

### Vos 3 gestes

1. **Déposer** : « Nouveau Document ». Saisissez le titre, choisissez la catégorie, ajoutez des mots-clés (tags) et joignez le fichier (PDF ou DOCX).
2. **Envoyer en validation** : sur le document, cliquez sur « Soumettre », choisissez le valideur, puis « Soumettre au visa ».
3. **Suivre** : l'état s'affiche sur chaque document : « En Validation », « Rejeté », « Validé » ou « Signé ».

### Votre menu

« Tableau de Bord », « Mes Documents », « Tâches & Suivi », « Ranger / Importer », « Bibliothèque locale ».

### Bon à savoir

- Déposer un fichier ne le valide pas. Il faut le soumettre.
- La catégorie et les tags orientent le document vers la bonne personne. Choisissez-les bien.
- « Aucun valideur disponible » : demandez à l'administrateur.
- Document rejeté : lisez le motif et corrigez le contenu. Ne déposez pas un autre fichier à la place.

---

## 6. Lecteur

Vous consultez les documents. Vous ne les modifiez pas.

**À la connexion, vous arrivez sur « Mes Documents », dont la page s'appelle « Explorateur GED ».**

### Vos 3 gestes

1. **Chercher** : tapez dans la barre du haut (nom, informations du document ou texte du fichier).
2. **Ouvrir** un document pour le lire.
3. **« Tableau de Bord »**, page « Ma Bibliothèque » : les documents validés que vous pouvez lire.

### Votre menu

« Tableau de Bord », « Mes Documents », « Tâches & Suivi », « Ranger / Importer », « Bibliothèque locale ».

### Bon à savoir

- Vous ne voyez pas de bouton d'action : c'est normal.
- Dans « Ranger / Importer », seul « Ranger sur mon poste » vous concerne.
- Un document attendu n'apparaît pas ? Il n'est peut-être pas encore validé, rangé ou partagé avec vous. Demandez à l'administrateur.

---

## 7. Auditeur

Vous vérifiez qui a fait quoi, et quand.

**À la connexion, vous arrivez sur la page « Registre Des Actions ». Pour y revenir, cliquez sur « Tableau de Bord » ou sur « Audit ».**

### Vos 3 gestes

1. **Filtrer** : par date, action, personne (« Effectuée par ») ou registre.
2. **Reconstituer** l'histoire d'un document, d'une personne ou d'un import, ligne par ligne.
3. **Exporter** : « Exporter (CSV) » télécharge les lignes affichées, avec vos filtres.

### Votre menu

« Tableau de Bord », « Mes Documents », « Tâches & Suivi », « Ranger / Importer », « Bibliothèque locale », « Audit ».

### Bon à savoir

- Si vous filtrez sur des personnes, l'export n'en accepte qu'une à la fois.
- L'export s'arrête à 50 000 lignes. Au-delà, réduisez la période ou ajoutez un filtre.
- Filtrez avant de conclure.
- Une ligne sans nom de personne est une action automatique de l'application. Ce n'est pas forcément une anomalie.
- Dans « Ranger / Importer », seul « Ranger sur mon poste » vous concerne.

---

## Pages communes

### « Mes Documents »

La page s'appelle « Explorateur GED ». Elle liste les documents que vous pouvez voir.

- Filtrez par catégorie (« Catégorie : Toutes »). Pour chercher, utilisez la barre du haut.
- « Nouveau Document » apparaît seulement pour l'Admin Institution, le Responsable et le Collaborateur.

### « Tâches & Suivi »

La page s'appelle « Tâches & Validations ». Elle liste les étapes qui vous attendent : « Valider » ou « Rejeter ».

### Ranger / Importer

L'entrée s'appelle « Ranger / Importer », ou « Import en masse » pour les administrateurs. Deux choix :

- **« Ranger sur mon poste »** : l'application range les fichiers dans un dossier de votre ordinateur. Rien n'entre dans E-Dossier. Tous les profils peuvent s'en servir.
- **« Importer dans le Serveur de l'Application »** : les fichiers entrent dans E-Dossier. Réservé à l'Admin Institution, au Responsable et au Collaborateur. Le Responsable et le Collaborateur n'importent que leurs propres fichiers, à leur nom.

L'import se fait en deux temps : l'application analyse les fichiers et propose un rangement ; vous vérifiez, puis vous cliquez sur « Importer les documents ».

- **« Juste les ranger »** : pour des archives. Aucun circuit ne démarre.
- **« Les ranger et lancer le circuit »** : pour des documents qui doivent encore être validés.

Pour un document courant, utilisez plutôt « Nouveau Document ».

**Doublons** : un fichier déjà présent dans E-Dossier est refusé. À l'import, il est marqué « Doublon » et n'entre pas ; au dépôt d'un seul document, un message le signale. La tuile « Doublons refusés » du tableau de bord les compte. Il n'y a pas encore d'écran pour trier les doublons.

### « Bibliothèque locale »

Rangez des fichiers de **votre ordinateur** sans les envoyer dans E-Dossier. Vous récupérez le résultat rangé (dossier ou ZIP). Rien n'est partagé avec vos collègues.

---

## Mots utiles

- **Institution** : votre ministère ou organisme.
- **Service** : une direction, une sous-direction ou une cellule de l'institution. Un **bureau** est un service rattaché à un autre.
- **Circuit** : les étapes qu'un document suit avant d'être validé (visa, approbation, signature, prise de connaissance).
- **Plan de classement** : les règles qui décident où un document est rangé.
- **Bannette** : une liste de documents qui attendent une action de votre part.
- **Journal (audit)** : la trace de toutes les actions. Il prouve ; il ne modifie rien.
