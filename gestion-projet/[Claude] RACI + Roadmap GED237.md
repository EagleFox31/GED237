# [Claude] Modèle de collaboration & Roadmap — GED237

> **Auteur** : Claude (Tech Lead / QA)
> **Date** : 2026-07-22
> **Objet** : formaliser la répartition des rôles (PO ↔ Tech Lead ↔ Product Analyst) et la feuille de route
> Phase 0→3, alignée sur les **critères de recette du Cahier des Charges**.
> **Sources** : audit code du 2026-07-22 (voir `walkthrough/[Claude] Audit technique GED237 - 2026-07-22.md`)
> + `Phase de Conception/` (2 CDC, Expression de Besoin, PERT global, 8 sprints V1).
> **Extension RACI** : rôle Gemini ajouté le 2026-07-22 par décision du Product Owner.
> **Plan opérationnel** : `PLAN_EXECUTION_GED237_2026-07-22.md` et `PERT_EXECUTION_GED237_2026-07-22.md`.

---

## 1. Contexte produit (rappel factuel)

- **CDC contractuel** : GED d'entreprise, plan **6 mois**, dev « à titre gracieux », budget **237 000 FCFA** (outils + hébergement uniquement), hébergement **on-site (prod) + VPS (démo)**.
- **Photographie de l'audit Claude au 2026-07-22** : plateforme **multi-tenant grade SaaS** (Casbin, JWT+2FA, OCR, DevSecOps, 122 routes, 7 profils) — **au-dessus** du périmètre CDC. L'audit signalait environ 11 800 LOC non commitées, un venv invalide et des tests non rejouables ; ces trois constats doivent être revérifiés par T01–T06 avant d'être traités comme état courant.
- **Principe directeur** : on ne juge pas le projet à sa sophistication mais à ses **critères de recette** (§5). Priorité = **sécuriser + prouver**, pas ajouter des features.

---

## 2. Rôles

### PO — Cursor
Porte le **quoi** et le **pourquoi**.
- Vision produit, backlog, priorisation, arbitrages de périmètre.
- Définition du « done » fonctionnel et des critères d'acceptation.
- Voix du commanditaire / prestataire ; validation des livrables.

### Tech Lead / QA — Claude
Porte le **comment** et la **preuve que ça marche**.
- Architecture, implémentation, refactors.
- Vérification : tests, CI, build, migrations, recette technique, revue sécurité.
- **Garde-fou** : alerte quand le périmètre dérive du CDC ou de la réalité technique, quantifie dette et risques.

### Product Analyst & Frontend Explorer — Gemini
Porte l'**exploration du besoin et du frontend**, les options et la traçabilité produit.
- Recherche externe sourcée, benchmark métier et analyse des parties prenantes.
- Formalisation des personas, scénarios UAT, critères d'acceptation et jeux de données étalons.
- Matrice de traçabilité entre besoin, route, API, test et preuve.
- Cartographie des routes, menus, composants, appels API et dépendances frontend.
- Détection des pages orphelines, incohérences UX, lacunes responsive et accessibilité.
- Préparation des scénarios Playwright et des propositions de découpage, sans imposer l'architecture finale.
- Revue indépendante en lecture seule des livrables de Claude.
- **Garde-fou** : sépare fait, déduction et proposition ; ne transforme pas une tendance externe en exigence GED237 sans validation du PO.

---

## 3. RACI (R = Réalise · A = Redevable/Décide · C = Consulté · I = Informé)

| Activité | PO (Cursor) | Tech Lead/QA (Claude) | Product Analyst & Frontend Explorer (Gemini) |
|---|---|---|---|
| Vision, outcomes et ordre du backlog | **A / R** | C | C |
| Recherche utilisateurs, marché et contexte institutionnel | **A** | C | **R** |
| Personas, scénarios UAT et critères d'acceptation | **A** | C | **R** |
| Arbitrage de périmètre produit | **A / R** | C (faisabilité) | C (valeur et usages) |
| Dossier d'options avant décision | **A** | C | **R** |
| Spécification technique en plan-mode | C | **A / R** | C |
| Architecture, migration et sécurité | I | **A / R** | C |
| Implémentation / refactor | I | **A / R** | I |
| Jeux de données étalons | **A** | C | **R** |
| Matrice besoin ↔ route ↔ API ↔ test | **A** | C | **R** |
| Exploration routes, menus, composants et appels API frontend | **A** | C | **R** |
| Audit UX, responsive, accessibilité et code frontend orphelin | **A** | C | **R** |
| Architecture frontend et choix de refactor | C | **A / R** | C (fournit la cartographie) |
| Tests, CI et recette technique | I (fixe le seuil) | **A / R** | C |
| Revue indépendante du changement | **A** | C (répond/corrige) | **R** |
| Revue sécurité / conformité technique | I | **A / R** | C |
| Dossier de preuve Go/No-Go | **A** | **R** (preuves techniques) | **R** (preuves produit/UAT) |
| Décision Go/No-Go | **A / R** | C | C |
| Dette et risques techniques | **A** (ordonne) | **R** | C |
| Opportunités et risques produit | **A** (ordonne) | C | **R** |
| Documentation et handoff | **A** | C | **R** |
| Communication commanditaire | **A / R** | I | C (prépare les éléments) |

> Règle simple : **le PO décide où on va ; Gemini vérifie que le besoin et les preuves produit sont compris ; Claude garantit que la solution fonctionne et tient techniquement.**

### Limites d'autorité

- Gemini explore le frontend en lecture seule et ne modifie pas le code de production dans la roadmap courante sans attribution explicite.
- Claude ne décide pas seul qu'une exigence métier est satisfaite.
- Le PO ne remplace pas les preuves techniques par une validation visuelle.
- Une revue Gemini est consultative tant que les tests de Claude ne sont pas exécutés.
- Deux agents ne modifient jamais simultanément le même fichier.

