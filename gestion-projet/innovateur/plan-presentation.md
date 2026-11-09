# Plan de la présentation du 30/11 — 20 minutes

- **Statut** : PROPOSÉ (innovateur, 2026-11-09) → orchestrateur, puis PO. Niveau `Proposé` sauf mention ; faits produit issus de `contexte-application.md` et `parcours-demo.md` ; vocabulaire normatif issu de `sources/ged-normes.md` (`Documenté`).
- **Règle d'honnêteté** : on parle d'« alignement sur le vocabulaire et les principes d'ISO 15489 », jamais de conformité certifiée (aucune adoption formelle de la norme au Cameroun trouvée).
- **Fil conducteur** : *un dossier arrive, il est capturé, classé, retrouvé, contrôlé et conservé — en 20 minutes, en direct.*

## 1. Déroulé (20 min)

| Min | Séquence | Contenu | Parcours (`parcours-demo.md`) |
|---|---|---|---|
| 0–2 | Ouverture | Le problème : archives papier et répertoires partagés sans classement ni traçabilité ; une trentaine d'administrations en transition numérique (presse, 2025). Promesse : classement automatique, recherche, traçabilité, une administration = un tenant. | — |
| 2–4 | Entrer | Connexion à deux facteurs, rôles distincts (rédacteur, validateur, lecteur, auditeur, administrateur). Message : *accès nominatif et contrôlé*. | P1 |
| 4–8 | Capturer et classer | Import d'un dossier de ~30 fichiers, règle active, doublons refusés, reste à classer visible. Message : *capture systématique, classement par plan (service > domaine > activité > année), doublons bloqués*. | P2 |
| 8–10 | Gouverner le classement | Création d'une règle, simulation avant activation, puis revue manuelle d'un document sans règle. Message : *le plan de classement est piloté par l'administration, pas par l'outil ; rien ne bouge sans simulation*. | P3, P6 |
| 10–13 | Retrouver | Espaces avec filtres et pagination sur 500 documents ; recherche plein texte avec temps de réponse affiché ; même requête en lecteur d'un autre service : résultats différents ; corbeille exclue. Message : *on retrouve vite, et seulement ce qu'on a le droit de voir*. | P4, P5 |
| 13–15 | Conserver et contrôler | Cycle de vie (corbeille/restauration ou cycle de validation selon décision PO) ; journal d'audit en auditeur : toute la démo y figure. Message : *chaque action est tracée, la suppression est réversible*. | P8, P7 |
| 15–17 | Ce qui reste | Les 7 écarts annoncés (§ 3), avec date ou appui. | — |
| 17–20 | Questions | § 4. | — |

Répartition : 13 min de démo en direct, 2 min d'ouverture, 2 min d'écarts, 3 min de questions. Plan B si l'environnement tombe : captures des 8 parcours issues du run Playwright du 21/11 (rapport HTML avec traces).

## 2. Messages clés alignés ISO 15489

| Principe ISO 15489 | Ce qu'on montre | Ce qu'on dit |
|---|---|---|
| Capture | Import de dossier, upload, refus de doublon | « Tout document entrant est capturé une seule fois, avec ses métadonnées. » |
| Classement | Règles avec priorité, simulation, arborescence à quatre niveaux, revue manuelle | « Le plan de classement est une décision de l'administration ; l'outil l'applique et montre ce qu'il ne sait pas classer. » |
| Métadonnées et authenticité | Fiche document, historique des versions, verrou | « Chaque document garde son origine, sa version courante et l'historique. » |
| Accès | Rôles, portée par service, isolation par tenant | « On ne voit que son périmètre ; une administration est étanche des autres. » |
| Traçabilité | Journal d'audit, rôle auditeur en lecture seule | « Qui a fait quoi, quand : consultable sans pouvoir modifier. » |
| Conservation et sort final | Corbeille, restauration, purge réservée à l'administrateur | « La suppression est réversible ; la destruction définitive est un acte d'administrateur. » Durées de conservation : annoncées (V1.1). |
| Souveraineté | Stockage local ou MinIO, déploiement Docker on-site | « Les données restent chez l'administration. » |

