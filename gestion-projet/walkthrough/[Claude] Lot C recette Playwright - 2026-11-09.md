# [Claude] Lot C — Recette Playwright sur la matrice UAT — 2026-11-09

> Statut : EN COURS
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
| P8 Cycle de validation (DEC-2026-002 acceptée, remplace corbeille/versions) | SC-VAL-01..05, SC-E2E-01 | `validation.spec.ts`, `workflow.spec.ts`, `full-cycle.spec.ts` (existantes) | à fiabiliser : ces specs se mettent en `test.skip` quand le seed n'a pas de tâche en attente, un vert n'y prouve rien |

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
| SC-AUTH-01 | Se connecter (2FA) | oui | `uat/auth-2fa.spec.ts` | non testé |
| SC-AUTH-02 | Prolonger une session active | oui | `uat/auth-2fa.spec.ts` | non testé |
| SC-AUTH-03 | Se déconnecter | oui | `uat/auth-2fa.spec.ts` | non testé |
| SC-RED-01 | Créer et déposer un document | | | non testé |
| SC-RED-02 | Soumettre un brouillon à validation | | | non testé |
| SC-RED-03 | Corriger un document retourné | | | non testé |
| SC-RED-04 | Déposer une nouvelle version | | | non testé |
| SC-RED-05 | Supprimer un brouillon | | | non testé |
| SC-VAL-01 | Consulter les dossiers en attente | | | non testé |
| SC-VAL-02 | Viser un document | | | non testé |
| SC-VAL-03 | Rejeter un document | | | non testé |
| SC-VAL-04 | Retourner pour correction | | | non testé |
| SC-VAL-05 | Signer (signature finale) | | | non testé |
| SC-RESP-01 | Affecter un document sans destinataire | | | non testé |
| SC-RESP-02 | Créer un agent dans son service | | | non testé |
| SC-ADM-01 | Vue d'ensemble du ministère | | | non testé |
| SC-ADM-02 | Exporter les indicateurs | | | non testé |
| SC-ADM-03 | Organiser la structure | | | non testé |
| SC-ADM-04 | Gérer les comptes | | | non testé |
| SC-ADM-05 | Définir une règle de classement | oui | `uat/rule-classification.spec.ts` | non testé |
| SC-ADM-06 | Créer un circuit de validation | | | non testé |
| SC-ADM-07 | Traiter les documents à revoir | oui | `uat/manual-review.spec.ts` | non testé |
| SC-ADM-08 | Importer un lot depuis un dossier | oui | `uat/directory-import.spec.ts` | non testé |
| SC-ADM-09 | Piste d'audit du ministère | oui | `uat/audit-trail.spec.ts` | non testé |
| SC-PLAT-01 | Vue nationale | | | non testé |
| SC-PLAT-02 | Administrer les règles d'accès | | | non testé |
| SC-PLAT-03 | Santé du contrôle d'accès | | | non testé |
| SC-PLAT-04 | Analyser les rejets d'accès | | | non testé |
| SC-LEC-01 | Rechercher un document | | | non testé |
| SC-AUD-01 | Examiner le journal des actions | oui | `uat/audit-trail.spec.ts` | non testé |
| SC-E2E-01 | Cycle complet d'un dossier officiel | | | non testé |
| SC-E2E-02 | Rejet au cours du circuit | | | non testé |
| SC-E2E-03 | Retour pour correction | | | non testé |
| SC-SEC-01 | Isolation entre ministères | | | non testé |
| SC-SEC-02 | Un rédacteur ne valide pas | | | non testé |
| SC-SEC-03 | Document signé immuable | | | non testé |
| SC-NOT-01 | Alerte de tâche à faire | | | non testé |

Hors référentiel des 37 (à rattacher par le PO) :

| ID | Objectif | Démo | Spec UAT | Résultat |
|---|---|---|---|---|
| SC-ESP-01 | Naviguer dans les espaces avec filtres serveur (domaine, activité, année, statut, recherche) | oui | `uat/spaces-filters.spec.ts` | non testé |

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
| D5 | SC-AUTH-01 (boutons démo) | Les boutons démo MINFI de l'écran de connexion ne présélectionnent aucune institution : `DEMO_CREDENTIALS` (`frontend/components/LoginPage.tsx`) fixe un libellé en dur (« Ministère des Finances (MINFI) »), alors que les options du `<select>` sont construites depuis `/tenants/public` (« Ministere des Finances (MINFI) » dans le seed). La valeur n'existe pas dans les options, et le champ `required` bloque l'envoi. Seul PLATFORM fonctionne. | constat ci-qa au smoke du 2026-11-09 ; lecture de `LoginPage.tsx` l. 10-13 et 195-202 | orchestrateur : **corrigé par PR #41, fusionnée a4b8dbe** (`fix/login-demo-institution`, choix de l'option par code de tenant, comme `_resolve_tenant`) |

Constat sur les specs existantes : `audit.spec.ts` cible des `<select>` et des paramètres `table_name`/`action` dans la requête,
alors que `/audit` charge 200 entrées et filtre côté client via les en-têtes de `DataTable` : spec périmée, **supprimée** dans cette PR et remplacée par `uat/audit-trail.spec.ts` (accord orchestrateur du 2026-11-09).

Les tests `fixme` restent dans la campagne : ils passeront au vert dès que le correctif sera livré.

## Résultats

_À compléter après exécution._

## Checklist RAIDER

_À compléter avant passage EN REVUE._
