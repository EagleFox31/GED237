# Brouillons de leçons (mémoire des échecs), 18/11

Ces brouillons iront dans `DOCS/engineering/lessons-learned.md` **après la coupe du 19/11, pas avant**. Ils suivent le même format que ce fichier.

Numéros (renumérotés le 18/11 à 15:15 ; 063 et 064 ajoutés le 18/11, source F, aucune branche distante ne les prend) : `main` s'arrête à 057 (#358 et #360 fusionnées). Les PR ouvertes de B prennent 058 (#365, repli OCR), 059 (#368, RapidOCR) et 060 (#370, robustesse OCR). Ces brouillons prennent donc **061 et 062**, après vérification sur toutes les branches distantes et les PR ouvertes. Il faut les revérifier au moment de l'insertion. La leçon sur le repli OCR est celle de #365 : pas de brouillon en double ici.

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

### LESSON-2026-063 — Pools d'adresses Docker épuisés : un KO e2e sans test en échec est un faux rouge

- **Date :** 2026-11-18
- **Catégorie :** CI locale / Docker
- **Statut :** proposed (surcharge compose et consigne de lecture des logs, à porter par F et Q)
- **Liens :** piles e2e lancées en parallèle par session, mémoire « charges Docker en parallèle » (3 au plus)

**Contexte** — Plusieurs sessions lancent chacune une pile compose e2e, jusqu'à 3 en parallèle. Compose crée un réseau par projet. Les pools d'adresses par défaut du démon Docker n'offrent qu'une trentaine de réseaux : les /16 de 172.17 à 172.31, plus 192.168.0.0/16 découpé en /20. Les réseaux des piles précédentes, jamais supprimés, s'y ajoutent.
**Échec / near miss** — Le démarrage d'une pile a échoué sur « all predefined address pools have been fully subnetted ». La passe e2e a été lue comme KO, alors qu'aucun test n'avait tourné : c'est un faux rouge. Le temps est passé à chercher une régression dans le code, pas dans l'environnement.
**Cause racine** — Les réseaux compose s'accumulent : la pile est arrêtée sans être supprimée, ou chaque session prend un nom de projet différent. L'adressage est laissé au pool par défaut. La conclusion « échec de test » a été tirée du code de retour, sans lire le log.
**Classification** — Environnement et diagnostic ; faux rouge ; répétable dès que plusieurs piles tournent sur le même poste.
**Résolution** — Constat et prévention transmis par F le 18/11. Le détail de la remise en état (réseaux libérés, passe relancée et son résultat) est à compléter par F avant l'insertion.
**Prévention** —
1. Chaque session déclare un sous-réseau fixe dans sa surcharge compose, par exemple `10.231.77.0/24` (un /24 distinct par session). La pile ne puise plus dans le pool par défaut.
2. En fin de passe, `docker compose -p <projet de session> down -v` est obligatoire. C'est valable pour les piles de session uniquement : la pile `edossier_*` reste gelée jusqu'au 22/11, sans `down -v` ni redémarrage.
3. Avant de conclure à un échec de test, on lit le log : un KO sans test en échec dans le rapport est classé « environnement », pas « régression ».
4. Contrôle vérifiable : le script e2e échoue avec un message explicite si le rapport ne contient aucun test exécuté. Cela distingue « pile non démarrée » de « tests rouges ».
**Leçon généralisée** — Un rouge sans test en échec n'est pas un résultat de test. Les ressources partagées d'un poste (réseaux, ports, noms de conteneurs) s'attribuent de façon fixe par session et se libèrent en fin de passe.

### LESSON-2026-064 — Boucle `echo | while read` : docker avale l'entrée standard et la passe s'arrête sans erreur

- **Date :** 2026-11-18
- **Catégorie :** scripts shell / outillage de recette
- **Statut :** proposed (règle d'écriture des boucles, à porter par F et Q)
- **Liens :** passes e2e en série sur une liste de PR

**Contexte** — Une passe de vérification parcourt une table de PR avec `echo "$table" | while read ...; do ...; done`. Le corps de la boucle appelle une commande docker.
**Échec / near miss** — La passe s'est arrêtée après 2 PR, sans erreur et avec un code de retour 0. Les PR suivantes n'ont pas été vérifiées, et rien ne le signalait.
**Cause racine** — La commande docker du corps de boucle hérite de l'entrée standard de la boucle. C'est le cas de `docker compose exec` sans `-T`, de `docker run -i`, et aussi de `ssh`. Elle lit donc le reste de la table, et le `read` suivant trouve une entrée vide : la boucle se termine normalement.
**Classification** — Outillage ; échec silencieux, un faux vert par omission ; répétable avec toute commande qui lit l'entrée standard dans une boucle `while read`.
**Résolution** — Constat et prévention transmis par F le 18/11. La relance complète de la passe et son résultat sont à compléter par F avant l'insertion.
**Prévention** —
1. On lit la table par un descripteur dédié : `while read -u 3 ...; do ...; done 3< fichier` (ou `3< <(commande)`). Sinon, on coupe l'entrée de chaque commande du corps : `docker ... </dev/null`, `docker compose exec -T`.
2. En fin de passe, on compare le nombre d'éléments traités au nombre de lignes de la table. Un écart fait échouer le script.
3. Contrôle vérifiable : une table de 5 lignes factices avec un corps qui appelle `docker compose exec` doit afficher 5 traitements.
**Leçon généralisée** — Une boucle qui se termine sans erreur n'a pas forcément tout traité. Toute boucle d'outillage compte ses éléments et isole son entrée standard des commandes qu'elle appelle.
