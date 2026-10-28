# [Claude] Audit technique GED237 — 22/07/2026

> **Auteur** : Claude (audit assisté)
> **Date** : 2026-07-22
> **Méthode** : audit du **code réel**, pas des .md. Chaque constat est vérifié par commande :
> byte-compile Python (`compileall`), typecheck (`tsc --noEmit`), build (`vite build`),
> parse du DAG Alembic, analyse `git`, lecture ciblée du code (`spaces.py`, `router.py`, `conftest.py`).
> **Portée** : dépôt complet (`backend`, `frontend`, migrations, CI, état git).

---

## Verdict en une phrase

Le code est **techniquement sain** (compile / typecheck / build / migrations OK), mais le projet est **opérationnellement fragile** : la majorité du travail récent n'est **ni commitée ni sauvegardée**, et l'environnement de test backend est **cassé** (venv étranger commité).

---

## 1. Tableau de santé (vérifié par commande)

| Contrôle | Résultat | Preuve |
|---|---|---|
| Byte-compile backend (121 fichiers `.py`) | ✅ 0 erreur | `py -3 -m compileall app` → exit 0 |
| Byte-compile migrations (26) | ✅ 0 erreur | `compileall alembic/versions` → exit 0 |
| DAG Alembic | ✅ **Sain** : 1 racine (`001`), **1 seul head** (`d4e5f6a7b8c9`), 0 parent manquant, 0 branche | parse des 26 révisions |
| Câblage router (19 modules endpoints) | ✅ Tous inclus, **0 orphelin** | lecture `app/api/v1/router.py` |
| Typecheck frontend | ✅ **Clean** | `npm run typecheck` (`tsc --noEmit`) → exit 0 |
| Build frontend | ✅ **OK** en 28,5 s | `npm run build` (`vite build`) → exit 0 |
| Volume de code | ~18,6k LOC backend · ~37k LOC frontend · 7 profils | `wc -l` |

**Conclusion partielle** : sur le plan strictement technique, le socle est propre. Rien ne casse à la compilation.

---

## 2. Ce qui est confirmé solide

- **Backend** : **122 routes** sur 19 modules, 23 modèles, moteur de classification multi-filtres (JSONB), moteur de règles IFTTT, imports batch, workflow, autorisation Casbin, OCR, reports. Multi-tenant (`tenant_id`) + JWT/2FA en place.
- **Migrations** : chaîne **linéaire propre**. Les 4 nouvelles migrations (local events, snapshots d'arrangement, multi-filtres, exclusions d'origine) se greffent correctement sur le head existant.
- **DevSecOps** : 6 workflows CI (`backend.yml`, `frontend.yml`, `ci.yml`, `quality-gate.yml`, `release-integrity.yml`, `security.yml`) + gitleaks + pre-commit.
- **Tests écrits** : **119 fonctions pytest** (13 fichiers `tests/api/`) + **127 blocs Playwright** (25 specs e2e).

---

## 3. Findings réels que les .md ne capturent PAS

### 🔴 F1 — CRITIQUE : ~11 800 lignes hors de tout contrôle de version

- Dernier commit : **2026-05-03**. Historique total : **4 commits seulement**.
- État actuel du working tree : **38 fichiers modifiés (+6038 / −2074)** + **34 fichiers non suivis = 11 833 LOC non versionnées**.
- **Des modules entiers n'existent QUE dans le working tree** (aucune trace en git) :
  - Rapports : `reports.py`, `reports_service.py`, `schemas/reports.py` + front `pages/reports/*` (~1 400 LOC backend + front)
  - Usage : `usage.py`, `schemas/usage.py`, `usage.api.ts`
  - LocalLibrary : `LocalLibraryPage.tsx` (715 LOC), `localLibrary.ts`
  - LocalOrganizer : `services/localOrganizer/*` (~1 100 LOC)
  - Refonte Users : `pages/users/AgentsListTab.tsx` (1 073 LOC), `UsersPage.tsx`
  - Refonte classification : `components/classification/*`
- **`origin/main` == `HEAD` (0 en avance / 0 en retard)** → le remote GitHub (`github.com/EagleFox31/GED237`) est figé aux **4 mêmes commits**. **Rien de ce travail récent n'est sauvegardé sur le remote.**
- **Risque concret** : un `git clean -fdx`, un `git checkout` malheureux ou une panne disque efface plusieurs semaines de travail. (Ironie : `AUDIT.md` lui-même est non commité.)

### 🔴 F2 — CRITIQUE : environnement backend cassé (cause racine du « pytest non concluant »)

