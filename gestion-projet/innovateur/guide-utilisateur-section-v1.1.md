# Guide utilisateur : section « Se connecter » pour la V1.1

- **Pour** : l'auteur de la PR du guide qui suit la fusion de #154 et #193 sur `main`. Décision de O du 17/11, option (b).
- **Usage** : ce texte remplace la section « Se connecter » de `DOCS/GUIDE_UTILISATEUR_PAR_PROFIL_GED237.md` (version rc.1, commit 6a48155). Le reste du guide ne change pas.
- **Ne pas fusionner avant** : #154 (code par e-mail, « Renvoyer le code ») **et** #193 (application d'authentification), toutes deux sur `main`. Retirer aussi la phrase sur le cadre « Espace Démo Interactif » si B l'a masqué en production d'ici là.
- **Libellés** : ceux de F (message du 17/11) et de `fiche-admin-verification-application.md`. À recomparer au code de `main` le jour de la PR.

---

## Se connecter

1. Dans « Administration / Organisme », choisissez votre institution.
2. Saisissez votre « Matricule Personnel » et votre « Mot de Passe ».
3. Cliquez sur « Étape Suivante ».
4. Saisissez le code à 6 chiffres, puis cliquez sur « Confirmer l'identité ».
   - **Agent** : le code arrive par e-mail, à l'adresse de votre compte.
   - **Administrateur** : le code s'affiche dans l'application de votre téléphone, sur la ligne « E-Dossier ». Aucun e-mail n'arrive.
5. Première connexion : choisissez votre mot de passe personnel, puis cliquez sur « Mettre à jour ».
   - Dans « Mot de passe temporaire reçu », tapez le mot de passe donné par l'administration.
   - Votre nouveau mot de passe doit avoir 12 caractères minimum, une majuscule, un chiffre et un caractère spécial.

Bon à savoir :

- Le code reçu par e-mail est valable 5 minutes.
- Pas d'e-mail ? Regardez dans les indésirables, puis cliquez sur « Renvoyer le code ». Vous pouvez le demander 3 fois par quart d'heure.
- Après 3 codes faux, le compte est bloqué 15 minutes. L'écran affiche le temps restant.
- « Contactez votre administrateur » : votre compte n'a pas d'adresse e-mail. L'administrateur doit l'ajouter.
- Mot de passe perdu : demandez-en un nouveau à l'administrateur de votre institution.

### Administrateurs : l'application de votre téléphone

Vous êtes Super Admin ou Admin Institution ? Votre compte demande une application de codes sur votre téléphone, par exemple Google Authenticator ou Microsoft Authenticator.

- **Première fois** : après le code reçu par e-mail, l'écran « Protégez votre compte » s'ouvre. Scannez le carré avec l'application (ou « Saisir la clé à la main »), tapez le code dans « Code à 6 chiffres », puis « Valider ».
- **Ensuite** : tapez le code affiché par l'application. « Renvoyer le code » n'apparaît pas pour vous : c'est normal.
- **Code toujours refusé** : réglez l'heure du téléphone sur automatique.
- **Téléphone perdu ou changé** : allez voir en personne un administrateur de niveau supérieur. Il vérifie votre carte professionnelle, puis clique sur « Réinitialiser l'application d'authentification ». Toutes vos sessions sont fermées.

Pas à pas complet : `gestion-projet/innovateur/fiche-admin-verification-application.md`.

---

## Contrôle avant la PR

- [ ] #154 et #193 fusionnées sur `main`.
- [ ] Le code n'est plus prérempli sur une installation en production (travail de B après le tag).
- [ ] Libellés recomparés au code de `main` : « Renvoyer le code », « Protégez votre compte », « Saisir la clé à la main », « Code à 6 chiffres », « Valider », « Réinitialiser l'application d'authentification », message « contactez votre administrateur ».
- [ ] Limite d'envoi confirmée : 3 par quart d'heure.
- [ ] Cadre « Espace Démo Interactif » : phrase gardée ou retirée selon l'écran.
