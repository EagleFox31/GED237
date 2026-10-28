# [Gemini] Préparation UAT, Dataset et Matrice de Traçabilité

**Statut :** DONE

## 1. Ce que je vais faire
Je vais réaliser les trois actions Produit définies dans le RACI pour préparer le travail de développement de Claude :
1.  **Préparer les scénarios d'UAT** pour l'ajout des filtres manquants sur `spaces/documents`.
2.  **Créer un jeu de données étalon** pour le futur module de Rapports et Statistiques.
3.  **Construire la Matrice de Traçabilité** reliant ces exigences métier aux tests et aux routes de l'API.

## 2. Comment je vais le faire
Je vais créer trois fichiers distincts dans le dossier `gestion-projet/` :
- `[Gemini] UAT_Filtres_Espaces.md`
- `[Gemini] Dataset_Rapports_Statistiques.md`
- `[Gemini] Matrice_Tracabilite_Preparation_Lundi.md`

Chaque fichier contiendra les détails structurés pour être directement consommables par Claude (le Tech Lead) et vérifiables par Cursor (le PO).

## 3. Résultat attendu
Trois documents Markdown clairs et concis qui encadrent les critères d'acceptation du travail à réaliser pour lundi. Une fois les documents générés, je mettrai à jour ce fichier pour indiquer la complétion et fournir un résumé.

---

## Mises à jour de fin de tâche
**Ce que j'ai trouvé :**
En tant que Product Analyst, j'ai identifié le besoin de lier formellement les constats de l'audit technique aux livrables attendus par Claude.

**Ce que j'ai modifié et comment :**
1. J'ai ajouté la règle de gouvernance requise dans `.agents/AGENTS.md`.
2. J'ai créé les trois fichiers dans `gestion-projet/` avec les outils d'écriture de fichiers :
   - `[Gemini] UAT_Filtres_Espaces.md` (3 scénarios d'usage)
   - `[Gemini] Dataset_Rapports_Statistiques.md` (Structure de données déterministe)
   - `[Gemini] Matrice_Tracabilite_Preparation_Lundi.md` (Liaison Exigence ↔ Fichier ↔ Test)

**Ce que ça donne maintenant :**
Le cadre "Produit" est totalement défini et verrouillé. Claude (le Tech Lead) sait exactement ce qu'il doit coder et sur quels critères ses modifications seront évaluées. Le PO (vous) a une vue claire de la couverture des besoins.

**Tests pour le prouver :**
- Les fichiers sont physiquement présents dans le répertoire `gestion-projet/`.
- La matrice de traçabilité identifie clairement le statut "🔴 À coder" ou "🔴 À corriger" que Claude devra passer en vert avec ses preuves de tests (`pytest` et `npm run build`).
