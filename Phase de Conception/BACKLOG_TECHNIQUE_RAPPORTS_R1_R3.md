# Backlog Technique — Rapports & Statistiques — R1 à R3

## 1. Objet

Ce document traduit les sprints produit `R1` à `R3` du module :

- `Rapports & statistiques`

en backlog technique exécutable.

Il complète :

- [PLAN_RAPPORTS_STATISTIQUES_MVP.md](</mnt/e/GED237/Phase de Conception/PLAN_RAPPORTS_STATISTIQUES_MVP.md>)
- [PLAN_RAPPORTS_STATISTIQUES_VERSIONS_SPRINTS.md](</mnt/e/GED237/Phase de Conception/PLAN_RAPPORTS_STATISTIQUES_VERSIONS_SPRINTS.md>)
- [BACKLOG_RAPPORTS_STATISTIQUES.md](</mnt/e/GED237/Phase de Conception/BACKLOG_RAPPORTS_STATISTIQUES.md>)

Le périmètre ici est volontairement limité à :

- `R1` — refonte structurelle du module Reports
- `R2` — onglet `Synthèse`
- `R3` — onglet `Activité documentaire`

---

## 2. Règles de réalisation

- [ ] réutiliser l’existant avant de créer un nouveau composant
- [ ] respecter SRP : orchestration / hooks / view model / présentation séparés
- [ ] éviter tout jargon technique dans l’UI finale
- [ ] ne pas dupliquer les modules `Audit`, `Users`, `Org`, `Classement`, `Spaces`
- [ ] ne pas ajouter de graphe sans vraie donnée backend
- [ ] garder `Reports` comme centre de pilotage et de lecture

---

## 3. État actuel utile

### Frontend déjà en place

- [ ] [ReportsPage.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/ReportsPage.tsx)
- [ ] [useReportsData.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/useReportsData.ts)
- [ ] [useReportsFilters.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/useReportsFilters.ts)
- [ ] [reportsViewModel.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/reportsViewModel.ts)
- [ ] [ReportsFiltersBar.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsFiltersBar.tsx)
- [ ] [ReportsKpiGrid.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsKpiGrid.tsx)
- [ ] [ReportsInsightsPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsInsightsPanel.tsx)
- [ ] [ReportsTableSection.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsTableSection.tsx)
- [ ] [ReportsExportsPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsExportsPanel.tsx)
- [ ] [ReportsTimeseriesPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsTimeseriesPanel.tsx)
- [ ] [reportsExport.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/reportsExport.ts)

### Backend déjà en place

- [ ] [backend/app/api/v1/endpoints/reports.py](/mnt/e/GED237/backend/app/api/v1/endpoints/reports.py)
- [ ] [backend/app/services/reports_service.py](/mnt/e/GED237/backend/app/services/reports_service.py)
- [ ] [backend/app/schemas/reports.py](/mnt/e/GED237/backend/app/schemas/reports.py)

### APIs déjà disponibles

- [ ] `GET /analytics/tenant`
- [ ] `GET /documents/stats`
- [ ] `GET /workflows/stats`
- [ ] `GET /classification-reviews`
- [ ] `GET /reports/evolution`

---

## 4. Sprint R1 — Refonte structurelle du module Reports

## Objectif technique

Stabiliser l’architecture des onglets et faire converger l’existant vers le découpage V1 :

- `Synthèse`
- `Activité documentaire`
- `Workflows & délais`
- `Services`

En parallèle :

- sortir `Évolution` du rôle d’onglet produit autonome
- absorber la logique utile de `Classement` dans `Activité documentaire`
- faire de l’export une action, pas une vue

## Questions métier à figer dans le code et l’UI

- [x] `Synthèse` = `Quelle est la situation générale ?`
- [x] `Activité documentaire` = `Quels documents circulent ?`
- [x] `Workflows & délais` = `Où ça bloque ?`
- [x] `Services` = `Quels services sont chargés ou en retard ?`

## Composants / fichiers à modifier

### Frontend

- [x] [ReportsPage.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/ReportsPage.tsx)
- [x] [ReportsFiltersBar.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsFiltersBar.tsx)
- [x] [reportsViewModel.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/reportsViewModel.ts)
- [x] [ReportsTableSection.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsTableSection.tsx)
- [x] [ReportsExportsPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsExportsPanel.tsx)
- [x] [reportsExport.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/reportsExport.ts)

### Backend

- [ ] aucun nouvel endpoint requis
- [ ] aucun changement de schéma requis

## Composants à créer si nécessaire

