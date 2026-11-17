# Fiche admin : activer la vérification par application

- **Pour** : les administrateurs d'institution (`tenant_admin`) et de plateforme (`super_admin`). Elle sert pour #193 et pour les écrans de F.
- **Règles** : DEC-2026-004, option (d), décidée par le PO le 17/11. Le contrat est celui de la PR #193 (tête 3d0e4a7 au 17/11 ; a744d07 relue en lecture seule) : code à 6 chiffres renouvelé toutes les 30 s, émetteur affiché « E-Dossier ».
- **Libellés** : ceux des écrans de F, confirmés le 17/11 (commit 97a5d3e de `feat/post-rc1-totp-ui`). F confirme à l'ouverture de sa PR si l'un d'eux change.
- **Hors fiche** : la clé du serveur et le script d'exploitation, qui relèvent de l'installation (`protocole-installation-site.md`).

---

## Activer la vérification par application

Votre compte d'administrateur donne accès à toute l'institution. Pour le protéger, chaque connexion demande, en plus du mot de passe, un code à 6 chiffres affiché par une application sur votre téléphone. Ce code change toutes les 30 secondes. Il ne passe ni par e-mail ni par SMS.

### 1. Installer l'application (une fois, 2 minutes)

1. Sur votre téléphone, ouvrez Play Store (Android) ou App Store (iPhone).
2. Installez une application de codes gratuite, par exemple **Google Authenticator** ou **Microsoft Authenticator**.
3. Si l'application propose de sauvegarder vos codes, acceptez. En cas de changement de téléphone, vous éviterez une réinitialisation.

### 2. Relier l'application à votre compte (une fois, 3 minutes)

1. Connectez-vous comme d'habitude : identifiant, mot de passe, puis le code reçu par e-mail.
2. L'écran « Protégez votre compte » s'affiche. Vous ne pouvez pas aller plus loin sans cette étape.
3. Dans l'application, touchez **+**, puis **Scanner un code QR**, et visez le carré affiché à l'écran.
   - Le scan ne marche pas ? Touchez **Saisir la clé à la main** et recopiez la clé dans l'application.
   - La page s'est rechargée ? Un nouveau carré s'affiche. Supprimez la ligne « E-Dossier » déjà créée dans l'application, puis scannez de nouveau.
4. L'application affiche une ligne « E-Dossier » avec un code à 6 chiffres.
5. Tapez ce code dans le champ **Code à 6 chiffres**, puis touchez **Valider**.
6. C'est fait : vous arrivez dans E-Dossier. Un e-mail vous confirme l'ajout de l'application.

« Code incorrect » ? Attendez le code suivant et recommencez. Une erreur ne bloque pas le compte. Après 5 essais en une minute, l'écran affiche « Trop d'essais. Réessayez dans une minute. » : patientez une minute. Au bout de 10 minutes, l'écran affiche « Délai dépassé. Reconnectez-vous. » : reconnectez-vous et reprenez à l'étape 1.

### 3. Se connecter ensuite (chaque jour)

1. Identifiant et mot de passe.
2. Ouvrez l'application et tapez le code « E-Dossier » affiché.

Aucun code n'arrive par e-mail, et le bouton « Renvoyer le code » n'existe pas pour votre compte : c'est normal.
Un code ne sert qu'une fois. Si vous vous reconnectez aussitôt, attendez le code suivant.
« Code invalide » à chaque essai ? Vérifiez que l'heure de votre téléphone est réglée sur **automatique**.
Après 3 codes faux, votre compte est bloqué 15 minutes, même avec le bon mot de passe. L'écran affiche le temps restant et vous recevez un e-mail. Si ce n'est pas vous, prévenez un administrateur de plateforme.

### 4. Téléphone perdu, volé ou changé sans sauvegarde

Vous ne pouvez pas vous dépanner seul, et l'e-mail ne remplace pas l'application. C'est voulu : un voleur ne doit pas pouvoir le faire à votre place.

1. Allez voir **en personne** la personne de niveau supérieur :
   - vous êtes administrateur d'institution : un administrateur de plateforme ;
   - vous êtes administrateur de plateforme : un **autre** administrateur de plateforme.
2. Avant de réinitialiser, le niveau supérieur vérifie votre carte professionnelle (ou une pièce d'identité). Il choisit ensuite **Réinitialiser l'application d'authentification** dans le menu de votre compte. L'écran lui rappelle : « Vérifiez l'identité de l'administrateur en personne. » et « Toutes ses sessions seront fermées. »
3. **Toutes vos sessions sont fermées aussitôt**, sur tous les appareils, y compris le téléphone perdu. Vous recevez un e-mail qui signale la réinitialisation. À la connexion suivante, un bandeau en donne la date et l'heure, avec « Pas vous ? Contactez un administrateur de plateforme. »
4. Sur place, reconnectez-vous et refaites la partie 2 avec votre nouveau téléphone.

Vous êtes administrateur d'institution ? C'est vous qui réinitialisez l'application des agents de votre institution, Admin Service compris ; un administrateur de plateforme ne peut pas le faire à votre place. Vous ne pouvez pas réinitialiser votre propre compte. Même règle : vérifiez **en personne** sa carte professionnelle (ou une pièce d'identité), jamais par téléphone ni par e-mail. Prévenez l'agent que toutes ses sessions vont se fermer.

### 5. Pourquoi votre compte doit avoir une adresse e-mail

- **Pour la première connexion** : le code e-mail vous mène à l'écran de la partie 2. Sans adresse, vous ne pourriez jamais l'atteindre. L'application refuse donc de créer ou de modifier un compte administrateur sans adresse e-mail.
- **Pour vous prévenir** : chaque ajout, retrait ou réinitialisation de l'application vous est signalé par e-mail. Si vous recevez un tel e-mail sans avoir rien fait, prévenez tout de suite un administrateur de plateforme.

L'e-mail sert à vous informer. Il ne remplace jamais le code de l'application pour vous connecter.

### À retenir

- Au moins **deux administrateurs de plateforme** doivent avoir l'application. Sinon, un téléphone perdu peut bloquer tout le monde.
- Vous ne pouvez pas retirer l'application de votre compte : elle est obligatoire pour votre rôle.
