# [Claude] Adoption standard RAIDER — 2026-10-27

> Statut : DONE

## Ce qui va être fait

Intégrer le standard d'ingénierie RAIDER (source canonique `EagleFox31/project-registry`)
dans GED237 : règle d'agent, déclinaison projet, mémoire d'échecs, modèle de PR.

## Pourquoi

GED237 est enregistré dans le registry (`id: ged237`) mais aucun fichier du dépôt ne
mentionne RAIDER : pas de modèle de PR, pas de mémoire d'échecs au format RAIDER,
CI non proportionnelle (`ci.yml` lance backend + frontend + sécurité à chaque push).

## Comment

Pointer vers la source canonique (pas de copie intégrale → pas de dérive) et ne décrire
localement que la **déclinaison GED237** (migrations, multi-tenant, adaptateurs, CI).

## Fichiers / zones concernés (verrou)

- `RAIDER.md` (nouveau)
- `DOCS/engineering/lessons-learned.md` (nouveau)
- `.github/pull_request_template.md` (nouveau)
- `.agents/AGENTS.md`, `AGENTS.md` (section RAIDER)
- `CLAUDE.md` (pointeur)

## Vérifications prévues

- Les deux AGENTS.md restent synchronisés (même section RAIDER).
- Liens relatifs résolus vers des fichiers existants.
- Aucun code applicatif ni workflow CI modifié.

## RÉSULTAT (DONE)

**Trouvé** : registry (`EagleFox31/project-registry`) → `RAIDER.md`, `AGENTS.md`,
`docs/engineering/lessons-learned.md`, `.github/pull_request_template.md`. GED237 y est
enregistré (`ged237`, stage `mvp`). Aucune mention RAIDER dans le dépôt. Aucun verrou
`EN COURS` concurrent.

**Modifié** :
- `RAIDER.md` (nouveau) — pointeur vers la source canonique + déclinaison GED237 par principe + écarts connus + DoD.
- `DOCS/engineering/lessons-learned.md` (nouveau) — modèle RAIDER + LESSON-2026-001 (migration non appliquée). Dossier `DOCS/` en majuscules car c'est la casse suivie par git.
- `.github/pull_request_template.md` (nouveau) — section « RAIDER review » du registry, adaptée (migrations, tenants).
- `AGENTS.md` + `.agents/AGENTS.md` — section « Standard d'ingénierie RAIDER » identique (liens relatifs ajustés).
- `CLAUDE.md` — pointeur RAIDER court.

**Vérifications** : sections AGENTS synchronisées (diff vide) ; cibles des liens existantes ;
affirmations de `RAIDER.md` vérifiées dans le code (factory stockage, moteurs de règles,
`LocalWriteResult`) — une mention erronée de « registry » corrigée. Aucun code applicatif ni workflow modifié.

**Reuse-first** : Adopt (texte canonique référencé, pas recopié ; modèles PR/leçons repris du registry).

**Reste à faire** : Impact-Aware CI (`ci.yml`) ; contrôle automatique « schéma à `head` » (prévention LESSON-2026-001).
