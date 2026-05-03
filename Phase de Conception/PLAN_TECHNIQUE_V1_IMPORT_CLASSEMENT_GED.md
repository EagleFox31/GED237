# Plan Technique V1 — Import, Classement et Espaces Documentaires

> Note de coherence au 2026-04-30 : ce document reste un plan de conception. L'etat reel du depot est audite dans `AUDIT.md`. Plusieurs briques V1 sont deja implementees, avec quelques ecarts de contrat documentes ci-dessous.

## 1. But

Mettre en place dans GED237 une V1 capable de :

- importer manuellement un dossier local ou plusieurs fichiers depuis le navigateur
- stocker les fichiers sur le serveur central
- appliquer des règles de classement documentaire
- ranger chaque document dans un espace logique par :
  - propriétaire organisationnel
  - domaine
  - activité
  - année
- déclencher le workflow si le document est suffisamment classifié
- envoyer en revue manuelle les cas ambigus

Cette V1 reste 100% web :

- pas d'agent desktop
- pas de surveillance automatique de dossiers
- pas de synchronisation bidirectionnelle local/serveur

---

## 2. Base Existante à Réutiliser

### Backend déjà présent

- `documents`
- `document_versions`
- `document_categories`
- `org_units`
- `users`
- `workflow_templates`
- `routing_rules`
- `ApplyRoutingRulesToDocumentUseCase`
- stockage local/S3 via `app/services/storage`
- import batch actuel via `DirectoryIngestion.tsx` et `POST /documents/upload`

### Frontend déjà présent

- [DirectoryIngestion.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/DirectoryIngestion.tsx>)
- [SpacesPage.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/SpacesPage.tsx>)
- [OrganizationPage.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/OrganizationPage.tsx>)
- [RulesTab.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/gedrules/RulesTab.tsx>)
- [SimulatorTab.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/gedrules/SimulatorTab.tsx>)

### Limites actuelles

- un import batch cible un seul `org_unit_id`
- une seule catégorie documentaire peut être imposée au batch
- pas de moteur de classement documentaire séparé du routage workflow
- pas de notion explicite de `domaine`, `activité`, `année`, `scope de classement`
- `spaces` affiche des documents d'un service, mais pas encore une arborescence logique métier

---

## 3. Principe d'Architecture V1

### Choix retenu

- les fichiers sont envoyés au serveur central
- le stockage physique reste technique et stable
- le rangement métier est représenté en base comme un chemin logique

### Conséquence importante

En V1, on ne doit pas faire dépendre le stockage physique du rangement métier final.

Stockage physique :

- stable
- opaque
- optimisé pour duplication, sauvegarde, sécurité

Rangement logique :

- visible dans l'application
- filtrable
- modifiable par revue manuelle

Exemple :

- `file_path` physique : `tenant/org_unit/filename`
- `logical_space_path` : `Service de l'Infrastructure / Marchés / Réparation / 2026`

---

## 4. Modèle de Données — Table par Table

## 4.1 Table existante `documents` à enrichir

Fichier :

- [document.py](</E:/GED237/backend/app/models/document.py>)

Colonnes à ajouter :

- `classification_domain_id UUID NULL`
- `classification_activity_id UUID NULL`
- `classification_year INTEGER NULL`
- `classification_scope VARCHAR(30) NOT NULL DEFAULT 'service'`
  - valeurs : `person`, `service`, `subdirectorate`, `directorate`
- `classification_target_org_unit_id UUID NULL`
- `classification_target_user_id UUID NULL`
- `classification_status VARCHAR(30) NOT NULL DEFAULT 'pending'`
  - valeurs : `pending`, `classified`, `needs_review`, `rejected`
- `logical_space_path VARCHAR(1000) NULL`
- `import_job_id UUID NULL`
- `source_relative_path VARCHAR(1000) NULL`

Contraintes / index :

- index `(tenant_id, classification_status)`
- index `(tenant_id, classification_target_org_unit_id, classification_year)`
- index `(tenant_id, classification_domain_id, classification_activity_id)`
- check : un seul target principal selon `classification_scope`

Pourquoi dans `documents` et pas seulement dans `extra_data` :

- filtres rapides dans `spaces`
- audit et revue plus simples
- requêtes SQL stables
- pas de logique fragile dans du JSONB

