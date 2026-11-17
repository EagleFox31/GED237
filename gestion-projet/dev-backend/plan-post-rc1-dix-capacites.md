# Dix capacités « futur / partiel » : plan BD, backend et API (après rc.1)

- **Pour** : PO, orchestrateur, sessions backend et frontend. Rédigé le 2026-11-17 sur `main` (tête Alembic `a7c8d9e0f1b2`).
- **Règles** : une PR brouillon par lot, label `post-rc1`, aucune fusion avant le tag du 24/11. Aucune dépendance nouvelle avant le 30/11. Migrations additives et rejouables ; tout effet de bord est désactivé par défaut. Classement valeur et risque : `gestion-projet/innovateur/classement-dix-capacites-futures.md`.
- **Légende** : h-s = heure de session de développement.

## 1. État réel du code (lu le 17/11)

| Capacité | Ce qui existe | Ce qui manque |
|---|---|---|
| Sondes de santé | `GET /health` statique (`backend/app/main.py:88`), lu par le compose, `probe_stack.sh`, `prove_tls.sh`, `probe_c6.sh`. `get_schema_status` réutilisable (`core/schema_check.py:60`). | `/health/ready` (base, schéma, Redis, Celery). |
| Corbeille | Liste, mise en corbeille, restauration, purge (`documents.py:757`, 1592, 1616, 1639), audit et tests. | Purge : accepte un document actif, supprime les fichiers avant le `commit`, ignore le verrou. `DELETE /{id}` supprime sans audit. Pas de borne ni de total sur la liste. Pas de purge groupée ni automatique. |
| Validation | Un seul backend sert les deux écrans (`GET /workflows/pending`, `POST /workflows/step/{id}/actions`). | Les files n'excluent pas les documents en corbeille ; pas de tri stable ni de limite ; pas de file « mon unité ». L'unification restante est côté interface. |
| Canal OTP | Code à 6 chiffres en clair dans Redis, 300 s (`auth_service.py:106`), renvoyé seulement en développement. Verrou et audit d'échec présents. Resend présent, inactif. | Aucun canal d'envoi réel ; stockage haché ; renvoi du code ; TOTP. Décision T08 toujours « Proposé ». |
| Notifications | REST et WebSocket présents ; gestionnaire en mémoire (`notifications.py:16`). | **Rien n'est jamais poussé sur le WebSocket**, même avec une instance. Pas de diffusion entre instances. Le WebSocket accepte un jeton non-access ou révoqué ; le jeton circule dans l'URL. |
| Rapport officiel | 4 routes JSON `/reports/*` ; modèle d'export CSV (`audit.py:271`). | Génération serveur tracée. PDF : aucune bibliothèque de mise en page. |
| Qualité documentaire | Doublons refusés, `/documents/stats`, `needs-review`. | Indicateur agrégé et liste par indicateur. |
| Favoris, récents, partagés | Rien. | Tout. |
| Rapports planifiés, alertes | Celery beat tourne dans le worker ; `beat_schedule` est affecté, pas fusionné (`workers/celery_app.py:34`). | Tout. |
| Archivage légal | Statut `archived` et `archived_at`. | Tout. Pas de code sans décision écrite du PO. |

**Sauvegarde** : `ops/backup.sh` et `ops/restore.sh` comparent `alembic_version`, `tenants`, `users`, `documents`, `storage_files`. Une table nouvelle est sauvegardée mais non comparée : elle ne casse pas le manifeste. Ne pas ajouter de clé au manifeste sans gérer son absence dans un manifeste ancien.

## 2. Lots

Règles communes : chaque requête porte `tenant_id` et `deleted_at` ; `limit` ≤ 200 ; chaque route a ses tests nominal, rôle refusé (403), tenant étranger (404 ou 0 ligne), 422 hors contrat. Migration défensive avec `downgrade` ; le lot fusionné en second rebase son `down_revision` ; `alembic heads` = 1 ligne. `SCHEMA_CHECK_MODE=fail` : appliquer `alembic upgrade head` avant de démarrer l'API.

