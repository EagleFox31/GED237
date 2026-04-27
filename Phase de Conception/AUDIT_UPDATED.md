# AUDIT ACTUEL - E-Dossier Cameroun (GED237)

> Date : 2026-04-13
> Scope : code courant backend + frontend + tests + exécution locale
> Méthode : lecture du code, inventaire des endpoints/tests, vérifications de build et de lancement ciblées

---

## Synthèse

Le document `AUDIT.md` précédent n'est plus à jour. Il contient encore plusieurs constats déjà corrigés dans le code courant, et il manque plusieurs régressions ou incohérences désormais plus critiques.

État observé au 13 avril 2026 :

- Backend FastAPI : 42 routes déclarées.
- Tests backend : 6 fichiers, 11 tests.
- Tests frontend : aucun test automatisé observé.
- Exécution locale : non fiable en l'état sur cet environnement.
- Déploiement production : non recommandé sans correction des points P0 ci-dessous.

Points déjà corrigés depuis l'ancien audit, donc à ne plus reporter comme ouverts :

- `frontend/hooks/useNotifications.ts` existe.
- Le frontend stocke les tokens en `sessionStorage`, pas en `localStorage`.
- Un mécanisme de refresh sur `401` existe dans `frontend/services/api.ts`.
- `pytest`, `pytest-asyncio` et `pytest-cov` sont présents dans `backend/requirements.txt`.
- `get_current_user_ws()` existe dans `backend/app/core/dependencies.py`.
- Le backend protège désormais le `SECRET_KEY` par défaut en production dans `backend/app/core/config.py`.
- `storage_service.delete_file()` est synchrone dans l'implémentation locale actuelle ; le problème "missing await" de l'ancien audit n'est plus pertinent.

---

## Vérifications exécutées

### Frontend

Commande exécutée :

```bash
npm run build -- --outDir /tmp/ged237-frontend-build
```

Résultat : échec.

Cause observée :

- dépendance native Rollup manquante : `@rollup/rollup-linux-x64-gnu`
- erreur levée depuis `frontend/node_modules/rollup/dist/native.js`

Impact : le frontend n'est pas buildable de manière fiable sur cet environnement Linux/WSL tant que les dépendances optionnelles ne sont pas régénérées proprement.

### Backend

Commande exécutée :

```bash
venv/Scripts/python.exe -m pytest -q -o cache_dir=/tmp/pytest-ged237
```

Résultat : échec d'exécution locale sur cet environnement WSL.

Cause observée :

- le projet embarque un venv Windows (`venv/Scripts/*.exe`)
- l'appel de l'exécutable Python/pytest Windows depuis WSL échoue (`WSL ... socket failed 1`)

Limite supplémentaire : `backend/tests/conftest.py` cible un PostgreSQL local fixe :

- `postgresql+asyncpg://postgres:Postgresql@localhost:5432/test_ged`

Impact : les tests ne sont pas portables et ne peuvent pas être considérés comme une sécurité d'intégration utilisable en l'état.

---

## Findings P0

### 1. Permissions documents incomplètes ou contournables

Fichiers :

- `backend/app/api/v1/endpoints/documents.py`

Constat :

- `delete_document()` vérifie le propriétaire puis laisse un `pass` au lieu d'un refus explicite.
- `update_document()` n'applique aucune règle d'autorisation réelle avant mutation.
- `list_documents()` retourne tous les documents du tenant sans règle de visibilité par rôle ou par unité.

Impact :

- un utilisateur authentifié du tenant peut modifier ou supprimer des documents sans politique métier solide.
- la GED n'applique pas encore un modèle d'accès défendable.

### 2. Workflow non protégé et machine d'état non verrouillée

Fichiers :

- `backend/app/api/v1/endpoints/workflows.py`
- `backend/app/schemas/document.py`
- `backend/app/models/document.py`

Constat :

- `create_workflow_steps()` peut être appelé sans contrôle de rôle métier suffisant.
- les étapes existantes ne sont pas normalisées ni remplacées ; elles sont simplement ajoutées.
- `validate_workflow_step()` manipule les transitions au cas par cas.
- `DocumentUpdate.status` accepte n'importe quelle chaîne ; la validation est repoussée au check SQL.

Impact :

- transitions invalides possibles.
- workflows incohérents.
- erreurs métiers détectées trop tard.

### 3. Contrat d'authentification multi-tenant incohérent

Fichiers :

- `backend/app/schemas/auth.py`
- `backend/app/services/auth_service.py`
- `backend/app/models/user.py`

Constat :

- le schéma login exige `institution`.
- `AuthService.login()` ignore totalement `institution` et authentifie uniquement sur `matricule + password`.
- `users.matricule` est déclaré `unique=True` globalement tout en ayant aussi un index composite tenant+matricule.

Impact :

