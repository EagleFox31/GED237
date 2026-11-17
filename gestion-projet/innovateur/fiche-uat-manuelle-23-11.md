# Fiche de passage — UAT manuelle du 23/11 sur la release

- **Pour** : O, qui la déroule sur `release/v1.0.0` (rc.1), poste principal, jeu de démo remis à zéro.
- **Source** : `criteres-acceptation.md` § 2 (version du 17/11, branche `docs/notes-version-rc1`), une ligne par critère, dans l'ordre de `scenario-demo-30-11.md`, groupées par compte de connexion. Libellés vérifiés sur b701314.
- **Comptes** : seulement le rôle et l'identifiant. Les mots de passe sont ceux du jeu de démo et ne figurent pas ici.
- **Durée** : 90 min au plus. ★ = indispensable (≈ 65 min) ; ○ = facultatif, à jouer s'il reste du temps. Les lignes « Q » ne se rejouent pas à la main : on reporte le verdict du rapport de Q.
- **Remplir** : `OK`, `KO` ou `—` (non joué) ; en remarque, l'heure et ce qui a été vu. Un KO hors de la liste ci-dessous est une anomalie nouvelle.

## Anomalies connues et contournées : ne pas les reporter comme nouvelles

| Réf. | Ce que vous verrez | Contournement | Suite |
|---|---|---|---|
| E23 | Admin Service : « Gérer les Permissions » ne fait rien | passer par l'Admin Institution | réponse du PO (Q6) |
| E24 | Accents manquants : « A verifier » (Explorateur), « Parametres » (menu du super admin) | aucun, simple libellé | réponse du PO (Q6) |
| E25 | Auditeur : pas d'entrée « Audit » dans le menu ; il arrive sur « Registre Des Actions » | revenir par « Tableau de Bord » | réponse du PO (Q6) |
| Admin Service | Il voit et cherche dans toute l'institution, pas seulement son service | limite annoncée dans les notes rc.1 | V1.1 (#215) |
| Code de connexion | Le code n'est pas reçu : il est pré-rempli à l'écran ; le cadre « Espace Démo Interactif » est visible | cliquer sur « Confirmer l'identité » | après le 30 (#154) |
| Hors rc.1 | Pas de corbeille à l'écran, pas de numérotation des rapports, pas de TOTP, pas de dépôt de version à l'écran | non joués | après le 30 |
| Lien « Oublié ? » | Ne fait rien | demander un mot de passe à l'administrateur | V1.1 |

## 0. Avant de commencer (5 min) ★

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| Prépa 1 | — | Jeu remis à zéro, dossier `live` présent sur le poste | rapport de Q du jour | | |
| Prépa 2 | `MINFI002` (collaborateur DAF) | Avant la séance : un document déposé puis « Soumettre » → « Soumettre au visa » vers `MGR001` | il apparaît chez `MGR001` (sert à SC-VAL-01) | | |

## 1. `MINFI001` — Admin Institution MINFI (≈ 30 min)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ Connexion | `MINFI001` | « Administration / Organisme » → MINFI, « Matricule Personnel », « Mot de Passe », « Étape Suivante », « Confirmer l'identité » | arrivée sur « Tableau de bord » ; menu admin complet | | |
| ★ SC-ADM-05 (partiel) | `MINFI001` | « Plan de classement » → « Règles de classement » | la règle de démo est listée, avec sa priorité, **Active** | | |
| ★ SC-ADM-08 | `MINFI001` | « Import en masse » → « Importer dans le Serveur de l'Application » → « Juste les ranger » → dossier `live` → « Vérifier le classement » → « Importer les documents » | compteurs : importés = N−2, doublons = 2, à revoir = 2 ; moins de 60 s pour ≤ 50 fichiers | | |
| ○ P2 étape 8 | `MINFI001` | Refaire le même import | importés = 0, doublons = N, aucun document créé | | |
| ★ SC-E2E-01 (classement) | `MINFI001` | « Explorateur documentaire » : DAF → domaine → activité → année | les fichiers couverts par les règles sont à la destination attendue ; ≥ 95 % (C2 local) | | |
| ○ SC-ADM-05 | `MINFI001` | « Règles de classement » : créer « si nom contient X et type PDF alors domaine D, activité A » | règle visible dans la liste, **inactive** par défaut | | |
| ★ SC-ADM-06 | `MINFI001` | « Simulateur » du « Plan de classement » sur la règle inactive | tableau document / destination actuelle / destination proposée, ≥ 1 ligne ; aucun document n'a bougé dans l'Explorateur | | |
| ★ SC-ADM-07 | `MINFI001` | « Ma bannette » (page « Revue de classement ») : un document à revoir, raison lisible → service, domaine, activité, année → « Classer et relancer » | le document quitte la file, apparaît à destination dans l'Explorateur, compteur « à classer » −1 | | |
| ○ P3 étape 7 | `MINFI001` | Activer la règle, puis « Classer et relancer » sur un document qu'elle couvre | sa destination devient celle de la règle | | |
| ★ SC-SEC-02 | `MINFI001` | Barre de recherche : un terme présent seulement dans MINESUP | 0 résultat ; aucun titre MINESUP visible | | |
| ○ Historique | `MINFI001` | Fiche d'un document versionné → onglet « Historique des Versions » | les versions sont listées | | |
| ○ P1 étape 5 | `MINFI001` | F5 sur n'importe quelle page | même page, même profil, pas de retour à la connexion | | |

