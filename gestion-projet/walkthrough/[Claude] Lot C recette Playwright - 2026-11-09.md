# [Claude] Lot C — Recette Playwright sur la matrice UAT — 2026-11-09

> Statut : EN REVUE
> Agent : Claude (session dev-frontend)
> Début : 2026-11-09
> Référence : `AUDIT.md` item 10 (recette), `gestion-projet/MATRICE_UAT_E2E_2026-07-22.md`
> Branche : `test/uat-playwright` (basée sur `ci/e2e-smoke`, pile e2e livrée par ged237-b7)

## Ce qui va être fait

Exécuter avec Playwright, contre la pile Docker réelle (sans mocks), les 8 parcours de démo de
`gestion-projet/innovateur/parcours-demo.md`, qui font foi pour l'ordre de priorité (consigne orchestrateur
du 2026-11-09) :

| Parcours | UAT | Spec | État |
|---|---|---|---|
| P1 Connexion, OTP, refresh, déconnexion | SC-AUTH-01/02/03 | `uat/auth-2fa.spec.ts` | écrite |
| P2 Import d'un dossier, classement automatique | SC-ADM-08 | `uat/directory-import.spec.ts` | écrite |
| P3 Règle simulée puis activée | SC-ADM-05 | `uat/rule-classification.spec.ts` | écrite |
| P4 Espaces : filtres et pagination | SC-ESP-01 | `uat/spaces-filters.spec.ts` | écrite : navigation + contrat des filtres serveur (C9, PR #38 fusionnée) |
| P5 Recherche plein texte restreinte | SC-LEC-01 | — | attend le correctif de recherche restreinte |
| P6 Revue manuelle | SC-ADM-07 | `uat/manual-review.spec.ts` | écrite |
| P7 Journal d'audit | SC-AUD-01 / ADM-09 | `uat/audit-trail.spec.ts` | écrite (produit sa propre trace : pas de dépendance d'ordre) ; D3, D4 en `fixme` |
| P8 Cycle de validation (DEC-2026-002 acceptée, remplace corbeille/versions) | SC-VAL-01..05, SC-E2E-01 | `uat/validation-cycle.spec.ts` (remplace `validation.spec.ts`, `workflow.spec.ts`, `full-cycle.spec.ts`, supprimées : elles se mettaient en `test.skip` dès que la pile du manager était vide) | écrite ; écran bloqué par VAL-D1..D3 |

Un fichier de spec par parcours, sous `frontend/e2e/specs/uat/`, exécuté par le projet Playwright `uat`.
Les 4 specs mockées (ingestion, rules, classification-admin, spaces) sont remplacées par ces specs.

## Pourquoi

`AUDIT.md` classe la recette « non atteinte » : 4 scénarios sur 37 sont couverts de façon convaincante,
et aucun run e2e n'a été exécuté. Les specs existantes sont souvent mockées ou « molles » (boucles qui
journalisent puis s'arrêtent sans échouer). La démo du 30/11 exige une preuve exécutée.

## Comment

- Infrastructure : réutiliser `docker-compose.e2e.yml` (base tmpfs vierge, `seed_db.py`, OTP pré-rempli
  en `ENVIRONMENT=development`). Aucune seconde infrastructure.
- Lancement : `E2E_ARGS=--project=uat docker compose -f docker-compose.e2e.yml up --build --abort-on-container-exit --exit-code-from e2e`,
  puis `docker compose -f docker-compose.e2e.yml down -v`.
- Specs déterministes : chaque spec crée ses propres données via l'API (jeton du compte de test), sans
  dépendre de l'ordre d'exécution ni d'un run précédent ; assertions strictes, aucun `test.skip` conditionnel.
- Défauts applicatifs trouvés : listés ici et transmis à l'orchestrateur, **non corrigés** dans cette PR.

## Source des 37 scénarios

`Phase de Conception/GUIDE_TEST_FONCTIONNEL.md` (37 identifiants `SC-*`, vérifié par extraction le 2026-11-09).

## Couverture

Légende : **passe** / **échoue** (défaut renvoyé) / **non testé** (pas encore de spec UAT exécutée).
Colonne « Démo » : parcours prioritaire pour la démo.

