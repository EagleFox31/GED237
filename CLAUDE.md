# Règles de Développement - E-Dossier Cameroun (GED237)

## Standard RAIDER

Obligatoire : voir [`RAIDER.md`](RAIDER.md) (déclinaison GED237) et `DOCS/engineering/lessons-learned.md` (mémoire d'échecs). Checklist RAIDER dans chaque walkthrough `DONE` et PR.

## Workflow Orchestration

### 1. Plan Mode Default
- Entrer en mode plan pour TOUTE tâche non-triviale (3+ étapes ou décisions architecturales)
- Si quelque chose dévie, STOP et re-planifier immédiatement — ne pas pousser
- Utiliser le mode plan pour les étapes de vérification, pas seulement le build
- Rédiger des specs détaillées en amont pour réduire l'ambiguïté

### 2. Subagent Strategy
- Utiliser les subagents librement pour garder le contexte principal propre
- Déléguer la recherche, l'exploration et l'analyse parallèle aux subagents
- Pour les problèmes complexes, décomposer et répartir via subagents
- Une tâche par subagent pour une exécution ciblée

### 3. Self-Improvement Loop
- Après TOUTE correction de l'utilisateur : enregistrer le pattern
- Écrire des règles qui empêchent de refaire la même erreur
- Itérer sans relâche sur ces leçons jusqu'à ce que le taux d'erreur baisse
- Revoir les leçons au début de chaque session pour le projet concerné

### 4. Verification Before Done
- Ne JAMAIS marquer une tâche comme terminée sans prouver qu'elle fonctionne
- Comparer le comportement entre main et vos changements quand c'est pertinent
- Se demander : "Est-ce qu'un ingénieur senior approuverait ça ?"
- Lancer les tests, vérifier les logs, démontrer la correction

### 5. Demand Elegance (Balanced)
- Pour les changements non-triviaux : pauser et demander "y a-t-il une manière plus élégante ?"
- Si un fix semble hacky : "Sachant tout ce que je sais maintenant, implémenter la solution élégante"
- Passer outre pour les fixes simples et évidents — ne pas sur-ingénierer
- Challenger son propre travail avant de le présenter

### 6. Autonomous Bug Fixing
- Quand un bug est signalé : le corriger directement. Ne pas demander d'aide
- Pointer les logs, erreurs, tests qui échouent — puis les résoudre
- Zéro changement de contexte requis de l'utilisateur
- Aller corriger les tests CI qui échouent sans qu'on le demande

## Task Management

1. **Plan First** : Écrire le plan avec des items cochables
2. **Verify Plans** : Valider avant de commencer l'implémentation
3. **Track Progress** : Marquer les items au fur et à mesure
4. **Explain Changes** : Résumé de haut niveau à chaque étape
5. **Document Results** : Ajouter une section résultats
6. **Capture Lessons** : Mettre à jour les leçons après corrections — détail dans `tasks/lessons.md`, rappels dans la section « Lessons récentes » ci‑dessous.

## Lessons récentes (GED237 — relire en session)

- **DB** : toute fonctionnalité qui suppose une nouvelle table exige **`alembic upgrade head`** sur l’environnement cible ; un 500 `UndefinedTableError` peut être masqué côté client comme erreur réseau ou générique.
- **Erreurs UI** : le bus global (`pushApiError`) couvre le HTTP ; les opérations **100 % locales** utilisent **`pushClientOperationError`** depuis les pages (`lib/errors/clientOperationError.ts`), pas depuis les services purs (`localOrganizer`, etc.).
- **Rangement local** : métier avant noms propres ; seuils heuristiques commentés dans le code ; ZIP et FSA partagent le même contrat **`LocalWriteResult`**.
- **Bibliothèque locale (historique)** : exports multiples → une icône **télécharger** + menu ; « rejouer » via `localReplayFromLibrary`. Si une poignée **FSA** est encore en IndexedDB (même navigateur), relire les fichiers sur le **dossier destination** enregistré → pas d’étape 1 ; sinon aperçu seul (stubs) ou ZIP historique → étape 1.

## Core Principles

- **Simplicity First** : Rendre chaque changement aussi simple que possible. Impact minimal sur le code.
- **No Laziness** : Trouver les causes racines. Pas de fix temporaires. Standards de développeur senior.
- **Minimal Impact** : Les changements ne doivent toucher que ce qui est nécessaire. Éviter d'introduire des bugs.

## Frontend UX — densité et aide (GED237)

- **Espace écran** : éviter les bandeaux pleine largeur ou les lignes entièrement vides pour porter une seule aide ; préférer une **icône d’aide** (`help`) avec **tooltip / petit dialogue** au clic.
- **Coin de carte** : pour une aide secondaire dans une carte (filtres, panneaux compacts), positionner l’icône en **`absolute` + coin** et réserver un léger **`padding-right`** au contenu pour éviter le chevauchement — pas de rangée dédiée uniquement au point d’interrogation.
- **Clarté utilisateur** : le texte détaillé reste disponible (infobulle, modale, écran vide / zone pédagogique), mais **ne pas noyer** les contrôles métier sous des paragraphes dans la même carte.
- **Actions secondaires compactes** : pour plusieurs formats d’export sur une ligne d’historique ou dans une carte dense, **regrouper sous une icône** (ex. téléchargement) avec **menu déroulant** plutôt que N boutons pleine largeur.
- **Copy utilisateur final** : tooltips et micro-textes **courts**, **droit au but**, pensés pour un utilisateur lambda (pas de jargon produit interne type « référentiel », « manifeste » quand une formulation plain-français suffit). Référence d’esprit : aide simple façon interfaces grand public (YouTube : compréhension immédiate, zéro blabla).

## Project Technical Context

- **Backend**: FastAPI + SQLAlchemy 2.0 AsyncSession + asyncpg + PostgreSQL
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Zustand
- **Auth**: JWT 2FA (login → OTP Redis → tokens), blacklist Redis
- **Multi-tenant**: `tenant_id` isolation on all models
- **Storage**: Local ou S3/MinIO via factory pattern
- **OCR**: Tesseract/EasyOCR → TSVECTOR full-text search
- **Rules**: IFTTT engine (conditions + actions via registry pattern)
- **Tests**: pytest-asyncio, `backend/venv/Scripts/python.exe` on Windows
- **DB**: `edossier` (prod), `test_ged` (test) sur PostgreSQL local — après ajout de migration : **`alembic upgrade head`** sur chaque base utilisée par l’app.
