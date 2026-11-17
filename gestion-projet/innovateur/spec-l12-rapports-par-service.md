# Spec fonctionnelle L12 : rapports par service

- **Pour** : B (API), F (écrans), Q (critères), O (planifie), PO (trois décisions, § 6). Innovateur, 2026-11-17, sur `main` 0503181. Post-rc1 (rien ne fusionne avant le tag du 24/11), sauf la part rc.1 décidée le 17/11 (§ 2, PR de B).
- **Besoin** : Expression de besoin § 3 (« Managers : … accès aux rapports ») ; `MATRICE_TRACABILITE_PRODUIT.md` l. 50 (« Rapports Services … Ajouter période et scope ») et l. 66 (« Admin Service … KPI parfois tenant-wide »). Lot L12 de `lot-l11-fonctionnalites.md`.
- **S'appuie sur** : #175 (menu « Rapports » du Manager, en file) et #159 (règle de portée unique `resolve_report_scope`, brouillon post-rc1). L12 se branche **après** ces deux PR, sans les réécrire.
- `Vérifié` = lu dans `main` ou dans la PR citée ; `Proposé` = à valider (B, F ou PO).

## 1. Point de départ (`Vérifié`)

| Sujet | Aujourd'hui | Source |
|---|---|---|
| Routes | `GET /reports/evolution`, `/document-activity`, `/workflow-activity`, `/service-activity` ; permission `analytics.tenant:read` | `reports.py` l. 29, 78, 118, 158 |
| Période | seule `/evolution` accepte `date_from` et `date_to` (30 derniers jours par défaut, 400 si `date_from > date_to`) ; les trois autres n'ont **aucun filtre de période** | `reports_service.py` l. 148-149, 306-307, 977-986 |
| Portée | `manager` et `reader` : leur service seulement (`org_unit_id` égal au leur, sinon 403), sous-services inclus par défaut. Tous les autres rôles voient tout le tenant | `reports.py` l. 50-59 ; `tenant_guard.py` l. 23-39 |
| Sous-service | un Manager ne peut pas viser un de ses sous-services : seul son propre service est accepté | `assert_org_unit_scope` |
| Fuites de portée | `imports_needing_review` et les compteurs `local_organize_*` sont comptés sur tout le tenant, même pour un Manager | `reports_service.py` l. 176, 198, 646, 656 |
| Liste des services | coupée aux 12 premiers (`services[:12]`) ; services à zéro retirés | `reports_service.py` l. 391 |
| Lecteur | aucune permission `analytics.tenant` : 403 sur `/reports/*` | `policy.csv` |
| Écran | `ReportsPage` : onglets Synthèse, Workflows, Services, Documents ; aucun filtre de période ni de service (`useReportsFilters.ts` ne garde que le mode d'affichage) | `ReportsPage.tsx` l. 44-58 |
| Menu | « Rapports » pour l'admin du tenant seulement ; #175 l'ajoute au Manager (sans l'onglet Synthèse) | `menuConfig.ts` l. 46 ; #175 |

## 2. Qui voit quoi

| Rôle (code) | Périmètre des rapports | Choix du service | Menu « Rapports » |
|---|---|---|---|
| `super_admin` | tout tenant (`tenant_id`) | tout service | oui (existant) |
| `tenant_admin` | tout le tenant | tout service, avec ou sans sous-services | oui (existant) |
| `auditor` | tout le tenant, lecture | tout service | **oui, en L12** (D-L12-3, décision PO du 17/11) |
| `unit_admin` | son service et ses sous-services (D-L12-1, **décision PO du 17/11**, **en rc.1** par B) ; avant : tout le tenant | dans son périmètre (choix en L12) | inchangé |
| `manager` | son service et ses sous-services (inchangé) | **nouveau en L12** : son service ou un de ses sous-services ; un service hors de son arbre → 403 | oui (#175) |
| `collaborator` | 403 sur `/reports/*` (D-L12-2, **décision PO du 17/11**, **en rc.1** par B) ; avant : tout le tenant par l'API, sans menu | — | non |
| `reader` | 403 (inchangé) | — | non |

Règle unique : la portée se calcule dans `resolve_report_scope` (#159) et s'applique à **tous** les compteurs de la réponse, y compris `imports_needing_review` et `local_organize_*`.

**Découpage décidé le 17/11 (décision PO, relayée par O)** :

| Où | Contenu | Qui |
|---|---|---|
| **rc.1, avant le gel** | D-L12-1 (`unit_admin` limité à son périmètre) ; D-L12-2 (`collaborator` → 403) ; signaux `imports_needing_review` et `local_organize_*` limités au périmètre du Manager | B |
| **L12, après le tag** | D-L12-3 (menu « Rapports » de l'auditeur) ; filtre de période (§ 3, § 4) ; choix du service et visée d'un sous-service ; écrans (§ 5) | B, F, Q |

## 3. Filtre de période

- **Paramètres** : `date_from` et `date_to` (dates, bornes incluses, fuseau du tenant, sinon UTC : B confirme), ajoutés à `/document-activity`, `/workflow-activity` et `/service-activity`, avec la même règle que `/evolution`.
- **Par défaut** : les 30 derniers jours. Erreur 400 si `date_from > date_to` ou si l'écart dépasse 366 jours (`Proposé`).
- **Deux familles de compteurs**, à nommer ainsi à l'écran :
  - **« Sur la période »** (flux, filtrés par les dates) : documents créés, documents classés automatiquement, documents mis en revue, imports terminés, étapes de validation terminées ou refusées.
  - **« À ce jour »** (stock, non filtrés) : documents en cours, circuits ouverts, retards (étape de plus de 5 jours), utilisateurs actifs (connexion dans les 30 jours).
- Les rapports programmés de #180 disent « les dates ne valent que pour l'évolution » : après L12, cette phrase devient fausse. Celle des deux PR qui fusionne en second met la docstring et le texte à jour.

## 4. Contrat d'API attendu (ajouts seulement, rien ne se retire)

```
GET /reports/service-activity?date_from=2026-10-01&date_to=2026-10-31&org_unit_id=<uuid>&recursive=true&limit=50
```

| Élément | Contrat |
|---|---|
| Paramètres nouveaux | `date_from`, `date_to` (date) ; `limit` (entier, 12 par défaut pour ne rien changer à l'existant, 200 au plus) |
| Réponse, nouveau bloc `filters` | `date_from`, `date_to` (valeurs appliquées, y compris par défaut), `org_unit_id`, `recursive`, `scope` (`tenant` ou `unit`) |
| Par service, nouveaux champs | `documents_created_in_period`, `workflow_steps_completed_in_period`, `workflow_steps_rejected_in_period` |
| Champs existants | inchangés (noms, types, sens) ; `total_services` compte tous les services avant `limit` |
| Erreurs | 400 dates invalides ; 403 service hors périmètre ou rôle sans droit ; message en français, sans détail interne |
| `/document-activity`, `/workflow-activity` | mêmes paramètres de dates et même bloc `filters` ; les compteurs de flux suivent la période |

Pas de nouvelle table ni de migration (`Déduit` : tout se calcule sur les tables existantes et la table de fermeture des services).

## 5. Écrans (F), sur le menu « Rapports » de #175

- **Barre de filtres** en haut des onglets Services, Documents et Workflows, sur une seule ligne :
  - **Période** : 7 jours, 30 jours (par défaut), ce trimestre, cette année, dates libres.
  - **Service** : liste en arbre limitée au périmètre du rôle, masquée si le périmètre ne compte qu'un service.
  - **Inclure les sous-services** : case à cocher, cochée par défaut.
- **Adresse partageable** : les filtres vont dans l'URL (`?du=…&au=…&service=…`). Un rechargement ou un lien collé rouvre la même vue.
- **Libellés** : chaque carte porte « Sur la période » ou « À ce jour ». L'aide passe par une icône « ? » en coin de carte, pas par un bandeau (règle UX du projet).
- **Onglet Services** : le texte vide de `ReportsPage.tsx` l. 47 (« dès que les agrégats par unité seront disponibles ») est remplacé par « Aucune activité sur la période ». Si `total_services` dépasse le nombre affiché, un lien « Voir tous les services (N) » apparaît.
- **Manager** : même écran, sans Synthèse (#175), la liste des services réduite à son arbre.
- **Sous 768 px** : les filtres passent sous le titre, sur deux lignes.

## 6. Décisions du PO (**décision PO du 17/11** : les trois recommandations validées)

| # | Question | Décision | Livraison |
|---|---|---|---|
| **D-L12-1** | L'admin de service (`unit_admin`) est-il limité à son service et ses sous-services dans les rapports ? | **Oui** (écart de la matrice l. 66). Un droit existant est retiré : à écrire dans le CHANGELOG. | rc.1, B |
| **D-L12-2** | Le collaborateur perd-il l'accès aux rapports par l'API ? | **Oui, 403**. B vérifie d'abord qu'aucun écran du collaborateur n'appelle `/reports/*`. | rc.1, B |
| **D-L12-3** | L'auditeur a-t-il le menu « Rapports » (lecture, tout le tenant) ? | **Oui** : il a déjà le droit côté API, seul le menu manque. | L12, après le tag |

## 7. Critères d'acceptation (Q)

Données : pile e2e, jeu de démo, deux services frères A et B, A1 sous-service de A ; un Manager de A ; un document créé il y a 40 jours dans A1.

| # | Critère | Type |
|---|---|---|
| CA1 | Manager de A : les services de `/reports/service-activity` sont A et A1, jamais B ; c'est un sous-ensemble strict de la liste de l'admin (reprend le test de #175) | API + e2e |
| CA2 | Manager de A, `org_unit_id=A1` → 200, seulement A1 ; `org_unit_id=B` → 403 | API |
| CA3 | **(rc.1)** Manager de A : `imports_needing_review` et `local_organize_*` ne comptent que A et A1 (un import en revue créé dans B n'apparaît pas) | API |
| CA4 | `date_from > date_to` → 400 ; écart de 367 jours → 400 | API |
| CA5 | Sans dates : `filters.date_from` vaut aujourd'hui − 30 jours et `filters.date_to` vaut aujourd'hui | API |
| CA6 | Le document d'il y a 40 jours n'entre pas dans `documents_created_in_period` sur 30 jours, et y entre sur 60 jours | API |
| CA7 | Les compteurs « À ce jour » sont identiques pour deux périodes différentes | API |
| CA8 | Admin du tenant avec plus de 12 services : `limit=200` les renvoie tous, et `total_services` est juste ; sans `limit`, la réponse est identique à celle d'avant L12 | API, non-régression |
| CA9 | **(rc.1)** `reader` → 403 ; `collaborator` → 403 (D-L12-2) ; `unit_admin` limité à son service et ses sous-services, un service frère → 403 (D-L12-1) | API |
| CA10 | Écran : les filtres sont dans l'URL ; un rechargement garde la vue ; le Manager ne voit que A et A1 dans la liste des services | e2e |
| CA11 | Temps : p95 < 2 s sur `/reports/service-activity` avec le jeu de démo (méthode de `measure_c3.py`) | mesure |
| CA12 | Les tests existants des rapports et de #159 restent verts | CI |

## 8. Découpage et coût (h-s, indicatif)

| Porteur | Travail | h-s |
|---|---|---|
| B, **rc.1** | D-L12-1, D-L12-2, portée des deux signaux ; tests CA3 et CA9 dans la même PR | ≈ 0,5 (`Déduit`, à confirmer par B) |
| B, L12 | dates sur trois routes, bloc `filters`, compteurs par période, `limit`, visée d'un sous-service (dans `resolve_report_scope`) | ≈ 0,75 |
| F, L12 | barre de filtres, URL, libellés, texte vide, lien « tous les services », menu de l'auditeur (D-L12-3) | 0,75 |
| Q, L12 | CA1, CA2, CA4 à CA8, CA10 à CA12 (tests d'API dans la suite backend, e2e manager) | 0,5 |

**Total** : 2,5 h-s, comme dans `lot-l11-fonctionnalites.md`, dont ≈ 0,5 avancé en rc.1. Ordre : la PR rc.1 de B d'abord ; puis, après le tag, #159 et #175 fusionnées, B, puis F et Q en parallèle. Si la PR rc.1 fusionne avant #159, #159 reprend ces règles dans `resolve_report_scope` et ses 14 tests (« comportement inchangé ») doivent être mis à jour.

**Risque** : un Manager qui vise un sous-service passe par la table de fermeture (`OrgUnitClosure`). Un test négatif (service frère → 403) est obligatoire (CA2).
