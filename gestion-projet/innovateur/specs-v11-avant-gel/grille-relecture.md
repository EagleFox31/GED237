# Grille de relecture des PR des cinq lots réouverts (coupure mer 19/11 18:00)

Pour : O (relecture et fusion), ci-qa (preuve), B et F (auto-contrôle avant `ready`). Innovateur, 2026-11-10, tirée des cinq fiches de ce dossier. Une case non cochée = question dans la PR, pas de fusion ; un écart assumé par rapport à la fiche est accepté s'il est **écrit dans la PR** (comme `refused_import` du lot 1). Rappel : non fusionné le 19/11 18:00 = V1.1, phrase d'écart inchangée.

## 0. Commun à toutes les PR

- [ ] PR depuis `main` à jour (pas de PR empilée) ; CI verte ; pre-commit passé (pas de `--no-verify`).
- [ ] Aucun mot de passe, OTP, jeton ni secret dans le diff, les tests, les logs ou la description.
- [ ] Nouvelles variables de configuration : `core/config.py` + `.env.example` + les deux compose, valeur par défaut sûre ; aucune valeur assouplie « pour les e2e » sans justification écrite.
- [ ] Nouvelle migration : `alembic upgrade head` puis `downgrade -1` puis `upgrade head` montrés sur `test_ged` ; note dans la PR « à rejouer sur `edossier` et les piles » ; aucune donnée existante modifiée sans migration de données explicite.
- [ ] Tests : tous ceux de la fiche présents (ou écart écrit) ; **les anciens tests passent sans modification** (une assertion existante changée = question) ; pytest en Docker, sortie jointe.
- [ ] Droits : chaque nouvelle route nomme son `authorize_or_403` ; cas 403 testé ; isolation tenant testée.
- [ ] Erreurs : Problem Details / `detail` lisibles en français, codes HTTP de la fiche ; pas de 500 attrapé en 200.
- [ ] Audit : actions nouvelles nommées comme dans la fiche ; jamais de données sensibles dans `new_data`.
- [ ] Frontend : build + lint Docker ; capture jointe ; copie courte, aide par icône ; erreurs via `pushApiError` ; aucune route ni menu nouveau non prévu.
- [ ] Walkthrough `DONE` avec checklist RAIDER ; fiche d'écart V1.1 mise à jour par I à la fusion (criteres-acceptation, matrice-recette, plan-presentation).

## 1. Lot 1 — KPI doublons (`lot-1-kpi-doublons.md`)

- [ ] Contrat : `GET /analytics/tenant` renvoie `duplicates: {refused, refused_upload, refused_import}` ; `refused = refused_upload + refused_import` ; clés existantes inchangées (tests `test_analytics.py` intacts).
- [ ] `refused_upload` = lignes d'audit `dup_detected` du tenant ; `refused_import` = somme `duplicate_files` des jobs **engagés** (`running`, `completed`, `completed_with_errors`), écart accepté le 10/11.
- [ ] Idempotence : deux appels successifs = mêmes valeurs ; aucune écriture dans une route `GET`.
- [ ] Non-régression : même façade `DashboardFacade`, aucune migration, aucun autre tableau de bord touché ; tenant sans doublon → `0` et non `null`.
- [ ] Tests : 4 pytest (vide, upload 409, import, isolation) ; e2e `dashboards.spec.ts` ou `demo-counters` étendu.
- [ ] F : 5e carte « Doublons refusés », `?? 0`, interface `TenantAnalytics` typée (plus de `any`) ; capture.
- [ ] Risque spécifique : ne pas compter `dup_detected` des versions (`:1736-1750`) deux fois ; vérifier la requête `count` filtrée par `tenant_id`.

## 2. Lot 2 — Export / import des règles (`lot-2-export-import-regles.md`)

