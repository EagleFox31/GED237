# Réserve parallèle par session (consigne du PO, 19/11)

Consigne du PO : « travaillons plus vite ». Aucune session ne doit attendre sans rien faire. Pendant qu'un test, une passe Docker ou une relecture tourne, elle prend la tâche suivante de sa réserve. Dès qu'une session est surchargée ou libre, I rééquilibre, avec O en copie.

## Règles

1. Tout test, toute passe Docker et toute CI de plus de 2 minutes se lance en arrière-plan. On prend aussitôt une tâche de réserve.
2. Une tâche de réserve touche **d'autres fichiers** que la tâche en cours. Elle se fait **sans créneau Docker** quand le créneau de la session est pris. Créneaux décidés par le PO depuis le 19/11 au matin : F 1, B 1, aide-api 1, Q 1.
3. Une session sans tâche écrit tout de suite à I : « libre ». I lui envoie la suivante, avec O en copie. Il la choisit dans cette réserve, dans `plan-fusion-v1.1.md` ou dans `charges-v1.1.csv`.
4. On n'attend pas un retour (validation de Q, signal d'O, contrat d'un pair) : on passe à la réserve, et on revient à la tâche quand le retour arrive.
5. Push : toujours vers une destination explicite (`git push origin "$b:$b"` ou `HEAD:refs/heads/X`).
   - Le dépôt est réglé avec `push.default = nothing`, qui refuse les push nus.
   - Ce réglage fait suite à deux incidents du 19/11 (LESSON-2026-075, #467).
6. I met cette page à jour à chaque changement de charge, et au plus tard au point de 16:30.

## Réserve au 19/11, 10:00

Cette mise à jour remplace celle de 09:00, conservée dans l'historique git. La priorité est **la coupe à 95 %** (DEC-2026-010). Sont donc prioritaires les preuves des items 19, 28, 29 et 31, puis l'item 8 en réserve.

| Session | En cours | Réserve, dans l'ordre | Docker ? |
|---|---|---|---|
| **Q** | Lab hors ligne (item 28) et correctif de `images_import.sh` (overlay2), en PR | 1. Relecture sécurité de #471 et #474, pendant les passes du lab. 2. Après la fusion du correctif : rejeu du manuel jusqu'à `/health`, qui prouve aussi l'item 31. 3. Relevé C6 à 18:00 (item 29). 4. Rejeu de #453 quand F l'a corrigée. | 1 : non ; 2 et 4 : oui |
| **B** | #171 : code validé par Q sur efda93ef | 1. **PR de classement à l'import** en V1.0 : classement sur le nom, l'extension et la catégorie, pour les DOCX, XLSX, TXT et CSV, environ 1,5 h-s. Branche depuis `main`, après #171 et la route de #445. 2. #197 : rattachement à `60e40a686375` dès que #457 est fusionnée. | 1 : tests unitaires seulement |
| **F** | PR de purge pour le super-administrateur (choix de l'institution sur la page corbeille) | 1. **#453** : liste des agents vide pour le chef de service. La route « agents de mon service » existe maintenant dans #445 (26cd5223). 2. Corps de PR et commits locaux de #181, prêts pour le passage de la paire. | 1 : oui, pour le rejeu |
| **aide-api** | #473 (item 8) : générateur écrit, étalonnage sur 2 000 fichiers | 1. Suite sécurité : identifiant de session commun aux deux jetons, sans changement d'écran. 2. #471 et #474 : correctifs après la relecture de Q. 3. Essai complet de l'item 8, **après le démontage du lab de Q**. Il se lance en arrière-plan, avec un plafond de 2 h 30. | 3 : oui, créneau seul |
| **I** | Tri de l'audit « Quotidien fonctionnaire », à livrer à O avant midi | 1. Inscrire dans la file, dès qu'elles ont un numéro, les PR images_import (Q), classement à l'import (B) et purge (F). 2. Préparer le point de 16:30. 3. Après 18:00, recompter le score dans `couverture-95-19-11.md`. 4. À la coupe : #104, DEC-2026-004, DEC-2026-009. | non |

### Plages à protéger

- **Lab de Q (item 28)** : environ 7 Go de mémoire et 6 Go de disque. Pendant cette plage, l'essai complet de l'item 8 ne démarre pas.
- **Lab à plusieurs postes** (décision du PO à 10:10 : « oui, après les preuves »). Il se lance après les items 28, 29, 31 et 8.
  - Phase 1 : postes Playwright sur un réseau interne. Porteur : Q.
  - Phase 2 : un seul vrai Windows (W2). Porteur : ged237-6a.
  - Conditions de la phase 2 :
    - ménage Docker fait, avec 17 Go libres dans le disque Docker ;
    - une plage d'environ 1 h pendant laquelle les autres sessions arrêtent Docker ;
    - aucun réglage machine modifié (ni `.wslconfig` ni autre).
