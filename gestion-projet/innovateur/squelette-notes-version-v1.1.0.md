# Notes de version V1.1 (v1.1.0) — squelette

- **Pour** : O, qui en tirera les notes de la première release automatique `v1.1.0` sur `main`, après les fusions post-rc1.
- **Périmètre** : les PR post-rc1 de l'ordre accepté le 17/11 (commit 1152a1a, `plan-fusion-post-rc1.md` § 8.6), plus #213 (étape 5). #208 et #104 vont dans `release/v1.0.0`, donc hors de cette liste.
- **État au 17/11 12:44** : tiré de `PASSATION-ci-qa.md`, mis à jour par O ensuite (#197, #186, #183).
  - **relue** : verdict OK de Q ;
  - **relue avec remarques** : OK de Q, avec des remarques non bloquantes ;
  - **changements demandés** : Q bloque ;
  - **à relire** : pas encore de verdict de Q ;
  - **en attente du PO** : la fusion attend une réponse du PO (dossier du 23/11).
- **Avant la release** : retirer les lignes des PR non fusionnées, retirer les colonnes « PR » et « État », et garder le texte des colonnes « Agent », « Admin », « Lecteur ». Un « — » signifie : rien ne change pour ce rôle.
- **Réglages** : plusieurs nouveautés sont **désactivées par défaut** (réglage cité). Une ligne qui en dépend dit « si activé ». Si le réglage reste coupé à la release, la ligne sort des notes.
- **Rôles** : « admin » couvre l'administrateur d'institution et le responsable d'unité, sauf mention. « Lecteur » couvre le lecteur et le manager, qui consultent sans administrer.

---

## Sécurité et accès

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #154 | Le code de connexion arrive par e-mail. Un bouton permet de le renvoyer. | Reçoit son code par e-mail. Peut demander un nouveau code. | Doit renseigner l'e-mail de chaque compte : sans adresse, la connexion est refusée avec « contactez votre administrateur ». | Comme l'agent. | relue avec remarques |
| #193 | Les administrateurs se connectent avec une application de codes sur leur téléphone (DEC-2026-004). | Peut ajouter l'application, sans obligation. | Doit relier l'application à la première connexion. Téléphone perdu : réinitialisation en personne par le niveau supérieur, toutes les sessions sont fermées. Voir `fiche-admin-verification-application.md`. | — | relue avec remarques sur f2cc377 ; à relire après rebasage |
| #196 | Les rapports d'un rôle limité à une unité comptent bien ses sous-unités. Les rôles qui voient toute l'institution sont listés une fois pour toutes. | — | Le responsable d'unité voit dans ses rapports son service et ses bureaux. | Selon la réponse du PO (q. 4) : son service seul, ou son service et ses bureaux. | en attente du PO ; à relire |
| #203 | Le responsable d'unité voit son service et ses bureaux, partout (liste, recherche, compteurs, imports), comme dans ses rapports. | — | Responsable d'unité : il voit les documents de ses bureaux, et rien hors de son service. | — | relue avec remarques ; en attente du PO |
| #213 | Correctif de sécurité (#202) : le responsable d'unité ne peut plus ouvrir, par un lien direct, un document d'un autre service. | — | Responsable d'unité : un lien vers un document hors de son service est refusé. | — | à relire ; suit #203 |

## Rapports officiels

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #197 | Un rapport officiel peut être émis en PDF, avec le même numéro et la même empreinte que le CSV et le HTML. Un établissement qui a émis des rapports officiels ne peut plus être supprimé. | — | Émet et réimprime ses rapports en PDF. La suppression d'un établissement qui a un registre est refusée. | Imprime le PDF d'un rapport qu'il peut voir. | relue (OK de Q, CI verte) |
| #180 | Rapports officiels programmés : chaque semaine ou chaque mois, le rapport de la période close est émis tout seul, numéroté. | — | Programme un rapport. Il reçoit une notification à chaque émission. Si activé (`SCHEDULED_REPORTS_ENABLED`). | — | changements demandés à 12:34, bloquant levé par le delta 5585c4f (relu à 12:43) ; CI en attente |
| #209 | Écran des rapports officiels : émettre, consulter le registre, réimprimer, programmer. | — | Fait tout depuis l'écran, sans passer par l'API. | Consulte le registre et réimprime selon ses droits. | à relire ; suit #180 |

## Corbeille et annulation

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #152 | « Supprimer » met le document à la corbeille, avec une trace dans le journal. La suppression définitive (purge) est sûre, groupée, et peut devenir automatique. | Un document supprimé par erreur se récupère. | Purge la corbeille. Purge automatique si activée (`TRASH_RETENTION_DAYS`, coupée par défaut). | — | à relire |
| #181 | Écran « Corbeille » : liste des documents supprimés, restauration, purge selon les droits. | Retrouve et restaure ses documents supprimés. | Restaure ou purge pour son périmètre. | — | relue ; défaut du menu contextuel en correction chez F |
| #179 | Un déplacement de document peut être annulé. Le reclassement est tracé dans le journal. | Annule un déplacement fait par erreur. | Voit les reclassements dans le journal. | — | relue |
| #184 | Dans l'explorateur : touche Suppr pour mettre à la corbeille, glisser-déposer pour reclasser, et « Annuler » juste après. | Supprime ou reclasse vite, et peut annuler. | Comme l'agent. | — | non validée tant que la nightly est rouge |
| #211 | Sélection multiple dans l'explorateur (Ctrl+clic, Maj+clic), puis mise à la corbeille groupée. | Met plusieurs documents à la corbeille en une fois. | Comme l'agent. | — | à relire ; suit #184 |
| #182 | Tests de bout en bout de l'annulation (suppression et déplacement). | — | — | — | non validée, nightly rouge ; pas de ligne dans les notes finales (validé par O) |

## Doublons

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #171 | Les fichiers identiques sont regroupés. On garde une copie, les autres vont à la corbeille. Rien n'est supprimé définitivement. | — | Fait le ménage des doublons de son périmètre. Une copie en cours de validation n'est pas mise à la corbeille. | — | relue avec remarques ; en attente du PO (dossier du 23, § 1) |
| #199 | Écran « Doublons », juste après la Corbeille dans le menu. La copie d'origine est présélectionnée. | — | Choisit la copie à garder et met les autres à la corbeille en une action. | — | à relire ; en attente du PO ; suit #182 et #171 |

## Alertes

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #162 | Indicateurs de qualité des documents : sans métadonnées, à revoir, sans texte lisible. Taux de qualité et listes des documents à corriger. | — | Voit les documents à compléter dans son périmètre. | Le manager voit la qualité de son service. | à relire |
| #194 | Onglet « Qualité » dans Rapports et statistiques, et écran des alertes de qualité. | — | Suit le taux de documents complets et règle ses alertes. | Le manager voit l'onglet pour son service. | à relire ; suit #183 |
| #183 | Alertes de qualité : on est prévenu quand un indicateur dépasse un seuil, en nombre ou en %. | — | Crée des règles d'alerte et reçoit les notifications. Si activé (`QUALITY_ALERTS_ENABLED`). | — | changements demandés (12:36) ; poussée en f1a1a1c, à relire |
| #155 | Les notifications arrivent tout de suite, sans recharger la page, même avec plusieurs serveurs. | Voit ses notifications en direct. Si activé (`NOTIFICATIONS_BROADCAST_MODE`, coupé par défaut). | Comme l'agent. | Comme l'agent. | à relire |
| #192 | Sauvegarde automatique chaque nuit, durée de conservation réglable, et alerte si elle échoue. | — | Super admin et exploitation : une sauvegarde par nuit sans action, une alerte en cas d'échec. Si activé (`SCHEDULED_BACKUP_ENABLED`, coupé par défaut). | — | à relire |

## Travail quotidien

Sixième groupe, validé par O le 17/11 : ces PR n'entrent dans aucun des cinq thèmes.

| PR | Ce qui change | Agent | Admin | Lecteur | État |
|---|---|---|---|---|---|
| #153 | Une seule file de validation, triée par ancienneté : mes documents, ceux de mon unité, ceux sans responsable. | Voit tout ce qu'il doit valider au même endroit. Si activé (`WORKFLOW_INBOX_ENABLED`). | Voit aussi les validations sans responsable. | — | à relire |
| #190 | Écran de la file de validation, à onglets. | Comme #153. | Comme #153. | — | à relire ; suit #181 et #153 |
| #165 | Favoris, documents récents et documents partagés avec moi. | Met des documents en favori (étoile) et retrouve ses derniers documents ouverts (récents si activés : `RECENT_DOCUMENTS_TRACKING_ENABLED`). | Comme l'agent. | Comme l'agent. | changements demandés (réglages absents du compose, comme #180 et #183) |
| #205 | Écran « Mes documents » : favoris, récents, partagés. | Comme #165. | Comme #165. | Comme #165. | à relire ; suit #165 |
| #186 | Un import de dossier interrompu reprend où il s'était arrêté, sans tout refaire. | — | Relance un gros import coupé sans doublons ni attente. | — | relue (OK de Q) ; rechaînera sa migration derrière #197 à son tour |

---

## Pour O

- **Lignes à confirmer par les auteurs** : la colonne « Ce qui change » vient des descriptions de PR. B et F peuvent corriger une formulation avant la release.
- **Réglages coupés par défaut** : `SCHEDULED_REPORTS_ENABLED`, `QUALITY_ALERTS_ENABLED`, `TRASH_RETENTION_DAYS`, `NOTIFICATIONS_BROADCAST_MODE`, `SCHEDULED_BACKUP_ENABLED`, `WORKFLOW_INBOX_ENABLED`, `RECENT_DOCUMENTS_TRACKING_ENABLED`. Règle validée par O le 17/11 : chacun est tranché au moment de la release V1.1 ; une ligne dont le réglage reste coupé sort des notes.
- **Q. 4 du PO** : la ligne #196 « Lecteur » sera fixée par sa réponse (recommandation B : son service seulement).
- **Q. 5 du PO** : #165 ne l'attend pas. La réponse donnera une PR à part : avec A, le valideur peut lire le document pendant son étape (contrôle d'accès) ; avec B, un filtre retire ces documents de « Partagés avec moi ».
