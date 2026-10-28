# Matrice de traçabilité produit — GED237

> Statut : Vérifié par confrontation documentaire et code ciblé
> Auteur : Product Owner assisté
> Date : 2026-07-22
> Objectif : relier promesse, parcours, implémentation, preuve et décision
> Référence d'état : `AUDIT.md`

## 1. Légende

- **Actuel** : présent dans le code et cohérent avec la promesse essentielle.
- **Partiel** : capacité présente, mais contrat, UX ou preuve incomplets.
- **Obsolète** : description remplacée par une implémentation ou décision plus récente.
- **Aspirationnel** : vision future non livrée.
- **À décider** : plusieurs options produit encore légitimes.

Un statut **Actuel** ne signifie **Vérifié en production** que si une preuve
d'exécution est disponible.

## 2. Capacités et parcours

| Capacité | Persona principal | Route ou API | Conception de référence | Preuve actuelle | Statut | Décision PO |
|---|---|---|---|---|---|---|
| Ouverture d'une institution | Super Admin | `/tenants`, `/tenants/:tenantId` | `GUIDE_CREATION_INSTITUTION.md` | `TenantDetail.tsx` | Actuel | Conserver le parcours guidé |
| Création admin/services/agents | Super Admin, Admin Institution | `/tenants/:id`, `/org`, `/users` | Guide institution, Guide test | Pages et API présentes | Partiel | Corriger liens et droits par rôle |
| Login MFA | Tous | `/auth/login`, `/auth/verify-otp` | PERT P0, Guide test | Code auth présent | Partiel | Choisir et prouver le canal OTP |
| Changement mot de passe initial | Nouvel utilisateur | `/change-password` | Guide institution | Redirect et page présents | Actuel | Aligner tous les guides |
| Isolation multi-tenant | Tous | AuthZ + `tenant_guard` | `P5-PLAN.md` | Casbin et guards présents | Actuel | Rejouer tests cross-tenant |
| AuthZ production SQL | Super Admin | `/authz` | `P6-PLAN.md` | SQL/shadow/admin présents | À décider | Exécuter shadow → SQL |
| Dépôt documentaire | Collaborateur | `/documents`, dashboard | Guide test | Upload et modèle présents | Actuel | Normaliser catégories UUID partout |
| Versioning et verrou | Collaborateur, Admin | `/documents/*` | Plan réparation | Modèles/endpoints présents | Actuel | Ajouter recette cycle de vie |
| Workflow visa/approbation/signature | Responsable | `/tasks`, `/workflows/*` API | Guide test, PERT P4 | Services et actions présents | Partiel | Unifier `/tasks` et dashboard Manager |
| Templates et routage GEDRules | Admin Institution | `/rules` | V1, Guide test | UI/API présentes | Actuel | Clarifier séparation avec classement |
| Assignation manuelle | Admin Institution | `/pending-assignments` | V1, Guide utilisateur | Page/API présentes | Actuel | Définir SLA de traitement |
| Analyse import batch | Admin Institution | `/ingestion`, `/imports/analyze` | Backlog V1 S3/S4 | Wizard et endpoint présents | Partiel | Prouver sur lot réel |
| Commit import batch | Admin Institution | `/imports/{id}/commit` | Backlog/Plan V1 | Service présent | Partiel | Tester reprise et erreurs |
| Rangement local navigateur | Utilisateur opérationnel | `/ingestion`, `/local-library` | Hors plan V1 centralisé | Services client présents | Actuel | Clarifier la promesse vs GED serveur |
| Classement automatique | Admin Institution | `/classification-rules/*` | Plan V1 S1/S2/S7 | Moteur enrichi | Actuel | Mesurer précision et ambiguïtés |
| Administration classement | Admin Institution | `/classement` | Plans : `/rules` | `ClassementPage.tsx` | Obsolète | Officialiser `/classement` |
| Revue classement ambigu | Admin Institution | `/classification-reviews` | V1 S6 | Page/API présentes | Partiel | Recette resolve → document → workflow |
| Explorateur Espaces | Lecteur, Admin | `/spaces` | V1 S5 | UI et arbre org présents | Partiel | Fermer contrat filtres |
| Filtres Espaces serveur | Lecteur, Admin | `/spaces/documents` | Plan V1 | Paramètres métier absents | À décider | Implémenter filtres + pagination |
| Arbre logique documentaire | Lecteur, Admin | `/spaces/tree` | Plan V1 | Arbre organisationnel réel | À décider | Reporter arbre logique complet |
| Recherche OCR | Tous autorisés | `/search` | README, sitemap | Endpoint et FTS présents | Partiel | Ajouter authz/scope et corriger filtres |
| Audit des actions | Auditeur, Admin | `/audit` | Guide test, sitemap | Page/API présentes | Actuel | Ajouter/exporter la recette auditeur |
| Notifications | Tous | Header, `/notifications` | Guide test | REST/WebSocket présents | Partiel | Centre complet et architecture cluster |
| Rapports Synthèse | Admin Institution | `/reports` | Rapports R1/R2 | Onglet actuel | Partiel | Figer KPI institutionnels |
| Rapports Activité documents | Admin Institution | `/reports` | R3 | Onglet/API actuels | Partiel | Type métier vs type fichier |
| Rapports Traitement & délais | Admin Institution | `/reports` | R4 | Onglet/API actuels | Actuel | Ajouter séries temporelles si utile |
| Rapports Services | Admin Institution | `/reports` | R5 | Onglet/API actuels | Partiel | Ajouter période et scope |
| Génération de rapport | Admin Institution | `/reports` | R6 | Exports client présents | Partiel | Décider rapport officiel serveur |
| Qualité documentaire | Admin Institution | futur Reports | R7 | Signaux légers seulement | Aspirationnel | Après dette filtres/tests |
| Audit & sécurité synthétiques | Auditeur, Admin | futur Reports | R8 | Audit séparé | Aspirationnel | Éviter doublon avec `/audit` |
| Rapports planifiés/alertes | Gouvernance | futur | R9 | Non livré | Aspirationnel | Justifier par besoin pilote |
| Corbeille UI | Admin, Collaborateur | futur `/trash` | sitemap, gap frontend | Soft delete backend seulement | Aspirationnel | P1 post-stabilisation |
| Favoris/récents/partagés | Utilisateurs | futur | sitemap | Routes absentes | Aspirationnel | Valider besoin avant backlog |
| Archivage légal/rétention | Gouvernance | futur | sitemap, Rapports V2 | Pas de moteur dédié | Aspirationnel | Ne pas promettre au pilote |
| Santé et observabilité | Admin plateforme | futur | gap frontend | Health superficiel | Partiel | Probes DB/Redis/Celery d'abord |

