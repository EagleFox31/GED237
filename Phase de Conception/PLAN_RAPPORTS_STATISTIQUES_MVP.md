# Plan MVP - Rapports & Statistiques

## Objectif

Construire une page `Rapports & statistiques` orientée pilotage metier, coherente avec l'existant, sans tomber dans une BI generique ni dans un doublon d'`Audit & tracabilite`.

La page doit repondre a trois questions :

- Que s'est-il passe ?
- Ou cela bloque-t-il ?
- Qu'est-ce que je peux exporter ou presenter ?

## Cadrage UX

- [ ] Garder la meme grammaire visuelle que `Explorateur documentaire`, `Import en masse`, `Audit & tracabilite` et `Tableau de bord`
- [ ] Utiliser un vocabulaire metier et administratif
- [ ] Limiter la synthese a 4-6 KPI utiles
- [ ] Faire des filtres globaux un premier bloc de travail
- [ ] Faire du tableau detaille la zone centrale exploitable
- [ ] Eviter les graphiques decoratifs sans action
- [ ] Eviter de melanger reporting, audit et monitoring technique

## Structure cible de la page

- [ ] En-tete sobre : `Rapports & statistiques`
- [ ] Barre de filtres globale
- [ ] Bloc `Vue d'ensemble`
- [ ] Bloc `Points d'attention`
- [ ] Bloc `Detail` avec tableau exploitable
- [ ] Bloc `Exports`
- [ ] Ajouter ensuite `Evolution` si le MVP est stable

## Composants a creer / reutiliser

### A creer

- [ ] `frontend/profiles/tenant-admin/pages/ReportsPage.tsx`
- [ ] `frontend/profiles/tenant-admin/pages/reports/useReportsData.ts`
- [ ] `frontend/profiles/tenant-admin/pages/reports/useReportsFilters.ts`
- [ ] `frontend/profiles/tenant-admin/pages/reports/ReportsFiltersBar.tsx`
- [ ] `frontend/profiles/tenant-admin/pages/reports/ReportsKpiGrid.tsx`
- [ ] `frontend/profiles/tenant-admin/pages/reports/ReportsInsightsPanel.tsx`
- [ ] `frontend/profiles/tenant-admin/pages/reports/ReportsTableSection.tsx`
- [ ] `frontend/profiles/tenant-admin/pages/reports/reportsViewModel.ts`

### A reutiliser

- [ ] `frontend/components/ui/DataTable.tsx`
- [ ] les patterns KPI de `frontend/profiles/tenant-admin/pages/OrgDashboard.tsx`
- [ ] les patterns de tableau filtrable de `frontend/profiles/auditor/pages/AuditLogs.tsx`
- [ ] les tooltips de `frontend/components/ui/Tooltip.tsx`
- [ ] la modale de confirmation reexportable si un export engageant l'exige

## Donnees backend necessaires

### Disponibles deja pour un MVP

- [ ] `GET /analytics/tenant`
- [ ] `GET /documents/stats`
- [ ] `GET /workflows/stats`
- [ ] `GET /classification-reviews`
- [ ] `GET /audit/logs` pour lectures complementaires si besoin

### Manquantes pour une V2 plus riche

- [ ] series temporelles par periode
- [ ] regroupements par unite / domaine / activite / utilisateur
- [ ] top anomalies sur les regles et les imports
- [ ] export serveur du rapport courant
- [ ] liste ou historique d'imports consolidee

## Bloc Evolution - contrat backend cible

Le bloc `Evolution` ne doit pas etre code sur des donnees artificielles. Il doit reposer sur un contrat backend stable, explicite et reutilisable.

### Ce qui existe deja reellement

- [ ] `GET /analytics/tenant`
  - compteurs globaux utilisateur / documents / stockage / workflows
  - pas de serie temporelle
- [ ] `GET /documents/stats`
  - total des documents
  - total en corbeille
  - repartition par statut documentaire
  - pas de regroupement par periode
- [ ] `GET /workflows/stats`
  - etapes en cours
  - etapes terminees
  - pas de repartition par periode ni par unite
- [ ] `GET /classification-reviews`
  - liste des revues ouvertes
  - exploitable pour des compteurs courants
  - pas de synthese temporelle native

### Ce qui manque pour un vrai bloc Evolution

- [ ] volume de documents crees par jour / semaine / mois
- [ ] volume de documents classes automatiquement par jour / semaine / mois
- [ ] volume de documents a revoir par jour / semaine / mois
- [ ] volume d imports en masse lances / finalises / bloques par jour / semaine / mois
- [ ] volume de circuits lances / termines / rejetes par jour / semaine / mois
- [ ] possibilite de filtrer ces series par unite, domaine, activite, type de document

### Endpoint backend recommande

- [ ] `GET /reports/timeseries`

Parametres minimaux :

- [ ] `period=day|week|month`
- [ ] `date_from=YYYY-MM-DD`
- [ ] `date_to=YYYY-MM-DD`
- [ ] `org_unit_id` optionnel
- [ ] `domain_id` optionnel
- [ ] `activity_id` optionnel
- [ ] `document_category_id` optionnel

Reponse minimale recommandee :

