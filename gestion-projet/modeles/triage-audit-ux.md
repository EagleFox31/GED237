# Modèle : trier un lot d'audit UX

Ce modèle sert à placer chaque constat d'un lot d'audit UX au bon endroit, en une seule passe. Compter 15 minutes par lot.

## 1. Classer chaque constat

| Verdict de l'audit | Où il va | Porteur |
|---|---|---|
| **Bloquant démo** | `risques-demo-30-11.md` (nouvelle ligne : constat, repli) **et** `checklist-demo.md` § A (un item par porteur) | celui qui possède l'écran ou les données |
| **V1.1** | `plan-fusion-v1.1.md` (une ligne `57 L<lot>-<n>` après la dernière du même type) **et** `plan-v1.1.md` (chiffrage) | celui qui a le plus de marge (voir § 3) ; affichage seul → Q possible |
| **Contournable au script** | `deroule-demo.md` (une phrase dans l'étape) **et** `checklist-demo.md` § A (item « Animateur ») | animateur ; contre-test par l'audit |
| **Levé / conforme** | risque existant : « Contre-test du JJ/MM : levé (#PR) » | — |

En cas de doute entre V1.1 et contournable au script, O tranche. On note alors « à trancher par O » dans le risque.

## 2. Vérifier avant d'écrire

- [ ] Chaque libellé d'écran cité existe : `gestion-projet/outils/verif-libelles.sh "Libellé"`. Pour un menu, ajouter `--dans` avec le fichier du menu.
- [ ] Chaque fichier cité existe : `gestion-projet/outils/verif-chemins.sh <document modifié>`.
- [ ] Le composant cité est bien celui qui affiche la zone : `git grep -n "<texte de la zone>" origin/main -- frontend/`. Le nom d'un fichier ne prouve pas ce qu'il affiche.

## 3. Recalculer la charge

- [ ] Ajouter une ligne `ch;57 L<lot>-<n>;<porteur>;<h-s>` à `charges-v1.1.csv`.
- [ ] Lancer `gestion-projet/outils/charges.sh gestion-projet/innovateur/charges-v1.1.csv`, puis coller le tableau dans `plan-v1.1.md`.
- [ ] Si un porteur dépasse sa capacité (le script l'affiche), proposer un transfert à O avant d'envoyer quoi que ce soit.

## 4. Prévenir

| Destinataire | Contenu |
|---|---|
| O | bloquants ajoutés, risques levés, points à trancher, lignes V1.1 avec le nouveau tableau |
| Chaque porteur | sa ligne (fichier, zone, h-s, dépendance, relecteur) et son nouvel écart |

Ensuite : un commit, puis `scripts/passation-add.sh` sur sa propre passation.
