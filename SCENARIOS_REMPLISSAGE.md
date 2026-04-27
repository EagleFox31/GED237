# Scénarios de remplissage — Après setup initial

Hypothèse : l'institution **MINFOP** (Ministère de la Fonction Publique) est déjà créée avec ses 25 services et 10 utilisateurs. La configuration de base (admin + services + users + N+1) est terminée. Ces scénarios servent à exercer le système de bout en bout.

---

## S1 — Premier circuit de validation (workflow type "Note de service")

**Acteur :** tenant_admin MINFOP (`MINFOP-ADM-001`)
**Objectif :** créer un workflow qui s'applique automatiquement aux notes de service.

1. Aller sur `/workflows` → **Nouveau workflow**
2. Nom : `Note de service — Validation directeur`
3. Étapes :
   - **Étape 1** — Rédaction (rôle : `collaborator`, durée max : 2j)
   - **Étape 2** — Revue chef de service (rôle : `manager`, type : `approval`)
   - **Étape 3** — Validation directeur (rôle : `responsable`, type : `approval`)
   - **Étape 4** — Diffusion (rôle : `tenant_admin`, type : `notification`)
4. Sauvegarder.

**Vérification :** le workflow apparaît dans `/workflows`, statut `draft` ou `active`.

---

## S2 — Règle IFTTT : auto-routage des contrats vers la DAF

**Acteur :** tenant_admin MINFOP
**Objectif :** tout document classé `Contrat` est automatiquement assigné à un user de la DAF.

1. Aller sur `/rules` → **Nouvelle règle**
2. Nom : `Routage contrats → DAF`
3. **Conditions** (toutes vraies) :
   - `document.metadata.category` = `Contrat`
   - `document.tenant_id` = MINFOP
4. **Actions** :
   - `assign_to_user` : `MINFOP-DAF-001`
   - `notify_user` : `MINFOP-DAF-001` (email + in-app)
   - `add_tag` : `auto-routé`
5. Activer la règle.

**Vérification :** dépôt d'un doc avec `category=Contrat` → le user DAF reçoit une notification et le doc apparaît assigné.

---

## S3 — Dépôt de document avec OCR

**Acteur :** collaborator (`MINFOP-COL-001`)
**Objectif :** valider la chaîne `upload → OCR → indexation → recherche full-text`.

1. Aller sur `/documents` → **Nouveau document**
2. Uploader un PDF scanné (ex : `note_circulaire_2026.pdf`)
3. Renseigner : titre, catégorie `Circulaire`, mots-clés
4. Soumettre → état `processing`
5. Attendre 30–60s (Celery + OCR)
6. État passe à `active`, `ocr_text` rempli, `tsvector` indexé

**Vérification :**
- `/search` avec un mot du PDF → le doc remonte en résultat
- Le surlignage du terme apparaît dans l'aperçu

---

## S4 — Cycle complet d'un workflow

**Acteurs :** chaîne MINFOP-COL-001 → MGR-001 → DG-001
**Objectif :** dérouler le workflow S1 sur un vrai document.

1. **Collaborateur** (`COL-001`) : créer un document, lui attacher le workflow `Note de service — Validation directeur`
2. **Soumission** : étape 1 marquée `completed`, étape 2 passe à `pending` chez `MGR-001`
3. **Manager** (`MGR-001`) : ouvrir la notification, lire le doc, **Approuver** avec commentaire
4. **Responsable** (`DG-001`) : reçoit la tâche, **Approuver** ou **Renvoyer** (test rejet)
5. Si approuvé → étape 4 (diffusion) → tenant_admin reçoit notification
6. Document final : statut `validated`

**Vérification :**
- `/workflows/<id>/history` montre les 4 étapes avec timestamps
- `/audit` log chaque transition (table `workflow_steps`, action `update`)

---

## S5 — Test de l'escalade hiérarchique (N+1)

**Acteur :** collaborator
**Objectif :** valider le flag SLA et l'escalade vers le N+1.

1. Créer une règle IFTTT :
   - **Condition** : `workflow_step.pending_since > 48h` ET `workflow_step.assignee.role` = `manager`
   - **Action** : `notify_user` = `assignee.reports_to_user_id` (le N+1)
2. Lancer le workflow S4
3. Manager n'agit pas pendant 2 jours (en test : modifier `created_at` en base ou utiliser un mock de durée)
4. Le N+1 du manager (le responsable) reçoit une notification d'escalade

