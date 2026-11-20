# Dix capacités « futur / partiel » : classement valeur et risque

- **Pour** : O, B (prépare base, backend, API), PO. Innovateur, 2026-11-17, sur `main` 371c0a0. Source unique des statuts : `gestion-projet/MATRICE_TRACABILITE_PRODUIT.md` (dernière modification du fichier le 2026-10-28 ; l'en-tête interne porte la date du 22/07). Aucune mesure inventée : la valeur vient de la colonne « Prochaine action » de la matrice et des parcours de la démo ; le risque vient de ce qui est lu dans le code. `Vérifié` = lu dans le dépôt ; `Déduit` = raisonnement de l'innovateur.
- **Règle de O** : rien ne fusionne avant le tag du 24/11 ; travail en PR brouillon seulement. Le gel des dépendances court jusqu'au 30/11 : toute capacité qui exige une nouvelle bibliothèque attend.

## 1. Classement

Valeur : **H** (la matrice ou un parcours de démo en dépend), **M**, **B** (la matrice dit « valider le besoin » ou « ne pas promettre »). Risque : **H** (supprime ou modifie des données, ou touche la connexion), **M**, **B**.

| Rang | Capacité (ligne de la matrice) | État matrice | Valeur CDC / démo | Risque | Pourquoi, en une phrase |
|---|---|---|---|---|---|
| 1 | **Sondes de santé** (l.58) | Partiel | H | B | `/health` ne renvoie que l'état « healthy » et la version, sans tester la base, Redis ni Celery (`Vérifié`, `backend/app/main.py:88`) ; la matrice dit « probes DB/Redis/Celery d'abord ». Se rattache à l'item 29 (stabilité). |
| 2 | **Corbeille** (l.55) | Aspirationnel | H | B à M | Suppression logique et liste des documents supprimés déjà côté serveur (`documents.py:766-778`, `Vérifié`), aucune page côté interface ; le parcours P5 de la démo met un document en corbeille. |
| 3 | **Unification des parcours de validation** (l.32) | Partiel | H | M à H | « Deux expériences de validation » (matrice, rôle Responsable) ; touche P8 et les scénarios SC-VAL. |
| 4 | **Canal OTP** (l.26) | Partiel | H | H | La matrice demande de « choisir et prouver le canal » ; toute modification touche la connexion de tous les rôles. |
| 5 | **Rapport officiel côté serveur** (l.51) | Partiel | M | M | Les exports sont aujourd'hui faits côté navigateur ; la matrice dit « décider rapport officiel serveur » : décision produit avant code. |
| 6 | **Notifications multi-instance** (l.46) | Partiel | M | M à H | Le gestionnaire de connexions WebSocket est en mémoire du processus (`notifications.py:15`, `Vérifié`) : une seconde instance ne verrait pas les connexions de la première. Sans objet avec un seul poste. |
| 7 | **Favoris, récents, partagés** (l.56) | Aspirationnel | B | B à M | « Valider besoin avant backlog » ; routes absentes. |
| 8 | **Qualité documentaire** (l.52) | Aspirationnel | B | M | « Après dette filtres/tests ». |
| 9 | **Rapports planifiés et alertes** (l.54) | Aspirationnel | B | H | « Justifier par besoin pilote » ; exige tâches planifiées et envoi de messages (`Déduit`). |
| 10 | **Archivage légal et rétention** (l.57) | Aspirationnel | B | H | « Ne pas promettre au pilote » ; une politique de conservation supprime ou fige des données (`Déduit`). |

## 2. Ce que couvrent déjà #100 et #123, et ce que touche la recette du 20 au 23

- **#100** (surveillance de dossier, ingestion) et **#123** (reprise de page après reconnexion) ne couvrent **aucune** des dix capacités. Seul lien : #123 agit sur le parcours de reconnexion, donc toute modification du canal OTP (rang 4) repasse par le même écran.
- **Touchent la recette du 20 au 23** : *canal OTP* (P1, tests d'authentification, limite de tentatives D4) ; *validation* (P8, SC-VAL, `spec-validation-cycle-ui.md`) ; *corbeille* (P5 : « document en corbeille absent » est un résultat attendu de la démo) ; *notifications* (SC-NOT, `notifications.spec.ts`) ; *sondes de santé* (la preuve de restauration et les tests de fumée lisent `/health` ; la sonde C6 de l'item 29 aussi, `Déduit` de la chaîne de passages).
- **N'y touchent pas** : favoris, qualité, rapports planifiés, archivage, rapport officiel.
- **Items CDC** : l'item 29 se rattache aux sondes de santé ; l'item 28 (VPS) est « non vérifiable » par décision du PO du 9/11, aucun lien ; l'item 8 : lien non établi, à confirmer par O.

## 3. Garde-fous pour B (applicables à toutes)

1. Santé : **ajouter** un point de contrôle distinct (par exemple `/health/ready`) sans changer la réponse de `/health` ; trois consommateurs la lisent déjà.
2. Toute nouvelle table : migration, `alembic upgrade head` sur chaque base, et vérification que la restauration n° 2 reste égale au manifeste (`Déduit` : les comptages comparent des tables connues).
3. Rien dans une PR fusionnable avant le 24 : brouillons ; aucune modification des fichiers de test e2e utilisés par la recette sans accord de Q.
4. Canal OTP et validation : aucune modification du comportement actuel tant que le tag n'est pas posé ; travail derrière un réglage désactivé par défaut.

## 4. Ordre proposé

1, 2, 3, puis 4 et 5 (après une décision produit), puis 6 ; 7 à 10 seulement si le PO exprime un besoin pilote. Le rang 10 (archivage) est le seul à ne pas démarrer sans décision écrite du PO.