```json
{
  "period": "month",
  "date_from": "2026-01-01",
  "date_to": "2026-05-31",
  "series": {
    "documents_created": [
      { "bucket": "2026-01", "value": 120 },
      { "bucket": "2026-02", "value": 98 }
    ],
    "documents_auto_classified": [
      { "bucket": "2026-01", "value": 84 },
      { "bucket": "2026-02", "value": 71 }
    ],
    "documents_needing_review": [
      { "bucket": "2026-01", "value": 14 },
      { "bucket": "2026-02", "value": 22 }
    ],
    "imports_completed": [
      { "bucket": "2026-01", "value": 9 },
      { "bucket": "2026-02", "value": 11 }
    ],
    "workflow_steps_completed": [
      { "bucket": "2026-01", "value": 45 },
      { "bucket": "2026-02", "value": 53 }
    ]
  }
}
```

### Regles de conception backend

- [ ] la serie doit etre agregee cote serveur, pas reconstruite cote frontend
- [ ] les buckets vides doivent etre retournes avec `value = 0`
- [ ] le meme endpoint doit servir la page `Rapports & statistiques` et toute future exportation consolidee
- [ ] les noms des series doivent rester metier et stables
- [ ] la periode doit etre definie explicitement par le backend pour eviter les divergences de bucketisation

### Regles de conception frontend

- [ ] ne pas afficher le bloc `Evolution` tant que l endpoint n existe pas
- [ ] prevoir un composant reutilisable `ReportsTimeseriesPanel.tsx`
- [ ] permettre de changer la lecture :
  - [ ] `Documents`
  - [ ] `Classement`
  - [ ] `Imports`
  - [ ] `Circuits`
- [ ] limiter la premiere version a 1 graphe principal + 1 selecteur de serie
- [ ] reutiliser les memes filtres globaux que le reste de la page

### Ordre d implementation recommande pour Evolution

- [ ] Etape 1 : ouvrir `GET /reports/timeseries` avec `documents_created` uniquement
- [ ] Etape 2 : ajouter `documents_auto_classified` et `documents_needing_review`
- [ ] Etape 3 : ajouter `imports_completed`
- [ ] Etape 4 : ajouter `workflow_steps_completed` et `workflow_steps_rejected`
- [ ] Etape 5 : brancher le composant frontend `ReportsTimeseriesPanel.tsx`
- [ ] Etape 6 : ajouter export CSV des series visibles

### Critere d acceptation du bloc Evolution

- [ ] les courbes sont fondees sur des donnees backend reelles
- [ ] les buckets sont coherents avec la periode choisie
- [ ] les filtres globaux influencent les series
- [ ] aucune courbe n apparait si la donnee n existe pas encore
- [ ] `typecheck` frontend et verification backend passent apres integration

## Contrat MVP retenu

Pour ne pas bloquer l'implementation :

- [ ] agreger `analytics tenant + document stats + workflow stats + revues ouvertes`
- [ ] construire un tableau detaille de synthese a partir de ces donnees
- [ ] afficher clairement les limites de perimetre si une donnee fine n'est pas encore disponible

## Ordre d'implementation

### Etape 1 - Page et routage

- [ ] Ajouter la route `/reports`
- [ ] Brancher le menu `Rapports & statistiques`
- [ ] Remplacer le placeholder par une vraie page

### Etape 2 - Filtres globaux

- [ ] Ajouter les filtres MVP utiles et honnetes :
- [ ] periode
- [ ] mode de lecture / vue
- [ ] source de donnees si necessaire
- [ ] bouton `Actualiser`
- [ ] bouton `Exporter`

### Etape 3 - KPI de synthese

- [ ] Documents total
- [ ] Documents en corbeille
- [ ] Etapes de workflow actives
- [ ] Etapes de workflow completees
- [ ] Revues de classement ouvertes
- [ ] Taux simple de classement automatique si calcul fiable, sinon ne pas l'afficher

### Etape 4 - Points d'attention

- [ ] Revues ouvertes
- [ ] Documents en attente / a revoir
- [ ] charge workflow active
- [ ] message explicite si aucune alerte

### Etape 5 - Tableau detaille

- [ ] Reutiliser `DataTable`
- [ ] Tri
- [ ] Filtres colonne
- [ ] Masquage de colonnes
- [ ] Export du tableau courant

### Etape 6 - Finitions

- [ ] empty states
- [ ] loading states
- [ ] erreurs propres
- [ ] wording metier
- [ ] verifications typecheck

## Regles de conception SRP / reutilisabilite

- [ ] `ReportsPage` orchestre, mais ne mappe pas les donnees inline
- [ ] les hooks portent la logique de chargement et de filtres
- [ ] les composants restent presentationnels
- [ ] le mapping backend -> view model reste dans `reportsViewModel.ts`
- [ ] chaque section doit etre testable isolee

## Risques a surveiller

- [ ] effet cockpit avec trop de KPI
- [ ] confusion avec `Audit & tracabilite`
- [ ] filtres qui n'agissent pas partout
- [ ] promesse de precision superieure aux donnees vraiment disponibles
- [ ] tableau trop pauvre ou au contraire trop technique

## Critere d'acceptation MVP

- [ ] la route `/reports` affiche une vraie page metier
- [ ] le menu y mene correctement
- [ ] les KPI se chargent depuis les APIs existantes
- [ ] le tableau detaille est triable et exportable
- [ ] le wording est coherent avec le reste de la GED
- [ ] `cd frontend && npm run typecheck` passe
