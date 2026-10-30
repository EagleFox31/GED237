# RAIDER — déclinaison GED237

GED237 applique le standard d'ingénierie **RAIDER** du Project Registry.

- **Source canonique** : `EagleFox31/project-registry` → `RAIDER.md` (dépôt privé).
  Lecture : `gh api repos/EagleFox31/project-registry/contents/RAIDER.md -H "Accept: application/vnd.github.raw"`.
- **En cas d'écart, la source canonique fait foi.** Ce fichier ne la recopie pas : il
  traduit chaque principe en règles concrètes pour ce dépôt.
- Mémoire d'échecs : [`DOCS/engineering/lessons-learned.md`](DOCS/engineering/lessons-learned.md).
- Revue : section « RAIDER review » de [`.github/pull_request_template.md`](.github/pull_request_template.md).

## Principes appliqués à GED237

| Principe | Règle GED237 |
|---|---|
| **R — Reusable** | Logique métier dans `backend/app/services/` ; nouvelles actions et conditions du moteur de règles (`gedrules_service`, `classification_rule_engine`) ajoutées comme extensions déclarées, pas par des `if` spécifiques dans le moteur. Côté front, appels HTTP via `frontend/services/resources/*.api.ts`, jamais `fetch` direct dans un composant. |
| **A — Agnostic** | Stockage via la **factory** `backend/app/services/storage/` (local / S3 / MinIO) ; OCR derrière son adaptateur ; aucune URL, bucket, base ou tenant codé en dur (config / env). Le core (domain) n'importe ni ORM ni infra (ports/adapters, cf. moteur de classification). Scripts et outils compatibles Windows **et** Linux. |
| **I — Idempotent** | Migrations Alembic rejouables (`alembic upgrade head` deux fois = no-op) ; seeds et imports en *upsert* sur clé naturelle (pas de doublon au retry) ; ingestion de dossiers et rangement local : relancer sur la même source ne recrée ni document ni dossier. |
| **D — Durable** | Schémas Pydantic, routes `/api/v1` et contrat `LocalWriteResult` = contrats publics : rupture seulement versionnée et documentée. Une feature n'est pas terminée si seuls ses nouveaux tests passent : pytest backend + build/tests front + e2e du parcours touché restent verts. |
| **Failure memory** | Incident ou near miss significatif → entrée dans `DOCS/engineering/lessons-learned.md` avec cause racine **et** prévention vérifiable (test, garde, règle CI). `tasks/lessons.md` garde les notes de conception. |
| **E — Engineering-grade** | Isolation `tenant_id` sur toute requête ; moindre privilège (RBAC par profil) ; secrets et JWT/OTP jamais journalisés ; erreurs actionnables (`pushApiError` / `pushClientOperationError`). **Reuse-first** : avant une brique non triviale, chercher l'existant (packages, OSS, `EagleFox31/appfactory-project-automation`) et noter Adopt / Adapt / Learn / Build dans le walkthrough. |
| **Scoped execution** | La CI ne lance que les gates des surfaces touchées, selon `.github/appfactory-impact.json` (Impact-Aware CI d'`appfactory-project-automation`). Les fichiers transversaux (`.github/**`, `scripts/**`, `.pre-commit-config.yaml`, `.gitattributes`) déclenchent toutes les surfaces ; un lockfile déclenche sa stack, l'audit de dépendances et le scan d'image ; un chemin inconnu déclenche tout. Gitleaks et `Tracked files` portent sur tout le dépôt et tournent toujours. |
| **R — Retroactive** | Toute évolution s'applique aux tenants et documents **existants** : migration de données explicite, aucun reset destructif, rien n'est modifié hors du périmètre possédé par la fonctionnalité. |

## Écarts connus (dérogations à résorber)

| Écart | Principe | Action prévue |
|---|---|---|
| Pas de board GitHub Project synchronisé. | Reuse-first | Évaluer `reusable-project-automation.yml` (`.github/project-config.json`). |

## Definition of Done RAIDER

S'ajoute à la DoD de [`.agents/AGENTS.md`](.agents/AGENTS.md) (tests unitaires,
intégration, contrat, e2e). Dans le walkthrough `DONE` ou la PR, indiquer brièvement
pour chaque item : couvert, non applicable (pourquoi), ou dérogation documentée.

- [ ] Reusable · [ ] Agnostic · [ ] Idempotent · [ ] Durable
- [ ] Failure memory · [ ] Engineering-grade · [ ] Scoped execution
- [ ] Reuse-first · [ ] Retroactive
