# Cahier de Tests Fonctionnels — GED237

**Formalisme**: chaque test est un **scénario** (cas d'utilisation) avec :

- **Acteur** : qui réalise l'action
- **Pré-conditions** : état du système avant
- **Séquence principale** : le déroulement nominal attendu, étape par étape
- **Scénarios alternatifs** (Axx) : variations légitimes qui dévient mais restent valides
- **Scénarios d'exception** (Exx) : cas d'erreur et comportement attendu
- **Post-conditions** : état du système après

---

## Partie 1 — Préparation

### Environnement

1. Démarrer la base de données et le cache depuis `e:\GED237` : `docker compose up -d postgres redis`
2. Démarrer le serveur applicatif : `cd backend && .\venv\Scripts\Activate.ps1 && uvicorn app.main:app --reload --port 8000`
3. Démarrer l'interface : `cd frontend && npm run dev`
4. Vérifier que http://localhost:5173 affiche l'écran de connexion

### Comptes de test

| Rôle | Identifiant | Mot de passe | Ministère |
|---|---|---|---|
| Administrateur Plateforme | SUPER001 | Admin@2025 | MINFI |
| Administrateur Ministère | MINFI001 | Minfi@2025 | MINFI |
| Responsable de Service | UNIT001 | Unit@2025 | MINFI |
| Valideur | MGR001 | Mgr@2025 | MINFI |
| Agent Rédacteur | MINFI002 | User@2025 | MINFI |
| Lecteur | READ001 | Read@2025 | MINFI |
| Auditeur | AUDIT001 | Audit@2025 | MINFI |

### Documents de test à préparer

- Un courrier PDF (< 1 Mo)
- Un rapport DOCX
- Un formulaire scanné (JPG ou PNG) pour la reconnaissance de texte
- Un dossier PDF de 2 à 5 Mo

---

## Partie 2 — Scénarios d'Authentification

### SC-AUTH-01 : Se connecter à l'application

**Acteur** : Tout utilisateur disposant d'un compte actif

**Pré-conditions** : L'utilisateur dispose d'un identifiant valide et n'est pas déjà connecté

**Séquence principale**

1. L'utilisateur accède à l'écran de connexion
2. Il sélectionne son ministère dans la liste
3. Il saisit son matricule
4. Il saisit son mot de passe
5. Il valide le formulaire
6. Le système affiche l'écran de saisie du code à usage unique (OTP)
7. L'utilisateur saisit le code reçu
8. Il valide
9. Le système ouvre le tableau de bord correspondant à son rôle

**Post-conditions** : L'utilisateur est authentifié et voit l'interface de son profil

**Alternatives**

- **A1 — OTP auto-rempli en environnement de développement** : à l'étape 7, le code est déjà présent dans le champ. L'utilisateur n'a qu'à valider.

**Exceptions**

- **E1 — Identifiant ou mot de passe incorrect** : à l'étape 5, le système affiche "Identifiants invalides" sans préciser ce qui est faux, ne génère pas d'OTP, et reste sur l'écran de connexion.
- **E2 — Code OTP erroné** : à l'étape 8, le système affiche "Code invalide" et permet une nouvelle saisie.
- **E3 — Trois tentatives OTP ratées** : le système bloque temporairement la session et invite à recommencer la connexion.
- **E4 — Compte désactivé** : à l'étape 5, le système refuse avec un message "Compte désactivé, contactez votre administrateur".

---

### SC-AUTH-02 : Prolonger une session active

**Acteur** : Utilisateur connecté depuis plus de 15 minutes

**Pré-conditions** : L'utilisateur est sur une page de l'application, son jeton d'accès va expirer

**Séquence principale**

1. L'utilisateur navigue vers une autre page
2. Le système détecte que le jeton d'accès est expiré
3. Le système utilise silencieusement le jeton de rafraîchissement
4. Un nouveau jeton d'accès est émis
5. La page demandée s'affiche sans que l'utilisateur perçoive l'interruption

**Post-conditions** : La session continue de manière transparente

**Exceptions**

- **E1 — Jeton de rafraîchissement expiré** : à l'étape 3, le système redirige vers l'écran de connexion en conservant la destination voulue.

---

### SC-AUTH-03 : Se déconnecter

**Acteur** : Utilisateur connecté

**Séquence principale**

1. L'utilisateur clique sur son avatar ou sur "Déconnexion"
2. Le système invalide la session
3. L'utilisateur est redirigé vers l'écran de connexion
4. Tout retour en arrière via l'URL est bloqué par une redirection

**Post-conditions** : Aucune information de session ne subsiste

---

## Partie 3 — Scénarios du Rédacteur

### SC-RED-01 : Créer et déposer un document

**Acteur** : Agent Rédacteur (MINFI002)

**Pré-conditions** : L'agent est connecté, au moins une catégorie documentaire existe

**Séquence principale**

1. L'agent ouvre son espace de travail
2. Il clique sur "Nouveau document"
3. Il renseigne le titre du document
4. Il choisit une catégorie
5. Il ajoute des mots-clés (facultatif)
6. Il sélectionne un fichier depuis son ordinateur
7. Il valide
8. Le système enregistre le document avec le statut "Brouillon"
9. Le document apparaît en tête de sa liste personnelle

**Post-conditions** : Un brouillon existe, seul son auteur peut le modifier

**Alternatives**

- **A1 — Dépôt d'un scan** : à l'étape 6, le fichier est une image. Le système déclenche en arrière-plan la reconnaissance de texte. Le contenu devient recherchable après quelques instants.
- **A2 — Ajout d'une description longue** : à l'étape 5, l'agent ajoute aussi une description qui sera visible par les valideurs.

**Exceptions**

- **E1 — Fichier trop volumineux** : à l'étape 7, si le fichier dépasse 100 Mo, le système refuse avec un message clair indiquant la limite.
- **E2 — Titre manquant** : à l'étape 7, le système refuse et marque le champ en erreur.
- **E3 — Format non pris en charge** : pour les fichiers exotiques (exécutables, archives), le système refuse.

---

### SC-RED-02 : Soumettre un brouillon à validation

**Acteur** : Agent Rédacteur

**Pré-conditions** : L'agent possède un document au statut "Brouillon", au moins un circuit de validation est configuré pour sa catégorie

**Séquence principale**

1. L'agent ouvre son brouillon
2. Il clique sur "Soumettre à la validation"
3. Le système propose la liste des circuits applicables
4. L'agent choisit un circuit (par exemple "Visa simple")
5. Il confirme
6. Le document passe au statut "En révision"
7. La première étape du circuit devient active et le premier valideur reçoit la tâche

**Post-conditions** : Le rédacteur ne peut plus modifier le document, le valideur voit une nouvelle tâche

**Alternatives**

- **A1 — Ajout d'un message à destination du valideur** : à l'étape 5, l'agent peut saisir un commentaire qui accompagnera la tâche.

**Exceptions**

- **E1 — Aucun circuit disponible** : à l'étape 3, si la catégorie du document n'a aucun circuit, le système l'indique et propose de contacter l'administrateur.

---

### SC-RED-03 : Corriger un document retourné

**Acteur** : Agent Rédacteur

**Pré-conditions** : Un valideur a retourné un document au statut "Renvoyé" avec un commentaire

**Séquence principale**

1. L'agent reçoit une notification
2. Il ouvre le document concerné
3. Il lit le motif de retour
4. Il dépose une nouvelle version du fichier
5. Il corrige éventuellement le titre, la catégorie ou les mots-clés
6. Il soumet de nouveau à la validation
7. Le circuit redémarre à la première étape

**Post-conditions** : Une nouvelle version est enregistrée, l'historique conserve l'ancienne, le circuit repart

---

### SC-RED-04 : Déposer une nouvelle version d'un document existant

**Acteur** : Agent Rédacteur

**Séquence principale**

1. L'agent ouvre un de ses documents
2. Il clique sur "Nouvelle version"
3. Il sélectionne le fichier corrigé
4. Il ajoute éventuellement un commentaire de version
5. Il valide
6. Le numéro de version courant est incrémenté
7. Les anciennes versions restent consultables dans l'historique

**Post-conditions** : La nouvelle version devient la version courante

---

### SC-RED-05 : Supprimer un brouillon

**Acteur** : Agent Rédacteur

**Pré-conditions** : Le document est au statut "Brouillon"

**Séquence principale**

1. L'agent ouvre son brouillon
2. Il clique sur "Supprimer"
3. Le système demande confirmation
4. L'agent confirme
5. Le document disparaît de sa liste

**Post-conditions** : Le document est supprimé logiquement, il reste récupérable par l'administrateur du ministère

**Exceptions**

- **E1 — Document déjà soumis** : si le statut est "En révision" ou au-delà, l'action de suppression n'est pas proposée.

---

## Partie 4 — Scénarios du Valideur

### SC-VAL-01 : Consulter les dossiers en attente

**Acteur** : Valideur (MGR001)

**Séquence principale**

1. Le valideur ouvre son tableau de bord
2. Il voit la pile des dossiers en attente de décision
3. Chaque ligne indique le titre du document, le rédacteur, la date de soumission et le type d'action attendu

**Post-conditions** : Aucun effet, vue seule

---

### SC-VAL-02 : Viser (approuver) un document

**Acteur** : Valideur

**Pré-conditions** : Le valideur est affecté à une étape active de type "Visa"

**Séquence principale**

1. Le valideur ouvre une tâche
2. Il prévisualise le document
3. Il ajoute un commentaire (facultatif)
4. Il clique sur "Approuver"
5. L'étape passe au statut "Complétée"
6. Si une étape suivante existe, elle devient active et son titulaire est notifié
7. Sinon, le document passe au statut "Validé"

**Post-conditions** : La piste d'audit enregistre la décision et son auteur

---

### SC-VAL-03 : Rejeter un document

**Acteur** : Valideur

**Séquence principale**

1. Le valideur ouvre la tâche
2. Il clique sur "Rejeter"
3. Le système impose la saisie d'un motif
4. Le valideur saisit le motif
5. Il confirme
6. Le document passe au statut "Rejeté"
7. Le circuit est interrompu
8. Le rédacteur reçoit une notification avec le motif

**Post-conditions** : Le document est figé, il ne peut être ni modifié ni repris

**Exceptions**

- **E1 — Motif vide** : à l'étape 5, le système refuse la confirmation.

---

### SC-VAL-04 : Retourner un document pour correction

**Acteur** : Valideur

**Séquence principale**

1. Le valideur ouvre la tâche
2. Il clique sur "Retourner"
3. Il saisit un commentaire d'explication (obligatoire)
4. Il confirme
5. Le document passe au statut "Renvoyé"
6. Le rédacteur reçoit une notification
7. Le rédacteur pourra déposer une nouvelle version et relancer le circuit

**Post-conditions** : Le document redevient modifiable par son auteur

---

### SC-VAL-05 : Signer un document (signature finale)

**Acteur** : Valideur ayant une étape de signature

**Séquence principale**

1. Le valideur ouvre la tâche de signature
2. Il prévisualise le document
3. Il clique sur "Signer"
4. Le système demande confirmation avec l'horodatage
5. Le valideur confirme
6. Le document passe au statut "Signé"
7. Une entrée est ajoutée à la piste d'audit avec l'identité du signataire

**Post-conditions** : Le document est officiellement engagé par la signature

---

## Partie 5 — Scénarios du Responsable de Service

### SC-RESP-01 : Affecter un document sans destinataire

**Acteur** : Responsable de Service (UNIT001)

**Pré-conditions** : Un ou plusieurs documents n'ont pas de destinataire

**Séquence principale**

1. Le responsable ouvre "À affecter"
2. Il sélectionne un document
3. Il choisit un agent de son service comme destinataire
4. Il confirme
5. L'agent reçoit une notification, le document apparaît dans son espace

**Post-conditions** : Le document est rattaché à un destinataire

---

### SC-RESP-02 : Créer un nouvel agent dans son service

**Acteur** : Responsable de Service

**Séquence principale**

1. Le responsable ouvre "Utilisateurs"
2. Il clique sur "Nouvel utilisateur"
3. Il renseigne matricule, nom, prénom, courriel
4. Il choisit un rôle (Rédacteur, Lecteur, Valideur)
5. Le système rattache automatiquement le nouvel agent à son propre service
6. Un mot de passe initial est envoyé par courriel

**Post-conditions** : L'agent peut se connecter et doit changer son mot de passe à la première connexion

**Exceptions**

- **E1 — Matricule déjà existant** : le système refuse et demande de corriger.
- **E2 — Tentative d'affecter à un autre service** : le système l'interdit avec un message expliquant que le responsable ne peut créer que dans son périmètre.

---

## Partie 6 — Scénarios de l'Administrateur du Ministère

### SC-ADM-01 : Consulter la vue d'ensemble du ministère

**Acteur** : Administrateur Ministère (MINFI001)

**Séquence principale**

1. L'administrateur ouvre le tableau de bord
2. Il voit quatre indicateurs clés : documents, dossiers en attente de visa, stockage utilisé, utilisateurs actifs
3. Il voit un récapitulatif des circuits (complétés, en attente, rejetés)
4. Il voit la jauge d'occupation du stockage avec code couleur (vert, jaune, rouge)

**Post-conditions** : Aucun effet

---

### SC-ADM-02 : Exporter les indicateurs

**Acteur** : Administrateur Ministère

**Séquence principale**

1. Depuis le tableau de bord, l'administrateur clique sur "Exporter"
2. Un fichier CSV est téléchargé immédiatement
3. Le fichier contient les sept indicateurs avec leurs valeurs courantes et la date

**Post-conditions** : L'administrateur dispose d'un extrait daté pour reporting

---

### SC-ADM-03 : Organiser la structure du ministère

**Acteur** : Administrateur Ministère

**Séquence principale**

1. L'administrateur ouvre "Organisation"
2. Il voit l'arbre des directions et sous-directions
3. Il ajoute une nouvelle unité (par exemple "Direction des Systèmes d'Information")
4. Il choisit l'unité parente
5. Il sauvegarde
6. L'unité apparaît dans l'arbre et devient disponible pour l'affectation des agents

**Post-conditions** : L'arborescence est mise à jour

**Alternatives**

- **A1 — Renommer une unité** : étapes 3 à 5 adaptées pour modification.
- **A2 — Supprimer une unité** : possible uniquement si l'unité n'a ni sous-unité ni agent rattaché.

---

### SC-ADM-04 : Gérer les comptes du ministère

**Acteur** : Administrateur Ministère

**Séquence principale**

1. L'administrateur ouvre "Utilisateurs"
2. Il filtre ou recherche un agent
3. Il ouvre la fiche de l'agent
4. Il modifie son rôle, son service d'affectation, ou son statut actif
5. Il sauvegarde

**Post-conditions** : Les changements prennent effet à la prochaine connexion de l'agent

**Alternatives**

- **A1 — Désactivation** : l'agent reste dans l'historique mais ne peut plus se connecter.
- **A2 — Réinitialisation du mot de passe** : un nouveau mot de passe initial est envoyé par courriel.

---

### SC-ADM-05 : Définir une règle de classement automatique

**Acteur** : Administrateur Ministère

**Pré-conditions** : Au moins une catégorie documentaire existe

**Séquence principale**

1. L'administrateur ouvre "Règles métier"
2. Il clique sur "Nouvelle règle"
3. Il nomme la règle (ex : "Factures → Comptabilité")
4. Il définit la condition (ex : catégorie égale à "Facture")
5. Il définit l'action (ex : notifier l'unité "Comptabilité")
6. Il active la règle
7. Il sauvegarde