| Lot | Contenu | Migration | Réglages (défaut) | Risque | Fusion au plus tôt | h-s |
|---|---|---|---|---|---|---|
| L1 Sondes de santé | `GET /health/ready` : base (`SELECT 1`), schéma à head, Redis (`PING`), Celery (`ping`). 503 si base, schéma ou Redis échoue ; Celery absent → 200 `degraded`. Aucun détail d'erreur dans la réponse. `/health` inchangé. | non | `HEALTH_CHECK_TIMEOUT_SECONDS=2`, `HEALTH_READY_REQUIRE_CELERY=false` | très faible | 25/11 | 1,5 |
| L2 Corbeille | `services/trash_service.py` (audit, suppression, `commit`, puis fichiers ; contrôle du verrou). `DELETE /{id}` audité. `POST /documents/trash/empty`. `X-Total-Count` sur `/trash`. Tâche `purge_expired_trash` (verrou Redis, lots `SKIP LOCKED`). Registre fusionné des plannings beat. | non | `TRASH_RETENTION_DAYS=0`, `TRASH_PURGE_BATCH=200` | faible | 25–26/11 | 3,5 |
| L3 Validation | `services/workflow_inbox.py` partagé par `/pending` et `/pending-assignments` ; tri stable ; `exclude_trashed`. `GET /workflows/inbox?scope=mine\|unit\|unassigned`. | non | `WORKFLOW_PENDING_EXCLUDE_TRASHED=false`, `WORKFLOW_INBOX_ENABLED=false` | faible | 26/11 | 2,5 |
| L4 Canal OTP | Port `services/otp_delivery.py` (`dev_response` = existant, `email` via Resend). Code stocké en HMAC. Audit `otp_sent` / `otp_send_failed`. `POST /auth/resend-otp`. TOTP après décision T08. | non | `AUTH_OTP_CHANNEL=dev_response`, `AUTH_OTP_RESEND_COOLDOWN_SECONDS=30` | élevé (connexion) | 26–27/11 | 3 + 3 (TOTP) |
| L5 Rapport officiel | `services/reports_scope.py` (portée partagée par les 4 routes). `GET /reports/official?kind=…&format=csv\|html`, en-tête, empreinte SHA-256, audit `report_generated`. PDF (reportlab) après le 30/11. | non | — | moyen | 27/11 (PDF : après le 30) | 3 + 2 |
| L6 Notifications | `services/notifications/realtime.py` : `off`, `local`, `redis` (pub/sub, abonné lancé au démarrage). Publication après `commit`, sans faire échouer l'opération. WebSocket : refus d'un jeton non-access ou révoqué. | non | `NOTIFICATIONS_BROADCAST_MODE=off` | moyen | 27/11 ou après le 30 | 3,5 |
| L7 Favoris, récents | Tables `document_favorites`, `document_recent_access`. Routeur `/me/favorites`, `/me/recent`. « Partagés » par ACL : après décision (5 h-s). | oui | `RECENT_DOCUMENTS_TRACKING_ENABLED=false`, `RECENT_DOCUMENTS_MAX_PER_USER=50` | faible | après le 30/11 | 3 |
| L8 Qualité | `GET /analytics/quality` et `/analytics/quality/documents?indicator=…`. | non | — | faible | après le 30/11 | 2,5 |
| L9 Rapports planifiés, alertes | Tables `report_schedules`, `report_runs` (`UNIQUE(schedule_id, period_key)`), `alert_rules`, `alert_events` (`UNIQUE(rule_id, window_key)`). Tâches de distribution et d'évaluation. Routes `/report-schedules`, `/alert-rules`. Dépend de L5 et L8. | oui | `SCHEDULED_REPORTS_ENABLED=false`, `ALERTS_ENABLED=false` | élevé | après le 30/11 | 9 |
| L10 Archivage légal | Modèle seulement : `retention_policies`, colonnes de conservation sur `documents`, `legal_holds`, `disposition_batches`. Toute purge refuse un document sous gel. | oui (plus tard) | — | élevé | sur décision écrite | 0, puis ≈ 12 |

Total hors TOTP, PDF, partage par ACL et archivage : 31,5 h-s.

## 3. Décisions du PO (valeur prise par défaut en attendant)

1. Durée de la corbeille avant purge automatique : désactivée (0) pour la démonstration ; 90 jours proposés en pilote.
2. Purge réservée aux documents déjà en corbeille : oui après le 30/11 ; non en attendant.
3. Suppression définitive directe par le collaborateur : la retirer après rc.1 ; d'ici là, seulement tracée.
4. Canal OTP (T08) : TOTP en principal, e-mail en secours pour le pilote ; canal actuel pour la démonstration. Compte sans e-mail : refus avec message pour l'administrateur.
5. File « mon unité » du responsable : unité seule (sans les unités filles).
6. Rapport officiel : CSV et HTML d'abord ; sans numérotation, avec empreinte et trace d'audit.
7. Destinataires des rapports planifiés : utilisateurs de l'institution, dans l'application ; pas d'e-mail externe.
8. « Partagés » : d'abord « documents qui me sont assignés ou visibles », sans table de partage.
9. « Métadonnées manquantes » : pas de catégorie, ou pas de domaine, ou pas d'année.
10. Archivage : durées par catégorie et fondement juridique, événement déclencheur, sort final, niveaux de validation, qui pose et lève un gel, forme de l'attestation. Par défaut : sort final « à revoir », jamais de destruction automatique.

