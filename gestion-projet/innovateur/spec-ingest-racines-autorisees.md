# Spécification — `POST /documents/ingest-directory` : racines autorisées (`INGEST_ALLOWED_ROOTS`, B ≈ 0,25 j, après le 413)

Pour : dev-backend (PR `fix/ingest-allowed-roots`, **livrée #53 le 10/11** : `INGEST_ALLOWED_ROOTS` `core/config.py:70,161`, `/data/ingest` dans les deux compose), ci-qa (montage et rejeu P2), orchestrateur. Instruction innovateur du 2026-11-09 soir ; développe la fiche courte `spec-limite-upload.md` § 5 (qui reste la référence du choix `/data/ingest`, tranché O). Niveaux : `Vérifié` = lu dans `main` a4b8dbe ; `Proposé` = à trancher dans la PR. Pas de code ici.

## 1. Risque

L'import de répertoire fait lire par le processus `api` **n'importe quel dossier qu'il peut ouvrir** et copie chaque fichier supporté dans le stockage du tenant de l'appelant, lisible ensuite dans la GED. Trois vecteurs : chemin arbitraire (`/app`, `/etc`, `/var/storage_data/<autre tenant>` : le volume de stockage est monté dans `api`, `docker-compose.yml:100`), traversée (`/data/ingest/../../etc`), lien symbolique posé dans un dossier légitime et pointant hors de lui. Préalable minime : un compte avec `documents:create`, donc tout collaborateur. Classement : lecture arbitraire du système de fichiers (CWE-22 / CWE-73), pas d'écriture hors stockage. Écart sécurité **10** du plan de présentation ; aucun test ne le couvre aujourd'hui.

## 2. Comportement actuel (`Vérifié`)

| Où | Ce qui se passe |
|---|---|
| `api/v1/endpoints/documents.py:1440-1459` | `authorize_or_403(current_user, "documents", "create")` puis `service.ingest(source_dir=request.directory_path, …)` sans autre contrôle. |
| `schemas/document.py:88-94` | `DirectoryIngestRequest.directory_path: str` libre, `recursive: bool = True`. |
| `services/ingestion.py:85` | seul chemin issu de la config : `settings.STORAGE_PATH` (destination). |
| `services/ingestion.py:113-117` | unique garde : `os.path.isdir(source_dir)` sinon rapport `{"error": "Le répertoire n'existe pas"}` (HTTP 200). |
| `services/ingestion.py:151-169` | `os.walk` (récursif) ou `os.listdir` ; filtre par extension seulement ; les liens symboliques de fichiers sont suivis à la copie (`getsize`, lecture), ceux de dossiers ignorés par `os.walk` par défaut. |
| `core/config.py:45-46` | `STORAGE_PATH`, `MAX_UPLOAD_SIZE` ; **aucune** variable de racine. Liste existante en chaîne séparée par virgules : `ALLOWED_ORIGINS_STR` → propriété `ALLOWED_ORIGINS` (`config.py:54-55, 124-126`) = modèle à réutiliser. |
| `docker-compose.yml:97-100`, `../GED237-e2e/docker-compose.yml:98-100` | volumes `api` : `./backend/app:/app/app`, `storage_data:/var/storage_data` ; **aucun montage** du dossier d'import, ni en démo ni en e2e. |
| `frontend/services/resources/documents.api.ts:158-162` | l'UI envoie `directory_path` tel que saisi. |

## 3. Contrat (`Proposé`)

1. **Variable** `INGEST_ALLOWED_ROOTS` (chaîne, `core/config.py`, `.env.example`, deux compose) : chemins **absolus du conteneur**, séparés par `os.pathsep` (`:` Linux, `;` Windows), espaces ignorés, propriété `INGEST_ALLOWED_ROOTS: List[str]` sur le modèle d'`ALLOWED_ORIGINS`. **Défaut `""` = tout refusé** (sûr par défaut, moindre privilège) ; valeur démo et e2e : `/data/ingest`.
2. **Résolution** dans le service, avant `isdir` : `real = os.path.realpath(path)` ; autorisé si, pour une racine `r`, `os.path.commonpath([real, os.path.realpath(r)]) == os.path.realpath(r)`. `realpath` des deux côtés neutralise `..` et les liens ; `commonpath` évite le préfixe trompeur (`/data/ingest-autre`). Une racine déclarée mais inexistante est ignorée avec un avertissement journalisé au démarrage (pas un crash).
3. **Chemin relatif** : accepté, résolu contre la **première** racine (`/data/ingest` + `live` → `/data/ingest/live`) ; l'UI peut ne saisir que le sous-dossier. Chemin absolu : doit tomber sous une racine. Chaîne vide, `.` ou `..` seuls : refus comme hors racine.
4. **Liens symboliques** : le dossier source est jugé sur sa cible réelle (point 2) ; pendant le parcours, chaque fichier retenu est re-vérifié (`realpath` sous la racine), sinon **ignoré** et compté dans `report.errors` avec `"error": "Lien hors des emplacements autorisés"` ; `os.walk(followlinks=False)` explicite.
5. **Erreur** : **403** et non 400. La requête est bien formée ; c'est une **décision d'autorisation** sur la ressource visée (même logique qu'`authorize_or_403`, même traitement frontend par `pushApiError`) ; un 400 ferait croire à une faute de saisie et inciterait à « corriger » le chemin. Forme : exception métier `IngestPathForbiddenError` dans `services/` (sans HTTP), traduite une fois dans l'endpoint en Problem Details `error_code=INGEST_PATH_FORBIDDEN`, `detail="Dossier hors des emplacements autorisés"` (ne révèle ni l'existence du chemin ni la liste) ; journal serveur avec chemin demandé et utilisateur. Dossier **autorisé mais absent** : comportement actuel conservé (200 + rapport d'erreur) pour ne pas casser `uat/directory-import.spec.ts`.
6. **Hors périmètre** : quota de fichiers par import, extensions (inchangées), `worker` (n'importe pas).

## 4. Impact démo et e2e

- **Montage** à ajouter au service `api` des deux compose (`Proposé` ; ci-qa pour e2e, O pour la démo) : `- <dossier hôte>:/data/ingest:ro` ; côté e2e `./frontend/e2e/data/demo-import` ; côté démo le corpus généré (`jeu-donnees-demo.md` § 5, dossiers `DRH/DAF/DSI/live`). Lecture seule : l'import copie, il n'écrit jamais dans la source. `INGEST_ALLOWED_ROOTS=/data/ingest` dans `environment` à côté de `STORAGE_PATH`.
- **Jeu de données 18–19/11** : le reset `e2e_reset.sh demo` importe `DRH`, `DAF`, `DSI` via l'API en chemins **relatifs** (`DRH`, …) ou absolus `/data/ingest/DRH` ; `live/` reste non importé pour P2 (`checklist-demo.md` H-30, `jeu-donnees-demo.md` § 2). Sans la variable renseignée, le reset échoue en 403 dès le premier import : à prévoir dans la PR 2a de ci-qa, **après** fusion de cette PR B (dépendance déjà dans le plan semaine, jeu 12).
- **Parcours P2 le jour J** : l'opérateur saisit `live` (ou `/data/ingest/live`) ; un chemin hors racine tapé par erreur donne le 403 lisible, pas une liste vide.

## 5. Tests attendus (B, pytest Docker ; Q rejoue P2)

| Cas | Entrée (`INGEST_ALLOWED_ROOTS=/tmp/root`, `tmp_path` monkeypatché) | Attendu |
|---|---|---|
| racine ok | `/tmp/root/lot` avec 2 PDF | 200, `imported=2` |
| relatif | `lot` | 200, même résultat |
| hors racine | `/tmp/autre` | 403 `INGEST_PATH_FORBIDDEN`, aucun fichier copié, aucune ligne en base |
| traversée | `/tmp/root/../autre` | 403 |
| préfixe trompeur | `/tmp/root-bis` | 403 |
| symlink dossier sortant | `/tmp/root/lien → /tmp/autre` | 403 |
| symlink fichier sortant | `/tmp/root/lot/f.pdf → /tmp/autre/x.pdf` | 200, `imported=1`, 1 entrée `errors` « Lien hors… » |
| liste vide | `INGEST_ALLOWED_ROOTS=""` | 403 pour tout chemin, y compris existant |
| autorisé mais absent | `/tmp/root/inexistant` | 200, rapport « Le répertoire n'existe pas » (inchangé) |

Sous Windows (hors Docker), les cas symlink sont `skipif` ; la cible de preuve est Docker.

## 6. Acceptation et budget

- Critère : `criteres-acceptation.md` SC-ADM-08, mention *E (guide)* « chemin hors racine autorisée → 403 » ; ligne `SC-SEC-05` « import hors racine refusé » (pytest B + rejeu Q) à ajouter par I dans `matrice-recette.md` à la fusion. Écart sécurité 10 du plan de présentation : « l'import ne voit que le dossier déclaré ».
- Budget : **0,25 j B** (déjà compté, `point-2026-11-14.md` § 4) : config + garde + exception + 9 tests ; 0 j F (403 déjà affiché par `pushApiError`) ; ci-qa : montage + variable dans la PR 2a. Ordre : après la 413 (`spec-limite-upload.md` § 3-4), même PR possible si les deux tiennent dans la journée, sinon PR dédiée.
- Preuve dans la PR : pytest vert (9 cas), capture du 403 depuis l'UI sur un chemin hors racine, `docker compose exec api printenv INGEST_ALLOWED_ROOTS` = `/data/ingest`.

Sources : `backend/app/api/v1/endpoints/documents.py`, `backend/app/services/ingestion.py`, `backend/app/schemas/document.py`, `backend/app/core/config.py`, `docker-compose.yml`, `../GED237-e2e/docker-compose.yml`, `frontend/services/resources/documents.api.ts` (lus le 09/11 soir) ; `spec-limite-upload.md` § 5 ; `checklist-demo.md` ; `criteres-acceptation.md` ; `jeu-donnees-demo.md`.