**Post-conditions** : Tout nouveau document correspondant à la condition déclenchera l'action

**Alternatives**

- **A1 — Simuler avant d'activer** : l'administrateur peut tester la règle sur des documents existants sans impact réel.
- **A2 — Enchaîner plusieurs actions** : une règle peut déclencher à la fois une notification, une assignation et un changement de catégorie.

---

### SC-ADM-06 : Créer un circuit de validation

**Acteur** : Administrateur Ministère

**Séquence principale**

1. L'administrateur ouvre "Circuits de validation"
2. Il clique sur "Nouveau circuit"
3. Il nomme le circuit (ex : "Double signature Marchés")
4. Il ajoute la première étape : type "Visa", affectée au responsable du service émetteur
5. Il ajoute la deuxième étape : type "Signature finale", affectée à un responsable de direction
6. Il associe ce circuit à une ou plusieurs catégories documentaires
7. Il sauvegarde

**Post-conditions** : Le circuit est proposé aux agents quand ils soumettent un document de cette catégorie

---

### SC-ADM-07 : Traiter les documents à revoir

**Acteur** : Administrateur Ministère

**Pré-conditions** : Le système a signalé des documents mal classés ou litigieux

**Séquence principale**

1. L'administrateur ouvre "Documents à revoir"
2. Il voit la liste des documents signalés avec la raison
3. Il ouvre un document
4. Il corrige le dossier de rangement, la catégorie ou le nom de fichier
5. Il coche "Marquer comme résolu"
6. Il valide
7. Le document sort de la file et peut, si besoin, générer une suggestion de nouvelle règle

