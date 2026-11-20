# Recette du lundi 23/11, 18:00 — fiche du PO et détail pour O

# Partie 1 — Fiche du PO (une page)

- **Où** : `main` (décision du PO du 19/11 : l'UAT se joue sur `main`, pas sur la release coupée), jeu de démo remis à zéro. Durée : environ 1 h.
- **Comptes** : l'identifiant suffit ; le mot de passe vous est remis à part.
- **Comment** : jouez les profils dans l'ordre, car chacun prépare le suivant. Cochez OK si vous voyez ce qui est écrit, KO sinon, avec un mot en remarque.
- **Déjà connus, à ne pas noter KO** :
  - le code de connexion est déjà rempli à l'écran : cliquez sur « Confirmer l'identité » ;
  - la recherche tient compte des accents : tapez « Décret », pas « decret » ;
  - aucun message ne confirme un dépôt ou une soumission : regardez la liste ;
  - les autres comportements connus sont listés dans la checklist d'UAT, § 6 ;
  - l'écriture à la main n'est pas lue : seul le texte imprimé l'est, en scan ou en photo.
- **Réf.** : le numéro du critère du cahier des charges, pour Q. ⚠ = pas encore de test automatique : votre coche est la seule preuve.
- **Mise à jour du 18/11** : cas photo (agent, 3 bis et 6 bis) et administrateur d'unité (§ 3 bis) ajoutés. #203, #358 et #360 sont fusionnées sur `main` (17498b5, 4fcd8d9, 8ceae3b) : les cas de l'administrateur d'unité se jouent sans condition.

## 1. Agent — `MINFI002` (collaborateur, Direction des affaires financières)

| # | Faites | Vous devez voir | OK | KO | Réf. |
|---|---|---|---|---|---|
| 1 | Connectez-vous avec un **mauvais** mot de passe | « Échec de connexion. Vérifiez vos identifiants. », sans dire ce qui est faux | ☐ | ☐ | SC-AUTH-01 |
| 2 | Connectez-vous normalement | votre accueil en moins de 5 secondes, au nom du MINFI | ☐ | ☐ | SC-AUTH-01 |
| 3 | « Mes Documents » → « Nouveau Document » : titre, catégorie, un PDF → « Envoyer ». Si « Envoyer » n'est pas visible, faites défiler la fenêtre (inutile si #450 est dans `main`). Faites-le pour **deux** PDF | les deux documents apparaissent dans la liste « Mes Documents », en **Brouillon** (pas de message de confirmation) | ☐ | ☐ | SC-RED-01 |
| 3 bis | « Nouveau Document » deux fois : `IMG_0412.jpg`, puis `IMG_0413.jpg` (dossier `demo-ocr` remis par O). Notez l'heure | les deux documents apparaissent ; le texte de l'image est lu en arrière-plan, vous pouvez continuer | ☐ | ☐ | OCR ⚠ |
| 4 | Recommencez avec un fichier de plus de 100 Mo | un message qui donne la limite ; rien n'est déposé | ☐ | ☐ | SC-RED-01 ⚠ (le refus est testé, pas le message) |
| 5 | Menu « Tableau de Bord » (page « Mon Atelier ») : sur la carte du premier PDF, « Soumettre » → choisissez `MGR001` → « Soumettre au visa ». Recommencez avec le second PDF. (« Soumettre » n'existe pas dans « Mes Documents ».) | le statut des deux documents change : ils partent en validation | ☐ | ☐ | SC-VAL-01 (test de nuit) |
| 6 | Depuis « Tableau de Bord », barre de recherche en haut : un mot présent dans vos documents, avec ses accents exacts (« Décret », pas « decret ») | les documents attendus ; un clic ouvre la fiche. Ouvrez ainsi un des deux PDF du n° 3 et notez l'adresse du navigateur (elle finit par `?open=…`) : elle sert au § 3 bis. Un clic dans « Mes Documents » ne change pas l'adresse | ☐ | ☐ | SC-LEC-01 |
| 6 bis | Depuis « Tableau de Bord », barre de recherche en haut : `photocopieurs`, puis `agrafeuses`. Notez l'heure du premier résultat | `photocopieurs` : 1 résultat, `IMG_0412.jpg` ; `agrafeuses` : 1 résultat, `IMG_0413.jpg`. Attente : le texte est prêt en moins d'une minute après l'envoi (limite 30 s par photo) ; à ce stade, il l'est déjà | ☐ | ☐ | OCR ⚠ (document « en cours » plus de 10 min : anomalie « Lecture bloquée ») |
| 7 | Déconnectez-vous, puis bouton « Précédent » du navigateur | vous restez sur l'écran de connexion | ☐ | ☐ | SC-AUTH-03 |

## 2. Manager — `MGR001` (responsable DAF)

| # | Faites | Vous devez voir | OK | KO | Réf. |
|---|---|---|---|---|---|
| 1 | Ouvrez « Tâches & Suivi » | les deux documents soumis par l'agent ; aucun bouton pour changer leur contenu | ☐ | ☐ | SC-VAL-01 |
| 2 | « Valider » le premier. Bon à savoir : sur « Tableau de Bord », où vous arrivez à la connexion, le même geste s'appelle « Viser » et demande une confirmation ; dans « Tâches & Suivi », « Valider » agit tout de suite | il passe à l'étape suivante, ou à « Validé » | ☐ | ☐ | SC-VAL-02 |
| 3 | Sur le second : « Rejeter » sans motif, puis avec un motif | sans motif : impossible ; avec motif : **Rejeté** | ☐ | ☐ | SC-VAL-03 |
| 4 | Cherchez le mot-clé du jeu de démo | 3 résultats en moins de 2 secondes | ☐ | ☐ | SC-LEC-01 (durée mesurée par Q le 17/11 : p95 de 20 ms) |
| 5 | Tapez l'adresse de la page `/spaces` (elle n'est pas dans le menu). Filtrez par domaine, puis activité, puis année ; puis cliquez sur l'icône d'entonnoir barré (« Réinitialiser les filtres » au survol, visible dès qu'un filtre est choisi) | la liste et le compteur suivent chaque choix ; tout revient à zéro | ☐ | ☐ | SC-ESP-01 |
| 6 | Ouvrez une fiche → « Télécharger » | les informations du document ; le fichier reçu est l'original | ☐ | ☐ | SC-LEC-02 |
| 7 | Ouvrez « Rapports » | les chiffres de votre direction seulement, pas ceux des autres | ☐ | ☐ | rapports |

## 3. Administrateur — `MINFI001` (administrateur du MINFI)

| # | Faites | Vous devez voir | OK | KO | Réf. |
|---|---|---|---|---|---|
| 1 | « Import en masse » → dossier `live` → « Vérifier le classement » → « Importer les documents » | un compte rendu : importés, doublons (2), à revoir (2), en moins d'une minute | ☐ | ☐ | SC-ADM-08 |
| 2 | Refaites exactement le même import | rien de nouveau : tout est signalé en doublon | ☐ | ☐ | SC-ADM-08 ⚠ |
| 3 | « Explorateur documentaire » : direction → domaine → activité → année | les documents importés sont rangés au bon endroit | ☐ | ☐ | SC-E2E-01 (taux testé : 357/357) |
| 4 | « Règles de classement » : créez une règle en **décochant** « Règle active dès l'enregistrement » (cochée par défaut), puis lancez le « Simulateur » | la liste des documents et de leur nouvelle place ; **aucun document n'a bougé** | ☐ | ☐ | SC-ADM-05, 06 ⚠ (« rien ne bouge » non testé) |
| 5 | « Ma bannette » : classez un document à revoir → « Classer et relancer » | il quitte la file et apparaît à sa place | ☐ | ☐ | SC-ADM-07 |
| 6 | Cherchez un mot présent **seulement** dans les documents du MINESUP | aucun résultat, aucun titre du MINESUP | ☐ | ☐ | SC-SEC-02 (testé côté serveur) |
| 7 | Rechargez la page (F5) | même page, toujours connecté | ☐ | ☐ | GUARD-06 |

## 3 bis. Administrateur d'unité — `UNIT001` (DRH)

| # | Faites | Vous devez voir | OK | KO | Réf. |
|---|---|---|---|---|---|
| 1 | Ouvrez la liste des documents, puis le tableau de bord | les documents et les chiffres de la DRH et de ses sous-unités seulement | ☐ | ☐ | #203 |
| 2 | Cherchez le mot-clé du jeu de démo (celui du chef, n° 4) | aucun résultat : ces documents sont à la DAF | ☐ | ☐ | #203 |
| 3 | Collez l'adresse du document de la DAF notée par l'agent (§ 1, n° 6, elle finit par `?open=…`) | « introuvable » ; ni titre ni contenu | ☐ | ☐ | #203 (404) |

Les comptes et l'organigramme ne sont pas à l'écran pour l'administrateur d'unité (pages réservées à l'administrateur d'institution). Le refus de créer ou de déplacer un compte hors de la DRH est prouvé par Q (#360).

## 4. Auditeur — `AUDIT001`

| # | Faites | Vous devez voir | OK | KO | Réf. |
|---|---|---|---|---|---|
| 1 | Menu de gauche → « Audit » (page « Registre Des Actions ») | les actions de la séance (dépôt, validation, import, classement), avec l'heure et l'auteur | ☐ | ☐ | SC-AUD-01, SC-ADM-09 |
| 2 | Filtrez sur l'auteur `MINFI001` | ses seules actions | ☐ | ☐ | SC-AUD-01 |
| 3 | Retrouvez la connexion et le dépôt de `MINFI002` | une ligne pour chacun | ☐ | ☐ | SC-ADM-09 |
| 4 | « Exporter (CSV) », puis ouvrez le fichier dans le tableur | les mêmes lignes que l'écran : heure, auteur, action. Le filtre prend une personne à la fois | ☐ | ☐ | SC-AUD-02 |
| 5 | Cherchez un bouton pour déposer ou modifier | aucun ; l'écran reste utilisable | ☐ | ☐ | SC-SEC-03, 04 |

## Verdict du PO

- ☐ **Tout est OK**, ou les KO sont déjà connus (liste ci-dessus) : bon pour le tag du 24/11.
- ☐ **Un KO nouveau** : notez le profil, le numéro et ce que vous avez vu. O le trie le soir même.

Signature : ______________________ Date : 23/11/2026

# Partie 2 — Détail pour O

- **Pour** : O, qui la déroule sur `main` (décision du PO du 19/11), poste principal, jeu de démo remis à zéro. Si #441, #450 et #442 y sont fusionnées après la coupe (DEC-2026-013), `main` diffère du SHA coupé de ces trois écrans : le noter dans le relevé.
- **Source** : `criteres-acceptation.md` § 2 (version du 17/11, branche `docs/notes-version-rc1`), une ligne par critère, dans l'ordre de `scenario-demo-30-11.md`, groupées par compte de connexion. Libellés vérifiés sur b701314 ; écarts de la relecture du 19/11 (comptes et organigramme de l'unité, `/spaces`, adresse `?open=`, règle active par défaut, anomalies E23, E24 et « Oublié ? » retirées car corrigées) vérifiés sur `main` f890b3cb.
- **Comptes** : seulement le rôle et l'identifiant. Les mots de passe sont ceux du jeu de démo et ne figurent pas ici.
- **Durée** : 90 min au plus. ★ = indispensable (≈ 65 min) ; ○ = facultatif, à jouer s'il reste du temps. Les lignes « Q » ne se rejouent pas à la main : on reporte le verdict du rapport de Q.
- **Remplir** : `OK`, `KO` ou `—` (non joué) ; en remarque, l'heure et ce qui a été vu. Un KO hors de la liste ci-dessous est une anomalie nouvelle.

## Anomalies connues et contournées : ne pas les reporter comme nouvelles

| Réf. | Ce que vous verrez | Contournement | Suite |
|---|---|---|---|
| OCR | L'écriture à la main n'est pas lue | aucun : seul le texte imprimé est lu. Un seul moteur à la fois, choisi par configuration | moteur de la démo fixé le 20 à 09:00 |
| Lecture bloquée | Un document reste « en cours » plus de 10 min | noter le nom du document et l'heure, puis prévenir Q. Ne pas redéposer le fichier (refusé comme doublon) ni le mettre à la corbeille. Q relance la lecture côté serveur avec `DOCS/exploitation/relancer-ocr.md` (#369, fusionnée le 18/11) | V1.2 (OCR-1, #370) ; remonte en V1.1 si un arrêt brutal du worker est vu du 20 au 25 |
| Code de connexion | Le code n'est pas reçu : il est pré-rempli à l'écran ; le cadre « Espace Démo Interactif » est visible | cliquer sur « Confirmer l'identité » | après le 30 (#154) |
| Hors V1.0 | Pas de numérotation des rapports, pas de TOTP, pas de dépôt de version à l'écran, pas d'export d'audit pour plusieurs personnes à la fois (#435, V1.1) | non joués | après le 30 |
| Frictions connues (DEC-2026-013) | Pas de message après un dépôt ou une soumission ; « Soumettre » seulement dans « Tableau de Bord » ; motif de rejet seulement dans l'onglet « Circuit de Validation » ; recherche sensible aux accents ; liste complète dans la checklist d'UAT, § 6 | contournement écrit dans les lignes concernées | V1.1 |

## 0. Avant de commencer (5 min) ★

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| Prépa 1 | — | Jeu remis à zéro, dossier `live` présent sur le poste, compte `VERROU-23` créé | rapport de Q du jour (checklist § 4.4, PR #217) | | |
| Prépa 2 | `MINFI002` (collaborateur DAF) | Avant la séance : **deux** documents déposés (« Mes Documents » → « Nouveau Document »), puis, dans « Tableau de Bord » (« Mon Atelier »), sur chaque carte : « Soumettre » → `MGR001` → « Soumettre au visa » | les deux apparaissent chez `MGR001` : le premier sert à SC-VAL-01/02, le second à SC-VAL-03 puis SC-VAL-04 | | |
| Prépa 3 | — | Pile complète (pas la pile e2e) ; le worker répond au ping ; dossier `frontend/e2e/data/demo-ocr/` (sur `main` depuis #363) copié sur le poste | `pong` ; sans worker, la fiche reste « en cours » et OCR 1 et 2 sont KO | | |

## 1. `MINFI001` — Admin Institution MINFI (≈ 30 min)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ Connexion | `MINFI001` | « Administration / Organisme » → MINFI, « Matricule Personnel », « Mot de Passe », « Étape Suivante », « Confirmer l'identité » | arrivée sur « Tableau de bord » ; menu admin complet | | |
| ★ SC-ADM-05 (partiel) | `MINFI001` | « Plan de classement » → « Règles de classement » | la règle de démo est listée, avec sa priorité, **Active** | | |
| ★ SC-ADM-08 | `MINFI001` | « Import en masse » → « Importer dans le Serveur de l'Application » → « Juste les ranger » → dossier `live` → « Vérifier le classement » → « Importer les documents » | compteurs : importés = N−2, doublons = 2, à revoir = 2 ; moins de 60 s pour ≤ 50 fichiers | | |
| ○ P2 étape 8 | `MINFI001` | Refaire le même import | importés = 0, doublons = N, aucun document créé | | |
| ★ SC-E2E-01 (classement) | `MINFI001` | « Explorateur documentaire » : DAF → domaine → activité → année | les fichiers couverts par les règles sont à la destination attendue ; ≥ 95 % (C2 local) | | |
| ○ SC-ADM-05 | `MINFI001` | « Règles de classement » : créer « si nom contient X et type PDF alors domaine D, activité A », en décochant « Règle active dès l'enregistrement » (cochée par défaut, `ClassificationSettingsTab.tsx:110`) | règle visible dans la liste, **inactive** | | |
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
| ★ SC-VAL-01 | `MGR001` | « Tâches & Suivi » (page « Tâches & Validations ») | les deux documents de Prépa 2 sont là, avec leur étape ; aucun bouton pour modifier le contenu | | |
| ★ SC-VAL-02 | `MGR001` | « Valider » sur le premier (sans confirmation ici ; sur « Tableau de Bord », le même geste s'appelle « Viser » et demande une confirmation : les deux chemins sont bons) | il passe à l'étape suivante (ou Validé) ; le rédacteur ne peut plus le modifier | | |
| ★ SC-VAL-03 | `MGR001` | Sur le second document de Prépa 2 : « Rejeter » sans motif, puis avec motif → « Confirmer le rejet » | sans motif : refus ; avec motif : statut **Rejeté** | | |
| ★ Rapports | `MGR001` | « Rapports » : « Traitement & délais », puis « Services » | chiffres de la DAF seulement ; pas d'onglet « Synthèse » ; pas les autres services | | |
| ○ SC-LEC-02 | `MGR001` | Documents du service → ouvrir une fiche → « Télécharger » | métadonnées affichées ; le fichier téléchargé est l'original | | |
| ○ SC-ESP-01 | `MGR001` | Adresse `/spaces` tapée à la main (absente du menu du manager) ; filtres domaine → activité (liste dépendante) → année, puis icône « Réinitialiser les filtres » (entonnoir barré, visible seulement si un filtre est actif, `SpacesPage.tsx:834-842`) | liste et compteur cohérents à chaque choix ; l'icône vide les filtres | | |
| ○ Pagination | `MGR001` | Liste > 50 documents → page 2 | la page 2 se charge, le compteur ne change pas | | |
| Q SC-RED-01 (manager) | `MGR001` | Brouillon de `MINFI002` visible ou non | `À vérifier` en recette : reporter le constat de Q | | |

## 3. `READ001` — Lecteur DSI (≈ 8 min)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ SC-SEC-01 | `READ001` | Même mot-clé qu'en SC-LEC-01 | 0 résultat DAF ; pas d'erreur | | |
| ★ SC-SEC-03 | `READ001` | Parcourir « Mes Documents » | pas de bouton « Nouveau Document » ; pas de bouton d'action | | |
| ○ Menu lecteur | `READ001` | Ouvrir le menu | « Tableau de Bord », « Mes Documents », « Tâches & Suivi », « Corbeille » ; pas de « Ranger / Importer », « Bibliothèque locale », « Doublons » ni « Rapports » | | |

## 4. `AUDIT001` — Auditeur (≈ 10 min)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ SC-AUD-01 | `AUDIT001` | Menu de gauche → « Audit » (page « Registre Des Actions ») ; filtre « Effectuée par » = `MINFI001` | les actions du jour (import, revue, recherche) sont en tête, avec heure, auteur, objet ; aucun bouton d'écriture | | |
| ★ SC-ADM-09 | `AUDIT001` | Dans le registre : une connexion, un dépôt, un import | une ligne pour chacun | | |
| ★ SC-AUD-02 | `AUDIT001` | Même filtre → « Exporter (CSV) » → ouvrir dans le tableur | le fichier contient les lignes du filtre (heure, auteur, objet) ; une seule personne dans le filtre (le choix de plusieurs personnes, #435, n'est pas dans `main` : V1.1) | | |
| ○ SC-SEC-04 | `AUDIT001` | Ouvrir une page où l'écriture est refusée | l'écran reste utilisable, la liste ne se vide pas | | |

## 5. `MINFI002` — Collaborateur DAF (≈ 15 min, hors démo en direct)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| ★ SC-AUTH-01 E1 | `MINFI002` | Mauvais mot de passe | « Échec de connexion. Vérifiez vos identifiants. », sans dire lequel ; pas de session | | |
| ★ SC-AUTH-01 | `MINFI002` | Connexion normale | « Tableau de Bord » (page « Mon Atelier ») en < 5 s ; institution MINFI | | |
| ★ SC-RED-01 | `MINFI002` | « Mes Documents » → « Nouveau Document » : titre, catégorie, PDF < 1 Mo → « Envoyer » (faire défiler la fenêtre s'il n'est pas visible, inutile si #450 est dans `main`) | document en **Brouillon** dans la liste « Mes Documents », visible par son auteur ; pas de message de confirmation | | |
| ★ OCR 1 | `MINFI002` | « Nouveau Document » : `IMG_0412.jpg`, puis `IMG_0413.jpg` ; noter l'heure de chaque envoi | deux documents créés ; la lecture se fait dans le worker, l'écran reste libre | | |
| ★ OCR 2 | `MINFI002` | En fin de section, depuis « Tableau de Bord » (la barre de « Mes Documents » ne cherche pas dans le texte lu) : recherche `photocopieurs`, puis `agrafeuses` ; noter l'heure du premier résultat | 1 résultat chacun (`IMG_0412.jpg`, `IMG_0413.jpg`). Délai envoi → résultat : ≤ 30 s par photo, worker à un seul processus, donc ≤ 1 min pour les deux. Au-delà, le signaler à O. Tesseract seul trouve les deux mots (rejeu de Q du 18/11). Un document « en cours » plus de 10 min : anomalie « Lecture bloquée » | | |
| ○ OCR 3 | `READ001` | Mêmes recherches | 0 résultat : les photos sont à la DAF | | |
| ○ SC-RED-01 E1 | `MINFI002` | Fichier au-delà de la limite | message qui donne la limite | | |
| ★ SC-VAL-04 | `MINFI002` | Ouvrir le document rejeté en SC-VAL-03 → onglet « Circuit de Validation » | statut **Rejeté** et motif saisi par `MGR001` ; aucune action de modification. Le motif n'est pas sur la carte ni dans le premier onglet, et il n'y a pas de bouton « Corriger / resoumettre » : connu, V1.1 | | |
| ★ SC-AUTH-03 | `MINFI002` | Se déconnecter, puis bouton Précédent du navigateur | retour à la connexion ; l'application ne se rouvre pas | | |
| ○ SC-AUTH-02 | `MINFI002` | Connexion avec un code modifié à la main | « Code invalide » ; nouvelle saisie possible | | |
| ○ SC-AUTH-02 E3 | `VERROU-23` (lecteur jetable créé par Q avant la séance), **pas** un compte de la démo | 3 codes faux | compte bloqué 15 min, compte à rebours à l'écran | | bloque le compte : à jouer en dernier |

## 5 bis. `UNIT001` — Admin Service DRH (≈ 10 min)

| ID | Compte | Geste | Résultat attendu | OK / KO | Remarque |
|---|---|---|---|---|---|
| Périmètre | `UNIT001` | Liste des documents, recherche, tableau de bord | DRH et ses sous-unités seulement (#203). Rapports, circuits, imports, revues et règles sont limités de même côté serveur (#358, preuve de Q) : « Rapports » et « Règles de classement » ne sont pas dans son menu | | |
| Au-delà | `UNIT001` | Adresse `/documents?open=<id>` d'un document de la DAF (Prépa 2), obtenue par `MINFI002` en ouvrant le document depuis la recherche du bandeau (un clic dans « Mes Documents » ne change pas l'adresse, `Documents.tsx:216`) ; mot-clé de SC-LEC-01 | « introuvable » (404), aucun titre ; 0 résultat | | |

## 6. Prouvés par Q, pas rejoués à la main

| ID | Preuve à reporter | OK / KO | Remarque |
|---|---|---|---|
| Q SC-AUTH-03 (API) | ancien jeton → 401 | | |
| Q SC-ESP-01 (API) | une requête par changement de filtre ; URL invalide ignorée | | |
| Q Corbeille exclue | document en corbeille absent de la recherche (API) | | |
| Q SC-RED-05/06 | suppression puis restauration (pytest) | | |
| Q SC-RED-04 | nouvelle version, ancienne lisible, écriture concurrente refusée (pytest) | | |
| Q Titulaire d'étape | le titulaire d'une étape lit le document, son contenu et son texte lu, mais pas son historique (`audit-logs` refusé) ; pas d'écran pour cet historique, donc preuve par l'API (pytest de #203) | | |
| Q Hors arbre | `UNIT001` : lecture hors de son arbre → 404 ; création ou déplacement d'un compte hors de son arbre → refus ; comptes et organigramme limités à la DRH (pytest de #203 et #360). Pas d'écran : `/users` et `/org` sont réservés à l'administrateur d'institution (`App.tsx`, `ADMIN_ROUTES`) et absents du menu | | |

## Verdict

- ★ tous OK ou KO connus ci-dessus : **GO** pour le tag.
- Un ★ en KO nouveau : tri selon `plan-recette-20-23-11.md` § 3.
