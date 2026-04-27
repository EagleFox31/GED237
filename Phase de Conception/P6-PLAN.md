# P6 — AuthZ Production-Grade (SQL + Shadow + Observabilité)

> Statut: ✅ Terminé
> Date de clôture: 2026-04-18
> Validation: `63 passed` sur `tests/api/test_authz.py`, benchmark gate OK, runbook rollout/rollback validé.

## Objectif
Passer d’un RBAC solide en code (Casbin + CSV) à un RBAC **opérationnel en production** :
- source de vérité en base SQL,
- migration contrôlée sans split-brain,
- audit exploitable,
- invalidation cache sans redémarrage.

---

## Principes non négociables
- Pas de fallback silencieux `sql -> csv` en prod.
- Modes explicites via `AUTHZ_BACKEND=csv|sql|shadow`.
- API Policy bornée (pas d’écriture `g` au démarrage).
- Logs `deny` systématiques, `allow` seulement pour actions sensibles.
- Cache avec version (`policy_version`), pas cache aveugle.

---

## Modes d’exécution
- `csv`: source active = CSV.
- `sql`: source active = SQL uniquement.
- `shadow`: décision active = CSV, décision SQL calculée en parallèle + log des écarts.

---

## Découpage exécutable (ordre de merge)

## P6.1 — Backend AuthZ SQL
### Livrables
- Table Casbin policy en base (migration Alembic).
- Adapter SQLAlchemy Casbin branché.
- Resolver backend par env (`csv|sql|shadow`).

### Tâches
1. Créer migration `casbin_rule` (ou équivalent adapter choisi).
2. Ajouter loader backend dans `app/core/authz/casbin_enforcer.py`.
3. Implémenter mode `shadow`: évalue CSV et SQL, retourne CSV, loggue divergence structurée.
4. Documenter les modes dans `backend/README.md`.

### Critères d’acceptation
- En mode `sql`, aucune lecture de policy CSV.
- En mode `shadow`, chaque divergence contient `role/resource/action/context`.
- Boot applicatif OK sur les 3 modes.

---

## P6.2 — API Admin Policy (bornée)
### Livrables
- Endpoints `super_admin`:
  - `GET /authz/policies`
  - `POST /authz/policies` (type `p` uniquement)
  - `DELETE /authz/policies` (type `p` uniquement)
  - `GET /authz/roles`

### Tâches
1. Schémas Pydantic dédiés (vocabulaire figé des actions).
2. Validation stricte des `resource/action`.
3. Idempotence add/remove.
4. Audit obligatoire à chaque mutation de policy.

### Critères d’acceptation
- Impossible d’écrire des lignes `g` via API.
- Add/delete idempotents (pas de doublons, pas d’erreur destructive).
- Toute mutation produit un audit lisible.

---

## P6.3 — Observabilité AuthZ
### Livrables
- Logging structuré AuthZ.
- Propagation `request_id`.
- Métriques agrégées AuthZ.

### Tâches
1. `deny`: log systématique.
2. `allow`: log seulement pour actions sensibles (`manage`, `delete`, `assign`, `resolve_review`, mutations policy).
3. Ajouter compteurs agrégés par rôle/ressource/action/tenant.
4. Dashboard minimal (ou extraction Prometheus/Grafana selon stack).

### Critères d’acceptation
- Incident authz traçable bout-en-bout via `request_id`.
- Pas de bruit massif de logs sur `allow` non sensible.

---

## P6.4 — Cache + Version
### Livrables
- Enforcer singleton + cache.
- Version de policy persistée.
- Invalidation sans redémarrage.

### Tâches
1. Ajouter `policy_version` (table dédiée ou metadata).
2. Incrémenter version à chaque mutation policy.
3. Sur requête authz: reload lazy si `local_version < db_version`.
4. Sécuriser concurrence (lock léger process).

### Critères d’acceptation
- Une mutation policy devient effective sans restart.
- Pas de reload global à chaque requête.

---