**Post-conditions** : Le document est requalifié, l'apprentissage du moteur peut s'enrichir

---

### SC-ADM-08 : Importer un lot de documents depuis un dossier

**Acteur** : Administrateur Ministère

**Séquence principale**

1. L'administrateur ouvre "Import en masse"
2. Il indique le chemin d'un dossier à traiter
3. Il lance l'import
4. Le système scanne le dossier, dépose chaque fichier, applique les règles de classement
5. Un compte rendu affiche : fichiers importés, fichiers en erreur, fichiers déjà présents (doublons)

**Post-conditions** : Les fichiers sont rattachés au ministère, classés automatiquement quand la règle s'applique

**Exceptions**

- **E1 — Doublons** : les fichiers déjà présents dans la GED sont ignorés avec un message.
- **E2 — Fichier corrompu** : signalé dans le rapport, non importé.

---

### SC-ADM-09 : Consulter la piste d'audit du ministère

**Acteur** : Administrateur Ministère

**Séquence principale**

1. L'administrateur ouvre "Audit"
2. Il voit la liste chronologique des actions effectuées sur son ministère
3. Il filtre par table (documents, utilisateurs, circuits) ou par type d'action (création, modification, suppression)
4. Il identifie l'auteur et la date de chaque action

**Post-conditions** : Aucun effet

