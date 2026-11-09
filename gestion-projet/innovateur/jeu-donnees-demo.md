# Jeu de données de démonstration — spécification (cible : jeudi 20/11)

- **Pour** : ci-qa (constitution), dev-backend (règles et import), orchestrateur (arbitrage). Niveau `Vérifié` pour l'état du dépôt (2026-11-09 19:40), `Proposé` pour la répartition.
- **Contrainte** : 300–500 documents, 3 services, rejouable en < 10 min sur l'environnement de démo, zéro mot de passe dans les fichiers versionnés (comptes = ceux du seed existant).
- **Lien** : parcours P1–P8 de `parcours-demo.md`, plan 20 min de `plan-presentation.md`.

## 1. Ce qui existe déjà (Reuse-first, `Vérifié`)

| Brique | Où | État | Décision |
|---|---|---|---|
| Seed de référence : tenants MINFI / MINESUP (+ PLATFORM), 7 rôles, unités `MINFI-CAB`, `MINFI-SG`, `MINFI-DRH`, `MINFI-DAF`, `MINFI-DSI`, `MINESUP-CAB`, `MINESUP-DAAJ`, comptes admin / manager (DAF) / collab (DAF) / reader (DSI) / auditor | `backend/scripts/seed_db.py` | en place ; **seed à lancer explicitement** (corrigé 09/11, constat ci-qa : `docker-compose.yml` n'exécute que le service `migrate` / `alembic upgrade head`, jamais `seed_db` ; la pile démo n'a aucun compte sans seed manuel) ; chemin tranché par dev-backend dans la PR rôles (service one-shot ou commande documentée) | **Adopt** : les 3 services de démo = **DRH, DAF, DSI** du MINFI ; MINESUP sert de « deuxième administration » pour prouver l'étanchéité (P5), une dizaine de documents au plus |
| Générateur de corpus réaliste : 500 documents bruités (PDF reportlab, DOCX, XLSX, PPTX), 8 familles (RH, Finances, Juridique, Informatique, Direction, Logistique, Marketing, Autre), années 2024/2025, taux d'ambiguïté 22 %, noms d'agents camerounais, CSV de résultats ; paramètres `GED_EXPORT_DOC_COUNT`, `GED_EXPORT_SEED`, `GED_EXPORT_AMBIGUITY_RATE` | `backend/scripts/test_real_export_v2.py` | script d'essai hors Docker (chemins `E:/tmp_…` en dur, l.68-69 ; classement simulé en local, pas via l'API) | **Adapt** : réutiliser `build_test_documents` + `generate_document` ; sortie paramétrable (`GED_EXPORT_OUT`), ne garder que 3 familles + « Autre », pas de classement local |
| Manifeste e2e de ci-qa : codes `E2E-DOM`, `E2E-ACT`, règle `E2E-RULE-DEMO` (motif `e2edemo-…`), volume `E2E-VOL-001..400` avec répartition déclarée ; corpus `frontend/e2e/data/demo-import/` ; reset `scripts/e2e-reset.sh` | branches `ci/e2e-smoke` puis `ci/e2e-seed` (ci-qa) | **absentes du remote le 09/11 à 19:20** ; décrites dans `PASSATION-dev-frontend.md` | **Adopt comme format** : le jeu de démo est une **deuxième instance du même manifeste** (`demo-manifest.json`), même schéma, codes `DEMO-…`, même script de reset |
| Import de dossier avec détection de doublons par SHA-256 (`import_analysis_service.py`) ; moteur de règles : catégorie, unité/utilisateur source, mots-clés de nom (`;`, `,` ou `\|`, insensibles à la casse et aux accents, sémantique OU), type MIME, cible scope/unité, domaine, activité, année `current` / `fixed` / `from_filename` | backend | en place | **Adopt** : les règles de démo n'utilisent que ces critères (pas de critère contenu : écart 2 annoncé) |

Conséquence : **aucun nouveau générateur**. Une seule PR ci-qa : adaptation du script v2 + manifeste de démo + règles en JSON importées par l'API.

## 2. Arborescence cible (service > domaine > activité > année)

| Service | Domaine | Activités | Années |
|---|---|---|---|
| DRH | Gestion du personnel | Contrats et actes de carrière ; Paie et bulletins ; Formation ; Congés et absences | 2024, 2025 |
| DAF | Finances et comptabilité | Factures fournisseurs ; Engagements et mandats ; Marchés publics ; Rapports financiers | 2024, 2025 |
| DSI | Systèmes d'information | Contrats de maintenance ; Incidents et interventions ; Licences et équipements ; Procédures | 2024, 2025 |

Soit 3 domaines × 4 activités × 2 années = 24 feuilles, de 8 à 40 documents chacune. Un domaine transverse **Courrier et notes de service** (activités : Courrier entrant ; Notes internes) est créé dans chaque service pour accueillir ce que la règle générique attrape.

## 3. Répartition (cible 420 documents, tolérance 300–500)

**Par service** : DRH 150 · DAF 170 · DSI 90 · MINESUP-DAAJ 10 (étanchéité).

