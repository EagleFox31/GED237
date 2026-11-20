# Vote OCR : note de décision préparée

Instruite le 18/11 par l'innovateur pour l'orchestrateur. Elle sert à décider en 10 minutes dès que les chiffres du banc v3 de Q arrivent (votes A, B et C, puis mesure VPS).

> **Mise à jour du 18/11 au soir.** #368 (RapidOCR) est fusionnée dans la rc.1 (9b32c30). Le critère du PO était qu'elle tienne en mémoire et lise mieux, et il est rempli (O). Il n'y a toujours **pas de vote** entre moteurs : cette partie de la note reste vraie. En revanche, le moteur par défaut dépend désormais du type d'image : RapidOCR pour les photos, les captures et les formulaires (`OCR_PRIMARY_ENGINE="rapidocr"`, `config.py:146`), Tesseract pour les scans, les PDF et en secours. Pour revenir à Tesseract partout, sans changement de code : `OCR_PRIMARY_ENGINE=tesseract`, puis redémarrage du worker. Les mentions « Tesseract par défaut » ci-dessous (§ 0, § 3, § 4) décrivent l'état d'avant la fusion.

## 0. Faits de départ

| Fait | Source | Niveau |
|---|---|---|
| main n'a pas de moteur RapidOCR : `OCR_PRIMARY_ENGINE` accepte `tesseract` ou `easyocr`, Tesseract par défaut ; worker en concurrence 1 | `backend/app/core/config.py:144`, #350 (dabeeb2) | `Vérifié` |
| Le vote suppose donc la PR RapidOCR de B (sorties et confiances des deux moteurs, sans vote) | O, 18/11 13:30 | `Déclaré` |
| Variantes du banc v3 : **A** garde, pour chaque page, le moteur de meilleure confiance moyenne ; **B** aligne les mots des deux moteurs et garde le plus sûr ; **C** fait voter 3 moteurs (Tesseract rapide, RapidOCR, Tesseract précis) sur la suite de mots de Tesseract | `bench3.py` du banc de Q | `Vérifié` |
| VPS, mesure du 18 au matin, par page : Tesseract rapide 3,5 s et 186 Mo ; Tesseract précis 5,2 s et 212 Mo ; RapidOCR 18,6 s et 760 Mo. RAM disponible au plus bas : 1 601 Mo | passation de Q, 18/11 11:10 | `Vérifié` |
| Plafond du worker sur la pile VPS : 1 200 Mo | `docker-compose.vps.yml` (#248, brouillon) | `Vérifié` |
| Banc local (lots de référence), rappel RapidOCR / Tesseract : photo 0,879 / 0,732 (1 page) ; photo de synthèse 0,966 / 0,888 (5) ; formulaires 0,743 / 0,465 (5) ; propre 0,879 / 0,867 (14) ; bruité 0,884 / 0,904 (11) | `rapport-v2-agg.txt` | `Vérifié` |

**Mesure retenue : le rappel pondéré par mot.** La recherche passe par un index plein texte (`tsvector`) : l'ordre des mots n'y compte pas, mais chaque mot manqué est un document introuvable. La **précision** sert de garde-fou, car un mot inventé donne un faux résultat de recherche. On ne compare pas le CER ordonné : RapidOCR le dégrade (ordre de lecture) sans effet sur la recherche.

## 1. Critères chiffrés

On compare chaque vote à **RapidOCR seul, sur les mêmes pages et dans le même passage** (ligne `rapid` de `vote.csv`), pas aux chiffres de la v2.

| # | Critère | Seuil | Pourquoi ce seuil |
|---|---|---|---|
| C1 | Gain de rappel sur les pages difficiles (photo, photo de synthèse et formulaires réunis, pondéré par mot) | **≥ +3 points** par rapport à RapidOCR seul | Avec 11 pages en tout, 1 point correspond à peu près à l'écart d'une page : en dessous de 3, on ne distingue pas le gain du bruit. La littérature annonce −33 % d'erreurs avec un vote ; sur un taux d'erreur de RapidOCR d'environ 10 à 13 %, cela fait 3 à 4 points. |
| C2 | Pas de régression | Rappel ≥ RapidOCR − 1 point sur les pages propres et bruitées ; **précision ≥ RapidOCR − 2 points sur chaque lot** | Le vote ne doit pas abîmer le cas courant (documents propres) ni inventer de mots. |
| C3 | Temps par page sur le VPS (2 vCPU, un document à la fois) | **Moyenne ≤ 30 s**, et délai maximal de 60 s par page | Estimation : A ou B ≈ 18,6 + 3,5 = 22 s ; C ≈ 18,6 + 3,5 + 5,2 = 27 s. À 30 s, les deux photos de la démo sont lues en 1 minute. |
| C4 | Pic mémoire du worker | **≤ 800 Mo** mesurés (`vote.peak`, puis VPS) | Il reste de la marge sous le plafond de 1 200 Mo pour Celery et beat. Les autres services du VPS gardent leur part (1 601 Mo disponibles au plus bas). Estimation : RapidOCR seul plafonne déjà à 760 Mo, et Tesseract tourne après lui avec le modèle encore en mémoire. Le pic dépend donc surtout de RapidOCR, avec seulement **40 Mo de marge**. Seule la mesure tranche. |
| C5 | En cas d'échec, retour à Tesseract | Exception, délai dépassé ou texte vide côté RapidOCR : on garde le résultat de Tesseract et on enregistre le moteur réellement utilisé. Le document ne reste jamais « en cours ». Si le processus est tué faute de mémoire, il passe en « échec » (#276), sans boucle de reprise. | Trois tests exigés dans la PR : exception, délai dépassé, texte vide. |

Les manuscrits (photos de messagerie) sont **hors décision** : les deux moteurs y restent sous 0,11 de rappel, et la démo n'en montre aucun (§ 12.3 du scénario). La ligne `results7` est seulement informative.

## 2. Arbre de décision

```
0. La PR RapidOCR de B est-elle verte et prête avant le 19/11 à 16:00 ?
   non → tout en V1.1 (le vote n'a pas de moteur sur lequel s'appuyer). FIN.
1. Pour chaque variante A, B, C : C4 (≤ 800 Mo) ?        non → variante écartée
2.                                C2 (régression, précision) ? non → variante écartée
3.                                C3 (≤ 30 s/page VPS) ?       non → variante écartée
4. Il reste au moins une variante ?                       non → vote en V1.1
5. Meilleure variante restante : C1 ≥ +3 points ?
   oui → V1.0, derrière l'interrupteur OCR_VOTE_MODE (off | page | mot | trois), DÉSACTIVÉ par défaut
   non → V1.1 (un gain sous 3 points ne justifie pas le risque avant le gel)
6. Dans tous les cas : B garde accessibles les sorties et les confiances des deux moteurs, sans migration avant le gel.
```

**Interrupteur désactivé par défaut : oui.**
- #350 vient de faire de Tesseract le moteur par défaut après les incidents de mémoire.
- Changer ce défaut après le gel reviendrait à livrer un comportement que la recette n'a pas parcouru.
- L'activation tient en une variable d'environnement et un redémarrage du worker, et elle est réversible sans reconstruire l'image.
- **Activation sur la pile de démo** : décidée avant le run 1 de la recette, **le 20/11 à 09:00**. Si on l'active, toute la recette tourne avec. Sinon, on ne l'active pas pour le 30.

**Premier signal**, résultats partiels du 18/11 à 13:40, lot propre seulement, 9 pages, en local :
- A = RapidOCR (rappel 0,934, précision 0,936) ;
- **B : rappel 0,951, mais précision 0,678.** B échoue à C2 : ses insertions et suppressions gardent les mots des deux moteurs, ce qui crée des doublons ;
- C : 0,933 en 50 s/page en local.

Rien n'est conclu avant les lots difficiles.

## 3. Risques pour la démo du 30 et pour le gel du 19 à 18:00

**Ce qui peut encore entrer avant le gel** (PR prête avant 16:00 pour laisser le temps à la file de fusion) :
- le moteur RapidOCR de B et, si l'arbre le permet, le vote, **tous deux derrière l'interrupteur désactivé** ;
- les tests unitaires du vote et les trois tests de secours (C5) ;
- l'exposition des sorties et des confiances des deux moteurs, sans migration.

**Ce qui ne peut plus entrer :**
- le changement du moteur par défaut ;
- toute migration de schéma ;
- toute modification de l'index de recherche (`postgres_engine.py`) ;
- toute modification des plafonds ou de la concurrence du worker ;
- tout réglage de seuil une fois la recette commencée.

Après le gel, seule la variable d'environnement peut encore changer, avec une décision avant le 20/11 à 09:00.

**Risques pour la démo :**

| Risque | Effet | Parade |
|---|---|---|
| Worker tué faute de mémoire pendant l'envoi en direct | photo non lue, recherche vide | Plan B du § 12.5 : `SCAN_0412.pdf` lu par Tesseract. Prérequis du worker (§ 12.1) avec l'interrupteur dans l'état prévu pour le 30. |
| Photos en attente derrière l'import en direct (concurrence 1) | lecture retardée de 28 × ~25 s | Envoyer les photos **avant** de lancer l'import (§ 12.2 : au début de l'étape 1) ; ne pas inverser. |
| Nouvelle lecture du corpus la veille, vote activé | durée inconnue (~25 s par page image) | À mesurer par Q sur le jeu de démo. Lecture lancée la nuit, worker éteint pendant la présentation (DEC-2026-003). |
| Vote activé sans recette complète | comportement non parcouru le jour J | Règle d'activation du 20/11 à 09:00 ci-dessus. |

## 4. Recommandation par défaut, si les chiffres arrivent après 16:00 le 19

1. **V1.0 sans vote.** Tesseract reste le moteur par défaut (#350 inchangé), et le vote passe en V1.1 avec les chiffres de Q.
2. La PR RapidOCR de B entre **seulement si elle est déjà verte et prête**, interrupteur désactivé. Sinon, V1.1 elle aussi.
3. **Démo** :
   - l'étape 5 bis se fait avec Tesseract. Sur les photos de synthèse, son rappel est de 0,888, et le mot `photocopieurs` apparaît trois fois dans D1 ;
   - la mesure de recette de Q (« Nouveau Document » pour `MINFI001`) confirme que la recherche le trouve ;
   - si la recherche échoue, plan B : `SCAN_0412.pdf`.

Pourquoi ce choix : il est réversible, il ne demande aucun code après le gel, et il ne prive la démo de rien, puisque le scénario a déjà son plan B.

## 5. Procédure de décision en 10 minutes

1. Agréger le passage (rappel et précision pondérés par mot, temps moyen) :
   ```bash
   awk -F, 'NR>1{k=$1"|"$2; n[k]++; t[k]+=$10; r[k]+=$7*$10; p[k]+=$8*$9; h[k]+=$9; s[k]+=$4}
     END{for(k in n) printf "%-22s n=%d rappel=%.3f precision=%.3f s/page=%.1f\n", k, n[k], r[k]/t[k], (h[k]?p[k]/h[k]:0), s[k]/n[k]}' vote.csv | sort
   cat vote.peak
   ```
   Pour C1, réunir les lots `photo`, `photo-synth` et `funsd-en` : même calcul, avec la clé `$1` seule, filtrée sur ces trois lots.
2. Remplir le tableau ci-dessous.
3. Suivre l'arbre du § 2. O écrit la ligne « Décision prise » dans sa passation et dans `PASSATION.md`.

| Variante | C1 gain sur les pages difficiles | C2 propre et bruité (rappel, précision) | C3 s/page VPS | C4 pic Mo | C5 tests | Verdict |
|---|---|---|---|---|---|---|
| A (page) | +0,0 pt (0,929 vs 0,929 RapidOCR seul) : échec | propre 0,930/0,934, bruité 0,920/0,929 (identique RapidOCR) : OK | local 25-29 s/page (charge parallèle), VPS non mesuré | 795 (cgroup, 3 moteurs) : OK | non lancés | Rejetée : C1 |
| B (mot) | +0,6 pt (0,935) : échec | propre 0,950/0,697, bruité 0,950/0,677 (précision -24 à -26 pts) : échec | local 25-29 s/page, VPS non mesuré | 795 : OK | non lancés | Rejetée : C1 et C2 |
| C (3 voix) | -15,1 pts (0,778) : échec (funsd 0,502 vs 0,749, photo-synth 0,830 vs 0,966) | propre 0,931/0,928, bruité 0,927/0,937 : OK | local 39-43 s/page, VPS non mesuré | 795 : OK | non lancés | Rejetée : C1 |

Vérification de l'innovateur, le 18/11 : j'ai recalculé les chiffres à partir de `results6/vote.csv` (216 lignes), avec le `awk` du § 5.
- **Pages difficiles** (photo, photo de synthèse et formulaires, rappel pondéré par mot) :
  - RapidOCR seul : 0,929 ;
  - A : 0,929 ;
  - B : 0,935 ;
  - C : 0,778.
- **Précision de B** : 0,697 sur les pages propres et 0,677 sur les pages bruitées, contre 0,934 et 0,929 pour RapidOCR seul. Soit −24 et −25 points.
- **Pic mémoire** : 794,7 Mo mesurés par le cgroup (818 Mo en RSS).

Les chiffres du tableau sont confirmés.

**Décision prise (O, le 18/11)** : aucune variante ne passe C1, donc pas de vote ni en V1.0 ni en V1.1.
- On garde RapidOCR seul, avec repli sur Tesseract (C5).
- Son entrée en V1.0 dépend toujours de l'étape 0 : PR verte avec l'OK de Q avant le 19/11 à 16:00.
- On ne reconsidère le vote qu'avec un vrai corpus de photos, car le lot « photo » ne contenait qu'une seule image réelle (voir `plan-v1.2.md`).