---

## Partie 7 — Scénarios de l'Administrateur Plateforme

### SC-PLAT-01 : Consulter la vue nationale

**Acteur** : Administrateur Plateforme (SUPER001)

**Séquence principale**

1. Il ouvre son tableau de bord
2. Il voit le nombre total de ministères, d'utilisateurs, de documents, et le stockage global

**Post-conditions** : Aucun effet

---

### SC-PLAT-02 : Administrer les règles d'accès

**Acteur** : Administrateur Plateforme

**Séquence principale**

1. Il ouvre la page "Gestion des accès"
2. Il consulte les règles existantes (rôle, ressource, action)
3. Il ajoute une règle : un rôle donné, une ressource, une action
4. Il valide
5. La règle devient active immédiatement, sans redémarrage

**Post-conditions** : Les nouvelles autorisations s'appliquent à la prochaine requête concernée

**Alternatives**

- **A1 — Supprimer une règle** : par la même page, avec confirmation.

---

### SC-PLAT-03 : Surveiller la santé du contrôle d'accès

**Acteur** : Administrateur Plateforme

**Séquence principale**

1. Il ouvre l'onglet "Santé"
2. Il voit si le service fonctionne normalement
3. Il voit le nombre d'événements rejetés faute de capacité (doit être zéro en fonctionnement normal)