- Le dossier `venv/` **commité** appartient à un **autre poste/utilisateur** :
  `pyvenv.cfg` → `home = C:\Users\XEPTION NETWORK\...\Python312`, `command = ... E:\GED237\backend\venv`.
  → `venv/Scripts/python.exe` échoue immédiatement : `No Python at '...XEPTION NETWORK...'`.
- Résidu supplémentaire : un `.venv/` Linux/posix (pip3.10) traîne aussi dans `backend/`.
- **Conséquence directe** : les **119 tests pytest sont in-exécutables en l'état**.
  `AUDIT.md` mentionne « tentative locale non concluante » sans en donner la cause : la vraie cause est un **venv étranger commité** (anti-pattern — un venv ne doit jamais être versionné).

### 🟠 F3 — MOYEN : trous de couverture tests au-delà des rapports

`AUDIT.md` ne signale que `test_reports.py` manquant. En réalité, **aucun test API** n'existe pour :
`reports`, `usage`, `org_units`, `notifications`, `categories`, `classification`
(seuls `classification_admin` et `classification_reviews` sont couverts).

---

## 4. Findings d'AUDIT.md re-vérifiés (exacts)

| Affirmation AUDIT.md | Vérification indépendante |
|---|---|
| `spaces/documents` n'expose que `org_unit_id` + `recursive` | ✅ **Confirmé** — `spaces.py:29-41` : `list_space_documents` ne proxifie que ces 2 params vers `list_workspace_documents`. Tout le filtrage métier (domaine/activité/année/statut) reste **après chargement** côté front. |
| `/index.css` référencé mais absent au build | ✅ **Confirmé** — `frontend/index.html:79` + warning build `"/index.css doesn't exist at build time"` |
| Chunk principal > 500 kB | ✅ **Confirmé** dans le log build |
| `test_reports.py` absent | ✅ **Confirmé** |
| 26 fichiers de migration | ✅ **Confirmé** |

> Écart mineur : `AUDIT.md` compte **117 routes**, l'audit en compte **122** (dérive due à `reports` + `usage` ajoutés depuis la rédaction).

---

## 5. Recommandations priorisées

1. **Immédiat (aujourd'hui)** — sécuriser le travail :
   `git add -A && git commit && git push`.
   C'est le risque n°1. Idéalement découpé en commits thématiques (reports / usage / local-library / classification-refactor), mais **un commit-filet de sécurité d'abord**.

2. **Débloquer les tests** :
   - Retirer `venv/` **et** `.venv/` du dépôt + les ajouter au `.gitignore`.
   - Recréer un venv propre : `py -3 -m venv venv` puis `pip install -r requirements.txt`.
   - Rejouer `pytest` avec `TEST_DATABASE_URL` + `TEST_REDIS_URL` (cf. `tests/conftest.py`).
   - Sans cela, la reco n°1 d'`AUDIT.md` (« rejouer pytest ») est **irréalisable**.

3. **Appliquer les 4 migrations** non commitées sur `edossier` **et** `test_ged` :
   `alembic upgrade head` (cf. leçon interne « UndefinedTableError » masqué en erreur réseau).

4. **Décider sur `spaces/documents`** : enrichir le contrat serveur
   (`domain_id / activity_id / year / status / q` + pagination) **OU** réduire explicitement la promesse
   du plan V1. Le filtrage post-chargement ne tiendra pas sur gros corpus.

5. **Finitions** : retirer/corriger la référence `/index.css` ; planifier le code-splitting du bundle ;
   ajouter `test_reports.py` + tests pour `usage` / `org_units` / `notifications`.

---

## Annexe — commandes de vérification exécutées

```bash
# Compilation & structure
py -3 -m compileall app                      # exit 0
py -3 -m compileall alembic/versions         # exit 0
# DAG Alembic : 1 racine (001), 1 head (d4e5f6a7b8c9), 0 branche, 0 parent manquant

# Frontend
npm run typecheck                            # tsc --noEmit → exit 0
npm run build                                # vite build → exit 0 en 28,5 s (warnings index.css + chunk >500kB)

# Git
git log --oneline                            # 4 commits, dernier 2026-05-03
git status -s                                # 38 modifiés + 34 non suivis
git ls-files --others --exclude-standard | grep -E '\.(ts|tsx|py)$' | xargs wc -l   # 11 833 LOC
git rev-list --left-right --count origin/main...HEAD   # 0  0 (remote figé)

# Environnement
cat backend/venv/pyvenv.cfg                  # home = C:\Users\XEPTION NETWORK\... (poste étranger)
```
