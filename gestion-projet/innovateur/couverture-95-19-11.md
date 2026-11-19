# Couverture CDC au 19/11/2026 — seuil « 95 % des fonctionnalités »

- Base : `origin/main` 3fabddc5 (19/11 08:21, après #461). Mesure seulement, aucune décision.
- Méthode du 10/11 inchangée : 32 items à poids égal, `fait` = 1, `partiel` = 0,5, `absent` / `non vérifiable` = 0. Un item est `fait` seulement sur une preuve fusionnée sur main ou citée par sa PR. Grille identique au relevé préliminaire du 17/11 (#104) et au recalcul du 18/11 10:54.
- Seuil : 95 % = 30,4/32. Il faut donc **30,5 points**, car les notes vont par demi-points.
- Niveaux : `Vérifié` = lu (liste des fusions, `git ls-tree origin/main`, `gh pr view`, passations) ; `Déduit` = supposé. Dans la colonne « Chgt 10/11 », seuls les statuts qui ont changé depuis le 10/11 sont marqués.

## 1. Taux

| Mesure | 10/11 (main d34d51b) | **19/11 (main 3fabddc5)** | Avec toutes les PR ouvertes citées | Avec PR + preuves hors PR prévues |
|---|---|---|---|---|
| fait / partiel / absent | 18 / 6 / 8 | **26 / 3 / 3** | 27 / 2 / 3 | 30 / 1 / 1 |
| Points | 21 | **27,5** | 28 | 30,5 |
| **Taux** | 65,6 % | **85,9 %** | **87,5 %** | **95,3 %** (sans aucune marge) |

## 2. Les 32 items

| # | Item | État | Note main 19/11 | Si PR fusionnent | Preuve / PR | Chgt 10/11 |
|---|---|---|---|---|---|---|
| 1 | Tri auto par règles (type, nom, date, contenu) | main | fait | fait | #92, #95 (critères contenu OCR et année, 14/11) | partiel → fait, `Vérifié` |
| 2 | ≥ 95 % de documents classés | main | fait | fait | `gestion-projet/recette/c2-2026-11-10.txt` sur main (357/357), #64 | nv → fait, `Vérifié` |
| 3 | Priorité des règles + simulation | main | fait | fait | audit 09/11, `/simulate` | — |
| 4 | Arborescence service > domaine > activité > année | main | fait | fait | `space_path_builder.py` | — |
| 5 | Espaces : filtres + pagination serveur | main | fait | fait | #38 (API), #78 (écran, fusionné 10/11) | partiel → fait, `Vérifié` |
| 6 | Upload manuel | main | fait | fait | audit 09/11 | — |
| 7 | Surveillance automatique d'un dossier | main | fait | fait | #101, #100 ; `services/ingest_watch.py`, `test_ingest_watch.py` | partiel → fait, `Vérifié` |
| 8 | 100 000 fichiers en < 20 min | pas commencé | absent | absent | aucune mesure ; #166 (protocole, docs) ne mesure rien | — |
| 9 | Authentification + rôles | main | fait | fait | #83, #88, #140 | — |
| 10 | Droits stricts par rôle et service | main | fait | fait | #42, #46, #47 (+ #203, #358, #360) | — |
| 11 | Journal des actions | main | fait | fait | #80, #98 | — |
| 12 | Tags | main | fait (minimal) | fait | audit 09/11 | — |
| 13 | Recherche avancée | main | fait | fait | #42, #258 | — |
| 14 | Recherche < 2 s | main | fait | fait | `gestion-projet/recette/c3-2026-11-10.txt` sur main (p95 27 ms) | nv → fait, `Vérifié` |
| 15 | OCR | main | fait | fait | audit 09/11 ; #350, #368 | — |
| 16 | Multi-lecture + verrouillage d'édition | main | fait | fait | audit 09/11 | — |
| 17 | Versionnage | main | fait | fait | audit 09/11 | — |
| 18 | Corbeille applicative | main | fait | fait | audit 09/11 | — |
| 19 | Détection des doublons | PR ouverte | **partiel** | **fait** | blocage + tuile #99 sur main ; vue doublons : #171 (API) + #199 (écran), avec #152 et #181 avant | — |
| 20 | Tableau de bord (doublons, non classés, activité) | main | fait | fait | #77, #81 | partiel → fait, `Vérifié` |
| 21 | Export / import des règles | main | fait | fait | #79, #84, #91 | absent → fait, `Vérifié` |
| 22 | Workflows de validation / visa | main | fait | fait | audit 09/11 ; #127 | — |
| 23 | Rapports (manager) | main | fait | fait | audit 09/11 ; #175, #188 | — |
| 24 | Interface responsive | main | fait | fait | #89 `uat/responsive.spec.ts`, #93 ; rapport mobile vert non retrouvé | nv → fait, `Déduit` |
| 25 | Interface en français | main | fait | fait | audit 09/11 | — |
| 26 | Limite de taille des fichiers | main | fait | fait | #52, #423 | — |
| 27 | HTTPS | main (partiel) | **partiel** | partiel | #109, #114 (profil nginx 443) ; la preuve `prove_tls` est prévue le 20/11 (Q) | absent → partiel, `Vérifié` |
| 28 | Déploiement on-site + démo VPS | PR ouverte (VPS) | **absent** | absent | #248 → #267, #268 (VPS) ne prouvent rien seules ; preuve retenue par le PO (réponse 15) : essai d'installation sans Internet du 25/11 | nv → absent (0 point dans les deux cas) |
| 29 | Disponibilité ≥ 99 % | main (outillage) | **absent** | absent | sonde #106, #117, #142 ; #147 (`/health/ready`) = 0 point ; relevé C6 attendu le 19 à 18:00 ; nuit du 19 : trou 03:29Z–06:45Z, puis arrêt de Docker (~06:45Z) (`Vérifié`, PASSATION-ci-qa) | — |
| 30 | Sauvegardes + restauration testée | main | fait | fait | #54, #61, #62 ; `restauration-2026-11-10.txt` | — |
| 31 | Docs utilisateur / admin / technique | main (partiel) | **partiel** | partiel | #105, #107, #115, #139, #408 ; rejeu réel du manuel par Q non fait (issue #273 : 25/11) | — |
| 32 | Front connecté à l'API | main | fait | fait | audit 09/11 | — |

## 3. PR pour atteindre 95 %

**95 % n'est pas atteignable avec les seules PR ouvertes** : le plafond est 28/32 = 87,5 %. Une seule PR fait bouger un item (19). Pour les items 27, 28, 29 et 31, il faut une preuve en exploitation, pas une fusion.

PR à fusionner pour l'item 19 (ordre ORDER, DEP inclus, fenêtre V1.1 à partir du 24/11) :

| Ordre | PR | Vague | DEP | Validée par Q (tête actuelle) |
|---|---|---|---|---|
| 1 | #152 corbeille (serveur) | V2, 1re | — | **oui** : OK Q sur a47df85d (17:11 18/11, `Vérifié`) ; **en conflit avec main** (`gh`, 19/11) |
| 2 | #181 écran Corbeille | V2, 2e | 152 | **oui** : OK Q sur 4e745ccd (19/11 07:24, `Vérifié`) ; **en conflit avec main** |
| 3 | #171 vue doublons (API) | V4 | 152 | **oui** : OK définitif sur 3198885 (CI verte, `Vérifié`) |
| 4 | #199 écran doublons | V4, après 171 | 181 171 | **oui** : OK sur cce7390 (« faux vide corrigé », `Vérifié`) |

Effort : plan-fusion-v1.1.md ne chiffre pas ces PR une à une. Elles sont dans le lot 1 de plan-v1.1 (≈ 17 h-s, dont Q 10) : **non chiffré** séparément.

Pour passer de 28 à 30,5, il faut **tous** les points ci-dessous (aucune marge) :

| Item | Gain | Ce qui manque | Planifié ? porteur | Effort (plan-fusion-v1.1) |
|---|---|---|---|---|
| 28 | +1 | essai d'installation sans Internet réussi le 25/11 (vaut preuve, réponse 15 du PO) | oui, Q, 25/11 | non chiffré (plan-v1.1 : lot 12 VPS ≈ 1,75 h-s, B 0,25 / Q 1,5, + #288 phase 1 B 0,75 / Q 0,25) |
| 27 | +0,5 | `prove_tls` passé (passage 2, 20/11) | oui, Q | non chiffré |
| 31 | +0,5 | rejeu du manuel sans écart (issue #273, 25/11) | oui, Q | non chiffré |
| 29 | +0,5 | C6 tenue à 18:00 aujourd'hui (≥ 6 relevés verts consécutifs) → `partiel` ; `fait` impossible dans cette version | oui, Q (sonde jusqu'au 19 18:00) | non chiffré ; **risque** : trou de nuit et arrêt de Docker ce matin |
| 8 | +1 | essai sur 100 000 documents | **non** : hors périmètre V1.1, « mesure de décembre » (#270, plan-v1.1 § hypothèses 6) | non chiffré |

Lecture : si C6 tombe à `absent`, le meilleur cas est 30/32 = 93,75 %. Le seul levier restant serait alors l'item 8, qui n'est pas planifié.

## 4. Temps de session restant pour 95 %

**Non chiffré** : plan-fusion-v1.1.md ne donne d'effort ni pour #152, #181, #171 et #199, ni pour les preuves des items 27, 28, 29 et 31. Pour information seulement, voici les ordres de grandeur de plan-v1.1 : lot 1 ≈ 17 h-s (toutes les capacités post-rc1, pas seulement l'item 19) ; lot 12 + #288 phase 1 ≈ 2,75 h-s. Calendrier : 95 % ne peut être constaté qu'après la fusion de #199 (vague 4, 30/11 au 02/12) et l'essai du 25/11.

## 4 bis. Conséquences sur le calendrier (constats, rien n'est décidé)

- **Coupe** : avec la règle des 95 %, la coupe ne peut pas avoir lieu le 19/11 à 18:00 (85,9 %). Au plus tôt, elle tombe après les preuves du 25/11 **et** après la fusion de #199. #199 est en vague 4 dans la file actuelle (30/11 au 02/12). Avancer la paire doublons (#152, #181, #171, #199) changerait cette date, mais c'est un choix d'ordre de la file, pour O et le PO.
- **Aucune marge** : 30,5 points pour un seuil de 30,4. Un seul échec (C6 ce soir, `prove_tls` le 20/11, installation sans Internet ou manuel le 25/11) et 95 % devient inatteignable dans cette version, puisque l'item 8 (100 000 documents) n'est pas planifié avant décembre.
- **Recette du 20 au 23/11** : elle porterait sur un `main` qui bouge encore, puisque les vagues 2 à 4 restent à fusionner. Ses résultats ne vaudraient pas pour l'état coupé.
- **Démo du 30/11** : la coupe tomberait le jour de la démo, ou après. La démo se ferait sur un état pas encore coupé.
- **DEC-2026-008** : les capacités valent jusqu'au 05/12. Une coupe vers le 02/12 laisse environ 3 jours de marge, sans aucun retard absorbable.
- **Échéances liées à « 18:00 »** :
  - le push unique de #104 après la coupe ;
  - le push de DEC-2026-004 à 18:40 ;
  - le passage des PR V1.1 hors brouillon ;
  - l'application de DEC-2026-009 (leçons).
  Ces échéances suivent la coupe : O doit dire si elles gardent 18:00 ou si elles suivent la nouvelle coupe.

## 5. Hors grille (sans changer le dénominateur)

Ces capacités figurent dans `MATRICE_TRACABILITE_PRODUIT.md` ou dans les PR, mais pas dans les 32 items. Leur rattachement au CDC n'a pas été vérifié dans le document source (`Déduit`) :
- notifications en temps réel sur plusieurs instances (#155) ;
- canal d'envoi du code OTP par e-mail et renvoi du code (#154), TOTP pour les administrateurs (#193, #219) ;
- rapport officiel en PDF et rapports programmés (#197, #180, #209) ;
- favoris, récents et partagés (#165, #205 ; « aspirationnel / sitemap » dans la matrice) ;
- santé et observabilité (`/health/ready`, #147), sauvegarde planifiée (#192), qui renforcent les items 29 et 30 sans changer leur note ;
- délégation pendant une absence et réassignation (#445, #453, #456).

### 5 bis. Lien avec le CDC, vérifié le 19/11 (O, demande 4)

Méthode : recherche dans le texte entier des deux documents sources, `Cahier Charges Doc Manager.pdf` (« CDC », 3 pages) et `Cdc + Plan + Budget … (1).pdf` (« Plan », 4 pages). La matrice sert de source secondaire. Termes cherchés : notif, temps réel, alerte, OTP, MFA, mail, PDF, rapport, planif, favori, récent, partag, santé, monitor, délégat, absence, assign, intérim, suppléant. Niveau : `Vérifié`.

| Capacité | Verdict | Citation ou absence |
|---|---|---|
| Notifications en temps réel (#155) | absent du CDC | aucune occurrence ; la matrice les classe « Partiel », source « Guide test » |
| OTP par e-mail, renvoi, TOTP admin (#154, #193, #219) | couvert par l'item 9 | CDC p. 1 § 3.1 : « Authentification par utilisateur avec rôles (admin, utilisateur, lecteur) » ; le second facteur vient du backlog PO (PO-009) |
| Rapport officiel PDF, rapports programmés (#197, #180, #209) | absent du CDC | le mot « rapport » n'apparaît dans aucun des deux PDF ; la matrice classe ces rapports « Aspirationnel » |
| Favoris, récents, partagés (#165, #205) | absent du CDC | aucune occurrence ; la matrice indique « sitemap », « Aspirationnel » |
| `/health/ready`, sauvegarde planifiée (#147, #192) | couvert par les items 29 et 30 | Plan p. 3 § 8 : « Disponibilité [≥] 99 % lors des tests de validation » ; Plan p. 3 § 8 : « Tests de restauration de sauvegardes réalisés et validés » |
| Délégation et réassignation (#445, #453, #456) | absent du CDC | seule mention proche : « Workflows avancés de validation », parmi les « modules complémentaires futurs » (Plan p. 4 § 9) |

Conclusion : aucune de ces capacités ne justifie un 33e item, et le dénominateur reste 32. Deux sont déjà portées par des items de la grille, sans changer leur note. Les quatre autres sont des ajouts au-delà du CDC : elles comptent pour la valeur, pas pour les 95 %. Une PR de ces quatre groupes ne fait donc pas avancer la 1.0 finale.

Sources : `[Innovateur] Recalcul du taux CDC - 2026-11-10.md`, `[Audit] Audit fonctionnel profond - 2026-11-09.md` § 1, `releve-preliminaire-taux-cdc-19-11.md` (branche de #104), `file-v1.1.md`, `plan-fusion-v1.1.md` et `plan-v1.1.md` (origin/docs/scenario-demo-30-11), `gh pr list --state merged` depuis le 10/11, `gh pr view` #147, #152, #171, #181, #199, #248, #267, #268, `PASSATION-ci-qa.md`, `PASSATION-innovateur.md`.
