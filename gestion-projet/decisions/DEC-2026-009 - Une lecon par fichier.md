# DEC-2026-009 — Une leçon par fichier : fin des conflits sur `lessons-learned.md`

- **Statut** : ACCEPTÉ par O le 2026-11-19, sur la note `gestion-projet/innovateur/note-lecons-sans-conflit.md` (apportée par #452). Application après la coupe, dans des PR V1.1 en brouillon.
- **Instruction** : innovateur, 2026-11-19. Niveau : `Vérifié` (essai local de `merge=union`, simulation `git merge-tree`) et `Documenté` (comportement de GitHub : demande ouverte, sans doc officielle contraire).

## Contexte

Chaque leçon qui entre dans `main` met en conflit `DOCS/engineering/lessons-learned.md` avec toutes les PR ouvertes qui ajoutent une leçon (#445, #457 et d'autres pendant la vague V1.1). Le même jour, six numéros ont été pris par deux leçons différentes (LESSON-2026-072).

## Décision

1. Toute leçon créée après la coupe va dans son propre fichier, `DOCS/engineering/lessons/LESSON-AAAA-NNN.md`, avec le modèle d'entrée actuel.
2. `lessons-learned.md` est figé de 001 à 074. Il reste le point d'entrée et l'historique ; son en-tête renvoie vers `lessons/`. Aucune leçon existante n'est déplacée.
3. **Numérotation** : on réserve un numéro en créant le fichier, avec le plus petit numéro libre sur `main` et dans les PR ouvertes. Le 4e contrôle de `verif-file.sh` arbitre ; en cas de doublon, la PR qui fusionne en second renomme son fichier.
4. Pas de `merge=union` dans `.gitattributes`.
5. Les PR V1.1 déjà ouvertes qui ajoutent une leçon dans `lessons-learned.md` (069 à 074) ne sont pas reprises.

## État au 20/11

- `LESSON-2026-083` est entrée dans `lessons-learned.md` par #517, avant la mise en place du contrôle LEC-3. Elle reste où elle est : on ne déplace rien. Le contrôle ne juge que les rubriques ajoutées par une PR.
- #467 (Q, brouillon) porte LEC-3 (`scripts/check-lessons-frozen.sh`, job « Lessons register frozen » de CI Gate) et crée les premiers fichiers `lessons/LESSON-2026-075` à `079`.
- Le plus petit numéro libre est donc 080 tant que #467 est ouverte ; 083 est pris.
- `verif-file.sh` vit dans `gestion-projet/innovateur/`, apporté par #452 : LEC-2 est un commit de cette PR.

## Option écartée : `merge=union`

- GitHub ne l'applique pas pour l'état de fusion : la PR reste « en conflit » ([community #9288](https://github.com/orgs/community/discussions/9288)).
- En local, la fusion réussit sans rien signaler mais mélange les leçons : une ligne commune n'est gardée qu'une fois, et un numéro en double passe sans bruit (essai du 19/11).

## Lots

| Lot | Contenu | Porteur | Effort | Preuve attendue |
|---|---|---|---|---|
| LEC-1 | En-tête de `lessons-learned.md`, `DOCS/engineering/lessons/README.md`, cette DEC | I | 0,25 h-s | PR en brouillon ; liens vérifiés |
| LEC-2 | 4e contrôle de `verif-file.sh` étendu aux fichiers `lessons/LESSON-*.md` (commit sur #452) | I | 0,25 h-s | essai avec deux PR fictives au même numéro → erreur |
| LEC-3 | Contrôle CI : refuse dans `lessons-learned.md` toute rubrique `### LESSON` au-delà de 074 ou en double ; le message renvoie vers `lessons/` | Q | 0,5 h-s | #467 : test rouge puis vert ; seuil figé à 074 |

## Risques et réversibilité

- La recherche se fait dans un dossier au lieu d'un fichier : l'en-tête de `lessons-learned.md` et le README le disent.
- Les 33 documents Markdown et `schema_check.py` qui citent `lessons-learned.md` restent valides.
- Réversible : on peut concaténer les fichiers dans `lessons-learned.md` et retirer le contrôle LEC-3.
