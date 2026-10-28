# [Claude] Exposition AGENTS.md racine — 2026-07-22

> Statut : DONE
> Agent : Claude (Tech Lead / QA)
> Date : 2026-07-22
> Type de tâche : gouvernance (règle agents)

## Ce qui va être fait

Créer un `AGENTS.md` **à la racine** du dépôt pour l'auto-découverte par les
runners d'agents, sans dédoubler la source de vérité : il pointe vers
`.agents/AGENTS.md` (canonique) et embarque le résumé du protocole.

## Pourquoi

Beaucoup de runners lisent un `AGENTS.md` racine ; `.agents/AGENTS.md` (choisi par
Cursor) n'est pas auto-découvert à cet emplacement. Objectif : que tout agent
tombe sur la règle dès la racine. Demande explicite du PO : « oui expose ».

## Comment

- `.agents/AGENTS.md` **reste canonique** (référencé par `REGLES_DE_TRAVAIL`,
  plans, walkthroughs) — pas de déplacement, pas de réécriture.
- Racine `AGENTS.md` = fichier d'exposition : bannière « canonique = .agents/AGENTS.md,
  garder synchro » + protocole essentiel inline (auto-suffisant pour un runner) +
  renvoi vers la version complète.

## Résultat attendu

Un agent qui démarre depuis la racine trouve la règle et le pointeur vers la
version canonique.

## Fichiers / zones concernés (VERROU)

- `AGENTS.md` (racine) — **création, verrou posé par Claude**
- `gestion-projet/walkthrough/[Claude] Exposition AGENTS.md racine - 2026-07-22.md` (ce fichier)
- (lecture seule : `.agents/AGENTS.md` — non modifié)

## Vérifications prévues

- `diff` de contenu entre le protocole racine et `.agents/AGENTS.md` (cohérence) ;
- confirmer que `.agents/AGENTS.md` est inchangé (`wc -l` = 76).

---

## RÉSULTAT (DONE)

### Ce qui a été trouvé

- Aucun `AGENTS.md` à la racine ; canonique = `.agents/AGENTS.md` (non auto-découvert).
- Aucun verrou `EN COURS` concurrent au démarrage.

### Ce qui a été modifié, fichier par fichier

- `AGENTS.md` (racine) : **créé** (53 lignes) — exposition pour auto-découverte,
  bannière « canonique = `.agents/AGENTS.md`, garder synchro », rôles + protocole
  walkthrough + coordination/verrou inline, renvoi vers la version complète.
- `.agents/AGENTS.md` : **inchangé** (76 lignes) — source de vérité préservée.

### Comment

Écriture d'un fichier racine autonome mais non canonique (pointeur explicite),
pour éviter une seconde source divergente. Protocole respecté : verrou déclaré
avant création.

### Résultat observable maintenant

Un runner qui lit la racine trouve la règle (walkthrough + verrou) et le pointeur
vers `.agents/AGENTS.md`.

### Tests / commandes exécutés

- `wc -l .agents/AGENTS.md` → **76** (inchangé, canonique préservée).
- `ls -la AGENTS.md` → présent, 2515 o, 53 lignes.
- statuts dans les 2 fichiers → identiques : `EN COURS DONE BLOQUÉ ABANDONNÉ`.
- `git status -s` → `?? AGENTS.md` et `?? .agents/` (voir limite).

### Limites / suite

- **Divergence possible** : root et canonique doivent être mis à jour ensemble.
  Alternative plus propre si le PO préfère une source unique : faire de la racine
  la source et `.agents/AGENTS.md` un simple pointeur — non fait pour ne pas
  casser les références existantes vers `.agents/AGENTS.md`.
- **Non versionné** : `AGENTS.md` **et** `.agents/` restent non suivis par git ;
  ni commit ni push effectués (règle : demande explicite requise). Décision PO
  (Lot 0 / T02) : suivre ces fichiers pour partage via le remote.