## 4.2 Nouvelle table `classification_domains`

Fichier à créer :

- `backend/app/models/classification_domain.py`

Champs :

- `id`
- `tenant_id`
- `code`
- `name`
- `description`
- `is_active`
- `created_at`
- `updated_at`

But :

- liste des domaines documentaires métier
- ex. `marches`, `rh`, `missions`, `projets`, `maintenance`

## 4.3 Nouvelle table `classification_activities`

Fichier à créer :

- `backend/app/models/classification_activity.py`

Champs :

- `id`
- `tenant_id`
- `domain_id`
- `code`
- `name`
- `description`
- `is_active`
- `created_at`
- `updated_at`

But :

- activités rattachées à un domaine
- ex. `reparation`, `deploiement`, `formation`, `recrutement`

## 4.4 Nouvelle table `classification_rules`

Fichier à créer :

- `backend/app/models/classification_rule.py`

Champs :

- `id`
- `tenant_id`
- `code`
- `name`
- `description`
- `priority`
- `is_active`
- `source_scope VARCHAR(30)`
  - `person`, `service`, `subdirectorate`
- `source_org_unit_id UUID NULL`
- `source_user_id UUID NULL`
- `document_category_id UUID NULL`
- `filename_pattern VARCHAR(255) NULL`
- `mime_type_pattern VARCHAR(100) NULL`
- `target_scope VARCHAR(30) NOT NULL`
- `target_org_unit_id UUID NULL`
- `target_user_id UUID NULL`
- `domain_id UUID NULL`
- `activity_id UUID NULL`
- `year_strategy VARCHAR(20) NOT NULL DEFAULT 'current'`
  - `current`, `from_filename`, `from_metadata`, `fixed`
- `fixed_year INTEGER NULL`
- `workflow_template_id UUID NULL`
- `created_at`
- `updated_at`

But :

- séparer clairement le classement documentaire du routage GEDRules
- une règle de classement peut ensuite pointer vers un workflow

## 4.5 Nouvelle table `import_jobs`

Fichier à créer :

- `backend/app/models/import_job.py`

Champs :

- `id`
- `tenant_id`
- `created_by_id`
- `source_scope`
- `target_org_unit_id UUID NULL`
- `target_user_id UUID NULL`
- `default_document_category_id UUID NULL`
- `processing_mode VARCHAR(20)`
- `status VARCHAR(30)`
  - `draft`, `analyzed`, `running`, `completed`, `completed_with_errors`, `cancelled`
- `total_files`
- `supported_files`
- `ignored_files`
- `duplicate_files`
- `error_files`
- `created_at`
- `updated_at`

But :

- suivre l'import comme un vrai batch métier

## 4.6 Nouvelle table `import_job_items`

Fichier à créer :

- `backend/app/models/import_job_item.py`

Champs :

- `id`
- `import_job_id`
- `original_filename`
- `source_relative_path`
- `mime_type`
- `file_size`
- `checksum_sha256`
- `detected_document_category_id UUID NULL`
- `resolved_domain_id UUID NULL`
- `resolved_activity_id UUID NULL`
- `resolved_year INTEGER NULL`
- `resolved_scope VARCHAR(30) NULL`
- `resolved_target_org_unit_id UUID NULL`
- `resolved_target_user_id UUID NULL`
- `workflow_template_id UUID NULL`
- `status VARCHAR(30)`
  - `pending`, `classified`, `needs_review`, `duplicate`, `imported`, `failed`
- `error_message TEXT NULL`
- `document_id UUID NULL`
- `created_at`
- `updated_at`

But :

- résultat détaillé fichier par fichier

## 4.7 Nouvelle table `classification_reviews`

Fichier à créer :

- `backend/app/models/classification_review.py`

Champs :

- `id`
- `tenant_id`
- `document_id`
- `import_job_item_id UUID NULL`
- `reason VARCHAR(50)`
  - `no_rule`, `ambiguous_rule`, `missing_category`, `invalid_target`
- `status VARCHAR(20)`
  - `open`, `resolved`
- `assigned_to UUID NULL`
- `resolution_comment TEXT NULL`
- `resolved_by UUID NULL`
- `resolved_at TIMESTAMP NULL`
- `created_at`
- `updated_at`

But :

- bannette de revue manuelle dédiée

