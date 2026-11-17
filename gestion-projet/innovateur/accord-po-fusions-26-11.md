# Accord du PO du 26/11 : fusions post-rc1 avant la démo

- **Pour** : le PO, présenté par O le 26/11. Innovateur, 2026-11-17, d'après les corps des PR au 17/11 (`Vérifié`). Les champs à remplir le sont par Q (ou F) après chaque passe.
- **Règle** (§ 6 du plan de B ; `plan-fusion-post-rc1.md` § 4 et § 6) : entre le 24 et le 30, L2, L3, L4 et L6 ne fusionnent qu'avec leur passe ciblée verte **et** un accord écrit du PO. #179 suit la même règle (décision O du 17/11). Les fusions ont lieu à partir du 27. La démo tourne sur le dernier tag rc, que ces fusions ne changent pas.
- **Sans accord, ou si la passe est rouge** : la chaîne fusionne après le 30. Les autres fiches ne bougent pas.

## Fiche 1 : L2, corbeille (#152) et annulation (#179)

Même chaîne le 27 : #152 → #179 → #181 (écran Corbeille) → #184 (bouton « Annuler ») → #182.

**Ce qui change pour l'utilisateur**
- « Supprimer » envoie le document à la corbeille au lieu de l'effacer, et l'action est tracée dans le journal. Seul l'administrateur peut supprimer définitivement.
- Après une suppression ou un déplacement, un bouton « Annuler » s'affiche 10 secondes ; Ctrl+Z annule cette dernière action.

