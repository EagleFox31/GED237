# Brouillon : ligne « réflexes Windows » pour les notes rc.1 et le CHANGELOG (à ne pas publier avant le 19 à 12:00)

- **Pour** : B (intègre dans les notes et le CHANGELOG), O (choisit la variante). Innovateur, 2026-11-17. Ce fichier n'est pas une note de version : B copie la variante retenue ; les fichiers de B ne sont pas touchés ici.
- **Choix de la variante** : selon le relevé du 19 à 12:00 (spec `spec-reflexes-windows-explorateur.md`, statut O du 17/11). Variante A si L1 et L2 sont fusionnées ; B si une seule ; C si aucune. L3 et L4 sont en V1.1 dans tous les cas.

## Notes de version (limites connues / améliorations)

| Variante | Texte |
|---|---|
| **A** — L1 et L2 fusionnées | Explorateur documentaire : navigation au clavier (flèches, Entrée, Retour arrière, Ctrl+F, Échap) et menu clic droit sur les documents, les dossiers et le fond de la liste (touche Menu et Maj+F10 inclus). Limite connue : la sélection multiple, la touche Suppr, F2 et le glisser-déposer ne sont pas disponibles ; ils sont prévus en V1.1. |
| **B** — L1 seule | Explorateur documentaire : navigation au clavier (flèches, Entrée, Retour arrière, Ctrl+F, Échap). Limite connue : le menu clic droit existe sur les documents seulement ; la sélection multiple, Suppr, F2 et le glisser-déposer sont prévus en V1.1. |
| **B'** — L2 seule | Explorateur documentaire : menu clic droit sur les documents, les dossiers et le fond de la liste. Limite connue : pas de navigation complète au clavier, ni de sélection multiple, Suppr, F2, glisser-déposer ; prévus en V1.1. |
| **C** — aucune | Limite connue : l'Explorateur documentaire se pilote à la souris (clic, double-clic, clic droit sur un document). Les réflexes Windows (clavier, clic droit étendu, sélection multiple, Suppr, F2, glisser-déposer) sont prévus en V1.1. |

## CHANGELOG (une ligne, forme « Conventional Commits »)

- A : `feat(explorateur): navigation au clavier et menu clic droit étendu`
- B : `feat(explorateur): navigation au clavier`
- B' : `feat(explorateur): menu clic droit sur dossiers et fond de liste`
- C : aucune ligne (rien de livré).

Ne rien écrire sur L3 et L4 dans le CHANGELOG. Aucune formulation ne promet une date de livraison V1.1.
