# Relevé de coupure — mer 19/11 18:00 (gabarit)

- **Pour** : O (remplit à 18:00, en une passe, avec la commande § 3), I (reporte dans `CHANGELOG.md` « Limites connues » et `plan-presentation.md` § 3 le soir même), B/F/Q (lisent, ne contestent pas : non fusionné = V1.1). Innovateur, 2026-11-10, non commité ; numéros de PR relevés le 10/11 à 12:30 (`gh pr list`), à compléter pour les PR ouvertes d'ici le 19.
- **Règle** : une ligne est **TIENT** si chacune de ses PR requises est `MERGED` dans `main` à 18:00 (SHA du `mergeCommit` reporté) ; sinon elle **bascule en V1.1** telle quelle, sans exception ni « presque », et sa phrase « Limites connues » (colonne de droite, déjà écrite) entre dans `CHANGELOG.md`. Une PR e2e manquante ne fait pas basculer la ligne : la recette 20–23 la remplace (le scénario se joue à la main et se note `REC-nn`).
- **Colonnes à remplir** : État et SHA, par PR ; verdict de ligne.

## 1. Le relevé

| Élément | PR backend | PR UI | PR e2e | État à 18:00 (MERGED / OPEN, SHA) | Verdict | Si V1.1 : phrase « Limites connues » (prête) |
|---|---|---|---|---|---|---|
| Lot 1 — KPI doublons refusés (SC-V11-01) | #77 | #81 | — (recette manuelle) | #77 : …  · #81 : … | TIENT / V1.1 | Le tableau de bord n'affiche pas le nombre de doublons refusés ; il se lit dans le journal d'audit (action « doublon refusé ») ou sur l'écran Ingestion après un import. |
| Lot 2 — export / import des règles (SC-V11-02) | #79 | #84 | #91 (dépend de #79) | #79 : …  · #84 : …  · #91 : … | TIENT / V1.1 | Les règles de classement ne s'exportent ni ne s'importent : elles se saisissent une à une dans l'écran Règles (le simulateur reste disponible). |
| Lot 3a — export CSV du journal (SC-V11-03, 1re moitié) | #80 | #87 | — (recette manuelle) | #80 : …  · #87 : … | TIENT / V1.1 | Le journal d'audit se consulte à l'écran avec ses filtres, mais ne s'exporte pas en CSV. |
| Lot 3b — verrou après 3 codes OTP erronés (SC-V11-03, 2e moitié ; SC-AUTH-01 E3) | #83 | #88 (dépend de #83) | — (`auth-2fa` fixme E3 levé par la PR) | #83 : …  · #88 : … | TIENT / V1.1 | Un code OTP erroné peut être ressaisi sans limite de tentatives ; la protection repose sur l'expiration du code et la limite de requêtes par minute. |
| Lot 4 — critères contenu OCR et année (SC-V11-04) | #92 (+ correctifs demandés le 10/11) | #95 (F, dépend de #92) | — (`v11-lots` fixme SC-V11-04) | #92 : …  · #95 : … | TIENT / V1.1 | Les règles ne lisent ni le texte OCR ni la date du document : classement par nom de fichier et dossier seulement. — Si TIENT, copier dans « Limites connues » : Limites de #92 (restent en V1.0) : un fichier passé par la file de revue d'import que rien ne classe à l'analyse ne crée pas de document, donc il n'est pas reclassé après OCR (seuls l'ingestion de dossier et le dépôt le sont) ; à l'ingestion, les règles sont évaluées avec la portée « service » : une règle à portée « utilisateur » ne s'applique jamais à un document ingéré ; les documents classés avant cette version ne sont pas reclassés. |
| Lot 5 — surveillance continue d'un dossier (SC-V11-05) | #101 (B, relue OK le 10/11) | #100 (F, statut « dossiers surveillés ») | — (`v11-lots` fixme SC-V11-05) | #101 : …  · #100 : … | TIENT / V1.1 | Aucun dossier n'est surveillé en continu : l'import se lance à la main depuis l'écran Ingestion. |
| D3 — journal d'audit : connexion, dépôt, import | #98 (B, relue OK le 10/11, à rebaser après #83) | — | — (`audit-trail` fixme D3 levé par la PR) | #98 : … | TIENT / V1.1 | Le journal d'audit ne trace ni les connexions, ni les dépôts, ni les imports : seuls la revue manuelle, les consultations, les doublons refusés, la corbeille et les versions y figurent. |
| Responsive — barre latérale sous 768 px (chaîne 42, juste après #82) | — | #93 | #89 (375 / 768 / 1280 px) | #93 : …  · #89 : … | TIENT / V1.1 | Sous 768 px de large, la barre latérale reste dépliée et recouvre une partie du contenu ; la démo se joue sur un écran ≥ 1280 px. |
| Version — numéro affiché dans l'application (D6) | `APP_VERSION` déjà sur `main` (#58) | #94 (`VITE_APP_VERSION`, repli « dev ») | — | #94 : … | TIENT / V1.1 | Le numéro de version ne s'affiche pas à l'écran ; il se lit sur `/health` (réponse de l'API). |

| Aide V1.1 — icône « ? » (HelpHint) et tuile doublons | — | #99 (F ; les autres écrans arrivent par rebase au fil des fusions) | — | #99 : … | TIENT / V1.1 | Les écrans V1.1 n'ont pas d'icône d'aide : la tuile « Doublons refusés » et les nouveaux boutons se lisent sans infobulle. |
| Reconnexion — retour à la page quittée (SC-AUTH-02 E1) | — | #97 | — (`auth-2fa` fixme E1, à lever par Q) | #97 : … | TIENT / V1.1 | Après une session expirée, la reconnexion ramène au tableau de bord et non à la page demandée : il faut y retourner soi-même. |

Lignes hors fenêtre, pour mémoire (ne basculent pas, déjà tranchées) : `demo-counters` levé par #82 ; `validation-cycle` actif.

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
