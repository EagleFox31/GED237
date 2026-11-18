# DEC-2026-008 — Fenêtre de fusion V1.1 jusqu’au samedi 05/12 à 18:00, gel le 06/12, tag le 07/12

- **Statut** : ACCEPTÉE (O, 18/11, nuit), dans le cadre fixé par le PO : tag le 07/12, périmètre intact.
- **Décideur** : O, sur la consigne du PO « on ne retire rien, on ne change pas la date du tag ».
- **Sources** : `plan-v1.1.md`, § « Écart à zéro sans rien retirer ni changer de date » ; `file-v1.1.md` ; `plan-fusion-v1.1.md`.

## 1. Contexte

- Avec la fin des fusions fixée au vendredi 04/12, le plan V1.1 dépassait de 17 à 19 h-s, même après la reprise de deux lignes par B et la contre-vérification dans le navigateur confiée à l’outil d’audit UX (G).
- Le week-end des 05-06/12 ne pouvait pas compter tant que la dernière fusion restait au 04/12 : un travail fait après ne pouvait pas entrer dans le tag.
- Une fusion le dimanche 06/12 au soir ne laissait aucune marge avant le tag du lundi.

## 2. Décision

1. **La dernière fusion V1.1 a lieu au plus tard le samedi 05/12 à 18:00.**
2. **Le dimanche 06/12 est un gel**, sans aucune fusion. Ce jour sert à trois choses :
   - CI complète sur `main` ;
   - rejeu de l’UAT ;
   - notes de version.
3. **Le tag V1.1 reste le lundi 07/12.**
4. **Capacité comptée** :
   - le week-end des 28-29/11 pour B et F, **après** la répétition et les correctifs de la démo du 30/11, qui passent en premier ;
   - le samedi 05/12 pour B, F et Q.

## 3. Pourquoi

- La date du tag et le périmètre ne bougent pas, comme le demande le PO.
- Le gel du dimanche garde une journée entière de vérification avant le tag.
- Un jour de fusion de plus suffit à ramener l’écart de chaque membre de l’équipe à zéro ou en dessous (`plan-v1.1.md`).

## 4. Conséquences

| Qui | Ce qui change |
|---|---|
| File de fusion | La vague 6 va du 03 au 05/12, avec une dernière fusion le 05/12 à 18:00. Les PR V1.2 restent ouvertes jusqu’à la fin de cette fenêtre. |
| B et F | Leur travail V1.1 du week-end des 28-29/11 passe après la démo. |
| Q | Q travaille le samedi 05/12 : derniers OK de relecture et dernière file. Le dimanche 06/12, Q lance la CI complète et le rejeu de l’UAT. |
| Innovateur | Les notes de version V1.1 sont finalisées le 06/12, sur le `main` gelé. |

## 5. Retour arrière

Si la file est vide avant le 05/12, le gel peut commencer plus tôt : cela ne change pas le tag. Toute fusion après le 05/12 à 18:00 exige l’accord d’O et un nouveau rejeu de l’UAT.