- [ ] Contrat : format `ged237-classification-rules` v1, codes à la place des UUID (liste § 2.1 de la fiche) ; `GET …/rules/export` attachment ; `POST …/rules/import?dry_run&mode` ; rapport `{created, updated, skipped, rejected, items[]}` ; 422 sur `format`/`version` inconnus ; ≤ 500 règles.
- [ ] Idempotence : test aller-retour export → import sur la même base = `skipped` « identique » seulement, `applied true`, `GET /rules` identique `updated_at` compris ; `dry_run=true` ne commite rien (vérifié par une lecture après).
- [ ] Tout ou rien : `rejected > 0` ⇒ aucune écriture (test « référence inconnue » avec 3 règles) ; pas d'écriture partielle entre deux `flush`.
- [ ] Réutilisation : passe par `_validate_rule_payload` / `_rule_column_values` / `_ensure_rule_code_unique` ; aucun contrôle dupliqué.
- [ ] Non-régression : routes `/rules` existantes inchangées ; `test_classification_admin.py` et `test_classification_crud_coverage.py` intacts ; la route `/rules/export` est déclarée **avant** `/rules/{id}` (sinon `export` est pris pour un UUID → 422).
- [ ] Isolation : import par le tenant B résout les codes de B ; codes absents → rejet, jamais une référence du tenant A.
- [ ] F : Exporter / Importer / dialogue de confirmation « n à créer, n à mettre à jour, n rejetées » ; `dry_run` avant `Confirmer` ; capture.
- [ ] Jeu de démo : si fusionné, le JSON exporté devient la source de D1 (une seule source) ; sinon rien à changer.

## 3. Lot 3 — Export du journal (3a) et verrou OTP (3b) (`lot-3-export-journal-verrou-otp.md`)

