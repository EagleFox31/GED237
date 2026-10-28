# Plan d'exécution GED237 — 2026-07-22

> Statut : Proposé — à valider par le Product Owner
> Auteur : Product Owner assisté
> Date : 2026-07-22
> Objectif : stabiliser, prouver et préparer le pilote avant toute extension
> Périmètre : gouvernance, qualité, écarts P0/P1, recette CDC et Discovery
> Sources : `AUDIT.md`, audit Claude, plan Gemini, matrice de traçabilité
> Unité d'estimation : jour ouvré idéal, à réestimer après la baseline

## 1. Résultat recherché

À la fin de ce plan, GED237 doit disposer :

- d'un travail sauvegardé et d'un environnement reproductible ;
- d'une baseline de tests et migrations exécutable ;
- des risques critiques Espaces, recherche et OTP fermés ou explicitement
  arbitrés ;
- d'une preuve mesurée des critères de recette atteignables ;
- d'un dossier Go/No-Go pilote compréhensible par le commanditaire ;
- d'un backlog d'évolutions étudié, mais non mélangé à la stabilisation.

## 2. Acteurs

- **PO — Cursor** : redevable de la valeur, du périmètre et du Go/No-Go.
- **Tech Lead / QA — Claude** : redevable de l'architecture, de
  l'implémentation et des preuves techniques.
- **Product Analyst & Frontend Explorer — Gemini** : responsable de la
  Discovery, de la recherche sourcée, de la cartographie frontend, des
  scénarios, jeux de données, traçabilité et revues indépendantes.

`A` signifie redevable/décide, `R` réalise, `C` consulté et `I` informé.

## 3. Principes d'exécution

1. Sécuriser avant de modifier.
2. Mesurer l'état courant avant d'annoncer une amélioration.
3. Une seule personne ou un seul agent modifie un fichier à la fois.
4. Gemini explore en lecture seule les routes, menus, composants, appels API,
   écarts UX, responsive et accessibilité ; toute modification exige une
   attribution explicite.
5. Claude ne valide pas seul une exigence produit.
6. Le PO ne déclare rien terminé sans preuve.
7. Les propositions d'évolution passent par Discovery avant backlog de delivery.

## 4. Lots et tâches attribuées

### Lot 0 — Cadrage et sécurisation

| ID | Travail | A | R | C | I | Estimation | Livrable / Definition of Done |
|---|---|---|---|---|---|---:|---|
| L0-01 | Relever état Git, fichiers non suivis et remote | PO | Claude | Gemini | — | 0,25 j | État daté ; aucun secret ; stratégie de sauvegarde validée |
| L0-02 | Sauvegarder le travail selon autorisation humaine | PO | Claude | — | Gemini | 0,25 j | Commit/push uniquement après demande explicite ; statut remote prouvé |
| L0-03 | Vérifier `.gitignore`, `venv/` et `.venv/` | Claude | Claude | Gemini | PO | 0,25 j | Environnements locaux non suivis ; aucune suppression non autorisée |
| L0-04 | Recréer l'environnement Python | Claude | Claude | — | PO, Gemini | 0,5 j | Python démarre ; dépendances installées de façon reproductible |
| L0-05 | Vérifier les migrations des deux bases | Claude | Claude | — | PO, Gemini | 0,25 j | `edossier` et `test_ged` au head ; résultat enregistré |
| L0-06 | Exécuter la baseline pytest | Claude | Claude | Gemini | PO | 0,75 j | Rapport pass/fail complet, erreurs classées, aucune conclusion masquée |

**Jalon M0 — Environnement fiable** : sauvegarde confirmée, Python utilisable,
migrations cohérentes et baseline de tests disponible.

### Lot 1 — Fermer les écarts P0/P1

