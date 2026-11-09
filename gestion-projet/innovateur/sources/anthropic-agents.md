# Sources primaires — équipes d'agents, harness, contexte

Consultées le 2026-11-09. Niveau : `Documenté`.

## Agent teams (Claude Code) — https://code.claude.com/docs/en/agent-teams.md
- Expérimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) : un lead + équipiers avec leur propre
  contexte, liste de tâches partagée, boîte aux lettres, hooks `TeammateIdle` / `TaskCreated` /
  `TaskCompleted`.
- Recommandé : 3 à 5 équipiers, **chacun propriétaire de fichiers distincts** ; coût en tokens élevé.
- Les définitions `.claude/agents/*.md` servent aussi d'équipiers.
- Alternatives plus légères : messagerie inter-sessions, worktrees.
- **Retenu pour GED237** : sessions séparées + messagerie (pas d'expérimental sur un projet étatique
  à 3 semaines de la livraison), 4 sessions max, propriété de fichiers par session.

## Messagerie inter-sessions — https://code.claude.com/docs/en/cross-session-messaging.md
- Requiert Claude Code ≥ 2.1.234 sur Windows natif ; `/list-agents` pour vérifier ; `/rename` ou
  `--name` pour nommer une session ; mention `@nom` dans un prompt.
- Texte seul, ~1 M caractères max, rafales refusées ; un message ne peut ni approuver une permission
  ni changer une configuration ; les commandes `/x` arrivent comme texte.
- Réglage `crossSessionInbound` (`accept`/`hold`/`refuse`) ; une session WSL et une session Windows
  native ne se voient pas.
- **Retenu** : canal de coordination ; repli = fichiers (PASSATION, walkthroughs).

## Sous-agents — https://code.claude.com/docs/en/sub-agents.md
- Frontmatter : `name`, `description` (obligatoires), `tools`, `disallowedTools`, `model`, `effort`,
  `permissionMode`, `skills` (préchargées), `memory` (`user`/`project`/`local`), `maxTurns`,
  `isolation: worktree`, `initialPrompt`, `omitClaudeMd`.
- `claude --agent <nom>` fait tourner toute la session avec ce rôle ; le prompt remplace le prompt
  système par défaut, `CLAUDE.md` reste chargé.
- `memory: project` → `.claude/agent-memory/<nom>/` versionné ; 200 lignes de `MEMORY.md` injectées.
- **Retenu** : `orchestrateur` et `innovateur` lancés avec `--agent` ; `product-owner` en sous-agent.

## Building effective agents — https://www.anthropic.com/engineering/building-effective-agents
- Commencer simple ; n'ajouter de l'agentique que si ça améliore mesurablement.
- Patterns : prompt chaining, routing, parallelization, **orchestrator-workers**, evaluator-optimizer.
- Transparence : montrer le plan ; outils documentés comme pour un humain.
- **Retenu** : orchestrateur-travailleurs pour la coordination, évaluateur-optimiseur pour la recette
  (dev-frontend produit, `verificateur`/PO évalue).

## Effective harnesses for long-running agents — https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Séparer initialisation et travail ; liste de fonctionnalités en JSON dont seul le statut change ;
  fichier de progression ; `init.sh` ; **une fonctionnalité par session** ; auto-vérification de bout en
  bout avant « passing » ; routine de démarrage fixe (cwd → git log + progression → choisir → init +
  smoke → travailler).
- **Retenu** : routine de démarrage §4 d'`EQUIPE_AGENTS.md` ; `AUDIT.md` + walkthroughs jouent le rôle
  de liste de fonctionnalités et de progression.

## Effective context engineering — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Contexte juste-à-temps, compaction, notes structurées persistantes, sous-agents qui renvoient un
  résumé condensé.
- **Retenu** : économie de tokens du `CLAUDE.md` global, `passation` + `/clear` entre deux sujets.

## Secondaires (à recouper avant usage)
- tembo.io, morphllm.com, getpushtoprod (Substack) : retours d'expérience sur les équipes d'agents ;
  niveau `Déduit`, non repris dans les règles.
