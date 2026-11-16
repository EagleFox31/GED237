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
| R10 | **Fusions tardives avant la coupure** (réflexes Windows L1 et L2, #140) qui introduisent une régression non vue | moyenne | moyen | règle déjà posée : en file seulement si vertes et relues par Q avant le 19 à 12:00, sinon V1.1 | O | 19/11 12:00 |
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
