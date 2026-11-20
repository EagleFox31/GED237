# Notes de version V1.1 (v1.1.0) — squelette

- **Pour** : O, qui en tirera les notes de la première release automatique `v1.1.0` sur `main`, après les fusions post-rc1.
- **Périmètre** :
  - les PR post-rc1 de l'ordre accepté le 17/11 (commit 1152a1a, `plan-fusion-post-rc1.md` § 8.6), plus #213 (étape 5) ;
  - #212, ajoutée à l'étape 2 après #154 par O le 17/11 ;
  - les issues V1.1 sans PR (#204, #214, #215, #216), en fin de document.
  - #208 et #104 vont dans `release/v1.0.0`, donc hors de cette liste.
- **État au 17/11 13:34** : verdicts tirés de `PASSATION-ci-qa.md`, têtes et CI relevées par `gh pr list` à la même heure.
  - **OK définitif** : verdict OK de Q et CI GitHub verte sur la tête ;
  - **OK sur le code** : verdict OK de Q, CI en cours ou à refaire après rebase ;
  - **relue avec remarques** : OK de Q, avec des remarques non bloquantes ;
  - **changements demandés** : Q bloque ;
  - **à relire** : pas encore de verdict de Q ;
  - **en attente du PO** : la fusion attend une réponse du PO (dossier du 23/11).
  - Une PR empilée (base autre que `main`) n'a pas de CI propre : son OK définitif vient après le rebase sur `main` (règle de O du 17/11).
- **Avant la release** : retirer les lignes des PR non fusionnées, retirer les colonnes « PR » et « État », et garder le texte des colonnes « Agent », « Admin », « Lecteur ». Un « — » signifie : rien ne change pour ce rôle.
- **Réglages** : plusieurs nouveautés sont **désactivées par défaut** (réglage cité). Une ligne qui en dépend dit « si activé ». Si le réglage reste coupé à la release, la ligne sort des notes.
- **Rôles** : « admin » couvre l'administrateur d'institution et le responsable d'unité, sauf mention. Le responsable d'unité (`unit_admin`) s'appelle « Admin Service » dans le guide utilisateur : garder ce nom dans les notes finales. « Lecteur » couvre le lecteur et le manager (« Responsable » dans le guide), qui consultent sans administrer.

---

## Sécurité et accès

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #154 | Le code de connexion arrive par e-mail. Un bouton permet de le renvoyer. | Reçoit son code par e-mail. Peut demander un nouveau code. | Doit renseigner l'e-mail de chaque compte : sans adresse, la connexion est refusée avec « contactez votre administrateur ». | Comme l'agent. | OK définitif (229561d, CI verte) ; fusionne avant #193, qui contient son commit a655f91 |
| #193 | Les administrateurs se connectent avec une application de codes sur leur téléphone (DEC-2026-004). | Peut ajouter l'application, sans obligation. | Doit relier l'application à la première connexion. Téléphone perdu : réinitialisation en personne par le niveau supérieur, toutes les sessions sont fermées ; à la connexion suivante, le titulaire voit la date de la réinitialisation. L'administrateur d'institution réinitialise l'application des agents de son institution. Voir `fiche-admin-verification-application.md`. | — | relue avec remarques sur f2cc377 ; tête 3d0e4a7 (message à la connexion suivante, `security_notices` ; CI en cours au 17/11) à relire ; restrictions de la DEC demandées par O à B (réinitialisation par niveau, `--operator` super admin actif, refus si `AUTH_TOTP_ENABLED` est faux) |
| #212 | Mode production sûr : en production, l'application refuse de démarrer si sa configuration n'est pas sûre (clé livrée dans le dépôt, pas de canal d'envoi du code), et le code de connexion n'est jamais renvoyé à l'écran. | — | Super admin et exploitation : un démarrage en production mal réglé est refusé, avec la liste des motifs à corriger (`DOCS/exploitation/installation.md` § 3). En démo et en développement, rien ne change. | — | à relire ; empilée sur #154 ; étape 2, juste après #154 (décision de O du 17/11) |
| #196 | Les rapports d'un rôle limité à une unité comptent bien ses sous-unités. Les rôles qui voient toute l'institution sont listés une fois pour toutes. | — | Le responsable d'unité voit dans ses rapports son service et ses bureaux. | Selon la réponse du PO (q. 4) : son service seul, ou son service et ses bureaux. | à relire (e760d79, CI verte) ; en attente du PO |
| #203 | Le responsable d'unité voit son service et ses bureaux, partout (liste, recherche, compteurs, imports), comme dans ses rapports. | — | Responsable d'unité : il voit les documents de ses bureaux, et rien hors de son service. | — | relue avec remarques (3dc5300, CI verte) ; en attente du PO |
| #213 | Correctif de sécurité (#202) : le responsable d'unité ne peut plus ouvrir, par un lien direct, un document d'un autre service. | — | Responsable d'unité : un lien vers un document hors de son service est refusé. | — | à relire ; empilée sur #203 |

## Rapports officiels

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #197 | Un rapport officiel peut être émis en PDF, avec le même numéro et la même empreinte que le CSV et le HTML. Un établissement qui a émis des rapports officiels ne peut plus être supprimé. | — | Émet et réimprime ses rapports en PDF. La suppression d'un établissement qui a un registre est refusée. | Imprime le PDF d'un rapport qu'il peut voir. | OK définitif (2faf8f9, CI verte) ; ouvre la chaîne des migrations |
| #180 | Rapports officiels programmés : chaque semaine ou chaque mois, le rapport de la période close est émis tout seul, numéroté. | — | Programme un rapport. Il reçoit une notification à chaque émission. Si activé (`SCHEDULED_REPORTS_ENABLED`). | — | OK sur le code (391a347) ; CI en cours |
| #209 | Écran des rapports officiels : émettre, consulter le registre, réimprimer, programmer. | — | Fait tout depuis l'écran, sans passer par l'API. | Consulte le registre et réimprime selon ses droits. | changements demandés, légers (fe01f39) ; corrigée par F en local, pas encore poussée ; empilée sur #180 |

## Corbeille et annulation

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #152 | « Supprimer » met le document à la corbeille, avec une trace dans le journal. La suppression définitive (purge) est sûre, groupée, et peut devenir automatique. | Un document supprimé par erreur se récupère. | Purge la corbeille. Purge automatique si activée (`TRASH_RETENTION_DAYS`, coupée par défaut). Elle ne touche jamais un document signé ou archivé (décision de O du 17/11, en application de la décision PO du 17/11). | — | changements demandés (7fa8a3d) ; suppression d'un document en cours de validation : selon la réponse du PO (dossier du 23, § 1, q. 3) |
| #181 | Écran « Corbeille » : liste des documents supprimés, restauration, purge selon les droits. | Retrouve et restaure ses documents supprimés. | Restaure ou purge pour son périmètre. | — | changements demandés (c91a65e) ; corrigée par F en local (menu contextuel), pas encore poussée ; empilée sur #152 |
| #179 | Un déplacement de document peut être annulé. Le reclassement est tracé dans le journal. | Annule un déplacement fait par erreur. | Voit les reclassements dans le journal. | — | relue (CI verte) |
| #184 | Dans l'explorateur : touche Suppr pour mettre à la corbeille, glisser-déposer pour reclasser, et « Annuler » juste après. | Supprime ou reclasse vite, et peut annuler. | Comme l'agent. | — | OK sur le code et sur la nightly (d15a4de) ; empilée sur #181 |
| #211 | Sélection multiple dans l'explorateur (Ctrl+clic, Maj+clic), puis mise à la corbeille groupée. | Met plusieurs documents à la corbeille en une fois. | Comme l'agent. | — | brouillon de F, hors de la file de Q tant que O ne l'y place pas ; empilée sur #184 |
| #182 | Tests de bout en bout de l'annulation (suppression et déplacement). | — | — | — | OK (50b684c, nightly verte) ; pas de ligne dans les notes finales (validé par O) |

## Doublons

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #171 | Les fichiers identiques sont regroupés. On garde une copie, les autres vont à la corbeille. Rien n'est supprimé définitivement. | — | Fait le ménage des doublons de son périmètre. Une copie en cours de validation n'est pas mise à la corbeille. | — | relue avec remarques (13c5aee, CI verte) ; verrou de ligne confié à B ; en attente du PO (dossier du 23, § 1) |
| #199 | Écran « Doublons », juste après la Corbeille dans le menu. La copie d'origine est présélectionnée. | — | Choisit la copie à garder et met les autres à la corbeille en une action. | — | relue avec remarques (1746d37) ; conflit sur `Sidebar.tsx` hérité de #181 ; en attente du PO ; suit #182 et #171 |

## Alertes

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #162 | Indicateurs de qualité des documents : sans métadonnées, à revoir, sans texte lisible. Taux de qualité et listes des documents à corriger. | — | Voit les documents à compléter dans son périmètre. | Le manager voit la qualité de son service. | fusion de `main` relue OK (837c1e3, CI verte) ; contenu à relire |
| #194 | Onglet « Qualité » dans Rapports et statistiques, et écran des alertes de qualité. | — | Suit le taux de documents complets et règle ses alertes. | Le manager voit l'onglet pour son service. | à relire ; empilée sur #183 |
| #183 | Alertes de qualité : on est prévenu quand un indicateur dépasse un seuil, en nombre ou en %. | — | Crée des règles d'alerte et reçoit les notifications. Si activé (`QUALITY_ALERTS_ENABLED`). | — | OK sur le code (c8a89a2) ; CI en cours |
| #155 | Les notifications arrivent tout de suite, sans recharger la page, même avec plusieurs serveurs. | Voit ses notifications en direct. Si activé (`NOTIFICATIONS_BROADCAST_MODE`, coupé par défaut). | Comme l'agent. | Comme l'agent. | à relire (CI verte) |
| #192 | Sauvegarde automatique chaque nuit, durée de conservation réglable, et alerte si elle échoue. | — | Super admin et exploitation : une sauvegarde par nuit sans action, une alerte en cas d'échec. Si activé (`SCHEDULED_BACKUP_ENABLED`, coupé par défaut). | — | OK sur le code (7c32940) ; CI en cours |

## Travail quotidien

Sixième groupe, validé par O le 17/11 : ces PR n'entrent dans aucun des cinq thèmes.

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #153 | Une seule file de validation, triée par ancienneté : mes documents, ceux de mon unité, ceux sans responsable. | Voit tout ce qu'il doit valider au même endroit. Si activé (`WORKFLOW_INBOX_ENABLED`). | Voit aussi les validations sans responsable. | — | fusion de `main` relue OK (7deda0a, CI verte) ; contenu à relire |
| #190 | Écran de la file de validation, à onglets. | Comme #153. | Comme #153. | — | à relire ; suit #181 et #153 |
| #165 | Favoris, documents récents et documents partagés avec moi. | Met des documents en favori (étoile) et retrouve ses derniers documents ouverts (récents si activés : `RECENT_DOCUMENTS_TRACKING_ENABLED`). | Comme l'agent. | Comme l'agent. | OK sur le code (d89f86f), réserve levée par #180 et #183 ; CI après rebase ; dans la file de Q après #209 |
| #205 | Écran « Mes documents » : favoris, récents, partagés. | Comme #165. | Comme #165. | Comme #165. | changements demandés (66d50fa) ; empilée sur #165 |
| #186 | Un import de dossier interrompu reprend où il s'était arrêté, sans tout refaire. | — | Relance un gros import coupé sans doublons ni attente. | — | relue avec remarques (6559c49, CI verte) ; rechaînera sa migration derrière #193 à son tour |

## Issues V1.1 sans PR (17/11)

À garder ici tant qu'aucune PR ne les porte. Une issue sans PR fusionnée à la release sort des notes.

| Issue | Ce qui changera | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #204 | Suivi 24 h après #193 : une réinitialisation de l'application non suivie d'un nouvel enrôlement sous 24 h est signalée. | — | Reçoit l'alerte pour un agent de son institution réinitialisé et non réenrôlé sous 24 h. Le super admin la reçoit pour un administrateur d'institution. | — | ouverte, label `v1.1` ; réduite par B au seul suivi 24 h. Le message à la connexion suivante et la fermeture des sessions sont livrés dans #193 (3d0e4a7, `security_notices`) |
| #214 | L'écran sait quelles fonctions le serveur a activées, par un seul point d'accès. | Ne voit plus d'onglet ni de bouton pour une fonction coupée. | Comme l'agent. | Comme l'agent. | ouverte, label `v1.1`. Retire les en-têtes `X-Recent-Tracking-Enabled` et `X-Scheduled-Reports-Enabled` (#165, #180) : changement à noter dans le changelog |
| #215 | Le responsable d'unité est borné à son service et à ses bureaux pour la lecture, la recherche, les revues de classement et les validations. | — | Responsable d'unité : ne lit, ne cherche, ne revoit et ne valide plus que les documents de son service et de ses bureaux. En rc.1, il voit toute l'institution (limite connue des notes rc.1). | — | ouverte, labels `v1.1` et `security` ; élargie le 17/11 à la lecture et à la recherche ; recouvrement avec #203 et #213 noté par B dans l'issue. Décision de portée du PO à tracer |
| #216 | Trois constats de sécurité ouverts depuis la revue B6 : liste des rôles attribuables soumise aux droits, modification de son propre profil, clé du rangement local par institution. | Peut modifier les champs de son propre profil que le PO aura retenus. | — | Comme l'agent. | ouverte, labels `v1.1` et `security` ; décision du PO sur les champs modifiables par soi-même |

---

## Pour O

- **Lignes à confirmer par les auteurs** : la colonne « Ce qui change » vient des descriptions de PR et d'issues. B et F peuvent corriger une formulation avant la release.
- **Réglages coupés par défaut** : `SCHEDULED_REPORTS_ENABLED`, `QUALITY_ALERTS_ENABLED`, `TRASH_RETENTION_DAYS`, `NOTIFICATIONS_BROADCAST_MODE`, `SCHEDULED_BACKUP_ENABLED`, `WORKFLOW_INBOX_ENABLED`, `RECENT_DOCUMENTS_TRACKING_ENABLED`. Règle validée par O le 17/11 : chacun est tranché au moment de la release V1.1 ; une ligne dont le réglage reste coupé sort des notes.
- **Q. 4 du PO** : la ligne #196 « Lecteur » sera fixée par sa réponse (recommandation B : son service seulement).
- **Q. 5 du PO** : #165 ne l'attend pas. La réponse donnera une PR à part : avec A, le valideur peut lire le document pendant son étape (contrôle d'accès) ; avec B, un filtre retire ces documents de « Partagés avec moi ».
- **#215 et #203 se recouvrent** : #203 borne déjà la liste, la recherche, les compteurs et les imports du responsable d'unité, et #213 l'accès par lien direct. Si les deux fusionnent, #215 ne garde que les revues de classement et les validations. Décision de O (17/11) : B le note dans l'issue (fait le 17/11) ; pas de chiffrage avant la réponse du PO.
- **#212** : étape 2 de l'ordre, juste après #154 (décision de O du 17/11), reportée dans `plan-fusion-post-rc1.md` § 8.6.
