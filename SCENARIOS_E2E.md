# Scénarios End-to-End fonctionnels (multi-rôles)

Ces scénarios testent le produit **de bout en bout**, avec handover entre profils, tel qu'il est vécu par une institution publique camerounaise.

Chacun est une spec Playwright qui enchaîne plusieurs logins et vérifie le comportement attendu à chaque transition.

---

## SC-FULL-01 — Onboarding plateforme & isolation tenant

**Objectif** : prouver qu'un nouveau ministère peut être mis en service de zéro, et qu'il est étanche des autres tenants.

### Étapes

| # | Acteur | Action | Vérification |
|---|--------|--------|--------------|
| 1 | `super_admin` | Crée un tenant "MINSANTE" via `/tenants` | Tenant apparaît dans la liste, `slug` unique |
| 2 | `super_admin` | Crée l'admin tenant (`MINSANTE001`, rôle `tenant_admin`) | User créé, appartient à MINSANTE |
| 3 | `tenant_admin` MINSANTE | Se connecte, crée 2 services ("Direction Épidémiologie", "Direction Hôpitaux") via `/org` | 2 unités sous racine MINSANTE |
| 4 | `tenant_admin` MINSANTE | Crée 1 `unit_admin` + 1 `manager` + 2 `collaborator` + 1 `reader` | 5 users, tous `tenant_id = MINSANTE` |
| 5 | `tenant_admin` MINFI | Se connecte | Ne voit **ni** le tenant MINSANTE ni ses users |
| 6 | `collaborator` MINFI | Appelle `GET /users?tenant_id=<MINSANTE.id>` | `403` ou réponse filtrée vide |

**Durée estimée** : ~90 s. **Pré-requis** : seed de base (super_admin existe).

---

## SC-FULL-02 — Cycle documentaire complet + blocage ad hoc

**Objectif** : un document traverse tout son cycle de vie avec intervention de chaque rôle métier.

### Étapes

| # | Acteur | Action | Vérification |
|---|--------|--------|--------------|
| 1 | `tenant_admin` | Crée un workflow custom "Marché interne" (3 étapes : rédaction → visa unit_admin → signature manager) via le générateur de workflows | Template workflow visible et réutilisable |
| 2 | `tenant_admin` | Crée des règles IFTTT (tag "marché" → service Achats) via `/rules` | 1 règle active |
| 3 | `collaborator` | Upload un doc "Appel d'offres 2026" | Doc en statut `draft`, tagué `marché` par IFTTT |
| 4 | `collaborator` | Soumet au workflow "Marché interne" | Workflow démarré, étape 1 = complétée, étape 2 = en attente chez `unit_admin` |
| 5 | `unit_admin` | Voit le doc dans `/tasks`, ajoute son visa | Étape 2 complétée, étape 3 en attente `manager` |
| 6 | `manager` | **Bloque le document** avec motif "Clause juridique à revoir" | Doc en statut `blocked`, audit log créé |
| 7 | `collaborator` | Tente de modifier le doc bloqué | `403` — édition interdite, message explicite UI |
| 8 | `reader` | Tente de consulter le doc bloqué | `200` (lecture seule toujours possible pour `reader`) ou message "document bloqué" selon policy |
| 9 | `manager` | Débloque après revue | Doc retourne en statut `in_review`, étape 3 à nouveau dispo |
| 10 | `manager` | Signe (valide étape 3) | Workflow terminé, doc en statut `approved` |
| 11 | `auditor` | Ouvre `/audit` | Voit les événements : upload, tag auto, 3 étapes workflow, blocage, déblocage, signature |
| 12 | `reader` | Ouvre le doc dans `/documents` | Peut visualiser, aucun bouton "modifier/supprimer/signer" |

**Durée estimée** : ~3 min. **Pré-requis** : SC-FULL-01 exécuté (ou seed équivalent).

### Périmètre de la feature "blocage ad hoc" (à coder dans ce sprint)

Défauts proposés :

- **Qui peut bloquer** : `manager`, `unit_admin`, `tenant_admin`, `super_admin` (pas `collaborator`, pas `reader`, pas `auditor`)
- **Effet du blocage** : édition/suppression/nouvelle-version interdites pour tous. Lecture autorisée selon RBAC habituel.
- **Durée** : permanent jusqu'à déblocage manuel. Motif obligatoire.
- **Déblocage** : le bloqueur lui-même, ou tout rôle ≥ à celui du bloqueur (ex. `tenant_admin` peut débloquer un doc bloqué par un `manager`).
- **Trace** : champs `blocked_by`, `blocked_reason`, `blocked_at` sur `Document` + entrée `AuditLog` à chaque block/unblock.

---

## SC-FULL-03 — Ingestion de répertoire + classement + arbitrage

**Objectif** : le tenant_admin branche un répertoire existant, le moteur classe, ce qui n'a pas pu être classé atterrit dans `needs-review` pour arbitrage humain.

### Étapes

| # | Acteur | Action | Vérification |
|---|--------|--------|--------------|
| 1 | `tenant_admin` | Crée 6 règles IFTTT (RH, Finances, Juridique, Informatique, Direction, Marketing) via `/rules` | 6 règles actives |
| 2 | Pré-requis | `python backend/scripts/test_real_export_v2.py` a généré ~500 fichiers sur disque | Fichiers présents dans `backend/scripts/E:/tmp_*_v2/` |
| 3 | `tenant_admin` | Lance ingestion du dossier via `/ingestion` (ou bulk upload) | Les 500 fichiers sont uploadés |
| 4 | Moteur IFTTT | (async) classe les docs selon règles | ≥ 80% des docs ont au moins 1 tag, ≤ 20% finissent en `needs_review` |
| 5 | `tenant_admin` | Ouvre `/needs-review`, arbitre les 20 docs non classés | Chaque doc reçoit un tag manuel, sort de la file |
| 6 | `auditor` | Ouvre `/audit`, filtre sur action=`upload` | Voit les 500 entrées |

**Durée estimée** : ~15-20 min (upload massif). **Pré-requis** : SC-FULL-01 exécuté, règles non seedées.

---

## Ordre d'exécution recommandé

```
SC-FULL-01 (onboarding)
    ↓
SC-FULL-02 (cycle documentaire)   SC-FULL-03 (ingestion massive)
    ↓                                  ↓
       Suite E2E complète validée
```

SC-FULL-02 et SC-FULL-03 sont parallélisables sur des tenants différents.

---

## Ce qui N'EST PAS testé ici (hors scope / backlog)

- Scan multi-postes réseau → [BACKLOG_SPRINT_NEXT.md F-NEXT-01](BACKLOG_SPRINT_NEXT.md)
- URL signée expirante pour ouverture fichier → [BACKLOG_SPRINT_NEXT.md F-NEXT-02](BACKLOG_SPRINT_NEXT.md)
- Watermarking dynamique des PDF confidentiels → lié à F-NEXT-02
