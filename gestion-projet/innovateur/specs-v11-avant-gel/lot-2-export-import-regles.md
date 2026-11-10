# Lot 2 — Export / import des règles de classement (écart 7, réouvert par la révision du 10/11 de DEC-2026-002)

Pour : dev-backend (API), dev-frontend (deux boutons), ci-qa (preuve), orchestrateur. Fiche courte de l'innovateur, 2026-11-10, lue sur `main` 950e66b. Règle : **livré si fusionné le mer 19/11 18:00, sinon V1.1** (phrase d'écart § 4 de DEC-002 inchangée : « l'export des règles est le lot Mois 5 du CDC »). Périmètre : les **règles de classement** (`/classification-rules/rules`, écran règles + simulation de P2/P3), pas les règles de routage workflow (`/gedrules/rules`), qui restent V1.1. Niveaux : `Vérifié` = lu dans le dépôt ; `Proposé` = à trancher dans la PR. Pas de code ici.

**État au 10/11 11:10** : PR B **#79** (`feat/rules-export-import`, CI verte) et PR F **#84** (`feat/classification-rules-io`, CI verte) ouvertes ; non fusionné. Écarts acceptés : `skip` « identique », `applied`.

## 1. Existant (`Vérifié`)

| Où | Ce qui existe |
|---|---|
| `api/v1/endpoints/classification.py:614-742` | `GET/POST /rules`, `GET/PATCH/DELETE /rules/{id}`, `POST /simulate` ; droits `classification_rules:read/create/update` ; aides réutilisables `_normalize_code` (`:39`), `_ensure_rule_code_unique` (`:246`), `_validate_rule_payload` (`:264`, vérifie que chaque référence appartient au tenant), `_rule_column_values` (`:350`). |
| `schemas/classification_admin.py:75-132` | `ClassificationRuleCreate` : `code, name, description, priority, is_active, source_scope, source_*_id(s), filename_pattern, mime_type_pattern, target_scope, target_*_id, domain_id, activity_id, year_strategy, fixed_year, workflow_template_id`. Toutes les références sont des **UUID propres à une base** : un export brut n'est pas rejouable sur une autre pile. |
| Référentiels | `org_units.code` (unique), `document_categories.code`, `classification_domains.code`, `classification_activities.code`, `users.matricule`, `workflow_templates.code` (unique par tenant) : **chaque référence a un code lisible**. |
| Frontend | `profiles/tenant-admin/pages/gedrules/ClassificationSettingsTab.tsx` (liste, création, simulateur), `services/resources/classification.api.ts:141-166`. |
| Jeu de démo | `jeu-donnees-demo.md` § 5 étape 2 : règles créées par `POST /rules` depuis un JSON ; D1 est en cours chez B (jeu 12–ven 13). |
| Tests | `tests/api/test_classification_admin.py` (7), `test_classification_crud_coverage.py` ; e2e `specs/classification-admin.spec.ts:160,183`. |

## 2. Contrat (`Proposé`)

