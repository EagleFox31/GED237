# Items CDC 27, 29, 30 (infra) — ce qui peut encore monter le taux avant le 19

- **Date :** 2026-11-10
- **Demandeur :** orchestrateur (répartition ensuite)
- **Base :** `main` dc4daae ; statuts du « Recalcul du taux CDC » du 10/11 ; attendu 26/32 = 81,3 % après #82, #81, #89, #79 + #84
- **Unité :** h-s (heure de session)

## Synthèse

| Item | Statut `main` | Gain possible | h-s | Qui | Avant le 19 ? |
|---|---|---|---|---|---|
| 27 HTTPS | absent | absent → **fait** (+ 1) ou partiel (+ 0,5) selon lecture PO du certificat local | 1–1,5 | Q | **oui**, additif (profil compose), sans toucher au port 80 de la démo |
| 29 Disponibilité ≥ 99 % | absent | absent → **partiel** (+ 0,5) le 19 avec 6 relevés ; → **fait** (+ 1) le 21 avec 10/10 | 0,5 | Q | **oui** pour la sonde et les premiers relevés ; `fait` seulement après la coupure (campagne S2 17–21) |
| 30 Sauvegardes + restauration testée | **fait** depuis le 10/11 (#54, #61, `recette/restauration-2026-11-10.txt`) | 0 (déjà compté) | 0 | — | rien à faire d'ici le 19 ; rejeu n° 2 le 20/11 (C7) reste au plan de recette |

Plafond : 26 + 1 + 0,5 = **27,5/32 = 85,9 %** le 19 ; **28/32 = 87,5 %** le 21 si C6 est 10/10. L'item 30 figure dans la demande parce que l'audit du 9/11 le donnait « absent, 2 j » ; il est `fait` depuis le recalcul du 10/11.

## Item 27 — HTTPS

- **Ce que le CDC attend** : transport chiffré entre le navigateur et l'application.
- **Existant** : `nginx/nginx.conf` écoute sur 80 seulement (`APP_PORT:-8080`), pas de certificat ; `ALLOWED_ORIGINS` en `http://` ; front en URL relative (`VITE_API_URL=/api/v1`), donc aucun contenu mixte à craindre ; VPS écarté par le PO le 9/11 (démo sur place en Docker), donc **pas de certificat public possible**.
- **Ce qui manque** : un point de terminaison TLS. Deux voies équivalentes en coût :
  - **A (recommandée)** : fichier `docker-compose.tls.yml` (profil `tls`) ajoutant un `nginx` qui écoute aussi sur 443 avec un certificat local généré par `mkcert` sur le poste de démo (`mkcert -install` puis `mkcert localhost 127.0.0.1 <IP poste>`) : cadenas vert sur le poste de démo et le poste de secours (CA locale installée) ; `ALLOWED_ORIGINS` complété de `https://localhost:8443`.
  - **B** : Caddy en frontal avec `tls internal` ; même résultat, un conteneur de plus (RAM) et une CA à installer de la même façon.
  - Les deux laissent le port 80 inchangé : parcours de démo, e2e Playwright (`http://localhost:8080`) et sonde C6 ne bougent pas.
- **Preuve attendue** : `curl -sk https://localhost:8443/health` = 200 dans un walkthrough daté + capture du cadenas sur le poste de démo ; ligne H-30 dans `checklist-demo.md` (certificat généré sur le poste réel, pas sur un poste de dev).
- **Chiffrage** : 1 h-s (compose + conf nginx + doc `DOCS/exploitation/https-local.md` ≈ 0,75 ; preuve + relecture 0,25) ; 1,5 h-s si Caddy.
- **Propriétaire** : **Q** (porte déjà `docker-compose.yml`, `ops/`, la checklist H-30) ; B non sollicité.
- **Risque démo** : faible si additif ; nul si le profil `tls` n'est pas activé pendant la démo. Un seul point à trancher par le PO : montrer la démo en HTTPS (cadenas, certificat local) ou garder HTTP et présenter HTTPS comme prouvé hors séance. Statut proposé : `fait` avec écart annoncé « certificat local, CA publique hors périmètre sans nom de domaine » ; si le PO refuse l'écart, `partiel`.

## Item 29 — Disponibilité ≥ 99 %

- **Ce que le CDC attend** : une disponibilité mesurée pendant les tests de validation (C6 de `criteres-acceptation.md`).
- **Existant** : `/health` avec version (#58), `healthcheck` compose sur `api`, `postgres`, `redis`, `restart: unless-stopped` ; protocole de mesure écrit (`protocole-mesures-criteres.md` § C6 : `probe_c6.sh`, relevés matin et soir du 17 au 21, GO = 10/10). **Aucune sonde dans le dépôt, aucun relevé.**
- **Ce qui manque** : (1) le script `scripts/probe_c6.sh` (≈ 10 lignes, déjà rédigé dans le protocole) versionné ; (2) les relevés datés dans `gestion-projet/recette/mesures-2026-11-20/c6.tsv` ; (3) la ligne C6 de `criteres-acceptation.md` renseignée le 21.
- **Amélioration à coût nul** : lancer la sonde en boucle (`while true; do …; sleep 300; done` dans un `screen` sur le poste de démo, ou un service compose `probe` du profil `ops`) : ≈ 1 400 relevés sur 5 jours au lieu de 10, ce qui rend le « 99 % » défendable devant le jury (10 relevés ne distinguent pas 99 % de 90 %). La règle GO reste celle du protocole, les relevés matin/soir en sont un sous-ensemble.
- **Chiffrage** : 0,5 h-s (script + boucle + README ≈ 0,25 ; premier relevé et relecture 0,25) + 2 min/jour.
- **Propriétaire** : **Q** (déjà prévu au protocole, mar 17 matin). Avancer au **jeu 13** la mise en dépôt du script, pour que la pile de démo le porte dès son premier démarrage.
- **Avant le 19 ?** La sonde oui ; le statut `fait` non : il exige la campagne S2 (17–21). Au relevé du 19 à 18:00 : **`partiel`** si ≥ 6 relevés verts consécutifs (17 matin → 19 soir), **`fait`** au 21 si 10/10. À écrire tel quel dans le relevé de coupure et les notes rc.1, pas comme un item « rattrapé ».
- **Risque démo** : nul (lecture seule : `curl`, `docker ps`, `docker inspect`).

## Item 30 — Sauvegardes + restauration testée

- **Ce que le CDC attend** : une sauvegarde de la base et du stockage, et un test de restauration réalisé et validé (C7).
- **Existant** : `ops/backup.sh` (`pg_dump -Fc` + `storage.tar.gz` + `SHA256SUMS` + `MANIFEST.txt`, rétention), `ops/restore.sh <dossier> [--wipe] [--yes]` (refus sur cible non vide, contrôle d'empreintes avant écrasement), `DOCS/exploitation/sauvegarde-restauration.md` § 5 (exercice daté du 9/11, 6 cas), recette n° 1 du 10/11 (#61, `gestion-projet/recette/restauration-2026-11-10.txt`). Statut `fait` depuis le recalcul du 10/11.
- **Ce qui manque** : rien pour le taux. Pour C7 : le **rejeu n° 2 daté du 20/11** (`restore.sh --wipe` sur base vierge → 8 parcours rejouables), déjà au plan de recette (jeu 20, Q), et une ligne H-30 « sauvegarde J-1 de la pile de démo » déjà dans la checklist.
- **Chiffrage** : 0 h-s avant le 19 ; 0,5 h-s le 20 (rejeu + walkthrough), déjà budgété.
- **Propriétaire** : Q (rejeu) ; B en appui si la restauration casse sur une migration ajoutée entre le 10 et le 19 (`alembic upgrade head` après `restore.sh` : à écrire dans le déroulé si ce n'est pas déjà le cas).
- **Risque démo** : nul.

## Hors demande, même but (+ 0,5 facile)

- **Item 31 (docs) `partiel`** : seul le **manuel d'installation** manque. `DOCS/exploitation/installation.md` (prérequis Docker, `.env`, `docker compose up`, `alembic upgrade head`, `seed_db.py`, ports, sauvegarde) ≈ 0,75 h-s ; rédaction innovateur à partir de `docker-compose.yml` et du README, relecture Q sur une pile vierge (preuve = installation suivie à la lettre). Statut `partiel` → `fait` : + 0,5. Avec 27 et 29 : **28/32 = 87,5 %** le 19, 28,5/32 = 89,1 % le 21.
- Item 28 (déploiement VPS) reste `non vérifiable` par décision PO du 9/11 : rien à faire.