- [ ] aucun composant majeur obligatoire
- [ ] éventuel composant léger `ReportsEmptyState.tsx` si les vues vides doivent être harmonisées

## Tâches détaillées

### Architecture

- [x] figer `ReportsViewMode` cible V1
- [x] retirer l’onglet produit autonome `Évolution`
- [ ] décider du sort de `Classement` :
  - [x] vue transitoire maintenue mais rattachée à `Activité documentaire`
  - [ ] ou suppression si redondance immédiate

### Navigation / UX

- [x] rendre les onglets cohérents avec le cadrage produit
- [x] déplacer la logique de courbe dans les vues métier utiles
- [x] conserver une action globale `Exporter`
- [x] préparer l’emplacement futur du bouton `Générer un rapport`
- [x] réserver son contrat UI dès `R1`

### Vocabulaire

- [x] éliminer les derniers libellés trop techniques
- [x] harmoniser `Synthèse`, `Activité documentaire`, `Workflows & délais`, `Services`

## Dépendances

- [ ] aucune dépendance backend bloquante
- [ ] dépend de la validation du découpage produit

## Risques

- [ ] casser la cohérence du tableau détaillé
- [ ] laisser des labels d’anciens modes non gérés
- [ ] conserver des export CSV non cohérents avec les nouvelles vues

## Définition de terminé

- [x] les onglets V1 sont visibles et cohérents
- [x] aucune vue “orpheline” de l’ancien découpage
- [x] la page reste cliquable de bout en bout
- [x] les anciens modes ne hantent plus le view model, les exports ni les CTA
- [x] les filtres globaux fonctionnent sur les onglets où ils sont pertinents
- [x] les états vides sont cohérents
- [x] `npm run typecheck` vert

---

## 5. Sprint R2 — Onglet Synthèse

## Objectif technique

Faire de `Synthèse` une page de décision rapide, alimentée par des agrégats lisibles.

## Données backend nécessaires

### Réutilisables immédiatement

- [x] `GET /analytics/tenant`
- [x] `GET /documents/stats`
- [x] `GET /workflows/stats`
- [x] `GET /classification-reviews`

### Données à consolider côté frontend

- [ ] documents suivis
- [ ] documents à revoir
- [ ] circuits actifs
- [ ] circuits terminés
- [ ] documents en corbeille si utile en contexte V1
- [ ] signaux de retard ou blocage si disponibles de manière fiable
- [ ] marquage des indicateurs estimés si absence de vraie échéance métier

## Fichiers à modifier

### Frontend

- [x] [useReportsData.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/useReportsData.ts)
- [x] [reportsViewModel.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/reportsViewModel.ts)
- [x] [ReportsKpiGrid.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsKpiGrid.tsx)
- [x] [ReportsInsightsPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsInsightsPanel.tsx)
- [x] [ReportsPage.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/ReportsPage.tsx)

### Backend

- [ ] stabiliser les agrégats existants si un champ est trop ambigu
- [ ] documenter explicitement ce qui reste un proxy et ce qui est fiable

## Composants à créer / réutiliser

### Réutiliser

- [ ] [ReportsKpiGrid.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsKpiGrid.tsx)
- [ ] [ReportsInsightsPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsInsightsPanel.tsx)
- [ ] [DataTable.tsx](/mnt/e/GED237/frontend/components/ui/DataTable.tsx)

### Créer si nécessaire

- [ ] `ReportsSummaryAlerts.tsx` si le bloc d’alertes doit devenir autonome

## Tâches détaillées

### KPI

- [x] sélectionner uniquement les KPI critiques
- [x] supprimer les KPI décoratifs
- [x] ajouter les aides contextuelles utiles
- [x] ne pas afficher comme vérité métier un indicateur encore estimé

### Alertes

- [x] définir les `points d’attention` réellement décisionnels
- [x] afficher une formulation métier simple
- [x] ajouter les CTA vers les bons modules quand pertinent

### Détail

- [x] garder un tableau compact et exportable
- [x] aligner les colonnes avec la lecture de synthèse

## Dépendances

- [ ] `R1` terminé

## Risques

- [ ] sur-promettre un indicateur peu fiable
- [ ] noyer `Synthèse` sous des détails qui relèvent d’un autre onglet

## Définition de terminé

- [x] l’admin comprend la situation en moins de 30 secondes
- [x] les KPI ont une lecture claire
- [x] les alertes sont actionnables
- [x] les indicateurs estimés sont marqués `Estimation`
- [x] `npm run typecheck` vert

---

## 6. Sprint R3 — Onglet Activité documentaire

## Objectif technique

