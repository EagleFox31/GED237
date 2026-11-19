# nginx garde l'ancienne adresse de `api` après une sauvegarde ou une restauration (V1.1)

Source : lab hors ligne de Q du 19/11 (#477, `gestion-projet/recette/2026-11-19-lab-hors-ligne-items-28-31.md`).

## Constat

`ops/backup.sh` et `ops/restore.sh` recréent le conteneur `api`, qui change alors d'adresse IP. nginx résout le nom `api` une seule fois, à son démarrage. Il continue donc d'envoyer les requêtes à l'ancienne adresse, et `/health` répond 502 jusqu'à `docker compose restart nginx`.

Ce que voit l'utilisateur : après une sauvegarde de nuit, l'application ne répond plus tant que personne ne relance nginx.

Palliatif V1.0 : la PR `ops/` de Q relance nginx puis contrôle `/health`. Il suffit pour la recette et pour l'item 31. Le correctif de fond va en V1.1.

## État de `main` (da09df90)

- `nginx/nginx.conf` et `nginx/nginx-tls.conf` : `upstream api_backend { server api:8000; }` et `upstream frontend_app { server frontend:5173; }`. Ni `resolver`, ni `zone`.
- `nginx/app-locations.conf` : six `proxy_pass http://api_backend;` ou `http://frontend_app;`, sans URI. Les en-têtes WebSocket (`Upgrade`) sont posés sur `/api/` et sur `/`.
- Image : `nginx:alpine`, sans version fixe, dans `docker-compose.yml` et `docker-compose.tls.yml`.

## Deux pistes

| | A. `resolver` et une variable dans `proxy_pass` | B. `resolve` sur le serveur de l'`upstream` |
|---|---|---|
| Changement | `resolver 127.0.0.11 valid=10s;`, puis `set $api http://api:8000;` et `proxy_pass $api;` dans chacune des six `location` | dans les deux `upstream` : `zone … 64k;` et `server api:8000 resolve;`, plus `resolver 127.0.0.11 valid=10s;` |
| `proxy_pass` | change. Avec une variable, nginx ne remplace plus le préfixe de la `location`, ce qui est sans effet ici car aucun `proxy_pass` ne porte d'URI. Le risque vient d'une future `location` qui en ajoute une | inchangé |
| WebSocket | inchangé, mais à retester sur les deux `location` | inchangé |
| Version de nginx | toutes | **1.27.3 ou plus** : `resolve` est entré dans la version libre de nginx en 1.27.3 |
| Fichiers | 3 fichiers, 6 `location` | 2 fichiers, 2 `upstream`, et les 2 fichiers compose |

## Recommandation de l'innovateur : B

- B ne touche ni aux `location` ni au WebSocket. Le diff est plus court, et le comportement de `proxy_pass` reste celui que la recette a validé.
- La condition de version se règle en fixant l'image à une version stable, par exemple `nginx:1.28-alpine`, au lieu de `nginx:alpine`. Cela sert aussi l'installation hors ligne : l'image chargée sur le site est alors celle qui a été testée.
- Avant de choisir le tag, le porteur vérifie la version réelle de l'image (`nginx -v`) et le changelog de nginx.
- Preuve attendue : sauvegarde, puis restauration, puis `/health` en 200 **sans** relancer nginx. Ajouter un rejeu d'une notification WebSocket.

## Charge et porteur

- Environ 0,5 h-s de configuration et 0,25 h-s de preuve, en Docker.
- Porteur proposé : Q, qui a le lab et le palliatif, et garde 1,45 h-s de marge après le transfert de #471. **À confirmer par O.**
- Place : V1.1, après la fusion de la PR `ops/` de Q.
- Ensuite, le palliatif « relancer nginx » peut rester comme filet de sécurité.
