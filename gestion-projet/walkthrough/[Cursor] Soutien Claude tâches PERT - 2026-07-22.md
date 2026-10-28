# [Cursor] Soutien à Claude sur les tâches PERT — 2026-07-22

> Statut : EN COURS
> Agent : Cursor
> Début : 2026-07-22 23:19 UTC+1
> Référence PERT : T07, T08, préparation T12–T13

## Ce qui va être fait

Préparer trois livrables parallèles qui réduisent la charge d'analyse de Claude :

1. la matrice UAT ↔ E2E de T07 ;
2. le dossier de décision sur le canal OTP de T08 ;
3. l'inventaire des tests API manquants pour préparer T12–T13.

## Pourquoi

Claude doit rester concentré sur le chemin critique d'implémentation. Cursor
coordonne les sous-agents, consolide leurs résultats et fournit des handoffs
directement exploitables.

## Comment

- lancer trois explorations indépendantes et en lecture seule ;
- confronter chaque résultat au code et aux sources existantes ;
- créer un livrable Markdown par sujet dans `gestion-projet/` ;
- ne modifier aucun code de production ;
- faire relire les sorties avant de les déclarer terminées.

## Résultat attendu

- une matrice de traçabilité sans collision d'identifiants ;
- une recommandation OTP avec contraintes, risques et critères d'acceptation ;
- une liste priorisée des tests API à implémenter par Claude.

## Zones concernées

- `Phase de Conception/GUIDE_TEST_FONCTIONNEL.md`
- `frontend/e2e/`
- `backend/app/api/v1/endpoints/`
- `backend/tests/api/`
- services d'authentification et d'envoi de messages
- documentation `gestion-projet/`

## Vérifications prévues

- chaque constat doit citer un fichier, une source ou une preuve ;
- aucune conclusion « livré » sans test exécuté ;
- cohérence avec la RACI et le PERT ;
- encodage Markdown contrôlé.
