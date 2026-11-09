# Équipe d'agents GED237 — principes de travail

> Statut : ACCEPTÉ par le PO (2026-11-09). Complète `REGLES_DE_TRAVAIL.md` (règles de
> livrable, niveaux de preuve, nommage) et `[Claude] RACI + Roadmap GED237.md` ; ne les remplace pas.
> Objectif : application terminée et **présentée le 2026-11-30**.

## 1. Principes (sourcés — détail dans `innovateur/sources/`)

1. **Au plus 4 sessions**, chacune avec un rôle, un périmètre de fichiers et un nom (`/rename`).
   Source : Anthropic, *Agent teams* — 3 à 5 équipiers, chacun propriétaire de fichiers distincts,
   sinon conflits d'écriture.
2. **Orchestrateur-travailleurs** : une session dirige, délègue, synthétise ; elle ne code pas.
   Source : Anthropic, *Building effective agents* (pattern orchestrator-workers ; simplicité d'abord).
3. **Une fonctionnalité par session de travail**, vérifiée de bout en bout avant d'être déclarée
   « passing ». Source : Anthropic, *Effective harnesses for long-running agents*.
4. **Contexte juste-à-temps** : les sessions lisent le strict nécessaire, les sous-agents renvoient
   un résumé condensé, l'état persiste dans des fichiers (PASSATION, walkthroughs, décisions).
   Source : Anthropic, *Effective context engineering*.
5. **Toute décision passe d'abord par l'Innovateur**, qui s'appuie sur sa base de connaissance
   (`gestion-projet/innovateur/`). Le PO humain arbitre quand le produit est impacté.
6. **RAIDER** et `REGLES_DE_TRAVAIL.md` restent la loi commune (walkthrough, niveaux de preuve,
   DoD, Docker-only, PR + CI Gate, aucune mention d'IA dans le dépôt).

## 2. Rôles et sessions

| Session (nom `/rename`) | Rôle | Fait | Ne fait pas | Fichiers possédés |
|---|---|---|---|---|
| `orchestrateur` | Manager (style Silicon Valley : objectifs, délais, communication) | Tient le plan au 30/11, assigne, relance, fusionne les comptes rendus, **seul interlocuteur du PO humain**, écrit PASSATION et le point quotidien | Ne code pas, ne décide pas seul d'un choix produit/technique | `gestion-projet/EQUIPE_AGENTS.md`, `gestion-projet/plans/`, `PASSATION.md` |
| `innovateur` | Réflexion intense, veille, décisions | Instruit chaque décision (options, sources, recommandation), tient `gestion-projet/innovateur/`, rédige `decisions/DEC-*` | Ne code pas, n'écrit pas dans `backend/`/`frontend/` | `gestion-projet/innovateur/`, `gestion-projet/decisions/` |
| `dev-backend` | Développeur FastAPI/PostgreSQL + tests | Lot C filtres serveur, migrations, tests pytest Docker | Ne touche pas `frontend/` | `backend/`, `.github/workflows/backend*.yml` |
| `dev-frontend` | Développeur React/TS + QA Playwright | Lot C recette UAT (37 scénarios), Lot D (code-splitting, guards), lint | Ne touche pas `backend/` | `frontend/`, `e2e/`, `.github/workflows/frontend*.yml` |

**Product Owner** : le PO humain reste décideur final (fusions, réglages GitHub, périmètre).
Un agent `product-owner` (`.claude/agents/product-owner.md`) formalise pour lui : critères
d'acceptation tirés du CDC et d'`AUDIT.md`, priorisation valeur/risque, verdict de recette. Il est
invoqué par l'orchestrateur, jamais à la place du PO humain.

Agents déjà présents, réutilisés (Reuse-first) : `architecte` (plan Opus), `verificateur` (tests/lint
en sortie courte), `Explore`. Skills existantes mobilisées : `mission`, `passation`, `raider-governance`,
`product-ownership`, `quality-engineering`, `architecture-decision-records`, `multi-agent-handoff`.

## 3. Protocole de décision

1. Une session identifie un choix (technique, produit, priorité) → elle **n'agit pas** ; elle envoie
   à `innovateur` : question, options vues, contrainte de délai.
2. `innovateur` répond en ≤ 1 page : options, preuves (niveau `Vérifié`/`Documenté`/`Déduit`),
   recommandation, réversibilité, coût en jours. Il crée `decisions/DEC-2026-NNN.md` (format
   `REGLES_DE_TRAVAIL.md`) au statut PROPOSÉ.
3. Impact produit ou irréversible (schéma, périmètre, dépendance majeure, fusion) → `orchestrateur`
   soumet au PO humain. Sinon l'orchestrateur tranche et passe la DEC à ACCEPTÉ.
4. Décision prise = une ligne dans le point quotidien + lien DEC. Toute dérogation RAIDER y est écrite.

Décisions déjà en attente du PO : B6 (`assignable-roles`, `users:update_own`, snapshot), fusion #26
(Node 24), sort de #27 (Node 26, à fermer si #26 fusionne), majors Dependabot #29/#30/#32.

## 4. Communication

- **Canal entre sessions** : messagerie inter-sessions Claude Code (`/list-agents`, `@nom`), texte
  seul ; un message = un fait, une décision ou un blocage, jamais un dump. Si indisponible dans une
  version : passer par `PASSATION.md` et les walkthroughs (fichiers = source de vérité).
- **Point quotidien** (orchestrateur → PO, ≤ 10 lignes) : fait / en cours / bloqué / décisions
  attendues / écart au plan. Fichier `gestion-projet/plans/point-AAAA-MM-JJ.md`, et message au PO.
- **Alerte délai** : un livrable qui glisse de > 1 jour est signalé le jour même avec une option de
  réduction de périmètre proposée par l'innovateur.
- **Routine de démarrage de chaque session** (source : harness long-running) : `git status` + `git log
  -n 5` → lire la dernière entrée de `PASSATION.md` → relire son walkthrough en cours → smoke (tests
  ciblés ou `tsc`) → travailler. Fin : walkthrough à jour, entrée PASSATION, message à l'orchestrateur.
- **Aucune écriture git dans le checkout partagé** (`GED237/`) : il reste sur `main`, lecture seule.
  Toute branche de travail vit dans un worktree `../GED237-<sujet>` (`git worktree add ../GED237-<sujet> -b
  <branche> origin/main`) ; commit, push et PR se font depuis ce worktree. Incident du 2026-11-09 :
  un `git switch` dans le checkout partagé a déplacé la branche de toutes les sessions (LESSON-2026-019).
- Le PO humain parle à l'orchestrateur ; il peut parler directement à l'innovateur pour une question
  de fond. Les devs ne sollicitent le PO que via l'orchestrateur.

## 5. Plan jusqu'au 30 novembre (21 jours)

| Semaine | Objectif | Livrables | Session |
|---|---|---|---|
| S1 10–16/11 | Clore la dette bloquante, démarrer Lot C | #26 fusionné ; #27 fermé ; Dependabot trié (patchs fusionnés, majors reportés en DEC) ; `GET /spaces/documents` filtres serveur (domaine, activité, année, statut, q) + tests ; CI verte | orchestrateur, dev-backend |
| S1 | Base de connaissance et script de démo | `innovateur/` complété (CDC, normes, concurrents) ; trame de présentation v0 | innovateur |
| S2 17–23/11 | Recette | Campagne Playwright sur les 37 scénarios UAT (pile Docker) ; corrections ; décisions B6 appliquées | dev-frontend, dev-backend |
| S2 | Lot D ciblé | Code-splitting des routes lourdes (bundle < 1 Mo), route guards ; plafond ESLint abaissé | dev-frontend |
| S3 24–28/11 | Gel + démo | Gel fonctionnel le 24/11 ; seules corrections de recette ; jeu de données de démo ; répétition générale le 27/11 ; release taguée (`release-integrity.yml`) | tous |
| 29–30/11 | Présentation | Support + démo ; `PASSATION.md` et `AUDIT.md` à jour | orchestrateur, PO |

Règle : pas de nouvelle fonctionnalité après le 24/11 sans DEC acceptée par le PO.

## 6. Mise en route

```text
Terminal 1 : claude --agent orchestrateur   puis /rename orchestrateur
Terminal 2 : claude --agent innovateur      puis /rename innovateur
Terminal 3 : claude                         puis /rename dev-backend
Terminal 4 : claude                         puis /rename dev-frontend
```

Définitions : `.claude/agents/orchestrateur.md`, `innovateur.md`, `product-owner.md` (sous-agent).
Vérifier la messagerie avec `/list-agents` ; sinon, mode fichiers (§4).

## 7. Checklist RAIDER (ce document)

- **Reusable** : rôles et protocole indépendants du lot en cours ; agents en `.claude/agents/`.
- **Agnostic** : rien ne suppose une version précise de l'outil ; repli fichiers si la messagerie manque.
- **Idempotent** : relire ce doc à chaque démarrage ne crée rien ; les DEC sont numérotées.
- **Durable** : `REGLES_DE_TRAVAIL.md` et le RACI restent valides ; ce document s'y ajoute.
- **Failure memory** : `DOCS/engineering/lessons-learned.md` (18 leçons) consulté avant chaque lot.
- **Engineering-grade** : moindre privilège (chaque session possède ses fichiers), décisions tracées.
- **Reuse-first** : agents/skills existants réutilisés ; dépôts externes évalués dans
  `innovateur/sources/github-agents-skills.md` (Learn, pas Adopt).
- **Retroactive** : aucun doc existant réécrit ; PASSATION en ajout seulement.
