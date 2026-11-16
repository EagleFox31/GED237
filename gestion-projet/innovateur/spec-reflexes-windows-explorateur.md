# Spec — réflexes Windows dans l'Explorateur documentaire

- **Pour** : F (réalisation), O (mise en file et fenêtre : avant le 30/11 ou V1.1), PO (demandeur). Innovateur, 2026-11-17.
- **Demande du PO (17/11)** : l'application devait permettre de garder les réflexes de Windows (raccourcis, clic droit). Élément à réaliser.
- **Statut** : à réaliser, non planifié. La fenêtre de livraison n'est pas décidée.

## 1. État constaté (lecture du code, `main`, application non lancée)

| Réflexe | État | Preuve |
|---|---|---|
| Clic droit sur un document (Ouvrir, Classer, Copier le chemin) | présent | `frontend/profiles/tenant-admin/pages/SpacesPage.tsx:782,844,963` |
| Double-clic : ouvrir un dossier, aperçu d'un document | présent | `SpacesPage.tsx:703,843` |
| Échap ferme le menu | présent | `SpacesPage.tsx:352` |
| Raccourcis clavier (Ctrl+A, Ctrl+F, Entrée, Suppr, F2, flèches) | absent | aucune occurrence de `ctrlKey` ni de gestion de touches dans `frontend/` hors dialogues |
| Sélection multiple (Ctrl+clic, Maj+clic) | absent | idem |
| Clic droit sur un dossier, sur le fond, dans les autres tableaux | absent | `onContextMenu` seulement sur les documents |
| Glisser-déposer dans l'explorateur | absent | aucun `onDrop` dans `SpacesPage.tsx` |

## 2. À réaliser, par lot (ordre de valeur)

| Lot | Contenu | Critère d'acceptation |
|---|---|---|
| L1 — Clavier | flèches pour déplacer le focus, Entrée = ouvrir, Retour arrière = dossier parent, Ctrl+F = champ de recherche, Échap = fermer menu et aperçu | les 5 touches agissent sans souris, focus visible ; aucun raccourci ne se déclenche dans un champ de saisie |
| L2 — Clic droit étendu | menu sur un dossier (Ouvrir, Copier le chemin) et sur le fond (Actualiser, Coller le chemin n'est pas requis) ; touche Menu et Maj+F10 ouvrent le même menu | même menu au clavier et à la souris ; le menu du navigateur reste disponible hors de l'explorateur |
| L3 — Sélection multiple | Ctrl+clic, Maj+clic, Ctrl+A ; actions de groupe limitées à celles que l'API offre déjà | compteur « n sélectionnés » ; une action de groupe traite tous les éléments ou explique lesquels ont échoué |
| L4 — Suppr, F2, glisser-déposer | seulement si l'action existe côté API (suppression, renommage, déplacement) et respecte les droits et la piste d'audit | **à vérifier avant chiffrage** : je n'ai pas contrôlé l'existence de ces actions côté backend |

## 3. Contraintes

- **Gel des dépendances jusqu'au 30/11** (`plans/note-gel-dependances-rc1.md`) : pas de nouvelle bibliothèque de raccourcis ou de glisser-déposer avant la démo ; L1 à L3 se font avec les gestionnaires natifs de React.
- Accessibilité : les raccourcis ne doivent pas masquer ceux du navigateur ni du lecteur d'écran (Ctrl+F n'est repris que lorsque le focus est dans l'explorateur).
- Aide : une entrée « Raccourcis » dans l'icône d'aide de la carte, pas de bandeau (règle « densité et aide » des règles du projet).
- Tests : un scénario e2e par lot (clavier seul pour L1 et L2).

## 4. Chiffrage (heures de session, à confirmer par F)

L1 ≈ 2 h · L2 ≈ 1 h · L3 ≈ 3 h · L4 non chiffré (dépend de l'API). L1 et L2 tiennent avant la coupure du 19 seulement si F n'a plus #99 et #100 en cours ; sinon V1.1, avec une ligne dans les limites connues des notes rc.1.
