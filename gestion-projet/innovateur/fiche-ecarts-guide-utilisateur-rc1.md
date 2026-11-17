# Fiche des écarts : guide utilisateur par profil contre la rc.1

- **Pour** : O (planifie la PR de documentation après le tag du 24) et l'auteur de cette PR. Innovateur, 2026-11-17.
- **Audité** : `DOCS/GUIDE_UTILISATEUR_PAR_PROFIL_GED237.md` sur `main` c216141 (481 lignes, un seul commit, 93805b2). Il est comparé au code de `main` et à #198, qui doit fusionner avant le tag.
- **Exigence** : le cahier des charges (§ 8) demande un guide utilisateur à la livraison.
- **Règle** : ce document ne modifie pas le guide. Les corrections iront dans une PR de documentation après le 24.
- `Vérifié` = lu dans le code ; `Déduit` = raisonnement ; `À vérifier` = à confirmer sur la pile rc.1.

## 1. Verdict en une ligne

Le guide décrit bien les **notions** (classement, circuit, bannette, audit), mais pas les **écrans tels qu'ils sont** :
- il ne dit pas comment se connecter ;
- il nomme des pages que l'agent ne retrouve pas dans son menu ;
- il ne décrit ni « Rapports », ni « Bibliothèque locale », ni « Ranger / Importer ».

Il est écrit sans accents, avec du jargon (`tenant`, `AuthZ`, `Tasks`, `process`). **20 écarts** relevés, dont **3 bloquants** pour un agent qui ouvre l'application pour la première fois (E1, E7, E9).

## 2. Points demandés par O

| # | Section du guide | Ce qui est écrit | Ce que fait la rc.1 (source) | Correctif proposé |
|---|---|---|---|---|
| E1 | Aucune (« Avant de commencer ») | Rien sur la connexion. | Connexion en 3 temps : institution, identifiant et mot de passe, puis code à 6 chiffres valable 5 min. Après 3 codes faux, le compte est bloqué 15 min. À la première connexion, l'agent doit changer son mot de passe. Il n'y a pas de « mot de passe oublié ». `Vérifié` : `auth_service.py` (`OTP_EXPIRY_SECONDS = 300`, l. 32), `config.py` l. 58-59, `App.tsx` l. 197, `LoginPage.tsx`. | Ajouter une section « **Se connecter** » en 5 étapes numérotées. Phrase type : « Saisissez le code à 6 chiffres. Il est valable 5 minutes. Après 3 erreurs, attendez 15 minutes. Mot de passe perdu : demandez à l'administrateur de votre institution. » |
| E2 | Même section | Rien sur la provenance du code. | **Le code n'est envoyé nulle part en rc.1**. Il est renvoyé par le serveur et **prérempli** à l'écran parce que `docker-compose.yml` fixe `ENVIRONMENT: development` (l. 141). `Vérifié` : `auth_service.py` l. 121-122, `LoginPage.tsx` l. 139-140. L'envoi par e-mail arrive avec #154 (et l'application d'authentification avec #193), toutes deux ouvertes. | **Ne pas écrire « reçu par e-mail » avant la fusion de #154.** Pour la rc.1, écrire : « Le code s'affiche déjà rempli : cliquez sur Valider. » Signalé à O le 17/11 : le second facteur est inopérant sur site. Décision de O : rien ne change dans la rc.1, car passer en production sans canal d'envoi bloquerait toute connexion. La limite est inscrite dans les notes rc.1. Après le tag, B rend `ENVIRONMENT` réglable, ajoute un garde-fou au démarrage et un § du manuel, empilés sur #154. Le protocole d'installation contrôle ce point sur P2 (condition 7). |
| E3 | 2. Admin Institution, « Pages principales » | 11 pages, sans « Recherche » ni « Accès & Permissions ». | #198 (ouverte, à fusionner avant le tag) retire ces deux entrées du menu, car elles ouvraient la page « Espace en Travaux ». `Vérifié` : diff de #198, `menuConfig.ts`. Le guide est donc **juste par omission**, mais il ne dit pas **où chercher**. | Ajouter : « Pour chercher un document, tapez dans la **barre en haut de l'écran**. Elle cherche dans la page ouverte (agents dans « Agents & Rôles », documents dans l'Explorateur). » `Vérifié` : `Header.tsx` l. 28-43. Les droits se gèrent dans « Agents & Rôles ». |
| E4 | Aucune | Rien sur la corbeille d'un document. | **Aucun bouton pour mettre un document à la corbeille ni pour le restaurer dans l'interface rc.1.** `Vérifié` : `deleteDocument` est déclaré dans `services/` mais n'est appelé par aucun écran. « Annuler pendant 10 s » et Ctrl+Z (#151) arrivent avec #179, #182 et #184, toutes ouvertes, après le 30. | **Ne pas décrire « Annuler » en rc.1.** Écrire seulement : « Pour retirer un document, demandez à l'administrateur. » Le paragraphe « Annuler pendant 10 s » sera ajouté dans la PR du guide qui suit #184. |
| E5 | 4. Responsable | Aucun rapport cité. | Le manager a une entrée « **Rapports** ». Depuis #188 (fusionnée), il n'y voit que **son service et ses bureaux**. `Vérifié` : `Sidebar.tsx` l. 93-96. | Ajouter : « **Rapports** : les chiffres de votre service et de ses bureaux, pas ceux des autres services. C'est normal. » |
| E6 | Aucune | Rien sur un numéro de document ou de rapport. | **Pas de numérotation en rc.1.** Le format `N° 0012/2026/<SIGLE>/<service>` vient avec #161 (ouverte, gelée jusqu'au 30). `Vérifié` : aucun code de numérotation sur `main`, corps de #161. | **Ne rien écrire en rc.1.** Après #161, ajouter : « Chaque rapport officiel reçoit un numéro : numéro d'ordre / année / sigle de l'institution / service. Exemple : N° 0012/2026/MINXX/DAF. » Préciser aussi qu'une institution sans sigle ne peut pas en produire. |