## 4. Points de vigilance

- Le registre des plannings beat (L2) doit laisser `watch-ingest-folders` identique : test dédié.
- L2 : relire `test_documents_extended_coverage.py:115` avant de toucher la purge.
- L4 : une connexion commencée avant le déploiement se termine normalement (l'ancien format Redis est encore lu) ; l'e2e de connexion reste sur `dev_response`.
- L6 : `httpx.ASGITransport` ne lance pas le cycle de vie de l'application ; tester l'abonné directement.
- Défauts constatés à consigner dans `DOCS/engineering/lessons-learned.md` quand le lot les corrige : purge des fichiers avant `commit` ; WebSocket jamais alimenté.

## 5. Décisions du PO du 17/11

- Décision 1 (corbeille : purge automatique désactivée pour la démonstration, 90 jours en pilote) : **validée**.
- Décisions 2 et 3 : **la suppression par l'utilisateur met le document en corbeille**. `DELETE /documents/{id}` ne supprime plus définitivement ; la suppression définitive passe par la purge de la corbeille (rôle `documents manage`), réservée aux documents déjà en corbeille. Lot L2 ; `TRASH_PURGE_REQUIRES_TRASHED` devient inutile.
- Décision 4 (canal OTP) : **validée**.
- Décision 5 (file « mon unité ») : **validée** : unité seule par défaut, unités filles avec `recursive=true`, comme `/reports/*` et `/spaces/documents`.
- Décision 6 (rapport officiel) : **validée** : numéro d'ordre `N° 0001/2026/<sigle de l'institution>`, par institution, remis à zéro chaque année, avec registre des exemplaires émis (une table, donc après le 30/11).
- Décisions 7, 8, 9 : **validées**.
- Décision 10 (archivage légal) : cadre validé, aucun code sans décision écrite sur les durées et le sort final.

## 6. État des lots et règle de fusion (17/11)

| Lot | PR | Ce qui change même avec les réglages par défaut | Passe de recette ciblée avant fusion |
|---|---|---|---|
| L1 | #147 | Rien : une route en plus, `/health` inchangé. | Aucune. |
| L2 | #152 | `DELETE /documents/{id}` met en corbeille ; la purge refuse un document actif. | Écran de suppression et corbeille (QA et frontend). |
| L3 | #153 | `/workflows/pending` et `/pending-assignments` passent par un service commun (réponse testée identique). | Chemin de validation de bout en bout (QA). |
| L4 | #154 | Le code de vérification est stocké haché dans Redis. | Connexion complète, code faux, verrouillage (QA). |
| L6 | #155 | Le WebSocket refuse un jeton de rafraîchissement ou révoqué. | Cloche de notifications et WebSocket, avant et après déconnexion (QA et frontend). |

**Règle (orchestrateur, 17/11)** : après le tag du 24/11, seule L1 fusionne sans passe ciblée. L2, L3, L4 et L6 ne fusionnent pas entre le 24/11 et la démonstration du 30/11 sans leur passe ciblée et un accord écrit du PO. Les dates « fusion au plus tôt » du tableau des lots sont des dates techniques, pas un engagement.

## 7. L5 Rapport officiel : découpage (aucun code avant le 30/11)

- **A (3 h-s, sans migration)** : `services/reports_scope.py` reprend la portée aujourd'hui copiée quatre fois dans `endpoints/reports.py`. `GET /reports/official?kind=evolution|document-activity|workflow-activity|service-activity&format=csv|html`, mêmes filtres et même droit que les routes existantes. En-tête (institution, unité, période, auteur, date), empreinte SHA-256 du fichier livré, audit `report_generated`. CSV au format de l'export du journal d'audit.
- **B (2 h-s, migration additive)** : numéro `N° 0001/2026/<sigle>`. Tables `report_counters` (institution, année) et `report_issues` (numéro, type, filtres, empreinte, auteur, date) ; numéro pris sous verrou de ligne. Route de liste du registre.
- **C (2 h-s)** : PDF (reportlab, dépendance nouvelle).
- **À décider par le PO avant B** : (a) un nouveau numéro à chaque génération, même pour un rapport identique (proposé : oui) ; (b) institution sans sigle (`tenants.short_name` vide) : refus avec message pour l'administrateur (proposé) ou numéro sans sigle.
