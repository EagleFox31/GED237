# Leçons sans conflit de fusion : une leçon par fichier

Demande d'O (19/11) : chaque leçon qui entre dans `main` met en conflit `DOCS/engineering/lessons-learned.md`
avec toutes les PR qui ajoutent une leçon (#445, #457 et d'autres pendant la vague V1.1).
Rien ne s'applique avant la coupe.

## Recommandation

**Une leçon par fichier**, à partir de la première leçon créée après la coupe :
`DOCS/engineering/lessons/LESSON-AAAA-NNN.md`, avec le modèle d'entrée actuel.
`lessons-learned.md` reste en place, figé, comme point d'entrée et historique (001 à 074).
**Pas de `merge=union`.**

## Pourquoi pas `merge=union`

| Limite | Preuve |
|---|---|
| GitHub ne l'applique pas pour l'état de fusion d'une PR : la PR reste « en conflit ». | Demande ouverte [community #9288](https://github.com/orgs/community/discussions/9288) ; même manque chez [GitLab](https://gitlab.com/gitlab-org/gitlab-foss/-/issues/17325) et [Bitbucket](https://jira.atlassian.com/browse/BSERV-19161). Aucune doc GitHub ne dit le contraire. |
| La fusion locale réussit sans rien signaler, mais mélange les leçons. | Essai du 19/11 (dépôt jetable) : deux branches ajoutent chacune une leçon finissant par la même ligne `**Prévention** — p`. Résultat : la ligne commune n'apparaît qu'une fois, sous la seconde leçon ; la première perd sa prévention et une ligne vide ; le numéro en double passe sans bruit. |
| L'attribut doit déjà être présent du côté qui reçoit la fusion. | Même essai : attribut ajouté sur une seule branche, la fusion locale reste en conflit. |

## Pourquoi un fichier par leçon

- Deux PR qui ajoutent deux leçons touchent deux chemins différents : **aucun conflit**, sur GitHub comme en local.
- Un numéro pris deux fois donne le même chemin avec deux contenus : GitHub montre un conflit **add/add**.
  La collision devient visible au lieu d'être silencieuse. Le 4e contrôle de `verif-file.sh` la voit avant (à adapter).
- **Ordre lisible** : les numéros sur trois chiffres trient les fichiers dans l'ordre (`ls`, explorateur GitHub).
  Pas d'index tenu à la main : il recréerait le conflit. Pour lister les titres :
  `grep -h '^### LESSON' DOCS/engineering/lessons/*.md`.
- **Réutilisation** : c'est le principe des « fragments » de changelog (towncrier, changesets).
  On adopte le principe, pas l'outil : on n'a pas besoin de compiler les fragments.

## Limites et garde-fous

- **Numéro** : deux PR peuvent encore choisir le même numéro. Le conflit add/add et le 4e contrôle le montrent avant la fusion. Correction : renommer le fichier, 0,1 h-s.
- **Recherche** : chercher dans un dossier au lieu d'un fichier. `lessons-learned.md` le dit en tête.
- **Contrats existants** : 29 documents et `schema_check.py` citent `lessons-learned.md`. Ils restent valides, car rien n'est déplacé.
- **Rétroactif** : les leçons 001 à 074 restent où elles sont. Les PR V1.1 ouvertes qui ajoutent une leçon dans `lessons-learned.md` ne sont pas reprises.
- **Garde-fou** : un contrôle refuse toute nouvelle rubrique `### LESSON` ajoutée à `lessons-learned.md` après la coupe. Sans lui, la règle ne tient pas.

## Après la coupe (1 h-s)

1. En tête de `lessons-learned.md` : la règle et le lien vers `lessons/` ; un `README.md` court dans `lessons/` (I, 0,25 h-s).
2. Faire lire au 4e contrôle de `verif-file.sh` les fichiers ajoutés dans `lessons/` (I, 0,25 h-s).
3. Contrôle pre-commit ou CI contre une nouvelle rubrique dans `lessons-learned.md` (Q, 0,5 h-s).
