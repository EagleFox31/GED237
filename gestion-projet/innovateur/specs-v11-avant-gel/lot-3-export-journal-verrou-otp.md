# Lot 3 — Export du journal d'audit (D4, écart 8) et verrou après 3 OTP erronés (écart 9 / n° 12), réouverts par la révision du 10/11 de DEC-2026-002

Pour : dev-backend (API), dev-frontend (bouton, message de verrou), ci-qa (preuve), orchestrateur. Fiche courte de l'innovateur, 2026-11-10, lue sur `main` 950e66b. Règle : **livré si fusionné le mer 19/11 18:00, sinon V1.1** (SC-AUD-02 « Non livré, V1.1 » et « 5 tentatives/min par IP ; verrou par compte en V1.1 » restent les phrases de repli). Deux sous-lots indépendants, **deux PR B** possibles ; 3a d'abord (visible en P7). Niveaux : `Vérifié` = lu dans le dépôt ; `Proposé` = à trancher dans la PR. Pas de code ici.

**État au 10/11 11:10** : 3a PR B **#80** (`feat/audit-export`, CI verte) ouverte ; 3b PR B **#83** (`feat/otp-lockout`, CI verte, apporte `DOCS/exploitation/deverrouiller-compte.md`) ouverte ; PR F non ouvertes ; non fusionné.

## 3a. Export du journal d'audit

### Existant (`Vérifié`)

| Où | Ce qui existe |
|---|---|
| `api/v1/endpoints/audit.py:132-175` | `GET /audit/logs` : filtres `table_name`, `action`, `skip`, `limit ≤ 500`, tri `created_at desc`, droit `audit_logs:read` ; `_serialize_audit_log` (`:100-131`) produit `user_name, user_matricule, table_label, resource_label, action_label, detail, ip_address, user_agent, created_at`. |
| `frontend/profiles/auditor/pages/AuditLogs.tsx` | charge 200 lignes (`:72`), filtres colonne ; **aucun bouton d'export**. `services/resources/audit.api.ts:18`. |
| e2e | `specs/auditor-export.spec.ts:17` (SC-AUD-02) existe déjà : clic sur un bouton `/exporter|export|csv|télécharger/i`, attend un `download` ; aujourd'hui elle saute si le bouton est absent. |

### Contrat (`Proposé`)

1. **`GET /audit/logs/export`** → **CSV** (`text/csv; charset=utf-8`, BOM UTF-8, séparateur `;` pour Excel en français, `Content-Disposition: attachment; filename="journal-audit-<AAAAMMJJ-HHMM>.csv"`), mêmes filtres que `/logs` (`table_name`, `action`) plus `date_from`/`date_to` (ISO, inclusives) ; **pas de `limit`**, plafond 50 000 lignes (au-delà : 422 « affinez la période ») ; `StreamingResponse` ligne à ligne, tri `created_at desc`. Droit `audit_logs:read`, tenant courant.
2. **Colonnes** (en-tête français) : `Date` (ISO local), `Matricule`, `Utilisateur`, `Objet` (`table_label`), `Ressource` (`resource_label`), `Action` (`action_label`), `Détail`, `Adresse IP`. Ni `old_data`/`new_data` bruts ni `user_agent` (lisibilité, pas de données techniques dans un export auditeur) ; le JSON reste dans `/logs`.
3. **L'export est lui-même journalisé** : une ligne `table_name="audit_logs"`, `action="exported"`, `new_data={"rows": n, "filters": {...}}` (un auditeur qui extrait est tracé).
4. **Frontend** : bouton « Exporter (CSV) » en tête de `AuditLogs.tsx`, qui reprend les filtres actifs de l'écran ; téléchargement direct ; erreurs via `pushApiError`.
5. **Hors périmètre** : XLSX/PDF, export planifié, signature de l'export.

### Cas de test

| Cas | Entrée | Attendu |
|---|---|---|
| pytest contenu | tenant avec ≥ 3 lignes d'audit (login + upload + doublon) | 200, BOM, en-tête de 8 colonnes, 3 lignes + 1 (l'export journalisé n'apparaît qu'au second export) |
| pytest filtres | `action=dup_detected` ; `date_from` > dernière ligne | 1 ligne ; 0 ligne (en-tête seul) |
| pytest isolation | compte d'un autre tenant | aucune ligne du premier tenant |
| pytest droits | collaborateur sans `audit_logs:read` | 403 |
| pytest trace | après un export, `GET /logs?table_name=audit_logs` | 1 ligne `exported` avec `rows` |
| e2e `auditor-export.spec.ts` | AUDIT001 → `/audit` → « Exporter (CSV) » | fichier `.csv` téléchargé, non vide (spec existante, `skip` retiré) |

Preuve : pytest Docker vert (5 cas) ; capture du bouton + fichier ouvert dans un tableur ; spec e2e verte ; I passe SC-AUD-02 de « Non livré » à « Livré » dans `criteres-acceptation.md` et `matrice-recette.md` à la fusion. Budget en temps de session : B ≈ 0,15 j, F ≈ 0,1 j.

