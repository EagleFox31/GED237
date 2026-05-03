Oui. Et cette fois on le recadre proprement avec **Casbin dès maintenant**, sans transformer le chantier en usine à gaz.

## Plan P5 amélioré avec Casbin

L’objectif n’est plus juste “centraliser les rôles”.
L’objectif devient :

* **mettre Casbin comme couche d’autorisation unique**
* **garder les règles métier dans les services/use cases**
* **migrer progressivement sans casser le reste**

---

# P5 — Sécurité Multi-Tenant & Autorisation

## T5.1 — Introduire Casbin comme couche d’autorisation centrale

### But

Remplacer les checks dispersés du style :

```python
if current_user.role.code not in ['super_admin', 'tenant_admin']:
    raise HTTPException(status_code=403)
```

par une logique unique du genre :

```python
authorize(user=current_user, obj="categories", act="create", tenant_id=current_user.tenant_id)
```

### Ce que Casbin gérera

Casbin doit répondre à la question :

**“Cet utilisateur a-t-il le droit d’exécuter cette action sur cette ressource dans ce contexte ?”**

Exemples :

* `super_admin` peut gérer les tenants
* `tenant_admin` peut gérer les catégories, règles, templates, users, org_units de son tenant
* `manager` peut lire certains documents de son unité
* `standard` peut lire ses propres documents

### Ce que Casbin ne gérera pas

On ne met pas dedans :

* la machine à états des documents
* les transitions de workflow
* les vérifications de dépendances métier
* les contraintes de suppression
* les locks

Ça reste dans les services métier.

---

## T5.2 — Créer une couche d’intégration propre

### Fichiers à ajouter

#### `backend/app/core/authz/casbin_enforcer.py`

Responsable de l’initialisation de l’enforcer Casbin.

#### `backend/app/core/authz/model.conf`

Le modèle Casbin.

#### `backend/app/core/authz/policy.csv`

Les policies initiales.

#### `backend/app/core/authz/service.py`

Fonctions utilitaires du type :

* `authorize(...)`
* `authorize_or_403(...)`

#### `backend/app/core/authz/context.py`

Construction du contexte d’autorisation :

* `sub` = rôle utilisateur
* `obj` = ressource
* `act` = action
* `tenant_id`
* `owner_id`
* `org_unit_id`

---

## T5.3 — Définir le modèle Casbin minimal

On part sur un modèle **RBAC + un peu de contexte applicatif**, pas plus.

### Sujet

* rôle utilisateur : `super_admin`, `tenant_admin`, `unit_admin`, `manager`, `reader`, `standard`, etc.

### Objet

Ressources métier :

* `documents`
* `categories`
* `gedrules.templates`
* `gedrules.rules`
* `users`
* `org_units`
* `workflows`
* `analytics`
* `tenants`

### Actions

* `read`
* `create`
* `update`
* `delete`
* `assign`
* `simulate`
* `manage`

### Exemple de policies

```csv
p, super_admin, tenants, manage
p, super_admin, analytics, read
p, tenant_admin, categories, manage
p, tenant_admin, gedrules.templates, manage
p, tenant_admin, gedrules.rules, manage
p, tenant_admin, users, manage
p, tenant_admin, org_units, manage
p, tenant_admin, documents, read
p, tenant_admin, documents, update
p, tenant_admin, documents, delete
p, manager, documents, read
p, reader, documents, read
p, standard, documents, read_own
p, standard, documents, update_own
p, standard, documents, delete_own
```

On pourra mapper `manage` vers `create/read/update/delete` dans le service si on veut éviter de dupliquer.

---

## T5.4 — Ajouter une façade d’autorisation lisible

Au lieu de faire appeler Casbin brut partout, on met une façade.

### Exemple

```python
authorize_or_403(
    user=current_user,
    obj="categories",
    act="create",
    tenant_id=current_user.tenant_id,
)
```

Ou pour un document :

```python
authorize_or_403(
    user=current_user,
    obj="documents",
    act="update",
    tenant_id=document.tenant_id,
    owner_id=document.owner_id,
    org_unit_id=document.org_unit_id,
)
```

