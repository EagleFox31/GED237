# [Claude] Règle de validation — 4 niveaux de tests — 2026-07-22

> Statut : DONE
> Agent : Claude (Tech Lead / QA)
> Date : 2026-07-22
> Type de tâche : gouvernance (règle agents)

## Ce qui va être fait

Inscrire la règle du PO : un travail n'est validé que par ses **tests unitaires,
tests d'intégration, tests de contrat et tests e2e** (proportionné au risque ;
les 4 obligatoires pour un parcours critique).

## Pourquoi

Relever la barre de « done » : preuve de niveau **Vérifié** exigée, couvrant les
4 niveaux, pas seulement « ça compile ».

## Comment

Édition additive de 3 fichiers de règles, sans réécrire les sections voisines.

## Résultat attendu

Les 4 niveaux de tests sont la référence de validation, cohérente dans AGENTS.md
(canonique + racine) et `REGLES_DE_TRAVAIL.md`.

## Fichiers concernés (VERROU)

- `.agents/AGENTS.md`
- `AGENTS.md` (racine)
- `gestion-projet/REGLES_DE_TRAVAIL.md`
- ce fichier

## Vérifications prévues

- relecture ; cohérence des 4 niveaux nommés dans les 3 fichiers.

---

## RÉSULTAT (DONE)

### Ce qui a été modifié, fichier par fichier

- `gestion-projet/REGLES_DE_TRAVAIL.md` §8 : « les tests ciblés passent » →
  détaillé en 4 niveaux (unitaire / intégration / contrat / e2e) ; paragraphe
  parcours critique → « les 4 niveaux sont requis ».
- `.agents/AGENTS.md` (canonique) : nouvelle section « Validation d'un travail
  (Definition of Done) » nommant les 4 niveaux + renvoi §8.
- `AGENTS.md` (racine) : section « Validation » équivalente (résumé + renvoi §8).

### Résultat observable

La barre de « done » est explicite et homogène : un travail est validé par ses
tests unitaires, d'intégration, de contrat et e2e ; les 4 obligatoires sur un
parcours critique.

### Tests / contrôles exécutés

- `grep` des 4 niveaux dans les 3 fichiers → **présents dans les 3** (✅).
- Édition additive (aucune section voisine réécrite).

### Coordination

- `REGLES_DE_TRAVAIL.md` avait été modifié sur disque par un autre acteur pendant
  la tâche ; re-lecture effectuée, edit appliqué proprement, aucun verrou `EN
  COURS` concurrent au moment de l'écriture.

### Limites

- Règle documentaire ; non versionnée par git (comme le reste de `gestion-projet/`
  et `.agents/`). Application effective = discipline des agents + revue PO.
