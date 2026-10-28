# Analyse Product Owner — Phase de Conception GED237

> Statut : Vérifié par lecture documentaire et confrontation ciblée au code
> Auteur : Product Owner assisté
> Date : 2026-07-22
> Objectif : maîtriser les 17 documents de conception sans les confondre avec une preuve de livraison
> Périmètre : `Phase de Conception/`, `AUDIT.md` et code ciblé
> Source autoritative d'implémentation : `AUDIT.md`

## 1. Synthèse exécutive

La conception GED237 décrit quatre trajectoires qui se sont superposées :

1. une remise en état P0–P7 : environnement, authentification, documents,
   Casbin, CI, AuthZ production et branchement frontend ;
2. une V1 Import, Classement et Espaces documentaires en huit sprints ;
3. une gamme Rapports & Statistiques R1–R9 ;
4. des parcours utilisateurs, une recette fonctionnelle et une dette frontend.

Le produit réel a dépassé plusieurs anciens plans : Casbin, AuthZ SQL, import
batch, classement, rapports et bibliothèque locale existent dans le code. En
revanche, certaines promesses structurantes restent partielles : Espaces
documentaires filtrés côté serveur, recette bout en bout non mockée, filtres
globaux des rapports, archivage légal et industrialisation production.

La difficulté principale n'est pas l'absence de conception, mais sa
désynchronisation : documents homonymes, checklists historiques non mises à
jour, routes prévues différentes des routes réelles et scénarios de recette dont
les identifiants ne correspondent plus aux tests Playwright.

## 2. Lecture par axe produit

### 2.1 Trajectoire P0–P7

La trajectoire historique vise :

- P0–P3 : environnement stable et flux login → OTP → JWT ;
- P4 : documents, upload et workflow ;
- P5 : Casbin et isolation multi-tenant ;
- P6 : qualité, CI et DevSecOps ;
- P6b : AuthZ SQL, shadow mode, cache et administration ;
- P7 : remplacement des maquettes par des API réelles.

**État consolidé**

- P0–P3 : socle présent, mais campagne pytest intégrale non prouvée au
  22 juillet 2026.
- P4 : backend substantiel ; validation complète des parcours réels encore à
  attester.
- P5 : implémenté dans le code malgré des cases historiques non cochées.
- P6 : pipelines présents ; signature GPG, activation locale des hooks et
  protection de branche ne sont pas toutes prouvées opérationnellement.
- P6b : code SQL/shadow/admin présent ; bascule de production non prouvée et
  `AUTHZ_BACKEND` reste `csv` par défaut.
- P7 : largement réalisé sur le périmètre initial, mais « 100 % » est excessif
  au regard des écarts Espaces, menus et rapports.

**Contradiction de nommage**

- `P6-PLAN.md` désigne AuthZ Production-Grade ;
- `PLAN_P6.md` désigne Qualité, CI & DevSecOps ;
- `PERT_GLOBAL_GED237.md` clarifie finalement CI = P6 et AuthZ = P6b.

Toute référence future doit employer `P6-CI` ou `P6b-AuthZ`.

### 2.2 V1 Import, Classement et Espaces

La V1 promet :

- sélection manuelle de fichiers ou dossier depuis le navigateur ;
- analyse préalable, détection de doublons et proposition de classement ;
- commit contrôlé vers le stockage central ;
- classement logique par unité, domaine, activité et année ;
- revue humaine des cas ambigus ;
- déclenchement optionnel d'un circuit GEDRules ;
- exploration et filtrage dans les Espaces.

**Règles métier structurantes**

- stockage physique stable, rangement logique métier ;
- `archive` range sans circuit ; `process` range puis route ;
- une règle prioritaire gagne ; conflit à priorité égale → `needs_review` ;
- les items ambigus ne deviennent définitifs qu'après résolution humaine ;
- classement = où ranger ; GEDRules = qui doit agir.

**État des huit sprints**

- S1 Fondations : actuel.
- S2 Moteur : actuel et enrichi par les multi-filtres.
- S3 Import batch : code présent ; recette runtime à confirmer.
- S4 Wizard import : actuel.
- S5 Espaces : partiel.
- S6 Revue manuelle : structure actuelle ; recette intégrée à confirmer.
- S7 Administration : actuelle sur `/classement`, pas sous `/rules` comme prévu.
- S8 Stabilisation : non clôturé.

**Écart majeur**

Le plan prévoit un `GET /spaces/documents` filtrable par scope, domaine,
activité, année, statut et recherche. L'API actuelle n'expose principalement que
`org_unit_id` et `recursive`. L'arbre Espaces est un arbre d'unités
organisationnelles, pas l'arbre logique scope → domaine → activité → année
décrit dans la conception.

### 2.3 Rapports & Statistiques