---

## 4. Rythme opérationnel

```text
PO formule le problème et l'outcome
      │
      ├──► Gemini explore, source et prépare les scénarios
      │
      └──► Claude évalue faisabilité, risques et dépendances
      │
      ▼
PO arbitre et ordonne le backlog
      │
      ▼
Claude écrit la spec en PLAN-MODE ──► PO valide le plan
      │
      ▼
Claude implémente et vérifie ──► Gemini effectue la revue indépendante
      │
      ▼
Dossier de preuve technique + produit ──► PO acte le Go/No-Go
```

Invariants : plan-mode pour toute tâche non triviale · **rien de « done » sans preuve** · fix des causes racines · impact minimal · sources citées · capture des leçons après chaque correction.

### Handoffs

**Gemini → Claude / PO** : sources, hypothèses, scénarios, critères
d'acceptation, jeu de données, décisions attendues et risques.

**Claude → Gemini / PO** : fichiers modifiés, commandes, résultats, limites,
instructions de reproduction et impact sur les scénarios.

---

## 5. Mapping recette CDC → état réel (audité)

Légende statut : ✅ vérifié · 🟡 présent mais **non mesuré/non prouvé** · 🔴 écart

| Critère de recette (CDC) | Existant dans le code | Statut | Action pour prouver |
|---|---|---|---|
| ≥ 95 % docs classés automatiquement | Moteur `classification_rule_engine` + règles multi-filtres | 🟡 | Jeu de test étalon + mesure du taux |
| Recherche < 2 s | Full-text TSVECTOR + endpoint `search` | 🟡 | Benchmark sur corpus représentatif |
| 100k fichiers < 20 min | Import batch (`import_execution_service`) | 🟡 | Test de charge volumétrie |
| Droits stricts par rôle | Casbin RBAC + `test_authz` + isolation `tenant_id` | 🟡→✅ | Rejouer pytest (bloqué par venv) |
| Déploiement on-site + VPS démo | `docker-compose`, `nginx/`, `deployment/{ansible,docker,k8s}` | 🟡 | Répétition déploiement documentée |
| Disponibilité ≥ 99 % | — | 🔴 | Définir mesure (hors périmètre dev pur) |
| **Restauration de sauvegarde testée** | `backend/backups/` présent | 🔴 | Procédure backup→restore rejouée |

> Conclusion : la plupart des briques **existent** ; ce qui manque n'est pas du code mais de la **preuve mesurée**. C'est le cœur de la Phase 2.

---

## 6. Roadmap Phase 0 → 3

### Phase 0 — Sécuriser (bloquant, ~heures)
- [ ] `git add -A` → commit filet de sécurité → **push** (traite le risque n°1 : 11 800 LOC non sauvegardées)
- [ ] Re-découper en commits thématiques (reports / usage / local-library / classification / SRP)
- [ ] Retirer `venv/` **et** `.venv/` du dépôt + `.gitignore`
- [ ] Reconstruire un venv propre : `py -3 -m venv venv` ; `pip install -r requirements.txt`
- [ ] Rejouer **pytest** (TEST_DATABASE_URL + Redis) → **baseline de tests réelle**
- [ ] `alembic upgrade head` sur `edossier` **et** `test_ged`
- **Done** : travail poussé sur `origin`, `pytest` exécutable et vert, migrations appliquées.

### Phase 1 — Stabiliser les écarts vérifiés (~jours)
- [ ] **Décision PO** : `spaces/documents` — enrichir le contrat serveur (`scope/domain/activity/year/status/q` + pagination) *ou* réduire explicitement la promesse V1
- [ ] Tests API manquants : `reports`, `usage`, `org_units`, `notifications`
- [ ] Retirer/corriger la référence `/index.css` fantôme (`frontend/index.html:79`)
- [ ] Code-splitting du bundle principal (> 500 kB)
- **Done** : findings P1 de l'audit fermés, couverture tests élargie.

### Phase 2 — Prouver la recette CDC (~jours→semaines)
- [ ] Harnais de mesure : taux de classification, latence recherche, volumétrie import
- [ ] Procédure **backup → restore** rejouée et documentée
- [ ] Répétition de déploiement **on-site + VPS démo** documentée
- **Done** : tableau §5 passé en ✅ là où c'est atteignable ; écarts résiduels arbitrés par le PO.

### Phase 3 — Finir puis durcir (~semaines)
- [ ] Sprint 8 V1 (stabilisation/recette) + finalisation module Rapports selon backlogs
- [ ] Refactor **frontend SRP** (`PLAN_REFACTOR_FRONTEND_SRP.md`)
- [ ] `P6b` — AuthZ SQL / shadow / observabilité / benchmark CSV↔SQL
- **Done** : V1 recettée, dette front réduite, AuthZ production-grade.

---

## 7. Décisions en attente du PO (Cursor)

1. **Périmètre multi-tenant** : le garder (grade SaaS, hors CDC) ou le documenter comme choix assumé ?
2. **`spaces/documents`** : enrichir le contrat serveur ou réduire la promesse V1 ?
3. **Disponibilité ≥ 99 %** : dans le périmètre de recette (mesure/infra) ou noté hors périmètre dev ?
4. **Ordre de bataille** : valider la séquence Phase 0→3 ci-dessus, ou réordonner selon la pression commanditaire.

---

*Ce document est le référentiel de gouvernance courant. Le suivi d'implémentation reste dans l'audit (`walkthrough/`) et les backlogs de `Phase de Conception/`.*
