# Leçons — un fichier par leçon

Depuis la coupe V1.0 ([DEC-2026-009](../../../gestion-projet/decisions/DEC-2026-009%20-%20Une%20lecon%20par%20fichier.md)),
chaque nouvelle leçon a son propre fichier ici. Deux PR qui ajoutent chacune une leçon
ne se mettent plus en conflit.

Les leçons 001 à 074 (et 083) restent dans [`../lessons-learned.md`](../lessons-learned.md),
qui est figé. Classification, modèle d'entrée et règles : voir ce fichier.

## Ajouter une leçon

1. Prendre le **plus petit numéro libre** sur `main` **et** dans les PR ouvertes :
   ```bash
   git fetch origin
   { echo main; gh pr list --state open --limit 300 --json headRefName -q '.[].headRefName'; } |
     xargs -I{} git ls-tree --name-only origin/{} DOCS/engineering/lessons/ 2>/dev/null |
     grep -o 'LESSON-[0-9]*-[0-9]*' | sort -u
   ```
2. Créer `LESSON-AAAA-NNN.md`. Première ligne : `# LESSON-AAAA-NNN — Titre court`,
   puis le modèle d'entrée de `lessons-learned.md` (Date, Catégorie, Statut, Liens, puis
   Contexte → Évolution de standard).
3. Un numéro est réservé par le fichier lui-même. Si deux PR prennent le même, celle qui
   fusionne en second renomme le sien. `gestion-projet/innovateur/verif-file.sh` le signale
   avant fusion.

## Contrôles

- CI Gate, job « Lessons register frozen » (`scripts/check-lessons-frozen.sh`) : refuse
  toute nouvelle rubrique `### LESSON` dans `lessons-learned.md` au-delà de 074 ou en double.
- `verif-file.sh`, 4e contrôle : un même numéro ne doit pas désigner deux leçons
  différentes entre `main` et les PR ouvertes.