La proposition de valeur est un centre de pilotage institutionnel, selon la
boucle « Voir → Comprendre → Filtrer → Agir → Exporter », sans dupliquer les
écrans Audit, Agents, Classement ou Explorateur.

**Gamme prévue**

- R1 : architecture et navigation ;
- R2 : synthèse exécutive ;
- R3 : activité documentaire ;
- R4 : traitement et délais ;
- R5 : activité des services ;
- R6 : génération et export ;
- R7 : qualité documentaire ;
- R8 : synthèse audit et sécurité ;
- R9 : gouvernance avancée, planification et alertes.

**État consolidé**

- R1–R6 : largement actuels dans le code ;
- R7–R9 : aspirationnels ;
- filtres globaux UI : partiels ou absents ;
- séries temporelles imports et workflows : non alimentées ;
- tests API dédiés : absents ;
- génération PDF/Excel/CSV : côté client, pas service de rapport officiel.

Le RETEX UI est le document le plus proche du produit réel : quatre onglets,
exports en action, synthèse compacte, langage métier et aide discrète.

**Décisions non figées**

- « Documents validés » ou « Documents traités » comme KPI ;
- type documentaire métier ou type de fichier ;
- accès tenant-admin uniquement ou aussi managers/unit-admins ;
- filtres communs à tous les onglets ;
- export navigateur suffisant ou génération serveur réglementaire.

### 2.4 Parcours, recette et frontend

Le guide de création d'institution est le document de parcours le plus aligné :
institution → admin → services → utilisateurs, mot de passe temporaire et
changement obligatoire.

Le guide de test fonctionnel reste utile comme cahier UAT, mais :

- le chemin d'installation et certains libellés sont anciens ;
- SUPER001 est rattaché à PLATFORM dans le seed réel, pas MINFI ;
- la distribution du mot de passe est décrite par email alors que le parcours
  actuel l'affiche à l'écran ;
- les identifiants `SC-*` ne correspondent plus systématiquement aux specs
  Playwright ;
- Rapports, Classement avancé et Bibliothèque locale y sont sous-documentés.

Le sitemap est une vision SaaS/enterprise historique :

- il prévoit des URLs tenantées `/t/{tenant-id}/app/...` alors que le frontend
  utilise des routes plates ;
- favoris, récents, partagés, corbeille UI, archives, doublons, agents IA,
  billing, API publique, rétention et aide sont majoritairement non livrés ;
- ingestion, bibliothèque locale, pending assignments et AuthZ réels n'y
  figurent pas.

Le plan SRP frontend reste pertinent, mais sa dette s'est aggravée :
`ClassificationSettingsTab.tsx` et `DirectoryIngestion.tsx` ont grandi au lieu
d'être découpés. Ce plan doit être considéré comme non démarré.

## 3. Fiche des 17 documents

### 1. `PERT_P0_REMEDIATION.md`

- **Objet** : chemin critique court pour stabiliser auth, permissions et tests.
- **Valeur** : historique utile des dépendances initiales.
- **Statut** : partiellement obsolète ; les volumes de tests sont dépassés.
- **Fiabilité actuelle** : moyenne pour les décisions, faible pour les statuts.
- **Décision ouverte** : conserver comme archive P0, sans l'utiliser comme board.

### 2. `BACKLOG_TECHNIQUE_RAPPORTS_R1_R3.md`

- **Objet** : exécution technique des trois premiers lots Rapports.
- **Valeur** : bon lien entre composants, services, contrats et DoD.
- **Statut** : largement aligné avec le code R1–R3.
- **Fiabilité actuelle** : élevée pour la structure, moyenne pour la recette.
- **Décision ouverte** : compléter par les tests API et les filtres actuels.

### 3. `GUIDE_TEST_FONCTIONNEL.md`

- **Objet** : cahier de recette manuel multi-profils.
- **Valeur** : très utile pour l'UAT et le Go/No-Go.
- **Statut** : partiel et désynchronisé des tests Playwright.
- **Fiabilité actuelle** : élevée sur les intentions métier, faible sur IDs et
  libellés.
- **Décision ouverte** : réconcilier les `SC-*` avec les specs exécutables.

### 4. `PLAN_RAPPORTS_STATISTIQUES_MVP.md`

- **Objet** : première version monolithique des Rapports.
- **Valeur** : conserve les questions métier fondatrices.
- **Statut** : obsolète comme architecture et état.
- **Fiabilité actuelle** : faible pour l'implémentation.
- **Décision ouverte** : archiver comme origine du concept.

### 5. `P5-PLAN.md`