- le contrat API ment sur la sémantique réelle.
- la logique multi-tenant reste mal définie côté identité.
- impossible de défendre proprement un login scoping par institution tant que le schéma et le modèle divergent.

### 4. Login réel frontend ne mappe pas correctement le profil UI

Fichiers :

- `frontend/components/LoginPage.tsx`
- `frontend/stores/authStore.ts`
- `frontend/App.tsx`
- `frontend/components/Header.tsx`
- `frontend/components/Sidebar.tsx`

Constat :

- après OTP, le frontend stocke `response.user` tel quel.
- l'application attend pourtant un `userProfile.id` de type alias UI (`tenant`, `manager`, `collab`, etc.).
- le backend renvoie au contraire un `id` UUID et un `role` métier.

Impact :

- un login réel tombe sur le dashboard par défaut.
- les menus spécifiques par profil ne s'activent pas correctement.
- une partie importante de l'expérience par rôle est cassée malgré une authentification techniquement réussie.

### 5. Refresh token frontend cassé par contrat API non aligné

Fichiers :

- `frontend/services/api.ts`
- `backend/app/schemas/auth.py`
- `backend/app/services/auth_service.py`

Constat :

- sur `401`, le frontend appelle `/auth/refresh`.
- il tente ensuite de stocker `data.refresh_token`.
- le backend `/auth/refresh` ne renvoie que `access_token` et `token_type`.

Impact :

- le frontend peut écraser le refresh token valide avec une valeur `undefined`.
- après un premier refresh, la session peut devenir incohérente ou impossible à renouveler correctement.

### 6. Les comptes de démo frontend ne correspondent pas aux credentials seed backend

Fichiers :

- `frontend/components/LoginPage.tsx`
- `backend/scripts/seed_db.py`

Constat :

- les mots de passe démo côté frontend sont `admin123`, `minfi123`, `user123`, etc.
- la seed backend crée `Admin@2025`, `Minfi@2025`, `User@2025`, etc.

Impact :

- la démo d'authentification est trompeuse.
- un environnement seedé standard donne l'impression que le login est cassé alors que c'est le jeu d'identifiants UI qui est faux.

### 7. Exécution locale non fiable sur l'environnement de travail actuel

Fichiers :

- `frontend/node_modules/rollup/dist/native.js`
- `backend/venv/Scripts/python.exe`
- `backend/tests/conftest.py`

Constat :

- build frontend bloqué par dépendance Rollup native manquante.
- tests backend bloqués par venv Windows lancé depuis WSL.
- tests backend couplés à un PostgreSQL local hardcodé.

Impact :

- la boucle de validation développeur n'est pas reproductible.
- toute remédiation restera fragile tant que l'environnement n'est pas rendu portable.

---

## Findings P1

### 8. La recherche frontend lit la mauvaise clé de réponse

Fichiers :

- `frontend/components/Header.tsx`
- `backend/app/api/v1/endpoints/search.py`

Constat :

- le frontend lit `data.results`.
- l'API backend renvoie `SearchResponse.hits`.

Impact :

- la recherche peut sembler vide même si le backend retourne des résultats.

### 9. Le frontend appelle un endpoint backend inexistant pour l'arbre organisationnel

Fichiers :

- `frontend/services/api.ts`
- `backend/app/api/v1/endpoints/org_units.py`

Constat :

- le frontend expose `getOrgUnitsTree()` sur `/org-units/tree`.
- le backend ne déclare pas cette route.

Impact :

- toute fonctionnalité dépendante de l'arbre organisationnel est cassée côté UI.

### 10. Le manager ne reçoit pas assez de contexte document dans les tâches en attente

Fichiers :

- `frontend/profiles/manager/pages/ValidationHub.tsx`
- `backend/app/api/v1/endpoints/workflows.py`

Constat :

- `ValidationHub` lit `item.document?.title`.
- `/workflows/pending` renvoie seulement des `WorkflowStepRead` sans document enrichi.

Impact :

- l'écran manager affiche souvent `Document sans titre`.
- la prise de décision est dégradée.

### 11. `org_unit_id` est supposé présent alors que le modèle utilisateur l'autorise à `NULL`

Fichiers :

- `backend/app/models/user.py`
- `backend/app/api/v1/endpoints/documents.py`
- `backend/app/services/ingestion.py`

Constat :

- le modèle `User` autorise `org_unit_id` nullable.
- l'upload et l'ingestion construisent pourtant les chemins et métadonnées à partir de `current_user.org_unit_id` sans garde explicite.

Impact :

- plantage ou stockage incohérent possible pour certains comptes administratifs ou techniques.

### 12. Event dispatcher en fire-and-forget sans garantie de livraison

Fichiers :

- `backend/app/core/events/dispatcher.py`
- `backend/app/services/notifications/listeners.py`

Constat :

- `dispatch()` crée des tasks async et ne les attend jamais.
- aucune stratégie de retry, de journalisation robuste ou de backpressure.

