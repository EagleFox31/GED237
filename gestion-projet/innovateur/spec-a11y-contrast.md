# Spec — contraste de couleurs (axe `color-contrast`, SC-A11Y-01/02) pour dev-frontend

Pour : dev-frontend, PR `fix/recette-smoke-2` (mer 11/11, ≈ 0,2 j avec SMK-10). Instruction innovateur du 2026-11-09 soir ; pas de code ici.
Source (`Vérifié`, lecture seule) : run combiné ci-qa du 09/11 20:17–20:25, `../GED237-e2e/frontend/e2e-out/playwright-report` ; détail axe lu dans les pièces jointes `axe-login.json` et `axe-dashboard.json` embarquées dans les traces (`trace.zip` → `attachments/`), pas dans les `.md` du rapport qui ne donnent que le compte. Règle axe : 4,5:1 pour tout texte < 18 pt (ou < 14 pt gras) ; tous les textes ci-dessous sont en 9–12 px, donc 4,5:1 s'applique même en gras.

## 1. Violations mesurées (une ligne par nœud axe)

| # | Page | Texte visible / sélecteur axe | Texte → fond actuels | Ratio mesuré / requis | Composant (`Déduit`, grep `frontend/`) | Token cible proposé | Ratio après (calculé WCAG) |
|---|---|---|---|---|---|---|---|
| 1 | login (`Vérifié`) | « Espace Démo Interactif », `.tracking-[0.3em].text-slate-400` (10 px, gras, italique) | `#94a3b8` → `#ffffff` | **2,56** / 4,5 | `components/widgets/DemoProfiles.tsx:27` | `text-slate-400` → **`text-slate-500`** | 4,76 |
| 2 | dashboard admin (`Vérifié`) | « Cameroun GED », `.mt-0.5` (9 px, gras ; `GED` en `text-cam-red` non signalé) | `#94a3b8` → `#fdfefe` | **2,53** / 4,5 | `components/Logo.tsx:14` (logo réutilisé partout) | `text-slate-400` → **`text-slate-500`** | 4,71 |
| 3 | dashboard admin (`Vérifié`) | « Complétés », `.text-green-500` (12 px, gras, carte verte `bg-green-50`) | `#22c55e` → `#f0fdf4` | **2,17** / 4,5 | `profiles/tenant-admin/pages/OrgDashboard.tsx:184` | `text-green-500` → **`text-green-700`** | 4,79 |
| 4 | dashboard admin (`Vérifié`) | « En Attente », `.text-blue-500` (12 px, gras, carte `bg-blue-50`) | `#3b82f6` → `#eff6ff` | **3,37** / 4,5 | `OrgDashboard.tsx:188` | `text-blue-500` → **`text-blue-700`** | 6,16 (`blue-600` = 4,75, juste au seuil) |
| 5 | dashboard admin (`Vérifié`) | « Rejetés », `.text-red-500` (12 px, gras, carte `bg-red-50`) | `#ef4444` → `#fef2f2` | **3,44** / 4,5 | `OrgDashboard.tsx:192` | `text-red-500` → **`text-red-700`** | 5,91 (`red-600` = 4,41 insuffisant) |
| 6 | dashboard admin (`Déduit`) | un run sur trois a compté **5** violations ; la 5ᵉ n'a pas de trace retenue. Candidat : « Gestion Documentaire » (8 px, `text-red-500` sur blanc, 3,76) | `#ef4444` → `#ffffff` | 3,76 / 4,5 (calculé) | `components/Header.tsx:191` | `text-red-500` → **`text-red-700`** | 6,47 |

Mêmes classes ailleurs, à corriger dans le même jeu (`Déduit`, grep) : `components/Dashboard.tsx:90/94/98` (« Validés / En Attente / Rejetés », mêmes couleurs → mêmes tokens) ; `profiles/super-admin/pages/PlatformDashboard.tsx:82` (`text-blue-500` 14 px → `text-blue-700`) ; `profiles/tenant-admin/pages/gedrules/CategoriesTab.tsx:181` (`text-slate-400` 10 px → `text-slate-500`).

## 2. Un seul jeu de remplacements (cohérent avec la palette existante)

| Avant | Après | Pourquoi |
|---|---|---|
| `text-slate-400` sur texte ≤ 12 px (libellés, sous-titres) | `text-slate-500` | déjà le gris le plus utilisé du front (46 occurrences) ; 4,7:1 sur blanc. Ne pas toucher `text-slate-400` sur les icônes décoratives (hors règle). |
| `text-green-500` / `text-blue-500` / `text-red-500` sur texte ≤ 14 px | `text-green-700` / `text-blue-700` / `text-red-700` | `-600` passe pour le bleu (4,75) mais pas pour le vert (3,15) ni le rouge (4,41) sur leurs fonds `-50` ; `-700` partout = une seule règle, nuances déjà présentes dans le code (`text-red-700`, `text-emerald-700`). |
| `text-cam-red` (`#CE1126`, `index.html:60`) | inchangé | non signalé par axe ; palette institutionnelle, ne pas dériver. |

Hors périmètre : fonds et bordures des cartes, mode sombre (absent), tailles de police (ne pas « grossir » le texte pour passer en grand texte : ça casse les en-têtes compacts).

## 3. Preuve attendue dans la PR

1. `a11y.spec.ts` SC-A11Y-01 et SC-A11Y-02 verts en Docker (0 violation `serious`/`critical`), rapport joint ; si axe signale un nouveau nœud après remplacement, l'ajouter ici plutôt que l'exclure.
2. Capture login + dashboard admin avant/après (lisibilité conservée, aucun libellé agrandi).
3. `grep -rn "text-\(green\|blue\|red\)-500" frontend/components frontend/profiles` ne renvoie plus de texte ≤ 14 px (icônes et pastilles tolérées).

Sources : pièces jointes axe du run ci-qa (SHA `be56b8d0…` login, `12bd87ba…` dashboard) ; ratios « après » calculés avec la formule WCAG 2.x (luminance relative) sur les hex Tailwind v3 ; `frontend/index.html:60` (palette `cam-*`).
