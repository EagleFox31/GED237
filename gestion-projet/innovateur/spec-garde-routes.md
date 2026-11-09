# Spec — garde de routes admin / non-admin (ordre 6, décision PO (b) « B1 », DEC-2026-002 ; mardi 18/11)

- **Pour** : dev-frontend (implémente), ci-qa (spec Playwright dans sa pile e2e), orchestrateur (recette). Instruite par l'innovateur le 2026-11-09 19:30. Aucun code écrit ici.
- **Niveaux** : `Vérifié` = lu dans le dépôt ce jour (chemin:ligne) ; `Déduit` ; `Proposé`.
- **Périmètre tranché** (PO 09/11) : garde **grossière** admin / non-admin côté client, pas de garde fine par permission. Les trois constats backend B6 restent en V1.1 (écart 10 de `plan-presentation.md`). Cette garde est un confort d'interface, **pas** une mesure de sécurité : l'API reste la seule barrière (Casbin, `authorize_or_403`).
- **Effort** : **0,5 j F** (déjà budgété DEC-002) + **0,1 j Q** pour la spec e2e. Sacrifiable en premier (D2 du point S1).

## 1. État réel (`Vérifié`, 2026-11-09)

### 1.1 Aucune garde aujourd'hui

- `frontend/App.tsx:189-213` : toutes les routes sont rendues dans un seul `<Routes>` pour tout utilisateur connecté. Aucun composant `RequireRole` / `ProtectedRoute` dans `frontend/` (grep vide). Un lecteur qui tape `/users` ou `/tenants` dans la barre d'adresse voit la page d'administration se monter ; l'API répond ensuite 403 et la page affiche ses erreurs ou reste vide (`Déduit` : comportement par page, non uniforme).
- Seul le **menu** diffère : `frontend/components/Sidebar.tsx:71-80` rend `SUPER_ADMIN_MENU` si `userProfile.id === 'super'`, `TENANT_ADMIN_MENU` si `'tenant'`, sinon un menu par défaut de 5 entrées (dashboard, documents, tasks, ingestion, local_library).
- Racine : `App.tsx:229-233` : `isLoggedIn ? <AppLayout /> : <LoginPage />`. Pas de route `/login` : l'écran de connexion remplace l'arbre entier quand `isLoggedIn` est faux.

### 1.2 D'où vient le rôle côté client

| Source | Détail | Fiabilité |
|---|---|---|
| Réponse de login (`/auth/verify-otp`) | `normalizeBackendUser` (`frontend/stores/authStore.ts`) lit `user.role` (code backend, ex. `tenant_admin` ou `TENANT_ADMIN`) et le garde dans `userProfile.backendRole` | donnée serveur, non falsifiable sans accès au compte |
| `resolveTemplate` (`authStore.ts`) | `ROLE_PROFILE_MAP` sur le code **mis en majuscules** (`SUPER_ADMIN → super`, `TENANT_ADMIN → tenant`, `UNIT_ADMIN → unit`, `MANAGER → manager`, `COLLABORATOR → collab`, `READER → reader`, `AUDITOR → audit`), puis repli `PROFILE_BY_ID` sur l'id en minuscules, puis `DEFAULT_PROFILE` | **déjà insensible à la casse** |
| Persistance | `sessionStorage` : `user_profile` (JSON du profil résolu) et `access_token` ; `isLoggedIn = !!access_token && !!initialProfile` (`authStore.ts:147,177`) | modifiable par l'utilisateur dans son propre navigateur : d'où « confort, pas sécurité » |
| JWT | le frontend **ne décode pas** le token (grep `jwt-decode`/`atob` vide dans `frontend/stores`) | ne pas commencer à le faire pour cette garde : une source unique, le profil |

**Décision de conception** : la garde compare **`userProfile.id`** (`'super'`, `'tenant'`, …), jamais `backendRole` ni le code brut. C'est la seule valeur déjà normalisée.

### 1.3 Lien avec la migration des rôles (B2, mardi 11)