1. **Format d'échange** : JSON `{"format": "ged237-classification-rules", "version": 1, "exported_at", "tenant_code", "rules": [...]}`. Chaque règle porte les champs de `ClassificationRuleCreate` **sauf les UUID**, remplacés par des codes : `document_category_codes[]`, `source_org_unit_codes[]`, `source_org_unit_excluded_codes[]`, `source_user_matricules[]`, `target_org_unit_code`, `target_user_matricule`, `domain_code`, `activity_code`, `workflow_template_code`. Les champs simples (`code, name, description, priority, is_active, source_scope, filename_pattern, mime_type_pattern, target_scope, year_strategy, fixed_year`) passent tels quels. Même format en sortie et en entrée : **un export réimporté sur une base identique = zéro changement**.
2. **`GET /classification-rules/rules/export`** → ce JSON, `Content-Disposition: attachment; filename="regles-classement-<tenant_code>-<AAAAMMJJ>.json"`, droit `classification_rules:read`, tenant courant, règles actives et inactives, triées `priority, code`.
3. **`POST /classification-rules/rules/import`** (corps = le JSON, `?dry_run=true|false`, défaut `true`, `?mode=upsert|create_only`, défaut `upsert`), droit `classification_rules:create`. Pour chaque règle : résolution des codes sur **le tenant courant** ; code de règle existant → `skip` (raison « identique ») si le contenu résolu est identique, sinon `update` (en `upsert`) ou `skip` (en `create_only`) ; inexistant → `create`. Réponse `{"dry_run", "applied": bool, "created": n, "updated": n, "skipped": n, "rejected": n, "items": [{"code", "action": "create|update|skip|reject", "reason"}]}` ; `applied` vaut `false` en `dry_run` ou dès qu'une règle est rejetée (précisions de dev-backend le 10/11, retenues). **Tout ou rien** : une référence introuvable rejette la règle et, si `rejected > 0`, l'import n'écrit rien (200 avec le rapport, pas de 4xx : le rapport est le résultat attendu). `format`/`version` inconnus → 422. Taille : ≤ 500 règles par fichier (`Proposé`).
4. **Réutilisation** : l'import reconstruit un `ClassificationRuleCreate` par règle et passe par `_validate_rule_payload` + `_rule_column_values` ; aucune duplication des contrôles existants. Pas de migration, pas de nouveau modèle.
5. **Frontend** : dans `ClassificationSettingsTab`, un bouton « Exporter » (téléchargement du JSON) et un bouton « Importer » (sélecteur de fichier → appel `dry_run=true` → petit dialogue « n à créer, n à mettre à jour, n rejetées (raisons) » → bouton « Confirmer » = `dry_run=false`). Erreurs via `pushApiError`. Copie utilisateur courte, pas de jargon « manifeste ».
6. **Hors périmètre** : règles de routage workflow, référentiels (domaines, activités, catégories, unités) dans le même fichier, formats CSV/YAML, import depuis l'UI collaborateur.

## 3. Cas de test

| Cas | Entrée | Attendu |
|---|---|---|
| pytest aller-retour | tenant avec 3 règles (fixture CRUD existante) → export → import `dry_run=false` sur le même tenant | `created 0, updated 0, skipped 3` (raison « identique »), `applied true` ; `GET /rules` identique avant/après, `updated_at` inchangé (zéro écriture) |
| pytest création | fichier d'une règle au code nouveau, codes de référentiels valides | `created 1` ; la règle est lue par `GET /rules/{id}` avec les bons UUID résolus |
| pytest référence inconnue | `domain_code: "ZZZ"` sur une règle parmi 3 | `rejected 1`, `created 0`, aucune écriture ; `items[].reason` nomme le champ et le code |
| pytest dry run | même fichier valide, `dry_run=true` | rapport rempli, `GET /rules` inchangé |
| pytest isolation | export du tenant A, import par un compte du tenant B | règles créées **dans B**, références résolues sur les codes de B ; codes absents → rejet |
| pytest droits | lecteur (`READ001`) sur export et import | 403 |
| pytest format | `version: 2` ou `format` absent | 422 |
| e2e `classification-admin.spec.ts` | « Exporter » → fichier téléchargé ; « Importer » du même fichier → dialogue « 0 à créer, 0 à mettre à jour, n identiques » → Confirmer | liste des règles inchangée, toast de succès |

## 4. Preuve attendue dans la PR

- B : pytest vert (7 cas) en Docker ; export du jeu de démo joint à la PR (le JSON des règles de D1 **devient** le fichier d'import du profil `demo` : une seule source, B l'adapte dans `e2e_reset.sh demo` si le lot est fusionné avant le 19).
- F : capture des deux boutons et du dialogue de confirmation ; build + lint Docker ; spec e2e verte en local.
- Q : rejeu sur pile Docker : export → `e2e_reset.sh demo` → import → `GET /rules` identique ; ligne SC-ADM-10 « export/import des règles » dans `matrice-recette.md` (par I à la fusion).
- Budget en temps de session : B ≈ 0,3 j, F ≈ 0,2 j, Q ≈ 0,05 j. Ordre : PR B d'abord (F dépend du format § 2.1).

Sources : fichiers cités, lus le 10/11 sur `main` 950e66b ; `DEC-2026-002` § 4 et révision du 10/11 ; `jeu-donnees-demo.md` § 5 ; `plan-presentation.md` § 3.