---

## 5. Migrations Alembic à Prévoir

## 5.1 Révision 1

- création `classification_domains`
- création `classification_activities`
- création `classification_rules`

Nom conseillé :

- `20260427_add_classification_core_tables.py`

## 5.2 Révision 2

- ajout des colonnes de classification sur `documents`
- ajout des index

Nom conseillé :

- `20260427_extend_documents_for_spaces.py`

## 5.3 Révision 3

- création `import_jobs`
- création `import_job_items`
- création `classification_reviews`

Nom conseillé :

- `20260427_add_import_jobs_and_reviews.py`

---

## 6. Backend — Endpoints Exact à Créer ou Modifier

## 6.1 Endpoint à conserver mais à simplifier

Fichier :

- [documents.py](</E:/GED237/backend/app/api/v1/endpoints/documents.py>)

`POST /api/v1/documents/upload`

Rôle en V1 :

- upload simple unitaire
- création directe d'un document

Évolution :

- garder pour les imports unitaires
- réutiliser les mêmes services de classification après création

## 6.2 Nouvel endpoint `POST /api/v1/imports/analyze`

Fichier à créer :

- `backend/app/api/v1/endpoints/imports.py`

Entrée :

- `multipart/form-data`
- fichiers
- `source_scope`
- `target_org_unit_id` ou `target_user_id`
- `default_document_category_id`
- `processing_mode`

Sortie :

- création d'un `import_job`
- analyse par fichier
- preview des destinations probables

Réponse :

- `job_id`
- compteurs
- liste des `items`

## 6.3 Nouvel endpoint `POST /api/v1/imports/{job_id}/commit`

But :

- exécuter réellement l'import après la pré-analyse

Traitement :

- stocker les fichiers de staging dans le système
- créer immédiatement les documents finaux pour les items `classified`
- laisser les items `pending` et `needs_review` en staging
- créer les reviews de classement liées aux `import_job_items` ambigus
- lancer le workflow seulement pour les documents finalisés quand c'est applicable

Décision métier V1 retenue :

- `analyze` prépare et classe
- `commit` fait entrer le lot dans le système
- les cas clairs sont stockés définitivement tout de suite
- les cas ambigus vont en bannette humaine
- le stockage définitif des cas ambigus n'a lieu qu'après arbitrage

## 6.4 Nouvel endpoint `GET /api/v1/imports/{job_id}`

But :

- consulter l'état d'un batch

## 6.5 Nouvel endpoint `GET /api/v1/imports/{job_id}/items`

But :

- consulter le détail fichier par fichier

## 6.6 Nouvel endpoint `GET /api/v1/spaces/tree`

Fichier à créer :

- `backend/app/api/v1/endpoints/spaces.py`

But :

- retourner l'arborescence logique :
  - scope organisationnel
  - domaine
  - activité
  - année

## 6.7 Nouvel endpoint `GET /api/v1/spaces/documents`

Paramètres :

- `org_unit_id`
- `user_id`
- `scope`
- `domain_id`
- `activity_id`
- `year`
- `status`
- `q`

But :

- alimenter la page `spaces`

## 6.8 Endpoints `classification-rules/domains`

Fichier d'implementation reel :

- `backend/app/api/v1/endpoints/classification.py`

But :

- lister les domaines
- creer, modifier et desactiver les domaines

Contrat implemente :

- `GET /api/v1/classification-rules/domains`
- `POST /api/v1/classification-rules/domains`
- `PATCH /api/v1/classification-rules/domains/{domain_id}`
- `DELETE /api/v1/classification-rules/domains/{domain_id}`

## 6.9 Endpoints `classification-rules/activities`

But :

- lister les activités
- creer, modifier et desactiver les activites

Contrat implemente :

- `GET /api/v1/classification-rules/activities`
- `POST /api/v1/classification-rules/activities`
- `PATCH /api/v1/classification-rules/activities/{activity_id}`
- `DELETE /api/v1/classification-rules/activities/{activity_id}`

## 6.10 Nouveaux endpoints `classification_rules`

Fichier d'implementation reel :

- `backend/app/api/v1/endpoints/classification.py`

Endpoints :