| ID | Travail | A | R | C | I | Estimation | Livrable / Definition of Done |
|---|---|---|---|---|---|---:|---|
| L1-01 | Décider le contrat Espaces V1 | PO | PO | Claude, Gemini | — | 0,25 j | Décision écrite : paramètres, pagination et arbre retenu |
| L1-02 | Implémenter filtres et pagination Espaces | Claude | Claude | Gemini | PO | 2,5 j | API, schémas et UI alignés ; tests API/E2E ; gros corpus non chargé intégralement |
| L1-03 | Sécuriser la recherche par autorisation et scope | Claude | Claude | Gemini | PO | 1,5 j | Tests cross-role/cross-scope ; soft delete et catégorie vérifiés |
| L1-04 | Spécifier le canal OTP et ses contraintes | PO | Gemini | Claude | — | 0,75 j | Comparatif e-mail/SMS/institutionnel, coûts, sécurité et recommandation |
| L1-05 | Implémenter et tester la distribution OTP retenue | Claude | Claude | Gemini | PO | 1,5 j | OTP reçu, expiré, limité et audité ; secret absent des logs |
| L1-06 | Ajouter les tests API Rapports | Claude | Claude | Gemini | PO | 1 j | 4 endpoints, authz et scopes couverts |
| L1-07 | Couvrir `usage`, `org_units` et notifications critiques | Claude | Claude | Gemini | PO | 1,5 j | Cas nominaux, refus et tenant isolation couverts |
| L1-08 | Retirer la référence `/index.css` et vérifier le build | Claude | Claude | — | PO, Gemini | 0,25 j | Build sans ce warning ; aucun changement visuel involontaire |

**Jalon M1 — Socle pilote stabilisé** : findings critiques fermés, tests ciblés
verts et décisions produit enregistrées.

### Lot 2 — Préparer et mesurer la recette CDC

| ID | Travail | A | R | C | I | Estimation | Livrable / Definition of Done |
|---|---|---|---|---|---|---:|---|
| L2-01 | Réconcilier scénarios UAT et specs Playwright | PO | Gemini | Claude | — | 1,5 j | Matrice SC ↔ persona ↔ route ↔ API ↔ spec sans collision d'ID |
| L2-02 | Définir le jeu étalon de classement | PO | Gemini | Claude | — | 1 j | Corpus représentatif, vérité attendue et règles de mesure |
| L2-03 | Construire le harnais de mesure classification | Claude | Claude | Gemini | PO | 1,5 j | Taux automatique, ambiguïtés, faux classements et rapport reproductible |
| L2-04 | Mesurer la recherche sur corpus représentatif | Claude | Claude | Gemini | PO | 1 j | p50/p95, pertinence et conditions documentées |
| L2-05 | Tester la volumétrie import | Claude | Claude | Gemini | PO | 2 j | Volume, durée, erreurs, ressources et limite réelle documentés |
| L2-06 | Rejouer backup → restore | Claude | Claude | Gemini | PO | 1 j | Base et documents restaurés ; contrôles d'intégrité |
| L2-07 | Répéter le déploiement démo/on-site | Claude | Claude | Gemini | PO | 2 j | Runbook exécuté, secrets et rollback vérifiés |
| L2-08 | Préparer la synthèse de recette commanditaire | PO | Gemini | Claude | — | 1 j | Critère, valeur mesurée, preuve, écart et décision |

**Jalon M2 — Recette mesurée** : les critères CDC ont une valeur observée ou un
écart officiellement arbitré.

### Lot 3 — Stabiliser la V1 et préparer le Go/No-Go

