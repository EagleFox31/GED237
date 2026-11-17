# Plan de la présentation du 30/11 — 20 minutes

- **Statut** : PROPOSÉ (innovateur, 2026-11-09) → orchestrateur, puis PO. Niveau `Proposé` sauf mention ; faits produit issus de `contexte-application.md` et `parcours-demo.md` ; vocabulaire normatif issu de `sources/ged-normes.md` (`Documenté`).
- **Règle d'honnêteté** : on parle d'« alignement sur le vocabulaire et les principes d'ISO 15489 », jamais de conformité certifiée (aucune adoption formelle de la norme au Cameroun trouvée).
- **Fil conducteur** : *un dossier arrive, il est capturé, classé, retrouvé, contrôlé et conservé — en 20 minutes, en direct.*
- **Mise à jour du 17/11 (récit de la démo)** : le parcours minuté est désormais `scenario-demo-30-11.md` (branche `docs/scenario-demo-30-11`, commits cdbf78e et c8063df) : 18:00 au plus, dont 11:45 en direct. Narrateur : l'administrateur du ministère `MINFI001` (décision de O du 17/11) ; le collaborateur `MINFI002` n'est plus joué en direct. Phrase de l'étape 1 : « L'administrateur prépare, chacun ne voit que ce qui le concerne. Un agent n'importe pas en masse et ne cherche que dans ses documents : c'est le cloisonnement voulu. » Le § 1 ci-dessous est l'historique du 09/11 ; les écarts du § 3 sont relus en § 3.0.

## 1. Déroulé (20 min)

> **17/11 : remplacé** par `scenario-demo-30-11.md` § 1 (ouverture, connexion, import, rangement, règles, bannette, recherche, historique, rapports, ce qui manque, questions). Tableau gardé pour l'historique. Il ne colle plus à la rc.1 sur trois points : séquence 2–4 (une seule connexion en direct, celle de l'administrateur), 4–8 (l'import est fait par l'administrateur) et 13–15 (pas d'écran Corbeille dans la rc.1 ; le circuit de validation n'est montré que si le jury le demande).

| Min | Séquence | Contenu | Parcours (`parcours-demo.md`) |
|---|---|---|---|
| 0–2 | Ouverture | Le problème : archives papier et répertoires partagés sans classement ni traçabilité ; une trentaine d'administrations en transition numérique (presse, 2025). Promesse : classement automatique, recherche, traçabilité, une administration = un tenant. | — |
| 2–4 | Entrer | Connexion à deux facteurs, rôles distincts (rédacteur, validateur, lecteur, auditeur, administrateur). Message : *accès nominatif et contrôlé*. | P1 |
| 4–8 | Capturer et classer | Import d'un dossier de ~30 fichiers, règle active, doublons refusés, reste à classer visible. Message : *capture systématique, classement par plan (service > domaine > activité > année), doublons bloqués*. | P2 |
| 8–10 | Gouverner le classement | Création d'une règle, simulation avant activation, puis revue manuelle d'un document sans règle. Message : *le plan de classement est piloté par l'administration, pas par l'outil ; rien ne bouge sans simulation*. | P3, P6 |
| 10–13 | Retrouver | Espaces avec filtres et pagination sur 500 documents ; recherche plein texte avec temps de réponse affiché ; même requête en lecteur d'un autre service : résultats différents ; corbeille exclue. Message : *on retrouve vite, et seulement ce qu'on a le droit de voir*. | P4, P5 |
| 13–15 | Conserver et contrôler | Cycle de vie (corbeille/restauration ou cycle de validation selon décision PO) ; journal d'audit en auditeur : connexions, dépôts, imports, revues et corbeille de la démo y figurent (dépend du correctif D3, amendement DEC-002 ; sans lui, montrer seulement revues, doublons, corbeille, versions et le dire). Message : *chaque action sur un document est tracée, la suppression est réversible*. | P8, P7 |
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
| Conservation et sort final | Corbeille, restauration, purge réservée à l'administrateur (**17/11** : pas d'écran Corbeille dans la rc.1 ; on montre seulement qu'un document mis en corbeille sort de la recherche, étape 5 du scénario) | « La suppression est réversible ; la destruction définitive est un acte d'administrateur. » Durées de conservation : annoncées (V1.1). |
| Souveraineté | Stockage local ou MinIO, déploiement Docker on-site | « Les données restent chez l'administration. » |

