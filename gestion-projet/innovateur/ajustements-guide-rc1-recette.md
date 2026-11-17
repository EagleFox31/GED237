# Guide rc.1 : ajustements si la recette fait corriger E23, E24 ou E25

- **Pour** : I, qui modifie le guide. Demande de O, 17/11 : si le PO fait corriger l'un de ces écarts sur `release/v1.0.0`, le guide est ajusté dans la même fenêtre, **avant #121**.
- **Fichier** : `DOCS/GUIDE_UTILISATEUR_PAR_PROFIL_GED237.md`, branche `docs/guide-utilisateur-rc1`, commit fd5f2b9 (6a48155 + alignement sur b701314, 17/11). Les numéros de ligne renvoient à fd5f2b9.
- **Méthode** : après la fusion du correctif, relire le libellé dans le code de `release/v1.0.0`, appliquer la ligne ci-dessous, puis ajouter un commit sur la même branche. Coût : ≈ 0,1 h-s par écart.

| Écart | Correctif attendu | Ligne(s) du guide | Nouveau texte |
|---|---|---|---|
| E23 | « Gérer les Permissions » ouvre une page, ou le bouton disparaît | 146 (Admin Service, « Bon à savoir ») | Bouton retiré : supprimer la puce. Bouton actif : « « Gérer les Permissions » : <ce que fait la page, d'après le code> ». |
| E24 | Accents : « À vérifier » (Explorateur) | 109 | « Un document marqué « À vérifier » se corrige dans « Ma bannette ». » |
| E24 | Accents : « Paramètres » (menu du super admin) | 70 | Remplacer « Parametres » par « Paramètres ». |
| E25 | Entrée « Audit » ajoutée au menu de l'auditeur (libellé à relever) | 232 et 242 | l. 232 : « À la connexion, vous arrivez sur « <libellé> », dont la page s'appelle « Registre Des Actions ». » ; l. 242 : ajouter « <libellé> » à la liste du menu. |

Contrôle après ajustement :

```bash
grep -n "A verifier\|Parametres" DOCS/GUIDE_UTILISATEUR_PAR_PROFIL_GED237.md   # vide si E24 corrigé
```

Plus le contrôle habituel des mentions interdites sur le diff, hooks de pré-commit, puis message à O et à Q (relecture contre la rc).