Cette façade :

* appelle Casbin
* applique les règles contextuelles simples
* garde une interface stable même si on change la mécanique dessous

---

## T5.5 — Migrer endpoint par endpoint

On ne refactorise pas tout en une fois.
On fait ça en vagues.

### Vague 1 — très bon ROI

* `categories.py`
* `gedrules.py`
* `users.py`
* `org_units.py`

Pourquoi eux :

* permissions simples
* peu de logique contextuelle
* gros bénéfice immédiat

### Vague 2 — documents

* `list_documents`
* `get_document`
* `update_document`
* `delete_document`
* `trash/restore/lock`

Ici Casbin décide le droit général, puis le service garde les règles métier :

* owner seulement
* statut éditable
* lock actif
* etc.

### Vague 3 — workflows

* `pending`
* `pending-assignments`
* `assign`
* `actions`

Même logique : Casbin pour le droit d’accès, service métier pour la validité métier.

### Vague 4 — analytics / tenants

* surtout pour clarifier le périmètre `super_admin`

---

## T5.6 — Isolation multi-tenant

Casbin ne remplace pas le scoping SQL.
Il complète le scoping SQL.

Donc on garde :

* `WHERE tenant_id == current_user.tenant_id` dans les requêtes
* et on ajoute Casbin pour éviter l’accès logique non autorisé

### Règle

**Casbin n’est pas le seul garde-fou tenant.**
Le filtrage SQL reste obligatoire.

### Recommandation pratique

Créer un mini module partagé :

#### `backend/app/core/security/tenant_guard.py`

Fonctions utilitaires :

* `assert_same_tenant(resource_tenant_id, user)`
* `assert_org_unit_scope(resource_org_unit_id, user)`

Donc :

* **SQL filtre**
* **tenant_guard vérifie**
* **Casbin autorise**

Triple verrou. Là on dort un peu mieux.

---

## T5.7 — Tests à écrire

### Tests Casbin

Vérifier que :

* `tenant_admin` peut gérer `categories`
* `standard` ne peut pas gérer `categories`
* `manager` peut lire documents
* `standard` peut `read_own` mais pas `read_any`

### Tests cross-tenant

Créer un `second_tenant_client` et tester :

* lecture doc autre tenant → refus
* update doc autre tenant → refus
* delete user autre tenant → refus
* accès règle GED autre tenant → refus

### Tests mixtes autorisation + métier

Exemple :

* `standard` a le droit `update_own`
* mais document en `validated`
* résultat attendu : refus métier, pas refus RBAC

Ça permet de prouver que les responsabilités sont bien séparées.

---

## T5.8 — Audit minimal

Quand une action sensible est refusée, logguer au moins :

* user_id
* tenant_id
* ressource
* action
* motif du refus

Exemples :

* tentative de suppression user sans droit
* tentative cross-tenant
* tentative de gestion GEDRules par non-admin

Pas besoin de faire un SIEM de la NASA tout de suite.
Juste une traçabilité propre.

---

# Ordre d’exécution recommandé

## Étape 1

Créer la base Casbin :

* `model.conf`
* `policy.csv`
* `casbin_enforcer.py`
* `service.py`

## Étape 2

Migrer les endpoints simples :

* `categories`
* `gedrules`
* `users`
* `org_units`

## Étape 3

Créer `tenant_guard.py`

## Étape 4

Migrer `documents`

## Étape 5

Migrer `workflows`

## Étape 6

Écrire les tests cross-tenant + tests RBAC

## Étape 7

Ajouter l’audit minimal sur refus sensibles

---

# Ce qu’on gagne

## Tout de suite

* une seule définition des permissions
* fin des listes de rôles dispersées
* meilleure lisibilité
* base propre pour la suite

## Plus tard

* si un nouveau rôle arrive, on touche surtout aux policies
* si le métier grossit, on a déjà la colonne vertébrale
* si un jour vous voulez aller plus loin, Casbin est déjà en place

---