## 3. Écarts annoncés au jury — liste consolidée du 2026-11-09 (DEC-2026-002 § 4 + décisions PO du jour)

Règle : un écart = une phrase honnête dite **avant** que le jury ne la trouve, puis la réponse si l'on creuse. Rien de ce qui suit n'est caché ni minimisé en séance.

### 3.0 Relecture du 17/11 contre le scénario (cdbf78e, c8063df) et la rc.1 (b701314)

Chaque écart ci-dessous (§ 3, 1 à 17) a été relu. Une phrase « caduque » n'est plus dite : le scénario montre le contraire à l'écran. Les phrases d'origine restent plus bas, pour l'historique.

| Écart | Colle au scénario ? | Phrase à dire le 30/11 |
|---|---|---|
| 1. Chiffres CDC | En partie. Le taux de classement et le temps de recherche se mesurent pendant la recette du 20 au 23 ; la charge, après le 24/11 (décision PO du 17/11, scénario § 1 bis). | « Le taux de classement et le temps de recherche ont été mesurés sur le jeu de démo pendant la recette : [chiffres du compte rendu]. La charge de 100 000 fichiers en moins de 20 minutes est mesurée après le 24/11. » |
| 2. Règles contenu/date, export | **Caduc** : l'étape 3 montre une règle sur le contenu ou l'année ; export et import des règles livrés (#79, #84, #92, #95). | Rien à dire. Si l'on creuse : limites de #92 (notes rc.1, ligne SC-V11-04). |
| 3. KPI doublons | **Caduc** : la tuile « Doublons refusés » est livrée. | Remplacée par : « Les doublons sont refusés à l'import et comptés au tableau de bord ; l'écran qui permet de choisir la copie à garder arrive après la version. » |
| 4. Surveillance continue | Oui, sous condition du 19/11 : moteur livré (#101) ; l'écran (#100) passe en V1.1 s'il n'est pas fusionné à 18:00. | Si #100 n'est pas fusionnée : « L'import se lance à la main ; le suivi continu d'un dossier est prêt côté serveur, son écran arrive en V1.1. » Sinon, rien à dire. |
| 5. HTTPS, hébergement | **Plus à jour** : HTTPS local livré (#109) ; installation sur site soumise au PO le 23 (item 28). Le scénario dit : état du compte rendu du 20/11, pas avant. | À réécrire le 20/11 au soir, d'après le compte rendu. D'ici là, ne rien affirmer. |
| 6. Disponibilité | Même cas que l'écart 5 (item 29, relevés C6 du 20 au 23). | Idem. |
| 7. Responsive | Hors scénario, pas de conflit (#89, #93). | Inchangée, seulement si la question vient. |
| 8. Export du journal | **Caduc** : l'étape 6 exporte le CSV (#80, #87). | Rien à dire. |
| 9. Cycle de vie manuel | En partie : la corbeille existe côté serveur, mais l'écran Corbeille et l'annulation sont hors rc.1 (#152, #181, #179). | « Un document supprimé reste récupérable : en V1.0, l'administration le restaure sur demande, sans écran ; l'écran Corbeille et l'annulation arrivent en V1.1, puis les durées de conservation par type. » |
| 10. Autorisations fines côté API | Hors scénario ; état des trois contrôles non revérifié sur b701314. Question posée à B le 17/11 (`GET /users/assignable-roles`, mise à jour de son propre profil, clé du snapshot). | Seulement si la question vient ; phrase ajustée selon la réponse de B, avant la répétition du 27. |
| 11. Export (doublon de 8) | Caduc avec l'écart 8. | — |
| 12. Verrou OTP | **Caduc** : livré (#83, #88). | Remplacé par l'écart 15 révisé. |
| 13. Exception starlette | Hors scénario. **Clos le 17/11** : l'échéance tient (`backend/pip-audit-ignore.txt` sur `main` : « Expires: 2026-12-15 » pour les 6 avis starlette, montée de version prévue en V1.1). | Inchangée, seulement si la question vient. |
| 14. OCR léger | Hors scénario. Aligné le 17/11 sur les notes rc.1, qui font référence (arbitrage de O) : « OCR léger uniquement ». | « La V1 lit le texte imprimé avec un OCR léger. Le moteur complet demande plus de machine que le budget prévu ; il n'est pas dans cette version. » Ne pas citer de mesure ni de moteur. |
| 15. Profils pré-remplis | **Plus à jour** : en rc.1, l'écran pré-remplit aussi le code et affiche le cadre « Espace Démo Interactif » ; masqués après le 30 en mode production (dossier PO du 23, § 6). | Au moment de la connexion : « Pour la démo, l'écran pré-remplit les profils et le code. Installée en production, l'application les masque, et le code arrive par e-mail, ou par l'application du téléphone pour les administrateurs, en V1.1. » |
| 16. Tags | Hors scénario, pas de conflit. | Inchangée. |
| 17. Renvoi pour correction | Le circuit n'est montré que si le jury le demande (scénario § 1 bis) ; le bouton s'appelle « Valider », pas « viser ». | « Le manager valide ou rejette avec un motif ; le rédacteur voit la décision et le motif. Le renvoi pour correction arrive en V1.1. » |
| Nouveau : cloisonnement | Phrase de l'étape 1 (décision de O du 17/11). | Dite pendant l'import, pas au bloc « Ce qui manque » : c'est un choix, pas un manque. |

**Ordre de passage au bloc 12:45 (0:45), remplace celui du 09/11** : 1, 3 révisé, 5 et 6 (état du 20/11), 9, puis 4 si #100 n'est pas fusionnée. L'écart 15 se dit à la connexion. Les autres seulement si la question vient.

1. **Chiffres CDC non mesurés** : « Les trois objectifs chiffrés (≥ 95 % classés, recherche < 2 s, 100 000 fichiers < 20 min) seront mesurés sur un corpus étalon en décembre ; aujourd'hui vous voyez le temps réel de la recherche sur le jeu de démo. »
2. **Règles sans critère contenu/date, sans export** : « La V1 classe sur type, origine, nom et format ; les critères "contenu" et "date" et l'export des règles sont le lot Mois 5. »
3. **KPI doublons** : « Les doublons sont bloqués à l'entrée, vous l'avez vu ; le compteur au tableau de bord arrive en V1.1. »
4. **Surveillance continue d'un dossier** : « L'import est à la demande ; le suivi continu d'un répertoire est une option on-site à arbitrer avec vous. »
5. **HTTPS / hébergement** (tranché PO 09/11 : sur place) : « La démo tourne sur ce poste, en conteneurs, exactement comme sur votre serveur ; le HTTPS est porté par le reverse-proxy de votre infrastructure, nous livrons la configuration type. » Si on creuse : aucune instance publique n'a été ouverte volontairement (données de démo, pas d'exposition inutile).
6. **Disponibilité 99 % et exploitation** : « Sonde de santé disponible ; supervision et manuel d'exploitation livrés avec le pilote. »
7. **Responsive** : « Interface poste de travail ; écrans lecteur vérifiés sur mobile. »

8. **Export du journal d'audit** (D4, amendement DEC-002) : « Le journal se consulte et se filtre à l'écran ; l'export CSV/PDF pour l'inspection arrive en V1.1. » Retirer SC-AUD-02 de P7.

9. **Durées de conservation et sort final automatisés** (cohérence § 2) : « Le cycle de vie est manuel en V1 (corbeille, restauration, purge) ; les règles de conservation par type arrivent en V1.1. »

### Ajouts du 2026-11-09 (décisions PO, DEC-2026-002 amendée, DEC-2026-003)

10. **Autorisations fines côté API (constats B6 backend, V1.1)** : « L'interface réserve l'administration aux administrateurs ; trois contrôles côté serveur sont renforcés en V1.1 : liste des rôles attribuables, modification de son propre profil, clé des instantanés. » S'ajoute, **corrigé avant le 30/11** (constat ci-qa du 09/11, `spec-limite-upload.md` § 5) : l'import de dossier est borné à des racines autorisées déclarées par l'exploitant ; à ne citer que si le jury pose la question du « chemin serveur » (« tout chemin hors des emplacements déclarés est refusé en 403 »). Si on creuse : « Constats faits par notre propre audit du 9/11 ; aucun ne permet de lire un document d'un autre service ni d'une autre administration ; corrigés avant tout pilote. »
11. **Export du journal d'audit** (D4) : déjà l'écart 8 ; ne pas le dire deux fois.
12. **Verrou de compte après échecs OTP** : « Les connexions sont limitées à 5 tentatives par minute et par adresse ; le verrou par compte après 3 codes faux arrive en V1.1. » Si on creuse : « Choix assumé pour la V1 : la limite par adresse bloque déjà la force brute ; le verrou par compte ajoute un risque de blocage d'un agent légitime, traité avec une procédure de déblocage en V1.1. »
13. **Dépendance starlette 0.48 avec exception documentée** : « Notre analyse automatique de dépendances signale une version de bibliothèque web ; la correction amont n'est pas compatible aujourd'hui ; l'exception est datée, expire le 15/12 et est relue à chaque livraison. » Si on creuse : « Les avis concernent des fonctions que nous n'exposons pas ; l'exception est écrite dans le dépôt, pas dans la tête de quelqu'un. »
14. **OCR léger (OCR-1 RapidOCR, V1.1)** : « L'OCR actuel (Tesseract, repli EasyOCR) lit l'imprimé ; un moteur plus léger et plus précis sur les scans dégradés est mesuré le 14/11 et livré en V1.1 si les seuils sont tenus. » Si on creuse : protocole `protocole-ocr-0.md`, critère : même précision ou mieux, moins de 1 Go de mémoire.
15. **Comptes de démonstration pré-remplis dans l'écran de connexion** : « Pour la démo, l'écran de connexion propose trois profils dont les identifiants sont inscrits dans le code du frontend ; c'est volontaire pour la séance, retiré en V1.1 avant tout pilote. » Si on creuse : « Préexistant à nos travaux, connu, et le code OTP reste obligatoire : un identifiant seul ne connecte personne. » (`frontend/components/LoginPage.tsx`, constante `DEMO_CREDENTIALS` ; ne jamais recopier ces valeurs dans un document.)

Ordre de passage en séance (séquence « ce que la V1 ne fait pas encore », 1 min) : 1, 2, 9, 8, 10, 12, 14 ; les écarts 3, 4, 5, 6, 7, 13, 15 ne sont dits que si la question vient ou si l'écran les montre (15 : à dire au moment même du login, en une phrase).

16. **Tags et « recherche intelligente » (CDC 2025 § 3.1, hors contrat de recette signé)** : « Le classement par règles et la recherche plein texte couvrent le besoin décrit en 2025 ; les étiquettes libres posées par l'agent arrivent en V1.1. » Si on creuse : « Le cadrage de septembre 2025 et ses sept critères de recette ne les mentionnent pas ; la base porte déjà le champ `tags` et l'API de recherche l'accepte (`search.py`), l'écran manque. » (La surveillance automatique d'un dossier, autre point du CDC 2025, est déjà l'écart 4 : ne pas le dire deux fois.)
17. **« Retourner pour correction » dans le cycle de validation (VAL-D3, V1.1)** : « Le manager vise ou rejette avec un motif ; le rédacteur voit la décision et le motif. Le renvoi pour correction avec nouvelle version, prévu par le guide de test, arrive en V1.1 : le modèle de données le permet déjà (versions, verrou), seul l'écran manque. » Si on creuse : « Le rejet motivé couvre le besoin le 30/11 ; le rédacteur dépose à nouveau. »

## 4. Questions probables du jury et réponses

| Question | Réponse | Appui |
|---|---|---|
| Êtes-vous conformes à ISO 15489 / MoReq ? | « Alignés sur les principes et le vocabulaire (capture, classement, accès, traçabilité) ; pas de certification, aucune administration camerounaise n'a formalisé l'adoption de ces normes à notre connaissance. » | `sources/ged-normes.md` |
| Où sont stockées les données ? | « Sur le serveur de l'administration : stockage fichier local ou MinIO compatible S3, base PostgreSQL ; déploiement Docker. » | `contexte-application.md` § Stack |
| Un agent de la DAF peut-il voir les documents de la DRH ? | « Non : portée par service pour la recherche et la consultation, isolation totale entre administrations. » Montrer P5 si besoin. **17/11, ajouter** : « Et un agent ne voit que ses propres documents. L'administrateur prépare, chacun ne voit que ce qui le concerne. » | DEC-002 ordre 1 (livré le 11/11) ; `search.py` l. 50-55 |
| Pourquoi la démo est-elle faite par l'administrateur ? (17/11) | « Parce que c'est lui qui importe et range. Un agent n'importe pas en masse et ne cherche que dans ses documents : c'est le cloisonnement voulu. Le manager et le lecteur, vous les avez vus. » | scénario § 1 ; `policy.csv` |
| Que se passe-t-il si on supprime par erreur ? | « Corbeille et restauration ; la purge définitive est réservée à l'administrateur. Sauvegarde et restauration de la base testées le 18/11. » **17/11** : « Le document reste récupérable : l'administration le restaure sur demande, et l'écran Corbeille arrive en V1.1. La restauration complète de la base a été rejouée le 10/11, puis pendant la recette (20–23/11). » (date exacte demandée à Q le 17/11) | DEC-002 ordre 5 ; critères C7 |
| L'OCR lit-il le français manuscrit ou dégradé ? | « OCR imprimé (Tesseract, repli EasyOCR) ; le manuscrit n'est pas couvert en V1. Un moteur plus léger (RapidOCR) est mesuré le 14/11 pour les scans dégradés, livraison V1.1 (écart 14). La recherche plein texte porte sur le texte reconnu. » **17/11** : dire seulement « OCR léger, pour l'imprimé ; le manuscrit n'est pas couvert ; la recherche porte sur le texte reconnu » (écart 14 révisé, § 3.0). | DEC-2026-003, notes rc.1 |
| Ces identifiants affichés à la connexion, c'est sécurisé ? | « Non, et c'est volontaire pour la démo : profils pré-remplis retirés en V1.1 ; le code OTP reste obligatoire. » **17/11** : le code est lui aussi pré-rempli en rc.1 ; dire la phrase de l'écart 15 révisé (§ 3.0). | écart 15 |
| Pourquoi pas de démo en ligne ? | « Décision du 9/11 : la démo se joue sur place, dans les mêmes conteneurs que chez vous, sans exposer de données sur Internet. » | `decision-po-vps-b6.md` |
| Combien de documents tient le système ? | « Démo sur 500 documents (**17/11** : 408 documents, plus les 30 de l'import en direct ; scénario § 2) ; les objectifs de volume (100 000 fichiers) sont mesurés en décembre sur un corpus étalon. » | écart 1 |
| Peut-on l'installer sans Internet ? | « Oui, tout tourne en conteneurs sur un serveur local ; aucune dépendance cloud. » | Stack |
| Comment les règles évoluent-elles sans développeur ? | « Écran d'administration des règles, priorité, simulation avant activation ; revue manuelle pour le reste. » | P3, P6 |
| Qui garantit la sécurité du code ? | « Analyse de dépendances, secrets et conteneurs à chaque modification ; branche principale protégée ; mises à jour de sécurité tranchées avant la démo. » | Lots A–B, DEC-001 |
| Quelle est la suite après la V1 ? | « Pilote dans une administration, mesures CDC en décembre, V1.1 : critères contenu/date, conservation par type, KPI doublons, watcher de répertoire. » **17/11** : critères contenu/date et tuile doublons sont livrés. Dire : « V1.1 : code par e-mail et application du téléphone pour les administrateurs, écran Corbeille et annulation, choix des doublons, rapports officiels en PDF, alertes de qualité ; puis les durées de conservation par type. » | DEC-002 § 4 ; `squelette-notes-version-v1.1.0.md` |

## 5. Préparation

- Répétition générale le 27/11 sur l'environnement de démo (jeu de 300–500 documents, 3 services) ; chronométrer chaque séquence.
- Captures de secours générées depuis le run Playwright du 21/11.
- Décision PO attendue sur P8 (corbeille/version ou cycle de validation) : la séquence 13–15 s'adapte sans changer le reste.
- **17/11** : préparation, comptes et plan B dans `scenario-demo-30-11.md` § 3 à § 5 (408 documents, 3 services, une seule connexion en direct). Le circuit de validation n'est montré que si le jury le demande.
