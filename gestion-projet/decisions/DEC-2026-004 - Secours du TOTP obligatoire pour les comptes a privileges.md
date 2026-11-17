# DEC-2026-004 — Secours du TOTP : application obligatoire pour les comptes à privilèges, réinitialisation par l'administrateur

- **Statut** : DÉCIDÉ le 17/11/2026 (accord du PO en séance, relayé par O vers 11:05) : option (d). Instruit pour le PO, présenté par O. Numéro confirmé par O le 17/11.
- **Instruction** : innovateur, 2026-11-17. Sources consultées le 17/11/2026 (§ 2). État GED237 `Vérifié` sur #193 (fcab5a1).
- **Contrainte du PO (17/11)** : les utilisateurs finaux sont des agents publics, peu enclins aux étapes supplémentaires. Des codes sur papier seront perdus, et une application imposée à tous sera contournée ou bloquera des comptes.
- **Calendrier** : #193 est gelée jusqu'au 30/11 (`plan-fusion-post-rc1.md` § 5). Cette décision ne touche ni la rc.1 ni la démo.

## 1. Contexte

#193 (L4 suite, brouillon) ajoute l'application d'authentification (TOTP) comme second facteur, avec l'e-mail en secours (décision 4 du PO). `Vérifié` dans le corps de la PR, quand `AUTH_TOTP_ENABLED=true` :

- **Secours à la connexion** : sur une session TOTP, « Renvoyer le code » envoie un code par e-mail. Ce code **remplace** le code de l'application pour la session.
- **Retrait du TOTP** : il suffit du mot de passe et d'un code, qui peut être celui reçu par e-mail (`/auth/totp/disable-code`).
- **Enrôlement** : libre, aucun n'est imposé par rôle.
- **Codes de secours** : aucun.
- **Réinitialisation par un administrateur** : aucune.
- **Rotation de `SECRET_KEY`** : les secrets TOTP ne se déchiffrent plus, et la connexion repasse par l'e-mail.

**Conséquence** (`Déduit`) : pour un compte TOTP, le second facteur vaut celui de la boîte mail. Quelqu'un qui détient le mot de passe et la boîte mail se connecte, puis retire le TOTP. Or le même mot de passe sert souvent aux deux.

## 2. Sources

| Source | Date | Ce qu'elle dit (extrait) |
|---|---|---|
| NIST SP 800-63B-4, § 3.1.3.1 | version finale, page horodatée 26/08/2025 | « Email SHALL NOT be used for out-of-band authentication ». Un code envoyé comme code de récupération (§ 4.2.1.2) n'est pas une authentification, et cette interdiction ne s'y applique pas. |
| NIST SP 800-63B-4, § 4.2 | idem | Quatre familles de recouvrement : codes sauvegardés, codes émis, contacts de confiance, **nouvelle vérification d'identité** (si le compte a été vérifié à l'origine). Au niveau AAL2 : deux codes de méthodes différentes, ou un code et un facteur unique lié au compte, ou une nouvelle vérification d'identité. Un code seul ne suffit pas. Tout recouvrement **SHALL** déclencher une notification à l'utilisateur. |
| OWASP Multifactor Authentication Cheat Sheet | sans date affichée | L'e-mail « relies entirely on the security of the email account, which often lacks MFA ». Pour le recouvrement : codes à usage unique, envoi postal, **support avec vérification d'identité rigoureuse**. Le recouvrement ne doit pas donner à l'attaquant un moyen de contourner le MFA. Il faut notifier l'utilisateur par un autre canal à chaque changement de facteur. |
| GitHub Docs, « Recovering your account if you lose your 2FA credentials » | sans date affichée | Le secours repose sur des codes de récupération. L'e-mail ne fait qu'**ouvrir** un recouvrement, qui exige ensuite un second élément et une revue humaine de trois jours ouvrés au plus. Sans aucun moyen de recouvrement, l'accès est perdu. |
| Google, « Sign in with backup codes » | © 2026, sans date d'article | 10 codes de 8 chiffres, chacun utilisable une seule fois. Un nouveau jeu invalide l'ancien. |

Lecture (`Déduit`) : l'e-mail ne remplace pas un second facteur à la connexion. Le secours repose soit sur des codes à usage unique, soit sur un **recouvrement contrôlé par une personne qui vérifie l'identité** (NIST : nouvelle vérification ; OWASP : support). Dans un ministère, l'administrateur de l'institution connaît les agents, et cette seconde voie s'y prête.

## 3. Options