- `GET /api/v1/classification-rules/rules`
- `GET /api/v1/classification-rules/rules/{rule_id}`
- `POST /api/v1/classification-rules/rules`
- `PATCH /api/v1/classification-rules/rules/{rule_id}`
- `DELETE /api/v1/classification-rules/rules/{rule_id}`
- `POST /api/v1/classification-rules/simulate`

## 6.11 Nouveaux endpoints `classification_reviews`

Fichier :

- `backend/app/api/v1/endpoints/classification_reviews.py`

Endpoints :

- `GET /api/v1/classification-reviews`
- `POST /api/v1/classification-reviews/{id}/resolve`

Résolution :

- choisir domaine
- choisir activité
- choisir année
- choisir target org unit ou user
- relancer workflow si besoin

---

## 7. Backend — Services à Créer

## 7.1 `ImportAnalysisService`

Fichier :

- `backend/app/services/import_analysis_service.py`

Rôle :

- lire les fichiers d'un batch
- calculer checksum
- vérifier support format
- détecter doublons
- proposer une catégorie si possible
- appeler le moteur de classification

## 7.2 `ClassificationRuleEngine`

Fichier :

- `backend/app/services/classification_rule_engine.py`

Rôle :

- trouver la meilleure règle de classement
- appliquer la priorité
- produire un résultat de classification

Sortie standard :

- `domain_id`
- `activity_id`
- `classification_year`
- `classification_scope`
- `target_org_unit_id`
- `target_user_id`
- `workflow_template_id`
- `status`
- `reason`

## 7.3 `SpacePathBuilder`

Fichier :

- `backend/app/services/space_path_builder.py`

Rôle :

- construire `logical_space_path`

Exemple :

- `Service de l'Infrastructure / Marchés / Réparation / 2026`

## 7.4 `ImportExecutionService`

Fichier :

- `backend/app/services/import_execution_service.py`

Rôle :

- prendre un `import_job` analysé
- créer les documents finaux pour les items classifiés
- ouvrir des reviews de classement pour les items ambigus
- conserver les fichiers ambigus en staging jusqu'à arbitrage
- appeler `ApplyRoutingRulesToDocumentUseCase` seulement après stockage définitif

## 7.5 `ClassificationReviewService`

Fichier :

- `backend/app/services/classification_review_service.py`

Rôle :

- traiter la bannette `à classer`
- gérer les reviews attachées soit à un `Document`, soit à un `ImportJobItem`
- appliquer une correction manuelle
- finaliser le stockage des items ambigus importés après arbitrage
- marquer la review comme résolue

---

## 8. Backend — Modifications dans les Services Existants

## 8.1 GEDRules

Fichier :

- [gedrules_service.py](</E:/GED237/backend/app/services/gedrules_service.py>)

Évolution :

- ne pas le surcharger avec les règles de classement
- le garder pour le routage workflow
- l'appeler seulement après classification suffisante

## 8.2 Ingestion actuelle

Fichier :

- [ingestion.py](</E:/GED237/backend/app/services/ingestion.py>)

Décision :

- conserver comme service technique local/admin
- ne plus le présenter comme parcours principal V1

## 8.3 Documents

Fichier :

- [documents.py](</E:/GED237/backend/app/api/v1/endpoints/documents.py>)

Évolution :

- enrichir la réponse `DocumentRead`
- inclure :
  - `classification_status`
  - `classification_scope`
  - `classification_year`
  - `logical_space_path`
  - `domain_name`
  - `activity_name`

---

## 9. Frontend — Écran par Écran

## 9.1 Écran `Import en masse`

Fichier à refondre :

- [DirectoryIngestion.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/DirectoryIngestion.tsx>)

Nouvelle structure :

### Bloc 1 — Sélection

- choisir dossier
- choisir fichiers

### Bloc 2 — Contexte d'import

- portée :
  - personne
  - service
  - sous-direction
- cible organisationnelle
- mode :
  - archiver seulement
  - classer et traiter
- catégorie par défaut
- année imposée optionnelle

### Bloc 3 — Analyse

- bouton `Analyser`
- tableau preview :
  - fichier
  - type détecté
  - catégorie retenue
  - destination estimée
  - workflow estimé
  - statut preview

### Bloc 4 — Exécution

- bouton `Lancer l'import`
- progression batch
- résumé final

## 9.2 Écran `Espaces Documentaires`

Fichier existant :

