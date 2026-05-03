# FRONTEND - Couverture API des Pages (Thème GED Cameroun)

> Mise à jour de cohérence au 2026-04-30, après relecture du code frontend et des services API.

## Légende priorité
- `P0` : bloquant fonctionnel / incohérence métier
- `P1` : important pour la prod
- `P2` : amélioration UX/complétude

## 1) Pages existantes mais API incomplète (à compléter)

- [x] `/org` - `frontend/profiles/tenant-admin/pages/OrganizationPage.tsx` - `P0`
  API partielle: arbre + users + création OK; `Modifier`/`Supprimer` non branchés; onglets `Règles GED` et `Statistiques` surtout visuels.

- [x] `/spaces` - `frontend/profiles/tenant-admin/pages/SpacesPage.tsx` - `P1`
  API partielle: l'écran est riche et branché (`tree`, documents, domaines, activités, filtres métier, slide-over de classement), mais les filtres métier restent majoritairement côté client. Le backend `/spaces/documents` ne prend pas encore en charge `domain`, `activity`, `year`, `status`, `q` comme dans le plan V1.

- [x] `/documents` - `frontend/components/Documents.tsx` - `P1`
  API partielle: listing/upload OK; filtres/recherche/pagination restent majoritairement côté client, pas de pagination serveur.

- [x] `/dashboard` (profil `unit`) - `frontend/profiles/unit-admin/pages/ServiceDashboard.tsx` - `P1`
  API partielle: KPI chargés; actions métier (permissions/unité) encore décoratives.

- [x] `/settings` et `/settings/display` - `frontend/profiles/tenant-admin/pages/DisplaySettings.tsx` - `P1`
  API partielle: lecture org units OK; persistance des réglages UI absente; checklist "configuration système" statique.

- [x] `/tasks` - `frontend/components/WorkflowTasks.tsx` - `P2`
  API partielle: tâches + validation OK; bloc "graphique performance" non branché à des métriques réelles.

- [x] `/dashboard` (profil `collab`) - `frontend/profiles/collaborator/pages/DraftWorkspace.tsx` - `P1`
  API partielle: upload + workflow OK; modal upload utilise encore des champs non normalisés (`category` texte) à aligner avec catégories UUID.

- [x] Header global recherche/notifications - `frontend/components/Header.tsx` - `P2`
  API partielle: recherche et notifications chargent bien; navigation approfondie depuis résultat de recherche encore limitée.

## 2) Pages existantes avec API déjà bien branchée

- [x] `/login` + OTP - `frontend/components/LoginPage.tsx`
- [x] `/authz` - `frontend/profiles/super-admin/pages/AuthzAdmin.tsx`
- [x] `/rules` - `frontend/profiles/tenant-admin/pages/GEDRulesPage.tsx` + tabs
  Couvre maintenant le paramétrage GED historique et l'administration de classement documentaire via `ClassificationSettingsTab`.
- [x] `/classification-reviews` - `frontend/profiles/tenant-admin/pages/ClassificationReviewPage.tsx`
  Route active pour la revue manuelle; `/needs-review` est conservee comme redirection legacy.
- [x] `/ingestion` - `frontend/profiles/tenant-admin/pages/DirectoryIngestion.tsx`
  Flux analyse -> import reel branche sur `/imports/analyze` et `/imports/{jobId}/commit`, avec categories UUID chargees depuis l'API.
- [x] `/pending-assignments` - `frontend/profiles/tenant-admin/pages/PendingAssignmentsInbox.tsx`
- [x] `/audit` - `frontend/profiles/auditor/pages/AuditLogs.tsx`
- [x] `/dashboard` (profils `super`, `tenant`, `manager`, `reader`) - pages dashboard dédiées

## 3) Pages à créer (priorisées)

- [ ] `P0` - Page `403 Accès refusé`
  Route dédiée quand l’utilisateur est authentifié mais non autorisé (au lieu d’un fallback ambigu).

- [ ] `P1` - Page `Centre de notifications`
  Vue complète (filtres, pagination, historique), en complément du dropdown header.

- [ ] `P1` - Page `Corbeille / Documents supprimés`
  Pour exploiter le cycle de vie documentaire (restauration/suppression définitive selon rôle).

- [ ] `P1` - Page `Santé & Observabilité`
  Vue admin pour état API/Redis/metrics (au minimum health + statut dégradé).

- [ ] `P2` - Page `Résultats de recherche avancée`
  Vue dédiée recherche full-text (avec filtres persistants et navigation document).

## 4) Ordre d’exécution recommandé

- [ ] Étape 1 (`P0`) : compléter `/org` (edit/delete réels) et décider si `spaces` doit réellement filtrer côté serveur comme dans le plan V1.
- [ ] Étape 2 (`P1`) : fiabiliser `/documents` (pagination/filtrage serveur) + normaliser `DraftWorkspace`.
- [ ] Étape 3 (`P1`) : créer `403`, `Centre notifications`, `Corbeille`, `Santé`.
- [ ] Étape 4 (`P2`) : recherche avancée et finitions UX (graphes, deep-link résultats).