| | (a) E-mail toujours accepté, avec alerte | (b) Codes de récupération pour les comptes TOTP | (c) (a) + (b) | **(d) TOTP obligatoire pour les comptes à privilèges, réinitialisation par l'administrateur** |
|---|---|---|---|---|
| Comptes ordinaires | e-mail | e-mail (TOTP proposé) | e-mail | **e-mail (TOTP proposé)** |
| Comptes à privilèges | TOTP ou e-mail | TOTP facultatif | TOTP ou e-mail | **TOTP obligatoire** |
| Téléphone perdu | e-mail, seul et tout de suite | code papier, sinon l'administrateur | e-mail | **l'administrateur, en personne** |
| Sécurité d'un compte TOTP | celle de la boîte mail ; l'alerte part dans la boîte de l'attaquant | mot de passe + application ou code (NIST § 4.2) | celle de la boîte mail | mot de passe + application ; recouvrement par vérification d'identité (NIST § 4.2) |
| Étapes en plus pour l'agent ordinaire | aucune | aucune s'il n'enrôle pas | aucune | **aucune** |
| Codes papier | non | **oui** (perdus, selon le PO) | oui | **non** |
| Coût (`Déduit`, B / F / Q) | 0,5 / 0,5 / 0,5 | 3,5 / 1,5 / 0,5 | 4 / 2 / 1 | **3,5 / 2 / 1** |

(b) et (d) incluent la clé TOTP séparée (§ 4, point 7).

## 4. Recommandation : (d), alternative (b)

(d) répond à la contrainte du PO : l'agent ordinaire ne voit aucune étape de plus, et aucun code papier n'existe. Le TOTP protège les comptes dont le vol coûte le plus. L'administrateur de l'institution remplace les codes papier par une vérification d'identité en personne, que le NIST (§ 4.2) et l'OWASP reconnaissent. Les sept conditions :

1. **Obligation par rôle** : `tenant_admin` et `super_admin` doivent enrôler l'application. La liste des rôles est un réglage (`AUTH_TOTP_REQUIRED_ROLES`), pas du code en dur.
   - Tant qu'un compte à privilèges n'a pas enrôlé, sa connexion (mot de passe + code par e-mail) mène **uniquement** à l'écran d'enrôlement. Aucun jeton d'accès n'est délivré avant la confirmation.
   - Les autres rôles peuvent enrôler librement.
2. **Pas d'e-mail pour un compte TOTP**, ni à la connexion ni pour le retrait :
   - « Renvoyer le code » ne s'affiche pas sur une session TOTP ;
   - `/totp/disable-code` par e-mail est supprimé ;
   - le retrait exige le mot de passe et un code de l'application, et il est refusé pour un rôle où le TOTP est obligatoire.
