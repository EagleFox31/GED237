# Backlog Sprint par Sprint — V1 Import, Classement et Espaces GED

## 1. Objet

Ce document découpe la V1 définie dans :

- [PLAN_TECHNIQUE_V1_IMPORT_CLASSEMENT_GED.md](</E:/GED237/Phase de Conception/PLAN_TECHNIQUE_V1_IMPORT_CLASSEMENT_GED.md>)

en backlog exécutable, sprint par sprint, pour GED237.

Le principe de cette V1 reste :

- import manuel depuis navigateur
- stockage central
- classement automatique simple
- espaces documentaires logiques
- revue manuelle des cas ambigus
- workflow optionnel après classification

---

## 2. Hypothèses de Pilotage

- cadence : sprints courts de 1 à 2 semaines
- priorité : backend et modèle de données avant enrichissement UI
- qualité minimale par sprint :
  - migrations testées
  - endpoints testés
  - UI cliquable
  - non-régression sur import simple

---

## 3. Vision Globale des Sprints

## Sprint 1 — Fondations de Classification

But :

- introduire le modèle de données minimal de classement
- préparer le backend pour stocker la destination logique d’un document

Livrables :

- tables de classification
- colonnes de classification sur `documents`
- schémas Pydantic enrichis
- bases des droits d’accès

## Sprint 2 — Moteur de Classification Backend

But :

- créer le moteur qui prend un fichier/document et produit un classement

Livrables :

- `ClassificationRuleEngine`
- `SpacePathBuilder`
- simulation backend de classification

## Sprint 3 — Import Batch Piloté

But :

- transformer l’import de masse en vrai batch métier avec analyse puis exécution

Livrables :

- `import_jobs`
- `import_job_items`
- endpoints `analyze` et `commit`

## Sprint 4 — Refonte UI Import de Masse

But :

- faire de la page d’import un parcours en 2 temps :
  - analyser
  - importer

Livrables :

- preview d’analyse
- résumé par fichier
- résultat final détaillé

## Sprint 5 — Espaces Documentaires V1

But :

- afficher les documents selon les nouveaux critères métier

Livrables :

- filtres métier complets
- affichage du chemin logique
- navigation pratique par unité

## Sprint 6 — Revue Manuelle de Classement

But :

- traiter les documents ambigus sans bloquer la GED

Livrables :

- bannette de revue
- écran de résolution
- relance de workflow après correction

## Sprint 7 — Administration des Règles de Classement

But :

- permettre à l’admin de gérer les règles sans toucher au code

Livrables :

- CRUD des règles de classement
- simulateur de classification

### État

- livré le `2026-04-29`
- backend durci :
  - validations de cohérence domaine/activité
  - protection contre les doublons en mise à jour
  - validation de contexte sur la simulation
  - ordre de liste aligné sur l’ordre réel d’évaluation
- frontend livré :
  - administration additive intégrée à `/rules`
  - module dédié `Classement documentaire`
  - gestion des domaines, activités, règles, simulateur
  - compatibilité conservée avec l’ancien paramétrage GED
- couverture ajoutée :
  - `backend/tests/api/test_classification_admin.py`
  - `frontend/e2e/specs/classification-admin.spec.ts`

## Sprint 8 — Stabilisation et Recette

But :

- fiabiliser la V1 sur données réelles

Livrables :

- tests E2E
- scénarios métier
- corrections de perf et UX

### État

- en cours au `2026-04-29`
- stabilisation frontend de la recette engagée :
  - projet Playwright dédié `mocked-chromium` pour les specs UI mockées
  - suppression de la dépendance backend d’auth pour les specs mockées
  - réalignement des specs `ingestion`, `spaces`, `classification-reviews`, `classification-admin`
  - `npm run typecheck` et `npm run build` verts
- recette mockée validée :
  - `frontend/e2e/specs/ingestion.spec.ts`
  - `frontend/e2e/specs/spaces.spec.ts`
  - `frontend/e2e/specs/classification-reviews.spec.ts`
  - `frontend/e2e/specs/classification-admin.spec.ts`