## 2. `MGR001` — Responsable DAF (≈ 20 min)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ SC-LEC-01 | `MGR001` | Barre de recherche : le mot-clé du jeu (présent dans 3 documents DAF) | 3 résultats, temps affiché < 2 s, le clic ouvre la fiche | | |
| ★ SC-VAL-01 | `MGR001` | « Tâches & Suivi » (page « Tâches & Validations ») | le document de Prépa 2 est là, avec son étape ; aucun bouton pour modifier le contenu | | |
| ★ SC-VAL-02 | `MGR001` | « Valider » sur ce document | il passe à l'étape suivante (ou Validé) ; le rédacteur ne peut plus le modifier | | |
| ★ SC-VAL-03 | `MGR001` | Sur un 2ᵉ document en attente : « Rejeter » sans motif, puis avec motif → « Confirmer le rejet » | sans motif : refus ; avec motif : statut **Rejeté** | | |
| ★ Rapports | `MGR001` | « Rapports » : « Traitement & délais », puis « Services » | chiffres de la DAF seulement ; pas d'onglet « Synthèse » ; pas les autres services | | |
| ○ SC-LEC-02 | `MGR001` | Documents du service → ouvrir une fiche → « Télécharger » | métadonnées affichées ; le fichier téléchargé est l'original | | |
| ○ SC-ESP-01 | `MGR001` | Filtres domaine → activité (liste dépendante) → année, puis « Réinitialiser » | liste et compteur cohérents à chaque choix ; « Réinitialiser » vide les filtres | | |
| ○ Pagination | `MGR001` | Liste > 50 documents → page 2 | la page 2 se charge, le compteur ne change pas | | |
| Q SC-RED-01 (manager) | `MGR001` | Brouillon de `MINFI002` visible ou non | `À vérifier` en recette : reporter le constat de Q | | |

## 3. `READ001` — Lecteur DSI (≈ 8 min)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ SC-SEC-01 | `READ001` | Même mot-clé qu'en SC-LEC-01 | 0 résultat DAF ; pas d'erreur | | |
| ★ SC-SEC-03 | `READ001` | Parcourir « Mes Documents » | pas de bouton « Nouveau Document » ; pas de bouton d'action | | |
| ○ Menu lecteur | `READ001` | Ouvrir le menu | « Tableau de Bord », « Mes Documents », « Tâches & Suivi », « Ranger / Importer », « Bibliothèque locale » ; pas de « Rapports » | | |

## 4. `AUDIT001` — Auditeur (≈ 10 min)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ SC-AUD-01 | `AUDIT001` | Arrivée sur « Registre Des Actions » (E25) ; filtre « Effectuée par » = `MINFI001` | les actions du jour (import, revue, recherche) sont en tête, avec heure, auteur, objet ; aucun bouton d'écriture | | |
| ★ SC-ADM-09 | `AUDIT001` | Dans le registre : une connexion, un dépôt, un import | une ligne pour chacun | | |
| ★ SC-AUD-02 | `AUDIT001` | Même filtre → « Exporter (CSV) » → ouvrir dans le tableur | le fichier contient les lignes du filtre (heure, auteur, objet) ; une personne à la fois | | |
| ○ SC-SEC-04 | `AUDIT001` | Ouvrir une page où l'écriture est refusée | l'écran reste utilisable, la liste ne se vide pas | | |

## 5. `MINFI002` — Collaborateur DAF (≈ 15 min, hors démo en direct)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ SC-AUTH-01 E1 | `MINFI002` | Mauvais mot de passe | « Échec de connexion. Vérifiez vos identifiants. », sans dire lequel ; pas de session | | |
| ★ SC-AUTH-01 | `MINFI002` | Connexion normale | « Tableau de Bord » (page « Mon Atelier ») en < 5 s ; institution MINFI | | |
| ★ SC-RED-01 | `MINFI002` | « Mes Documents » → « Nouveau Document » : titre, catégorie, PDF < 1 Mo | document en **Brouillon**, visible par son auteur | | |
| ○ SC-RED-01 E1 | `MINFI002` | Fichier au-delà de la limite | message qui donne la limite | | |
| ★ SC-VAL-04 | `MINFI002` | Ouvrir le document rejeté en SC-VAL-03 | statut **Rejeté** et motif visibles ; aucune action de modification | | |
| ★ SC-AUTH-03 | `MINFI002` | Se déconnecter, puis bouton Précédent du navigateur | retour à la connexion ; l'application ne se rouvre pas | | |
| ○ SC-AUTH-02 | `MINFI002` | Connexion avec un code modifié à la main | « Code invalide » ; nouvelle saisie possible | | |
| ○ SC-AUTH-02 E3 | compte dédié, **pas** un compte de la démo | 3 codes faux | compte bloqué 15 min, compte à rebours à l'écran | | bloque le compte : à jouer en dernier |

## 6. Prouvés par Q, pas rejoués à la main

| ID | Preuve à reporter | OK / KO | Remarque |
|---|---|---|---|
| Q SC-AUTH-03 (API) | ancien jeton → 401 | | |
| Q SC-ESP-01 (API) | une requête par changement de filtre ; URL invalide ignorée | | |
| Q Corbeille exclue | document en corbeille absent de la recherche (API) | | |
| Q SC-RED-05/06 | suppression puis restauration (pytest) | | |
| Q SC-RED-04 | nouvelle version, ancienne lisible, écriture concurrente refusée (pytest) | | |

## Verdict

- ★ tous OK ou KO connus ci-dessus : **GO** pour le tag.
- Un ★ en KO nouveau : tri selon `plan-recette-20-23-11.md` § 3.
