# Plan V1.2 — ébauche

- **Pour** O, puis le PO. Innovateur, 17/11/2026. Ébauche : les chiffres sont `Déduit` sauf mention contraire, et B, F et Q les remplaceront.
- **Périmètre** :
  - les tickets étiquetés `v1.2` (relevés par `gh` le 17/11) ;
  - les points notés « V1.2 » dans les specs V1.1 (`specs-*.md`) et dans `plan-v1.1.md`.
- **Ce que la V1.2 n'est pas** : un rattrapage de la V1.1. Si une sortie de dernière minute quitte la V1.1 (par exemple #278 ou le lot 8b), elle vient s'ajouter ici en tête.
- **Sorties de la V1.1 du 17/11** : la phase 2 de #288 et le serveur e-mail à l'écran (éléments 15 et 16), à mettre en tête de la V1.2.
- **Refus en V1.1 du 17/11** : la surcouche P8 (élément 17, B 0,25), décision de O.
- **Sortie de la V1.1 du 18/11** : le glisser-déposer de #151 (élément 18, #299), décision de O. #278 sort aussi (élément 19, décision de O) : il passe en tête de la V1.2, avant l'élément 10 qui en dépend.
- **Ajout du 18/11** : « comme Windows », éléments 20 à 23 (≈ 7 h-s), détail dans `spec-windows-feel-v1.2.md`.
- **Décision du PO du 18/11** : les éléments 20 à 23 entrent en V1.2 (+7 h-s, total ≈ 38,25). F commence par l'élément 21 (application installable), en brouillon.
- **Réévaluation de #113 du 18/11** (élément 3) : B 0,5 → 2 h-s, Q 0,25 → 0,5. Total ≈ 40 h-s (B 14,25, Q 11,75).
- **Réponses du PO du 18/11 au matin** (`decisions-po-en-attente.md`) :
  - question 2 = B : les droits par institution (élément 13) entrent en V1.2, sans changer le total, déjà compté ;
  - question 1 = B (confirmée par le PO via O) : les alertes de qualité (élément 9) restent en V1.2, sans changer le total, déjà compté. Un seul rebasage, en début de cycle, après l'étiquette V1.1 du 07/12.

## Les éléments

