# Renommage des 25 fichiers au préfixe proscrit — préparation (exécution après le 19/11, sur accord PO)

- **Pour** : O (exécute sur accord PO), le PO (tranche les libellés de rôle). Innovateur, 2026-11-10, sur `main` 7ecde2b (`git ls-files`, `grep -rIl`). Décision PO n° 6 de `decisions-po-2026-11-10.md`.
- **Notation** : `[P]` désigne le préfixe proscrit actuel (le nom de l'outil entre crochets), que ce document ne reproduit pas. Le nouveau préfixe est le **rôle** de la session qui a écrit le fichier, lu dans son en-tête (`Session :`, `Agent :`, `Auteur :`) ; quand l'en-tête ne le dit pas, le rôle est `Déduit` du sujet et de la date (avant le 09/11, une seule session « Tech Lead / QA » ; audits → `[Audit]`). `[G]` désigne de même le préfixe de l’outil d’audit externe (audits UX). **Revu le 18/11** : les 25 fichiers portent toujours `[P]` sur `main` (dd0436b) ; le plan reste valable.
- **Libellés validés par O le 10/11** (un seul jeu pour tout le dépôt) : `[Tech Lead]`, `[Audit]`, `[Dev-backend]`, `[Dev-frontend]` ; déjà en usage : `[Audit]`, `[Innovateur]`, `[Cursor]`, `[G]` (ces deux derniers ne sont pas visés par la règle PO, voir § 3).

## 1. Les 25 fichiers (+ la convention de nommage, même lot)

Le lot comprend aussi l'alignement de la convention dans `AGENTS.md` l. 24 et `.agents/AGENTS.md` l. 14 : `[Rôle] Nom de la tâche - AAAA-MM-JJ.md` (décision O du 10/11 ; sinon la règle PO et la convention se contredisent). Colonne « Source » : **en-tête** = rôle lu dans le fichier (13) ; déduit = sujet et date (12).

| # | Chemin actuel | Nouveau nom (même dossier) | Indice | Source |
|---|---|---|---|---|
| 1 | `gestion-projet/[P] RACI + Roadmap GED237.md` | `[Tech Lead] RACI + Roadmap GED237.md` | en-tête « Tech Lead / QA » | **en-tête** |
| 2 | `gestion-projet/walkthrough/[P] Adoption standard RAIDER - 2026-10-27.md` | `[Tech Lead] Adoption standard RAIDER - 2026-10-27.md` | session unique d'octobre | déduit |
| 3 | `gestion-projet/walkthrough/[P] Audit technique GED237 - 2026-07-22.md` | `[Audit] Audit technique GED237 - 2026-07-22.md` | en-tête « audit assisté » | **en-tête** |
| 4 | `gestion-projet/walkthrough/[P] Authz collaborateur, tenant propre, categories - 2026-11-09.md` | `[Dev-backend] Authz collaborateur, tenant propre, categories - 2026-11-09.md` | `Session : ged-dev-backend` | **en-tête** |
| 5 | `gestion-projet/walkthrough/[P] Codes de role en minuscules - 2026-11-11.md` | `[Dev-backend] Codes de role en minuscules - 2026-11-11.md` | `Session : ged-dev-backend` | **en-tête** |
| 6 | `gestion-projet/walkthrough/[P] DEBUG off et rate-limit auth configurable - 2026-11-09.md` | `[Dev-backend] DEBUG off et rate-limit auth configurable - 2026-11-09.md` | `Session : ged-dev-backend` | **en-tête** |
| 7 | `gestion-projet/walkthrough/[P] Exposition AGENTS.md racine - 2026-07-22.md` | `[Tech Lead] Exposition AGENTS.md racine - 2026-07-22.md` | en-tête « Tech Lead / QA » | **en-tête** |
| 8 | `gestion-projet/walkthrough/[P] Import de repertoire - racines autorisees - 2026-11-09.md` | `[Dev-backend] Import de repertoire - racines autorisees - 2026-11-09.md` | lot backend DEC-002 | déduit |
| 9 | `gestion-projet/walkthrough/[P] Lot C filtres serveur - 2026-11-09.md` | `[Dev-backend] Lot C filtres serveur - 2026-11-09.md` | `Session : ged-dev-backend` | **en-tête** |
| 10 | `gestion-projet/walkthrough/[P] Lot C recette Playwright - 2026-11-09.md` | `[Dev-frontend] Lot C recette Playwright - 2026-11-09.md` | « session dev-frontend » | **en-tête** |
| 11 | `gestion-projet/walkthrough/[P] PR securite dependances - 2026-11-09.md` | `[Dev-backend] PR securite dependances - 2026-11-09.md` | `Session : ged-dev-backend` | **en-tête** |
| 12 | `gestion-projet/walkthrough/[P] Plafond d'upload 413 - 2026-11-09.md` | `[Dev-backend] Plafond d'upload 413 - 2026-11-09.md` | lot backend DEC-002 | déduit |
| 13 | `gestion-projet/walkthrough/[P] Recherche bornee tenant service corbeille - 2026-11-09.md` | `[Dev-backend] Recherche bornee tenant service corbeille - 2026-11-09.md` | `Session : ged-dev-backend` | **en-tête** |
| 14 | `gestion-projet/walkthrough/[P] Regle coordination et verrou walkthrough - 2026-07-22.md` | `[Tech Lead] Regle coordination et verrou walkthrough - 2026-07-22.md` | en-tête « Tech Lead / QA » | **en-tête** |
| 15 | `gestion-projet/walkthrough/[P] Regle validation 4 niveaux de tests - 2026-07-22.md` | `[Tech Lead] Regle validation 4 niveaux de tests - 2026-07-22.md` | en-tête « Tech Lead / QA » | **en-tête** |
| 16 | `gestion-projet/walkthrough/[P] Sauvegarde et restauration - 2026-11-09.md` | `[Dev-backend] Sauvegarde et restauration - 2026-11-09.md` | branche `ops/backup-restore` (B) | déduit |
| 17 | `gestion-projet/walkthrough/[P] Validateurs et version courante des taches - 2026-11-09.md` | `[Dev-backend] Validateurs et version courante des taches - 2026-11-09.md` | contrat P8 côté API (B) | déduit |
| 18 | `walkthrough/[P] Audit reel et plan d'action - 2026-10-27.md` | `[Audit] Audit reel et plan d'action - 2026-10-27.md` | audit par mesures | déduit |
| 19 | `walkthrough/[P] Impact-Aware CI - 2026-10-29.md` | `[Tech Lead] Impact-Aware CI - 2026-10-29.md` | session unique d'octobre | déduit |
| 20 | `walkthrough/[P] Lot 0 - Securisation environnement - 2026-07-22.md` | `[Tech Lead] Lot 0 - Securisation environnement - 2026-07-22.md` | en-tête « Tech Lead / QA » | **en-tête** |
| 21 | `walkthrough/[P] Lot A - Consolidation depot - 2026-10-28.md` | `[Tech Lead] Lot A - Consolidation depot - 2026-10-28.md` | session unique d'octobre | déduit |
| 22 | `walkthrough/[P] Lot B - gitattributes et fichiers portables - 2026-10-29.md` | `[Tech Lead] Lot B - gitattributes et fichiers portables - 2026-10-29.md` | session unique d'octobre | déduit |
| 23 | `walkthrough/[P] Lot B6 - Tests API authz - 2026-10-29.md` | `[Tech Lead] Lot B6 - Tests API authz - 2026-10-29.md` | session unique d'octobre | déduit |
| 24 | `walkthrough/[P] Lot B8 - Lint bloquant - 2026-10-29.md` | `[Tech Lead] Lot B8 - Lint bloquant - 2026-10-29.md` | session unique d'octobre | déduit |
| 25 | `walkthrough/[P] Migration Node 24 - 2026-10-30.md` | `[Tech Lead] Migration Node 24 - 2026-10-30.md` | session unique d'octobre | déduit |

**21 fichiers sur 25** portent aussi le préfixe dans leur **titre H1** (ligne 1 ; exceptions : 8, 12, 16, 17) et six dans la ligne `Auteur`/`Agent` (1, 3, 7, 14, 15, 20) : à corriger dans le même commit (titre = nouveau préfixe ; `Agent : Tech Lead / QA`).

## 2. Liens internes à réécrire (grep du 10/11, hors `node_modules`, `venv`, `.git`)

| Fichier citant | Fichiers cités (n° du § 1) | Forme | Action |
|---|---|---|---|
| `gestion-projet/README.md` l. 24, 33 | 3, 1 | lien Markdown, chemin encodé `%5B…%5D` | réécrire le libellé et l'URL encodée |
| `AGENTS.md` l. 15 | 1 | chemin en code | réécrire ; **l. 24** définit encore la convention `[Cursor|…|G] Nom - date.md` : la remplacer par « `[Rôle] Nom - AAAA-MM-JJ.md` » (sinon la règle PO et la convention se contredisent) |
| dossier des agents de session, `…/agents/product-owner.md` l. 12 | 1 | chemin en code | réécrire |
| `gestion-projet/EQUIPE_AGENTS.md` l. 4 | 1 | nom en code | réécrire |
| `DOCS/engineering/lessons-learned.md` l. 273, 301, 346, 360 | 19, 24, 13, 4 | `walkthrough \`[P] …\`` (l. 360 cite « catégories » avec accent, le fichier dit `categories`) | réécrire les quatre (corriger l'accent au passage) |
| `gestion-projet/walkthrough/[G] Etat de sante du projet - 2026-10-29.md` l. 18 | 18, 21, 24 | noms en texte | réécrire (fichier [G] : le PO confirme qu'on y touche) |
| `gestion-projet/walkthrough/[Cursor] Extension rôle [G] frontend - 2026-07-22.md` (2 occurrences) | 1 | nom en texte | réécrire (même remarque) |
| `gestion-projet/[P] RACI + Roadmap GED237.md` (n° 1) l. 3 | 3 | chemin en code | réécrire dans le fichier renommé |
| n° 7 et n° 14 | eux-mêmes | auto-citation | réécrire dans le fichier renommé |
| `.agents/AGENTS.md` l. 14 | convention | exemple de nom `[P] Nom de la tâche - AAAA-MM-JJ.md` | remplacer par `[Rôle] Nom - AAAA-MM-JJ.md`, comme `AGENTS.md` l. 24 |
| `gestion-projet/innovateur/spec-espaces-filtres-ui.md` l. 5, 132 | 9 | chemin complet en code | réécrire |
| `PASSATION-dev-backend.md` (5 occurrences), `PASSATION-dev-frontend.md` (1), `PASSATION.md` (6), `PASSATION-innovateur.md` (2) | 6, 9, 11, 13, 16 ; 10 ; divers | historique | **ne pas réécrire** (append-only) : chaque session ajoute une entrée « fichiers renommés le JJ/11, voir `renommage-prefixe-proscrit.md` » |

Fichiers 2, 5, 8, 12, 15, 17, 20, 22, 23, 25 : cités nulle part (grep sur le titre sans préfixe) → renommage seul. Fichiers hors `PASSATION*` et hors les 25 qui contiennent encore le préfixe (`grep -rIl`, 10/11) : les 11 du tableau, aucun autre.

## 3. Hors périmètre, à trancher par le PO

- Mentions de l'outil **dans le texte** (pas dans un nom de fichier) : `AGENTS.md` l. 5, 11 (« Tech Lead / QA » attribué à l'outil), `gestion-projet/README.md` l. 27, 34, 67, 80, `EQUIPE_AGENTS.md` l. 58 (« messagerie inter-sessions »), `lessons-learned.md` l. 317, et le titre `[Cursor] Soutien … tâches PERT - 2026-07-22.md`. La règle PO vise « aucune mention de l'IA dans le dépôt » : ces lignes sont à reformuler par rôle dans le même lot ou dans un lot 2 ; la liste ci-dessus est exhaustive pour les six fichiers relus, pas pour tout le dépôt (`grep -rIl` à relancer le jour J).
- Préfixes `[Cursor]` et `[G]` (9 fichiers) : même logique (nom d'outil) ; non comptés dans les 25, décision PO.

## 4. Exécution (après le 19/11, accord PO, par O)

1. Worktree docs depuis `main` à jour ; relancer `git ls-files | grep -F "[P]"` et le grep des citations : le compte doit être 25 et le § 2 inchangé, sinon mettre ce document à jour d'abord.
2. `git mv` fichier par fichier (Git garde l'historique ; Windows : `git mv` gère la casse et les crochets, pas besoin de `mv` séparé).
3. Réécrire les citations du § 2 et les titres H1 / lignes `Agent` du § 1 ; `grep -rIl "[P]"` → 0 hors `PASSATION*.md` (et hors `.git`, `node_modules`, `venv`).
4. Une seule PR docs (`docs: préfixe de rôle sur les walkthroughs`), pre-commit vert, aucune surface CI (`gestion-projet/**` et `**/*.md` ignorés par `appfactory-impact.json`), RAIDER review ; fusion hors chaîne de PR de code.
5. Entrée de passation dans chaque `PASSATION-*.md` concerné (B, F) ; règle de nommage `[Rôle]` consignée dans `AGENTS.md` l. 24 (étape 3) pour qu'aucun nouveau fichier ne reprenne l'ancien préfixe.

Sources : `git ls-files` (25 chemins), `grep -rIl` sur chaque titre, en-têtes des 25 fichiers, `AGENTS.md` l. 5-24, `gestion-projet/README.md` l. 24-34, `.github/appfactory-impact.json` (10/11).
