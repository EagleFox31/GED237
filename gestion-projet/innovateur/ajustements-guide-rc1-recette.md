# Guide rc.1 : ajustements si la recette fait corriger E23, E24 ou E25

- **Pour** : I, qui modifie le guide. Demande de O, 17/11 : si le PO fait corriger l'un de ces écarts sur `release/v1.0.0`, le guide est ajusté dans la même fenêtre, **avant #121**.
- **Correctif** : PR #233 de F, en brouillon, commit c37353e. Elle part de `main`, donc de la V1.1, et sert de ticket #229. Elle ne touche la rc.1 que si le PO choisit A à la question 7 de `fiche-decisions-po-19-11.md` et qu'elle est recopiée sur `release/v1.0.0`. Sinon, le guide reste tel quel en rc.1, et ces lignes servent pour le guide V1.1.
- **Fichier** : `DOCS/GUIDE_UTILISATEUR_PAR_PROFIL_GED237.md`, branche `docs/guide-utilisateur-rc1`, commit 50215de. Les numéros de ligne renvoient à 50215de.
- **Méthode** : après la fusion du correctif, relire le libellé dans le code de la branche visée, appliquer la ligne ci-dessous, puis ajouter un commit sur la même branche. Coût : ≈ 0,1 h-s par écart.

Libellés donnés par F le 17/11, d'après #233 :

| Écart | Ce que fait #233 | Ligne(s) du guide | Nouveau texte |
|---|---|---|---|
| E23 | La carte « Planification de Service » et son bouton « Gérer les Permissions » sont retirés. | 148 (Admin Service, « Bon à savoir ») | Supprimer la puce. |
| E24 | « À vérifier » (Explorateur) | 109 | « Un document marqué « À vérifier » se corrige dans « Ma bannette ». » |
| E24 | « Paramètres » (menu du super admin) | 70 | Remplacer « Parametres » par « Paramètres ». |
| E25 | Entrée « Audit » dans le menu de l'auditeur : dans la barre latérale, et aussi dans la barre du haut en mode « barre du haut ». Elle ouvre `/audit`, la même page que son tableau de bord. | 234 et 244 | l. 234 : « À la connexion, vous arrivez sur la page « Registre Des Actions ». Pour y revenir, cliquez sur « Tableau de Bord » ou sur « Audit ». » ; l. 244 : ajouter « Audit » à la liste du menu. Relever la place exacte de l'entrée dans le menu au moment de l'ajustement. |

Contrôle après ajustement :

```bash
grep -n "A verifier\|Parametres\|Gérer les Permissions" DOCS/GUIDE_UTILISATEUR_PAR_PROFIL_GED237.md   # vide si les trois écarts sont corrigés
```

Plus le contrôle habituel des mentions interdites sur le diff, hooks de pré-commit, puis message à O et à Q (relecture contre la rc).
