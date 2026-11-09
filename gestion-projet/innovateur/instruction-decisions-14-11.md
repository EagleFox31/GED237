# Instruction des décisions D1–D6 du point du 14/11 (file 10)

- **Pour** : O (anime le point du 14/11, `gestion-projet/plans/point-2026-11-14.md` § 2), PO (tranche D1, D2, D5). Instruit par l'innovateur le 2026-11-09 soir ; `Vérifié` = lu dans le dépôt ou les passations ce jour ; `À vérifier le 13 au soir` = ce que O doit constater avant le point, la recommandation ne tient que si c'est constaté.
- **Lecture** : une ligne par décision = faits au 09/11 → ce qui doit être vrai le 13 au soir → options → **recommandation en une phrase** → ce qui change pour la présentation du 30/11.

## D1 — Attribution du jeu de démo (0,75 j)

- **Faits (09/11)** : `jeu-donnees-demo.md` § 5 : Q constitue (générateur `test_real_export_v2.py` adapté, `demo-manifest.json` au format du manifeste e2e, profil `demo` de `e2e_reset.sh`), B 0,25 j seulement si aucun import JSON des règles n'existe ; corpus `/data/ingest` monté en lecture seule (tranché 09/11). Q porte déjà le seed e2e (PR 2 en préparation) et OCR-0 (0,5 j) ; enveloppe Q S1 = 2 j + 0,5.
- **À vérifier le 13 au soir** : PR 2 seed de Q fusionnée ou au moins verte (sinon P8 et P2 n'ont rien à viser) ; existence d'un endpoint d'import des règles (`POST /rules` unitaire suffit : le script boucle).
- **Options** : (i) Q constitue, B 0,25 j si besoin ; (ii) B seul ; (iii) F.
- **Recommandation** : **(i)**, mais planifier la constitution **mar 18–mer 19** (pas jeu 20 comme DEC-002) pour que C2/C3 soient mesurables jeu 20 et que la restauration n° 2 du 20 soir porte sur le jeu de démo (`sauvegarde-restauration.md` § 6.3).
- **Présentation** : sans jeu de démo au 20, l'écart 1 (« chiffres non mesurés ») reste tel quel et la démo tourne sur le jeu e2e (400 fichiers synthétiques, codes `E2E-…` visibles à l'écran) : à éviter.

## D2 — Ordre de sacrifice si retard constaté

- **Faits (09/11)** : l'ordre DEC-002 était « 6 garde de routes → 5 sauvegarde automatisée → pagination ». Depuis : **#46 garde de routes ouverte, GUARD-01..06 6/6 verts** (plus rien à sacrifier) ; sauvegarde ramenée à **≤ 0,25 j** scripts maison, automatisation déjà reportée en V1.1 (`sauvegarde-restauration.md` § 6) ; **P8 coûte 0,7 j-p non prévus** (VAL-D1..D3 : B mar 10, F mer 11, e2e jeu 12) ; ingest-directory 0,25 j B non prévu ; VM à 11,7 Gio (la file Docker n'est plus un risque de délai).
- **À vérifier le 13 au soir** : #45/#46/#47 fusionnées ; PR `fix/workflow-pending-validators` et `fix/validation-cycle-ui` fusionnées ; 8 parcours verts en local (F5) ; budget § 4 rempli avec les +0,95 j-p (P8 0,7 + ingest 0,25).
- **Options** : (a) garder l'ordre DEC-002 tel quel (caduc) ; (b) nouvel ordre : **pagination P4 → « retour pour correction » P8 (déjà V1.1) → mesures C2/C3 repoussées au 27 → sauvegarde réduite à une seule restauration prouvée** ; (c) ne rien sacrifier et accepter le dépassement.
- **Recommandation** : **(b)**, en l'actant seulement si un glissement > 1 j est constaté le 14 ; la restauration prouvée et les 8 parcours ne se sacrifient jamais.
- **Présentation** : chaque sacrifice a déjà sa phrase d'écart (pagination : « tout tient sur une page » ; C2/C3 : écart 1 ; retour pour correction : écart 17).

## D3 — OCR-1 après OCR-0

- **Faits (09/11)** : DEC-003 = V1.1 par défaut ; `protocole-ocr-0.md` § 4 fixe les seuils ; budget 9,75/10 j-p avant les +0,95 j-p de P8/ingest : **aucune marge**.
- **À vérifier le 13 au soir** : OCR-0 exécuté par Q (14/11 prévu) ; sinon le point du 14 se tient sans le résultat et la décision reste V1.1.
- **Options** : V1.1 ; intégration avant gel.
- **Recommandation** : **V1.1 quel que soit le résultat** ; OCR-0 sert uniquement la réponse au jury (écart 14) et la réponse à Paperless (`sources/concurrents-ged.md` § 3).
- **Présentation** : écart 14 inchangé ; si OCR-0 est bon, ajouter la phrase « mesuré le 14/11 : … % de mots reconnus sur des scans simulés ».

## D4 — Limites auth e2e (#39) ↔ variables `AUTH_*_RATE_LIMIT`