## P6.5 — Tests + Rollout
### Livrables
- Suite tests P6.
- Runbook de déploiement.
- Procédure rollback.

### Tâches
1. Tests adapter SQL: persistance, redémarrage, rechargement.
2. Tests `shadow`: comparaison CSV/SQL + capture écarts.
3. Non-régression endpoints critiques (`documents`, `workflows`, `users`, `org_units`).
4. Test multi-instance simulé (deux workers, mutation policy visible des deux côtés).
5. Runbook:
   - phase 1: `shadow`,
   - phase 2: analyse écarts + corrections,
   - phase 3: cutover `sql`,
   - phase 4: retrait CSV prod.

### Critères d’acceptation
- Zéro écart non expliqué en `shadow`.
- Cutover `sql` sans régression de permissions.

---

## P6b.6 — Benchmark latence CSV vs SQL (NOUVEAU)
### Livrables
- Suite `pytest-benchmark` comparant enforcer CSV et SQL.
- Seuil de régression documenté.

### Tâches
1. Installer `pytest-benchmark` dans les dépendances dev.
2. Écrire benchmark : 1000 décisions `enforce(role, resource, action)` en CSV vs SQL.
3. Mesurer p50, p95, p99 — seuil acceptable : p99 < 5ms par décision.
4. Intégrer dans CI : regression fail si p99 dépasse le seuil de +20%.
5. Documenter les résultats dans le runbook.

### Critères d'acceptation
- Latence SQL ≤ 2x latence CSV en p99.
- Régression détectée automatiquement en CI.

---

## P6b.7 — Rate limiting API policy (NOUVEAU)
### Livrables
- Rate limit sur mutations policy.
- Confirmation pour mutations bulk.

### Tâches
1. Appliquer `slowapi` sur `POST/DELETE /authz/policies` : max 10 mutations/min par user.
2. Ajouter validation : si la mutation affecte > 5 policies d'un coup → `HTTP 400` avec message explicite.
3. Log `WARNING` sur toute mutation policy (déjà couvert par P6b.2, vérifier).

### Critères d'acceptation
- Impossible de supprimer toutes les policies en un script rapide.
- Rate limit actif même pour `super_admin`.

---

## P6b.8 — Backup automatique pre-cutover (NOUVEAU)
### Livrables
- Script de backup/restore policy.
- Procédure de rollback < 1 minute.

### Tâches
1. Script `backup_policies.py` : dump `policy.csv` + `pg_dump` table `casbin_rule` → fichier daté.
2. Script `restore_policies.py` : restore depuis backup → reload enforcer.
3. Intégrer le backup dans le runbook rollout : exécution automatique avant chaque phase.
4. Test de restore : vérifier que le système repart correctement après rollback.

### Critères d'acceptation
- Backup créé automatiquement avant cutover shadow → sql.
- Restore testé et documenté, temps < 1 min.

---

## Definition of Done P6b
- Source active des policies en prod = SQL.
- Zéro fallback silencieux `sql -> csv`.
- Zéro écart non expliqué CSV vs SQL en shadow.
- Mutation policy visible sans redémarrage.
- Logs/metrics exploitables en incident.
- Tests authz critiques verts.
- **Latence SQL benchmarkée et dans les seuils acceptables.**
- **API policy rate-limitée.**
- **Backup/restore testé et documenté.**

---

## Clôture
Le lot P6b est considéré terminé.
Phase suivante recommandée: **P7 (UI -> API réelle)** avec branchage des vues frontend sur les endpoints AuthZ admin et suppression des mocks résiduels.

---

## Risques & garde-fous
- Risque split-brain: évité par modes explicites + interdiction fallback silencieux.
- Risque bruit logs: évité par stratégie `deny all` + `allow sensible only`.
- Risque stale cache: évité par `policy_version` + reload lazy.
- **Risque régression perf:** évité par benchmark CI avec seuil p99.
- **Risque mutation accidentelle:** évité par rate limiting + confirmation bulk.
- **Risque cutover irréversible:** évité par backup automatique pre-cutover + restore testé.
