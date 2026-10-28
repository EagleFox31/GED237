# Préparation pour le Lundi 27 Juillet 2026

L'objectif est de clôturer les trois points noirs relevés dans notre dernier audit pour être totalement prêt et propre pour lundi.

## Synthèse du Plan

Ce plan d'action vise à résoudre la dette technique immédiate remontée par l'audit.

---

## 1. Backend - Filtres Espaces Documentaires

Implémentation du contrat d'API attendu pour les vues d'espaces avec l'ajout des filtres côté serveur pour alléger le frontend.

**Actions prévues :**
- **Modification de `backend/app/api/v1/endpoints/documents.py`** : Modifier `list_workspace_documents` pour accepter les paramètres `scope`, `domain_id`, `activity_id`, `year`, `status` et `q`.
- Ajout des clauses SQL correspondantes (ex: `query = query.where(Document.classification_scope == scope)`).
- **Modification de `backend/app/api/v1/endpoints/spaces.py`** : Mise à jour de la route `GET /documents` (méthode `list_space_documents`) pour exposer ces nouveaux paramètres de requête et les transférer à `list_workspace_documents`.

---

## 2. Backend - Couverture de Tests

Correction du manque de tests pour le nouveau module de statistiques et rapports.

**Actions prévues :**
- **Création de `backend/tests/api/test_reports.py`** : Création du fichier pour tester les 4 routes principales (`/evolution`, `/document-activity`, `/workflow-activity`, `/service-activity`).
- Vérification du code de statut HTTP 200 avec le client administrateur et de la structure de réponse.

---

## 3. Frontend - Build & Nettoyage

Suppression du warning lors du build de l'application React.

**Actions prévues :**
- **Modification de `frontend/index.html`** : Retrait de la balise morte `<link rel="stylesheet" href="/index.css">` qui provoquait une erreur Rollup/Vite, sachant que le projet utilise Tailwind via CDN ou plugins intégrés.

---

## Plan de Vérification

- **Backend** : Exécution de `pytest backend/tests/api/test_reports.py` pour valider que les tests passent ou au moins qu'ils ne contiennent pas d'erreurs de syntaxe.
- **Frontend** : Lancement de `npm run build` dans le frontend pour s'assurer que le warning sur `index.css` a bien disparu.
