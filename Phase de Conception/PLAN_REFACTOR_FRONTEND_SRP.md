# Plan de refactor frontend - SRP et réutilisabilité

## Constat
Deux fichiers dépassent 800 lignes et concentrent trop de responsabilités :

1. `frontend/profiles/tenant-admin/pages/gedrules/ClassificationSettingsTab.tsx` - 2011 lignes
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

## Objectif réel du refactor

Ce chantier ne vise pas a "decomposer pour decomposer".

Le but est de :
- reduire le couplage entre orchestration, donnees, actions et rendu
- rendre les sous-flux testables et maintenables
- faciliter la reutilisation des briques UI et des hooks
- conserver strictement le comportement metier existant sauf correction explicite

Ce chantier n'est pas :
- une reecriture fonctionnelle
- une refonte visuelle
- un changement de contrat backend/frontend
- un pretexte pour renommer massivement ou deplacer des concepts sans gain clair

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

## Reutilisation obligatoire avant creation

Avant d'introduire un nouveau composant ou helper, verifier si le besoin est deja couvert.

Briques a reevaluer avant toute creation :
- `frontend/components/ui/DataTable.tsx`
- `frontend/components/ui/StatCard.tsx`
- `frontend/components/ui/MultiCheckSelect.tsx`
- composants de badges/statuts deja presents dans les pages voisines
- helpers de formatage deja presents dans `frontend/types.ts` ou `frontend/utils/`

Regle :
- on cree un nouveau composant seulement si l'existant ne couvre pas le besoin sans forcer un contournement sale
- on n'extrait pas un composant purement local si son seul role est de masquer 10 lignes de JSX sans clarifier le flux

## Cibles de taille
- page orchestratrice : 150 à 250 lignes
- hook métier : 120 à 220 lignes
- section UI : 150 à 300 lignes
- modal formulaire : 80 à 180 lignes
- utilitaires purs : 20 à 120 lignes

Ces cibles sont des repères, pas des objectifs rigides.

Une extraction est valide si elle :
- clarifie une responsabilite
- reduit le couplage
- n'eclate pas artificiellement la lecture

Une extraction est a eviter si elle :
- deplace seulement le bruit sans reduire la complexite
- produit des hooks "god object"
- cree trop de fichiers triviaux mono-usage

## Contrat des hooks

Chaque hook extrait doit documenter explicitement :
- ce qu'il possede comme etat
- ce qu'il expose comme API
- les effets reseau qu'il a le droit d'executer
- ce qu'il ne doit pas faire

### Contrat cible - `useClassificationAdminData`
- possede : les collections de reference (`domains`, `activities`, `rules`, `orgUnits`, `users`, `categories`, `templates`)
- expose : `loading`, `partialFailure`, `reload`
- autorise : chargement initial et rechargement des referentiels
- interdit : creation, update, delete, gestion des modales, gestion du tab actif

### Contrat cible - `useDomainActions`
- possede : etat de soumission du sous-flux domaine
- expose : `createDomain`, `updateDomain`, `deleteDomain`
- autorise : appels API CRUD domaine et normalisation minimale du payload
- interdit : connaissance du rendu global de page et du simulateur

### Contrat cible - `useActivityActions`
- possede : etat de soumission du sous-flux activite
- expose : `createActivity`, `updateActivity`, `deleteActivity`
- autorise : appels API CRUD activite
- interdit : gestion du tab actif, gestion des regles

### Contrat cible - `useRuleActions`
- possede : etat de soumission du sous-flux regle
- expose : `createRule`, `updateRule`, `deleteRule`
- autorise : appels API CRUD regle et mapping du formulaire vers payload
- interdit : chargement des referentiels et rendu du simulateur

### Contrat cible - `useImportReferenceData`
- possede : `categories`, `orgUnits`, `users`, `workflowTemplates`, `loading`, `error`
- expose : `reload`
- autorise : chargement des referentiels necessaires a l'import
- interdit : `analyze`, `commit`, gestion des fichiers selectionnes

### Contrat cible - `useBatchImportState`
- possede : formulaire local, selection de fichiers, `selectionLabel`, `unsupportedCount`
- expose : setters metier, `resetSelection`, `buildAnalyzePayload`
- autorise : validation locale pure et preparation de donnees
- interdit : appels reseau, gestion de la progression backend

### Contrat cible - `useBatchImportExecution`
- possede : `analyzedJob`, `commitResult`, `progress`, `isAnalyzing`, `isCommitting`, `error`
- expose : `analyze`, `commit`, `resetExecution`
- autorise : appels backend d'analyse et de commit
- interdit : acces direct aux refs DOM, rendu de cartes, logique de selection locale

## Invariants a preserver

Le refactor doit conserver les invariants suivants :
- routes frontend inchangées
- contrats API inchanges
- payloads backend inchanges
- libelles metier inchanges sauf correction explicite
- comportement `analyze`, `commit`, `simulate`, `CRUD` identique
- ordre des etapes et priorites metier identiques
- toasts, reset et refresh preserves ou ameliores sans regression
- aucune logique metier de validation perdue lors du deplacement vers les hooks

## Critères d'acceptation

Le refactor n'est considere termine que si :
- `npm run typecheck` est vert
- `npm run lint` est vert
- `npm run build` est vert
- les deux pages restent fonctionnelles de bout en bout
- aucun contrat API n'a change
- aucun comportement metier attendu n'a regresse

## Validation minimale par page

### Validation - `ClassificationSettingsTab.tsx`
- chargement des referentiels OK
- navigation entre tabs OK
- creation/modification/suppression domaine OK
- creation/modification/suppression activite OK
- creation/modification/suppression regle OK
- simulation de classement OK
- toasts, erreurs et reload coherents

### Validation - `DirectoryIngestion.tsx`
- chargement des referentiels OK
- selection dossier/fichiers OK
- validation pre-analyse OK
- analyse batch OK
- affichage preview OK
- commit batch OK
- affichage resultat OK
- reset et relance OK

## Strategie de test recommandee

Minimum obligatoire apres chaque phase :
- verification manuelle ciblee de l'ecran refactorise
- `npm run typecheck`
- `npm run lint`
- `npm run build`

Si possible :
- ajouter ou adapter une spec Playwright ciblee
- au minimum documenter une checklist de non-regression executable

## Anti-patterns a eviter

- extraire un hook qui devient un nouveau composant monolithique cache
- dupliquer les appels API dans plusieurs hooks voisins
- faire porter au composant page des details de mapping payload qui devraient etre encapsules
- multiplier les composants presentationnels vides de sens
- creer des types locaux redondants si `frontend/types.ts` ou l'API typed suffit deja
- deplacer de la logique metier critique dans du JSX "pour faire court"

## Règles de refactor
- un hook pour la donnée
- un hook pour les actions
- un composant pour une zone visuelle cohérente
- pas d'appel API dispersé dans plusieurs branches de rendu
- pas de duplication `toast + refresh + error handling`
- pas de logique métier enfouie dans le JSX

## Ordre d'exécution recommandé
1. refactor `ClassificationSettingsTab.tsx`
2. valider (`typecheck`, `lint`, `build`, smoke test)
3. refactor `DirectoryIngestion.tsx`
4. valider (`typecheck`, `lint`, `build`, smoke test)
