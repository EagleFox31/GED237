## Résumé

Décrire le changement et pourquoi il est nécessaire. Lien vers le walkthrough.

## Validation

- [ ] tests pertinents verts (unitaires, intégration, contrat, e2e pour un parcours critique)
- [ ] `alembic upgrade head` appliqué et rejoué (no-op) si migration
- [ ] documentation / exemples de config à jour si le comportement public change

## RAIDER review

- [ ] **Reusable** — pas de fork ni de copier-coller spécifique à un consumer
- [ ] **Agnostic** — dépôt, branche, stack, tenant, stockage et environnement découverts ou configurés
- [ ] **Idempotent** — retries et réexécutions convergent sans doublon quand un état est modifié
- [ ] **Durable / Non-regressive** — le comportement existant reste couvert et vert
- [ ] **Failure memory** — échecs / near misses significatifs consignés dans `DOCS/engineering/lessons-learned.md` (cause, résolution, prévention)
- [ ] **Engineering-grade** — responsabilités, permissions, contrats, tests et erreurs au niveau attendu
- [ ] **Reuse-first** — pour un travail non trivial, l'existant a été évalué et la décision Adopt / Adapt / Learn / Build est justifiée
- [ ] **Retroactive** — tenants et données existants adoptent le changement sans reset destructif

Si un item RAIDER ne s'applique pas ou ne peut pas être satisfait, l'expliquer ici.
