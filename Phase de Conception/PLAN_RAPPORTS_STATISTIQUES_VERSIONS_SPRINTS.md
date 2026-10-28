# Plan Versions & Sprints - Rapports & Statistiques

## Objet

Ce document fixe la transformation du module `Rapports & statistiques` a partir de l'existant, avec :

- le **cadrage cible**
- ce qui **reste dans le module Reports**
- ce qui doit **renvoyer vers un autre menu existant**
- le **plan de mise en oeuvre par version**
- le **detail par sprint**
- la **priorite**
- un **PERT simplifie**

Le principe directeur retenu est :

**Voir -> Comprendre -> Filtrer -> Agir -> Exporter**

Le module `Rapports & statistiques` doit rester un **centre de pilotage**, pas un doublon de :

- `Audit & tracabilite`
- `Agents & Roles`
- `Structure hierarchique`
- `Plan de classement`
- `Explorateur documentaire`

---

## Vision cible

La page principale garde le nom :

- `Rapports & statistiques`

Et, a terme, elle s'organise en **6 onglets maximum** :

- `Synthese`
- `Activite documentaire`
- `Workflows & delais`
- `Services`
- `Qualite documentaire`
- `Audit & securite`

Les actions globales doivent rester des **actions**, pas des onglets :

- `Filtrer`
- `Exporter`
- `Generer un rapport`
- `Planifier un rapport` en V2

---

## Regles d'architecture produit

- [ ] `Reports` reste un module de **pilotage et lecture**
- [ ] les actions correctives detaillees doivent renvoyer vers les modules deja existants
- [ ] ne pas dupliquer dans `Reports` les pages deja specialisees ailleurs
- [ ] limiter la profondeur UX a :
  - [ ] `Module -> Onglet -> Detail`
- [ ] ne pas transformer `Reports` en fourre-tout analytique

---

## Transformation de l'existant

## Etat actuel principal

Le module `Reports` contient deja, cote frontend :

- `Vue d'ensemble / Synthese`
- `Documents`
- `Circuits`
- `Classement`
- `Evolution`
- `Exports`

Il existe aussi deja dans le menu tenant :

- `Audit & tracabilite`
- `Acces & permissions`
- `Structure hierarchique`
- `Explorateur documentaire`
- `Agents & roles`
- `Traitement des documents`
- `Plan de classement`

## Transformation cible

- [ ] `Synthese` actuel -> reste `Synthese`
- [ ] `Documents` -> devient `Activite documentaire`
- [ ] `Circuits` -> devient `Workflows & delais`
- [ ] `Classement` -> est absorbe en V1 dans `Activite documentaire`, puis alimente `Qualite documentaire`
- [ ] `Evolution` -> n'est plus un onglet autonome de destination finale ; ses graphes sont reinjectes dans les onglets metier
- [ ] `Exports` -> devient une action globale `Generer un rapport` + exports contextuels

---

## Ce qui reste dans Reports vs ce qui renvoie vers un autre menu

## Reste dans `Rapports & statistiques`

- [ ] KPI institutionnels
- [ ] volumes documentaires
- [ ] tendances documentaires
- [ ] retards
- [ ] blocages workflow
- [ ] charge par service
- [ ] documents non classes
- [ ] metadonnees incompletes
- [ ] synthese audit et securite
- [ ] exports et generation de rapports

## Doit renvoyer vers un autre menu existant

### `Audit & tracabilite`

- [ ] journal detaille des actions
- [ ] historique complet des consultations
- [ ] details des acces sensibles
- [ ] investigation des actions hors normes

Dans `Reports`, on garde seulement :

- [ ] alertes audit
- [ ] acces refuses
- [ ] actions sensibles recentes
- [ ] bouton `Voir le journal detaille`

### `Acces & permissions`

- [ ] politiques d'acces
- [ ] confidentialite
- [ ] gestion des droits
- [ ] comptes eleves / changements de roles

Dans `Reports`, on garde seulement :

- [ ] indicateurs de risque
- [ ] comptes inactifs
- [ ] changements recents sensibles

### `Structure hierarchique`

- [ ] organigramme
- [ ] lecture structurelle
- [ ] details des unites

Dans `Reports`, on garde seulement :

- [ ] performance par service
- [ ] charge par unite
- [ ] comparatifs entre structures

### `Agents & roles`

- [ ] gestion des agents
- [ ] roles et permissions
- [ ] groupes
- [ ] pilotage individuel detaille si autorise

Dans `Reports`, on garde seulement :

- [ ] utilisateurs actifs / inactifs
- [ ] charge par service
- [ ] eventuellement synthese par utilisateur pour profils habilites

### `Plan de classement`

- [ ] correction des regles
- [ ] simulation metier
- [ ] administration du plan

Dans `Reports`, on garde seulement :

- [ ] documents non classes
- [ ] documents mal classes
- [ ] regles qui echouent le plus

### `Explorateur documentaire`

- [ ] action sur les documents
- [ ] navigation et consultation
- [ ] traitement concret des espaces

Dans `Reports`, on garde seulement :

