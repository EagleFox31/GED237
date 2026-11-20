# Noms d'outils d'assistance dans les fichiers suivis : relevé pour le PO (19/11)

Question ouverte du PO, présentée par O après la coupe. Relevé en lecture seule sur `main` = f890b3cb, rien n'est modifié.

**Les noms sont masqués dans cette note**, parce que le contrôle des mots interdits du dépôt refuserait de l'enregistrer :
- ‹M1› est le nom de l'outil du contre-testeur ;
- ‹M2› est le nom de l'outil des sessions ;
- ‹M3› est le nom de l'éditeur de ‹M2›.
O a la clé dans son message.

**Méthode** : on cherche le nom de fichier (‹M1› ou ‹M2›) et le contenu (‹M1›, ‹M3›, la ligne de co-auteur ‹M2›, « generated with »). le dossier de configuration des sessions et leur fichier de consignes à la racine sont exclus, comme demandé (fichiers voulus). Résultat : **56 fichiers**. Aucun ne contient de ligne de co-auteur ni de « generated with ». La colonne « Depuis » donne le premier commit qui ajoute le fichier à `main`.

## 1. Le nom est dans le nom du fichier (37)

| Fichiers | Depuis | Proposition |
|---|---|---|
| 15 comptes rendus `gestion-projet/walkthrough/[‹M2›] …` et 8 `walkthrough/[‹M2›] …` (racine), sans mention dans le texte | cff933ff (28/10) pour les plus anciens, puis un commit par lot jusqu'au 09/11 | **Renommer** avec un préfixe de rôle (`[Dev-backend]`, `[Q]`, etc.), comme les comptes rendus récents |
| 3 comptes rendus `gestion-projet/walkthrough/[‹M1›] …` (Préparation Phase 2, Intégration Nouvelles Fonctionnalités, Analyse projet et recherche du 27/10) | cff933ff (28/10) | **Renommer** en `[Contre-testeur]`, et **réécrire** les 5 à 7 mentions du texte |
| `gestion-projet/[‹M1›] BACKLOG_V2_EVOLUTIONS.md`, `… Dataset_Rapports_Statistiques.md`, `… Matrice_Tracabilite_Preparation_Lundi.md`, `… UAT_Filtres_Espaces.md` | 93805b2d (28/10) | **Renommer** sans préfixe, et **réécrire** la mention d'auteur |
| `gestion-projet/[‹M2›] RACI + Roadmap GED237.md` (10 mentions de ‹M1›) | 93805b2d (28/10) | **Renommer** et **réécrire** les rôles en noms de rôle |
| `gestion-projet/PROPOSITIONS_EVOLUTION_‹M1›.md`, `gestion-projet/plan-‹m1›.md` | 93805b2d (28/10) | **Renommer** (`PROPOSITIONS_EVOLUTION.md`, `plan-contre-testeur.md`) |
| `[Cursor] Extension rôle ‹M1› frontend` (12 mentions), `[Cursor] Soutien ‹M2› tâches PERT` | cff933ff (28/10) | **Renommer** et **réécrire** |
| `gestion-projet/walkthrough/[‹M2›] Regle coordination et verrou walkthrough` (2 mentions) | cff933ff (28/10) | **Renommer** et **réécrire** |
| `‹M1›.md` (racine, 162 lignes : règles de travail de l'outil du contre-testeur) | 0fff4224 (27/04) | **Laisser** : c'est un fichier de configuration voulu, comme le fichier de consignes des sessions |

## 2. Le nom est seulement dans le contenu (19)

| Fichier | Depuis | Proposition |
|---|---|---|
| `AGENTS.md`, `.agents/AGENTS.md` : convention `[Cursor\|‹M2›\|‹M1›] Nom - date.md` | cff933ff (28/10) | **Réécrire** : préfixe de rôle |
| `gestion-projet/README.md` (5), `gestion-projet/REGLES_DE_TRAVAIL.md` (2) : rôles de l'équipe de juillet | 93805b2d (28/10) | **Réécrire** en rôles (PO, sessions, contre-testeur) |
| `PLAN_EXECUTION_GED237_2026-07-22.md` (42), `PERT_EXECUTION_GED237_2026-07-22.md` (14), `DECISION_OTP_…`, `INVENTAIRE_TESTS_API_…`, `MATRICE_UAT_E2E_…` (1 chacun) | 93805b2d (28/10) | **Laisser** : plans datés de juillet, archivés. Sinon, réécrire en rôles si le PO veut zéro mention |
| `frontend/e2e/specs/uat/spaces-filters.spec.ts` : commentaire de source | 12cc6260 (09/11) | **Réécrire** en même temps que le renommage de `UAT_Filtres_Espaces.md` |
| `gestion-projet/walkthrough/[Audit] Audit fonctionnel profond - 2026-11-09.md` : cite un fichier local non suivi | 442d6d34 (09/11) | **Réécrire** (« fichier local du contre-testeur ») |
| `gestion-projet/walkthrough/[Cursor] Préparation T07…` (2), `[Cursor] Règle de suivi Walkthrough` (3) | cff933ff (28/10) | **Réécrire** |
| `PASSATION.md` (11, dont la variable `‹M1›_API_KEY` retirée par #21), `PASSATION-dev-backend.md` (1) | b19dd2d1 (29/10), 59866bd7 (09/11) | **Laisser** : fichiers en ajout seulement, jamais réécrits. Une nouvelle entrée peut l'expliquer |
| `gestion-projet/EQUIPE_AGENTS.md` (sources citées), `innovateur/sources/‹m3›-agents.md` (adresses des articles), `innovateur/sources/github-agents-skills.md` (noms de dépôts publics), `innovateur/README.md` (lien) | 97ad021f (09/11) | **Laisser** : références techniques sourcées |

## 3. Ce qu'il faut savoir avant de décider

- **Les liens.** 41 fichiers de `main` citent ces chemins. Les renommages et les liens partent donc dans une seule PR de docs, avec une vérification des liens. C'est environ 1 h-s, en V1.1.
- **L'historique ne change pas.** Renommer ne retire pas les noms des anciens commits. Les effacer demanderait une réécriture de l'historique, que les règles du dépôt interdisent.
- **Hors périmètre** : les fichiers locaux non suivis du contre-testeur dans le dossier partagé. Ils ne sont pas sur `main`.
- **Recommandation** : renommer et réécrire les documents vivants (§ 1, et les lignes « Réécrire » du § 2). Laisser la configuration, les passations, les plans datés de juillet et les sources citées.
