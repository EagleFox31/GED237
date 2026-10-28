# Backlog Sprint par Sprint — Rapports & Statistiques

## 1. Objet

Ce document transforme le cadrage défini dans :

- [PLAN_RAPPORTS_STATISTIQUES_MVP.md](</mnt/e/GED237/Phase de Conception/PLAN_RAPPORTS_STATISTIQUES_MVP.md>)
- [PLAN_RAPPORTS_STATISTIQUES_VERSIONS_SPRINTS.md](</mnt/e/GED237/Phase de Conception/PLAN_RAPPORTS_STATISTIQUES_VERSIONS_SPRINTS.md>)

en backlog exécutable, centré sur le menu :

- `Rapports & statistiques`

Le principe retenu est :

- `Reports` = centre de pilotage institutionnel
- pas de doublon des modules spécialisés
- les vues détaillées et actions correctives renvoient vers :
  - `Audit & traçabilité`
  - `Agents & rôles`
  - `Structure hiérarchique`
  - `Plan de classement`
  - `Explorateur documentaire`

---

## 2. Hypothèses de pilotage

- cadence : sprints courts de 1 à 2 semaines
- priorité : valeur métier lisible avant sophistication analytique
- qualité minimale par sprint :
  - `typecheck` frontend vert
  - contrôles backend verts
  - UI cliquable
  - libellés métier relus
  - aucun doublon fonctionnel évident avec les autres menus

---

## 3. Vision globale des versions

## V1 — Centre de pilotage institutionnel

Livrer :

- `Synthèse`
- `Activité documentaire`
- `Workflows & délais`
- `Services`
- `Générer un rapport`

## V1.5 — Contrôle renforcé

Livrer :

- `Qualité documentaire`
- synthèse `Audit & sécurité`
- exports plus riches

## V2 — Gouvernance avancée

Livrer :

- audit & sécurité détaillés
- archivage & conservation pilotés
- rapports planifiés
- alertes intelligentes
- analyses prédictives

---

## 4. Priorités

## Priorité P1

- `Synthèse`
- `Activité documentaire`
- `Workflows & délais`

## Priorité P2

- `Services`
- `Générer un rapport`

## Priorité P3

- `Qualité documentaire`
- synthèse `Audit & sécurité`

## Priorité P4

- archivage détaillé
- rapports planifiés
- recommandations automatiques
- vues avancées par profil

---

## 5. Backlog détaillé

## Sprint R1 — Refonte structurelle du module Reports

### But

Transformer la page actuelle en vrai module de pilotage, cohérent avec le menu tenant.

### Livrables

- [x] figer les onglets V1 cibles :
  - [x] `Synthèse`
  - [x] `Activité documentaire`
  - [x] `Workflows & délais`
  - [x] `Services`
- [x] retirer la logique produit d’un onglet autonome `Évolution`
- [x] réinjecter les tendances dans les onglets métier utiles
- [x] absorber la logique `Classement` utile dans `Activité documentaire`
- [x] sortir les exports du rôle d’onglet pour en faire une action globale
- [x] réserver l’emplacement et le contrat UI du bouton `Générer un rapport`
- [x] harmoniser les libellés métier

### Questions métier à figer

- [x] `Synthèse` : `Quelle est la situation générale ?`
- [x] `Activité documentaire` : `Quels documents circulent ?`
- [x] `Workflows & délais` : `Où ça bloque ?`
- [x] `Services` : `Quels services sont chargés ou en retard ?`

### Tâches frontend

- [x] refactor des tabs de `ReportsPage`
- [x] réalignement de `reportsViewModel.ts`
- [x] réalignement de `ReportsFiltersBar.tsx`
- [x] réalignement de `ReportsTableSection.tsx`
- [x] réalignement du bouton `Exporter`

### Tâches produit / UX

- [x] vérifier la non-duplication avec `Audit`, `Users`, `Org`, `Classement`, `Spaces`
- [x] valider le vocabulaire final de chaque onglet

### Définition de terminé

- [x] l’utilisateur comprend immédiatement les 4 onglets V1
- [x] `Vue d’ensemble` n’est plus polluée par des éléments transverses
- [x] les anciens modes supprimés ne hantent plus le view model ni les exports
- [x] les filtres globaux fonctionnent sur tous les onglets où ils sont pertinents
- [x] les états vides sont propres et cohérents
- [ ] les droits d’accès restent respectés