- [SpacesPage.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/SpacesPage.tsx>)

Évolution :

- garder la sélection de service
- ajouter filtres métier complets :
  - domaine
  - activité
  - année
  - statut
  - type
  - catégorie
- afficher `logical_space_path`
- afficher statut de classification
- conserver le bouton `Importer`

## 9.3 Écran `Revue de classement`

Fichier implemente :

- `frontend/profiles/tenant-admin/pages/ClassificationReviewPage.tsx`

Contenu :

- liste des documents `à classer`
- motif de blocage
- aperçu du document ou du fichier importé
- choix :
  - domaine
  - activité
  - année
  - niveau de rangement
  - cible organisationnelle
- bouton `Classer et finaliser`

Comportement :

- si la review porte sur un document existant, on corrige son classement
- si la review porte sur un `import_job_item`, l'arbitrage crée alors le document final, sa version, puis supprime le staging

## 9.4 Écran `Règles de classement`

Implémentation reelle :

- `frontend/profiles/tenant-admin/pages/GEDRulesPage.tsx`
- `frontend/profiles/tenant-admin/pages/gedrules/ClassificationSettingsTab.tsx`

Contenu :

- liste des règles
- priorité
- conditions
- résultats
- simulateur simple

Note :

- l'administration de classement est integree dans la page `/rules`
- il n'existe pas de route frontend dediee `/classification-rules`

## 9.5 Routes frontend

Fichier :

- [App.tsx](</E:/GED237/frontend/App.tsx>)

Routes implementees :

- `/rules`
- `/classification-reviews`
- `/needs-review` -> redirection legacy vers `/classification-reviews`

---

## 10. Schémas Pydantic à Créer ou Modifier

## 10.1 Modifier `DocumentRead`

Fichier :

- [document.py](</E:/GED237/backend/app/schemas/document.py>)

Ajouter :

- `mime_type`
- `classification_status`
- `classification_scope`
- `classification_year`
- `logical_space_path`
- `domain_name`
- `activity_name`

## 10.2 Créer `schemas/imports.py`

Contenu :

- `ImportAnalyzeResponse`
- `ImportJobRead`
- `ImportJobItemRead`
- `ImportCommitResponse`

## 10.3 Créer `schemas/classification.py`

Contenu :

- `ClassificationDomainRead`
- `ClassificationActivityRead`
- `ClassificationRuleCreate`
- `ClassificationRuleRead`
- `ClassificationReviewRead`
- `ClassificationReviewResolve`

---

## 11. Droits et Casbin

Fichier :

- [policy.csv](</E:/GED237/backend/app/core/authz/policy.csv>)

Règles à ajouter :

- `classification_rules, read/create/update/delete`
- `classification_reviews, read/resolve`
- `imports, analyze/create/read/commit`
- `spaces, read`

Attribution minimale :

- `tenant_admin` : complet
- `unit_admin` : imports et spaces sur son scope
- `manager` : imports limités + spaces + review si validé métier
- `collaborator` : import restreint à son périmètre si voulu
- `reader` : spaces lecture seule
- `auditor` : lecture et audit

---

## 12. Ordre d'Implémentation Recommandé

## Sprint 1 — Data + backend minimum

- migrations DB
- modèles de classification
- enrichissement `documents`
- `ClassificationRuleEngine`
- `SpacePathBuilder`

## Sprint 2 — Import jobs

- `import_jobs`
- `import_job_items`
- `POST /imports/analyze`
- `POST /imports/{job_id}/commit`

Statut au 2026-04-28 :

- backend livré
- le commit n'importe que les items classifiés
- les items `pending` et `needs_review` restent volontairement hors import automatique
- la revue dédiée reste un sujet Sprint 5 / Sprint 6

## Sprint 3 — UI import

- refonte `DirectoryIngestion.tsx`
- preview d'analyse
- commit réel

## Sprint 4 — Spaces

- endpoint `spaces/documents`
- endpoint `spaces/tree`
- enrichissement `SpacesPage.tsx`
- filtres métier
- état : livré le `2026-04-28`

## Sprint 5 — Revue manuelle

- `classification_reviews`
- écran de revue
- relance de workflow après correction
- état : livré le `2026-04-29`

## Sprint 6 — Règles admin