La migration de dev-backend passe les codes de rôle en minuscules (`super_admin`, …) alors que `001_initial_schema.py:66-72` les avait insérés en majuscules et que le seed les écrit en minuscules. Côté client, `resolveTemplate` absorbe les deux casses **avant** que la garde ne lise `userProfile.id`. Conséquence : **aucune dépendance de calendrier** entre B2 et cette garde, à une condition : **ne jamais écrire `backendRole === 'TENANT_ADMIN'` dans la garde**. Un test unitaire (§ 4.1) fige ce point.

### 1.4 Inventaire des routes (`App.tsx:190-213`) et propriétaire

| Route | Composant | Menu qui l'expose | Classe proposée |
|---|---|---|---|
| `/` | redirige `/dashboard` | — | publique (connecté) |
| `/dashboard` | `ProfileDashboard` (varie par profil) | tous | publique |
| `/documents`, `/tasks`, `/ingestion`, `/local-library` | pages métier | tous (menu défaut + admins) | publique |
| `/classification-reviews`, `/needs-review` (→ redirection), `/pending-assignments` | bannettes | tenant-admin (`needs_review`, `pending_assignments`) ; atteintes aussi par liens internes | publique (le backend filtre par rôle) |
| `/settings`, `/settings/display` | `DisplaySettings` (préférences d'affichage) | tenant-admin, super-admin, bouton Header (`onOpenSettings`) | publique |
| `/change-password` | `ChangePassword` | forcé par `AppLayout` si `mustChangePassword` | publique |
| `/spaces` | `SpacesPage` (dossier `profiles/tenant-admin/pages`) | tenant-admin (`spaces`) | **publique** — c'est l'explorateur documentaire, et le parcours lecteur de la démo en a besoin (`Déduit`) ; le backend applique `spaces:read` |
| `/audit` | `AuditLogs` | tenant-admin (`audit_central`), super-admin, dashboard de l'auditeur (`ProfileDashboard` case `'audit'`) | **publique** — l'auditeur en dépend ; pas de garde ici |
| `/reports` | `ReportsPage` | tenant-admin (`reports`) | publique (`Déduit` : rapports consultables par les chefs de service ; à confirmer par F si la page plante pour un lecteur) |
| **`/tenants`, `/tenants/:tenantId`, `/platform-users`, `/authz`** | `profiles/super-admin/pages/*` | super-admin seul | **réservée `super`** |
| **`/org`, `/rules`, `/classement`, `/users`** | `profiles/tenant-admin/pages/*` | tenant-admin seul | **réservée `super` + `tenant`** |
| `*` | `NotFoundPage` | — | publique |

Règle de classement : réservée = page qui **administre** (structure, règles, comptes, autorisations, institutions). Tout ce qui **consulte** reste public côté client et laissé au backend. Huit routes gardées, deux niveaux (`super`, `tenant`) : c'est exactement la granularité « admin / non-admin » tranchée par le PO.

## 2. Reuse-first (`Vérifié`)

| Besoin | Existant | Décision |
|---|---|---|
| Redirection vers l'espace par défaut | `defaultRouteForProfile(profileId)` (`App.tsx:97`, `DEFAULT_ROUTE_BY_PROFILE` : `super → /tenants`, `manager → /tasks`, `reader → /documents`, `audit → /audit`, autres `/dashboard`) | **Adopt** tel quel |
| Message court sans HTTP | `pushClientOperationError` (`frontend/lib/errors/clientOperationError.ts`) → bus d'erreurs global déjà affiché par le layout | **Adopt** (règle CLAUDE.md : opérations locales → `pushClientOperationError` depuis les pages, pas un toast ad hoc) |
| Garde de route react-router | pattern officiel react-router (installé : `react-router-dom ^7.18.5`, `frontend/package.json`) : élément enveloppe qui rend `<Navigate replace>` ou `<Outlet />` | **Build** minimal (~30 lignes), pas de dépendance ajoutée |
| Table des routes réservées | aucune ; `ROUTE_TO_TAB` / `TAB_TO_ROUTE` (`App.tsx:60-94`) couplent déjà route ↔ onglet | **Build** : une constante `ADMIN_ROUTES` dans `App.tsx` à côté de ces tables, pas de fichier de config séparé pour 8 lignes |

## 3. Comportement attendu (`Proposé`)

### 3.1 Règles

1. **Accès refusé** → `navigate(defaultRouteForProfile(userProfile.id), { replace: true })` + `pushClientOperationError` avec le message **« Accès réservé aux administrateurs. »** (une phrase, pas de code d'erreur, pas de jargon). Jamais de page blanche, jamais de 404 trompeur, jamais d'appel API lancé par la page interdite (elle n'est pas montée).
2. **`replace: true`** obligatoire : le bouton Précédent ne doit pas ramener sur la route interdite (boucle).
3. **Un seul message** par tentative : si l'utilisateur recharge la page interdite, nouveau message ; si deux gardes s'enchaînaient (cas impossible aujourd'hui), un seul `push`.
4. **Rechargement de page (F5) sur une route réservée** : le profil est relu depuis `sessionStorage` **avant le premier rendu** (`initialProfile` est calculé au chargement du module `authStore.ts:147`), donc la garde dispose de `userProfile.id` dès le premier rendu : aucun écran intermédiaire, pas de « flash » de la page admin. À vérifier par F : si un jour le profil devient asynchrone (appel `/me`), la garde doit rendre un état « chargement » neutre, **pas** rediriger.
5. **Rôle manquant ou inconnu** (profil absent alors qu'un token existe, ou `id` hors des 7 connus) : `resolveTemplate` renvoie déjà `DEFAULT_PROFILE` ; la garde traite **tout id non listé comme non-admin** (liste blanche, jamais liste noire). Si `access_token` existe sans `user_profile`, `isLoggedIn` est déjà faux (`authStore.ts:177`) → écran de connexion : rien à ajouter.
6. **Menu** : inchangé. La garde ne remplace pas le filtrage du `Sidebar`, elle le double pour l'URL tapée, les favoris, les liens partagés, les redirections post-login d'un autre compte sur le même navigateur.
7. **Parité avec le backend** : la liste `ADMIN_ROUTES` ne doit **pas** être plus permissive que l'API (sinon la page se monte puis prend 403). Elle peut être plus stricte (ex. `/org` interdit au `unit` alors que l'API autoriserait peut-être la lecture) : accepté pour la démo, noté dans la PR.

### 3.2 Forme (indicative, F décide)

- Constante dans `App.tsx` : `ADMIN_ROUTES: Record<string, ReadonlyArray<ProfileId>>` = `{ '/tenants': ['super'], '/tenants/:tenantId': ['super'], '/platform-users': ['super'], '/authz': ['super'], '/org': ['super','tenant'], '/rules': ['super','tenant'], '/classement': ['super','tenant'], '/users': ['super','tenant'] }`.
- Un composant `RequireProfile({ allow, children })` qui lit `useAuthStore().userProfile?.id`, et sinon fait l'étape 1 dans un `useEffect` (pas pendant le rendu) puis rend `null`.
- Dans `<Routes>` : `<Route path="/users" element={<RequireProfile allow={ADMIN_ROUTES['/users']}><UsersPage /></RequireProfile>} />` pour les 8 routes. Pas de refonte du routeur, pas de `createBrowserRouter`.
- Alternative acceptable : une `<Route element={<RequireProfile allow={['super','tenant']} />}>` parente avec `<Outlet />` et les 4 routes tenant-admin imbriquées, idem pour `super`. Moins de répétition, même résultat ; au choix de F.

### 3.3 Hors périmètre (V1.1, écart 10)

Garde fine par permission (`unit` sur `/org` en lecture, `manager` sur `/rules` simulateur…), décodage du JWT, masquage de boutons dans les pages selon la permission, rafraîchissement du profil par `/me`.

## 4. Preuve attendue

### 4.1 Unitaire (F ; **aucun vitest dans `frontend/package.json`** : si F ne veut pas l'ajouter, ces deux points deviennent des assertions de type ou une revue de PR, le e2e suffit)

- `resolveTemplate('tenant_admin').id === 'tenant'` **et** `resolveTemplate('TENANT_ADMIN').id === 'tenant'` : fige l'indépendance vis-à-vis de la migration B2.
- `ADMIN_ROUTES` ne contient que des chemins présents dans `<Routes>` (sinon la garde protège une route fantôme).

### 4.2 Playwright minimal (Q, pile `ci/e2e-smoke`, fichier `frontend/e2e/specs/route-guard.spec.ts`)

Réutilise `loginAs(role)` de `frontend/e2e/fixtures/auth.fixture.ts` (`TEST_USERS` : `super_admin`, `tenant_admin`, `unit_admin`, …, `reader` ; **identifiants déjà dans ce fichier, ne pas les recopier ailleurs**) et le style Given/When/Then de `security-isolation.spec.ts`.

| ID | Given | When | Then |
|---|---|---|---|
| GUARD-01 | lecteur connecté | `page.goto('users')` | URL finale = `/documents` (défaut lecteur) ; texte « Accès réservé aux administrateurs. » visible ; `page.getByRole('heading', { name: /agents/i })` absent |
| GUARD-02 | lecteur connecté | `page.goto('tenants')` | URL finale = `/documents` ; même message |
| GUARD-03 | admin tenant connecté | `page.goto('users')` | URL reste `/users` ; heading de la page visible ; aucun message d'erreur |
| GUARD-04 | admin tenant connecté | `page.goto('tenants')` | URL finale = `/dashboard` ; message visible (admin tenant ≠ super) |
| GUARD-05 | lecteur connecté, `page.goto('users')` puis `page.goBack()` | — | l'URL **ne revient pas** sur `/users` (test du `replace`) |
| GUARD-06 | lecteur connecté sur `/documents` | `page.goto('users')` puis `page.reload()` sur l'URL obtenue | pas de page blanche : `main` contient du texte ; pas de requête `GET /api/v1/users` observée (`page.waitForRequest` avec timeout court doit échouer) |

Six cas, ~40 lignes, moins d'une minute d'exécution. GUARD-06 est le seul qui prouve « pas de page blanche » et « pas d'appel API » : ne pas le couper.

### 4.3 Recette O (mardi 18 soir)

PR fusionnée + run Playwright vert joint au walkthrough ; capture **recadrée** du message chez un lecteur. Point S1 : rien à changer (ordre 6 maintenu, D2 inchangé).

## 5. Risques

- **Faux sentiment de sécurité** : la PR et le walkthrough disent explicitement « confort UI ; la sécurité est côté API (Casbin) » ; sinon le jury ou un relecteur croit B6 corrigé. Réponse en séance déjà écrite (écart 10).
- **Redirection en boucle** : si `defaultRouteForProfile` renvoyait une route elle-même gardée pour ce profil (ex. `super → /tenants` est cohérent : `super` y a droit). Test : pour chaque profil, sa route par défaut n'est pas dans `ADMIN_ROUTES` ou l'autorise. Une assertion unitaire de 3 lignes suffit.
- **Lien avec `justLoggedIn`** (`AppLayout`, redirection post-login) : les deux effets se déclenchent au premier rendu ; comme la redirection post-login vise déjà la route par défaut, pas de conflit. À observer une fois manuellement.
- **Sacrifice (D2)** : si la garde saute faute de temps, l'écart 10 reste tel quel et le menu seul fait office de garde ; aucune autre fiche à modifier.

## Sources

- Dépôt GED237 (2026-11-09) : `frontend/App.tsx` (l. 60-97, 128-150, 189-213, 229-233), `frontend/stores/authStore.ts` (l. 1-135, 147, 177-207), `frontend/components/Sidebar.tsx` (l. 71-95), `frontend/profiles/{super-admin,tenant-admin}/menuConfig.ts`, `frontend/lib/errors/clientOperationError.ts`, `frontend/e2e/fixtures/auth.fixture.ts`, `frontend/e2e/specs/security-isolation.spec.ts`, `backend/alembic/versions/001_initial_schema.py` (l. 64-72).
- react-router 7 (mode déclaratif, `<Routes>`), routes protégées via `Navigate` / `Outlet` : https://reactrouter.com/start/declarative/routing (pattern inchangé depuis la v6).
- `gestion-projet/decisions/DEC-2026-002`, `innovateur/decision-po-vps-b6.md` (option B1), `innovateur/plan-presentation.md` § 3 écart 10.
