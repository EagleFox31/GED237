# Ticket #280 : réglages à l'écran et écran des droits (V1.1)

Texte prêt à copier dans un ticket GitHub. Décision du PO du 17/11, question 12 de `fiche-decisions-po-19-11.md`, option C. Lot 8 de `plan-v1.1.md`.

**Titre** : V1.1 — réglages non secrets à l'écran et écran des droits en français simple

**Corps** :

## Contexte

En rc.1, le super admin règle à l'écran les institutions, les comptes, les règles d'accès et l'affichage. Les autres réglages se font dans `docker-compose.yml` et `.env`, et « Gestion AuthZ » montre des règles brutes. Le PO a choisi, le 17/11, de passer en V1.1 les réglages non secrets à l'écran, et d'ajouter un écran des droits lisible. Les mots de passe techniques restent sur le serveur.

## Lot 8a — réglages à l'écran

- Réglages visés : durée des sessions, nombre d'essais de connexion, taille maximale d'un envoi, fonctions activées (#230), serveur e-mail (#154).
- Valeurs stockées en base, avec la valeur du serveur comme défaut. Chaque changement est inscrit au journal d'audit.
- Réservé au super admin, sans nouveau droit donné à un autre rôle.
- Hors périmètre : `DB_PASSWORD`, `SECRET_KEY`, `ENVIRONMENT`, port, sauvegardes.
- Dépend de #154 et #230.

## Lot 8b — écran des droits

- Grille rôles × actions à cocher, libellés en français simple, à la place de la liste de règles brutes de « Gestion AuthZ ».
- Même source de vérité que `policy.csv` et les règles en base : l'écran ne crée pas de second modèle de droits.
- Chaque changement est inscrit au journal d'audit, avec un test par rôle.
- Dépend du lot 3 du plan V1.1 (#228), qui touche aussi `policy.csv`.

## Critères d'acceptation

1. Un réglage changé à l'écran s'applique sans redémarrer la pile, et figure au journal d'audit.
2. Aucun secret n'est lisible ni modifiable à l'écran, ni renvoyé par l'API.
3. Cocher ou décocher une action dans la grille donne le même effet que la règle équivalente de `policy.csv`. Un test par rôle le prouve.
4. Guide (« Ce qui se règle où ») et notes de version mis à jour.

## Chiffrage

À faire par B (8a et 8b backend) et F (écrans). Ordre de grandeur `Déduit` : 8a ≈ 4 à 6 h-s, 8b ≈ 3 h-s, relecture Q comprise.
