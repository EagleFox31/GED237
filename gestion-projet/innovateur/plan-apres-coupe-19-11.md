# Plan d'après-coupe : du 19/11 au soir au 24/11

Une page pour O. État relevé le 19/11 vers 16:35. La coupe se fait à 30,5/32, variante A (note de coupe du 19/11).

## 1. Ordre des fusions de DEC-2026-013

**Avant tout : re-cibler sur `main`.**
- #484 (contraste) et #450 (« Envoyer » visible) ont pour base `feat/v11-a11y-keyboard`, la branche de #441.
- O les re-cible sur `main` **avant** la fusion de #441. Sinon, la suppression de la branche de #441 les laisse sans base.
- #484 reste ensuite un brouillon V1.1 (vague 5). Le PO doit encore valider le badge moutarde.

**Puis une PR à la fois, dans cet ordre :**

| Ordre | PR | Ce qu'elle change | Base | Tête attendue | Dépend de | Spec jetable de Q |
|---|---|---|---|---|---|---|
| 1 | #441 | clavier : cartes, zone de dépôt, fenêtres | `main` | nouvelle tête de F avant 18:00 (aujourd'hui c5528f57) | rien | `q-real-441-keyboard` |
| 2 | #450 | « Annuler » et « Envoyer » toujours visibles dans la fenêtre de dépôt | `main` après re-ciblage | 45668ba6, sauf nouvelle tête | #441 fusionnée | `q-real-450-small-screen` (1366×768 et 1093×614, envoi réel) |
| 3 | #442 | nombre de tâches sur le menu « Tâches & Suivi » | `main` | nouvelle tête de F avant 18:00 (aujourd'hui 472d86a2) | rien | `q-real-442-task-badge` (tâche réelle, pastille relue après visa) |

**Règles pour chaque PR :**
- O note la tête au moment de la preuve. Si F pousse ensuite, la preuve est à refaire.
- Q prouve sur `main` à jour, donc après la fusion précédente, avec son lanceur : `run-real.sh <nom> origin/main <branche> <spec>`.
- O seul sort la PR du brouillon (exception à la règle du 24/11, prévue par DEC-2026-013) et la fusionne.
- Après chaque fusion, O note le nouveau SHA de `main` au relevé de l'UAT. L'écart avec le SHA coupé se limite à ces trois écrans.
- La fiche d'UAT dit déjà quoi faire avec ou sans #450 (« Envoyer » à faire défiler).

## 2. Matin du 20/11

- **08:00** : relever `git rev-parse origin/main` et le noter dans l'en-tête du rapport du run 1 (checklist, ligne 0.5).
- **08:00, `prove_tls` (Q) en premier**, seul sur Docker, avec au moins 5 Go libres (plan du 18/11, confirmé par O le 19/11).
- **Vers 08:10, rejeu `ged-replay` (I)**, seulement après le message « prove_tls fini » de Q :
  - projet `-p ged-replay`, port 18080, sans TLS, fichier de surcharge dans le scratchpad ;
  - à la fin : `down -v` et suppression des images `ged-replay` par leur nom, jamais de `prune`.
- **Ensuite, Q** : la pile et le jeu de démo (lignes 1.0 à 1.2), puis les points critiques **C.22** (circuits de validation) et **C.24** (toutes tailles d'écran), avant tout le reste. Un KO remonte à O dans l'heure, en `REC-nn`.
- **Contre-testeur** : pas de Docker de 08:00 à 11:00. Il fait seulement de la lecture de code et la relecture des fiches.

## 3. Ce qui reste gelé jusqu'au 24/11

- **Les PR V1.1 restent en brouillon.** O seul les en sort, à partir du 24/11. Seules exceptions : #441, #450 et #442.
- **Rien n'est fusionné sur `release/v1.0.0`** tant que le PO n'a pas autorisé la protection de `release/**` et qu'elle n'est pas active (question 2 de la note de coupe).
- **Un correctif de recette** se fait par une PR `fix/rec-nn-*` sur la release, puis il est recopié sur `main` par `cherry-pick -x`.
- **La file V1.1** (`file-v1.1.md`) part le 24/11, par trains (DEC-2026-011). #502 et #484 y gardent leur place.
- **#104** : un seul push, au signal d'O, puis `gh pr ready 104`.