- reste à faire avant clôture :
  - exécuter le backend intégré sur vraie base de test
  - rejouer les scénarios non mockés
  - traiter le warning `/index.css` et la taille du bundle

---

## 4. Backlog Détaillé

## Sprint 1 — Fondations de Classification

### Objectifs

- créer le socle DB
- rendre `documents` capable de porter un classement logique

### User stories

1. En tant que système, je dois stocker un domaine documentaire.
2. En tant que système, je dois stocker une activité documentaire.
3. En tant que système, je dois stocker le statut de classification d’un document.
4. En tant que système, je dois stocker un chemin logique d’espace documentaire.

### Tâches backend

- créer le modèle `classification_domain`
- créer le modèle `classification_activity`
- créer le modèle `classification_rule`
- enrichir le modèle `Document`
- ajouter les index nécessaires
- créer les migrations Alembic
- exposer les nouveaux champs dans `DocumentRead`

### Tâches authz

- ajouter droits `spaces.read`
- ajouter droits `classification_rules.read`

### Tâches tests

- tests migration
- tests création/lecture de document avec nouveaux champs

### Définition de terminé

- migration exécutable sur base vide et base existante
- API document sérialise les nouveaux champs sans casser l’existant

---

## Sprint 2 — Moteur de Classification Backend

### Objectifs

- calculer une destination documentaire par fichier

### User stories

1. En tant que backend, je dois choisir la meilleure règle de classement applicable.
2. En tant qu’admin, je veux qu’une priorité de règle départage les conflits.
3. En tant que système, je veux produire un `logical_space_path` stable.

### Tâches backend

- créer `classification_rule_engine.py`
- créer `space_path_builder.py`
- définir un objet résultat standard de classification
- gérer :
  - `no_rule`
  - `classified`
  - `needs_review`
  - `rejected`
- implémenter priorité numérique
- implémenter premiers matching rules :
  - catégorie
  - service source
  - mots-clés de nom de fichier

### Endpoints

- créer `POST /api/v1/classification-rules/simulate`

### Tâches tests

- une règle matchée
- plusieurs règles matchées
- aucune règle matchée
- conflit ambigu

### Définition de terminé

- un document de test reçoit un résultat de classification déterministe

---

## Sprint 3 — Import Batch Piloté

### Statut au 2026-04-28

- routes, modèles, migrations et tests Sprint 3 présents dans le code
- point de vigilance relevé le `2026-04-30` dans `AUDIT.md` :
  - `ImportAnalysisService` n'est pas cohérent avec `SpacePathBuilder`
  - le flux runtime `analyze` doit être revalidé avant de considérer le sprint comme pleinement opérationnel
- migration, modèles, services et endpoints livrés
- tests API Sprint 3 ajoutés
- la revue manuelle dédiée reste hors périmètre de ce sprint et sera traitée en Sprint 6
- la refonte UI en 2 temps reste hors périmètre de ce sprint et sera traitée en Sprint 4

### Objectifs

- ne plus faire seulement un upload unitaire répété
- introduire un vrai cycle :
  - analyse
  - validation
  - exécution

### User stories

1. En tant qu’utilisateur, je veux analyser un lot avant de l’importer.
2. En tant qu’utilisateur, je veux voir les doublons et les cas ambigus avant confirmation.
3. En tant que système, je veux tracer chaque fichier d’un batch.

### Tâches backend

- créer `import_job`
- créer `import_job_item`
- créer `import_analysis_service.py`
- créer `import_execution_service.py`
- endpoint `POST /api/v1/imports/analyze`
- endpoint `POST /api/v1/imports/{job_id}/commit`
- endpoint `GET /api/v1/imports/{job_id}`
- endpoint `GET /api/v1/imports/{job_id}/items`

### Règles métier

- un batch a une portée d’import :
  - personne
  - service
  - sous-direction
- un batch peut avoir :
  - catégorie par défaut
  - année imposée
  - mode `archive` ou `process`
- après `commit` :
  - les items `classified` sont stockés définitivement
  - les items `pending` et `needs_review` partent en bannette d'arbitrage
  - le stockage définitif de ces derniers est déclenché par la résolution humaine