Impact :

- notifications perdues silencieusement en cas d'erreur ou de fin prématurée de requête/boucle.

### 13. Les suppressions d'utilisateurs et d'unités ne vérifient pas les dépendances métier

Fichiers :

- `backend/app/api/v1/endpoints/users.py`
- `backend/app/api/v1/endpoints/org_units.py`

Constat :

- suppression directe sans contrôle préalable des relations fonctionnelles.
- la robustesse repose essentiellement sur les contraintes SQL/FK.

Impact :

- erreurs d'intégrité possibles.
- UX d'administration peu maîtrisée.

### 14. Les tests backend restent majoritairement des tests de façade

Fichiers :

- `backend/tests/conftest.py`
- `backend/tests/api/test_auth.py`
- `backend/tests/api/test_tenants.py`
- `backend/tests/api/test_workflows.py`

Constat :

- beaucoup de tests bypassent l'auth réelle via override de dépendance.
- peu de vérifications métier profondes.
- aucun test frontend observé.

Impact :

- faible valeur de protection contre les régressions réelles.
- les bugs de contrat front/back et de permissions ne sont pas attrapés automatiquement.

---

## Findings P2

### 15. Données UI codées en dur dans le shell applicatif

Fichiers :

- `frontend/components/Header.tsx`
- `frontend/components/Sidebar.tsx`

Constat :

- nom affiché `Abena Mvondo` en dur.
- tenant ID décoratif `ADMIN_MINFI_237` en dur.

Impact :

- interface trompeuse pour les utilisateurs réels.
- dette de finition visible.

### 16. Synchronisation incomplète entre la modale document et la liste parente

Fichiers :

- `frontend/components/DocumentDetailModal.tsx`
- `frontend/components/Documents.tsx`

Constat :

- la modale recharge les steps seulement au changement d'onglet workflow.
- la liste parent ne se resynchronise pas après action de validation.

Impact :

- états visuels obsolètes.
- confusion utilisateur après action réussie.

### 17. Filtre de valideurs fragile et couplé aux IDs seed

Fichiers :

- `frontend/profiles/collaborator/pages/DraftWorkspace.tsx`
- `backend/scripts/seed_db.py`

Constat :

- le filtre `role_id !== 5` suppose implicitement que `5 == collaborator` partout.

Impact :

- bug latent si les IDs de rôles changent ou si l'environnement diffère.

### 18. Navigation tenant-admin partiellement câblée vers des pages inexistantes

Fichiers :

- `frontend/profiles/tenant-admin/menuConfig.ts`
- `frontend/App.tsx`

Constat :

- plusieurs entrées de menu n'ont pas de route gérée dans `TAB_TO_ROUTE`.

Impact :

- navigation vers des écrans "en travaux" au lieu d'un comportement cohérent.

### 19. Logging et observabilité encore rudimentaires

Fichiers :

- `backend/app/main.py`
- `backend/app/workers/tasks.py`
- `frontend/hooks/useNotifications.ts`

Constat :

- usage de `print()` et `console.error()` sans corrélation de requête ni structure uniforme.

Impact :

- diagnostic plus lent en exploitation.

---

## Priorités de correction

### Sprint 0 : rendre la boucle locale fiable

- Régénérer les dépendances frontend pour Linux/WSL afin de supprimer le blocage Rollup.
- Remplacer le venv Windows embarqué par un environnement Python portable côté backend.
- Rendre la config de test backend injectable par variables d'environnement ou `docker compose`.

### Sprint 1 : sécuriser le coeur métier

- Verrouiller les permissions sur `documents`.
- Centraliser la machine d'état document/workflow.
- Aligner le contrat d'authentification sur une règle claire : tenant-scoped ou global-scoped, mais pas les deux.
- Corriger le refresh token frontend/backend.

### Sprint 2 : réaligner frontend et backend

- Mapper les rôles backend vers les profils UI dans le store d'auth.
- Corriger la recherche `hits` vs `results`.
- Supprimer ou implémenter `/org-units/tree`.
- Fournir au manager un payload workflow enrichi avec le document.

### Sprint 3 : fiabiliser la non-régression

- Ajouter des tests d'intégration auth réels.
- Ajouter des tests permissions documents/workflows.
- Ajouter au minimum un smoke test frontend de login + navigation + documents.

---

## Conclusion

Le projet a progressé par rapport à l'ancien audit, mais il reste dans une zone intermédiaire :

- la base applicative est plus cohérente qu'avant,
- plusieurs constats historiques sont désormais faux,
- mais les points critiques actuels se concentrent sur trois axes : permissions métier, contrat auth/front-back, et portabilité de l'environnement local.

La priorité n'est plus de "corriger des imports cassés" ; la priorité est de stabiliser les contrats et d'empêcher les comportements incohérents en production.