## 3. Personas et promesse vérifiable

| Persona | Résultat attendu | Parcours de preuve | Couverture | Écart principal |
|---|---|---|---|---|
| Super Admin | Institution opérationnelle et isolée | Créer tenant → admin → structure → connexion | Partielle | Landing et liens post-setup |
| Admin Institution | Configurer et piloter la GED | Structure → agents → règles → import → espaces → rapports | Partielle | Espaces et recette réelle |
| Admin Service | Administrer son périmètre | Dashboard service → agents → activité | Partielle | KPI parfois tenant-wide |
| Responsable | Traiter les décisions documentaires | Bannette → visa/rejet → audit | Partielle | Deux expériences de validation |
| Collaborateur | Déposer et suivre | Upload → soumission → statut | Partielle | Catégorie et feedback legacy |
| Lecteur | Retrouver et consulter sans modifier | Recherche/espaces → preview | Partielle | Authz search et ouverture |
| Auditeur | Prouver qui a fait quoi | Audit → filtres → export | Partielle | Export et menu profil |

## 4. Traçabilité recette

| Domaine | Référentiel métier | Preuve automatisée | État | Action |
|---|---|---|---|---|
| Auth | `GUIDE_TEST_FONCTIONNEL.md` SC-AUTH | `auth.spec.ts`, tests API auth | Partiel | Ajouter refresh/logout complet |
| Documents | SC-RED | `documents.spec.ts`, `redacteur.spec.ts` | Partiel | Réconcilier IDs |
| Validation | SC-VAL | `validation.spec.ts`, `full-cycle.spec.ts` | Partiel | Rendre signature/archivage obligatoires si scope |
| Admin tenant | SC-ADM | Plusieurs specs config | Partiel | Créer une matrice unique |
| Super Admin | SC-PLAT | `super-admin.spec.ts`, `authz.spec.ts` | Partiel | Corriger sens des IDs |
| Sécurité | SC-SEC | `security-isolation.spec.ts`, tests authz | Partiel | Exécuter sans mocks |
| Import/classement | Backlog V1 | specs ingestion/classification | Partiel | Aligner routes et sélecteurs |
| Rapports | Backlogs R1–R9 | aucun test API dédié | Insuffisant | `test_reports.py` + E2E |
| Audit | SC-AUD | `audit.spec.ts` | Partiel | Export réel |
| Notifications | SC-NOT | `notifications.spec.ts` | Partiel | Deep-link et multi-instance |

