# Dépôts GitHub — agents, skills, outils (évaluation Reuse-first)

Relevé `gh api repos/<owner>/<repo>` le 2026-11-09 (étoiles, dernier push). Niveau : `Vérifié` pour les
chiffres, `Déduit` pour l'évaluation (README non lus en détail ; à faire avant tout Adopt).

| Dépôt | ★ | Push | Nature | Décision | Pourquoi |
|---|---|---|---|---|---|
| anthropics/skills | 190 k | 2026-11-06 | Skills officielles (SKILL.md) | **Adopt** | Référence du format ; déjà présent via les skills `anthropic-skills:*` |
| anthropics/claude-plugins-official | 47 k | 2026-11-08 | Annuaire officiel de plugins | **Learn** | Source sûre si un plugin manque (ex. playwright) |
| anthropics/claude-code | 155 k | 2026-11-06 | Outil + exemples hooks | **Learn** | Exemples de hooks et de `.claude/` |
| obra/superpowers | 315 k | 2026-11-03 | Framework de skills + méthodologie (TDD, brainstorm, planning) | **Learn** | Idées pour `mission` ; ne pas importer en bloc, nos skills couvrent déjà le flux |
| affaan-m/ECC (everything-claude-code) | 300 k | 2026-11-09 | Harness : skills, mémoire, sécurité | **Learn** | Mémoire d'agent ; comparer à notre dossier `innovateur/` |
| github/spec-kit | 149 k | 2026-11-09 | Spec-Driven Development (spec → plan → tâches) | **Adapt** | Format de spec pour les lots C/D si besoin ; nos walkthroughs restent le livrable |
| ruvnet/ruflo (claude-flow) | 81 k | 2026-11-09 | Essaims multi-agents | **Écarté** | Trop lourd et opaque pour 3 semaines ; contredit « simplicité d'abord » |
| hesreallyhim/awesome-claude-code | 58 k | 2026-11-09 | Liste curée | **Learn** | Point d'entrée pour chercher un outil précis |
| bmad-code-org/BMAD-METHOD | 55 k | 2026-11-08 | Rôles agiles (PM, PO, architecte, dev, QA) en agents | **Adapt** | Fiches de rôle PO/architecte à comparer à `.claude/agents/product-owner.md` |
| wshobson/agents | 42 k | 2026-11-09 | Agents/skills/commandes multi-outils | **Learn** | Exemples de sous-agents backend/frontend/QA |
| gastownhall/beads | 29 k | 2026-11-09 | Suivi de tâches pour agents (graphe, mémoire) | **Écarté** | GitHub Issues/Project + `AUDIT.md` suffisent ; une brique de plus à maintenir |
| VoltAgent/awesome-claude-code-subagents | 26 k | 2026-11-02 | 100+ sous-agents | **Learn** | Modèles de prompts QA/sécurité |
| disler/claude-code-hooks-mastery | 4 k | 2026-03-04 | Hooks | **Learn** | Hooks `Stop`/`PostToolUse` pour garde-fous ; peu actif |
| gensecaihq/Claude-Code-Subagents-Collection | 32 | 2026-10-30 | 75 sous-agents | **Écarté** | Trop peu de traction |

Maison (déjà adopté) : `EagleFox31/appfactory-project-automation` (CI impact-aware, gouvernance,
releases), `EagleFox31/project-registry` (RAIDER, leçons). Skills locales : `mission`, `passation`,
`raider-governance`, `product-ownership`, `quality-engineering`, `multi-agent-handoff`, etc.

## Conclusion (DEC à ouvrir si contestée)

Aucun framework d'orchestration externe n'est adopté : le flux repose sur les sessions Claude Code,
les agents `.claude/agents/`, les skills locales et les fichiers du dépôt. Deux emprunts ciblés :
format de spec (spec-kit) si un lot l'exige, fiches de rôle (BMAD) pour affiner le PO agent.
À relire avant adoption d'un dépôt : licence, activité, dépendances, absence de secret/exfiltration dans
les hooks.
