# Lot 4 — Critères « contenu OCR » et « date » des règles de classement (écart 7, réouvert par la révision du 10/11 de DEC-2026-002)

Pour : dev-backend (moteur, migration), dev-frontend (formulaire de règle, simulateur), ci-qa (preuve), orchestrateur. Fiche courte de l'innovateur, 2026-11-10, lue sur `main` 950e66b. Règle : **livré si fusionné le mer 19/11 18:00, sinon V1.1** (phrase d'écart § 4 de DEC-002 inchangée : « la V1 classe sur type, origine, nom et format ; les critères contenu OCR et date sont le lot Mois 5 »). Quatrième dans l'ordre O ; **dépend du lot 2** (le format d'export doit porter les deux nouveaux champs, sinon lot 2 à amender). Niveaux : `Vérifié` = lu dans le dépôt ; `Proposé` = à trancher dans la PR. Pas de code ici.

## 1. Existant (`Vérifié`)

| Où | Ce qui existe |
|---|---|
| `services/classification_rule_engine.py:271-369` | `_evaluate_rule` produit 5 contrôles à clés fixes : `document_category`, `source_origin`, `source_user`, `filename_pattern` (mots-clés, « au moins un », `_normalize` + `_matches_filename_pattern` `:531-553`), `mime_type` ; `matched = all(...)`. `_resolve_year` (`:801`) ne sert qu'à la **cible** (`year_strategy` `fixed` / `from_filename` / année courante). |
| Moment du classement | `endpoints/documents.py:657-663` : `classify_document` est appelé **à l'upload, avant l'OCR** ; l'OCR part ensuite en tâche Celery (`:706`, `ingestion.py:322`) et `workers/tasks.py:27-50` (`update_document_ocr`) remplit `ocr_content` + `ocr_content_vector` **sans reclasser**. Même séquence pour `ingest-directory`. |
| `models/classification_rule.py:29-99` | aucune colonne de contenu ni de date ; `filename_pattern` String(255). `models/document.py:72` `classification_year`, `:86` `classification_status` (`pending / classified / needs_review / rejected`), `:131` `ocr_content`. |
| `schemas/classification.py:24-28` | `ClassificationRuleCheck(key, label, passed, detail)` : le simulateur affiche déjà une ligne par contrôle (`_build_simulation_stages` `:371`). |
| Frontend | `profiles/tenant-admin/pages/gedrules/ClassificationSettingsTab.tsx` (formulaire + simulateur), `ClassificationReviewPage.tsx` (file `needs_review`). |
| Tests | `tests/api/test_classification_admin.py`, `test_classification_crud_coverage.py`, `test_rules.py` ; e2e `classification-admin.spec.ts`. |

## 2. Contrat (`Proposé`)