- CRUD des règles de classement
- simulateur de classification
- état : livré le `2026-04-29`
- backend :
  - validations de cohérence de règles
  - simulation tenant-safe
  - ordre d’affichage aligné sur l’ordre d’exécution
- frontend :
  - administration de classement intégrée à `/rules`
  - domaines, activités, règles, simulateur
  - ancien paramétrage GED conservé

## Sprint 7 — Stabilisation / recette

- état : en cours au `2026-04-29`
- frontend :
  - projet Playwright `mocked-chromium` pour les scénarios UI mockés
  - suppression de la dépendance backend d’auth sur les specs mockées
  - validation ciblée de `ingestion`, `spaces`, `classification-reviews`, `classification-admin`
- qualité :
  - `npm run typecheck` vert
  - `npm run build` vert
- reste à faire :
  - exécuter les tests backend intégrés avec `TEST_DATABASE_URL`
  - rejouer les parcours non mockés
  - corriger `/index.css` et réduire le bundle

---

## 13. Tests à Prévoir

## Backend

- import simple service
- import simple personne
- import sans règle
- import avec règle unique
- import avec conflit de règles
- import doublon binaire
- import batch mixte avec erreurs partielles
- génération correcte de `logical_space_path`
- déclenchement workflow après classification

## Frontend

- analyse avant import
- commit d'import
- filtre spaces par domaine/activité/année
- résolution revue manuelle

## E2E

- dossier local -> analyse -> import -> classement -> affichage dans `spaces`
- import ambigu -> bannette revue -> correction -> visible dans `spaces`

---

## 14. Décision Produit Finale pour V1

V1 doit rester simple :

- une cible organisationnelle choisie au départ
- classement automatique par règles simples
- rangement logique par espace documentaire
- revue manuelle si besoin après `commit`
- workflow optionnel

Ce qu'on évite en V1 :

- mapping implicite complexe de sous-dossiers source vers plusieurs services
- IA lourde de classification
- agent local
- watch folders

---

## 15. Fichiers Concrètement Touchés

### Backend existants

- `backend/app/models/document.py`
- `backend/app/schemas/document.py`
- `backend/app/api/v1/endpoints/documents.py`
- `backend/app/core/authz/policy.csv`
- `backend/app/api/v1/router.py`

### Backend nouveaux

- `backend/app/models/classification_domain.py`
- `backend/app/models/classification_activity.py`
- `backend/app/models/classification_rule.py`
- `backend/app/models/import_job.py`
- `backend/app/models/import_job_item.py`
- `backend/app/models/classification_review.py`
- `backend/app/schemas/imports.py`
- `backend/app/schemas/classification.py`
- `backend/app/schemas/classification_admin.py`
- `backend/app/schemas/classification_review.py`
- `backend/app/api/v1/endpoints/imports.py`
- `backend/app/api/v1/endpoints/spaces.py`
- `backend/app/api/v1/endpoints/classification.py`
- `backend/app/api/v1/endpoints/classification_reviews.py`
- `backend/app/services/import_analysis_service.py`
- `backend/app/services/import_execution_service.py`
- `backend/app/services/classification_rule_engine.py`
- `backend/app/services/classification_review_service.py`
- `backend/app/services/space_path_builder.py`

### Frontend existants

- `frontend/App.tsx`
- `frontend/services/api.ts`
- `frontend/types.ts`
- `frontend/profiles/tenant-admin/pages/DirectoryIngestion.tsx`
- `frontend/profiles/tenant-admin/pages/SpacesPage.tsx`

### Frontend nouveaux

- `frontend/profiles/tenant-admin/pages/ClassificationReviewPage.tsx`
- `frontend/profiles/tenant-admin/pages/gedrules/ClassificationSettingsTab.tsx`

---

## 16. Résultat Attendu

À la fin de cette V1 :

- l'utilisateur choisit un dossier local
- l'application analyse les fichiers
- le backend importe le lot
- les cas clairs sont stockés définitivement immédiatement
- les cas ambigus sont envoyés en revue manuelle
- après arbitrage, les cas ambigus sont stockés définitivement et deviennent des documents normaux
- les documents apparaissent dans les bons espaces
- les workflows partent quand c'est possible

Le tout sans agent desktop, sans surveillance, et en restant cohérent avec l'architecture actuelle de GED237.
