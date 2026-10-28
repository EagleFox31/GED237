# Matrice UAT ↔ E2E — GED237 — 2026-07-22

> Statut : Vérifié par lecture ; exécution des tests non réalisée
> Agent coordinateur : Cursor
> Recherche : sous-agent d'exploration
> Référence PERT : T07
> Sources : `Phase de Conception/GUIDE_TEST_FONCTIONNEL.md`,
> `frontend/e2e/specs/`, `frontend/e2e/fixtures/auth.fixture.ts`

## 1. Synthèse

Le guide UAT contient 37 scénarios. La suite Playwright contient 25 specs, mais
la correspondance n'est pas fiable :

- 4 scénarios sont couverts de façon convaincante ;
- 19 sont partiels ;
- 9 sont absents ;
- 5 familles sont désalignées par leur identifiant ou leur sens.

Le taux de traçabilité directe par identifiant est d'environ 35 %. Cette matrice
ne prouve pas que les tests passent : elle décrit seulement la couverture écrite.

## 2. Collisions d'identifiants à corriger

| ID | Sens UAT | Sens actuel E2E | Action |
|---|---|---|---|
| SC-RED-02 | Soumettre à validation | Nouvelle version | Réattribuer au scénario de soumission |
| SC-RED-03 | Corriger un retour | Partager un document | Créer le cycle retour/correction |
| SC-RED-04 | Nouvelle version | Supprimer/corbeille | Renommer le test version |
| SC-RED-05 | Supprimer brouillon | Recherche full-text | Renommer le test suppression |
| SC-PLAT-02 | Administrer AuthZ | Lister les ministères | Porter l'ID dans `authz.spec.ts` |
| SC-PLAT-03 | Santé AuthZ | Créer un ministère | Porter l'ID dans `authz.spec.ts` |
| SC-PLAT-04 | Métriques de refus | Lister utilisateurs globaux | Porter l'ID dans `authz.spec.ts` |
| SC-SEC-01 | Isolation document cross-tenant | Lecture policies AuthZ interdite | Réécrire en test BOLA document |
| SC-SEC-02 | Collaborateur ne valide pas | Lecteur sans upload | Tester approve → 403 |
| SC-SEC-03 | Document signé immuable | Écriture policy interdite | Tester modification document signé |

Collisions internes supplémentaires :

- `SC-UA-01` et `SC-UA-02` sont chacun utilisés deux fois ;
- `SC-ADM-RULES` désigne plusieurs cas différents.

## 3. Matrice par domaine

### Authentification

| UAT | Persona | Objectif | Preuve E2E écrite | État | Action |
|---|---|---|---|---|---|
| SC-AUTH-01 | Tous | Login MFA et landing par rôle | `auth.spec.ts`, `dashboards.spec.ts` | Partiel | Ajouter OTP erroné et ID explicite |
| SC-AUTH-02 | Connecté | Refresh silencieux | Aucune | Absent | Ajouter expiration + refresh |
| SC-AUTH-03 | Connecté | Logout et retour arrière bloqué | Aucune | Absent | Ajouter logout + redirect login |

### Collaborateur / Rédacteur

| UAT | Objectif | Preuve E2E écrite | État | Action |
|---|---|---|---|---|
| SC-RED-01 | Créer un brouillon | `documents.spec.ts` | Couvert/partiel | Ajouter taille/format invalides |
| SC-RED-02 | Soumettre à validation | `documents.spec.ts` sans ID | Partiel | Attribuer le bon ID |
| SC-RED-03 | Corriger après retour | Aucune chaîne multi-acteur | Absent | Créer retour → version → resoumission |
| SC-RED-04 | Nouvelle version | `redacteur.spec.ts` sous RED-02 | Désaligné | Renommer |
| SC-RED-05 | Supprimer brouillon | `redacteur.spec.ts` sous RED-04 | Désaligné | Renommer et tester statut non brouillon |

### Responsable / Valideur

| UAT | Objectif | Preuve E2E écrite | État | Action |
|---|---|---|---|---|
| SC-VAL-01 | Voir la bannette | `validation.spec.ts`, `workflow.spec.ts` | Partiel | Seed déterministe, aucun skip |
| SC-VAL-02 | Viser avec commentaire | mêmes specs | Partiel | Enchaîner après RED-02 |
| SC-VAL-03 | Rejeter avec motif | `validation.spec.ts` | Partiel | Ajouter cycle rejet + notification |
| SC-VAL-04 | Retourner pour correction | `validation.spec.ts` | Partiel | Relier à RED-03 |
| SC-VAL-05 | Signature finale | test conditionnel/skippé | Partiel | Rendre obligatoire si dans le scope |

### Admin Service

| UAT | Objectif | Preuve E2E écrite | État | Action |
|---|---|---|---|---|
| SC-RESP-01 | Affecter un cas orphelin | Aucune dédiée | Absent | Tester `/pending-assignments` |
| SC-RESP-02 | Créer un agent du service | `organization.spec.ts` avec tenant-admin | Partiel | Rejouer avec `unit_admin` |

### Admin Institution