**Vérification :** notification reçue par le responsable, pas par d'autres N-1 du même service.

---

## S6 — Recherche full-text avancée

**Acteur :** auditor (`MINFOP-AUD-001`)
**Objectif :** valider le moteur de recherche TSVECTOR + filtres.

1. Pré-requis : avoir au moins 20 documents avec OCR fait (boucler S3 sur 20 PDF différents)
2. Aller sur `/search`
3. Tests :
   - Recherche simple : `budget 2026` → résultats classés par pertinence
   - Recherche avec filtres : tenant=MINFOP, catégorie=Note, date `> 2026-01-01`
   - Recherche par auteur : `created_by=MINFOP-COL-001`
   - Recherche dans le contenu OCR uniquement (`source=ocr_text`)

**Vérification :** chaque filtre réduit le set de résultats, surlignage des termes dans l'aperçu.

---

## S7 — Audit log et traçabilité

**Acteur :** auditor
**Objectif :** vérifier que toutes les actions critiques sont tracées.

1. Aller sur `/audit`
2. Filtres à tester :
   - `table_name=documents`, `action=delete` → suppressions de docs
   - `table_name=users`, `action=update` → changements de rôle, statut
   - `table_name=workflow_steps`, `action=insert` → créations d'étapes
3. Exporter en CSV (si fonctionnalité présente)

**Vérification :** chaque action de S1–S6 a généré une entrée dans `audit_logs`.

---

## S8 — Suspension d'utilisateur et impact

**Acteur :** tenant_admin MINFOP
**Objectif :** valider qu'un user désactivé ne peut plus se connecter ni recevoir de tâches.

1. Aller sur `/tenants/<minfop-id>` → onglet Utilisateurs
2. Sélectionner `MINFOP-MGR-001` → menu actions → **Désactiver**
3. Tenter login avec `MINFOP-MGR-001` → refus (compte désactivé)
4. Tenter d'assigner une étape de workflow à ce user → refus (champ `is_active=false` filtré)
5. Vérifier que ses subordonnés (N-1) sont visibles mais leur N+1 reste pointé vers le user désactivé (à corriger manuellement ou via règle)

**Vérification :** le badge **N-1** du user reste, mais ses subordonnés signalent un manager inactif.

---

## S9 — Multi-tenant : isolation stricte

**Acteurs :** super_admin, tenant_admin MINFOP, tenant_admin MINESUP
**Objectif :** prouver qu'aucun user d'un tenant ne voit la donnée d'un autre.

1. **super_admin** : créer un doc dans MINFOP et un dans MINESUP
2. **tenant_admin MINFOP** : se connecter, aller sur `/documents` → ne voit QUE les docs MINFOP
3. **tenant_admin MINESUP** : idem, ne voit QUE les docs MINESUP
4. **Tentative directe API** : `tenant_admin MINFOP` appelle `GET /documents/<id-minesup>` → 403/404

**Vérification :** filtre `tenant_id` appliqué à toutes les requêtes (ORM + API).

---

## S10 — Reprise après incident (resilience)

**Acteur :** super_admin
**Objectif :** vérifier le comportement lors d'une coupure Celery / Redis.

1. **Pendant un dépôt OCR** : couper Celery worker (`docker compose stop celery_worker`)
2. Le doc reste en état `processing`
3. Redémarrer Celery
4. Le job reprend automatiquement (retry policy) → état `active`
5. Idem avec Redis : couper, vérifier que les sessions JWT actives ne se terminent pas brutalement (le blacklist tombe le temps de la coupure → comportement à documenter)

**Vérification :** logs Celery montrent retry, état final cohérent.

---

## Données seed à étendre

Pour exercer ces scénarios à l'échelle, étendre `backend/scripts/seed_db.py` :

- 50 documents MINFOP (catégories variées : Note, Circulaire, Contrat, Rapport)
- 30 documents MINESUP
- 5 workflows types (Note, Décision, Mission, Achat, Recrutement)
- 10 règles IFTTT
- 100 audit_logs simulés sur 6 mois (pour tester graphiques temporels)

---

## Ordre de remplissage recommandé

```
S1 (workflow) → S2 (règle) → S3 (1 doc) → S4 (cycle) → S6 (search)
                                    ↓
                            S5 (escalade) ← S8 (suspension)
                                    ↓
                            S7 (audit) → S9 (isolation) → S10 (resilience)
```

Démarrer par **S1 + S3** pour avoir un système qui "tourne", puis itérer.
