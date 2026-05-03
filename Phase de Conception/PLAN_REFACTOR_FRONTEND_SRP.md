# Plan de refactor frontend - SRP et réutilisabilité

## Constat
Deux fichiers dépassent 800 lignes et concentrent trop de responsabilités :

1. `frontend/profiles/tenant-admin/pages/gedrules/ClassificationSettingsTab.tsx` - 1802 lignes
2. `frontend/profiles/tenant-admin/pages/DirectoryIngestion.tsx` - 1010 lignes

Ces deux composants mélangent :
- orchestration de page
- appels API
- gestion d'état local complexe
- validation métier
- rendu UI massif
- sous-flux métier distincts

## Priorité de refactor

1. `ClassificationSettingsTab.tsx`
2. `DirectoryIngestion.tsx`

## Diagnostic par fichier

### 1. ClassificationSettingsTab.tsx
Responsabilités actuellement mélangées :
- chargement des référentiels : domaines, activités, règles, unités, utilisateurs, catégories, templates
- gestion des tabs
- gestion CRUD des domaines
- gestion CRUD des activités
- gestion CRUD des règles
- simulateur de classement
- formulaires et modales
- toasts et gestion de statut `working`

Problèmes SRP :
- un seul composant gère plusieurs sous-produits métier
- plusieurs formulaires indépendants partagent le même conteneur et les mêmes effets
- les handlers CRUD sont dupliqués et couplés au rendu

Problèmes de réutilisabilité :
- logique `modal + form + submit + refresh + toast` répétée
- mappings et helpers dans le même fichier que le rendu principal
- sections UI impossibles à réutiliser ailleurs sans extraire tout le composant

### 2. DirectoryIngestion.tsx
Responsabilités actuellement mélangées :
- chargement des référentiels import
- sélection locale de fichiers/dossiers
- validation avant analyse
- exécution `analyze`
- exécution `commit`
- calcul des résumés de preview
- rendu des blocs de sélection, contexte, preview, exécution et résultat

Problèmes SRP :
- la page est à la fois formulaire, orchestrateur batch, tableau de preview et écran de restitution
- la logique d'exécution batch est couplée directement au JSX

Problèmes de réutilisabilité :
- cartes, badges, tableaux et helpers métier restent internes au fichier
- aucun hook dédié pour les références ou l'exécution batch

## Plan de découpage concret

### A. ClassificationSettingsTab
Objectif : garder un shell de page léger et déplacer la logique par sous-module.

#### Hooks à extraire
- `useClassificationAdminData`
  - charge `domains`, `activities`, `rules`, `orgUnits`, `users`, `categories`, `templates`
  - expose `loading`, `reload`, `partialFailure`
- `useDomainActions`
- `useActivityActions`
- `useRuleActions`

#### Composants à extraire
- `ClassificationAdminTabs`
- `DomainsAdminSection`
- `ActivitiesAdminSection`
- `RulesAdminSection`
- `ClassificationSimulatorSection`
- `DomainFormModal`
- `ActivityFormModal`
- `RuleFormModal`
- `ClassificationAdminToast`

#### Utilitaires à extraire
- `slugifyCode`
- `formatScope`
- `formatYearStrategy`
- `TAB_META`
- `TAB_ORDER`
- `STATUS_STYLES`

#### Séquence de refactor recommandée
1. extraire constantes et helpers purs
2. extraire `useClassificationAdminData`
3. extraire `DomainsAdminSection`
4. extraire `ActivitiesAdminSection`
5. extraire `RulesAdminSection`
6. extraire `ClassificationSimulatorSection`
7. réduire le composant principal à l'orchestration des sections

### B. DirectoryIngestion
Objectif : séparer clairement sélection, contexte, analyse, commit et restitution.

#### Hooks à extraire
- `useImportReferenceData`
  - charge `categories`, `orgUnits`, `users`, `workflowTemplates`
- `useBatchImportState`
  - gère le formulaire et la sélection locale
- `useBatchImportExecution`
  - gère `analyzedJob`, `commitResult`, `progress`, `isAnalyzing`, `isCommitting`, `error`

#### Composants à extraire
- `LocalSelectionCard`
- `ImportContextCard`
- `BatchProgressCard`
- `ImportPreviewCard`
- `PreviewItemsTable`
- `ImportExecutionCard`
- `ImportResultCard`
- `SupportedFormatsCard`
- `ImportStatusBadge`
- `ImportSummaryCards`

#### Utilitaires à extraire
- `getFileExtension`
- `isSupportedFile`
- `formatDetectedType`
- `validateBeforeAnalyze`
- `getItemCategoryName`
- `getItemWorkflowLabel`
- `getItemTargetLabel`
- calculs de `previewCounts`

#### Séquence de refactor recommandée
1. extraire `SummaryCard`, badges et constantes de statuts
2. extraire `useImportReferenceData`
3. extraire `useBatchImportExecution`
4. extraire `LocalSelectionCard`
5. extraire `ImportContextCard`
6. extraire `ImportPreviewCard`
7. extraire `ImportExecutionCard` et `ImportResultCard`

## Arborescence cible conseillée

### Pour ClassificationSettingsTab
- `frontend/profiles/tenant-admin/pages/gedrules/components/`
- `frontend/profiles/tenant-admin/pages/gedrules/hooks/`
- `frontend/profiles/tenant-admin/pages/gedrules/utils/`
- `frontend/profiles/tenant-admin/pages/gedrules/types/`

### Pour DirectoryIngestion
- `frontend/profiles/tenant-admin/pages/ingestion/components/`
- `frontend/profiles/tenant-admin/pages/ingestion/hooks/`
- `frontend/profiles/tenant-admin/pages/ingestion/utils/`
- `frontend/profiles/tenant-admin/pages/ingestion/types/`

## Cibles de taille
- page orchestratrice : 150 à 250 lignes
- hook métier : 120 à 220 lignes
- section UI : 150 à 300 lignes
- modal formulaire : 80 à 180 lignes
- utilitaires purs : 20 à 120 lignes

## Règles de refactor
- un hook pour la donnée
- un hook pour les actions
- un composant pour une zone visuelle cohérente
- pas d'appel API dispersé dans plusieurs branches de rendu
- pas de duplication `toast + refresh + error handling`
- pas de logique métier enfouie dans le JSX

## Ordre d'exécution recommandé
1. refactor `ClassificationSettingsTab.tsx`
2. stabiliser et valider
3. refactor `DirectoryIngestion.tsx`
4. stabiliser et valider
