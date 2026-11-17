# Relevé préliminaire du taux CDC — mer 19/11 18:00 (prêt à remplir)

- **Pour** : O (remplit à 18:00), Q (fournit la synthèse C6 et les preuves), I (reporte dans `plan-presentation.md` et les notes). Innovateur, 2026-11-17, sur `main` b64144f. Complète `gestion-projet/plans/releve-coupure-19-11.md` (qui suit les lots, pas les 32 items du CDC).
- **Barème** : (fait + 0,5 × partiel) / 32. Niveaux : `Vérifié` = lu dans les walkthrough `[Innovateur] Taux CDC` du 10, 14 et 16/11 ou dans la liste des fusions ; `Déduit` = raisonnement. Libellés des items : `[Audit] Audit fonctionnel profond - 2026-11-09.md` § 2. Rien n'a été rejoué le 17/11.
- **Fusions depuis `main` 371c0a0** (`git log --merges`) : #127 (jeu P8), #129 (Dockerfile), #139 (manuel, hors ligne), #140 (compte). Aucune ne déplace un item (`Déduit`) ; #139 et #129 sont des prérequis du rejeu du manuel (item 31).

## 1. Taux acquis sur `main` b64144f

26 fait, 3 partiel (19, 27, 31), 3 absent (8, 28, 29) = **27,5 / 32 = 85,9 %**.

## 2. Les 32 items

| # | Item | Statut | Preuve | Bouge au 19 à 18:00 ? |
|---|---|---|---|---|
| 1 | Tri auto par règles (type, nom, date, contenu) | fait | #92 aa1ff60, #95 fa26e17 (critères contenu et année) | non |
| 2 | ≥ 95 % de documents classés | fait | #64, #82 : `recette/c2-2026-11-10.txt`, 357/357 | non |
| 3 | Priorité des règles + simulation | fait | audit 09/11, `/simulate` | non |
| 4 | Arborescence service > domaine > activité > année | fait | audit 09/11, `space_path_builder.py` | non |
| 5 | Espaces : filtres + pagination serveur | fait | #38 (API), #78 (écran) | non |
| 6 | Upload manuel | fait | audit 09/11 | non |
| 7 | Surveillance automatique d'un dossier | fait | #100 187b7f7 | non |
| 8 | 100 000 fichiers en < 20 min | absent | aucun test de charge, absent du protocole C2/C3/C6 (`Déduit`) | non |
| 9 | Authentification + rôles | fait | audit 09/11 ; #83, #88, #140 | non |
| 10 | Droits stricts par rôle et par service | fait | #42, #46, #47 | non |
| 11 | Journal des actions | fait | audit 09/11 ; export CSV #80 | non |
| 12 | Tags | fait (minimal) | audit 09/11 | non |
| 13 | Recherche avancée | fait | #42 (corbeille exclue) | non |
| 14 | Recherche < 2 s | fait | #82 : `recette/c3-2026-11-10.txt`, p95 27 ms | non |
| 15 | OCR | fait | audit 09/11 | non |
| 16 | Multi-lecture + verrouillage d'édition | fait | audit 09/11 | non |
| 17 | Versionnage | fait | audit 09/11 | non |
| 18 | Corbeille applicative | fait | audit 09/11 | non |
| 19 | Détection des doublons | **partiel** | blocage à l'upload et à l'import ; tuile #99 f89fce8 ; vue « doublons » absente | non |
| 20 | Tableau de bord (doublons, non classés, activité) | fait | #77 ac77271, #81 3f10054 | non |
| 21 | Export / import des règles | fait | #79 96ea1fc, #84 a137d8d, #91 | non |
| 22 | Workflows de validation / visa | fait | audit 09/11 ; jeu P8 #127 | non |
| 23 | Rapports (manager) | fait | audit 09/11 | non |
| 24 | Interface responsive | fait | **`Déduit`** : comptée `fait` dans le walkthrough du 16/11 ; rapport Playwright mobile à retrouver | non |
| 25 | Interface en français | fait | audit 09/11 | non |
| 26 | Limite de taille des fichiers | fait | #52 | non |
| 27 | HTTPS | **partiel** | #109 e1480c8, #114 f90017c ; preuve `prove_tls.sh` non faite | **non** : la preuve est au passage 2, le 19 à 19:30, après la coupure |
| 28 | Déploiement on-site + démo VPS | absent (« non vérifiable ») | décision du PO du 9/11, VPS écarté | non |
| 29 | Disponibilité ≥ 99 % | **absent** | sonde #106, #117 ; 19 relevés verts le 16/11 de 22:06Z à 23:40Z, hors fenêtre | **oui**, voir § 3 |
| 30 | Sauvegardes + restauration testée | fait | #54, #61, #62 ; `recette/restauration-2026-11-10.txt` | non |
| 31 | Docs utilisateur / admin / technique | **partiel** | #105, #107, #115 35425db, #139 ; rejeu réel de Q non fait | **non** : le rejeu est le passage 1, de 18:15 à 19:30, après la coupure |
| 32 | Front connecté à l'API | fait | audit 09/11 | non |