- [ ] vue de pilotage
- [ ] volumes
- [ ] anomalies

---

## Decoupage cible par version

## V1 - Centre de pilotage institutionnel

### Scope

- [ ] `Synthese`
- [ ] `Activite documentaire`
- [ ] `Workflows & delais`
- [ ] `Services`
- [ ] `Generer un rapport`

### Hors scope V1

- [ ] onglet complet `Qualite documentaire`
- [ ] onglet complet `Audit & securite`
- [ ] securite avancee
- [ ] archivage reglementaire detaille
- [ ] rapports planifies
- [ ] analyses predictives

### Priorite

- [ ] Priorite 1 : `Synthese`
- [ ] Priorite 2 : `Activite documentaire`
- [ ] Priorite 3 : `Workflows & delais`
- [ ] Priorite 4 : `Services`
- [ ] Priorite 5 : `Generer un rapport`

## V1.5 - Pilotage renforce

### Scope

- [ ] `Qualite documentaire`
- [ ] synthese `Audit & securite`
- [ ] exports plus riches
- [ ] vues rapides `En retard`, `A valider`, `A archiver`, `Anomalies`

### Priorite

- [ ] Priorite 1 : `Qualite documentaire`
- [ ] Priorite 2 : synthese `Audit & securite`
- [ ] Priorite 3 : exports specialises

## V2 - Gouvernance avancee

### Scope

- [ ] onglet complet `Audit & securite`
- [ ] indicateurs d'archivage et conservation
- [ ] rapports planifies
- [ ] alertes et recommandations systeme
- [ ] analyses predictives des retards
- [ ] tableaux de bord adaptes par profil

---

## Plan de realisation par sprint

## Sprint R1 - Refonte de structure du module Reports

### Objectif

Faire converger le module `Reports` actuel vers le nouveau decoupage de pilotage.

### Livrables

- [ ] figer les onglets V1 cibles :
  - [ ] `Synthese`
  - [ ] `Activite documentaire`
  - [ ] `Workflows & delais`
  - [ ] `Services`
- [ ] supprimer la logique d'onglet autonome `Evolution`
- [ ] reclasser `Classement` dans `Activite documentaire`
- [ ] transformer `Exports` en action globale + export contextuel
- [ ] nettoyer le jargon et harmoniser le vocabulaire

### Impact

- [ ] Impact UX : fort
- [ ] Impact frontend : moyen
- [ ] Impact backend : faible

### Priorite

- [ ] Critique

## Sprint R2 - Onglet `Synthese`

### Objectif

Faire de `Synthese` un vrai ecran d'accueil de pilotage institutionnel.

### Livrables

- [ ] KPI critiques uniquement :
  - [ ] total documents
  - [ ] en cours
  - [ ] valides
  - [ ] en retard
  - [ ] delai moyen
  - [ ] taux de traitement
- [ ] bloc `Alertes importantes`
- [ ] bloc `Derniers blocages critiques`
- [ ] detail consultable compact

### Impact

- [ ] Impact UX : fort
- [ ] Impact frontend : moyen
- [ ] Impact backend : moyen

### Priorite

- [ ] Critique

## Sprint R3 - Onglet `Activite documentaire`

### Objectif

Regrouper les lectures documentaires dans un onglet metier clair.

### Livrables

- [ ] documents par type
- [ ] documents par statut
- [ ] documents par service
- [ ] evolution du volume documentaire
- [ ] documents crees / recus / valides / archives
- [ ] urgents / confidentiels si donnees disponibles
- [ ] reprise des vues `classement` utiles :
  - [ ] non classes
  - [ ] metadonnees incompletes
  - [ ] activites de classement dominantes

### Impact

- [ ] Impact UX : fort
- [ ] Impact frontend : moyen
- [ ] Impact backend : moyen a fort

### Priorite

- [ ] Tres haute

## Sprint R4 - Onglet `Workflows & delais`

### Objectif

Rendre visibles les goulets d'etranglement administratifs.

### Livrables

- [ ] dossiers par etape
- [ ] etapes bloquantes
- [ ] temps moyen par etape
- [ ] workflows termines
- [ ] workflows en retard
- [ ] delais moyens par service
- [ ] attente de signature / attente d'avis / attente de transmission si donnees disponibles

### Impact

- [ ] Impact UX : fort
- [ ] Impact frontend : moyen
- [ ] Impact backend : fort

### Priorite

- [ ] Tres haute

## Sprint R5 - Onglet `Services`

### Objectif

Piloter la performance documentaire par unite sans dupliquer `Structure hierarchique` ou `Agents & roles`.

### Livrables

- [ ] documents par service
- [ ] documents en retard par service
- [ ] delai moyen par service
- [ ] charge documentaire par service
- [ ] utilisateurs actifs / inactifs en synthese si habilitations compatibles
- [ ] liens vers :
  - [ ] `Structure hierarchique`
  - [ ] `Agents & roles`

### Impact

- [ ] Impact UX : moyen a fort
- [ ] Impact frontend : moyen
- [ ] Impact backend : fort

### Priorite

- [ ] Haute

## Sprint R6 - Action globale `Generer un rapport`

