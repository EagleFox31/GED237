# Brouillon : leçon 042 (pour `DOCS/engineering/lessons-learned.md`)

- **Destinataire** : B, qui intègre l'entrée dans la PR du lot ENVIRONMENT (après le 30/11, empilée sur #154).
- **Format** : celui des leçons 038 à 041.
- **Statut** : `captured`. B le passe à `prevention-added` quand le lot est fusionné.
- **Numéro** : 042 si les branches de 038, 039 et 041 sont fusionnées avant. Sinon, prendre le numéro libre suivant.
- **Sources** : `inventaire-environment-production.md` (n° 3 et 4) ; `protocole-installation-site.md` (E2 bis).

---

### LESSON-2026-042 — Garde-fou SECRET_KEY contourné en silence : le compose et le code n'ont pas le même défaut

- **Date :** 2026-11-17
- **Catégorie :** security / config
- **Statut :** captured
- **Liens :** `backend/app/core/config.py` (l. 46 défaut, l. 226-235 `get_settings`), `docker-compose.yml` (l. 70, 96, 134), `backend/docker-compose.yml` (l. 58), `DOCS/exploitation/installation.md` (l. 40), `gestion-projet/innovateur/protocole-installation-site.md` (E2 bis)

**Contexte** — `get_settings()` refuse de démarrer en production si `SECRET_KEY` vaut le défaut de développement. Le déploiement passe par `docker-compose.yml`, qui fournit son propre défaut quand le `.env` n'a pas de clé (`${SECRET_KEY:-…}`).
**Échec / near miss** — Les deux défauts diffèrent : `dev-secret-key-change-in-production` dans le compose, `dev-secret-key-change-this-in-production` dans `config.py`. Avec `ENVIRONMENT=production` et sans `SECRET_KEY` dans le `.env`, le contrôle ne se déclenche pas. L'API démarre et signe les jetons JWT avec une clé publique, présente dans le dépôt. Relevé lors de l'inventaire ENVIRONMENT du 17/11. Aucun site n'est touché : la rc.1 et la démo tournent en `development`, mode où le contrôle est inactif de toute façon.
**Cause racine** — Le contrôle teste l'égalité avec **une seule** valeur connue. Il ne vérifie pas la propriété attendue : une clé fournie, aléatoire, absente de toute liste de défauts. La deuxième valeur, introduite par le compose, échappe au contrôle sans que rien ne le signale.
**Résolution** — Avant le gel, le code ne change pas. Sur le terrain, l'étape E2 bis du protocole d'installation et de la préparation de la démo applique trois contrôles qui n'affichent que des compteurs :
1. aucun défaut connu ni valeur vide : doit renvoyer `0` ;
2. une ligne `^SECRET_KEY=[0-9a-f]{64}$` : doit renvoyer `1`. C'est le seul contrôle qui repère une ligne absente, cas où le compose applique son défaut ;
3. la valeur reçue par le conteneur `api` : doit renvoyer `OK`.

Le correctif de code est confié au lot ENVIRONMENT de B, après le 30/11.
**Prévention** — Prévue dans le lot ENVIRONMENT :
- `SECRET_KEY` exigée hors `development` ; refus au démarrage de toute valeur figurant dans une **liste** de défauts connus (ceux de `config.py`, des deux compose et de `.env.example`), d'une valeur vide ou de moins de 32 octets ;
- compose en `${SECRET_KEY:?SECRET_KEY must be set (openssl rand -hex 32)}` : la pile refuse de démarrer sans clé, au lieu d'en inventer une ;
- un test paramétré, une ligne par défaut connu, plus une valeur vide et une valeur courte, avec `ENVIRONMENT=production` : chaque cas doit lever l'erreur au démarrage ;
- un test qui relit les défauts écrits dans les fichiers compose et vérifie qu'ils figurent dans la liste refusée.

Jusque-là, E2 bis fait foi. Secret TOTP (#193) : sans `TOTP_ENCRYPTION_KEYS`, sa clé est dérivée de `SECRET_KEY`. Changer la clé après l'enrôlement oblige donc à se ré-enrôler, et la clé définitive est fixée avant le premier enrôlement.
**Leçon généralisée** — Un garde-fou de configuration teste la **propriété voulue** (valeur fournie, 64 caractères hexadécimaux, absente de tout défaut connu), pas l'égalité avec un seul défaut. Toute valeur par défaut d'un secret est une valeur publique. Quand le défaut est écrit à plusieurs endroits (code, compose, `.env.example`), un test doit les relire ensemble. Un garde-fou qui ne se déclenche pas ne fait aucun bruit : il faut un cas de test qui prouve qu'il **échoue** sur chaque défaut connu.