## 3. Écrans décrits qui n'existent pas, ou pas sous ce nom

| # | Section du guide | Ce qui est écrit | Ce que fait la rc.1 (source) | Correctif proposé |
|---|---|---|---|---|
| E7 | 3 à 7 (Admin Service, Responsable, Collaborateur, Lecteur, Auditeur) | Chaque profil a « sa » page principale (`Tableau de bord service`, `Tasks`, `Mon Atelier`, `Ma Bibliothèque`, `Audit`). | Ces 5 profils ont **le même menu** : Tableau de Bord, Mes Documents, Tâches & Suivi, Ranger / Importer, Bibliothèque locale, plus Rapports pour le manager. `Vérifié` : `Sidebar.tsx` l. 88-96. Leur page propre est derrière « **Tableau de Bord** » (`App.tsx` l. 147-153). | Pour chaque profil : « Votre menu : … ». Puis « Votre page de travail s'ouvre par **Tableau de Bord** ». Donner son vrai titre (voir E8). |
| E8 | 3, 4 | `Tableau de bord service`, `Tasks` / espace de validation. | Les titres affichés sont « **Chef Unité** » (`ServiceDashboard.tsx`), « **Espace Manager** » (`ValidationHub.tsx`) et « **Tâches & Validations** » (`WorkflowTasks.tsx` l. 53). | Reprendre les titres exacts de l'écran, entre guillemets, pour que l'agent reconnaisse ce qu'il voit. |
| E9 | 6. Lecteur | « Ouvrir **Ma Bibliothèque**. » | Le lecteur arrive sur « **Mes Documents** », dont la page s'appelle « **Explorateur GED** ». « Ma Bibliothèque » est derrière « Tableau de Bord ». `Vérifié` : `DEFAULT_ROUTE_BY_PROFILE` (`App.tsx`), `Documents.tsx` l. 105. | « À la connexion, vous arrivez sur **Mes Documents**. Pour les documents validés de votre service, ouvrez **Tableau de Bord**. » |
| E10 | 4. Responsable, étape 4 | Actions : viser, approuver, signer, rejeter, accuser réception. | Corrigé le 17/11 après relecture du code : dans « Tâches & Validations », **Valider** et **Rejeter**. Dans « Espace Manager », le bouton d'acceptation porte le nom de l'étape : **Viser**, **Approuver**, **Signer**, **J'ai pris connaissance**, sinon **Valider**. Rejeter demande un motif partout. `Vérifié` : `WorkflowTasks.tsx` l. 99-106, `ValidationHub.tsx` l. 52-59. | Décrire les deux écrans. « Accusé de réception » devient « J'ai pris connaissance ». |
| E11 | 2, « Explorateur documentaire » | « relancer une correction de classement si nécessaire ». | L'Explorateur montre l'état « À vérifier » mais n'a pas de bouton de correction. La correction se fait dans « Ma bannette ». `Déduit` : aucun appel de reclassement dans `SpacesPage.tsx`. | Remplacer par : « Un document marqué **À vérifier** se corrige dans **Ma bannette**. » |
| E12 | 1. Super Admin, « Parcours typique » | « 1. Ouvrir **Institutions**. » ; pages principales : Dashboard Global d'abord. | Le super admin arrive directement sur « Institutions ». Son menu compte aussi Documents, Workflows, Import en masse, Bibliothèque locale et Parametres. `Vérifié` : `DEFAULT_ROUTE_BY_PROFILE`, `super-admin/menuConfig.ts`. | Compléter la liste des pages. Dire « vous arrivez sur **Institutions** ». |
| E13 | 2, « Pages principales » : `Parametres` | Cité sans détail. Le menu annonce « Général, Notifications, Intégrations ». | Corrigé le 17/11 : `/settings` affiche `DisplaySettings` (`App.tsx` l. 263). La page contient le guide des rôles, le choix du menu (latéral ou supérieur), la liste des unités et une liste de contrôle de l'installation. Rien sur les notifications ni les intégrations. | « **Paramètres** : guide des rôles, position du menu, liste de contrôle de l'installation. » Signaler à F que les sous-titres du menu annoncent ce que la page n'a pas. |