---

## Sprint R2 — Onglet Synthèse

### But

Faire de `Synthèse` un cockpit d’accueil lisible en moins de 30 secondes.

### Livrables

- [ ] KPI critiques :
  - [x] documents reçus / suivis
  - [x] documents en cours
  - [ ] documents validés
  - [x] documents en retard ou retards estimés selon la fiabilité des données disponibles
  - [ ] délai moyen
  - [x] taux de traitement
- [x] bloc `Alertes importantes`
- [x] bloc `Derniers blocages critiques`
- [x] bloc de détail compact

### Tâches backend

- [ ] stabiliser les agrégats de synthèse existants
- [ ] documenter les limites des données si certaines métriques ne sont pas fiables
- [x] marquer explicitement les indicateurs estimés ou proxy

### Tâches frontend

- [x] finaliser les cartes KPI
- [x] finaliser les cartes d’attention
- [x] nettoyer les libellés

### Définition de terminé

- [x] la synthèse est utile même sans ouvrir les autres onglets
- [x] aucun KPI décoratif ou ambigu
- [x] les indicateurs peu fiables sont soit retirés, soit marqués `Estimation`

---

## Sprint R3 — Onglet Activité documentaire

### But

Répondre clairement à la question :

- `Quels documents circulent dans l’institution ?`

### Livrables

- [x] documents par type
- [x] documents par statut
- [x] aperçu léger de la répartition documentaire par service, si disponible, sans analyse de performance
- [x] évolution du volume documentaire
- [x] documents créés / validés / archivés
- [ ] documents urgents si disponible
- [ ] documents confidentiels si disponible
- [x] points de vigilance documentaire visibles :
  - [x] non classés
  - [x] informations manquantes
  - [x] documents à revoir

### Tâches backend

- [x] enrichir `/reports/evolution`
- [x] exposer les agrégats documentaires manquants si besoin

### Tâches frontend

- [x] intégrer les courbes documentaires dans cet onglet
- [x] brancher le switch de série utile à l’activité documentaire
- [x] enrichir le tableau avec un découpage document plus métier

### Définition de terminé

- [x] l’onglet explique les volumes sans jargon
- [x] la lecture des documents non classés ou mal qualifiés est visible
- [x] l’onglet ne duplique ni `Services`, ni `Qualité documentaire`

---

## Sprint R4 — Onglet Workflows & délais

### But

Répondre clairement à la question :

- `Où ça bloque ?`

### Livrables

- [x] dossiers par étape
- [x] dossiers bloqués
- [x] workflows terminés / non terminés
- [x] temps moyen par étape
- [x] temps moyen par service
- [x] étapes les plus lentes
- [x] attentes de signature / d’avis / de transmission si disponibles

### Tâches backend

- [x] exposer des agrégats workflow par étape
- [x] exposer des données de délais cohérentes
- [ ] préparer les futures séries `workflow_steps_completed` et `workflow_steps_rejected`

### Tâches frontend

- [x] créer les KPI workflow propres
- [x] ajouter une vue détaillée par étape
- [x] ajouter les alertes de blocage

### Définition de terminé

- [x] l’onglet permet d’identifier les goulets d’étranglement
- [x] les délais affichés sont cohérents et explicables

---

## Sprint R5 — Onglet Services

### But

Répondre à :

- `Quelle direction ou quel service est saturé ?`

### Livrables

- [x] documents par service
- [x] documents en attente par service
- [x] documents en retard par service
- [x] délai moyen par service
- [x] charge documentaire par service
- [x] utilisateurs actifs / inactifs en synthèse si les droits le permettent

### Tâches backend

- [x] exposer des agrégats par unité
- [ ] rendre ces agrégats filtrables par période

### Tâches frontend

- [x] tableau comparatif par service
- [x] cartes ou vues rapides pour services en difficulté
- [x] liens vers `Structure hiérarchique` et `Agents & rôles`

### Définition de terminé

- [x] l’onglet aide au pilotage sans dupliquer la gestion RH ou organique

---

## Sprint R6 — Action globale Générer un rapport

### But

Sortir les exports du statut d’onglet et les transformer en action globale officielle.

### Livrables

- [x] bouton global `Générer un rapport`
- [x] modale ou page dédiée
- [x] choix du type de rapport
- [x] période
- [x] service ou direction
- [ ] format :
  - [x] PDF
  - [x] Excel
  - [x] CSV
