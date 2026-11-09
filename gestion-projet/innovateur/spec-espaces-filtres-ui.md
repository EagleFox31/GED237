# Spec — `SpacesPage` sur les filtres serveur du Lot C9 (ordre 4 côté UI, DEC-2026-002 ; lundi 17/11)

- **Pour** : dev-frontend (implémente), ci-qa (spec e2e), orchestrateur (recette). Instruite par l'innovateur le 2026-11-09 19:40. Aucun code écrit ici.
- **Niveaux** : `Vérifié` = lu dans le dépôt / PR ce jour ; `Déduit` ; `Proposé`.
- **Contrat consommé** : PR **#38 fusionnée le 2026-11-09 17:44** (`feat(api): server-side filters and pagination for space documents`), contrat figé dans `gestion-projet/walkthrough/[Claude] Lot C filtres serveur - 2026-11-09.md` § « Contrat figé ».
- **Effort** : **1 j F** (DEC-002 ordre 4, part UI) ; la **pagination est la partie sacrifiable** (D2 du point S1 : « pagination de l'ordre 4 » en dernier recours) : la spec la met donc en § 3.4 séparé, livrable indépendamment.

## 1. Contrat serveur (`Vérifié`, #38)

`GET /api/v1/spaces/documents` (même implémentation que `GET /documents/workspace`, `backend/app/api/v1/endpoints/spaces.py:34-57`, dépendance `WorkspaceDocumentFilters` dans `documents.py:89-116`) :

| Paramètre | Contrainte | Note UI |
|---|---|---|
| `org_unit_id`, `recursive` | inchangés | déjà envoyés par `spacesApi.getSpaceDocuments` |
| `domain_id` | UUID | liste des domaines déjà chargée par la page (`api.getClassificationDomains`) |
| `activity_id` | UUID | idem (`api.getClassificationActivities`) ; dépend du domaine |
| `year` | entier 1900..2100 | année de classement |
| `status` | `draft\|in_review\|validated\|signed\|archived\|rejected\|returned` | libellés FR via `getStatusLabel` (`frontend/types.ts`) |
| `classification_status` | `pending\|classified\|needs_review\|rejected` | libellés via `getClassificationStatusLabel` (déjà dans la page) |
| `q` | ≤ 120 caractères, ILIKE échappé sur titre, tags, nom de domaine, d'activité, de catégorie | remplace la recherche locale actuelle |
| `limit` | optionnel, 1..200 (`WORKSPACE_PAGE_MAX = 200`) ; **absent = tout** (comportement historique) | la page actuelle n'envoie rien : zéro régression tant que F ne l'ajoute pas |
| `offset` | ≥ 0 | |

Réponse : corps = tableau `DocumentRead` inchangé, tri `created_at desc, id` ; en-tête **`X-Total-Count`** = total après filtres, avant pagination (exposé par CORS `expose_headers`). Valeur hors contrat → **422** FastAPI standard (pas de Problem Details sur ce cas : `Déduit`, à vérifier par F ; le bus `pushApiError` affiche de toute façon quelque chose).

## 2. État de la page aujourd'hui (`Vérifié`, `frontend/profiles/tenant-admin/pages/SpacesPage.tsx`, 914 lignes)

- Charge l'arbre des services, les utilisateurs, les domaines et activités actifs au montage (l. 148-191) ; charge les documents du service sélectionné à chaque changement de `selectedUnitId`, `recursive` ou présence d'une recherche (l. 242-263) via `api.getSpaceDocuments(selectedUnitId, effective)` : **aucun filtre serveur envoyé**.
- Recherche : `q` lu dans l'URL (`useSearchParams`, l. 135-141), écrit par la barre de recherche du **`Header`** (`frontend/components/Header.tsx:70-85`, `/spaces` déclaré l. 32). Filtrage **côté client** sur titre, catégorie, type de fichier, chemin logique, domaine, activité, service cible (l. 297-314). En mode recherche, la page lève la portée au service (l. 320).
- Vue `details` / `icons` (l. 111, 143), case « Inclure les sous-services » (l. 488), bandeau « N documents disponibles dans les sous-services » (l. 579-581), slide-over de classement, aperçu, menu contextuel.
- **Aucun filtre domaine / activité / année / statut** dans l'UI aujourd'hui. Pourtant `frontend/e2e/specs/spaces.spec.ts:164-177` attend `getByLabel('Filtre domaine')`, `getByLabel('Filtre statut de classement')` et le texte « Aucun document ne correspond a vos criteres. » : cette spec tourne sur **`mockAuth`** (`utils/mockAuth`) et décrit une UI qui n'existe pas (`Constaté` : grep de ces libellés vide dans `frontend/`). Deux conséquences : (a) **reprendre ces libellés exacts** (`aria-label`) pour que la spec existante redevienne vraie sans la réécrire ; (b) Q confirme si cette spec est aujourd'hui rouge ou ignorée.
- Pas de composant `Pagination` réutilisable dans `frontend/components` (grep vide) ; `apiCall` (`frontend/services/http/client.ts:84-98`) renvoie `response.json()` et **jette les en-têtes** : il faudra un appel qui garde `X-Total-Count`.
- Composants réutilisables présents : `InlineHelpButton({ content, label })` (`frontend/components/ui/InlineHelpButton.tsx`, icône `help` + `Tooltip`), `Tooltip`, `ClassificationSlideOver`, `DocumentPreview`.

## 3. Comportement attendu (`Proposé`)

### 3.1 Filtres à montrer, dans cet ordre

Une seule rangée compacte au-dessus de la liste, à droite de la case « Inclure les sous-services » (règle CLAUDE.md : pas de bandeau pleine largeur) :

| # | Contrôle | `aria-label` | Valeurs | Pourquoi cet ordre |
|---|---|---|---|---|
| 1 | Domaine (select) | `Filtre domaine` | « Tous les domaines » + domaines actifs | axe principal du plan de classement ; libellé attendu par la spec e2e |
| 2 | Activité (select) | `Filtre activité` | « Toutes les activités » + activités **du domaine choisi** ; désactivé tant qu'aucun domaine | dépend de 1 |
| 3 | Année (select) | `Filtre année` | « Toutes les années » + années présentes : **année courante − 10 → année courante + 1** (pas d'appel serveur pour lister les années : hors contrat) | lecture naturelle « domaine / activité / année » = le chemin logique affiché sur chaque carte |
| 4 | Statut de classement (select) | `Filtre statut de classement` | « Tous » + 4 valeurs, libellés existants | c'est le filtre qui sert la bannette (« à revoir ») ; attendu par la spec e2e |
| 5 | Statut du document (select) | `Filtre statut du document` | « Tous » + 7 valeurs, `getStatusLabel` | moins utilisé en démo ; dernier |
| — | Bouton « Réinitialiser » (icône `filter_alt_off`, tooltip « Effacer les filtres ») | `Réinitialiser les filtres` | visible seulement si au moins un filtre est actif | |
| — | `InlineHelpButton` en coin de la rangée | `Aide sur les filtres` | « Les filtres s'appliquent au service affiché, et aux sous-services si la case est cochée. La recherche porte sur le titre, les mots-clés et le classement. » | aide = icône + infobulle, pas de paragraphe |

Recherche `q` : **reste dans le `Header`** (comportement connu de l'utilisateur), mais elle est désormais **envoyée au serveur** et le filtrage local l. 297-314 est supprimé. Longueur bornée à 120 côté client (`maxLength`) pour ne jamais déclencher le 422.

### 3.2 État dans l'URL : **oui**, pour tous les filtres

`q` y est déjà ; on étend : `domain`, `activity`, `year`, `cls` (classification_status), `status`, `page`. Noms courts, lisibles, une seule source de vérité (`useSearchParams`, déjà importé). Bénéfices : F5 garde les filtres, lien partageable, bouton Précédent cohérent, et la spec e2e peut viser une URL directe. Règles :

- `setSearchParams(next, { replace: true })` pour les filtres (pas une entrée d'historique par clic) ; une entrée **normale** pour le changement de service (déjà le cas via la navigation).
- Changer domaine → vider `activity` ; changer tout filtre → remettre `page` à 1.
- Valeur d'URL invalide (ex. `year=abc`) → ignorée côté client (filtre « Tous »), jamais envoyée : on ne provoque pas le 422.
- `selectedUnitId` reste en état React comme aujourd'hui (il est déjà porté par la navigation dans l'arbre) ; **ne pas** le migrer dans l'URL dans ce lot.

### 3.3 Chargement et portée

- Un seul `useEffect` de chargement, dépendances = `selectedUnitId`, `recursive`, et les six paramètres d'URL. Debounce **300 ms** sur `q` uniquement (les selects déclenchent immédiatement).
- Annulation de la requête précédente (`AbortController`) : avec des filtres rapides, la réponse lente d'une ancienne requête ne doit pas écraser la nouvelle.
- La règle actuelle « recherche active = portée tenant entier » (l. 320) est **conservée** telle quelle : si `q` est non vide, on n'envoie pas `org_unit_id` (ou on envoie `recursive=true` depuis la racine ; F choisit ce qui reproduit le comportement actuel) ; sinon on envoie le service + `recursive` comme aujourd'hui. Le bandeau « disponibles dans les sous-services » garde sa logique : le serveur renvoie les documents du périmètre, la page continue de séparer « du service » et « des sous-services » côté client (l. 320-341) : c'est le seul filtrage qui **reste côté client**, parce qu'il dépend de l'arbre déjà chargé et qu'il n'existe pas côté API.

### 3.4 Pagination (livrable séparé, sacrifiable D2)

- Taille de page **50** (constante `SPACES_PAGE_SIZE`), `limit=50&offset=(page-1)*50`. Sans pagination livrée, **ne pas envoyer `limit`** : comportement historique garanti par le contrat.
- Lire `X-Total-Count` : ajouter dans `spaces.api.ts` une fonction `getSpaceDocumentsPage(params): Promise<{ items: Document[]; total: number }>` construite sur `fetchWithRefresh` + `getHeaders` (déjà exportés par `http/client.ts`), avec le même message d'erreur FR que `getSpaceDocuments`. Ne pas modifier `apiCall` (utilisé partout) ; en-tête absent → `total = items.length`.
- Contrôle minimal sous la liste : « 1–50 sur 312 » + boutons Précédent / Suivant (icônes `chevron_left` / `chevron_right`, `aria-label` « Page précédente » / « Page suivante »), désactivés aux bornes. Pas de sélecteur de taille de page, pas de « aller à la page N » dans ce lot.
- Le compteur « N documents disponibles dans les sous-services » devient incohérent avec une page partielle : en mode paginé, il affiche le nombre **sur la page courante** et la tooltip le précise (« sur cette page »). Alternative (si 0,1 j dispo) : second appel `limit=1` sur le seul service pour obtenir le total exact via `X-Total-Count` ; **non requis** pour la démo.

### 3.5 États vides et messages (FR, courts, règles UX CLAUDE.md)

| Situation | Message | Forme |
|---|---|---|
| Service sans aucun document, aucun filtre | « Aucun document dans ce service. » | zone vide centrée, icône `folder_open`, une ligne ; sous-ligne « Cochez “Inclure les sous-services” pour élargir. » **seulement** si des sous-services existent |
| Filtres actifs, 0 résultat | « Aucun document ne correspond a vos criteres. » (**libellé exact attendu par la spec e2e, sans accents** ; F peut le corriger en « à vos critères » **si Q met la spec à jour dans la même PR**) | zone vide + bouton « Réinitialiser les filtres » |
| Recherche `q` sans résultat | « Aucun résultat pour “<q>”. » | idem |
| Chargement | squelette des cartes existant (`documentsLoading`), pas de spinner plein écran | inchangé |
| Erreur API | déjà portée par le bus global (`pushApiError`) ; la page garde la dernière liste visible et affiche en coin « Liste non actualisée » | pas de bandeau rouge pleine largeur |
| 422 (ne doit jamais arriver grâce au § 3.2) | message du bus global | à constater en test manuel une fois |

Aucun compteur ni texte d'aide en paragraphe dans la carte des filtres : tout passe par `aria-label`, placeholders et `InlineHelpButton`.

### 3.6 Ce qui reste côté client (récapitulatif)

Séparation « du service / des sous-services » (§ 3.3), construction des listes d'options (domaines, activités dépendantes, années), tri des cartes dans la vue icônes (le serveur trie déjà `created_at desc` : la page **ne retrie pas**, supprimer tout `sort` local s'il existe), formats (`formatDate`, `formatFileSize`, libellés). **Supprimé** : le filtre texte local l. 297-314.

## 4. Reuse-first

| Besoin | Décision | Justification |
|---|---|---|
| Selects filtrants | **Build** avec `<select>` natifs stylés comme ceux déjà présents dans `gedrules/*Tab.tsx` | accessibilité native, `selectOption` Playwright direct, zéro dépendance |
| Aide | **Adopt** `InlineHelpButton` | existe, conforme CLAUDE.md |
| État URL | **Adopt** `useSearchParams` (déjà dans la page et le `Header`) | aucune lib d'état d'URL (nuqs, etc.) : 6 paramètres ne le justifient pas |
| Pagination | **Build** minimal (20 lignes) | aucun composant existant ; une lib (react-paginate) serait disproportionnée |
| Lecture d'en-tête | **Adapt** `fetchWithRefresh` + `getHeaders` | garder `apiCall` intact |

## 5. Preuve attendue

### 5.1 Playwright (Q, pile Docker e2e `ci/e2e-smoke`, données réelles, **pas `mockAuth`**)

Spec `frontend/e2e/specs/spaces-filters.spec.ts` (ou reprise de `spaces.spec.ts:164-177` basculée sur `auth.fixture` : au choix de Q, mais une seule des deux doit subsister) :

| ID | Scénario | Attendu |
|---|---|---|
| SPF-01 | admin tenant, `/spaces`, choisit un domaine via `getByLabel('Filtre domaine')` | la requête réseau contient `domain_id=<uuid>` ; seuls les documents de ce domaine sont affichés ; l'URL contient `domain=` |
| SPF-02 | enchaîne `Filtre statut de classement` = `needs_review` sur un domaine sans document à revoir | texte « Aucun document ne correspond a vos criteres. » visible ; bouton « Réinitialiser les filtres » visible ; clic → liste revenue, URL sans `domain`/`cls` |
| SPF-03 | `page.reload()` avec filtres actifs | les selects affichent les mêmes valeurs ; même liste |
| SPF-04 | saisie dans la recherche du `Header` | requête avec `q=` ; **aucun** filtrage client (le nombre de cartes = nombre d'éléments de la réponse réseau) |
| SPF-05 (si pagination livrée) | service du jeu e2e avec > 50 documents (ou `SPACES_PAGE_SIZE` abaissé par variable `VITE_SPACES_PAGE_SIZE` en e2e) | « 1–50 sur N » ; Suivant → `offset=50` dans la requête ; Précédent désactivé en page 1 |

Chaque test lit la requête avec `page.waitForRequest(req => req.url().includes('/spaces/documents'))` : c'est la preuve que le filtre est **serveur**, pas client.

### 5.2 Recette O (lundi 17 soir)

PR fusionnée, run e2e vert joint, capture recadrée de la rangée de filtres + de l'état vide. Point S1 : B5 (API) déjà fusionné le 09/11 ; F en semaine 2 selon DEC-002.

## 6. Risques

- **Spec e2e existante contradictoire** (`spaces.spec.ts` sur `mockAuth`) : si F change un libellé sans Q, la suite casse ou reste fausse. Règle : libellés de § 3.1 et § 3.5 **figés** dans cette fiche ; tout changement passe par Q dans la même PR.
- **Double filtrage** (serveur + ancien code client) : symptôme = résultats manquants seulement en recherche. Prévention : suppression explicite du `useMemo` l. 297-314 dans la PR, pas de « au cas où ».
- **Course entre requêtes** : couverte par l'`AbortController` (§ 3.3) ; test manuel : taper vite puis vérifier que la liste correspond à la dernière saisie.
- **Pagination sacrifiée** : alors `limit` n'est pas envoyé, la fonction `getSpaceDocumentsPage` n'est pas créée, le § 3.4 est reporté en V1.1 ; rien d'autre ne bouge. Ne pas livrer une pagination « à moitié » (offset sans total).
- **Années** : liste statique −10/+1 ; un document classé en 2009 ne serait pas filtrable par année (`Déduit` : improbable dans le jeu de démo, `jeu-donnees-demo.md` cible 2024-2026). Noté, pas traité.

## Sources

- PR #38 (fusionnée 2026-11-09 17:44) : `backend/app/api/v1/endpoints/spaces.py`, `documents.py` (`WorkspaceDocumentFilters`, `WORKSPACE_PAGE_MAX`, `TOTAL_COUNT_HEADER`), `backend/tests/api/test_spaces_filters.py`, `gestion-projet/walkthrough/[Claude] Lot C filtres serveur - 2026-11-09.md`.
- Dépôt GED237 (2026-11-09) : `frontend/profiles/tenant-admin/pages/SpacesPage.tsx`, `frontend/services/resources/spaces.api.ts`, `frontend/services/http/client.ts`, `frontend/components/Header.tsx` (l. 32, 70-85), `frontend/components/ui/InlineHelpButton.tsx`, `frontend/types.ts` (l. 18, 30, 34), `frontend/e2e/specs/spaces.spec.ts` (l. 1-3, 164-177).
- Règles UX : `CLAUDE.md` § « Frontend UX — densité et aide ».
- react-router 7, `useSearchParams` : https://reactrouter.com/start/declarative/url-values
