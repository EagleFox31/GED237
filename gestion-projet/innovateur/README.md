# Base de connaissance de l'Innovateur

Dossier tenu par la session `innovateur` (voir `../EQUIPE_AGENTS.md`). Chaque fiche porte une date de
consultation et un niveau de preuve (`Vérifié` / `Documenté` / `Déduit` / `Proposé`, cf.
`../REGLES_DE_TRAVAIL.md`). Les décisions instruites ici sont consignées dans `../decisions/DEC-*`.

| Fiche | Contenu |
|---|---|
| `parcours-demo.md` | 8 parcours de démo cibles (rôle, étapes, UAT, spec Playwright, données), 12 candidats classés, 3 décisions demandées |
| `contexte-application.md` | Ce qu'est GED237, état réel au 2026-11-09 (audit fonctionnel intégré), risques, ce qui reste pour le 30/11 |
| `plan-presentation.md` | Déroulé 20 min du 30/11, messages ISO 15489, 15 écarts annoncés consolidés le 09/11, questions du jury |
| `decision-po-vps-b6.md` | Dossier PO **tranché le 09/11** : démo sur place (A), B6 garde minimale (B1), constats backend en V1.1 |
| `triage-dependabot-35.md` | PR #35 (zustand 5.1.0, @playwright/test 1.65.0) : fusionner |
| `jeu-donnees-demo.md` | Jeu de démo du 20/11 : arborescence, 420 documents, états, 10 règles IFTTT, procédure ci-qa |
| `sauvegarde-restauration.md` | Ordre 5 : Adopt offen/docker-volume-backup + `restore.sh` prouvé sur base vierge, plan 0,75 j B + 0,5 j Q |
| `protocole-ocr-0.md` | Benchmark OCR-0 pour ci-qa (14/11) : corpus, 4 configurations, CER jiwer, pic mémoire, seuils DEC-003, tableau |
| `branches-distantes.md` | Inventaire des 19 branches distantes : 13 supprimables sur accord PO, 6 gardées ; aucune suppression faite |
| `checklist-demo.md` | Cases à cocher J-1 / J0 (qui, quand) : DEBUG, limites auth, corpus pré-OCRisé, worker éteint, poste de secours, sauvegarde, plan B, comptes |
| `sources/anthropic-agents.md` | Sources primaires sur les équipes d'agents, harness, contexte |
| `sources/github-agents-skills.md` | Dépôts GitHub d'agents, skills, outils : évaluation Adopt/Adapt/Learn/Build |
| `sources/ocr-leger.md` | Veille OCR CPU 2026-11-09 : comparatif, architecture légère (RapidOCR/PP-OCRv6 + OCRmyPDF, retrait EasyOCR), lots OCR-0..4 |
| `sources/ged-normes.md` | Normes GED/archivage (ISO 15489, MoReq2010) et contexte Cameroun |

Règles du dossier : une fiche par sujet, URL + date pour chaque affirmation externe, mise à jour en
place (pas de doublon), jamais de secret ni de donnée personnelle.

À compléter en S1 : analyse du CDC (`DOCS/engineering/*.pdf|docx`) en critères d'acceptation,
concurrents (Alfresco, Nuxeo, Paperless-ngx, Maarch) pour positionner la démo, trame de présentation.