- [x] niveau de détail
- [x] action `Générer`

### Rapports V1 cibles

- [x] rapport mensuel d’activité
- [x] rapport des retards
- [x] rapport par service
- [x] rapport des workflows

### Tâches frontend

- [x] composant réutilisable de génération de rapport
- [x] liaison avec les filtres globaux
- [x] emplacement réservé dès `R1`, génération opérationnelle livrée en `R6`

### Tâches backend

- [ ] export serveur si nécessaire
- [x] ou au minimum export client stable et propre

### Définition de terminé

- [x] l’utilisateur n’a pas à chercher où exporter
- [x] les exports reprennent bien les filtres actifs

---

## Sprint R7 — V1.5 Qualité documentaire

### But

Répondre à :

- `Est-ce que notre GED est propre ?`

### Livrables

- [ ] documents sans catégorie
- [ ] documents sans référence administrative
- [ ] documents sans service propriétaire
- [ ] documents sans date officielle
- [ ] documents non classés
- [ ] doublons potentiels
- [ ] documents sans niveau de confidentialité
- [ ] documents sans durée de conservation
- [ ] taux de complétude des métadonnées

### Définition de terminé

- [ ] la dette documentaire devient visible et mesurable

---

## Sprint R8 — V1.5 Synthèse Audit & sécurité

### But

Faire remonter les signaux sensibles sans dupliquer le journal détaillé.

### Livrables

- [ ] accès refusés
- [ ] actions sensibles récentes
- [ ] téléchargements sensibles
- [ ] changements de droits récents
- [ ] lien vers `Audit & traçabilité`

### Définition de terminé

- [ ] l’admin voit les signaux sensibles
- [ ] l’investigation détaillée reste dans le module audit

---

## Sprint R9 — V2 Gouvernance avancée

### Livrables

- [ ] audit & sécurité détaillés
- [ ] archivage et conservation
- [ ] rapports planifiés
- [ ] alertes automatiques
- [ ] recommandations système
- [ ] prévision des retards
- [ ] variantes par profil

---

## 6. PERT simplifié

### Lots

- [ ] Lot A — structure du module Reports
- [ ] Lot B — synthèse institutionnelle
- [ ] Lot C — activité documentaire
- [ ] Lot D — workflows et délais
- [ ] Lot E — services
- [ ] Lot F — génération de rapport
- [ ] Lot G — qualité documentaire
- [ ] Lot H — audit & sécurité

### Dépendances

- [ ] `R1` précède tous les autres sprints Reports
- [ ] `R2` dépend de `R1`
- [ ] `R3` dépend de `R1`
- [ ] `R4` dépend de `R1` + agrégats workflow
- [ ] `R5` dépend de `R1` + agrégats services
- [ ] `R6` dépend de `R2`, `R3`, `R4`, `R5`
- [ ] `R7` dépend d’un cadrage des règles de qualité
- [ ] `R8` dépend d’un cadrage des habilitations et des sources audit

### Chemin critique probable

- [ ] `R1` -> `R2` -> `R4` -> `R5` -> `R6`

---

## 7. Arbitrages produit à respecter

- [ ] ne pas faire de `Reports` un second module d’audit
- [ ] ne pas y remettre la gestion détaillée des agents
- [ ] ne pas y remettre l’administration du plan de classement
- [ ] ne pas y remettre l’exécution métier de l’explorateur documentaire
- [ ] réserver `Qualité documentaire` à V1.5 si le planning est serré
- [ ] garder la priorité métier sur :
  - [ ] retards
  - [ ] blocages
  - [ ] charge par service
  - [ ] exports officiels

---

## 8. Critères d’acceptation globaux

- [ ] `Rapports & statistiques` reste un centre de pilotage lisible
- [ ] chaque onglet répond à une question métier claire
- [ ] aucun onglet ne duplique un menu spécialisé existant
- [ ] les filtres sont compréhensibles et communs
- [ ] les exports sont accessibles via une action claire
- [ ] les graphes ne sont pas décoratifs
- [ ] le jargon technique ne remonte pas dans l’UI
- [ ] chaque indicateur affiché a une source backend claire ou est explicitement marqué comme estimation
- [ ] `npm run typecheck` reste vert
- [ ] les dépendances backend sont documentées avant intégration frontend
