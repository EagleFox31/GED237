# Triage Dependabot PR #35 — groupe npm `frontend`, 2 mises à jour

- **Instruction** : innovateur, 2026-11-09 19:25, règles de `../decisions/DEC-2026-001` (patch/mineur → fusion si CI verte ; major → report après le 30/11).
- **État PR** (`Vérifié`, `gh pr view 35` à 19:20) : OPEN, `MERGEABLE`, dernière mise à jour 16:37 UTC. Checks : Change impact ✓, Tracked files ✓, Frontend Lint & Typecheck ✓, Frontend Build ✓, SCA Dependency Audit ✓, Gitleaks ✓, Trivy ✓, **CI Gate ✓** ; Backend / Bandit / actionlint ignorés (surface non touchée, règle change-scoped).

| Paquet | Versions | Type | Usage GED237 | Notes de version (PR, `Documenté`) | Verdict |
|---|---|---|---|---|---|
| `zustand` | 5.0.16 → 5.1.0 | mineur | stores applicatifs (`^5.0.16` dans `frontend/package.json`) | `persist` accepte des résultats `PromiseLike`, `persist.rehydrate()` renvoie une `Promise<void>` ; `devtools` : option `actionCreators`. Additif, aucune rupture. | **Fusionner** |
| `@playwright/test` | 1.64.1 → 1.65.0 | mineur | e2e (`playwright.config.ts`, scripts `test:e2e*`) ; dev-dependency, hors bundle | Exécution sous Bun (opt-in `--bun`), reporter `failures`, option `onlyFailures` des reporters HTML/JSON/JUnit. Aucune rupture d'API. | **Fusionner** |

## Décision

**Fusionner #35 telle quelle** (0 j-p ; CI Gate verte, deux mineurs sans rupture).

Points d'attention, sans effet sur la décision :

1. **Navigateurs Playwright** : une montée de `@playwright/test` exige des binaires de navigateur de la même version. Le dépôt n'épingle aucune image `mcr.microsoft.com/playwright` (ni dans `.github/`, ni dans un Dockerfile ou compose : `Vérifié`), donc rien à aligner ici. Si la pile e2e de ci-qa (branches `ci/e2e-smoke` / `ci/e2e-seed`, **non poussées sur le remote à 19:20**) introduit une image ou un `npx playwright install` épinglé, elle devra viser **1.65** après fusion ; à signaler à ci-qa pour éviter un rebase surpris.
2. **Option utile pour la recette** : `onlyFailures` sur le reporter HTML réduit la taille des rapports du run du 21/11 (captures de secours du plan de présentation) ; à activer à la discrétion de ci-qa, pas dans cette PR.
3. Ordre de fusion recommandé : après #37/#38 déjà fusionnées, rien ne bloque ; fusionner avant la branche e2e pour que ci-qa rebase une seule fois.

RAIDER : I (fusion idempotente, Dependabot ne rouvre pas), D (build + lint + audit verts, aucun test e2e en CI aujourd'hui donc #35 ne peut rien casser de prouvé), E (SCA vert, versions épinglées par le lockfile).
