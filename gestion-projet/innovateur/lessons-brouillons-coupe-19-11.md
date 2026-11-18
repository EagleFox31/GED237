# Brouillons de leçons (mémoire des échecs), 18/11

Ces brouillons iront dans `DOCS/engineering/lessons-learned.md` **après la coupe du 19/11, pas avant**. Ils suivent le même format que ce fichier.

Numéros (renumérotés le 18/11 à 15:15) : `main` s'arrête à 057 (#358 et #360 fusionnées). Les PR ouvertes de B prennent 058 (#365, repli OCR), 059 (#368, RapidOCR) et 060 (#370, robustesse OCR). Ces brouillons prennent donc **061 et 062**, après vérification sur toutes les branches distantes et les PR ouvertes. Il faut les revérifier au moment de l'insertion. La leçon sur le repli OCR est celle de #365 : pas de brouillon en double ici.

### LESSON-2026-061 — PR de base entrée dans la file alors que trois PR la ciblaient encore

- **Date :** 2026-11-18
- **Catégorie :** process / file de fusion
- **Statut :** proposed (contrôle à ajouter par O dans le script de file)
- **Liens :** `gestion-projet/innovateur/runbook-coupe-19-11.md` § 8.2 (étape 1) et § 8.4, PR #203, #358, #266, #241

**Contexte** — Il n'y a pas de file de fusion GitHub. Un script d'O met la branche à jour, attend que le CI Gate soit vert, puis lance `gh pr merge --merge`. Le ruleset ne protège que la branche par défaut. Le 18/11, #203 (`feat/post-rc1-195-unit-admin-scope`) est entrée dans la file alors que #358, #266 et #241 avaient encore cette branche comme base.
**Échec / near miss** — La relecture du runbook (§ 8.2, étape 1) l'a détecté, et O a reciblé les trois PR sur `main` avant la fusion. Sans cela :
- si la branche avait été supprimée à la main (`git push --delete`), les PR qui la ciblent auraient pu être fermées. GitHub ne retarget automatiquement que si la branche est supprimée après la fusion de sa PR ([changelog GitHub, 19/05/2020](https://github.blog/changelog/2020-05-19-pull-request-retargeting)). Ici, `delete_branch_on_merge` vaut `false` ;
- **risque plus probable, et silencieux** : les trois PR restent ouvertes sur une branche déjà fusionnée. Leur fusion ultérieure atterrit sur cette branche et pas sur `main`, hors du ruleset, donc sans CI Gate obligatoire. Les changements manquent alors à la release sans aucune erreur.
**Cause racine** — Le script de file ne regarde que la PR à fusionner, pas les PR qui dépendent de sa branche. Le reciblage des PR empilées était une règle orale (mémoire « re-cibler avant fusion »), sans contrôle automatique.
**Classification** — Processus ; near miss ; répétable à chaque pile de PR. La règle de reciblage existait déjà, mais sans contrôle : il faut donc un contrôle plus fort.
**Résolution** — #358, #266 et #241 reciblées sur `main` par O le 18/11, avant la fusion de #203. #360 et #361 restent sur la branche de #358, à recibler avant que #358 fusionne.
**Prévention** — Dans le script de file, avant `gh pr merge` : `gh pr list --repo $REPO --base <headRefName> --state open --json number -q 'length'` doit renvoyer `0`. Sinon, refus avec la liste des PR à recibler. Vérifiable : lancer le script à blanc sur #358 tant que #360 la cible, il doit refuser.
**Leçon généralisée** — On ne fusionne jamais une branche qui sert encore de base à une PR ouverte. Le contrôle doit être dans l'outil de fusion, pas dans la mémoire de l'opérateur : une PR qui cible une branche non protégée échappe aux contrôles obligatoires.

### LESSON-2026-062 — Procédure d'exploitation écrite par déduction : le rejeu a trouvé un écart

- **Date :** 2026-11-18
- **Catégorie :** documentation / exploitation
- **Statut :** proposed (point à ajouter à la grille de relecture de Q)
- **Liens :** `DOCS/exploitation/donnees-demo.md` (étape 2), PR #363, `docker-compose.yml` (`name: edossier`, `container_name: edossier_*`)

**Contexte** — La remise à zéro du jeu de démo sur la pile complète a été écrite à partir de la lecture de `docker-compose.yml`, sans l'exécuter. Le texte le disait (« procédure déduite, pas encore rejouée »).
**Échec / near miss** — Le rejeu de Q (18/11 : 26 s, 408 documents) a buté sur un cas que la lecture n'avait pas vu : une autre pile tourne déjà sur le poste. La première correction proposée, lancer avec un autre nom de projet (`-p`), était elle aussi déduite et elle ne suffit pas. `container_name` fixe le nom du conteneur quel que soit le projet, donc les noms `edossier_*` restent en conflit. La version poussée sur #363 demande une copie du fichier sans `container_name`, avec `-p` et un autre `APP_PORT`.
**Cause racine** — Une procédure d'exploitation déduite a été traitée comme une procédure prête. La correction est passée par le même chemin (déduction), sans rejeu.
**Classification** — Documentation ; near miss, corrigé avant la fusion ; répétable sur toute procédure d'exploitation (installation, remise à zéro, sauvegarde, test hors ligne).
**Résolution** — #363 corrigée (dbca5d0) avec le résultat du rejeu et la note sur une pile concurrente. La même correction est reportée sur `docs/scenario-demo-30-11` et dans le runbook (f5f5d25). La note sur `-p` reste à rejouer par Q.
**Prévention** —
1. Aucune procédure d'exploitation (`DOCS/exploitation/`, runbooks, protocoles) n'est fusionnée sans la mention explicite « rejouée le JJ/MM : résultat » ou « non rejouée ».
2. Q vérifie ce point dans sa grille de relecture.
3. Une correction de procédure suit la même règle que la procédure : elle est rejouée, ou marquée « non rejouée ».
4. Contrôle plus fort, à décider : un hook pre-commit ou un job CI qui échoue si un fichier modifié sous `DOCS/exploitation/` ne contient ni « rejouée le » ni « non rejouée ».
**Leçon généralisée** — Une procédure qu'on n'a pas exécutée est une hypothèse. Elle le dit, et on ne la fusionne qu'avec l'état de son rejeu. Le correctif d'une procédure est lui aussi une procédure.