## 5. Documents : statut normatif

| Document | Statut recommandé | Usage autorisé |
|---|---|---|
| `AUDIT.md` | Actuel | État réel et findings |
| `PLAN_TECHNIQUE_V1_IMPORT_CLASSEMENT_GED.md` | Actuel comme spécification | Contrats et règles V1 |
| `BACKLOG_SPRINT_V1_IMPORT_CLASSEMENT_GED.md` | Partiel | Historique sprint et DoD |
| `RETEX_RAPPORTS_STATISTIQUES_UI.md` | Actuel | Norme UX Rapports |
| `BACKLOG_RAPPORTS_STATISTIQUES.md` | Partiel | Roadmap R1–R9 |
| `BACKLOG_TECHNIQUE_RAPPORTS_R1_R3.md` | Actuel sur R1–R3 | Architecture livrée |
| `GUIDE_CREATION_INSTITUTION.md` | Actuel avec corrections | Runbook onboarding |
| `GUIDE_TEST_FONCTIONNEL.md` | Partiel | UAT, pas matrice exécutable |
| `P5-PLAN.md` | Actuel sur principes | Architecture RBAC |
| `P6-PLAN.md` | Partiel | Architecture P6b AuthZ |
| `PLAN_P6.md` | Partiel | CI et DevSecOps |
| `PLAN_REFACTOR_FRONTEND_SRP.md` | Actuel comme dette | Plan non démarré |
| `PERT_P0_REMEDIATION.md` | Obsolète | Historique |
| `PLAN_REPARATION_GED237.md` | Obsolète | Historique |
| `PERT_GLOBAL_GED237.md` | Obsolète | Dépendances historiques |
| `PLAN_RAPPORTS_STATISTIQUES_MVP.md` | Obsolète | Origine du concept |
| `PLAN_RAPPORTS_STATISTIQUES_VERSIONS_SPRINTS.md` | Partiel | Vision versions, pas statuts |
| `sitemap.xml` | Aspirationnel | Vision V2, pas routes réelles |

## 6. Backlog de décisions Product Owner

| ID | Priorité | Décision | Recommandation | Responsable | Preuve de clôture |
|---|---|---|---|---|---|
| PO-001 | P0 | Clôture V1/Sprint 8 | Exiger campagne réelle PostgreSQL/Redis | PO + QA + Tech Lead | Rapport pytest/E2E daté |
| PO-002 | P0 | Contrat Espaces | Filtres + pagination serveur | PO + Backend | Tests API/perf + E2E |
| PO-003 | P0 | Recherche et périmètre | Authz et scope org obligatoires | Security + Backend | Tests BOLA/cross-scope |
| PO-004 | P1 | AuthZ production | Shadow puis SQL | Ops + Security | Runbook exécuté et rollback |
| PO-005 | P1 | KPI Rapports | Atelier métier, dictionnaire figé | PO + utilisateurs pilotes | Dictionnaire validé |
| PO-006 | P1 | Dette Rapports | Tests et filtres avant R7 | PO + équipe | Tests + filtres multi-onglets |
| PO-007 | P1 | Recette SC-* | Matrice métier ↔ automatisation | PO + QA | 100 % parcours critiques liés |
| PO-008 | P1 | Routes fantômes | Câbler ou retirer | PO + Frontend | Navigation sans faux module |
| PO-009 | P1 | Canal OTP | Choisir e-mail/SMS institutionnel | PO + Security + Ops | OTP reçu et audité |
| PO-010 | P2 | Arbre Espaces logique | Reporter après filtres V1 | PO | Roadmap explicite |
| PO-011 | P2 | Archivage légal | Hors promesse avant cadrage juridique | PO + Juridique | Politique validée |
| PO-012 | P2 | Refactor SRP | Extraction ciblée et testable | Tech Lead | Taille réduite + tests |
| PO-013 | P2 | Sitemap | Marquer vision V2 | PO | En-tête non normatif |
| PO-014 | P2 | Rapport officiel | Évaluer exigence serveur | PO + Auditeurs | Critères réglementaires |

## 7. Règles de clôture

Une décision passe à **Clôturée** uniquement si :

1. l'option retenue et sa justification sont écrites ;
2. le backlog et les critères d'acceptation sont alignés ;
3. le code ou la documentation normative correspond ;
4. la preuve indiquée dans la matrice existe ;
5. `AUDIT.md` reflète le nouvel état lorsque l'implémentation change.