### Tâches tests

- analyse simple
- import avec doublon
- import partiellement valide
- import avec erreurs partielles

### Définition de terminé

- l’API sait créer un job, l’analyser et l’exécuter proprement

---

## Sprint 4 — Refonte UI Import de Masse

### Objectifs

- transformer la page actuelle en parcours lisible pour utilisateur non technique

### User stories

1. En tant qu’utilisateur, je veux choisir un dossier local.
2. En tant qu’utilisateur, je veux renseigner le contexte d’import.
3. En tant qu’utilisateur, je veux vérifier l’analyse avant import réel.
4. En tant qu’utilisateur, je veux un résultat final clair.

### Tâches frontend

- refondre [DirectoryIngestion.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/DirectoryIngestion.tsx>)
- ajouter étape `Analyser`
- afficher :
  - total fichiers
  - supportés
  - ignorés
  - doublons
  - destination estimée
  - statut par fichier
- ajouter bouton `Lancer l’import`
- afficher progression batch
- afficher résultat final

### Tâches API frontend

- ajouter client `analyzeImportJob`
- ajouter client `commitImportJob`
- ajouter client `getImportJob`

### Définition de terminé

- un utilisateur peut analyser puis importer un lot depuis l’UI sans passer par les endpoints manuellement

---

## Sprint 5 — Espaces Documentaires V1

### Objectifs

- faire de `spaces` une vraie vue documentaire métier

### État

- livré le `2026-04-28`
- endpoints disponibles :
  - `GET /api/v1/spaces/tree`
  - `GET /api/v1/spaces/documents`
- écran enrichi :
  - filtres `domaine`, `activité`, `année`, `statut GED`, `statut de classement`, `type`, `catégorie`
  - affichage `logical_space_path`, `classification_status`, `service cible`
- point de vigilance relevé le `2026-04-30` dans `AUDIT.md` :
  - le backend `spaces` reste principalement centré sur l'arbre `org_units` et le `workspace` documentaire existant
  - les filtres métier riches sont surtout appliqués côté frontend

### User stories

1. En tant qu’utilisateur, je veux voir les documents classés par service.
2. En tant qu’utilisateur, je veux filtrer par domaine, activité, année.
3. En tant qu’utilisateur, je veux retrouver rapidement un document classé.

### Tâches backend

- créer `GET /api/v1/spaces/tree`
- créer `GET /api/v1/spaces/documents`

### Tâches frontend

- enrichir [SpacesPage.tsx](</E:/GED237/frontend/profiles/tenant-admin/pages/SpacesPage.tsx>)
- ajouter filtres :
  - domaine
  - activité
  - année
  - statut
  - type
  - catégorie
- afficher :
  - `logical_space_path`
  - `classification_status`
  - service cible

### Définition de terminé

- un document classé automatiquement est retrouvable dans `spaces` par ses critères métier

---

## Sprint 6 — Revue Manuelle de Classement

### Objectifs

- ne plus bloquer sur les cas ambigus

### État

- surface backend/frontend livrée le `2026-04-29`
- backend :
  - ressource `classification_reviews`
  - service `classification_review_service.py`
  - endpoints :
    - `GET /api/v1/classification-reviews`
    - `POST /api/v1/classification-reviews/{id}/resolve`
- frontend :
  - écran dédié `ClassificationReviewPage.tsx`
  - résolution manuelle avec `domaine`, `activité`, `année`, `scope`, `cible org/user`
  - relance conditionnelle du workflow en mode `process`
- point de vigilance relevé le `2026-04-30` dans `AUDIT.md` :
  - le service backend de revue doit être corrigé avant de pouvoir déclarer ce sprint pleinement opérationnel à l'exécution

Décision métier explicitée :

- la revue manuelle intervient après `import`
- pour les items de batch ambigus, la résolution humaine déclenche la création du document final et son stockage définitif

### User stories

1. En tant qu’administrateur, je veux voir les documents à classer.
2. En tant qu’administrateur, je veux corriger leur destination métier.
3. En tant qu’administrateur, je veux relancer le workflow après correction.

### Tâches backend

