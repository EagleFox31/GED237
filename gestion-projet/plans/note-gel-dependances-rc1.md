# Gel des dépendances jusqu'à la démo — note pour les notes v1.0.0-rc.1

Rôle : innovateur, 2026-11-16. À verser telle quelle dans `CHANGELOG.md` / notes rc.1.

**Décision de gel** (orchestrateur, annoncée au PO le 16/11 sans objection). Les mises à jour de dépendances proposées par Dependabot (#110 image Python 3.11 → 3.15, #111 groupe Python de 25 paquets, #112 pytest 8 → 9, #113 starlette 0.48 → 1.10, ainsi que les anciennes #29 typescript 5.8 → 7.0, #30 eslint 8 → 10, #56 groupe npm) ne sont **pas fusionnées avant la démo du 30/11**. Aucune n'est un correctif de sécurité bloquant connu à ce jour.

**Pourquoi.** Chacune change de version majeure d'une brique de la pile validée (langage, framework web, outils de test, compilateur) ; la pile rc.1 est celle qui a passé la recette du 20 au 23, et un changement de socle après le gel invaliderait ces preuves sans temps pour les rejouer (DEC-2026-001).

**Ce que cela veut dire.** Les PR restent ouvertes et sont reprises après la démo, une à la fois, avec la suite de tests et la recette concernée. Un correctif de sécurité avéré reste traité à part, sur décision de l'orchestrateur.

**Écart à annoncer au jury.** Dépendances épinglées à leur version du gel ; mises à jour planifiées après le 30/11.
