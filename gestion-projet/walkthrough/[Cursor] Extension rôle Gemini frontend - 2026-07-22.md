# [Cursor] Extension du rôle Gemini au frontend — 2026-07-22

> Statut : DONE
> Agent : Cursor
> Début : 2026-07-22 23:04 UTC+1
> Fin : 2026-07-22 23:05 UTC+1

## Ce qui va être fait

Étendre officiellement le rôle de Gemini à l'exploration frontend dans les
documents de gouvernance GED237.

## Pourquoi

Gemini peut exploiter son grand contexte pour cartographier les routes,
composants, appels API et écarts UX, pendant que Claude conserve la
responsabilité de l'architecture, de l'implémentation et des preuves techniques.

## Comment

- mettre à jour la RACI de Claude ;
- aligner les règles de travail ;
- aligner le plan d'exécution et le PERT ;
- conserver une séparation claire entre exploration et modification du code.

## Résultat attendu

Gemini porte officiellement le rôle `Product Analyst & Frontend Explorer`, avec
des responsabilités et limites explicites.

## Fichiers concernés

- `gestion-projet/[Claude] RACI + Roadmap GED237.md`
- `gestion-projet/REGLES_DE_TRAVAIL.md`
- `gestion-projet/PLAN_EXECUTION_GED237_2026-07-22.md`
- `gestion-projet/PERT_EXECUTION_GED237_2026-07-22.md`

## Vérifications prévues

- cohérence du titre et des responsabilités dans les quatre documents ;
- Gemini responsable de l'exploration, pas de l'intégration technique ;
- absence de modification simultanée des mêmes fichiers ;
- vérification de l'encodage Markdown.

## Résultat

### Ce qui a été trouvé

Gemini était déjà responsable de la Discovery, de la documentation et de la
revue indépendante, mais l'exploration frontend n'était pas explicitement
inscrite dans la RACI, les règles ou le PERT.

### Ce qui a été modifié

- `[Claude] RACI + Roadmap GED237.md` : rôle renommé, responsabilités frontend,
  activités RACI et limites d'autorité ajoutées.
- `REGLES_DE_TRAVAIL.md` : cartographie frontend, audit UX, responsive,
  accessibilité et préparation Playwright intégrés au rôle Gemini.
- `PLAN_EXECUTION_GED237_2026-07-22.md` : acteur, principe de lecture seule et
  contenu du handoff Gemini complétés.
- `PERT_EXECUTION_GED237_2026-07-22.md` : piste Gemini enrichie en appui de T10,
  T23, T25 et T27.

### Comment

Les documents ont été alignés sur une séparation nette :

- Gemini explore, cartographie, documente et prépare les scénarios ;
- Claude décide de l'architecture technique, implémente et exécute les tests ;
- le Product Owner arbitre la valeur, le périmètre et l'acceptation.

### Résultat observable maintenant

Gemini porte officiellement le rôle `Product Analyst & Frontend Explorer`. Il
est `R` pour l'exploration des routes, menus, composants, appels API, UX,
responsive, accessibilité et code frontend orphelin.

### Tests et contrôles

- recherche transversale des termes du nouveau rôle dans les quatre documents ;
- relecture de la RACI et des règles de travail ;
- contrôle d'encodage : aucun caractère corrompu détecté ;
- aucun test logiciel requis, car seules des règles de gouvernance ont changé.

### Limites et travaux restants

Gemini reste en lecture seule dans le PERT actuel. Toute future attribution de
modification frontend devra définir des fichiers exclusifs, un handoff et une
revue Claude.
