# Relevé de coupure — mer 19/11 18:00 (gabarit)

- **Pour** : O (remplit à 18:00, en une passe, avec la commande § 3), I (reporte dans `CHANGELOG.md` « Limites connues » et `plan-presentation.md` § 3 le soir même), B/F/Q (lisent, ne contestent pas : non fusionné = V1.1). Innovateur, 2026-11-10, non commité ; numéros de PR relevés le 10/11 à 12:30 (`gh pr list`), rafraîchis le 14/11 à 12:45 (`main` 3cc6e15), puis le 16/11 à 19:45 (`main` ca9953b : fusions du 14/11 reportées avec leur SHA ; ouvertes : #99, #100, #108, #109 ; #107 fusionnée 7fa1ab8), à compléter pour les PR ouvertes d'ici le 19.
- **Règle** : une ligne est **TIENT** si chacune de ses PR requises est `MERGED` dans `main` à 18:00 (SHA du `mergeCommit` reporté) ; sinon elle **bascule en V1.1** telle quelle, sans exception ni « presque », et sa phrase « Limites connues » (colonne de droite, déjà écrite) entre dans `CHANGELOG.md`. Une PR e2e manquante ne fait pas basculer la ligne : la recette 20–23 la remplace (le scénario se joue à la main et se note `REC-nn`).
- **Colonnes à remplir** : État et SHA, par PR ; verdict de ligne.

## 1. Le relevé

| Élément | PR backend | PR UI | PR e2e | État à 18:00 (MERGED / OPEN, SHA) | Verdict | Si V1.1 : phrase « Limites connues » (prête) |
|---|---|---|---|---|---|---|
| Lot 1 — KPI doublons refusés (SC-V11-01) | #77 | #81 | — (recette manuelle) | #77 : MERGED ac77271  · #81 : MERGED 3f10054 | TIENT / V1.1 | Le tableau de bord n'affiche pas le nombre de doublons refusés ; il se lit dans le journal d'audit (action « doublon refusé ») ou sur l'écran Ingestion après un import. |
| Lot 2 — export / import des règles (SC-V11-02) | #79 | #84 | #91 (dépend de #79) | #79 : MERGED 96ea1fc  · #84 : MERGED a137d8d  · #91 : MERGED b228e7a | TIENT / V1.1 | Les règles de classement ne s'exportent ni ne s'importent : elles se saisissent une à une dans l'écran Règles (le simulateur reste disponible). |
| Lot 3a — export CSV du journal (SC-V11-03, 1re moitié) | #80 | #87 | — (recette manuelle) | #80 : MERGED dc4daae  · #87 : MERGED c6724ea | TIENT / V1.1 | Le journal d'audit se consulte à l'écran avec ses filtres, mais ne s'exporte pas en CSV. |
| Lot 3b — verrou après 3 codes OTP erronés (SC-V11-03, 2e moitié ; SC-AUTH-01 E3) | #83 | #88 (dépend de #83) | — (`auth-2fa` fixme E3 levé par la PR) | #83 : MERGED 64ade05  · #88 : MERGED 6669f2c | TIENT / V1.1 | Un code OTP erroné peut être ressaisi sans limite de tentatives ; la protection repose sur l'expiration du code et la limite de requêtes par minute. |
| Lot 4 — critères contenu OCR et année (SC-V11-04) | #92 (+ correctifs demandés le 10/11) | #95 (F, dépend de #92) | — (`v11-lots` fixme SC-V11-04) | #92 : MERGED aa1ff60  · #95 : MERGED fa26e17 | TIENT / V1.1 | Les règles ne lisent ni le texte OCR ni la date du document : classement par nom de fichier et dossier seulement. — Si TIENT, copier dans « Limites connues » : Limites de #92 (restent en V1.0) : un fichier passé par la file de revue d'import que rien ne classe à l'analyse ne crée pas de document, donc il n'est pas reclassé après OCR (seuls l'ingestion de dossier et le dépôt le sont) ; à l'ingestion, les règles sont évaluées avec la portée « service » : une règle à portée « utilisateur » ne s'applique jamais à un document ingéré ; les documents classés avant cette version ne sont pas reclassés. |
| Lot 5 — surveillance continue d'un dossier (SC-V11-05) | #101 (B, relue OK le 10/11) | #100 (F, statut « dossiers surveillés ») | — (`v11-lots` fixme SC-V11-05) | #101 : MERGED 3cc6e15  · #100 : … | TIENT / V1.1 | Aucun dossier n'est surveillé en continu : l'import se lance à la main depuis l'écran Ingestion. |
| D3 — journal d'audit : connexion, dépôt, import | #98 (B, relue OK le 10/11, à rebaser après #83) | — | — (`audit-trail` fixme D3 levé par la PR) | #98 : MERGED 351c82c | TIENT / V1.1 | Le journal d'audit ne trace ni les connexions, ni les dépôts, ni les imports : seuls la revue manuelle, les consultations, les doublons refusés, la corbeille et les versions y figurent. |
| Responsive — barre latérale sous 768 px (chaîne 42, juste après #82) | — | #93 | #89 (375 / 768 / 1280 px) | #93 : MERGED 6516d29  · #89 : MERGED 0fd5433 | TIENT / V1.1 | Sous 768 px de large, la barre latérale reste dépliée et recouvre une partie du contenu ; la démo se joue sur un écran ≥ 1280 px. |
| Version — numéro affiché dans l'application (D6) | `APP_VERSION` déjà sur `main` (#58) | #94 (`VITE_APP_VERSION`, repli « dev ») | — | #94 : MERGED 7bea1c0 | TIENT / V1.1 | Le numéro de version ne s'affiche pas à l'écran ; il se lit sur `/health` (réponse de l'API). |

| Aide V1.1 — icône « ? » (HelpHint) et tuile doublons | — | #99 (F ; les autres écrans arrivent par rebase au fil des fusions) | — | #99 : … | TIENT / V1.1 | Les écrans V1.1 n'ont pas d'icône d'aide : la tuile « Doublons refusés » et les nouveaux boutons se lisent sans infobulle. |
| Reconnexion — retour à la page quittée (SC-AUTH-02 E1) | — | #97 | — (`auth-2fa` fixme E1, à lever par Q) | #97 : MERGED 42397a3 | TIENT / V1.1 | Après une session expirée, la reconnexion ramène au tableau de bord et non à la page demandée : il faut y retourner soi-même. |
| Docs — manuel d'installation (item CDC 31 ; chaîne 46, après #103) | — | — | — (preuve = rejeu de Q sur pile vierge, noté dans la PR) | #105 : MERGED b6e0004  · #107 : MERGED 7fa1ab8 (corrections : une seule pile par hôte) | TIENT / V1.1 | Pas de manuel d'installation : la mise en place suit `README.md` § Démarrage rapide et `DOCS/exploitation/donnees-demo.md`. — Si V1.1, l'item 31 reste `partiel`. |
| Ops — sonde de disponibilité C6 (item CDC 29 ; `scripts/probe_c6.sh`) | — | — | — (preuve = relevés datés `recette/mesures-2026-11-20/c6.tsv`) | #106 : MERGED ca9953b | TIENT / V1.1 | Pas de sonde de disponibilité versionnée : la disponibilité n'est pas mesurée en continu ; l'item 29 reste `absent`. — Statut `partiel` le 19 avec ≥ 6 relevés verts, `fait` le 21 si 10/10. |
| Ops — profil HTTPS local (item CDC 27 ; nginx 443, certificat mkcert) | #109 (B) | — | — (preuve = `curl -sk https://localhost:8443/health` daté) | #109 : MERGED e1480c8 · #114 (lien vers https-local) : MERGED f90017c | TIENT / V1.1 | La démonstration est servie en HTTP ; aucun point de terminaison TLS n'est livré (écart annoncé, item 27 `absent`). — Sous réserve de la décision D6 (tranchée : démo en HTTPS). L'item 27 compte `fait` seulement quand Q a passé `prove_tls.sh` au vert sur le poste de démonstration ; sinon `partiel` (repli HTTP). |

Lignes hors fenêtre, pour mémoire (ne basculent pas, déjà tranchées) : `demo-counters` levé par #82 ; `validation-cycle` actif ; PR docs sans surface produit (#90 plan de recette, #96 checklist H-30, #103 leçons, #104 notes rc.1) : fusionnées avant le run 1 du jeu 20, pas de phrase « Limites connues ».

## 2. Ce que fait I le 19 au soir, à partir de ce tableau

1. Pour chaque ligne **V1.1** : copier la phrase dans `CHANGELOG.md` « Limites connues » (statut **V1.1**), retirer la ligne « corrigé avant le 19 » correspondante ; ajouter la phrase d'écart dans `plan-presentation.md` § 3 ; retirer le moment démo du `deroule-demo.md` s'il en dépend (lot 1 tuile, lot 2 export/import, lot 3a CSV, lot 4 « document importé », lot 5).
2. Pour chaque ligne **TIENT** : statut « corrigé » + SHA dans le CHANGELOG ; scénario SC-V11-0x activé dans `matrice-recette.md` (colonne État = à recetter le 20).
3. Commit docs unique (`docs(release): relevé de coupure du 19/11`) dans `../GED237-docs-notes-version`, PR sans surface CI, fusion par O avant le run 1 du jeu 20.

## 3. La commande qui remplit le tableau (O, 19/11 18:00)

```bash
# Dans le checkout, main à jour. Une ligne par PR : numéro, état, SHA de fusion (vide si OPEN), branche.
for n in 77 81 79 84 91 80 87 83 88 92 95 93 89 94 97 98 99 100 101; do
  gh pr view "$n" --json number,state,mergeCommit,headRefName,isDraft \
    --jq '"#\(.number) \(.state) \(.mergeCommit.oid // "-" | .[0:7]) \(.headRefName) draft=\(.isDraft)"'
done
# Ajouter à la liste les PR ouvertes d'ici le 19 (lot 5, D3) ; les numéros manquants se trouvent avec :
gh pr list --state all --search "lot 4 OR lot 5 OR audit" --json number,title,state --jq '.[] | "#\(.number) \(.state) \(.title)"'
# Contrôle : une PR MERGED dont le SHA n'est pas dans main n'est pas fusionnée (fusion sur une autre base).
git fetch -q origin && git merge-base --is-ancestor <sha> origin/main && echo "dans main"
```

Sources : `gh pr list --state open` (10/11 12:30) ; `innovateur/notes-version-v1.0.0-rc.1.md` « Limites connues » ; `innovateur/specs-v11-avant-gel/lot-*.md` ; `decisions/DEC-2026-002` (coupure du 19/11 18:00, révision du 10/11) ; `recette/plan-recette-20-23-11.md` § 1–2 ; message O du 10/11 (D6 → F, UI lot 4 → F, D3 → B après lot 4).

Ajout 16/11 (message O) : #116 (F, polices et icônes embarquées, écart 1 de l'audit HTTPS, partiel) est dans la file ; Tailwind fera l'objet d'une PR à part, go/no-go le 19 à 12:00. #115 (manuel d'installation § 1, dépendance Internet du navigateur) : docs seule. Statuts de #99, #100, #115, #116 : à relever le 19.

## 4. Passe du 19 à 18:00 : squelette (I, 17/11, `main` 0503181)

Heure de coupure : 19/11 18:00 heure du poste (UTC+1, `date +%z` = `+0100`) = **`2026-11-19T17:00:00Z`**. Toutes les commandes travaillent en UTC. Base de comparaison : `b64144f` (#140, fusionnée `2026-11-17T02:01:31Z`), celle du relevé préliminaire du taux CDC.

### 4.1 Commandes (O, une passe, dans un worktree ou un checkout à jour, lecture seule)

```bash
git fetch -q origin
CUT_Z=2026-11-19T17:00:00Z; REF=b64144f
# SHA de coupure : dernier commit de main (premier parent) avant l'heure de coupure
CUT=$(git rev-list -1 --first-parent --before="$CUT_Z" origin/main); git log -1 --format='%h %cI %s' "$CUT"
# Delta de main entre la base et la coupure
git log --first-parent --format='%h %cI %s' "$REF..$CUT"
# Même delta côté PR, dates de fusion en UTC (borne de départ = 1 s après la fusion de #140, exclue)
gh pr list --state merged --base main --limit 100 --search "merged:2026-11-17T02:01:32Z..$CUT_Z" \
  --json number,mergedAt,mergeCommit,title --jq 'sort_by(.mergedAt)[] | "#\(.number) \(.mergedAt) \(.mergeCommit.oid[0:7]) \(.title)"'
# État des PR rc.1 du § 4.2 (#188 = portée des rapports, B, issue #187)
for n in 174 175 208 121 104 188; do gh pr view "$n" --json number,state,isDraft,mergeCommit \
  --jq '"#\(.number) \(.state) draft=\(.isDraft) \(.mergeCommit.oid // "-" | .[0:7])"'; done
# Contrôle : aucune PR post-rc1 ni Dependabot fusionnée (sortie attendue : la phrase finale seule)
for n in 147 152 153 154 155 159 162 165 166 168 169 170 171 172 179 180 181 182 183 184 186 190 192 193 194 196 197 199 203 205 209 211 213 29 30 110 111 112 113 141; do
  gh pr view "$n" --json number,state --jq 'select(.state != "OPEN") | "#\(.number) \(.state)"'; done; echo "contrôle post-rc1 terminé"
# Nouvelles PR ouvertes depuis le 17/11 à classer dans le § 4.2
gh pr list --state open --limit 100 --search "created:>2026-11-17T08:50:00Z" --json number,isDraft,title --jq '.[] | "#\(.number) draft=\(.isDraft) \(.title)"'
```

### 4.2 PR rc.1 et post-rc1 (relevé du 17/11, `main` 0503181, mis à jour le 17/11 à 12:49 sur `main` b701314)

| Classe | PR | Attendu à 18:00 | État à 18:00 (MERGED SHA / OPEN) | Effet sur le taux CDC |
|---|---|---|---|---|
| rc.1, prêtes | #174 (recherche du bandeau, #163) ; #175 (menu Rapports du Manager, limité à son service) ; #208 (dernier `fixme` OTP) | MERGED, sinon V1.1 | `…` (déjà MERGED le 17 : #174 8e992c0, #175 74620fe, #188 c216141, #208 b701314) | 0 : aucun des 32 items (`Déduit`) |
| rc.1, B (décision PO du 17/11) | **#188** (B, issue sécurité #187) : `unit_admin` limité à son périmètre et `collaborator` en 403 sur `/reports/*`, signaux `imports_needing_review` et `local_organize_*` limités au périmètre du Manager (spec L12 § 2, #166) | MERGED, sinon V1.1 | `…` | 0 : aucun des 32 items (`Déduit`) ; si V1.1, phrase « Limites connues » : « Dans les rapports, l'admin de service et le collaborateur voient les chiffres de tout l'établissement ; deux signaux du Manager comptent aussi les autres services. » |
| rc.1, dernière fusion | #121 (version 1.0.0-rc.1 du frontend) | OPEN : elle fusionne juste avant le tag du 24 | `…` | 0 |
| rc.1, docs | #104 (cette PR) | OPEN, brouillon ; passe en prêt **après** cette passe | `…` | 0 |
| Déjà fusionnées depuis `b64144f` | #146, #128, #130, #131, #132, #142, #144, #143, #156, #158, #160, #164, #173, #178, #177 | MERGED | (sortie du delta § 4.1) | 0 : relevé préliminaire § 4 ; #177 (compteurs limités à ce que l'appelant peut lister) ne déplace aucun item (`Déduit`) |
| Post-rc1, brouillons | lots : #147, #152, #153, #154, #155, #159, #162, #165, #180, #183, #186, #192, #193, #196, #197, #203, #213 ; écrans : #181, #184, #190, #194, #199, #205, #209, #211 ; produit : #171 (vue doublons), #179 ; e2e : #168, #169, #170, #172, #182 ; docs : #166. #161 est fermée, remplacée par #197 (ordre de fusion : `plan-fusion-post-rc1.md` § 8.6, commit 1152a1a de la branche `docs/scenario-demo-30-11`) | OPEN | `…` | 0 pour rc.1. #171 fera passer l'item 19 de `partiel` à `fait` (+0,5) dans une version ultérieure, pas dans rc.1 |
| Gelées (dépendances, jusqu'au 30/11) | #29, #30, #110, #111, #112, #113, #141 | OPEN | `…` | 0 |

Une PR post-rc1 ou gelée trouvée MERGED = anomalie à signaler à O le soir même, pas une entrée du taux.

### 4.3 C6, item 29 (chiffres de Q)

Commande : `sh scripts/c6_summary.sh <chemin de c6.tsv donné par Q>` (demi-journées en UTC : matin avant 12:00Z, soir à partir de 12:00Z ; le relevé du soir du 19 se prend avant 17:00Z, la sonde s'arrête à la coupure).

| Demi-journée (UTC) | Relevés | 200 | Taux | KO et cause écrite | Verte ? |
|---|---|---|---|---|---|
| 2026-11-17 matin | `…` | `…` | `…` | `…` | `…` |
| 2026-11-17 soir | `…` | `…` | `…` | `…` | `…` |
| 2026-11-18 matin | `…` | `…` | `…` | `…` | `…` |
| 2026-11-18 soir | `…` | `…` | `…` | `…` | `…` |
| 2026-11-19 matin | `…` | `…` | `…` | `…` | `…` |
| 2026-11-19 soir (jusqu'à 17:00Z) | `…` | `…` | `…` | `…` | `…` |

- **Verte** : au moins un relevé, et 100 % de 200 hors KO expliqués écrits dans la colonne cause (`protocole-mesures-criteres.md` § C6).
- **À obtenir de Q avant le 19 à 12:00** : heure de reprise de la sonde après la panne du 17 (00:45) `…` ; heure UTC du premier relevé du 17 matin `…` ; cause de la panne `…`.
- **Verdict** : 6 demi-journées vertes consécutives → item 29 `partiel` ; sinon `absent`. `fait` n'est pas atteignable dans cette version : la campagne s'arrête au 19.

### 4.4 Taux CDC à 18:00

Formule : taux = (fait + 0,5 × partiel) / 32. Départ `b64144f` : 26 fait, 3 partiels (19, 27, 31), 3 absents (8, 28, 29) = 27,5 points = 85,9 %.

1. Item 29 : selon le verdict du § 4.3.
2. Items 27 et 31 : inchangés à 18:00 ; ils se prouvent aux passages du 20.
3. Autres items : aucun ne bouge si la colonne « Effet » du § 4.2 reste à 0. Une PR inattendue qui en déplace un s'écrit ici, avec sa preuve.

| Cas | Fait | Partiel | Absent | Points | Taux |
|---|---|---|---|---|---|
| C6 tenue | 26 | 4 | 2 | 28 | 87,5 % |
| C6 non tenue | 26 | 3 | 3 | 27,5 | 85,9 % |
| **Relevé du 19** | `…` | `…` | `…` | `…` | `…` |

Reports le soir même (I) : colonne « Statut 19/11 18:00 » de `innovateur/tableau-statuts-final-19-11.md`, puis `criteres-acceptation.md` et `plan-presentation.md` ; ensuite seulement, #104 passe en prêt (O la met en file).
