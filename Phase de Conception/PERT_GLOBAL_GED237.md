# PERT Global du Projet GED237

Ce document regroupe les diagrammes PERT (Program Evaluation and Review Technique) modélisant le chemin critique et les dépendances des travaux. Le document commence par une vision Macro (toutes les phases de P0 à P2) puis détaille un PERT micro pour chaque sous-phase.

---

## 1. MACRO PERT : Toutes les phases (P0 à P2)

Ce graphe représente l'enchaînement global des grandes phases du projet décrites dans le plan de réparation.

```mermaid
graph TD
    %% MACRO PHASES
    SubGraph_P0["🔴 P0 - Remédiation & Fondations"]
    P0["Phase 0: Stabilisation Env."]
    P1["Phase 1: Redémarrage Backend"]
    P2["Phase 2: Migration BDD"]
    P3["Phase 3: Contrat Auth Front/Back"]
    end

    SubGraph_P1["🟡 P1 - Consolidation & Métier"]
    P4["Phase 4: Documents & Workflow"]
    P5["Phase 5: Sécurité Multi-Tenant"]
    P6["Phase 6: Qualité & CI"]
    P6b["Phase 6b: AuthZ Production-Grade"]
    end

    SubGraph_P2["🟢 P2 - Interface & Déploiement"]
    P7["Phase 7: Conversion Maquettes UI -> API"]
    end

    %% DEPENDENCES MACRO
    P0 --> P1
    P1 --> P2
    P2 --> P3
    P3 --> P4
    P3 --> P5
    P4 --> P6
    P5 --> P6
    P5 --> P6b
    P6 --> P6b
    P6b --> P7
    P4 --> P7

    classDef p0 fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000;
    classDef p1 fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000;
    classDef p2 fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#000;

    class P0,P1,P2,P3 p0;
    class P4,P5,P6,P6b p1;
    class P7 p2;
```

> **Chemin Critique Macro :** `P0 -> P1 -> P2 -> P3 -> P4 -> P6 -> P6b -> P7`

---

## 2. MICRO PERTs : Détail par Phase

### Phase 0 à 2 : Fondations (P0)
```mermaid
graph LR
    A["T0.1: Fix dépendances Frontend (Rollup)"]
    B["T0.2: Fix dépendances Backend (Venv)"]
    C["T1.1: Fix 'get_current_user'"]
    D["T1.2: Démarrage Uvicorn stable"]
    E["T2.1: Fix contrainte Rôles (hierarchy_level)"]
    F["T2.2: Rejouer Migrations & Seed"]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
```

### Phase 3 : Contrat Auth Front/Back (P0)
```mermaid
graph TD
    A["T3.1: Aligner Schéma Login Backend"]
    B["T3.2: Séparer API Login & OTP Frontend"]
    C["T3.3: Stockage Sécurisé Tokens (SessionStore)"]
    D["T3.4: Interceptor Auto-Refresh (401)"]
    E["T3.5: Validation E2E Connexion"]

    A --> B
    B --> C
    C --> D
    D --> E
```

### Phase 4 : Documents Et Workflows (P0/P1)
**C'est la phase actuellement en cours d'achèvement.**
```mermaid
graph TD
    A["T4.1: Aligner Schémas Document Backend/Frontend"]
    B["T4.2: Implémenter Upload Multipart + Métadonnées"]
    C["T4.3: Moteur GEDRules (Templates & Règles) ✅"]
    D["T4.4: Validation Machine à états (Draft->In_review)"]
    E["T4.5: Intégration UI Upload -> Déclenchement Workflow"]

    A --> B
    A --> C
    B --> E
    C --> D
    D --> E
```

### Phase 5 : Sécurité Multi-Tenant & Autorisation (P1)
```mermaid
graph TD
    A["T5.1: Filtres tenant_id aveugles sur SQL"]
    B["T5.2: Politique RBAC centralisée (Policies)"]
    C["T5.3: Tests unitaires cross-tenant isolation"]
    D["T5.4: Audit logs sur suppressions/permissions"]

    A --> B
    B --> C
    C --> D
```

### Phase 6 : Qualité, CI & DevSecOps (P1)
```mermaid
graph TD
    A["T6.1: Seed CI injectable (env vars)"]
    B["T6.2: CI Backend Pytest"]
    C["T6.3: Typecheck & Lint Frontend"]
    F["T6.6: Coverage gate (≥70%)"]
    G["T6.7: SAST Python (bandit)"]
    H["T6.8: Dependency audit (pip-audit + npm audit)"]
    I["T6.9: Secrets detection (gitleaks)"]
    J["T6.10: Pre-commit hooks (pre-commit + husky)"]
    K["T6.11: Branch protection rules"]
    L["T6.12: Docker image scan (trivy)"]
    M["T6.13: Migration linting (squawk)"]
    D["T6.4: Pipeline unifiée (Build All)"]
    E["T6.5: Signature GPG + SBOM"]

    A --> B
    A --> C
    A --> G
    A --> H
    A --> I
    A --> J
    B --> F
    F --> D
    C --> D
    G --> D
    H --> D
    I --> D
    J --> K
    K --> D
    L --> D
    M --> D
    D --> E
```

### Phase 6b : AuthZ Production-Grade (P1)
```mermaid
graph TD
    A["P6b.1: Migration Casbin CSV → SQL (Alembic + Adapter)"]
    B["P6b.2: API Admin Policy bornée (super_admin)"]
    C["P6b.3: Observabilité AuthZ (logs structurés + request_id)"]
    D["P6b.4: Cache versionné + invalidation lazy"]
    F["P6b.6: Benchmark latence CSV vs SQL"]
    G["P6b.7: Rate limiting API policy"]
    H["P6b.8: Backup automatique pre-cutover"]
    E["P6b.5: Tests + Runbook rollout (shadow → sql → retrait CSV)"]

    A --> B
    A --> C
    A --> D
    A --> F
    B --> G
    B --> E
    C --> E
    D --> E
    F --> E
    G --> E
    H --> E
```

### Phase 7 : Conversion Maquettes UI (P2)
```mermaid
graph TD
    A["T7.1: UI GEDRules Admin (Templates/Rules) ✅"]
    B["T7.2: Dashboard UI connecté Stats"]
    C["T7.3: Liste Documents & Filtres réels"]
    D["T7.4: Page d'Audit Branchée sur la BDD"]
    E["T7.5: Rejet des mocks et gestion d'erreurs UI"]

    A --> B
    B --> C
    C --> D
    D --> E
```
