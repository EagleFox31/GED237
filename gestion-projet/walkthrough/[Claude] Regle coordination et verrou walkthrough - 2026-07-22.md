# [Claude] Règle de coordination et verrou walkthrough — 2026-07-22

> Statut : DONE
> Agent : Claude (Tech Lead / QA)
> Date : 2026-07-22
> Type de tâche : gouvernance (règle agents)

## Ce qui va être fait

Compléter la règle existante `.agents/AGENTS.md` avec une clause de **coordination
et de verrou logique** : un agent doit lire les fichiers `EN COURS` des autres
avant de démarrer, déclarer les fichiers qu'il va modifier, et ne pas toucher un
fichier déjà déclaré `EN COURS` par un autre agent. Objectif exprimé par le PO :
« savoir quand une autre IA est en train de travailler sur quoi ».

## Pourquoi

La règle actuelle journalise (avant/après) mais ne garantit pas l'exclusion mutuelle.
Preuve du besoin : `[Cursor] Règle de suivi Walkthrough` et `[Gemini] Preparation
Phase 2` déclarent **tous deux** avoir modifié `.agents/AGENTS.md` — collision que
ce protocole doit prévenir.

## Comment

- Édition **additive** de `.agents/AGENTS.md` : nouvelle section « Coordination et
  verrou logique », sans réécrire les sections existantes de Cursor.
- Respect du protocole en cours de route (ce fichier créé `EN COURS` **avant** l'édition).

## Résultat attendu

Une règle qui transforme le fichier `EN COURS` en **signal d'occupation** : les
agents se lisent avant d'agir et évitent les fichiers verrouillés par un autre.

## Fichiers / zones concernés

- `.agents/AGENTS.md` (édition additive) — **verrou posé par Claude sur ce fichier**
- `gestion-projet/walkthrough/[Claude] Regle coordination et verrou walkthrough - 2026-07-22.md` (ce fichier)

## Vérifications prévues

- relecture de `.agents/AGENTS.md` après édition ;
- `git diff --stat .agents/AGENTS.md` pour prouver l'ajout additif (aucune suppression).

---

## RÉSULTAT (DONE)

### Ce qui a été trouvé

- La règle demandée **existait déjà** dans `.agents/AGENTS.md` (écrite par Cursor,
  généralisée aux 3 agents) : fichier `EN COURS` avant, `DONE` avec preuve après,
  statuts `EN COURS` / `DONE` / `BLOQUÉ` / `ABANDONNÉ`.
- **Manque** : aucune obligation de lire les tâches en cours des autres ni de
  verrouiller les fichiers déclarés.
- **Collision réelle observée** : `[Cursor]` et `[Gemini]` déclarent tous deux
  avoir modifié `.agents/AGENTS.md`, et leurs comptes rendus sont rétroactifs.

### Ce qui a été modifié, fichier par fichier

- `.agents/AGENTS.md` : ajout **additif** de la section « Coordination et verrou
  logique (savoir qui fait quoi) ». Aucune section existante réécrite.
- `gestion-projet/walkthrough/[Claude] Regle coordination et verrou walkthrough - 2026-07-22.md`
  (ce fichier) : créé `EN COURS` avant l'édition, passé `DONE` ici.

### Comment

Édition ciblée par ancre de texte (append après le dernier paragraphe), sans
toucher aux lignes de Cursor. Protocole respecté : verrou déclaré avant d'agir.

### Résultat observable maintenant

Le fichier `EN COURS` d'un agent vaut désormais **signal d'occupation** : chaque
agent lit les tâches en cours et la liste des fichiers verrouillés avant de
démarrer, et évite les fichiers pris. Règles anti-collision ajoutées (rétroactif
toléré une seule fois, suffixe horaire, libération de verrou sur interruption,
revérification avant `DONE`).

### Tests / commandes exécutés

- `wc -l .agents/AGENTS.md` → **45 → 76 lignes** (+31), preuve d'ajout.
- `grep -nE "^## " .agents/AGENTS.md` → 4 sections, les 3 d'origine **préservées**
  + « Coordination et verrou logique ».
- `git status -s .agents/` → `?? .agents/` (dossier non suivi ; diff impossible,
  d'où la preuve par décompte).

### Limites / suite

- `.agents/` n'est **pas suivi par git** : la règle n'est pas versionnée ni
  poussée. À décider par le PO (T02) : suivre `.agents/` pour que la règle survive
  et soit partagée via le remote.
- Le respect du verrou reste **conventionnel** (pas d'outillage bloquant) ; il
  dépend de la discipline de chaque agent.