**Post-conditions** : Aucun effet

---

### SC-PLAT-04 : Analyser les rejets d'accès

**Acteur** : Administrateur Plateforme

**Séquence principale**

1. Il ouvre l'onglet "Métriques"
2. Il filtre sur les décisions de type "refus"
3. Il identifie les rôles et ressources qui génèrent le plus de refus
4. Il peut ajuster les règles si un refus est injustifié

**Post-conditions** : Les règles éventuellement corrigées prennent effet

---

## Partie 8 — Scénarios du Lecteur

### SC-LEC-01 : Rechercher un document

**Acteur** : Lecteur (READ001)

**Séquence principale**

1. Le lecteur saisit des mots-clés dans la barre de recherche
2. Le système affiche les documents correspondants auxquels il a accès
3. Il ouvre un document
4. Il consulte les métadonnées et le contenu
5. Il télécharge le fichier s'il en a le droit

**Post-conditions** : L'action de consultation est tracée dans l'audit

**Alternatives**

- **A1 — Recherche par catégorie** : le lecteur restreint à une catégorie.
- **A2 — Recherche dans les scans** : les documents numérisés sont trouvés grâce à la reconnaissance de texte.

**Exceptions**

- **E1 — Aucun résultat** : le système affiche "Aucun document trouvé".

---

## Partie 9 — Scénarios de l'Auditeur

### SC-AUD-01 : Examiner le journal des actions

**Acteur** : Auditeur (AUDIT001)

**Séquence principale**

1. L'auditeur ouvre "Compliance"
2. Il voit la liste chronologique des actions du ministère
3. Il applique un filtre sur la table ou sur le type d'action
4. Il identifie pour chaque entrée : horodatage, utilisateur, type d'action, ressource concernée

**Post-conditions** : Aucun effet, consultation seule

---

## Partie 10 — Scénarios Transverses de Bout en Bout

### SC-E2E-01 : Cycle complet d'un dossier officiel

**Objectif** : prouver que le système assure le cheminement d'un document de sa création à sa consultation par un tiers, avec traçabilité.

**Acteurs successifs** : Rédacteur → Valideur → Responsable → Administrateur → Lecteur → Auditeur

**Séquence principale**