## 3. Item 29 et la panne de Docker de cette nuit

Critère retenu (`items-cdc-27-29-30.md`) : `partiel` le 19 si **≥ 6 relevés verts consécutifs, du 17 matin au 19 soir** (matin et soir, trois jours : six demi-journées exactement) ; `fait` seulement avec 10/10 au 21. Un KO expliqué ne compte pas mais s'écrit (`protocole-mesures-criteres.md` § C6).

| Constat (O, 17/11) | Effet sur l'item 29 |
|---|---|
| La sonde ne tourne plus depuis 00:45 ; la série est coupée après 19 relevés verts (16/11, 22:06Z à 23:40Z) | Ces 19 relevés sont **avant** le 17 matin : ils prouvent que le script marche, mais ne comptent pas dans les six. La coupure n'a donc aucun effet **si la pile et la sonde sont de retour avant le premier relevé du 17 matin**. |
| Pile et sonde relancées après le relevé du 17 matin | Il ne reste que cinq demi-journées (17 soir, 18 matin, 18 soir, 19 matin, 19 soir) : **l'item 29 reste `absent` à 18:00** (`Déduit`). Le sixième relevé tomberait le 20 matin, mais la sonde s'arrête le 19 à 18:00 (passage 0, mémoire du poste unique) : pas d'extension sans lever cette règle. |
| Relevé matin ou soir tombant sur un arrêt de la pile | KO : il faut une cause écrite ; s'il n'est pas « expliqué » au sens du protocole, l'item reste `absent`. |
| Dans tous les cas | `fait` (10/10 au 21) n'est plus atteignable : la campagne s'arrête au 19. L'item 29 vaut au plus `partiel` dans cette version. |

**À obtenir de Q avant le 19 à 12:00** : l'heure de reprise de la sonde, l'heure du premier relevé « matin » du 17, la cause de la panne. La panne est un presque-accident à consigner (contexte, cause, prévention) dans `DOCS/engineering/lessons-learned.md`.

## 4. Taux selon les sorties possibles

Base 27,5 (85,9 %). Les entrées sont indépendantes ; #144 (images hors ligne), #146 (garde-fou d'URL externes), #147 (`/health/ready`) et les réflexes Windows L1 et L2 ne correspondent à aucun des 32 items : **delta 0**, qu'ils soient dans la version ou non (`Déduit` ; à confirmer par O si le PO les rattache à l'item 31 ou 28).

**À 18:00 (relevé de coupure)** :

| Sortie | Points | Taux |
|---|---|---|
| C6 tenue (item 29 `partiel`) | 28 | **87,5 %** |
| C6 non tenue (item 29 `absent`) | 27,5 | **85,9 %** |

**Constaté le 20 à 12:00 (compte rendu), après les passages 1 et 2** :

| Item 29 | Item 27 (HTTPS prouvé) | Item 31 (rejeu sans écart) | Points | Taux |
|---|---|---|---|---|
| partiel | fait | fait | 29 | **90,6 %** (plafond) |
| partiel | un seul des deux | | 28,5 | 89,1 % |
| partiel | partiel (repli HTTP) | partiel | 28 | 87,5 % |
| absent | fait | fait | 28,5 | 89,1 % |
| absent | un seul des deux | | 28 | 87,5 % |
| absent | partiel | partiel | 27,5 | 85,9 % |

Lecture : le taux du 19 à 18:00 vaut 87,5 % au mieux ; le 90,6 % n'est observable que le 20. Un item déjà `fait` ne se perd que par régression constatée à la recette.

## 5. À remplir le 19 à 18:00

Saisie unique dans `gestion-projet/plans/releve-coupure-19-11.md` § 4 : commandes en UTC (§ 4.1), PR rc.1 et post-rc1 (§ 4.2), chiffres de C6 (§ 4.3), calcul du taux (§ 4.4). Le tableau ci-dessous en reprend le résultat.

| Champ | Valeur |
|---|---|
| SHA de coupure | `…` |
| Items 29 : relevés verts / attendus, pièce | `…` / 6, `c6.tsv` + synthèse (PR #142 si fusionnée) |
| Fusions entre b64144f et 18:00 qui déplacent un item | `…` (aucune attendue) |
| Taux du 19 à 18:00 | `…` fait, `…` partiel, `…` absent = `…` / 32 = `…` % |