| # | Élément | Valeur pour l'utilisateur, en une ligne | B | F | Q | Dépend de |
|---|---|---|---|---|---|---|
| 1 | **#265** : supprimer la table `org_unit_closure`, inutilisée | aucune visible : moins de code mort, des migrations plus sûres | 0,5 (migration) | — | 0,25 | arbre des unités par `parent_id` (#266, V1.1). **Départ après la fusion de #203 et #266**, depuis `main`, avec `count(*) = 0` vérifié sur chaque base : sur `main` actuel, trois services lisent encore la table |
| 2 | **#279 et #281** : déprécier `GET /documents/tree` au profit de `/spaces/tree` | aucune visible : une seule façon de parcourir les dossiers | 0,25 | — (F vérifie que l'écran n'appelle plus l'ancienne route) | 0,25 | — ; la suppression de la route se fera plus tard, après un cycle de dépréciation |
| 3 | **#113** : Starlette 1.x, avec FastAPI ≥ 0.133 et Pydantic ≥ 2.7 dans le même brouillon (réévalué le 18/11) | aucune visible : rester sur une version maintenue | 2 (Starlette 1.x impose FastAPI ≥ 0.133, qui impose Pydantic ≥ 2.7) | — | 0,5 (sans jeton, les tests passent de 403 à 401 : toute la suite est à relire) | montée de Pydantic dans le même brouillon |
| 4 | **#110** : image Python 3.15 | aucune visible : sécurité et performances de la base logicielle | 0,5 | — | 0,25 | paquets compilés disponibles en 3.15 (asyncpg, OCR) |
| 5 | **TypeScript 6.0, version pont vers 7** (#29 reste ouverte pour la 7) ; décision de O du 18/11 | aucune visible : se rapprocher de la 7 sans casser les contrôles | — | 0,5 | 0,25 | 6 conseillé avant. La 7 est bloquée : typescript-eslint 8.73 s'arrête à TypeScript 6.0 (vérifié sur npm le 18/11). Passage à la 7 en suivi, sans coût tant que typescript-eslint ne suit pas |
| 6 | **ESLint 9 en configuration « flat » avec airbnb-extended, étape vers 10** (#30 reste ouverte pour la 10) ; décision de O du 18/11 | aucune visible : outillage à jour | — | 0,5 | 0,25 | La 10 est bloquée : airbnb-extended et les extensions react, jsx-a11y et import s'arrêtent à ESLint 9 (vérifié sur npm le 18/11). Passage à la 10 en suivi, sans coût tant qu'elles ne suivent pas |
| 7 | **#254, partie 13 a)** : lecteur désigné hors circuit | un agent peut donner à lire un document à une personne précise d'un autre service, sans lancer de circuit | 1,5 (table et migration) | 1 (écran de désignation) | 0,5 | partie V1.1 de #254 (accès par l'étape de circuit) |
| 8 | **Versions** : restaurer une ancienne version, comparer deux versions | l'agent revient en arrière après une erreur sans redéposer le fichier, et voit ce qui a changé | 1,25 | 1,75 | 0,75 | #275 (V1.1) |
| 9 | **#183 → #194** : alertes de qualité et onglet « Qualité » des rapports | la direction est prévenue quand le classement ou les délais se dégradent | 1 (confirmé par B : rebasage de ≈ 3 800 lignes, corrections, CI) | 0,5 (rebasage de #194, empilée sur #183) | 2,5 (chiffre du plan V1.1) | #162 ; à rebaser sur `main` V1.1 |
| 10 | **Tableaux de bord** des autres rôles, avec l'évolution dans le temps | chacun voit son activité et la tendance, pas seulement un chiffre du jour | 1 (séries dans le temps) | 1,5 | 0,5 | #278 (élément 19) |
| 11 | **« Mon équipe » au-delà des N-1** : N-2 et plus, dépliables | un directeur voit toute sa branche, pas seulement ses chefs de service | 0,5 (profondeur et contrôle du périmètre en cascade) | 0,5 | 0,25 | #277 (PR #285) |
| 12 | **Organigramme graphique** de l'institution | l'administrateur vérifie d'un coup d'œil qui rend compte à qui | 0,5 (route d'arbre complet) | 1,5 | 0,5 | 11 |
| 13 | **Droits propres à chaque institution** | une institution règle ses droits sans toucher aux autres | 2,5 (domaine par institution dans le modèle de droits, migration de `casbin_rule`) | 1 (grille par institution, modifiable par son administrateur) | 1,5 (tests par rôle et par institution) | lot 8b et passage en `sql` (V1.1). **Demandé par le PO le 18/11 (question 2 = B).** |
| 14 | **Annuler pendant 5 s** après « Mettre à la corbeille » | rattraper un clic malheureux sans aller dans la corbeille | — | 0,25 | 0,25 | #181. **Seulement si F le sort de la V1.1** (écart 1 de `specs-corbeille-181.md`). |
| 15 | **#288, phase 2** : accès public en HTTPS sur le VPS (production, site du proxy, nom de domaine, contrôle HTTPS) ; sortie de la V1.1 le 17/11 | les agents se connectent sans VPN | 0,5 | — | 0,25 | #154 et #212 ; phase 1 de #288. **Revient en V1.1 si #154 et #212 sont fusionnés avant le 01/12.** |
| 16 | **Serveur e-mail à l'écran** (partie du lot 8a), sorti de la V1.1 le 17/11 | l'administrateur change le serveur d'envoi sans intervention technique | 0,5 | — | — | #154 ; en attendant, le réglage reste dans le fichier d'environnement |
| 17 | **Surcouche P8 : bordereaux classés d'office**, refusée en V1.1 le 17/11 (pas d'ajout sans sortie équivalente) | les 2 bordereaux du jeu de démonstration ne tombent plus dans la bannette « à revoir » | 0,25 | — | — | jeu P8 ; `scenario-demo-30-11.md` § 10 |
| 18 | **#299 : glisser-déposer un document sur un dossier = reclassement**, partie de #151 sortie de la V1.1 le 18/11 | l'agent range un document en le faisant glisser, avec les mêmes règles et la même trace que « Classer » | — (la trace vient de #179 et #262, en V1.1) | 1 (gestionnaires natifs, sans nouvelle bibliothèque ; le dépôt ouvre « Classer » pré-rempli) | 0,5 (e2e du glisser-déposer, refus sans droit) | #179, #262 et la boîte « Classer » (V1.1) |
| 19 | **#278 : tableau de bord du manager et détail d'un modèle de règle**, sorti de la V1.1 le 18/11 (règle « pas d'ajout sans sortie », pour #300). Code écrit, PR #298 conservée en brouillon, à relire en début de V1.2 | le manager voit l'activité de ses services sur son accueil | — | 0,5 (rebasage et corrections après relecture) | 0,5 | #203 (V1.1) ; avant l'élément 10 |
| 20 | **Glisser des fichiers depuis l'Explorateur Windows** sur un dossier : l'import s'ouvre, destination pré-remplie (`spec-windows-feel-v1.2.md`) | l'agent dépose ses fichiers comme dans Windows | — | 1 | 0,5 | 18 (mêmes gestionnaires de l'arbre, à faire à la suite) |
| 21 | **Application installable** : fenêtre propre, icône dans la barre des tâches (manifeste, sans bibliothèque) | GED237 s'ouvre comme un logiciel du poste | — | 0,5 | 0,25 | HTTPS ; élément 15 pour les postes autres que celui de démo |
| 22 | **Vue « Détails »** : colonnes triables et redimensionnables, choix de vue retenu, bouton « dossier parent » | l'agent trie et lit ses dossiers comme dans l'Explorateur | 0,5 (tri côté serveur, liste blanche) | 1,25 | 0,5 | — |
| 23 | **Notifications Windows** pour les visas, les rejets et les revues, quand l'application est ouverte (WebSocket existant, pas de Web Push) | l'agent est prévenu sans rester sur la page | 1 (envoi en direct, événement de fin de circuit, revues regroupées) | 0,75 | 0,75 | circuit de validation (V1.0) |

## Total

| | B | F | Q | Total |
|---|---|---|---|---|
| Socle technique (1 à 6) | 3,25 | 1 | 1,75 | 6 |
| Sorties et refus de la V1.1 (15 à 19) | 1,25 | 1,5 | 1,25 | 4 |
| Valeur pour l'agent (7, 8, 14) | 2,75 | 3 | 1,5 | 7,25 |
| Pilotage (9, 10) | 2 | 2 | 3 | 7 |
| Hiérarchie (11, 12) | 1 | 2 | 0,75 | 3,75 |
| Droits par institution (13) | 2,5 | 1 | 1,5 | 5 |
| Comme Windows (20 à 23) | 1,5 | 3,5 | 2 | 7 |
| **Total** | **14,25** | **14** | **11,75** | **≈ 40** |

Le total passe de ≈ 38,25 à ≈ 40 h-s le 18/11 : #113 (élément 3) coûte 1,5 h-s de plus à B et 0,25 à Q. La règle « pas d'ajout sans sortie équivalente » vaut pour la V1.1, pas pour la V1.2 : cette hausse ne demande donc pas de sortie.

B devient la plus chargée (14,25 h-s), juste devant F (14 h-s). Les éléments 20 à 23 de F se décalent sans gêner les autres, car seul le 23 touche le serveur. Q reste le goulot des relectures, comme en V1.1. Le pilotage (9) pèse à lui seul 2,5 h-s de Q, et les droits par institution (13) en pèsent 1,5. Ce sont les deux leviers de la V1.2.

## Ordre proposé

1. **Socle (1 à 6), en début de cycle**, juste après le rebasage de 9 (point 3), quand la branche principale est calme. Les montées de version passent avant les fonctions, pour ne pas rebaser les fonctions deux fois. Ordre : #265, #281, #113, #110, puis ESLint 9 (6) et TypeScript 6.0 (5).
   **#278 (élément 19)** se relit aussi en début de cycle, avant l’élément 10 : son code est écrit (PR #298, en brouillon).
2. **Valeur pour l'agent (7, 8, 14)** : ce que les agents utilisent chaque jour.
3. **Pilotage (9, 10)** : le PO garde 9 (question 1 = B). **#183 se dégrade chaque semaine** (≈ 3 800 lignes de retard sur `main`) : il passe en tête du pilotage et se rebase **une seule fois**, juste après l'étiquette V1.1 du 07/12, en tout début de cycle. Il fusionne avant ESLint 9 et TypeScript 6.0 (6 et 5), qui touchent tout le frontend, sinon il faudrait le rebaser une seconde fois. 10 suit, après #298.
4. **Hiérarchie (11, puis 12)**.
   **Comme Windows (20 à 23)**, demandé le 18/11 : 21, puis 22, puis 18 et 20 ensemble, puis 23. F en porte la moitié (3,5 h-s), en parallèle de 13, qui pèse surtout sur B.
5. **Droits par institution (13)** : demandé par le PO le 18/11, il est remonté dans l'ordre (voir ci-dessous).

### Place de l'élément 13 (révision du 18/11)

C'est l'élément le plus risqué : il change le modèle de droits de toute la plateforme. Aujourd'hui, `model.conf` vérifie (rôle, ressource, action), sans institution. Proposition :

- **Juste après le socle (1 à 6), avant 7 et 11.**
  - Plus tôt est impossible : il dépend du lot 8b et du passage en `sql` (V1.1), et le socle doit passer d'abord pour éviter un double rebasage.
  - Plus tard coûterait plus : 7 (lecteur désigné) et 11 (périmètre en cascade) ajoutent des règles de droits. Faites après 13, elles s'écrivent directement dans le nouveau modèle, au lieu d'être migrées une seconde fois.
  - Un problème découvert tôt laisse le temps de corriger, ou de reporter 13 sans rien casser.
- **Migration additive, sans rupture.**
  - Les règles actuelles deviennent les règles communes, valables pour toutes les institutions.
  - Une institution ne fait qu'ajouter des surcharges.
  - Sans surcharge, rien ne change. Le retour arrière consiste à supprimer les surcharges.
  - Q le prouve par un test de non-régression : toutes les vérifications de droits existantes donnent le même résultat avant et après la migration.
- **Ne pas empiler Q.** 9 (Q 2,5) et 13 (Q 1,5) sont les deux plus grosses relectures. 9 occupe Q en tout début de cycle, puis viennent les relectures du socle, puis 13 : jamais deux grosses relectures en parallèle.
- **F n'est pas bloquée.** 13 pèse surtout sur B (2,5) ; pendant ce temps, F avance sur 21, 22, 18 et 20. La grille de 13 côté F (1) vient en dernier, une fois le contrat du serveur posé.

Ordre révisé : étiquette V1.1 (07/12) → rebasage et relecture de 9 → socle (1 à 6) et relecture de #298 (19) → **13** → 7, 8, 14 → 10 → 11, puis 12. Les éléments 20 à 23 de F avancent en parallèle.

## Questions au PO (deux) : réponses du 18/11

- Question 1 : B, confirmée par le PO via O (« A- oui prévenir » était ambigu) ; l'élément 9 reste en V1.2.
- Question 2 : oui (B), l'élément 13 entre en V1.2.

Texte d'origine :

1. **Alertes de qualité (#183 et #194)** : les voulez-vous toujours ?
   - Si oui, on les met en tête de la V1.2, car leur retard grossit chaque semaine.
   - Si non, on ferme les deux PR et on garde l'idée pour plus tard. Gain ≈ 4 h-s, dont 2,5 de Q.
2. **Droits propres à chaque institution** : une institution vous a-t-elle demandé des droits différents des autres ?
   - Si non, on ne le fait pas : les droits restent communs et réglés par l'administrateur de la plateforme. Gain ≈ 5 h-s, dont 1,5 de Q.
   - Si oui, dites laquelle et pour quel rôle : on vise juste.
