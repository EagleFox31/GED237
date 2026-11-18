# Outils de pilotage

Scripts en lecture seule pour le plan, la démo et les passations. Ils se lancent depuis n'importe quel worktree du dépôt.

| Besoin | Commande | Remplace |
|---|---|---|
| Tableau charge, capacité et écart | `gestion-projet/outils/charges.sh gestion-projet/innovateur/charges-v1.1.csv` | le recalcul à la main après chaque changement |
| Chemins cités dans un plan | `gestion-projet/outils/verif-chemins.sh gestion-projet/innovateur/plan-fusion-v1.1.md` | la relecture par les pairs (LESSON-2026-067) |
| Libellés cités dans un script de démo | `gestion-projet/outils/verif-libelles.sh "Tableau de Bord"` ; pour un menu : `--dans frontend/components/Sidebar.tsx "Menu > Sous-menu"` | la consigne « cliquer sur X » quand X n'existe pas |
| Mots interdits avant un commit | `scripts/check-forbidden-words.sh` (sans argument : tous les fichiers indexés) | le grep à la main sur `git diff --cached` |
| Entrée de passation | `scripts/passation-add.sh PASSATION-<rôle>.md "Sujet" <<'EOF'` … `EOF` | le titre provisoire puis le `sed` de la date |
| Tri d'un audit UX | `gestion-projet/modeles/triage-audit-ux.md` | — |

## Règles

- **Passation** : chaque session lance le script sur **son propre** fichier. Le script ajoute à la fin et ne réécrit jamais rien. Relancé avec la même entrée, il ne la double pas.
- **Charges** : le fichier CSV est la source, et le tableau publié dans `plan-v1.1.md` en est la copie. Pour chaque ligne chiffrée ajoutée au plan, on ajoute une ligne `ch;` au CSV, puis on colle la sortie du script.
- **Chemins** : un fichier qu'une PR ouverte va créer apparaît comme introuvable, et c'est normal. Il faut le vérifier dans la PR.
- **Mots interdits** : étape **manuelle** avant chaque commit, dans toutes les sessions (`EQUIPE_AGENTS.md` § 4). Code 1 : une ligne ajoutée est interdite. Code 2 : pas de liste, donc rien n’a été vérifié. Le script et le hook pre-commit `forbidden-words` (pas fiable sur ce poste avant sa réparation en V1.1) lisent une liste gardée **hors du dépôt**, dans `~/.config/forbidden-words` ou dans `$FORBIDDEN_WORDS_FILE`. Sans liste, il ne fait rien. Le format est décrit en tête de `scripts/check-forbidden-words.sh`.
