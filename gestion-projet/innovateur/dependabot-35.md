# PR #35 Dependabot — groupe npm `/frontend` (zustand 5.0.16 → 5.1.0, @playwright/test 1.64.1 → 1.65.0)

Pour : orchestrateur (décision de fusion), ci-qa (image Playwright), dev-frontend. Fiche courte de l'innovateur, 2026-11-09 soir ; même logique que `DEC-2026-001` (pas de DEC : aucune majeure runtime). Niveaux : `Vérifié` = lu dans `gh pr view/diff 35`, `gh pr checks 35`, `gh api /advisories`, `main` a4b8dbe et `../GED237-e2e/docker-compose.e2e.yml` ; `Déduit` = raisonnement sans exécution.

## 1. Contenu (`Vérifié`)

| Paquet | De → vers | Type | Surface GED237 | Fichiers |
|---|---|---|---|---|
| `zustand` | 5.0.16 → 5.1.0 | **mineure**, runtime navigateur | 2 stores, `create` seul : `frontend/stores/authStore.ts:1`, `frontend/lib/errors/errorBus.ts:15` ; aucun `persist` ni `devtools` (les deux middlewares que la 5.1.0 modifie) | `frontend/package.json:27`, `package-lock.json` |
| `@playwright/test` | 1.64.1 → 1.65.0 | **mineure**, dev-only (e2e) | 7 specs UAT + smoke ; runner Bun, reporter `failures`, Chromium r1254 | `frontend/package.json:30`, `package-lock.json` (`playwright`, `playwright-core` suivent en 1.65.0) |

PR ouverte le 09/11 16:37, `MERGEABLE`, CI verte : Build, Lint & Typecheck, Trivy, Dependency Audit, Gitleaks (Backend et Bandit `skipping` : surface frontend seule, comportement attendu de l'Impact-Aware CI).

## 2. Avis de sécurité (`Vérifié`)

`gh api /advisories?affects=zustand@5.0.16`, `…affects=@playwright/test@1.64.1`, `…affects=playwright@1.64.1` : **aucun GHSA** sur les versions actuelles. PR de **mise à jour de version**, pas de correctif de sécurité ; Dependabot ne la classe pas `security`. Gain sécurité : nul.

## 3. Risque de rupture

| Risque | Niveau | Détail |
|---|---|---|
| zustand 5.1.0 | faible (`Vérifié` par lecture du changelog et des deux imports) | changements limités à `persist` et `devtools`, non utilisés ; `create` inchangé |
| @playwright/test 1.65.0 **vs image e2e** | **élevé** (`Vérifié` sur la ligne, `Déduit` sur l'effet) | `../GED237-e2e/docker-compose.e2e.yml:99-100` : `# Keep the tag in step with @playwright/test in frontend/package-lock.json` → `image: mcr.microsoft.com/playwright:v1.64.1-noble`. Le conteneur fait `npm ci` puis `npx playwright test` (l.120-121) : avec le lock en 1.65.0, le runner cherche la révision Chromium r1254 absente de l'image 1.64.1 → « Executable doesn't exist », **toute la campagne e2e rouge** (smoke, UAT, P8 jeu 12). Dependabot ne peut pas éditer le compose : la correction est un commit ci-qa (`v1.65.0-noble`) dans `ci/e2e-smoke` (#39) ou une PR dédiée |
| Changement de comportement des specs | faible | Bun est opt-in (`--bun`) ; reporters existants inchangés ; aucune API dépréciée citée dans les notes 1.65 pour `test`, `expect`, `locator` |
| Majeure | aucune | les deux bumps sont mineurs |

## 4. Preuve minimale avant fusion (si fusion)

1. ci-qa : image `mcr.microsoft.com/playwright:v1.65.0-noble` dans `docker-compose.e2e.yml`, **fusionnée avant ou avec** #35 ; `docker compose -f docker-compose.e2e.yml up --build --exit-code-from e2e` sur le projet `smoke` vert (≈ 1,1 min de run, image à retélécharger ≈ 2 Go).
2. Build + lint déjà verts en CI (suffisant pour zustand : aucun code touché, `create` seul).
3. Pas de SMK complet nécessaire au-delà du smoke : zéro changement runtime observable.

Coût : 0,1 j Q (image + run) + 0 j F.

## 5. Recommandation : **reporter après le 30/11** (V1.1), laisser la PR ouverte

- Gain nul (aucun avis de sécurité, aucune fonctionnalité attendue), risque réel sur la seule chose qui compte cette semaine : la campagne e2e (P8 jeu 12, 8 parcours ven 13, rejeu mar 17). Une fusion « après #39 » casserait l'image que #39 vient d'épingler.
- Marge budget 0,05 j-p (`point-2026-11-14.md` § 4) : 0,1 j Q pour un no-op fonctionnel n'est pas défendable avant le gel.
- Laisser #35 **ouverte** : Dependabot la rebase seul ; après le 30/11, fusion avec le bump d'image dans la même journée (règle à inscrire : « bump `@playwright/test` ⇒ bump du tag `mcr.microsoft.com/playwright` », candidat check CI docs/compose V1.1, `DOCS/engineering/README.md`).
- Si le PO tient à fusionner avant le gel : seulement après la campagne du 13 et avec le point 4.1 fait le même jour par ci-qa ; jamais entre #39 et jeu 12.

Sources : `gh pr view 35`, `gh pr diff 35`, `gh pr checks 35`, `gh api /advisories` (09/11 soir) ; `frontend/package.json` ; `frontend/stores/authStore.ts` ; `frontend/lib/errors/errorBus.ts` ; `../GED237-e2e/docker-compose.e2e.yml` (lecture seule) ; `DEC-2026-001` ; `point-2026-11-14.md` § 4.

## Mise à jour du 2026-11-09 (nuit)

#35 fermée par Dependabot et remplacée par **#56** (groupe npm : zustand 5.0.16 → 5.1.0, @playwright/test 1.64.1 → 1.65.0, @axe-core/playwright 4.11.3 → 4.14.0 ; CI : 1 job rouge, 8 verts, 3 ignorés). Même décision : report après le 30/11, pour la même raison (image Playwright épinglée `v1.64.1-noble` dans le compose e2e, à monter en même temps que le paquet). Aucun avis GHSA sur les trois paquets.
