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

## 2. Soirée et nuit du 19/11 (avancées du 20 au matin, O, 16:40)

Les sessions ne dorment pas : tout ce qui était prévu le 20 se joue ce soir. Ordre détaillé ligne par ligne : checklist de recette, § ☾. Les heures sont indicatives ; chaque étape part sur le message de fin de la précédente.

- **18:00** : gel des fusions jusqu'à la décision de coupe. Lecture C6 par Q, sans Docker. O note `git rev-parse origin/main` (ligne 0.5).
- **18:00 à 18:45** : pas de Docker (compactage).
- **Vers 18:45, `prove_tls` (Q) en premier**, seul sur Docker, avec au moins 5 Go libres. Il se termine par le message « prove_tls fini ».
- **Vers 19:15, rejeu `ged-replay` (I)** sur le SHA de la coupe, seulement après ce message :
  - projet `-p ged-replay`, port 18080, sans TLS, fichier de surcharge dans le scratchpad ;
  - à la fin : `down -v` et suppression des images `ged-replay` par leur nom, jamais de `prune`.
- **Vers 19:15, en même temps (créneau de Q)** : preuves et fusions de #441, #450 et #442, dans l'ordre du § 1.
- **Vers 21:00, Q** :
  - d'abord la pile et le jeu de démo sur `main` à jour (lignes 1.0 à 1.2) ;
  - puis **C.22** et **C.24** ;
  - puis le reste des § 1 et 2 de la checklist, enchaîné dans la nuit.
  - F et B font leurs parcours à la main sur la pile de Q, après les compteurs (2.6).
- **Toute la nuit** : un KO part tout de suite à O, en `REC-nn`.
- **Docker** : un créneau par session. Sous 2 Go libres, aucune charge ne démarre et chacune se met en pause.
- **Contre-testeur** : lecture du code et des fiches. Docker seulement sur un créneau donné par O.
- **20/11, 08:00** : on rejoue seulement ce qui a échoué. Les § 3 et § 4 de la checklist gardent leurs dates.

## 3. Ce qui reste gelé jusqu'au 24/11

- **Aucune fusion de 18:00 jusqu'à la décision de coupe.** Ensuite, seules #441, #450 et #442 entrent dans `main`.
- **Les PR V1.1 restent en brouillon** (règle du PO). O seul les en sort, à partir du 24/11. Seules exceptions : #441, #450 et #442.
- **Rien n'est fusionné sur `release/v1.0.0`** tant que le PO n'a pas autorisé la protection de `release/**` et qu'elle n'est pas active (question 2 de la note de coupe).
- **Un correctif de recette** se fait par une PR `fix/rec-nn-*` sur la release, puis il est recopié sur `main` par `cherry-pick -x`.
- **La file V1.1** (`file-v1.1.md`) part le 24/11, par trains (DEC-2026-011 ; liste dans `trains-v1.1-24-11-05-12.md`). #502 et #484 y gardent leur place.
- **#104** : un seul push, au signal d'O, puis `gh pr ready 104`.