| UAT | Objectif | Démo | Spec UAT | Résultat |
|---|---|---|---|---|
| SC-AUTH-01 | Se connecter (2FA) | oui | `uat/auth-2fa.spec.ts` | passe |
| SC-AUTH-02 | Prolonger une session active | oui | `uat/auth-2fa.spec.ts` | passe |
| SC-AUTH-03 | Se déconnecter | oui | `uat/auth-2fa.spec.ts` | passe |
| SC-RED-01 | Créer et déposer un document | | | non testé |
| SC-RED-02 | Soumettre un brouillon à validation | | | non testé |
| SC-RED-03 | Corriger un document retourné | | | non testé |
| SC-RED-04 | Déposer une nouvelle version | | | non testé (pas de bouton à l'écran, API seule) |
| SC-RED-05 | Supprimer un brouillon (corbeille) | | `redacteur.spec.ts` (ex-SC-RED-04, skip si l'action est absente) | non démontré |
| SC-VAL-01 | Consulter les dossiers en attente | oui | `uat/validation-cycle.spec.ts` | écrit ; 403 au dépôt en `collaborator` tant que #47 n'est pas fusionnée ; soumission à l'écran en `fixme` (VAL-D1) |
| SC-VAL-02 | Viser un document | oui | `uat/validation-cycle.spec.ts` | `fixme` (VAL-D2) |
| SC-VAL-03 | Rejeter un document avec motif | oui | `uat/validation-cycle.spec.ts` | `fixme` (VAL-D2, VAL-D3) |
| SC-VAL-04 | Retourner pour correction | oui | `uat/validation-cycle.spec.ts` | `fixme` : action reportée en V1.1 |
| SC-VAL-05 | Signer (signature finale) | | | non testé |
| SC-RESP-01 | Affecter un document sans destinataire | | | non testé |
| SC-RESP-02 | Créer un agent dans son service | | | non testé |
| SC-ADM-01 | Vue d'ensemble du ministère | | | non testé |
| SC-ADM-02 | Exporter les indicateurs | | | non testé |
| SC-ADM-03 | Organiser la structure | | | non testé |
| SC-ADM-04 | Gérer les comptes | | | non testé |
| SC-ADM-05 | Définir une règle de classement | oui | `uat/rule-classification.spec.ts` | passe |
| SC-ADM-06 | Créer un circuit de validation | | | non testé |
| SC-ADM-07 | Traiter les documents à revoir | oui | `uat/manual-review.spec.ts` | passe |
| SC-ADM-08 | Importer un lot depuis un dossier | oui | `uat/directory-import.spec.ts` | passe |
| SC-ADM-09 | Piste d'audit du ministère | oui | `uat/audit-trail.spec.ts` | passe |
| SC-PLAT-01 | Vue nationale | | | non testé |
| SC-PLAT-02 | Administrer les règles d'accès | | | non testé |
| SC-PLAT-03 | Santé du contrôle d'accès | | | non testé |
| SC-PLAT-04 | Analyser les rejets d'accès | | | non testé |
| SC-LEC-01 | Rechercher un document | | | non testé |
| SC-AUD-01 | Examiner le journal des actions | oui | `uat/audit-trail.spec.ts` | passe |
| SC-E2E-01 | Cycle complet d'un dossier officiel | oui | couvert par SC-VAL-01/02 (`full-cycle.spec.ts` supprimée) | voir SC-VAL |
| SC-E2E-02 | Rejet au cours du circuit | | | non testé |
| SC-E2E-03 | Retour pour correction | | | non testé |
| SC-SEC-01 | Isolation (P5 : service, tenant) | | P5, recherche restreinte (#42) | non testé |
| SC-SEC-02 | Isolation tenant (P5) | | P5 | non testé ; les anciens tests 403 deviennent SC-SEC-03a/b et 04a/b dans `security-isolation.spec.ts` |
| SC-SEC-03 | Document signé immuable | | | non testé |
| SC-NOT-01 | Alerte de tâche à faire | | | non testé |

Hors référentiel des 37 (à rattacher par le PO) :

| ID | Objectif | Démo | Spec UAT | Résultat |
|---|---|---|---|---|
| SC-ESP-01 | Naviguer dans les espaces avec filtres serveur (domaine, activité, année, statut, recherche) | oui | `uat/spaces-filters.spec.ts` | passe |

## Contrat figé : filtres serveur des espaces (avec ged-dev-backend, 2026-11-09)

`GET /api/v1/spaces/documents` (et `/spaces/{id}/documents`), livré par la PR #38 (fusionnée dans main, c7fc5bd) :

- paramètres optionnels, en plus de `org_unit_id` et `recursive` : `domain_id`, `activity_id`,
  `year` (1900..2100), `status` (cycle de vie), `classification_status` (pending|classified|needs_review|rejected),
  `q` (120 caractères au plus ; ILIKE échappé sur titre, tags, noms de domaine, d'activité et de catégorie) ;
- `limit` (1..200) et `offset` (≥ 0) optionnels : **sans `limit`, liste complète** (comportement historique,
  SpacesPage compte sur la longueur du tableau) ;
- corps inchangé (tableau de documents) ; `X-Total-Count` toujours renvoyé et exposé par CORS ;
- tri `created_at desc, id` ; valeur invalide → 422 ; pas de `sort` dans ce lot.

Les tests de contrat de `uat/spaces-filters.spec.ts` sont actifs ; la pagination est vérifiée sur les seuls documents du test (`q` = identifiant du test), pour rester stable avec des workers parallèles.

## Défauts applicatifs trouvés

| # | UAT | Défaut | Preuve | Routage |
|---|---|---|---|---|
| D1 | SC-AUTH-01 E3 | Aucun blocage après 3 OTP erronés : pas de compteur de tentatives, seule la limite slowapi (5/min) s'applique. | lecture du code `auth.py` ; test `fixme` dans `uat/auth-2fa.spec.ts` | orchestrateur → innovateur → dev-backend |
| D2 | SC-AUTH-02 E1 | Après expiration du jeton de rafraîchissement, `redirectToLogin()` (`frontend/services/http/session.ts`) renvoie vers `/login` sans conserver la destination voulue. | lecture du code ; test `fixme` dans `uat/auth-2fa.spec.ts` | orchestrateur |
| D3 | P7 / SC-AUD-01 | Le journal d'audit ne trace ni la connexion, ni le dépôt, ni l'import : `AuditLog` n'est créé que pour review_resolved, content_viewed, dup_detected, corbeille, versions et usages locaux (aucun trigger SQL). La chronologie « qui a fait quoi » de P7 est donc incomplète. | `grep AuditLog(` dans `backend/app` ; test `fixme` dans `uat/audit-trail.spec.ts` | orchestrateur → dev-backend : correctif prévu le 2026-11-12, test réactivé à la livraison |
| D4 | SC-AUD-02 | Aucun export du journal d'audit (ni bouton sur `/audit`, ni route API). | lecture de `AuditLogs.tsx` et de `audit.py` | arbitrage : reporté en **V1.1**, SC-AUD-02 retiré de P7 ; `auditor-export.spec.ts` (skip silencieux) **supprimé** dans cette PR |
| VAL-D1 | SC-VAL-01 | L'Atelier du rédacteur remplit « Sélectionner un manager » avec GET /users, refusé au collaborateur (403 avalé) : la liste reste vide, la soumission à l'écran est impossible. | lecture de `DraftWorkspace.tsx` et de `policy.csv` | arbitrage : dev-backend expose GET /workflows/validators ; dev-frontend branche l'Atelier dessus (`fix/validation-cycle-ui`) |
| VAL-D2 | SC-VAL-02/03 | « Viser » et « Rejeter » de l'Espace Manager envoient `document_version_id` vide, car GET /workflows/pending ne renvoie pas la version courante : refus 422. `/tasks` envoie en plus `action_type` 'approve', hors enum. | lecture de `ValidationHub.tsx`, `WorkflowTasks.tsx` et `schemas/workflow.py` | arbitrage : dev-backend ajoute `current_version_id` (PR fix/workflow-pending-validators) ; dev-frontend lit ce champ et aligne WorkflowTasks |
| VAL-D3 | SC-VAL-03/04 | Aucun champ motif (le commentaire est codé en dur) ni action « retour pour correction » à l'écran du valideur. | lecture de `ValidationHub.tsx` | arbitrage : motif saisissable au rejet (dev-frontend) ; retour pour correction en V1.1 (écart consigné) |
| D5 | SC-AUTH-01 (boutons démo) | Les boutons démo MINFI de l'écran de connexion ne présélectionnent aucune institution : `DEMO_CREDENTIALS` (`frontend/components/LoginPage.tsx`) fixe un libellé en dur (« Ministère des Finances (MINFI) »), alors que les options du `<select>` sont construites depuis `/tenants/public` (« Ministere des Finances (MINFI) » dans le seed). La valeur n'existe pas dans les options, et le champ `required` bloque l'envoi. Seul PLATFORM fonctionne. | constat ci-qa au smoke du 2026-11-09 ; lecture de `LoginPage.tsx` l. 10-13 et 195-202 | orchestrateur : **corrigé par PR #41, fusionnée a4b8dbe** (`fix/login-demo-institution`, choix de l'option par code de tenant, comme `_resolve_tenant`) |

Constat sur les specs existantes : `audit.spec.ts` cible des `<select>` et des paramètres `table_name`/`action` dans la requête,
alors que `/audit` charge 200 entrées et filtre côté client via les en-têtes de `DataTable` : spec périmée, **supprimée** dans cette PR et remplacée par `uat/audit-trail.spec.ts` (accord orchestrateur du 2026-11-09).

Les tests `fixme` restent dans la campagne : ils passeront au vert dès que le correctif sera livré.

## Résultats

Run 3 du 2026-11-09 (pile `docker-compose.e2e.yml`, image `edossier-e2e-api:latest` reconstruite sur main a4b8dbe,
`--project=uat --retries=0`) : **15 réussis, 3 `fixme` (D1, D2, D3), 0 échec, 1,1 min**.

- Parcours verts : **6 sur 8** (P1, P2, P3, P4, P6, P7). P5 attend le correctif de recherche restreinte ; P8 est écrit mais bloqué (voir ci-dessous).
- Les 3 `fixme` documentent des défauts applicatifs (D1 blocage OTP, D2 destination après expiration, D3 traçabilité) ; ils ne masquent aucun échec de spec.
- Runs précédents : run 1 arrêté au chargement (`TEST_USERS` non réexporté par `uat.fixture.ts`) ; run 2 à 10/5/3, avec 5 échecs **de spec**, sans défaut applicatif nouveau.
  - Scope `service` sans service cible (400) : le backend exige `classification_target_org_unit_id`.
  - Deux dépôts de même contenu, rejetés en doublon (409).
  - Étapes du plan de classement rendues en boutons, pas en onglets ARIA.
  - Bouton « Vérifier le classement » ambigu.
  - Compteur rendu « N document(s) ».

Run P8 du 2026-11-09 (`--project=uat --retries=0 validation-cycle`) : **1 échec, 4 `fixme`**. L'échec vient de la préparation, pas de l'écran : le dépôt en MINFI002 répond 403 (`create` sur `documents` refusé au rôle `collaborator`), écart corrigé par #47. SC-VAL-01 est à rejouer après #47 ; SC-VAL-02 et 03 après les correctifs VAL-D2 et VAL-D3. Si SC-VAL n'est pas vert le 13/11, le repli manuel de la matrice s'applique.

Ménage de la campagne :
- specs supprimées :
  - à mocks : `classification-admin`, `classification-reviews`, `ingestion`, `spaces`, avec le projet `mocked-chromium`, `utils/mockAuth.ts` et `pages/ingestion.page.ts` ;
  - `bulk-upload.spec.ts` (SC-E2E-BULK, couvert par P2) ;
  - `validation`, `workflow`, `full-cycle` et `pages/workflow.page.ts` ;
  - `audit` et `auditor-export` ;
- le projet `smoke` exécute `validation-cycle` au lieu de `full-cycle` ;
- les collisions d'ID de la matrice (§4) sont résolues, avec une note de correspondance en tête de `MATRICE_UAT_E2E_2026-07-22.md`.

## Checklist RAIDER

- **Reusable** : un seul client API (`UatApi` : dépôt, règles, revues, audit, circuit de visa) et les fixtures `loginAs` / `apiAs`, partagés par les 7 specs UAT. Aucune donnée en dur hors des comptes seedés.
- **Agnostic** : URL d'API et identifiants viennent de l'environnement et de `TEST_USERS`. Les specs ne supposent ni ordre d'exécution ni contenu de base au-delà du seed de démo.
- **Idempotent** : chaque test crée ses données avec un `runId` unique (titres, contenus et codes distincts, donc pas de 409 doublon au rejeu) ; la pile est jetable (`down -v`).
- **Durable / Non-regressive** :
  - P1, P2, P3, P4, P6 et P7 sont verts (run 3) ;
  - les specs supprimées sont soit remplacées par une spec réelle, soit couvertes par un parcours, et sont listées ci-dessus ;
  - tsc des specs e2e : 0 erreur ; lint frontend au plafond 488, non relevé.
- **Failure memory** : les défauts D1 à D5 et VAL-D1 à D3 sont tracés, avec preuve et routage. Les 5 échecs de spec du run 2 sont expliqués dans Résultats. Pas de leçon générale nouvelle : ces échecs venaient d'écarts entre spec et écran.
- **Engineering-grade** : aucun `skip` conditionnel dans les specs UAT ; un défaut applicatif est un `fixme` nommé, jamais un vert silencieux. Assertions sur l'état serveur (statut, audit, étapes) en plus de l'écran.
- **Scoped execution** : projets Playwright séparés (`smoke` court pour la CI, `uat` pour la campagne). Les specs UAT sont hors des projets historiques.
- **Reuse-first** : **Adopt** de la pile e2e de #39 et de `auth.fixture` ; **Build** limité à `uat.fixture.ts`.
- **Retroactive** : n/a (aucune donnée persistée hors de la pile e2e jetable).