## 4. Écrans qui existent mais ne sont pas décrits

| # | Écran (profils) | Source | Correctif proposé |
|---|---|---|---|
| E14 | **Rapports & Statistiques** (admin institution) | `menuConfig.ts`, `/reports` | Une section : ce qu'on y lit, filtres par service et par période, export. Dire que l'admin voit toute l'institution. |
| E15 | **Bibliothèque locale** (tous) | `Sidebar.tsx` l. 92, `/local-library` | Expliquer en 3 lignes : « ranger des fichiers de **votre ordinateur** sans les envoyer dans la GED ; vous récupérez le résultat rangé (dossier ou ZIP) ; rien n'est partagé ». Le distinguer clairement de l'Import en masse. |
| E16 | **Ranger / Importer** (profils non administrateurs) | `Sidebar.tsx` l. 91, `/ingestion` | Le guide (cas transverse 4) le réserve aux administrateurs. Or l'entrée est visible pour tous, lecteur et auditeur compris. L'import final demande le droit de créer un document (`imports.py` l. 191 et 263). Un lecteur voit donc l'écran mais ne peut pas finir (`Déduit`, `À vérifier` sur la pile). Écrire qui peut s'en servir, et signaler à F l'entrée inutile pour le lecteur et l'auditeur. |
| E17 | **Mes Documents** (« Explorateur GED ») et **Tâches & Suivi** (tous) | `Documents.tsx`, `WorkflowTasks.tsx` | Les décrire une fois, dans les cas transverses. Préciser que seuls l'admin, le manager et le collaborateur ont « Nouveau document » (`Documents.tsx` l. 15). |
| E18 | **Export du journal** (auditeur, admin) | `AuditLogs.tsx` l. 142, 330-332 | Le guide dit « exporter ». Préciser la règle de l'écran : l'export porte sur **un seul utilisateur** à la fois. |

