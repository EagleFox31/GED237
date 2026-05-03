# Règles de Développement - E-Dossier Cameroun (GED237)

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
6. **Capture Lessons** : Mettre à jour les leçons après corrections

## Core Principles

- **Simplicity First** : Rendre chaque changement aussi simple que possible. Impact minimal sur le code.
- **No Laziness** : Trouver les causes racines. Pas de fix temporaires. Standards de développeur senior.
- **Minimal Impact** : Les changements ne doivent toucher que ce qui est nécessaire. Éviter d'introduire des bugs.

## Project Technical Context

- **Backend**: FastAPI + SQLAlchemy 2.0 AsyncSession + asyncpg + PostgreSQL
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Zustand
- **Auth**: JWT 2FA (login → OTP Redis → tokens), blacklist Redis
- **Multi-tenant**: `tenant_id` isolation on all models
- **Storage**: Local ou S3/MinIO via factory pattern
- **OCR**: Tesseract/EasyOCR → TSVECTOR full-text search
- **Rules**: IFTTT engine (conditions + actions via registry pattern)
- **Tests**: pytest-asyncio, `backend/venv/Scripts/python.exe` on Windows
- **DB**: `edossier` (prod), `test_ged` (test) sur PostgreSQL local