- créer `classification_review`
- créer `classification_review_service.py`
- créer `GET /api/v1/classification-reviews`
- créer `POST /api/v1/classification-reviews/{id}/resolve`

### Tâches frontend

- créer `ClassificationReviewPage.tsx`
- afficher motif de blocage
- permettre résolution manuelle :
  - domaine
  - activité
  - année
  - scope
  - cible org/user

### Définition de terminé

- un document `needs_review` peut devenir `classified` depuis l’interface

---

## Sprint 7 — Administration des Règles de Classement

### Objectifs

- rendre les règles administrables côté UI

### User stories

1. En tant qu’admin, je veux créer une règle de classement.
2. En tant qu’admin, je veux modifier la priorité.
3. En tant qu’admin, je veux simuler le résultat attendu.

### Tâches backend

- endpoints CRUD `classification-rules`
- endpoint `simulate`

### Tâches frontend

- intégrer une surface d’admin additive à `/rules`
- gestion des domaines
- gestion des activités
- liste et édition des règles
- simulateur de classement

### Définition de terminé

- un admin peut gérer les règles sans modifier le code

---

## Sprint 8 — Stabilisation et Recette

### Objectifs

- sécuriser la V1 avant généralisation

### User stories

1. En tant qu’équipe produit, je veux valider les scénarios nominaux et dégradés.
2. En tant qu’équipe technique, je veux détecter les régressions d’import, classement et workflow.

### Tâches backend

- optimisation requêtes `spaces`
- vérification des index
- nettoyage messages d’erreur

### Tâches frontend

- améliorer lisibilité résultats batch
- cas vides
- pagination ou virtualisation si nécessaire

### Tests

- tests API
- tests unitaires moteur de classification
- tests E2E
- recette utilisateur réelle sur lot de fichiers

### Avancement courant

- recette E2E mockée sécurisée sans dépendance à l’auth backend
- corrections de harnais Playwright :
  - navigation compatible avec le `base` Vite `/edossier/`
  - projet `mocked-chromium` sans `setup`
  - fixture d’auth simulée pour les scénarios UI isolés

### Définition de terminé

- la V1 est démontrable avec un vrai lot documentaire

---

## 5. Dépendances entre Sprints

- Sprint 1 bloque tout le reste
- Sprint 2 dépend de Sprint 1
- Sprint 3 dépend de Sprint 1 et Sprint 2
- Sprint 4 dépend de Sprint 3
- Sprint 5 dépend de Sprint 1 et partiellement Sprint 2
- Sprint 6 dépend de Sprint 2 et Sprint 3
- Sprint 7 dépend de Sprint 2
- Sprint 8 dépend de tous les précédents

---

## 6. Priorité Réelle si le Budget est Court

### Priorité minimum viable

1. Sprint 1
2. Sprint 2
3. Sprint 3
4. Sprint 4
5. Sprint 5

Avec ça, on a déjà :

- import manuel
- classification automatique simple
- rangement logique
- consultation dans `spaces`

### Priorité confort / robustesse

6. Sprint 6
7. Sprint 7
8. Sprint 8

---

## 7. Risques à Surveiller

### Risques métier

- trop de cas ambigus si les règles de classement sont pauvres
- confusion entre règles de classement et règles de workflow

### Risques techniques

- performance sur gros batch
- trop forte dépendance à `document_category_id`
- dérive entre stockage physique et rangement logique
- incohérences si les droits d’accès ne suivent pas le nouveau scope de classement

### Risques UX

- import trop complexe si on surcharge l’écran V1
- `spaces` devient illisible si on expose trop de dimensions sans hiérarchie claire

---

## 8. Résultat Attendu à la Fin du Programme

À la fin de ce backlog, GED237 doit permettre :

- de sélectionner un dossier local
- d’analyser les fichiers avant import
- d’importer vers un serveur central
- de classifier automatiquement les documents
- de les ranger dans les bons espaces métier
- de lancer un workflow si le cas est clair
- de traiter manuellement les cas ambigus

Le tout avec une V1 réaliste, cohérente avec l’architecture actuelle du projet, et extensible vers une V2 plus avancée.
