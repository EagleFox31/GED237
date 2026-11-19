# DEC-2026-010 — La coupe de `release/v1.0.0` attend 95 % du CDC prouvés

- **Statut** : BROUILLON, préparé par l'innovateur le 19/11 à la demande d'O. O le publie après avoir rempli les champs `‹…›`. Le numéro 009 est réservé à la DEC des leçons (une leçon par fichier).
- **Décideurs** : le PO pour le critère et l'heure de la coupe (19/11) et pour l'item 8 (§ 4) ; O pour l'exécution.
- **Modifie** : DEC-2026-005, § 1.1 (point de coupe) et § 1.2 (périmètre).
- **Historique** : le 19/11 au matin, le PO avait décidé de couper dès la fusion de #464, puis de reporter la vue des doublons dans la candidate. Il a remplacé cette décision le même jour : pas de coupe avant 95 % prouvés. Rien n'avait été créé (ni branche `release`, ni ruleset). L'approche par PR de report est abandonnée.
- **Sources** : `couverture-95-19-11.md`, `plan-fusion-v1.1.md` § 1 bis, `file-v1.1.md`.

## 1. Décision

1. **Pas de coupe avant que 95 % du CDC soient prouvés**, soit 30,5 points sur 32, par la méthode du 10/11 (32 items à poids égal, `fait` = 1, `partiel` = 0,5). Le dénominateur ne change pas. `release/v1.0.0` est créée sur `main` dès que le score atteint 30,5.
   - Point de coupe : `‹sha court›`, le `‹date hh:mm›`, score `‹30,5 ou plus›/32`.