1. **Deux critères de plus, mêmes conventions que `filename_pattern`** : `content_pattern` (String(255), mots-clés séparés par `,`/`;`, « au moins un » trouvé dans `ocr_content` normalisé, insensible aux accents et à la casse, même `_normalize`) et `year_min` / `year_max` (Integer, nullable, bornes inclusives sur **l'année résolue** par `_resolve_year` à partir du nom de fichier, sinon année courante). Vides = critère inactif, comme aujourd'hui. **Une migration Alembic** (3 colonnes nullables, aucune donnée à migrer, `downgrade` symétrique) ; `alembic upgrade head` sur `edossier`, `test_ged` et les piles Docker (leçon GED237).
2. **Deux contrôles de plus dans `_evaluate_rule`** : clé `content_pattern` (label « Mots-clés du contenu ») et `year_range` (label « Année du document ») ; `matched = all(...)` inchangé. Le simulateur (`POST /simulate`) accepte un champ optionnel `content_sample: str` pour tester le contenu sans fichier ; l'écran affiche les deux lignes de plus sans changement de structure.
3. **Contenu non encore disponible** : à l'upload, `ocr_content` est vide. Si une règle candidate porte un `content_pattern` et que le document n'a pas d'OCR, le contrôle est **différé** (`passed=False`, `detail="Contenu non encore extrait"`), le document reste `pending`, et **le worker reclasse après l'OCR** : `update_document_ocr` appelle `ClassificationRuleEngine.classify_document` une seconde fois (même session, mêmes `source_scope`/`source_user_id` lus sur le document) **uniquement si** `classification_status == "pending"`. Un document déjà `classified` par une règle sans critère contenu n'est jamais reclassé (pas de surprise après coup, idempotent : un second passage OCR ne change rien). Sans worker (tests API), le comportement d'aujourd'hui est conservé.
4. **Ordre des règles** : inchangé (`priority`). Une règle « contenu » de priorité supérieure à une règle « nom » gagne après l'OCR seulement si le document est resté `pending` : documenter cette limite dans l'aide du formulaire (une phrase) ; pas de « re-tirage » des règles déjà appliquées (V1.1).
5. **Lot 2** : `content_pattern`, `year_min`, `year_max` ajoutés aux champs simples du format `ged237-classification-rules` v1 (optionnels, absents = `null`) ; **pas de bump de version** du format tant que les champs sont optionnels.
6. **Frontend** : dans le formulaire de règle, un champ « Mots-clés du contenu » sous « Mots-clés du nom » et deux champs « Année min / max » ; dans le simulateur, une zone de texte « Extrait du contenu (facultatif) » ; copie courte, aide par icône (règle UX GED237). Rien dans l'écran collaborateur.
7. **Hors périmètre** : expressions régulières, recherche plein texte via `ocr_content_vector` (le moteur lit `ocr_content` en mémoire pour un document), date extraite du contenu OCR, score de confiance OCR comme critère.

## 3. Cas de test

| Cas | Entrée | Attendu |
|---|---|---|
| pytest migration | `alembic upgrade head` puis `downgrade -1` puis `upgrade head` sur `test_ged` | 3 colonnes présentes, aucune erreur |
| pytest année | règle `year_min=2024, year_max=2025` ; fichiers `rapport-2024.pdf`, `rapport-2019.pdf`, `rapport.pdf` (année courante 2026) | classé / `year_range` faux / `year_range` faux |
| pytest contenu différé | règle `content_pattern="facture;avoir"` seule ; upload sans OCR | document `pending`, contrôle `content_pattern` `passed=False`, détail « Contenu non encore extrait » |
| pytest reclassement | même règle ; `update_document_ocr(doc, "FACTURE n° 12")` | document `classified` par la règle, `classification_year` renseigné ; second appel `update_document_ocr` → aucun changement (`updated_at` identique) |
| pytest non-reclassement | document `classified` par une règle « nom » ; OCR contenant un mot-clé d'une règle « contenu » plus prioritaire | reste sur la règle « nom » |
| pytest simulateur | `POST /simulate` avec `content_sample` | 7 contrôles dans `checks`, clés `content_pattern` et `year_range` présentes |
| pytest aller-retour lot 2 | export → import d'une règle avec les 3 champs | `updated 1`, champs conservés |
| e2e `classification-admin.spec.ts` | créer une règle avec mots-clés du contenu ; simuler avec un extrait | ligne « Mots-clés du contenu : trouvé » visible |

Preuve : pytest Docker vert (7 cas) ; `alembic upgrade head` rejoué sur les deux bases + pile e2e (log joint) ; capture du formulaire et du simulateur ; spec e2e verte ; I passe l'écart 7 « contenu/date » de `plan-presentation.md` à « livré » et ajoute SC-ADM-11 dans la matrice à la fusion. Budget en temps de session : B ≈ 0,35 j (migration 0,05, moteur + worker 0,2, tests 0,1), F ≈ 0,15 j, Q ≈ 0,05 j (migration sur les piles). Ordre : PR B d'abord ; **PR F après fusion de B** (le formulaire envoie des champs que l'API doit accepter).

Sources : fichiers cités, lus le 10/11 sur `main` 950e66b ; `DEC-2026-002` § 4 écart 7 et révision du 10/11 ; `lot-2-export-import-regles.md` § 2.1 ; `CLAUDE.md` (leçon « alembic upgrade head », règles UX d'aide).
