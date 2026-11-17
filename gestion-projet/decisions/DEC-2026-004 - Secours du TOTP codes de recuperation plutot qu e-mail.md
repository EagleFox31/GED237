# DEC-2026-004 — Secours du TOTP : codes de récupération plutôt que l'e-mail

- **Statut** : PROPOSÉ. Instruit pour le PO, présenté par O ; le numéro est à confirmer par O.
- **Instruction** : innovateur, 2026-11-17. Sources consultées le 17/11/2026 (§ 2). État GED237 `Vérifié` sur #193 (fcab5a1).
- **Calendrier** : #193 est gelée jusqu'au 30/11 (`plan-fusion-post-rc1.md` § 5). Cette décision ne touche ni la rc.1 ni la démo.

## 1. Contexte

#193 (L4 suite, brouillon) ajoute l'application d'authentification (TOTP) comme second facteur principal, avec l'e-mail en secours (décision 4 du PO). `Vérifié` dans le corps de la PR, quand `AUTH_TOTP_ENABLED=true` :

- **Secours à la connexion** : sur une session TOTP, « Renvoyer le code » envoie un code par e-mail. Ce code **remplace** le code de l'application pour la session.
- **Retrait du TOTP** : il suffit du mot de passe et d'un code, qui peut être celui reçu par e-mail (`/auth/totp/disable-code`).
- **Codes de secours** : aucun (« l'e-mail est le secours »).
- **Réinitialisation par un administrateur** : aucune.
- **Rotation de `SECRET_KEY`** : les secrets TOTP ne se déchiffrent plus, et la connexion repasse par l'e-mail.

**Conséquence** (`Déduit`) : pour un compte TOTP, le second facteur vaut celui de la boîte mail. Quelqu'un qui détient le mot de passe et la boîte mail se connecte, puis retire le TOTP. Or le même mot de passe sert souvent aux deux.

## 2. Sources

| Source | Date | Ce qu'elle dit (extrait) |
|---|---|---|
| NIST SP 800-63B-4, § 3.1.3.1 | version finale, page horodatée 26/08/2025 | « Email SHALL NOT be used for out-of-band authentication ». Un code envoyé comme code de récupération (§ 4.2.1.2) n'est pas une authentification, et cette interdiction ne s'y applique pas. |
| NIST SP 800-63B-4, § 4.2 | idem | Quatre familles de recouvrement : codes sauvegardés, codes émis (adresse postale, e-mail, SMS ; valables 24 h), contacts de confiance, nouvelle vérification d'identité. Au niveau **AAL2**, le recouvrement exige au choix : deux codes de méthodes différentes ; **un code et un facteur unique déjà lié au compte** ; ou une nouvelle vérification d'identité. **Un code seul ne suffit pas.** Un code sauvegardé porte au moins 64 bits aléatoires. Tout recouvrement **SHALL** déclencher une notification à l'utilisateur. |
| OWASP Multifactor Authentication Cheat Sheet | sans date affichée | L'e-mail « relies entirely on the security of the email account, which often lacks MFA ». Pour le recouvrement : « single-use recovery codes when they first setup MFA ». Le recouvrement ne doit pas donner à l'attaquant un moyen de contourner le MFA. Il faut notifier l'utilisateur par un autre canal à chaque changement de facteur, et ré-authentifier avec un facteur existant avant tout changement. |
| GitHub Docs, « Recovering your account if you lose your 2FA credentials » | sans date affichée | Le secours repose sur des codes de récupération. Le code envoyé par e-mail ne fait qu'**ouvrir** un recouvrement, qui exige ensuite un second élément (appareil déjà vérifié, clé SSH, jeton) et une revue humaine de trois jours ouvrés au plus. Sans aucun moyen de recouvrement, l'accès est perdu. |
| Google, « Sign in with backup codes » | © 2026, sans date d'article | 10 codes de 8 chiffres, chacun utilisable une seule fois. Un nouveau jeu invalide l'ancien. Ils servent en cas de téléphone perdu ou de numéro changé. |

Lecture (`Déduit`) : les quatre sources convergent. L'e-mail ne remplace pas un second facteur à la connexion. Le secours repose sur des **codes de récupération à usage unique**, et la **perte totale des facteurs** se traite par un recouvrement contrôlé, jamais par l'e-mail seul.

## 3. Options

| | (a) E-mail toujours accepté, avec alerte | (b) Codes de récupération pour les comptes TOTP, e-mail pour les comptes sans TOTP | (c) Les deux |
|---|---|---|---|
| Sécurité d'un compte TOTP | ramenée au niveau de la boîte mail. **L'alerte part dans cette même boîte**, donc l'attaquant qui la tient la lit avant l'utilisateur | mot de passe + application, ou mot de passe + un code de récupération : c'est le cas « un code + un facteur » du NIST § 4.2 | identique à (a), car le chemin e-mail reste ouvert |
| Conformité NIST 800-63B-4 | non (§ 3.1.3.1) | oui pour les comptes TOTP | non |
| Utilisateur qui perd son téléphone | se reconnecte seul, tout de suite | utilise un code de récupération. S'il les a perdus aussi, il passe par la réinitialisation par l'administrateur (§ 4, point 5) | se reconnecte seul |
| Charge de support | nulle | quelques réinitialisations par l'administrateur, chacune tracée | nulle |
| Coût B (`Déduit`) | ≈ 0,5 h-s | ≈ 3 h-s | ≈ 3,5 h-s, et deux chemins à tester |

## 4. Recommandation : (b), avec cinq conditions

Je **confirme (b)**, la recommandation de O. Les sources ne justifient ni (a) ni (c) : les deux laissent l'e-mail contourner le TOTP, ce que l'OWASP désigne comme l'écueil principal du recouvrement. En revanche, (b) tel qu'il est formulé est **incomplet**. Sans réinitialisation par un administrateur, un agent qui perd à la fois son téléphone et ses codes perd son compte (c'est le cas GitHub), ce qui est inacceptable dans un ministère. Les conditions :

1. **Codes** :
   - 10 codes de 16 caractères base32 (80 bits, au-dessus des 64 bits du NIST), affichés une seule fois à la confirmation de l'enrôlement ;
   - gardés en empreinte, sans dépendre de `SECRET_KEY` ;
   - chacun consommé une seule fois, de façon atomique ;
   - un nouveau jeu invalide l'ancien, et il faut le mot de passe et un code de l'application pour en générer un.
2. **Connexion** : le mot de passe et un code de récupération remplacent le code de l'application. L'écran affiche le nombre de codes restants et propose un nouveau jeu à partir de 2 codes restants.
3. **Plus d'e-mail pour un compte TOTP** :
   - « Renvoyer le code » ne s'affiche plus sur une session TOTP ;
   - retirer le TOTP exige le mot de passe et un code de l'application ou de récupération (`/totp/disable-code` par e-mail est supprimé) ;
   - les comptes sans TOTP gardent l'e-mail (décision 4).
4. **Notification** (NIST § 4.2, OWASP) : pour chaque code utilisé, nouveau jeu, retrait ou réinitialisation, une entrée d'audit, un e-mail d'information (il n'authentifie rien) et un message à la connexion suivante.
5. **Réinitialisation par un administrateur** (l'équivalent de la « nouvelle vérification d'identité » du NIST) :
   - réservée à l'administrateur de l'institution, après vérification de l'identité de l'agent en personne (procédure d'exploitation) ;
   - tracée et notifiée ;
   - le compte repasse sans TOTP (donc à l'e-mail) jusqu'à un nouvel enrôlement.

**Point lié, à trancher avec B** : sous (b), une rotation de `SECRET_KEY` ne bascule plus vers l'e-mail. Elle bloque tous les comptes TOTP, qui doivent alors utiliser un code de récupération ou une réinitialisation. Je propose une clé de chiffrement TOTP séparée, avec rotation sans coupure (`MultiFernet` de `cryptography`, déjà installée) : ≈ 0,5 h-s de plus.

**Migration** : la table des codes s'ajoute **dans la migration de #193** (`d4e8b2c6a1f3`, pas encore fusionnée). La chaîne alembic du plan de fusion (§ 2) reste inchangée.

## 5. Coût (`Déduit`, en heures de session)

| Session | (b) | Détail |
|---|---|---|
| B | **≈ 3** (+ 0,5 avec la clé séparée) | codes, connexion et nouveau jeu : 1,5 ; réinitialisation par l'administrateur, avec audit et notification : 1 ; retrait du secours e-mail des comptes TOTP et tests : 0,5 |
| F | ≈ 1,5 | affichage unique des codes avec téléchargement ; lien « Utiliser un code de récupération » à la connexion ; bouton de réinitialisation dans la fiche utilisateur de l'administrateur |
| Q | ≈ 0,5 | passe ciblée : connexion par code de récupération, code réutilisé refusé, réinitialisation par l'administrateur |

## 6. Limite connue, hors de cette décision

Pour les comptes **sans** TOTP, l'e-mail reste le second facteur (décision 4 du PO), ce qui n'est pas conforme au NIST § 3.1.3.1. Cette décision ne rouvre pas la décision 4. Question pour plus tard, sans engagement : rendre le TOTP obligatoire pour les profils à privilèges (administrateur, auditeur).

## 7. Décision attendue du PO

1. (a), (b) ou (c). Recommandé : (b) avec les conditions du § 4.
2. Accord pour la réinitialisation par l'administrateur de l'institution, après vérification en personne.
3. Clé de chiffrement TOTP séparée : oui ou non.