## 5. Forme

| # | Constat | Correctif proposé |
|---|---|---|
| E19 | Tout le texte est **sans accents** (« Parametres », « tracabilite », « A distribuer »), alors que l'écran les affiche. | Rétablir les accents. Les noms de menus doivent être recopiés **exactement** comme à l'écran. |
| E20 | Jargon : `tenant`, `Gestion AuthZ`, `Tasks`, mode `process`, `workflow`, « routage », « étapes orphelines ». | Garder le libellé exact de l'écran quand il existe (« Gestion AuthZ ») mais l'expliquer en 5 mots. Ailleurs, en français simple : institution, circuit, « documents sans destinataire » (libellé du menu). La section « Annexes proposées » est à retirer : elle reste interne. |

## 6. Ce qu'il ne faut pas écrire avant les fusions

| Contenu | Attendre |
|---|---|
| Code reçu par e-mail | #154 |
| Application d'authentification (TOTP) | #193 et DEC-2026-004 |
| Annuler pendant 10 s, Ctrl+Z, déplacer un document | #179, #184 |
| Numéro `N° …/année/SIGLE/service`, réimpression | #161 |
| Vue « Doublons » | #171 et l'accord du PO |
| Responsable d'unité limité à son service partout | #195 et l'accord du PO (`fiche-po-195-portee-unit-admin.md`) |

Règle proposée : chaque PR post-rc1 qui change un écran visible coche « guide utilisateur mis à jour », ou explique pourquoi ce n'est pas nécessaire.

## 7. Plan et coût

- **PR de documentation après le 24** : corrections E1 à E20, en ne gardant pour E2, E4 et E6 que le texte rc.1. Coût :
  - rédaction ≈ 1,5 h-s (I ou F) ;
  - relecture par Q contre la pile rc.1 ≈ 0,5 h-s, en vérifiant d'abord les points `Déduit` et `À vérifier` (E11, E16).
- **Signalés à F**, sans urgence, après le 30 :
  - sous-titres du menu « Paramètres » (E13) ;
  - entrée « Ranger / Importer » pour le lecteur et l'auditeur (E16).
- **Signalé à O, urgent** : code prérempli sur site (E2), sous le message du 17/11.

## 8. Constats ajoutés pendant la rédaction du guide (17/11)

| # | Écran | Constat (source) | Traitement dans le guide | Pour |
|---|---|---|---|---|
| E21 | Connexion | Le cadre « Espace Démo Interactif » s'affiche sous le formulaire, sans condition d'environnement. `Vérifié` : `LoginPage.tsx` l. 365, `DemoProfiles.tsx`. | « Ne vous servez pas de ce cadre : il sert aux démonstrations. » | O : faut-il le masquer sur site ? Même famille que E2. |
| E22 | Connexion | Le lien « Oublié ? » n'a aucune action (`LoginPage.tsx` l. 318). L'écran « Code MFA » dit « reçu sur votre mobile », alors que le code est prérempli. | « Le lien ne fait rien dans cette version : demandez à l'administrateur. » | F, après le 30. |
| E16 bis | Ranger / Importer | Deux choix : « Ranger sur mon poste » (rien n'entre dans la GED) et « Importer dans le Serveur de l'Application » (`DirectoryIngestion.tsx`). Le lecteur et l'auditeur peuvent donc se servir du premier. L'entrée n'est pas inutile pour eux. | « Lecteur et auditeur : seul Ranger sur mon poste vous concerne. » | F : seulement masquer le second choix pour eux. |
