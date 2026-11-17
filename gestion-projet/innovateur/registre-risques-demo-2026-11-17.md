# Registre des risques de la démonstration — du 20 au 30/11

- **Pour** : O (pilotage, remontée au PO), Q, B, F (propriétaires des parades). Innovateur, 2026-11-17, sur `main` 371c0a0.
- **Sources** : `PASSATION.md` (entrées du 16 et du 17/11), `audit-https-2026-11-16.md`, `recette/plan-recette-20-23-11.md`, `gh pr list` du 17/11. Probabilités et impacts sont des estimations de l'innovateur, pas des mesures.
- **Échelle** : probabilité et impact en faible / moyen / fort. Les cinq premiers risques sont ceux à remonter au PO.

## 1. Registre

| # | Risque | Prob. | Impact | Parade | Propriétaire | Échéance |
|---|---|---|---|---|---|---|
| R1 | **Embouteillage du 19 soir au 20 midi sur un seul poste** : `prove_tls.sh`, rejeu du manuel d'installation, run uat officiel, restauration n° 2 et 8 parcours en HTTPS attendent tous la fin de la sonde C6 (19 à 18:00) et ne peuvent pas tourner ensemble (conteneurs `edossier_*` à nom fixe) | moyenne | fort : items 27 et 31 restent `partiel`, recette décalée | ordre écrit et horodaté des cinq passages ; pile éphémère sans `container_name` pour ce qui le permet ; si le temps manque, priorité à `prove_tls.sh` puis au run uat | Q (exécution), O (ordre) | ordre fixé le 19 à 12:00 ; passages finis le 20 à 12:00 |
| R2 | **Mémoire du poste** : ≈ 4 Go libres le 17/11, alors que rejeu, uat et TLS demandent ≥ 5 Go ; cause de la saturation non recherchée | moyenne | fort : pile lente ou arrêtée en séance | mesure de la mémoire libre à H-30 (seuil 5 Go, sinon fermer navigateurs et sessions) ; une seule pile ; aucune autre charge le jour J | O (mesure), PO (poste) | 20/11 (rejeu), puis H-30 le 30/11 |
| R3 | **Image `api` impossible à reconstruire** : le 17/11, un build neuf a échoué sur le poste (archive `torch` altérée au téléchargement) ; la CI, elle, reconstruit sans erreur | moyenne | fort si un rebuild est tenté le jour J | #129 (3 essais sur l'étape `pip`) à fusionner ; image construite et vérifiée la veille, aucun rebuild le 30 | B (#129), Q (build de la veille) | #129 : 19/11 18:00 ; build : 29/11 |
| R4 | **Run uat officiel du jeudi 20 rouge** : premier run compté sur pile neuve depuis `main` ; le run de reconnaissance du 16 avait 4 échecs, corrigés depuis ; le projet uat n'est pas encore en CI (#130 ouverte) | moyenne | fort : critères de recette non tenus, tag du 24 retardé | fusion de #130 (run nocturne) avant la coupure ; créneau de correction du 21 au 23 ; second run avant le tag | Q (run), B (#130) | run 1 : 20/11 ; run vert au plus tard le 23/11 |
| R5 | **Certificat HTTPS non reconnu sur le poste de démonstration** : `mkcert -install` ajoute une autorité au magasin Windows ; accord du PO donné le 16/11, mais la fenêtre de confirmation Windows doit être acceptée par lui, sur le poste réel | faible à moyenne | moyen : démonstration en HTTP, item 27 `partiel` | installation en présence du PO au plus tard le 20 matin ; `prove_tls.sh` vert, revérifié à H-30 ; repli `http://localhost:8080` | Q (exécution), PO (acceptation) | 20/11 matin ; H-30 le 30/11 |
| R6 | **Reconnexion lors d'une bascule 8443 → 8080** (#133) : la session ne passe pas d'une origine à l'autre, il faut se reconnecter avec OTP (≈ 40 s par fenêtre) | faible | moyen : temps mort visible en séance | onglet de repli déjà connecté à H-5 (`deroule-demo-https.md` § 3) | démonstrateur, O | H-5 le 30/11 |
| R7 | **Sonde C6 interrompue avant le 19 à 18:00** (pile redémarrée, autre pile `edossier_*` lancée) | faible à moyenne | faible : item 29 reste `absent` (−0,5 point) | ne pas toucher à la pile de la sonde ; aucune pile isolée sans prévenir O ; synthèse par demi-journée (`scripts/c6_summary.sh`) | Q | 19/11 18:00 |
| R8 | **Régression visuelle après Tailwind compilé** (#122) sur un écran non comparé : la vérification a porté sur 3 écrans, les tuiles du tableau de bord et un composant | faible à moyenne | moyen : écran mal stylé devant le PO | contrôle du 19 à 12:00 (retour arrière possible) ; regard écran par écran au rejeu des 8 parcours du 20 | F, Q | 19/11 12:00 ; 20/11 |
| R9 | **Données de démonstration incomplètes** : le parcours P8 dépend de #127 (non fusionnée) ; P6 affiche 51 documents « à revoir » et non ≈ 15 comme l'annonce le déroulé | moyenne | moyen : un parcours échoue ou contredit le discours | #127 en file ; correction du déroulé après la fusion de #104 ; réinitialisation des données la veille | F | #127 : 19/11 18:00 ; déroulé : 20/11 |
| R10 | **Fusions tardives avant la coupure** (réflexes Windows L1 et L2 ; #140 est fusionnée depuis le 17/11, b64144f, et clôt #134) qui introduisent une régression non vue | moyenne | moyen | règle déjà posée : en file seulement si vertes et relues par Q avant le 19 à 12:00, sinon V1.1 | O | 19/11 12:00 |
| R11 | **Notes rc.1 en retard** : #104 fusionnée après 18:00 le 19, conflit possible sur `lessons-learned.md`, puis PR d'alignement de B avant le 20 à 12:00 | moyenne | faible : `--notes-file` du tag du 24 non prêt | intégrer `main` dans #104 le 19 au matin ; prévenir B à chaque push | innovateur, B | 19/11 18:00 ; 20/11 12:00 |
| R12 | **Panne du poste de démonstration** | faible | fort | poste de secours restauré le 20 (`backup.sh` puis `restore.sh --wipe`), image et données copiées | Q | 20/11 |
| R13 | **Décisions PO encore ouvertes** (D2, D3, D4, D5, S1) : un critère d'acceptation peut changer après la recette | moyenne | moyen | remontée en bloc par O après le 19, réponse attendue avant la fin de recette | O, PO | 23/11 |

Risque levé le 17/11 : dépendance Internet du navigateur (#116, #122, #126 fusionnées ; `main` ne référence plus aucun CDN).

## 2. Taux CDC prévisionnel

Formule : (fait + 0,5 × partiel) / 32.

| Date | fait | partiel | absent | Points | Taux | Changement |
|---|---|---|---|---|---|---|
| 16/11, `main` ca9953b | 25 | 3 (7, 19, 31) | 4 (8, 27, 28, 29) | 26,5 | 82,8 % | référence |
| 17/11, `main` 371c0a0 | 26 | 3 (19, 27, 31) | 3 (8, 28, 29) | 27,5 | **85,9 %** | item 7 `fait` (#100, 187b7f7) ; item 27 `partiel` (#109 fusionnée, preuve TLS non passée) |

Items encore conditionnels, chacun vaut 0,5 point (1,6 %) :

| Item | Condition | Passage | Quand la preuve peut exister | Estimation |
|---|---|---|---|---|
| 29 | ≥ 6 relevés verts de la sonde C6 répartis du 17 matin au 19 soir | `absent` → `partiel` | 19/11 18:00 | probable (sonde verte depuis le 16 à 22:06Z) |
| 27 | `prove_tls.sh` vert sur le poste de démonstration | `partiel` → `fait` | après l'arrêt de la sonde : 19 soir ou 20 matin | probable, dépend de R1 et R5 |
| 31 | rejeu réel du manuel d'installation par Q | `partiel` → `fait` | après l'arrêt de la sonde : 19 soir ou 20 | probable, dépend de R1 et R2 |

| Scénario | Points | Taux |
|---|---|---|
| Aucune condition tenue | 27,5 | 85,9 % |
| Une condition | 28,0 | 87,5 % |
| Deux conditions | 28,5 | 89,1 % |
| Trois conditions (plafond) | 29,0 | 90,6 % |

**Conséquence pour le relevé du 19** : à 18:00, seul l'item 29 peut avoir basculé, donc le taux relevé ce soir-là sera de 87,5 % au mieux. Les items 27 et 31 se prouvent après l'arrêt de la sonde ; le taux de 90,6 % ne peut être constaté que le 20, une fois les deux preuves datées versées en recette. Les items 8 et 28 restent `absent`, l'item 19 `partiel`.

## 3. Annexe — ordre des cinq passages, du 19 à 18:00 au 20 à 12:00 (parade de R1)

**Version du 17/11 après relecture de Q et décisions de O ; confirmation définitive le 19 à 12:00.** Un seul poste ; la pile `edossier_*` du manuel et la pile e2e isolée du run uat sont deux piles distinctes. Les heures sont des heures de Douala. Les durées sont en heures de session (h-s) ; sauf mention « mesuré », ce sont des estimations (celles des passages 1 et 4 viennent de Q, qui les mesurera au passage 1). Mémoire : le seuil de 5 Go libres vient de l'en-tête de `scripts/prove_tls.sh` et de la règle posée par O le 16/11.

Idée directrice : le rejeu du manuel construit la pile neuve depuis `main`, et cette même pile sert aux passages 2, 3 et 5. Le run uat (passage 4) tourne sur la pile e2e isolée (`docker-compose.e2e.yml`, sans port hôte, base propre), qui reconstruit l'api avec le cache du passage 1 (≈ 2 min, mesuré par Q avec cache). Aucun build sans cache après le passage 1.

| Heure | Passage | Durée | Mémoire libre requise | Prérequis | Propriétaire | Critère de réussite | Critère d'arrêt |
|---|---|---|---|---|---|---|---|
| 19/11 18:00 | **0. Arrêt de la sonde C6** : `sh scripts/c6_summary.sh ../GED237-c6/c6.tsv`, (script dans #142, non fusionnée le 17/11), copie du relevé en recette, arrêt de la pile de la sonde | 5 min | — | relevé de coupure de O fait, SHA de coupure annoncé | Q | synthèse par demi-journée versée ; item 29 tranché | — |
| 19/11 18:15 | **1. Rejeu du manuel d'installation** : clone neuf au SHA de coupure, `DOCS/exploitation/installation.md` suivi pas à pas, build neuf | 1,25 h-s (build sans cache 20 à 30 min, estimé par Q) | ≥ 5 Go | passage 0 fini (aucune autre pile) ; #129 et #139 fusionnées ; Internet pour le build | Q | `/health` 200, connexion d'un compte, chaque étape notée (commande, message, durée) ; item 31 `fait` | 2 builds en échec, ou 19:30 atteint : démarrer la pile avec l'image existante, item 31 reste `partiel`, écart noté, passer au passage 2 |
| 19/11 19:30 | **2. `prove_tls.sh`** : `mkcert -install`, puis `sh scripts/prove_tls.sh` ; ensuite les deux contrôles de l'audit HTTPS (redirection 307, WebSocket) | 0,5 h-s | ≥ 5 Go | pile du passage 1 démarrée ; **PO présent** pour accepter la fenêtre Windows (confirmé par O le 17/11) ; mkcert installé ; `up nginx-tls` recrée l'api, sans gêne puisque la sonde est arrêtée | Q, PO | code de sortie 0, sortie datée versée en recette ; item 27 `fait` | PO absent le 19 : report au 20 à 08:00, avant le passage 3. 2 échecs du script : repli HTTP décidé par O, item 27 reste `partiel`, le passage 5 se joue en HTTP |
| 20/11 08:00 | **3. Restauration n° 2**, sur ce poste par défaut : `bash ops/backup.sh`, `bash ops/restore.sh <dossier> --wipe` (écrase la base `edossier`), puis `alembic current`, `/health` et comptages ; ensuite `sh backend/scripts/e2e_reset.sh demo` | 0,5 h-s (sauvegarde 10 s et restauration 11 s mesurées le 10/11) | pile déjà démarrée, ≥ 4 Go | pile du passage 1 ; données de démonstration chargées | Q | comptages égaux au manifeste, version attendue ; `recette/restauration-2026-11-20.txt` | comptages différents après un second passage : anomalie `REC-nn` bloquante, O décide ; `e2e_reset.sh demo` rejoué dans tous les cas avant le passage 5 |
| 20/11 08:30 | **4. Run uat officiel (run 1)** sur la pile e2e isolée : smoke puis `--project=uat`, sans nouvelle tentative automatique | 1 h-s (smoke ≈ 10 min, uat 30 à 45 min, estimés par Q) | ≥ 5 Go avec les deux piles (≈ 3,5 à 4 Go à elles deux) ; sinon arrêt de `edossier_*` pendant le run, redémarrage ensuite (≈ 1 min) | pile e2e au SHA de coupure, image en cache | Q | 0 échec : run 1 compté | un échec : un seul rejeu ciblé des tests rouges pour écarter l'instabilité, puis anomalies `REC-nn` ; pas de troisième essai, on continue |
| 20/11 09:45 | **5. Les 8 parcours en HTTPS** : pile `edossier_*` redémarrée si elle a été arrêtée, données réinitialisées après le passage 3, puis `deroule-demo-https.md` dans l'ordre P1, P2, P3, P6, P4, P5, P8, P7, avec l'onglet de repli | 1,5 h-s (déroulé ≈ 20 min, plus le relevé des écarts) | ≥ 4 Go (pile et navigateur) | passage 2 vert (sinon HTTP) ; données réinitialisées | F et B, Q observe, le PO assiste s'il est là (décision O du 17/11) | 8 parcours au résultat attendu, cadenas visible, F5 garde la session | un parcours bloquant : `REC-nn`, on passe au suivant ; fin à 11:15 au plus tard |
| 20/11 11:15 | **Marge** | 0,75 h-s | — | — | O | compte rendu à 12:00 : cinq passages, preuves, taux CDC constaté | — |

Total : ≈ 4,85 h-s de passages, 0,75 h-s de marge.

Règles si le temps manque :

1. Avant chaque passage, mesurer la mémoire libre. Sous le seuil, fermer navigateurs et sessions inutiles ; si le seuil n'est pas atteint en 15 min, O décide (parade de R2).
2. Ordre de priorité (décision O du 17/11) : passage 4, puis 2, puis 5, puis 3, puis 1 ; le run uat est le critère 2 du plan de recette, alors que l'HTTPS a un repli HTTP. Le rejeu du manuel est le premier à glisser (au 20 après-midi), la restauration le second (au 21, avant le run 2). Si le passage 1 glisse, la pile se construit quand même au SHA de coupure le 19 au soir, sans suivre le manuel.
3. Aucun build sans cache après le passage 1 : la pile e2e du passage 4 réutilise le cache.
4. Chaque passage laisse une preuve datée dans `gestion-projet/recette/` avant le suivant.

Décisions de O (17/11) et point encore ouvert :

- **Tranché** : le PO est présent le 19 à 19:30 pour `mkcert -install` ; F et B jouent le passage 5, Q observe ; la restauration n° 2 se joue sur ce poste par défaut, avant les parcours.
- **Ouvert, question posée au PO par O** : existe-t-il un poste de secours ? Si oui, le passage 3 s'y joue en parallèle et libère 0,5 h-s.