## 3. Formulation des 7 écarts annoncés (DEC-2026-002 § 4)

1. **Chiffres CDC non mesurés** : « Les trois objectifs chiffrés (≥ 95 % classés, recherche < 2 s, 100 000 fichiers < 20 min) seront mesurés sur un corpus étalon en décembre ; aujourd'hui vous voyez le temps réel de la recherche sur le jeu de démo. »
2. **Règles sans critère contenu/date, sans export** : « La V1 classe sur type, origine, nom et format ; les critères "contenu" et "date" et l'export des règles sont le lot Mois 5. »
3. **KPI doublons** : « Les doublons sont bloqués à l'entrée, vous l'avez vu ; le compteur au tableau de bord arrive en V1.1. »
4. **Surveillance continue d'un dossier** : « L'import est à la demande ; le suivi continu d'un répertoire est une option on-site à arbitrer avec vous. »
5. **HTTPS / hébergement** : selon la réponse PO : « URL HTTPS de démonstration » ou « démo Docker on-site, HTTPS porté par votre reverse-proxy ».
6. **Disponibilité 99 % et exploitation** : « Sonde de santé disponible ; supervision et manuel d'exploitation livrés avec le pilote. »
7. **Responsive** : « Interface poste de travail ; écrans lecteur vérifiés sur mobile. »

Ajout recommandé, pour cohérence avec § 2 : **durées de conservation et sort final automatisés** : « Le cycle de vie est manuel en V1 (corbeille, restauration, purge) ; les règles de conservation par type arrivent en V1.1. »

## 4. Questions probables du jury et réponses

| Question | Réponse | Appui |
|---|---|---|
| Êtes-vous conformes à ISO 15489 / MoReq ? | « Alignés sur les principes et le vocabulaire (capture, classement, accès, traçabilité) ; pas de certification, aucune administration camerounaise n'a formalisé l'adoption de ces normes à notre connaissance. » | `sources/ged-normes.md` |
| Où sont stockées les données ? | « Sur le serveur de l'administration : stockage fichier local ou MinIO compatible S3, base PostgreSQL ; déploiement Docker. » | `contexte-application.md` § Stack |
| Un agent de la DAF peut-il voir les documents de la DRH ? | « Non : portée par service pour la recherche et la consultation, isolation totale entre administrations. » Montrer P5 si besoin. | DEC-002 ordre 1 (livré le 11/11) |
| Que se passe-t-il si on supprime par erreur ? | « Corbeille et restauration ; la purge définitive est réservée à l'administrateur. Sauvegarde et restauration de la base testées le 18/11. » | DEC-002 ordre 5 |
| L'OCR lit-il le français manuscrit ou dégradé ? | « OCR imprimé (Tesseract/EasyOCR) ; le manuscrit n'est pas couvert en V1. La recherche plein texte porte sur le texte reconnu. » | audit fonctionnel |
| Combien de documents tient le système ? | « Démo sur 500 documents ; les objectifs de volume (100 000 fichiers) sont mesurés en décembre sur un corpus étalon. » | écart 1 |
| Peut-on l'installer sans Internet ? | « Oui, tout tourne en conteneurs sur un serveur local ; aucune dépendance cloud. » | Stack |
| Comment les règles évoluent-elles sans développeur ? | « Écran d'administration des règles, priorité, simulation avant activation ; revue manuelle pour le reste. » | P3, P6 |
| Qui garantit la sécurité du code ? | « Analyse de dépendances, secrets et conteneurs à chaque modification ; branche principale protégée ; mises à jour de sécurité tranchées avant la démo. » | Lots A–B, DEC-001 |
| Quelle est la suite après la V1 ? | « Pilote dans une administration, mesures CDC en décembre, V1.1 : critères contenu/date, conservation par type, KPI doublons, watcher de répertoire. » | DEC-002 § 4 |

## 5. Préparation

- Répétition générale le 27/11 sur l'environnement de démo (jeu de 300–500 documents, 3 services) ; chronométrer chaque séquence.
- Captures de secours générées depuis le run Playwright du 21/11.
- Décision PO attendue sur P8 (corbeille/version ou cycle de validation) : la séquence 13–15 s'adapte sans changer le reste.