3a :
- [ ] Contrat : `GET /audit/logs/export` CSV (BOM, `;`, attachment), filtres de `/logs` + `date_from`/`date_to`, plafond 50 000 → 422 ; `StreamingResponse` (pas de liste en mémoire ; vérifier qu'aucun `.all()` ne précède le flux sur le volume total).
- [ ] Colonnes : les 8 de la fiche, pas de `old_data`/`new_data`/`user_agent`.
- [ ] L'export est journalisé (`audit_logs` / `exported`, `rows` + filtres) ; test « trace ».
- [ ] Non-régression : `/audit/logs` inchangé ; route `export` déclarée avant toute route paramétrée.
- [ ] F : bouton « Exporter (CSV) » avec les filtres actifs ; `skip` retiré de `auditor-export.spec.ts` ; capture + fichier ouvert dans un tableur.

3b :
- [ ] Contrat : `otp_fail:{user_id}` INCR + EXPIRE ; 3e échec → `lock:{user_id}` TTL `AUTH_LOCKOUT_SECONDS`, suppression `otp:`/`session:` ; 423 `ACCOUNT_LOCKED` + `retry_after` ; `login` verrouillé → 423 **sans** vérifier le mot de passe (test : temps de réponse ou absence d'appel au hachage).
- [ ] Remise à zéro sur OTP juste ; compteur par **utilisateur**, pas par jeton (sinon relogin = contournement).
- [ ] Audit `users` / `account_locked` sans OTP ni mot de passe ; si audit `login` ajouté : `login` / `login_failed` sans mot de passe.
- [ ] Non-régression : `test_auth_rate_limit.py` (7) intacts ; limite IP inchangée ; `logout`/`refresh` inchangés ; e2e existants qui saisissent un OTP faux volontairement (vérifier `auth.spec.ts`) ne déclenchent pas le verrou par accident (≤ 2 essais ou compte dédié).
- [ ] Config par défaut `3` / `900` partout, pas d'assouplissement e2e.
- [ ] F : message du 423 + bouton désactivé pendant `retry_after` ; assertion E3 ; capture.

## 4. Lot 4 — Critères contenu OCR et date (`lot-4-criteres-contenu-date.md`)

- [ ] Migration : 3 colonnes nullables (`content_pattern`, `year_min`, `year_max`), `downgrade` symétrique ; règles existantes inchangées (critères vides = inactifs, test « règle existante classe comme avant »).
- [ ] Moteur : 2 contrôles de plus (`content_pattern`, `year_range`), mêmes `_normalize` et sémantique « au moins un » que `filename_pattern` ; `year_range` sur l'année résolue par `_resolve_year` ; `matched = all(...)` inchangé.
- [ ] **Avant / après OCR (point critique)** : à l'upload, `ocr_content` vide ⇒ contrôle contenu différé, document `pending`, jamais `classified` à tort ni `needs_review` par défaut ; après `update_document_ocr`, reclassement **seulement si `classification_status` est `pending` ou `needs_review`** ; un document déjà `classified`, par règle ou à la main, n'est pas repris (test « non-reclassement ») ; second passage OCR = no-op (`updated_at` identique).
- [ ] Worker : `classify_document` appelé dans la même session que `update_document_ocr`, `source_scope`/`source_user_id` lus sur le document ; en cas d'exception du moteur, l'OCR reste sauvegardé (pas de rollback du texte) et l'erreur est loguée.
- [ ] Simulateur : `content_sample` optionnel ; sans lui, le contrôle contenu rend `passed=False` et un détail explicite (pas un faux positif).
- [ ] Lot 2 : les 3 champs dans l'export/import, optionnels, **sans** bump de version ; test aller-retour.
- [ ] Non-régression : `test_rules.py`, `test_classification_*` intacts ; 5 clés de contrôle existantes inchangées (le front les affiche par structure) ; `ingest-directory` suit la même séquence.
- [ ] F : champs « Mots-clés du contenu », « Année min / max », zone « Extrait du contenu » ; aide : « un document déjà classé n'est pas reclassé après l'OCR » ; PR F après fusion de B.
- [ ] Risque : coût mémoire du moteur sur `ocr_content` long (lecture en mémoire d'un seul document, pas de requête plein texte) ; pas de regex utilisateur.

## 5. Lot 5 — Surveillance continue d'un dossier (`lot-5-surveillance-dossier.md`)

- [ ] **Racines autorisées (point critique)** : chaque `path` de `INGEST_WATCH_FOLDERS` est résolu (`realpath`) et contrôlé par la même fonction que `ingest-directory` ; hors `INGEST_ALLOWED_ROOTS` ⇒ ignoré + log au démarrage ; `INGEST_ALLOWED_ROOTS` vide ⇒ surveillance inactive quelle que soit la config ; test dédié ; liens symboliques non suivis (`followlinks=False` conservé).
- [ ] Les dossiers `_traites/` et `_erreurs/` sont **exclus** du scan (sinon réimport en boucle) ; déplacement et non copie ; collision de nom dans `_traites/<date>/` gérée.
- [ ] Déduplication par `checksum_sha256` dans `DirectoryIngestionService` : `skipped` + audit `dup_detected` ; l'import manuel en profite ; test « doublon » ; le KPI du lot 1 n'est pas compté deux fois (une seule ligne d'audit par fichier).
- [ ] Idempotence : second passage sans fichier = `found 0`, zéro écriture, zéro audit ; verrou Redis `ingest_watch:lock` TTL = intervalle, libéré en `finally`.
- [ ] Fichiers en cours de copie : `INGEST_WATCH_SETTLE_SECONDS` respecté (test « fichier modifié il y a 2 s »).
- [ ] Compte auteur : `matricule` résolu dans le `tenant_code` ; compte inactif ou absent ⇒ dossier ignoré avec log, jamais d'import sans auteur ; `document_category_code` résolu dans le tenant.
- [ ] Worker : `-B` sur le service `worker` existant, **un seul** processus beat ; limites mémoire du compose inchangées ; `celery_app.py` garde `include` ; l'OCR des fichiers importés part comme pour l'import manuel.
- [ ] Statut : `GET /documents/ingest-watch/status` renvoie seulement les dossiers du tenant courant ; `enabled`, `interval_seconds`, `last_run` ; droit `documents:create` ; test isolation.
- [ ] Audit : `documents` / `watch_ingested` seulement si `imported > 0` ou `errors > 0`.
- [ ] Non-régression : `test_ingest_allowed_roots.py` (7) intacts ; `POST /ingest-directory` inchangé hors dédup (rapport `skipped` désormais renseigné pour les doublons : vérifier qu'aucun test n'attend `skipped == 0` sur un corpus dupliqué).
- [ ] Compose / recette Q : dossier `/data/ingest/surveille` sur la pile e2e/démo, intervalle 15 s, recette rejouée deux fois (seconde = `found 0`), logs worker joints.
- [ ] F : encart compact sur `DirectoryIngestion.tsx`, rafraîchi 30 s, « Surveillance désactivée » sinon ; pas de configuration par l'UI.

## 6. À la fusion de chaque lot (I)

- [ ] `criteres-acceptation.md` + `matrice-recette.md` : ligne SC-ADM-09 (lot 1), SC-ADM-10 (lot 2), SC-AUD-02 « Livré » et SC-AUTH-02 E3 (lot 3), SC-ADM-11 (lot 4), SC-ADM-12 (lot 5).
- [ ] `plan-presentation.md` § 3 : écart retiré ou reformulé ; `DEC-2026-002` : relevé du 19/11 18:00 (fusionné / V1.1) reporté le soir même.
- [ ] `deroule-demo.md` : étape ajoutée seulement si le lot est jouable en moins d'une minute (lots 1, 3a, 2 ; lot 5 en coulisses ; lot 4 par le simulateur).