2. **La vue des doublons (#152, #181, #171, #199) et #104 fusionnent dans `main` avant la coupe.** Il n'y a ni gel de `main`, ni PR de report.
   - **Exception à la règle du brouillon** : O sort ces 4 PR du brouillon au moment de leur passage. Les autres PR V1.1 restent en brouillon jusqu'au 24/11.
3. **La recette du 20 au 23/11 se fait sur `main`**, avec un état du jour connu (§ 3).
4. **Échéances liées à la coupe**, sur signal d'O : push de #104, DEC-2026-004, DEC-2026-009.

## 2. Ce qu'il faut pour 95 %

Au 19/11 : **28/32**. #464 est fusionnée, `main` = 103ce48b, et l'item 27 (HTTPS) a été prouvé le 19/11 par Q sur 103ce48b, avec le créneau Docker prêté par aide-api.

| Item du CDC | Gain | Preuve attendue | Porteur | Date | Risque |
|---|---|---|---|---|---|
| 27. HTTPS | +0,5 | `prove_tls` réussi | Q | **fait le 19/11** | — |
| 19. Détection des doublons | +0,5 | #152, #181, #171 et #199 fusionnées dans `main` | B, F, Q, O | `‹date›` | moyen : ≈ 4 h-s, 2 PR à remettre à jour |
| 29. Disponibilité ≥ 99 % | +0,5 (`partiel` au mieux) | relevé C6 tenu à 18:00 (≥ 6 relevés verts consécutifs) | Q | 19/11, 18:00 | **élevé** : trou de nuit, puis arrêt de Docker ce matin |
| 28. Déploiement sur site | +1 | installation sans Internet réussie (réponse 15 du PO) | Q | 25/11, avançable : `‹date›`, dès que les conditions du § 2 bis sont remplies | moyen |
| 31. Documentation | +0,5 | rejeu du manuel sans écart (issue #273) | Q | même passage que l'item 28 | moyen |

28 + 0,5 (19) + 0,5 (29) + 1 (28) + 0,5 (31) = 30,5. Il n'y a **aucune marge** : si C6 échoue ce soir, le meilleur score est 30/32, et seul l'item 8 permet d'atteindre 95 % (§ 4).

### 2 bis. Avancer les items 28 et 31 avant le 25/11 (instruction du 19/11)

Le PO a demandé le 19/11 d'avancer 28 et 31 « au maximum ». Les deux items se prouvent en un seul passage de Q, d'environ **2,5 h-s** (check-list d'installation et annexe A du protocole hors ligne). Trois conditions bloquent :

1. **La référence installée.** La check-list d'installation part d'un tag posé sur `release/v1.0.0`, et cette branche n'est coupée qu'à 30,5/32 : c'est circulaire. Le protocole hors ligne (annexe A1) prévoit déjà un repli : « le SHA de `main`, noté avec la raison ». O écrit ici que la référence est le SHA du matin : `‹sha›`.
2. **Le manuel.** `DOCS/exploitation/installation.md` cite encore `v1.0.0-rc.1` et `release/v1.0.0`. Rejoué tel quel sur un SHA de `main`, il donnerait un écart, et l'item 31 échouerait. Une PR de doc d'environ 0,25 h-s le rend valable « pour un tag ou un SHA ». Porteur : aide-api ou un pair libre (l'innovateur ne code pas l'application, mais cette PR ne touche que la doc).
3. **La machine.** La machine simulée demande 7 Go, plus 2 Go de marge, sans aucune autre charge Docker (annexe A). Il y a environ 8,5 Go disponibles sur 12 : il faut donc une fenêtre où F, B et aide-api arrêtent tous Docker. Disque : 20 Go demandés, 21 Go libres, ce qui est juste. O fixe la fenêtre : `‹date hh:mm›`.

Rien d'autre ne bloque. #248, #267 et #268 (VPS) ne sont pas requis. Les scripts de preuve sont sur `main`.

**État au 19/11 dans la matinée (O)** :
- Le PO accepte que le lab sans réseau de Q sur cette machine (Docker-in-Docker, images de `main` 103ce48b) vaille preuve de l'item 28. Il n'y a pas de deuxième machine avant le 25.
- #470 rend le manuel valable pour « un tag ou un SHA ».
- Le lab a trouvé un échec bloquant : `images_import.sh` échoue sur un poste cible en overlay2, car les identifiants d'image diffèrent de ceux du magasin containerd. Q prépare le correctif en PR. L'item 28 ne compte qu'après la fusion de ce correctif et un rejeu jusqu'à `/health`.
- Item 19 : #171 a deux bloquants relevés par Q, chez B en priorité. La règle de la corbeille est contournée dans `/duplicates/resolve`, et la visibilité pour `unit_admin` est à revoir.

## 3. Recette sur `main` : un état du jour

Chaque matin, O retient le dernier commit de `main` dont la CI est verte. La pile de recette est construite et migrée sur ce commit (`alembic upgrade head`). Le SHA est noté dans le journal de recette, et chaque constat des testeurs le cite. Aucune branche n'est créée et aucune fusion n'est bloquée. Détail et risques : `plan-fusion-v1.1.md` § 1 quater.

## 4. À trancher par le PO : l'item 8 (100 000 fichiers en moins de 20 minutes)

| Option | Effet sur les 95 % | Coût |
|---|---|---|
| **a. Hors 1.0, mesure en décembre** (statu quo, #270) | aucune marge : les 4 conditions restantes du § 2 doivent toutes réussir | aucun maintenant |
| **b. Mesure faite maintenant, en réserve** | +1 si la mesure passe (improbable), +0,5 si elle est `partielle` sans perte de fichier : ce +0,5 remplace celui de C6 | ≈ **4 h-s** (générateur 1,5, exécution 1,5, analyse 1), plus le temps machine. Porteurs : aide-api pour le générateur, Q ou aide-api pour l'exécution, chacun sur son créneau Docker |
| **c. Item 8 retiré du CDC de la 1.0** | change le dénominateur (31 items), contraire à la règle de mesure | décision contractuelle |

Instruction de l'option b (19/11) :
- **À écrire** : `scripts/load_dataset.py`, absent de `main`, à partir du script du jeu de démo. Il produit un corpus d'environ 7 Go. Le protocole est celui de #166 : 10 lots de 10 000 fichiers par `ingest-directory`, sans OCR. On réutilise `measure_lib.py`, `measure_c2.py` et `measure_c3.py`.
- **Bloquant** : le disque. Il faut 25 Go libres, et il y en a 21. Si l'item 28 passe avant, sa machine simulée doit d'abord être libérée.
- **Risque élevé sur les 20 minutes** : le seul ordre de grandeur connu (seed de démo : 408 documents en 26 à 32 s) donne 13 à 16 fichiers/s, contre 84 requis, soit 1 h 45 à 2 h pour 100 000 fichiers. L'API est plafonnée à 1 Go et ne sait pas reprendre un import interrompu. Le « fait » est donc improbable, le « partiel » est atteignable.

**Mise à jour du 19/11 (deuxième instruction, demande du PO de le faire aujourd'hui)** : protocole réduit et corrigé, porté par aide-api.
- **Correction de #166.** `ingest-directory` ne classe rien dans la requête : le classement se fait dans le worker, pour les PDF et les images (B doit le confirmer). La mesure ajoute donc un worker et arrête le chrono quand plus aucun document n'est `pending`.
- **Jeu de données.** 100 000 PDF texte de 1 à 4 Ko, sans OCR, dans un volume Docker. Le disque monte à environ 2,5 Go au pic au lieu de 7 Go. Un lot témoin de 1 000 fichiers est fait à la taille prévue par #166.
- **Déroulé.** Étalonnage sur 2 000 fichiers, puis M1, M2 et M6. L'essai à 100 000 se lance après le démontage du lab de Q.
- **Coût.** Environ 3 h-s, plus 20 min à 2 h de machine.
- **Écarts à #166 à faire valider par le PO** : la taille des fichiers et le classement par le worker.

**Décision du PO (19/11, via O) : option b, aujourd'hui.** Ses termes : « Oui, petits PDF ». Le test porte sur 100 000 PDF texte de 1 à 4 Ko, et le chrono s'arrête quand tout est importé et classé.
- « Classé » s'entend comme « passé par le classement » : le texte est extrait, puis les règles sont appliquées. Un document qui ne correspond à aucune règle reste `pending` par construction.
- Critère d'arrêt retenu : le nombre de documents avec un moteur d'extraction, plus les échecs, égale le nombre importé, et la file du worker est vide. La répartition classified, pending et needs_review est publiée. Tout échec compte comme une perte.
- Plafond de 2 h 30. Porteur : aide-api. L'essai complet a lieu après le démontage du lab de Q.

Écart produit relevé pendant l'instruction et confirmé par B : `ingest-directory` ne classe jamais les DOCX, XLSX, TXT ni CSV (ils restent `pending`). Signalé à O pour qu'il ouvre une issue et désigne un porteur.

**Lab à plusieurs postes en réseau (PO, 19/11) : « Après les preuves ».** Il se fait une fois les items 28, 8 et 29 traités, ce soir ou demain matin. Il ne rapporte aucun point au barème et renforce les preuves des items 16, 27 et 28.

Recommandation de l'innovateur, avant la décision : **b si C6 échoue ce soir, a sinon**. Dans les deux cas, la passe des items 28 et 31 (§ 2 bis) vient d'abord : elle rapporte +1,5 pour 2,5 h-s. O présente les options au PO après le relevé de 18:00. Décision du PO : `‹a / b / c›`, le `‹date›`.

## 5. Réversibilité

- Tant que la coupe n'a pas eu lieu, rien n'est à défaire : `main` reste la seule branche.
- Si l'une des preuves échoue, la coupe attend sa reprise ou l'item 8. Le score est recompté dans `couverture-95-19-11.md` après chaque preuve.