- **Objet** : architecture Casbin et séparation RBAC/règles métier.
- **Valeur** : décisions de sécurité toujours structurantes.
- **Statut** : largement réalisé, malgré l'absence de statut dans le document.
- **Fiabilité actuelle** : élevée sur les principes, moyenne sur les chiffres.
- **Décision ouverte** : aucun changement de principe sans revue sécurité.

### 6. `GUIDE_CREATION_INSTITUTION.md`

- **Objet** : onboarding Super Admin.
- **Valeur** : runbook métier clair et proche de l'UI.
- **Statut** : actuel avec quelques liens/libellés à corriger.
- **Fiabilité actuelle** : élevée.
- **Décision ouverte** : unifier avec l'onboarding tenant du dashboard.

### 7. `sitemap.xml`

- **Objet** : architecture d'information cible historique.
- **Valeur** : backlog aspirationnel enterprise.
- **Statut** : obsolète comme carte du frontend réel.
- **Fiabilité actuelle** : faible pour la navigation, moyenne pour la vision V2.
- **Décision ouverte** : archiver comme vision ou régénérer depuis `App.tsx`.

### 8. `BACKLOG_RAPPORTS_STATISTIQUES.md`

- **Objet** : backlog produit R1–R9.
- **Valeur** : meilleure vue de la gamme fonctionnelle Rapports.
- **Statut** : R1–R6 déclarés faits ; R7–R9 ouverts.
- **Fiabilité actuelle** : élevée pour la roadmap, moyenne pour les détails UI.
- **Décision ouverte** : rebaseliner les KPI et filtres réellement attendus.

### 9. `P6-PLAN.md`

- **Objet** : AuthZ production-grade, correspondant à P6b.
- **Valeur** : modes csv/sql/shadow, versionnement et runbook.
- **Statut** : code largement livré ; cutover production non prouvé.
- **Fiabilité actuelle** : élevée sur l'architecture.
- **Décision ouverte** : planifier et prouver la bascule SQL.

### 10. `BACKLOG_SPRINT_V1_IMPORT_CLASSEMENT_GED.md`

- **Objet** : huit sprints de la V1 documentaire.
- **Valeur** : référence produit la plus détaillée pour import et classement.
- **Statut** : S1–S4 et S7 très couverts, S5/S6 partiels, S8 ouvert.
- **Fiabilité actuelle** : élevée pour les règles, moyenne pour les statuts.
- **Décision ouverte** : rebaseliner S5 et clôturer S8.

### 11. `PLAN_REPARATION_GED237.md`

- **Objet** : checklist transversale P0–P7.
- **Valeur** : historique des remédiations.
- **Statut** : obsolète comme outil de pilotage ; plusieurs cases contredisent
  le code et les plans de clôture.
- **Fiabilité actuelle** : faible sur les statuts.
- **Décision ouverte** : conserver comme archive, ne plus le mettre à jour.

### 12. `PERT_GLOBAL_GED237.md`

- **Objet** : dépendances macro P0–P7.
- **Valeur** : compréhension du chemin critique historique.
- **Statut** : obsolète sur l'avancement, notamment P4 « en cours ».
- **Fiabilité actuelle** : moyenne sur les dépendances, faible sur le statut.
- **Décision ouverte** : remplacer par une roadmap actuelle orientée outcomes.

### 13. `PLAN_REFACTOR_FRONTEND_SRP.md`

- **Objet** : découpage de composants frontend très volumineux.
- **Valeur** : plan technique encore pertinent.
- **Statut** : non démarré ; métriques dépassées.
- **Fiabilité actuelle** : élevée sur le problème, moyenne sur le découpage.
- **Décision ouverte** : lancer après stabilisation pilote ou cibler les zones
  empêchant directement les tests.

### 14. `PLAN_P6.md`

- **Objet** : Qualité, CI et DevSecOps.
- **Valeur** : seuils, outils et gates de livraison.
- **Statut** : grande partie présente ; activation opérationnelle partielle.
- **Fiabilité actuelle** : élevée sur la cible, moyenne sur l'adoption.
- **Décision ouverte** : prouver branch protection, hooks et release signée.

### 15. `PLAN_RAPPORTS_STATISTIQUES_VERSIONS_SPRINTS.md`

- **Objet** : vision, versions et sprints Rapports.
- **Valeur** : bonne segmentation V1/V1.5/V2.
- **Statut** : cases non mises à jour malgré R1–R6 présents.
- **Fiabilité actuelle** : élevée pour la vision, faible pour le statut.
- **Décision ouverte** : conserver comme roadmap en supprimant l'ambiguïté des
  cases historiques.

### 16. `PLAN_TECHNIQUE_V1_IMPORT_CLASSEMENT_GED.md`

- **Objet** : contrat technique cible de la V1 documentaire.
- **Valeur** : source principale des règles de données, API et flux.
- **Statut** : largement réalisé sauf contrat Espaces et certains droits.
- **Fiabilité actuelle** : élevée comme spécification.
- **Décision ouverte** : implémenter la cible Espaces ou réduire la promesse.