## 3b. Verrou par compte après 3 OTP erronés

### Existant (`Vérifié`)

| Où | Ce qui existe |
|---|---|
| `services/auth_service.py:97-160` | `login` pose `otp:{session_token}` et `session:{session_token}` dans Redis (TTL `OTP_EXPIRY_SECONDS`) ; `verify_otp` compare et lève `AuthenticationError("Invalid OTP")` ; **aucun compteur d'échecs**, le même `session_token` peut être rejoué jusqu'à l'expiration. |
| `api/v1/endpoints/auth.py:35-97`, `core/rate_limit.py:39` | limites **par IP** (`AUTH_LOGIN_RATE_LIMIT`, `AUTH_OTP_RATE_LIMIT`, défaut `5/minute`, `30/minute` sur la pile e2e) ; 7 tests dans `tests/api/test_auth_rate_limit.py`. |
| `models/user.py` | `is_active`, `must_change_password`, `last_login` ; **aucune colonne de verrou**. |
| Journal | aucune ligne d'audit sur `login` ni sur `verify_otp` (`Vérifié` par recherche ; l'amendement D3 « connexion tracée » est à confirmer par B dans la même PR). |

### Contrat (`Proposé`)

1. **Compteur Redis, pas de migration** : `otp_fail:{user_id}` incrémenté à chaque OTP faux (`INCR` + `EXPIRE AUTH_LOCKOUT_SECONDS`), remis à zéro sur OTP juste. Au **3e échec** (`AUTH_OTP_MAX_FAILURES`, défaut 3) : clé `lock:{user_id}` avec TTL `AUTH_LOCKOUT_SECONDS` (défaut 900), suppression de `otp:`/`session:` du jeton courant.
2. **Réponses** : OTP faux n° 1 et 2 → 401 inchangé (`Invalid OTP`) ; 3e → **423 Locked**, Problem Details `error_code=ACCOUNT_LOCKED`, `detail="Compte verrouillé 15 min après 3 codes erronés"`, `retry_after` (secondes). `login` d'un compte verrouillé → 423 identique **sans** vérifier le mot de passe (pas d'oracle). `logout`/`refresh` inchangés. Déverrouillage : expiration du TTL seulement (déblocage par un administrateur = V1.1).
3. **Audit** : ligne `table_name="users"`, `record_id=user_id`, `action="account_locked"`, `new_data={"failures": 3, "lock_seconds": 900}` ; jamais l'OTP ni le mot de passe dans le journal ni dans les logs serveur. Si B ajoute l'audit de `login` (D3), même PR, `action="login"` / `"login_failed"` sans mot de passe.
4. **Config** : `AUTH_OTP_MAX_FAILURES=3`, `AUTH_LOCKOUT_SECONDS=900` dans `core/config.py` + `.env.example` + les deux compose (valeurs par défaut, pas d'assouplissement en e2e : la spec doit voir le verrou).
5. **Frontend** : `LoginPage` affiche le `detail` du 423 et désactive le bouton « Se connecter » pendant `retry_after` (compte à rebours simple) ; pas de nouvelle route.
6. **Interaction avec la limite IP** : inchangée ; le verrou (3) se déclenche avant la limite `5/minute` ; en e2e (`30/minute`) le verrou est le seul garde-fou visible.

### Cas de test

| Cas | Entrée | Attendu |
|---|---|---|
| pytest 3 échecs | login OK puis 3 `verify-otp` faux | 401, 401, **423** `ACCOUNT_LOCKED` avec `retry_after` ; `otp:`/`session:` supprimées |
| pytest login verrouillé | `login` du même compte pendant le verrou (bon mot de passe) | 423, aucun `otp:` créé ; autre compte du même tenant → 200 |
| pytest remise à zéro | 2 échecs puis OTP juste | 200, `otp_fail:` supprimée ; nouvelle session : 3 échecs nécessaires |
| pytest expiration | TTL de `lock:` forcé à 0 (fixture Redis) | `login` → 200 |
| pytest audit | après le verrou, `GET /audit/logs?action=account_locked` (admin) | 1 ligne, `new_data` sans OTP |
| e2e `auth.spec.ts` (E3 de SC-AUTH-02) | 3 OTP faux depuis l'UI | message « Compte verrouillé 15 min… », bouton désactivé |

Preuve : pytest Docker vert (5 cas) ; `docker compose exec api printenv AUTH_OTP_MAX_FAILURES` ; capture UI ; I met à jour SC-AUTH-02 E3 (« compte verrouillé, message explicite ») et retire l'écart 9/12 de `plan-presentation.md` à la fusion. Budget en temps de session : B ≈ 0,2 j, F ≈ 0,1 j, Q ≈ 0,05 j (rejeu e2e, variables dans les compose).

Sources : fichiers cités, lus le 10/11 sur `main` 950e66b ; `DEC-2026-002` amendements du 09/11 (D4, verrou OTP) et révision du 10/11 ; `criteres-acceptation.md` SC-AUTH-02, SC-AUD-02 ; `plan-presentation.md` § 3.
