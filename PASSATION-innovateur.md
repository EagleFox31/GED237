# Passation — session innovateur

## 2026-11-09 18:06 — DEC-001/002, parcours de démo, plan de présentation, veille OCR

- Livré dans `gestion-projet/` : `decisions/DEC-2026-001`, `decisions/DEC-2026-002`, `innovateur/parcours-demo.md`,
  `innovateur/plan-presentation.md`, `innovateur/contexte-application.md` (révisé), `innovateur/sources/github-agents-skills.md`
  (ligne Unlimited-OCR). Les trois premiers partent en PR `docs/point-2026-11-09` depuis le worktree `../GED237-docs`
  (orchestrateur) : ne plus les modifier dans le checkout partagé avant fusion.
- Amendements DEC-002 envoyés à l'orchestrateur (adresse `uds:\.\pipe\LOCAL\cc-msg-eb4dfb372f123f17153bacb6dc2fb03f`) :
  rôles MAJUSCULES migration 001 (0,25 j, 11/11, obligatoire) ; verrou OTP abandonné → annoncé ; D3 journal d'audit
  login/upload/import (0,5 j, 12/11) ; D4 export journal annoncé V1.1. Budget 9,75/10 j. Sacrifice : 6 → 5 → pagination de 4.
- En attente PO : P8 (corbeille/version sans UI → recommandation cycle de validation), VPS/OCR, B6, liste annoncée.
- En cours : recherche approfondie OCR léger/CPU open source demandée par l'utilisateur (piste RapidOCR/PP-OCRv5 ONNX
  déjà identifiée, 0,5 j, remplacerait EasyOCR+torch dans `services/ocr/strategy.py`). Résultat à consigner dans
  `innovateur/sources/ocr-leger.md` puis proposer Adapt à l'orchestrateur.
- Règles : pas de code, pas de git, jamais `backend/`, `frontend/`, `.github/`.

## 2026-11-09 18:40 — veille OCR livrée, note starlette, DEC-002 acceptée

- DEC-2026-002 ACCEPTÉE par le PO avec amendements (PR #36 fusionnée 621e3d7) ; checkout partagé à jour, fichiers modifiables.
- Livré : `innovateur/sources/ocr-leger.md` (Adapt RapidOCR/PP-OCRv6 ONNX + Adopt OCRmyPDF, retrait EasyOCR/torch ;
  rien avant le 30/11 sauf OCR-0 mesure CER 0,5 j et pré-OCRisation du corpus la veille) ; note starlette dans
  `contexte-application.md` (6 CVE, aucune pré-auth, montée fastapi ≥ 0.133 / pydantic ≥ 2.7 estimée 1–1,5 j → V1.1,
  exception pip-audit datée 15/12) ; README indexé. Non commité : partira dans la prochaine PR docs de l'orchestrateur.
- Prochaine sollicitation prévue : point S1 du 14/11 ; questions PO ouvertes jusqu'au 17/11 (VPS/on-site, B6).
- Prochaine étape utile si sollicité : proposer OCR-0 à ci-qa (mesure sans code produit) et, si VPS retenu, OCR-1 en remplacement de l'ordre 6.

## 2026-11-09 18:55 — DEC-2026-003 RapidOCR acceptée par le PO

- PO a validé RapidOCR : `decisions/DEC-2026-003 - Moteur OCR leger RapidOCR en remplacement d EasyOCR.md` écrite en
  ACCEPTÉ ; lots OCR-0 (Q, mesure) → OCR-1 (B, moteur + retrait torch + couche texte + cache) → OCR-2/3 V1.1.
  Transmise à l'orchestrateur pour inscription au plan (OCR-1 avant le gel seulement si VPS retenu, à la place de l'ordre 6).
- Non commité ; prochaine PR docs de l'orchestrateur. En veille jusqu'au point S1 (14/11).

## 2026-11-09 19:00 — file de 4 tâches reçue de l'orchestrateur (consigne PO : enchaîner)

1. Dossier décisions PO (a) VPS vs on-site, (b) B6 garde de routes → `innovateur/decision-po-vps-b6.md` ; 2. triage Dependabot #35 ;
3. spéc jeu de données démo (20/11) ; 4. étude reuse-first sauvegarde/restauration (ordre 5). Un fichier par tâche, message orchestrateur avec chemin.

## 2026-11-09 19:15 — tâche 1 livrée : `innovateur/decision-po-vps-b6.md`