### 17. `RETEX_RAPPORTS_STATISTIQUES_UI.md`

- **Objet** : décisions UX issues de la réalisation Rapports.
- **Valeur** : document normatif le plus proche de l'interface actuelle.
- **Statut** : actuel.
- **Fiabilité actuelle** : élevée.
- **Décision ouverte** : officialiser ses arbitrages face aux anciens plans.

## 4. Contradictions structurantes

1. **Double P6** : AuthZ et CI portent le même identifiant.
2. **P5/P6b non faits vs faits** : `PLAN_REPARATION` contredit le code et les
   plans de clôture.
3. **P7 à 100 %** : affirmation incompatible avec les écarts Espaces et menus.
4. **Espaces livrés vs partiels** : backlog avril et audit juillet divergent.
5. **Administration classement** : prévue sous `/rules`, livrée sous
   `/classement`.
6. **Rapports** : plans MVP/Versions non cochés, alors que R1–R6 existent.
7. **Ordre/libellés Rapports** : anciens backlogs vs RETEX et code actuel.
8. **Recette** : IDs du guide différents des IDs Playwright.
9. **Sitemap** : URLs tenantées et modules absents, routes réelles non listées.
10. **Onboarding** : route cible `/onboarding` inexistante ; assistants intégrés
    aux pages réelles.

## 5. Décisions Product Owner prioritaires

### D1 — Contrat Espaces V1

- **Options** : implémenter filtres/pagination/arbre logique ou réduire la
  promesse.
- **Recommandation** : implémenter filtres et pagination serveur ; conserver
  l'arbre organisationnel en V1 et reporter l'arbre logique complet.
- **Impact** : performance, compréhension et crédibilité du pilote.
- **Preuve attendue** : tests API + E2E sur corpus volumineux.

### D2 — Clôture Sprint 8

- **Options** : accepter les tests mockés ou imposer une recette réelle.
- **Recommandation** : recette PostgreSQL/Redis et parcours non mockés avant
  statut V1 terminé.
- **Impact** : risque de régression et confiance institutionnelle.
- **Preuve attendue** : rapport de campagne daté.

### D3 — AuthZ production

- **Options** : rester CSV ou exécuter shadow puis SQL.
- **Recommandation** : suivre le runbook shadow → SQL avec rollback testé.
- **Impact** : cohérence multi-instance et gouvernance des politiques.
- **Preuve attendue** : absence d'écarts non expliqués et benchmark.

### D4 — Produit Rapports V1.1

- **Options** : démarrer R7 ou fermer d'abord filtres/tests/KPI.
- **Recommandation** : tests API, droits et filtres globaux avant R7.
- **Impact** : fiabilité du cockpit et valeur décisionnelle.
- **Preuve attendue** : données cohérentes entre filtres, onglets et exports.

### D5 — Référentiel de recette

- **Options** : maintenir deux nomenclatures ou les réconcilier.
- **Recommandation** : matrice unique SC métier ↔ spec Playwright ↔ route/API.
- **Impact** : traçabilité Go/No-Go.
- **Preuve attendue** : chaque parcours critique possède un statut exécuté.

### D6 — Sitemap et routes fantômes

- **Options** : implémenter toute la vision, retirer les promesses ou séparer V1/V2.
- **Recommandation** : marquer le sitemap aspirationnel et retirer/câbler les
  entrées de menu non livrées.
- **Impact** : attentes utilisateur et support.
- **Preuve attendue** : navigation sans page « en travaux » involontaire.

### D7 — Archivage légal

- **Options** : phase pilote ou roadmap ultérieure.
- **Recommandation** : ne pas le promettre contractuellement tant que rétention,
  gel légal et preuve de conservation ne sont pas conçus.
- **Impact** : conformité.
- **Preuve attendue** : exigences juridiques et politique validées.

### D8 — Dette SRP frontend

- **Options** : refactor global ou extraction ciblée.
- **Recommandation** : extraction ciblée des parties qui empêchent tests et
  maintenance d'Import/Classement.
- **Impact** : vélocité et risque de régression.
- **Preuve attendue** : composants réduits, tests ciblés, comportement inchangé.

## 6. Conclusion PO

GED237 possède une conception riche, mais elle doit être lue comme une
bibliothèque de décisions et d'intentions, non comme un tableau de bord actuel.
La vision produit cohérente est une GED institutionnelle multi-tenant combinant
classement, circuits hiérarchiques, audit et pilotage. Le prochain travail du PO
est moins d'ajouter des fonctionnalités que de fermer l'écart entre cette
promesse et une V1 démontrable, mesurable et exploitable en pilote.