### Objectif

Sortir l'export du role d'onglet pour en faire une action metier permanente.

### Livrables

- [ ] bouton global `Generer un rapport`
- [ ] modale ou page dediee
- [ ] choix du type de rapport
- [ ] periode
- [ ] service / direction
- [ ] format `PDF / Excel / CSV`
- [ ] niveau de detail
- [ ] generation et telechargement

### Rapports V1 cibles

- [ ] rapport mensuel d'activite
- [ ] rapport des retards
- [ ] rapport par service
- [ ] rapport des workflows

### Impact

- [ ] Impact UX : fort
- [ ] Impact frontend : moyen
- [ ] Impact backend : moyen

### Priorite

- [ ] Haute

## Sprint R7 - V1.5 `Qualite documentaire`

### Objectif

Ouvrir la brique de sante documentaire sans noyer la V1.

### Livrables

- [ ] documents sans categorie
- [ ] metadonnees manquantes
- [ ] documents sans reference administrative
- [ ] documents non classes
- [ ] doublons potentiels
- [ ] documents sans niveau de confidentialite
- [ ] taux de completude des metadonnees

### Impact

- [ ] Impact UX : moyen
- [ ] Impact frontend : moyen
- [ ] Impact backend : fort

### Priorite

- [ ] Moyenne

## Sprint R8 - V1.5 `Audit & securite` en synthese

### Objectif

Faire remonter les signaux sensibles sans dupliquer le journal detaille.

### Livrables

- [ ] acces refuses
- [ ] actions sensibles recentes
- [ ] telechargements de documents sensibles
- [ ] changements recents de droits
- [ ] lien `Voir le journal detaille`

### Impact

- [ ] Impact UX : moyen
- [ ] Impact frontend : faible a moyen
- [ ] Impact backend : moyen

### Priorite

- [ ] Moyenne

## Sprint R9 - V2 Gouvernance avancee

### Livrables

- [ ] onglet complet `Audit & securite`
- [ ] indicateurs d'archivage
- [ ] rapports planifies
- [ ] recommandations systeme
- [ ] previsions de retards
- [ ] dashboards par profil

### Priorite

- [ ] Basse a moyen terme

---

## PERT simplifie

## Lots

- [ ] Lot A - Refonte structurelle du module Reports
- [ ] Lot B - Donnees de synthese
- [ ] Lot C - Donnees workflow et delais
- [ ] Lot D - Donnees par service
- [ ] Lot E - Exports et generation de rapports
- [ ] Lot F - Qualite documentaire
- [ ] Lot G - Audit & securite

## Dependances

- [ ] `R1` -> prerequis de tous les autres sprints frontend Reports
- [ ] `R2` depend de `R1`
- [ ] `R3` depend de `R1`
- [ ] `R4` depend de `R1` et d'agregations workflow backend
- [ ] `R5` depend de `R1` et d'agregations par unite backend
- [ ] `R6` depend de `R2`, `R3`, `R4`, `R5`
- [ ] `R7` depend d'un cadrage des regles de qualite
- [ ] `R8` depend d'un cadrage des habilitations et des sources audit

## Chemin critique probable

- [ ] `R1` Refonte structurelle
- [ ] `R2` Synthese
- [ ] `R4` Workflows & delais
- [ ] `R5` Services
- [ ] `R6` Generer un rapport

---

## Priorisation globale

## P1 - A faire en premier

- [ ] Refonte des onglets `Reports`
- [ ] `Synthese`
- [ ] `Activite documentaire`
- [ ] `Workflows & delais`

## P2 - A faire ensuite

- [ ] `Services`
- [ ] `Generer un rapport`

## P3 - A ouvrir en renfort

- [ ] `Qualite documentaire`
- [ ] synthese `Audit & securite`

## P4 - A reserver a V2

- [ ] securite avancee
- [ ] archivage detaille
- [ ] recommandations automatiques
- [ ] rapports planifies
- [ ] tableaux de bord adaptes par profil

---

## Criteres d'acceptation

- [ ] le module `Reports` reste lisible et decisionnel
- [ ] aucun onglet ne duplique un module specialise deja existant
- [ ] les onglets repondent chacun a une question metier claire
- [ ] `Synthese` reste une page de lecture en moins de 30 secondes
- [ ] les filtres sont communs et compréhensibles
- [ ] les exports sont accessibles via une action globale claire
- [ ] le jargon technique n'apparait pas dans l'UI finale
- [ ] `npm run typecheck` reste vert
- [ ] les nouvelles agregations backend sont documentees avant integration frontend

---

## Decision produit recommandee

Pour la prochaine implementation, la sequence recommandee est :

1. [ ] figer les onglets V1
2. [ ] refondre l'existant `Reports` sur cette base
3. [ ] terminer `Synthese`
4. [ ] terminer `Activite documentaire`
5. [ ] terminer `Workflows & delais`
6. [ ] ouvrir `Services`
7. [ ] sortir `Generer un rapport`
8. [ ] seulement ensuite, ouvrir `Qualite documentaire` et la synthese `Audit & securite`