| UAT | Objectif | Preuve E2E écrite | État | Action |
|---|---|---|---|---|
| SC-ADM-01 | Dashboard KPI | `dashboards.spec.ts` | Partiel | Vérifier KPI attendus |
| SC-ADM-02 | Export KPI | Aucune | Absent | Ajouter export tenant-admin |
| SC-ADM-03 | Structure | `organization.spec.ts` | Partiel | Ajouter modifier/supprimer |
| SC-ADM-04 | Gérer les comptes | `tenant-admin-config.spec.ts` | Partiel | Tester rôle, statut et périmètre |
| SC-ADM-05 | Règles classement | `rules*.spec.ts` | Partiel | Unifier `SC-ADM-RULES` |
| SC-ADM-06 | Circuit de validation | `tenant-admin-config.spec.ts` | Partiel | Tester visa + signature |
| SC-ADM-07 | Revue classement | `needs-review.spec.ts` | Partiel | Renommer `SC-ADM-REVIEW` |
| SC-ADM-08 | Import lot | `bulk-upload`, `ingestion` mocké | Partiel | UI + API réelles |
| SC-ADM-09 | Audit institution | `audit.spec.ts` avec auditeur | Partiel | Rejouer tenant-admin |

### Super Admin

| UAT | Objectif | Preuve E2E écrite | État | Action |
|---|---|---|---|---|
| SC-PLAT-01 | Vue plateforme | `super-admin`, `dashboards` | Partiel | Vérifier KPI réels |
| SC-PLAT-02 | Politiques AuthZ | `authz.spec.ts` sous autre ID | Désaligné | Réconcilier |
| SC-PLAT-03 | Santé AuthZ | `authz.spec.ts` sous autre ID | Désaligné | Réconcilier |
| SC-PLAT-04 | Métriques refus | `authz.spec.ts` sous autre ID | Désaligné | Réconcilier |

### Lecteur, Auditeur et notifications

| UAT | Objectif | Preuve E2E écrite | État | Action |
|---|---|---|---|---|
| SC-LEC-01 | Rechercher/consulter/télécharger | Plusieurs fragments | Partiel | Tester avec persona lecteur |
| SC-AUD-01 | Audit et filtres | `audit.spec.ts` | Couvert/partiel | Ajouter ID et assertions |
| SC-NOT-01 | Badge, panneau, deep-link | `notifications.spec.ts` | Partiel | Persona manager + deep-link tâche |

### Parcours transverses

| UAT | Objectif | Preuve E2E écrite | État | Action |
|---|---|---|---|---|
| SC-E2E-01 | Cycle complet multi-acteurs | `full-cycle.spec.ts` | Partiel | Signature, archivage, lecteur, 5 logs |
| SC-E2E-02 | Rejet et notification | Fragments seulement | Absent | Créer spec sérialisée |
| SC-E2E-03 | Retour, correction, resoumission | Fragments seulement | Absent | Créer spec sérialisée |
| SC-SEC-01 | Isolation cross-tenant | Mauvais sens sous même ID | Désaligné | Test BOLA document |
| SC-SEC-02 | Séparation des pouvoirs | Mauvais sens sous même ID | Désaligné | Collaborateur approve → 403 |
| SC-SEC-03 | Intégrité document signé | Couverture UI partielle | Désaligné | Mutation API → 403 |

## 4. Scénarios présents uniquement dans l'automatisation

- `SC-ADM-RULES`
- `SC-ADM-REVIEW`
- `SC-ADM-USERS-01/02`
- `SC-ADM-QUOTAS-01`
- `SC-ADM-WORKFLOWS-01`
- `SC-UA-01/02`
- `SC-LEC-02`
- `SC-AUD-02`
- `SC-E2E-BULK`
- `SC-SEC-04`

Ils doivent être reliés à un scénario UAT existant ou ajoutés explicitement au
référentiel métier.

## 5. Go/No-Go actuel

Le Go/No-Go ne peut pas être signé sur la seule base des specs écrites :

- refresh et logout ne sont pas couverts ;
- le cycle complet est incomplet ;
- les scénarios sécurité utilisent des identifiants désalignés ;
- les preuves d'audit du cycle complet manquent ;
- plusieurs parcours Import/Classement/Espaces sont mockés.

Verdict documentaire : **NO-GO tant que les P0 ci-dessous ne sont pas exécutés
et verts**.

## 6. Backlog transmis à Claude

### P0

1. Réconcilier les IDs RED, PLAT et SEC.
2. Réécrire SC-SEC-01 à 03 selon le guide UAT.
3. Compléter SC-E2E-01.
4. Créer SC-E2E-02 et SC-E2E-03.

### P1

1. Ajouter SC-AUTH-02 et SC-AUTH-03.
2. Ajouter le deep-link de SC-NOT-01.
3. Créer SC-RESP-01.
4. Réconcilier les IDs ADM et UA.

### P2

1. Ajouter l'export KPI tenant-admin.
2. Tracer l'onboarding complet.
3. Retirer les mocks des parcours V1 servant de preuve.

## 7. Handoff

- **Claude** : corrige les specs, prépare les seeds et exécute Playwright.
- **Gemini** : relit la cohérence UX et la correspondance avec les personas.
- **PO** : valide la nomenclature et décide quels parcours sont bloquants pour
  le pilote.

La clôture de T07 nécessite encore la validation PO de la nomenclature cible.
