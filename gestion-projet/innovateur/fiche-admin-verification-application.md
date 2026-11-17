# Fiche admin : activer la vérification par application

- **Pour** : les administrateurs d'institution (`tenant_admin`) et de plateforme (`super_admin`). Elle sert pour #193 et pour les écrans de F.
- **Règles** : DEC-2026-004, option (d), décidée par le PO le 17/11. Le contrat est celui de la PR #193 (f2cc377) : code à 6 chiffres renouvelé toutes les 30 s, émetteur affiché « E-Dossier ».
- **Libellés** : les écrans de F ne sont pas encore écrits (worktree `GED237-totp-ui`, sans changement le 17/11). Chaque `[LIBELLÉ : …]` marque un texte d'écran que F doit reprendre tel quel, ou corriger ici.
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
2. L'écran [LIBELLÉ : titre de l'écran d'enrôlement, par ex. « Protégez votre compte »] s'affiche. Vous ne pouvez pas aller plus loin sans cette étape.
3. Dans l'application, touchez **+**, puis **Scanner un code QR**, et visez le carré affiché à l'écran.
   - Le scan ne marche pas ? Touchez [LIBELLÉ : lien vers la clé en texte, par ex. « Saisir la clé à la main »] et recopiez la clé dans l'application.
4. L'application affiche une ligne « E-Dossier » avec un code à 6 chiffres.
5. Tapez ce code dans le champ [LIBELLÉ : champ du code], puis touchez [LIBELLÉ : bouton de confirmation, par ex. « Valider »].
6. C'est fait : vous arrivez dans E-Dossier. Un e-mail vous confirme l'ajout de l'application.

Code refusé ? Attendez le code suivant et recommencez. Une erreur ne bloque pas le compte. Au bout de 10 minutes, l'écran expire : reconnectez-vous et reprenez à l'étape 1.

### 3. Se connecter ensuite (chaque jour)

1. Identifiant et mot de passe.
2. Ouvrez l'application et tapez le code « E-Dossier » affiché.

Aucun code n'arrive par e-mail, et le bouton « Renvoyer le code » n'existe pas pour votre compte : c'est normal.
Le code est toujours refusé ? Vérifiez que l'heure de votre téléphone est réglée sur **automatique**.

### 4. Téléphone perdu, volé ou changé sans sauvegarde

Vous ne pouvez pas vous dépanner seul, et l'e-mail ne remplace pas l'application. C'est voulu : un voleur ne doit pas pouvoir le faire à votre place.

1. Allez voir **en personne** la personne de niveau supérieur :
   - vous êtes administrateur d'institution : un administrateur de plateforme ;
   - vous êtes administrateur de plateforme : un **autre** administrateur de plateforme.
2. Avant de réinitialiser, le niveau supérieur vérifie votre carte professionnelle (ou une pièce d'identité). Il touche ensuite [LIBELLÉ : action de réinitialisation dans la fiche de l'agent].
3. **Toutes vos sessions sont fermées aussitôt**, sur tous les appareils, y compris le téléphone perdu. Vous recevez un e-mail qui le confirme.
4. Sur place, reconnectez-vous et refaites la partie 2 avec votre nouveau téléphone.

Vous gérez des agents ? Leur réinitialisation suit la même règle : vérifiez **en personne** sa carte professionnelle (ou une pièce d'identité), jamais par téléphone ni par e-mail. Prévenez l'agent que toutes ses sessions vont se fermer.

### 5. Pourquoi votre compte doit avoir une adresse e-mail

- **Pour la première connexion** : le code e-mail vous mène à l'écran de la partie 2. Sans adresse, vous ne pourriez jamais l'atteindre. L'application refuse donc de créer ou de modifier un compte administrateur sans adresse e-mail.
- **Pour vous prévenir** : chaque ajout, retrait ou réinitialisation de l'application vous est signalé par e-mail. Si vous recevez un tel e-mail sans avoir rien fait, prévenez tout de suite un administrateur de plateforme.

L'e-mail sert à vous informer. Il ne remplace jamais le code de l'application pour vous connecter.

### À retenir

- Au moins **deux administrateurs de plateforme** doivent avoir l'application. Sinon, un téléphone perdu peut bloquer tout le monde.
- Vous ne pouvez pas retirer l'application de votre compte : elle est obligatoire pour votre rôle.