Concentrer dans un seul onglet les lectures sur le volume, les types, les statuts, les tendances et la santé documentaire visible.

## Données backend nécessaires

### Déjà disponibles

- [x] `GET /documents/stats`
- [x] `GET /analytics/tenant`
- [x] `GET /classification-reviews`
- [x] `GET /reports/evolution`

### À ouvrir ou enrichir si le besoin dépasse l’existant

- [ ] agrégats par type documentaire
- [ ] agrégats par statut documentaire
- [ ] aperçu léger de répartition par service, sans lecture de performance
- [ ] documents non classés
- [ ] métadonnées incomplètes
- [ ] documents urgents / confidentiels si exposables

## Fichiers à modifier

### Frontend

- [x] [useReportsData.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/useReportsData.ts)
- [x] [useReportsEvolution.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/useReportsEvolution.ts)
- [x] [ReportsTimeseriesPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsTimeseriesPanel.tsx)
- [x] [reportsViewModel.ts](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/reportsViewModel.ts)
- [x] [ReportsTableSection.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsTableSection.tsx)
- [x] [ReportsPage.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/ReportsPage.tsx)

### Backend

- [x] [backend/app/services/reports_service.py](/mnt/e/GED237/backend/app/services/reports_service.py)
- [x] [backend/app/api/v1/endpoints/reports.py](/mnt/e/GED237/backend/app/api/v1/endpoints/reports.py)
- [x] [backend/app/schemas/reports.py](/mnt/e/GED237/backend/app/schemas/reports.py)

## Composants à créer / réutiliser

### Réutiliser

- [x] [ReportsTimeseriesPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsTimeseriesPanel.tsx)
- [x] [ReportsTableSection.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsTableSection.tsx)
- [ ] [ReportsInsightsPanel.tsx](/mnt/e/GED237/frontend/profiles/tenant-admin/pages/reports/ReportsInsightsPanel.tsx)

### Créer si nécessaire

- [x] `ReportsDocumentActivityPanel.tsx` pour regrouper les répartitions et les points de vigilance documentaires
- [ ] `ReportsDocumentHealthPanel.tsx` si la partie non classés / métadonnées incomplètes devient trop riche

## Tâches détaillées

### Tendances

- [x] afficher les tendances documentaires dans cet onglet
- [x] limiter le nombre de séries visibles à celles utiles à l’activité documentaire
- [x] garder un export CSV de la série affichée

### Volumes et répartitions

- [x] documents par type
- [x] documents par statut
- [x] répartition légère par service si la donnée existe

### Santé documentaire

- [x] remonter les documents non classés
- [x] remonter les informations manquantes
- [x] remonter les documents à revoir
- [x] garder un wording métier, pas technique
- [x] éviter de transformer cet onglet en pré-onglet `Qualité documentaire`

### Tableau de détail

- [x] enrichir les familles métier du tableau
- [x] aligner les colonnes avec l’onglet
- [x] conserver tri, filtres, masquage, export

## Dépendances

- [ ] `R1` terminé
- [ ] `R2` idéalement stabilisé
- [ ] endpoint `/reports/evolution` fonctionnel pour les séries documentaires

## Risques

- [ ] pousser trop tôt des graphes sans bonnes agrégations
- [ ] mélanger activité documentaire et conformité avancée
- [ ] dupliquer le futur onglet `Qualité documentaire`

## Définition de terminé

- [x] l’onglet répond clairement à `Quels documents circulent ?`
- [x] les tendances sont lisibles et exportables
- [x] les points de vigilance documentaire sont visibles sans noyer la page
- [x] l’onglet ne duplique ni `Services`, ni `Qualité documentaire`
- [x] `python3 -m compileall backend/app` vert
- [x] `npm run typecheck` vert

---

## 7. Ordre recommandé de réalisation

1. [x] Finaliser `R1`
2. [x] Finaliser `R2`
3. [x] Enrichir le backend minimal nécessaire pour `R3`
4. [x] Finaliser `R3`

---

## 8. Critères globaux de done R1 à R3

- [x] le menu `Rapports & statistiques` est cohérent avec le reste du tenant
- [x] les onglets `Synthèse` et `Activité documentaire` sont compréhensibles sans formation technique
- [x] aucun onglet ne duplique un autre menu spécialisé
- [x] les composants restent SRP et réutilisables
- [x] les données affichées sont traçables à une source backend claire
- [x] chaque indicateur a une source backend claire ou est explicitement marqué comme estimation
- [x] les exports fonctionnent dans les vues traitées
- [x] `npm run typecheck` reste vert
- [x] les vérifications backend restent vertes