1. *(Rédacteur MINFI002)* Dépose un dossier PDF "Marchés publics T1 2026", catégorie "Marché public"
2. *(Rédacteur)* Soumet au circuit "Double signature Marchés"
3. *(Valideur MGR001)* Reçoit la tâche, consulte, approuve avec commentaire "Conforme premier niveau"
4. *(Responsable UNIT001)* Reçoit l'étape de signature, signe
5. Le document passe au statut "Signé" et notifie le rédacteur
6. *(Administrateur MINFI001)* Archive le document
7. *(Lecteur READ001)* Recherche "Marchés publics T1" et consulte le document archivé
8. *(Auditeur AUDIT001)* Ouvre l'audit filtré sur ce document, voit les cinq entrées correspondantes : dépôt, soumission, visa, signature, archivage

**Post-conditions** : Le dossier est scellé, consultable, et sa piste d'audit est complète

---

### SC-E2E-02 : Rejet au cours du circuit

**Séquence principale**

1. *(Rédacteur)* Dépose et soumet un document
2. *(Valideur)* Détecte une erreur, rejette avec motif "Montants erronés"
3. Le document passe au statut "Rejeté", le circuit est interrompu
4. *(Rédacteur)* Reçoit la notification et lit le motif
5. *(Rédacteur)* Ne peut plus modifier : il devra créer un nouveau document

**Post-conditions** : Le document rejeté est figé et conservé pour audit

---

### SC-E2E-03 : Retour pour correction

**Séquence principale**

1. *(Rédacteur)* Dépose et soumet
2. *(Valideur)* Retourne avec commentaire "Titre à reformuler"
3. *(Rédacteur)* Modifie le titre, dépose une nouvelle version, resoumet
4. *(Valideur)* Approuve
5. Le circuit continue normalement

**Post-conditions** : Le document porte deux versions, le circuit a une trace complète

---

## Partie 11 — Scénarios d'Isolation et de Sécurité

### SC-SEC-01 : Un agent ne peut pas voir un document d'un autre ministère

**Acteur** : Agent du ministère A, document appartenant au ministère B

**Séquence principale**

1. L'agent du ministère A saisit dans la barre d'adresse un identifiant de document du ministère B (obtenu autrement)
2. Le système refuse l'accès avec un message "Ressource introuvable"
3. L'événement est tracé dans l'audit comme tentative d'accès refusée

**Post-conditions** : Aucune fuite d'information

---

### SC-SEC-02 : Un rédacteur ne peut pas valider un document

**Séquence principale**

1. Un rédacteur tente, par tout moyen, de changer le statut d'un document de "En révision" vers "Validé"
2. Le système refuse : seul un valideur affecté à une étape peut faire avancer un circuit

**Post-conditions** : L'intégrité du circuit est préservée

---

### SC-SEC-03 : Un document signé ne peut pas être modifié

**Séquence principale**

1. Un utilisateur, quel que soit son rôle, tente de modifier le fichier ou les métadonnées d'un document au statut "Signé"
2. Le système refuse

**Post-conditions** : L'intégrité de la signature est garantie

---

## Partie 12 — Scénarios des Notifications

### SC-NOT-01 : Être alerté d'une tâche à faire

**Séquence principale**

1. Un document est soumis à un valideur
2. Le valideur voit un point rouge sur l'icône de notifications
3. Il ouvre le panneau
4. Il voit l'entrée "Nouveau dossier à viser : [titre]"
5. Il clique, il est amené directement sur la tâche

**Post-conditions** : La notification passe en "Lue"

**Alternatives**

- **A1 — Tout marquer comme lu** : un bouton global au-dessus de la liste.

---

## Partie 13 — Clôture

### Validation Go / No-Go

Le système est accepté si :

- Tous les scénarios de la Partie 2 fonctionnent pour tous les rôles
- Le scénario SC-E2E-01 (cycle complet) se déroule sans blocage technique
- Les scénarios SC-SEC-01 à SC-SEC-03 sont tenus : aucune fuite, aucune escalade
- La piste d'audit reflète fidèlement chaque action de chaque scénario
- Aucun scénario d'exception (E1, E2…) ne conduit à un écran blanc ou à une erreur non expliquée

### Relevé d'anomalies

Pour chaque écart constaté, noter :

- Numéro du scénario (ex : SC-RED-02)
- Étape exacte où survient l'écart
- Comportement attendu (selon la séquence principale)
- Comportement observé
- Impression d'écran si pertinent
- Reproductibilité (systématique ou intermittent)

---

**Fin du cahier de tests.**