3. **Notification et audit à chaque usage** (NIST § 4.2, OWASP) : enrôlement, retrait, réinitialisation, échec répété. Chaque événement donne une entrée d'audit, un e-mail d'information au titulaire (il n'authentifie rien) et un message à la connexion suivante.
4. **Réinitialisation après vérification en personne** :

   | Compte à réinitialiser | Qui réinitialise | Comment |
   |---|---|---|
   | agent ordinaire qui a enrôlé | `tenant_admin` de son institution | bouton dans la fiche utilisateur |
   | `tenant_admin` | `super_admin` | même bouton, côté plateforme ; un `tenant_admin` ne réinitialise ni un autre administrateur ni lui-même |
   | `super_admin` | un autre `super_admin` ; à défaut, la **procédure d'exploitation hors application** | script lancé dans le conteneur API par l'exploitant (`docker compose exec api …`), qui écrit l'audit et envoie l'e-mail au titulaire |

   Il faut au moins **deux `super_admin`** pour ne pas dépendre de la procédure d'exploitation.

   La réinitialisation supprime le secret TOTP. Le titulaire, présent, ré-enrôle **sur place**, dans la même séance. Sinon, son compte à privilèges reste limité à l'écran d'enrôlement (point 1). Une réinitialisation non suivie d'un enrôlement dans les 24 h est signalée à son auteur.
5. **Pas de codes papier.**
6. **Comptes ordinaires** : l'e-mail reste la règle (décision 4), sans changement.
7. **Clé TOTP séparée** (retenue par O) : `TOTP_ENCRYPTION_KEYS`, avec rotation sans coupure par `MultiFernet` (`cryptography`, déjà installée).
   - Elle évite qu'une rotation de `SECRET_KEY` bloque d'un coup tous les comptes à privilèges.
   - Sous (d), ce sont eux qui réinitialisent les autres : seule la procédure d'exploitation resterait alors.

**Migration** : (d) n'ajoute aucune table. La réinitialisation supprime la ligne `user_totp` créée par la migration de #193 (`d4e8b2c6a1f3`). La chaîne alembic du plan de fusion (§ 2) reste inchangée.

**Alternative (b)** (codes de récupération, 10 codes de 80 bits à usage unique, sans obligation par rôle) : à retenir si le PO préfère que l'agent se dépanne sans l'administrateur. Elle coûte B 3,5 / F 1,5 / Q 0,5 h-s avec la clé séparée, et réintroduit les codes papier.

## 5. Charge de support de (d) (`Déduit`, hypothèses à confirmer)

- **Qui appelle** : seuls les comptes qui ont enrôlé l'application. Ce sont les comptes à privilèges, en petit nombre (hypothèse : 1 à 3 `tenant_admin` par institution, 2 `super_admin` pour la plateforme), plus les volontaires. Un agent ordinaire qui perd son téléphone n'appelle pas : il reçoit toujours son code par e-mail.
- **Fréquence** : hypothèse d'un changement ou d'une perte de téléphone tous les 2 à 3 ans par titulaire, sans transfert de l'application, soit **≈ 0,4 réinitialisation par compte TOTP et par an**. Exemple : une institution avec 3 administrateurs et 20 volontaires compte **≈ 9 réinitialisations par an**, moins d'une par mois. Chacune prend ≈ 10 à 15 minutes en personne (vérification, réinitialisation, ré-enrôlement).
- **Ce qui la réduit** : les applications qui sauvegardent leurs secrets (Google Authenticator, Microsoft Authenticator) évitent la plupart des réinitialisations quand l'agent change de téléphone. C'est une source secondaire, `À vérifier` sur les pages des éditeurs avant de le promettre aux agents. Un guide d'enrôlement d'une page fait la même chose.
- **Le risque principal** : un `tenant_admin` absent quand un agent est bloqué. La parade : deux administrateurs par institution, ou le `super_admin` en relais.

## 6. Coût de (d) (`Déduit`, en heures de session)

| Session | h-s | Détail |
|---|---|---|
| B | **≈ 3,5** | obligation par rôle et écran d'enrôlement forcé, sans jeton avant la confirmation : 1 ; pas d'e-mail pour un compte TOTP (connexion et retrait) : 0,5 ; réinitialisation avec règles par rôle, audit et e-mail : 1 ; script d'exploitation `super_admin` : 0,5 ; clé séparée `MultiFernet` : 0,5 |
| F | **≈ 2** | écran d'enrôlement forcé après connexion (QR, confirmation) : 1 ; enrôlement volontaire dans le profil : 0,5 ; bouton « Réinitialiser l'application » dans la fiche utilisateur : 0,5 |
| Q | **≈ 1** | passe ciblée : enrôlement imposé à un `tenant_admin` ; e-mail refusé pour un compte TOTP ; réinitialisation (règles par rôle, audit, e-mail) ; script `super_admin` ; rotation de la clé |

## 7. Écart au NIST que (d) laisse

- **Comptes non privilégiés** : l'e-mail reste leur second facteur, contraire au NIST § 3.1.3.1. C'est la limite déjà consignée de la décision 4 : (d) ne la crée pas et ne la rouvre pas. Elle reste acceptée parce qu'elle porte sur les comptes dont les droits sont les plus faibles, et que l'imposer aux agents bloquerait des comptes (contrainte du PO).
- **Comptes à privilèges** : aucun écart. Le second facteur est l'application. Le recouvrement passe par une vérification d'identité en personne avec notification (§ 4.2), à condition que l'identité de l'agent ait été établie à son arrivée (`Déduit` : cas d'un agent public).

## 8. Décision du PO

**Décidé le 17/11/2026, accord du PO en séance** (réponse « ok » vers 11:05, relayée par O) :

- **Option (d) retenue** ; (b) reste l'alternative instruite, non retenue.
- **TOTP obligatoire pour `tenant_admin` et `super_admin` seulement** (réglage `AUTH_TOTP_REQUIRED_ROLES`) ; les autres rôles gardent le code par e-mail, le TOTP leur reste proposé.
- **Au moins deux `super_admin`** par installation. Les sept conditions du § 4 s'appliquent telles quelles, y compris la procédure d'exploitation hors application si un seul `super_admin` reste joignable.
- **Mise en œuvre** : B ≈ 3,5 h-s et F ≈ 2 h-s, prévenus par O ; la part de Q (≈ 1 h-s) vient après le 30. Aucune migration nouvelle : la chaîne alembic du plan de fusion ne change pas, et #193 reste après le 30.

Questions posées au PO (instruction du 17/11) :

1. (d), recommandée, ou (b).
2. Rôles soumis à l'obligation : `tenant_admin` et `super_admin` (réglage, extensible à `auditor` plus tard).
3. Au moins deux `super_admin`, et une procédure d'exploitation pour le cas où il n'en resterait qu'un.

**Précision du 17/11/2026** (O, complément de procédure qui ne change pas l'option (d)) : « Avant de réinitialiser, le niveau supérieur vérifie votre carte professionnelle (ou une pièce d'identité). » Elle vaut pour chaque ligne du tableau du § 4, point 4, et figure dans `gestion-projet/innovateur/fiche-admin-verification-application.md`.