- **Faits (09/11)** : B a livré `AUTH_LOGIN_RATE_LIMIT` / `AUTH_OTP_RATE_LIMIT` (défaut 5/minute) avec `tests/api/test_auth_rate_limit.py` (8 tests) et le walkthrough « DEBUG off et rate-limit auth configurable » (`PASSATION-dev-backend.md`) ; #39 (F) contournait la limite côté e2e ; compose de démo prévu à 30/minute (`checklist-demo.md` § A).
- **À vérifier le 13 au soir** : la PR B est fusionnée ; le compose e2e de Q déclare la variable (30/minute) et #39 ne porte plus de contournement.
- **Options** : une seule mécanique (variable dans les deux compose) ; garder deux mécanismes.
- **Recommandation** : **variable seule dans les deux compose**, défaut 5/minute en production ; la ligne de la checklist « pas plus de 4 connexions par minute » reste par prudence si la démo oublie la variable.
- **Présentation** : écart 12 (verrou de compte) inchangé : « connexions limitées à 5 par minute ».

## D5 — Suppression des 13 branches distantes

- **Faits (09/11)** : `branches-distantes.md` (`Vérifié` par `merge-base` et `gh pr`) : 19 branches hors `main`, **12 fusionnées + 1 fermée sans fusion supprimables**, 6 à garder (PR ouvertes). Aucune branche n'est référencée par un workflow ou un compose.
- **À vérifier le 13 au soir** : relancer le même relevé (`git fetch --prune`, `gh pr list --state open`) : les PR #45–#47 et les PR P8 auront bougé.
- **Options** : oui ; non ; plus tard.
- **Recommandation** : **oui, le 14 après le point, en deux temps** : `plan` (liste imprimée, 0 écriture) puis `apply` par O avec accord PO, et activer « Automatically delete head branches » pour ne plus y revenir ; les worktrees locaux qui pointent dessus sont supprimés par leurs sessions (`PASSATION-dev-frontend.md` l.149).
- **Présentation** : aucun effet ; hygiène avant la release (D6), évite des branches fantômes dans le `git log` montré au jury s'il demande à voir le dépôt.

## D6 — Release taguée (tranché A le 09/11)

- **Faits (09/11)** : `release-demo.md` option A : `v1.0.0-rc.1` le 24/11 (pré-release, `gh release create --target <sha>`), rc.2 au plus tard le 27 matin, `v1.0.0` après GO ; source de version unique `APP_VERSION` (`config.py`, défaut `0.0.0-dev`) injectée par le compose, `VITE_APP_VERSION` côté front ; `release-integrity` (SBOM + manifeste) ; images `docker save` sur clé USB (`checklist-demo.md` § A).
- **À vérifier le 13 au soir** : le bump de version est **assigné** (B : `APP_VERSION` + compose ; F : `VITE_APP_VERSION` + pied de page) dans une PR planifiée avant le 24 ; `/health` renvoie déjà `version` (`main.py:88`), il suffit qu'elle soit lue de l'environnement.
- **Options** : A tag manuel ; B Release Please ; C rien.
- **Recommandation** : **A confirmé** ; le 14, vérifier seulement que le bump est dans la file B/F de la semaine 2 et que O a le droit d'écrire les releases sur le dépôt (`gh auth status`).
- **Présentation** : le pied de page affiche `v1.0.0-rc.2` et `/health` la même valeur : réponse à « quelle version voit-on ? » ; la release GitHub est la preuve de gel montrable au jury.

## Synthèse pour O (à coller en § 2 du point)

| Déc. | Recommandation | Condition le 13 au soir |
|---|---|---|
| D1 | (i) Q constitue, B 0,25 j si besoin, constitution mar 18–mer 19 | PR 2 seed verte |
| D2 | nouvel ordre : pagination → retour pour correction → C2/C3 au 27 → une seule restauration ; **jamais** restauration prouvée ni 8 parcours | #45/#46/#47 + PR P8 fusionnées ; budget § 4 avec +0,95 j-p |
| D3 | V1.1 quel que soit OCR-0 | OCR-0 exécuté ou non : sans effet |
| D4 | variable seule dans les deux compose | PR B fusionnée, compose e2e aligné |
| D5 | oui, plan puis apply le 14, auto-delete activé | relevé branches refait |
| D6 | A confirmé, bump assigné B/F avant le 24 | PR bump planifiée |

## Sources

`gestion-projet/plans/point-2026-11-14.md` § 2, § 4 ; DEC-2026-002 § 2-3 ; DEC-2026-003 ; `innovateur/jeu-donnees-demo.md` § 5 ; `sauvegarde-restauration.md` § 6 ; `protocole-ocr-0.md` § 4 ; `branches-distantes.md` ; `release-demo.md` § 2-3 ; `checklist-demo.md` § A ; `PASSATION-dev-backend.md` (rate-limit, ingest), `PASSATION-dev-frontend.md` (#46, l.149) ; messages O du 2026-11-09 soir (file 8/9, P8 VAL-D1..D3).