**Risque** : moyen.
- On ne peut plus effacer un document qui n'est pas dans la corbeille : le serveur refuse, au lieu d'accepter comme avant.
- « Annuler » n'est pas proposé pour un déplacement vers ou depuis l'espace d'une personne, ni pour un document sans service cible.
- Le glisser-déposer piloté par les tests est parfois instable sous Chromium (#182, contourné dans le test).
- Aucune migration ; la purge automatique est désactivée par défaut (`TRASH_RETENTION_DAYS=0`).

**Passes ciblées**

| Passe | Ce qu'elle prouve | Résultat (à remplir) |
|---|---|---|
| #168 | cycle de vie de la corbeille, par l'API : supprimer, restaurer, purger | run : … ; commit : … ; verdict : … ; date : … ; par : … |
| UAT de #181 (`uat/trash.spec.ts`) | **l'écran** suppression + corbeille (#168 ne passe que par l'API) | run : … ; commit : … ; verdict : … ; date : … ; par : … |
| #182 | annuler une suppression ou un déplacement, depuis l'écran | run : … ; commit : … ; verdict : … ; date : … ; par : … |

**Phrase d'accord**, à coller sur #152, #179, #181, #184 et #182 :

> Accord PO du 26/11 : fusion avant le 30 de #152, #179, #181, #184 et #182, dans cet ordre, à partir du 27. Passes #168, UAT de #181 et #182 vertes (liens ci-dessus). « Supprimer » met en corbeille ; seul l'administrateur purge.

## Fiche 2 : L3, file de validation unifiée (#153 + #190)

Chaîne le 28, après la fiche 1 (#190 est construite sur #181) : #153 → #190.

**Ce qui change pour l'utilisateur**
- La page « Tâches & Validations » a trois onglets : « À moi », « Mon unité » (lecture seule) et « Sans validateur » (avec un lien « Assigner »). Chaque onglet ne s'affiche que si l'utilisateur a le droit de le voir.
- Tant que le réglage reste éteint (défaut), l'écran garde la file actuelle, sans onglet « Mon unité » ; seul l'ordre des tâches devient stable (la plus ancienne d'abord).

**Risque** : faible avec le réglage éteint ; moyen si on l'allume. Le chemin de validation de la démo passe par ces écrans (163 lignes réécrites, relevé O du 17/11). Aucune migration.

**Passes ciblées**

| Passe | Ce qu'elle prouve | Résultat (à remplir) |
|---|---|---|
| #170, réglage **éteint** | circuit de visa de bout en bout, comportement d'aujourd'hui | run : … ; commit : … ; verdict : … ; date : … ; par : … |
| #170, réglage **allumé** | même circuit avec la file unifiée ; document en corbeille exclu | run : … ; commit : … ; verdict : … ; date : … ; par : … |
| UAT de #190 (`uat/workflow-inbox.spec.ts`) | onglets, droits, repli sans erreur quand le réglage est éteint | run : … ; commit : … ; verdict : … ; date : … ; par : … |

**Phrase d'accord**, à coller sur #153 et #190 :

> Accord PO du 26/11 : fusion avant le 30 de #153 puis #190, à partir du 28, avec `WORKFLOW_INBOX_ENABLED=false` laissé par défaut. Passe #170 verte réglage éteint et allumé, UAT de #190 verte (liens ci-dessus).

## Fiche 3 : L4, envoi et renvoi du code de connexion (#154)

Le 28. #193 (TOTP) n'est pas concernée : elle passe après le 30, car elle porte une migration.

**Ce qui change pour l'utilisateur**
- Rien de visible avec le réglage par défaut (`AUTH_OTP_CHANNEL=dev_response`) : la connexion en deux temps reste la même.
- Le code n'est plus gardé en clair côté serveur, et un nouveau service permet de renvoyer le code (pas plus d'une fois toutes les 30 secondes). Aucun bouton à l'écran dans cette PR.

**Risque** : moyen. C'est le seul point d'entrée de l'application, et le changement de stockage du code n'a **pas** de réglage pour revenir en arrière. Aucune migration.

**Connexions en cours au moment du déploiement** : elles aboutissent. La PR lit encore l'ancien format, le code gardé en clair, et son test « ancien format accepté » le couvre (corps de #154, `Vérifié` ; test non rejoué par moi). Un code vit 300 s (`OTP_EXPIRY_SECONDS`, `auth_service.py` l. 32) : cinq minutes après le déploiement, il ne reste plus aucun code à l'ancien format.

**Retour arrière réel : annuler le commit** (`git revert` du commit de fusion de #154 sur `main`, puis redéploiement). Ce retour n'est **pas** symétrique :

- Le code de `main` compare le code saisi au contenu de Redis, en clair (`secrets.compare_digest`, `auth_service.py` l. 171). Une empreinte `h1:…` laissée par #154 ne correspond donc jamais.
- Une connexion commencée avant le retour arrière échoue donc avec « code incorrect », et l'échec est compté. Au troisième essai, le compte est verrouillé 15 minutes (`AUTH_OTP_MAX_FAILURES=3`, `AUTH_LOCKOUT_SECONDS=900`).
- La parade, juste après le redéploiement : supprimer les clés `otp:*` de Redis. Les utilisateurs concernés voient alors « session expirée » et recommencent leur connexion, sans compter d'échec. Un compte déjà verrouillé se débloque par la procédure d'exploitation de l'administrateur.
- Sinon, il faut attendre 5 minutes, sans pouvoir empêcher les verrouillages pendant ce temps.

**Passes ciblées**

| Passe | Ce qu'elle prouve | Résultat (à remplir) |
|---|---|---|
| #172 | renvoi du code : nouveau code accepté, ancien refusé, délai de 30 s respecté | run : … ; commit : … ; verdict : … ; date : … ; par : … |
| fumée `auth-2fa`, sur la branche de #154 | **connexion complète, code faux, verrouillage** (#172 ne couvre que le renvoi) | run : … ; commit : … ; verdict : … ; date : … ; par : … |

**Phrase d'accord**, à coller sur #154 :

> Accord PO du 26/11 : fusion avant le 30 de #154, à partir du 28, avec `AUTH_OTP_CHANNEL=dev_response` laissé par défaut. Passe #172 et fumée `auth-2fa` vertes sur la branche (liens ci-dessus). #193 (TOTP) reste après le 30.

## Fiche 4 : L6, notifications en temps réel (#155)

Le 28.

**Ce qui change pour l'utilisateur**
- Rien de visible avec le réglage par défaut (`NOTIFICATIONS_BROADCAST_MODE=off`) : la cloche lit toujours la liste des notifications.
- Le canal temps réel refuse désormais une connexion faite après une déconnexion ou avec un mauvais jeton, comme le reste de l'application. Ce refus s'applique quel que soit le réglage.

**Risque** : faible à moyen. Si l'écran ouvre le canal avec un jeton que le serveur refuse désormais, la cloche ne se met plus à jour en direct. Le code de l'écran (`useNotifications.ts`) n'a pas été vérifié dans un navigateur (relevé O du 17/11). Aucune migration.

**Passes ciblées**

| Passe | Ce qu'elle prouve | Résultat (à remplir) |
|---|---|---|
| #169 | canal ouvert depuis le navigateur : bon jeton accepté, jeton de rafraîchissement et jeton après déconnexion refusés | run : … ; commit : … ; verdict : … ; date : … ; par : … |
| contrôle manuel F, branche de #155 | **la cloche** reçoit une notification avant la déconnexion et plus rien après (#169 ne regarde pas l'écran) | capture : … ; verdict : … ; date : … ; par : … |

**Phrase d'accord**, à coller sur #155 :

> Accord PO du 26/11 : fusion avant le 30 de #155, à partir du 28, avec `NOTIFICATIONS_BROADCAST_MODE=off` laissé par défaut. Passe #169 verte et contrôle de la cloche par F (liens ci-dessus).

## Compléments proposés à O

Q et F décident s'ils les ajoutent.

| Lot | Complément | Pourquoi |
|---|---|---|
| L2 | UAT de #181 | #168 ne passe que par l'API ; le § 6 de B demande « écran suppression + corbeille ». |
| L3 | #170 dans les deux modes | le défaut éteint est ce qui part sur `main`. |
| L4 | fumée `auth-2fa` | #172 ne couvre ni le code faux ni le verrouillage. |
| L6 | contrôle manuel de la cloche | #169 ne vérifie pas l'écran. |