Reco (a) : démo sur place en Docker + poste de secours (VPS : 198 Mo libres, disque 77 %, compose ≈ 5,3 Go ; option C « URL vitrine » +1 j si le PO l'exige). Reco (b) : garde admin/non-admin seule (ordre 6, 0,5 j F mardi 18), 3 constats backend B6 → V1.1. Suite : tâche 2 (triage #35).

## 2026-11-09 19:28 — tâche 2 livrée : `innovateur/triage-dependabot-35.md`

#35 : zustand 5.1.0 et @playwright/test 1.65.0, deux mineurs, CI Gate verte → fusionner (0 j). Attention : branches ci-qa `ci/e2e-*` absentes du remote à 19:20 ; si elles épinglent une image Playwright, viser 1.65. Suite : tâche 3 (jeu de données démo).

## 2026-11-09 19:45 — tâche 3 livrée : `innovateur/jeu-donnees-demo.md`

Reuse : seed existant (DRH/DAF/DSI du MINFI), `test_real_export_v2.py` adapté (sortie par variable d env), manifeste au format ci-qa (`demo-manifest.json`, codes DEMO-…). 420 docs cible, 9 règles actives + 1 inactive pour P3, états déclarés (≈330 classés, 35–45 à revoir, 12 doublons, 8 corbeille, 3 verrous, 5 versions, 30 réservés au direct). Suite : tâche 4 (sauvegarde).

## 2026-11-09 19:55 — tâche 2b livrée (limite slowapi en démo) dans `parcours-demo.md` § 0

9 connexions / 10 OTP en 13 min, pic 3 connexions + 4 OTP par minute ; 5/min casse répétition et plan B → variables d env AUTH_LOGIN_RATE_LIMIT / AUTH_OTP_RATE_LIMIT, défaut 5/min, 30/min en démo et e2e. Message orchestrateur envoyé (tâches 2, 2b, 3). Suite : tâche 4.

## 2026-11-09 20:10 — tâche 4 livrée : `innovateur/sauvegarde-restauration.md` ; file des 4 tâches close

Adopt offen/docker-volume-backup v2.50.1 (labels archive-pre pg_dump -Fc + stop-during-backup, archive tar.gz base + storage_data, rotation) ; Build restore.sh (pg_restore --clean sur base vierge, volume restauré, contrôles vs MANIFEST.json). Cibles : sauvegarde < 5 min, restauration < 10 min ; B 0,75 j lundi 17, Q 0,5 j. README innovateur mis à jour (6 fiches). Message orchestrateur envoyé. En attente de la prochaine demande.

## 2026-11-09 20:20 — nouvelle file orchestrateur (3 tâches)

1. `innovateur/protocole-ocr-0.md` (benchmark OCR-0 pour ci-qa, exécution 14/11) ; 2. `innovateur/branches-distantes.md` (inventaire lecture seule, aucune suppression) ; 3. `innovateur/checklist-demo.md` (J-1/J0, cases à cocher, qui/quand). Message orchestrateur après chaque fichier. Les 7 fichiers précédents partent dans la PR docs de l orchestrateur.

## 2026-11-09 20:45 — tâches 1 et 2 de la nouvelle file livrées

`protocole-ocr-0.md` (corpus A synthétique dégradé + B réel, 4 configs, jiwer, memory.peak, seuils DEC-003, tableau) et `branches-distantes.md` (19 branches : 12 fusionnées + 1 fermée à supprimer sur accord PO, 6 gardées ; reco « auto delete head branches »). Reste : `checklist-demo.md`, puis README innovateur à compléter (3 fiches).

## 2026-11-09 20:55 — tâche 3 livrée : `innovateur/checklist-demo.md` ; file close

Checklist J-1/J0 par rôle (O/B/F/Q/P), hypothèse démo sur place, variante VPS en section F. README innovateur à 9 fiches. Orchestrateur informé (3 messages). Aucune écriture git ; rien dans backend/, frontend/, .github/. État : disponible, en attente de la prochaine file.

## 2026-11-09 21:00 — file 3 : propagation décisions PO (go tout : sur place + garde minimale) et point S1

1. Mettre à jour decision-po-vps-b6.md (TRANCHÉ 09/11), checklist-demo.md (hypothèse retirée, F sans objet), contexte-application.md (point 5, risque VPS), plan-presentation.md § 3 (écarts consolidés : B6 backend, D4, OTP lockout, starlette, OCR-1, identifiants démo dans LoginPage.tsx). 2. gestion-projet/plans/point-2026-11-14.md (attendus par rôle, preuve, décisions, colonne constaté vide). Message orchestrateur après chaque fichier ; file close ensuite.

## 2026-11-09 19:09 — file 3 livrée, file close

- Décisions PO (A sur place + B1 garde minimale) propagées : decision-po-vps-b6.md (TRANCHÉ 09/11), checklist-demo.md (A.1 coché, F sans objet), contexte-application.md (point 5, risque VPS levé), plan-presentation.md § 3 = 15 écarts consolidés (10 B6 backend, 12 verrou OTP, 13 starlette exp. 15/12, 14 OCR-1, 15 identifiants démo dans frontend/components/LoginPage.tsx) + § 4 ; README mis à jour. Aucun mot de passe recopié.
- Créé gestion-projet/plans/point-2026-11-14.md : attendus par rôle avec preuve, colonne Constaté vide, décisions D1–D5, glissements, budget.
- Signalé à O : numérotation écart OTP (DEC-002 dit 9, plan dit 12) à harmoniser. Deux messages envoyés à l orchestrateur. Rien en attente.