**Par type de fichier** : PDF 70 % (dont ~40 % avec couche texte native, ~30 % image pure pour l'OCR, pré-OCRisés la veille), DOCX 15 %, XLSX 10 %, PPTX/images 5 %.

**Par état au début de la démo** :

| État | Nombre | Comment l'obtenir | Sert à |
|---|---|---|---|
| Classés par règle (`classification_status = classified`) | ≈ 330 | import du corpus avec les 9 règles actives | P4 espaces/pagination, P5 recherche |
| À revoir (`needs_review` : aucune règle ou conflit) | 35–45 (≈ 10 %) | fichiers sans mot-clé (`scan_0034.pdf`, `document.pdf`) ou ambigus (`facture_formation_2025.pdf` : DAF ou DRH ?) | P6 revue manuelle, écran « reste à classer » |
| Doublons refusés | 12 | copies octet pour octet sous un autre nom dans le dossier d'import P2 | P2 (message doublon), écart 3 |
| Corbeille (`deleted_at` renseigné) | 8 | suppression douce par l'API après import, dont 2 contenant le mot-clé de la recherche P5 | P5 (exclus de la recherche), P8 restauration |
| Verrouillés (`locked_by_user_id`) | 3 | verrou par l'API, compte manager DAF | P8 / fiche document (verrou visible) |
| Versions multiples (`document_versions` ≥ 2) | 5 | second dépôt sur le même document | P8, journal `version_uploaded` |
| Non importés, réservés au direct | **30** dans `demo-import/live/` | **non chargés** par le seed | P2 import en direct (28 nouveaux + 2 doublons volontaires) |

Chaque chiffre est déclaré dans `demo-manifest.json` (section `expected`) pour que le smoke e2e vérifie la post-condition après reset (mêmes assertions que `E2E-VOL`).

## 4. Règles IFTTT à préparer (9 actives + 1 inactive pour P3)

Codes `DEMO-RULE-xx`, priorité = ordre ci-dessous (les plus spécifiques d'abord), année `from_filename` avec repli `current`.

| # | Nom | Critères (mots-clés de nom, OU ; type MIME si noté) | Cible |
|---|---|---|---|
| 01 | Bulletins de paie | `bulletin;paie;salaire` | DRH > Gestion du personnel > Paie et bulletins |
| 02 | Maintenance DSI | `maintenance;contrat` **et** source = DSI | DSI > SI > Contrats de maintenance (placée avant 03 : montre la priorité sur « contrat ») |
| 03 | Contrats et actes | `contrat;cdi;cdd;arrete;nomination;avancement` **et** source = DRH | DRH > … > Contrats et actes de carrière |
| 04 | Formation | `formation;seminaire;atelier` **et** source = DRH | DRH > … > Formation |
| 05 | Factures | `facture;devis;proforma` | DAF > Finances > Factures fournisseurs |
| 06 | Engagements | `mandat;engagement;ordonnancement;bon de commande` | DAF > Finances > Engagements et mandats |
| 07 | Marchés | `marche;appel d offres;dao;pv ouverture` | DAF > Finances > Marchés publics |
| 08 | Incidents | `incident;ticket;intervention;panne` | DSI > SI > Incidents et interventions |
| 09 | Courrier entrant (générique, dernière) | `courrier;lettre;correspondance;note` + MIME `application/pdf` | service source > Courrier et notes > Courrier entrant |
| 10 | **Inactive** : Rapports financiers | `rapport;bilan;etat financier` | DAF > Finances > Rapports financiers ; **créée puis activée en direct pendant P3** (simulation d'abord : ~15 documents « à revoir » basculent) |

Point d'attention : un `contrat_maintenance_climatiseurs_2025.pdf` déposé par la **DAF** n'a aucune règle (02 et 03 exigent une source DSI ou DRH) → « à revoir », cas montré en P6.

## 5. Procédure (ci-qa 0,75 j ; dev-backend 0,25 j si aucun endpoint d'import JSON des règles n'existe)

1. Script `scripts/demo-dataset.sh` (Docker, conteneur api) : `python -I scripts/test_real_export_v2.py` adapté → `frontend/e2e/data/demo-import/{DRH,DAF,DSI,live}/…` + `demo-manifest.json` ; sortie déterministe (`GED_EXPORT_SEED=237`) ; **corpus généré, non versionné** (`.gitignore`), seuls le manifeste et le script le sont (RAIDER-I : second run = mêmes fichiers, mêmes SHA-256).
2. Reset : `scripts/e2e-reset.sh` étendu d'un profil `demo` (vide documents / jobs / règles du tenant MINFI, rejoue le seed, importe les règles, lance l'import des 3 dossiers via l'API, applique corbeille / verrous / versions depuis `expected`).
3. Pré-OCRisation la veille (27/11), puis worker OCR arrêté pendant la présentation (DEC-003).
4. Vérification : le projet Playwright `smoke` compare les compteurs réels à `expected` ; rapport joint au walkthrough.
5. Livraison : walkthrough `DONE` avec le tableau réel obtenu (classés / à revoir / doublons) et le temps de reset mesuré.

## 6. Risques

- Les branches ci-qa ne sont pas encore poussées : le format du manifeste n'est connu que par la passation frontend. Si le schéma diffère, le jeu de démo s'aligne sur celui de ci-qa, pas l'inverse.
- Le script v2 écrit sur `E:/` : l'adaptation passe par une variable d'environnement, pas par une copie du script (RAIDER-R).
- Volume OCR : ~125 PDF image à OCRiser la veille ≈ 30–60 min avec Tesseract sur 2 cœurs ; à lancer avant la répétition du 27/11.
