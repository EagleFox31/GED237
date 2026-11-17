# Héberger la rc.1 sur le VPS : empreinte réelle et réductions (question 9 du PO)

- **Pour** : O, puis le PO. Innovateur, 17/11/2026, sur `main` 615d2a4. Réponse du PO à la question 9 : la rc.1 sera hébergée d'abord sur notre VPS.
- **Niveaux** : `Mesuré` (relevé le 17/11), `Déduit` (calcul à partir des mesures), `À mesurer`.
- Rien n'a été modifié sur le VPS : c'est une lecture seule (`free -m`, `df -h`, `docker stats`, `docker system df`). Toute modification demande un accord explicite.

## 1. Ce que le VPS a de libre (`Mesuré`)

| Ressource | Total | Libre | Remarque |
|---|---|---|---|
| Mémoire | 3,8 Go | **2,0 Go** disponibles | Le swap est déjà utilisé à **1,3 Go sur 2 Go** : la machine manque déjà de mémoire. |
| Disque | 38 Go | **12 Go** | 1,9 Go de cache de build récupérable. |
| Processeur | 2 vCPU | — | 15 conteneurs tournent, dont WAHA (≈ 375 Mo à eux deux). |

## 2. Ce que consomme la pile rc.1

| Service | Plafond actuel (`docker-compose.yml`) | Au repos (`Mesuré` en local) | Pointe |
|---|---|---|---|
| api | 1 Go, 1,5 CPU, `uvicorn --reload` | 233 Mo | `À mesurer` |
| worker (OCR) | 2 Go, 2 CPU, `--concurrency=2` | `À mesurer` | ≈ 2 Go (`Déduit`) : quand Tesseract lit mal une page, EasyOCR prend le relais et charge PyTorch dans chaque processus (`strategy.py`). Aucun réglage ne le désactive. |
| postgres | 768 Mo | 50 Mo | grandit avec la base |
| frontend | 768 Mo, serveur de **développement** Vite | 106 Mo | — |
| redis | 192 Mo | 16 Mo | — |
| nginx | 64 Mo | 14 Mo | — |
| **Total** | **4,8 Go** de plafonds | **≈ 0,4 Go** sans le worker | **jusqu'à ≈ 2,5 Go** pendant un OCR (`Déduit`) |

Disque : l'image de l'API et du worker pèse **3,2 Go**, celle du frontend de développement 0,7 Go, et postgres, redis et nginx ≈ 0,3 Go. Il faut donc **≈ 4,2 Go**, plus l'archive d'import (`images.tar.gz`, plusieurs Go) pendant l'installation. On ne construit pas sur le VPS : PyTorch y demanderait de la mémoire et du disque en plus.

**Verdict (`Déduit`)** : les 8 Go de la fiche sont des plafonds, pas une consommation. Au repos, la pile tient dans les 2 Go libres. Pendant un OCR difficile, elle peut les dépasser et pousser les autres services (WAHA, sign, deploy) dans un swap déjà chargé. **La pile rc.1 ne doit donc pas aller sur le VPS telle quelle.**

## 3. Ce qu'il faut couper ou réduire

Ce sont des réglages de déploiement, sans changement du code de l'application. Ils vont dans un fichier `docker-compose.vps.yml` propre au VPS, à écrire et à tester par B et Q.

| # | Réduction | Gain estimé (`Déduit`) | Contrepartie |
|---|---|---|---|
| 1 | Worker : `--concurrency=1`, plafond 1,2 Go, 1 CPU | ≈ 0,8 Go de pointe | Un seul OCR à la fois : la file s'allonge pendant un import en masse. |
| 2 | Frontend : cible `production` du Dockerfile (fichiers statiques servis par nginx) au lieu du serveur Vite | ≈ 0,1 Go de mémoire, 0,6 Go de disque | Aucune pour l'utilisateur. |
| 3 | API : sans `--reload`, plafond 512 Mo, 1 CPU | ≈ 0,05 à 0,1 Go | Il faut redémarrer l'API après une mise à jour (c'est déjà le cas avec `up -d`). |
| 4 | Postgres 384 Mo, redis 64 Mo | rien au repos, mais la pointe est bornée | Ces plafonds sont ceux des autres bases du VPS (`deploy-db-prod-1` : 384 Mo). |
| 5 | Pas de `seed` : `--scale seed=0`, puis comptes réels créés à la main (`donnees-demo.md`, « Plateforme vide ») | — | Point de sécurité ci-dessous. |
| 6 | Disque : purger le cache de build (1,9 Go), et supprimer l'archive d'images après l'import | ≈ 2 à 5 Go | Avec l'accord de l'utilisateur. |

Avec les points 1 à 4, les plafonds font **≈ 2,6 Go** et la consommation prévue est **≈ 0,5 Go au repos et 1,5 Go pendant un OCR** (`Déduit`). Ça tient dans les 2 Go libres, mais avec peu de marge. **À mesurer** sur le VPS pendant une heure d'OCR sur des scans, avant d'y mettre des utilisateurs.

## 4. Point de sécurité, bloquant pour une adresse publique

En rc.1 :
- `ENVIRONMENT=development` affiche le code de connexion à l'écran ;
- la page de connexion affiche les comptes de démonstration.

Sur une adresse publique, la double authentification ne protège donc rien. **La rc.1 sur le VPS doit rester joignable par le VPN seulement** : wg-easy tourne déjà sur le VPS. À défaut, il faut une liste d'adresses IP autorisées dans Caddy. Elle n'est publiable qu'en V1.1, avec l'envoi du code par e-mail (#154) et la garde de démarrage (#212).

## 5. Recommandation

1. **Pour la démo et un pilote de quelques agents** : le VPS convient, avec les réductions 1 à 6, l'accès par VPN et une mesure d'une heure d'OCR avant d'ouvrir l'accès. Effort : ≈ 1,5 h-s pour B (fichier compose et section d'installation), plus ≈ 0,5 h-s pour Q (mesure).
2. **Au-delà** (import en masse, plus de 20 utilisateurs en même temps, `Déduit`) : il faut plus de mémoire, soit en passant le VPS à 8 Go (prix OVH `À vérifier`), soit sur un serveur du ministère.
