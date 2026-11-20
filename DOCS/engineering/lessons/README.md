# Leçons — un fichier par leçon

Depuis la coupe V1.0 ([DEC-2026-009](../../../gestion-projet/decisions/DEC-2026-009%20-%20Une%20lecon%20par%20fichier.md)),
chaque nouvelle leçon a son propre fichier ici. Deux PR qui ajoutent chacune une leçon
ne se mettent plus en conflit.

[`../lessons-learned.md`](../lessons-learned.md) est figé : il garde 001 à 068 et 083, déjà sur
`main`. Les numéros 069 à 074 n'y entrent que par les PR déjà ouvertes avant le gel
(point 5 de DEC-2026-009). Classification, modèle d'entrée et règles : voir ce fichier.

## Ajouter une leçon

1. Prendre le **plus grand numéro déjà pris, plus un**, en comptant le registre et `lessons/`,
   sur `main` **et** dans les PR ouvertes. La commande affiche ce plus grand numéro :
   ```bash
   git fetch origin
   { echo main; gh pr list --state open --limit 300 --json headRefName -q '.[].headRefName'; } |
     while read -r b; do
       git show "origin/$b:DOCS/engineering/lessons-learned.md" 2>/dev/null | grep -o '^### LESSON-[0-9]*-[0-9]*'
       git ls-tree --name-only "origin/$b" DOCS/engineering/lessons/ 2>/dev/null
     done | grep -o 'LESSON-[0-9]*-[0-9]*' | sort -u | tail -1
   ```
2. Créer `LESSON-AAAA-NNN.md`. Première ligne : `# LESSON-AAAA-NNN — Titre court`,
   puis le modèle d'entrée de `lessons-learned.md` (Date, Catégorie, Statut, Liens, puis
   Contexte → Évolution de standard).
3. Un numéro est réservé par le fichier lui-même. Si deux PR prennent le même, celle qui
   fusionne en second renomme le sien.

## Contrôles (apportés par d'autres PR)

- #467 : job « Lessons register frozen » de CI Gate. Il refuse toute nouvelle rubrique
  `### LESSON` dans `lessons-learned.md` au-delà de 074 ou en double.
- #452 : 4e contrôle de `gestion-projet/innovateur/verif-file.sh`. Un même numéro ne doit pas
  désigner deux leçons différentes entre `main` et les PR ouvertes.

Cette PR fusionne après #467 et #452.