| ID | Travail | A | R | C | I | Estimation | Livrable / Definition of Done |
|---|---|---|---|---|---|---:|---|
| L3-01 | Exécuter les parcours E2E non mockés | Claude | Claude | Gemini | PO | 2 j | Auth, import, classement, workflow, audit et isolation prouvés |
| L3-02 | Fermer les écarts fonctionnels de Sprint 8 | PO | Claude | Gemini | — | 2 j | Écarts classés et tests de non-régression |
| L3-03 | Figer les KPI et filtres Rapports V1.1 | PO | Gemini | Claude | — | 1 j | Dictionnaire KPI et règles de filtre validés |
| L3-04 | Implémenter les filtres Rapports retenus | Claude | Claude | Gemini | PO | 2 j | Filtres cohérents entre onglets et exports |
| L3-05 | Refactor SRP ciblé Import/Classement | Claude | Claude | Gemini | PO | 3 j | Extraction sans changement métier ; tests ciblés |
| L3-06 | Exécuter shadow → SQL AuthZ | Claude | Claude | Gemini | PO | 2 j | Zéro divergence inexpliquée, benchmark et rollback prouvé |
| L3-07 | Produire la revue indépendante finale | PO | Gemini | Claude | — | 1 j | Findings triés, preuves citées, aucune modification destructive |
| L3-08 | Tenir le Go/No-Go pilote | PO | PO | Claude, Gemini | — | 0,5 j | Décision, réserves, responsables et échéances consignés |

**Jalon M3 — Décision pilote** : dossier de preuve accepté et décision Go,
Go avec réserves ou No-Go enregistrée.

### Lot 4 — Discovery des évolutions Gemini

Ce lot ne commence pas avant M1. Il ne doit pas détourner Claude du chemin
critique de stabilisation.

| ID | Opportunité | A | R | C | I | Estimation | Critère de passage en delivery |
|---|---|---|---|---|---|---:|---|
| D4-01 | Connecteur AIGLES | PO | Gemini | Claude | — | 2 j | Existence/accès API, propriétaire, données, base légale et pilote confirmés |
| D4-02 | Intérims et délégations | PO | Gemini | Claude | — | 1,5 j | Règles juridiques, périmètre de signature et audit validés |
| D4-03 | Contrôle de complétude | PO | Gemini | Claude | — | 1 j | Persona, templates, exceptions et KPI d'impact validés |
| D4-04 | QR Code et vérification publique | PO | Gemini | Claude | — | 1,5 j | Menace, confidentialité, autorité émettrice et durée de vérification validées |
| D4-05 | Synthèse opportunités | PO | Gemini | Claude | — | 0,5 j | Score valeur/risque/effort et recommandation Now/Next/Later |

**Jalon M4 — Options qualifiées** : aucune évolution n'entre au backlog de
delivery sans sponsor métier, preuve de besoin et contraintes clarifiées.

## 5. Ordre recommandé

1. Lot 0 intégral.
2. Lot 1, avec L1-04 en parallèle des corrections techniques.
3. Lot 2, préparé par Gemini dès que les contrats sont stables.
4. Lot 3 pour la décision pilote.
5. Lot 4 en parallèle à faible charge après M1, sans développement.

## 6. Handoffs obligatoires

### Gemini → PO / Claude

- sources et date de consultation ;
- hypothèses et niveau de confiance ;
- cartographie des routes, composants, appels API et écarts UX concernés ;
- scénarios et critères d'acceptation ;
- données nécessaires ;
- décisions attendues ;
- risques de conformité ou d'usage.

### Claude → Gemini / PO

- fichiers modifiés ;
- commandes exécutées ;
- résultats de tests ;
- limites et écarts restants ;
- instructions de reproduction ;
- impact sur les scénarios et la documentation.

## 7. Risques de planification

- Les durées de L1–L3 sont indicatives tant que L0-06 n'a pas produit la
  baseline réelle.
- Le test de 100 000 fichiers peut exiger matériel, stockage et données non
  immédiatement disponibles.
- La disponibilité à 99 % est un objectif d'exploitation, pas une simple tâche
  de développement.
- AIGLES et la vérification publique impliquent des dépendances institutionnelles
  externes non contrôlées par l'équipe GED237.
- L'accès aux services e-mail/SMS, VPS et stockage peut déplacer le chemin
  critique.

## 8. Règle de statut

Toutes les tâches commencent à **Proposé**. Elles passent à **Décidé**, **En
cours**, **Implémenté**, puis **Vérifié** conformément à
`REGLES_DE_TRAVAIL.md`. Aucun jalon n'est considéré atteint sur la seule base
d'une case cochée.
