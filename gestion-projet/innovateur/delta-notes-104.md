# Ajouts aux notes de version de #104 (push unique du 19/11 après 18:00)

- **Cible** : `gestion-projet/innovateur/notes-version-v1.0.0-rc.1.md` sur `docs/notes-version-rc1` (tête locale 8eca6b0), dans le worktree des notes.
- **Report** : par I, propriétaire de #104 d'après le runbook (§ 8.2, étapes 10 et 11), dans le push de 18:00. Ce fichier n'est pas publié.
- **Méthode** : les PR fusionnées sur `main` au 18/11 14:45 (169), moins celles déjà citées dans les notes ou dans `CHANGELOG.md` de 8eca6b0. Il en reste 29 ; leur ventilation est ci-dessous. Les plages de type « #7–#33 » couvrent déjà les montées de version de dépendances.
- **Le 19 vers 16:30** : remplir le § 4 selon ce qui est fusionné. Puis refaire le calcul sur la tête de `main` notée à 17:15, pour attraper les fusions de l'après-midi.
- **`CHANGELOG.md`** : il doit concorder avec les notes (plan du tag, § 3). Les mêmes lignes vont dans sa section `## [1.0.0-rc.1]`.

## 1. Fonctionnalités (à ajouter en fin de section)

- Connexion : le code à 6 chiffres peut être collé d'un coup (#336).
- Lecture des photos et des scans : modèles OCR inclus dans l'image et chargés à la demande, sans téléchargement au premier usage (#325). Moteur principal Tesseract par défaut, choisi par `OCR_PRIMARY_ENGINE` (#350). Le repli vers EasyOCR est coupé par défaut (`OCR_FALLBACK_ENABLED`, #365).
- Circuit de validation : la personne assignée à une étape lit le document, même s'il est d'un autre service (#340). « Voir le document » est disponible depuis ses assignations, et l'état est relu après un visa ou un rejet (#341).

## 2. Corrections (à ajouter en fin de section)

- Dépôt : chaque envoi a son propre fichier stocké, et deux fichiers de même nom ne s'écrasent plus (#319). Les noms très longs sont raccourcis pour tenir dans la limite du système de fichiers (#321).
- Écrans par rôle :
  - les commandes sans action sont retirées ou branchées (#314, #324, #334) ;
  - l'aide et l'assignation du parcours de démonstration sont corrigées (#336) ;
  - filtre par structure, changement de mot de passe, onglets des agents et libellés de revue (#346).
- Fenêtres natives du navigateur remplacées par les dialogues de l'application sur les écrans d'administration (#339). Elles sont désormais interdites par une règle de lint et par une garde dans les tests e2e (#348).
- « Paramètres » ne montre plus que les réglages personnels aux profils non administrateurs (#337).
- OCR : le worker tourne avec un seul processus, pour ne plus dépasser sa mémoire avec un moteur lourd (#350). Le repli automatique vers EasyOCR, qui faisait tomber le worker par manque de mémoire, est coupé par défaut (#365).
- OCR : une lecture interrompue peut être relancée côté serveur, sans redéposer le fichier ; procédure dans `DOCS/exploitation/relancer-ocr.md` (#369).

## 3. Sécurité (à ajouter en fin de section)

- Suppression définitive d'un document réservée aux profils qui ont le droit `delete` ou `delete_own` (#345).

## 4. Limites connues

### 4.1 À remplacer tout de suite

Ligne actuelle :

> - OCR léger uniquement ; le moteur complet est hors budget machine (DEC-2026-003).

Nouvelles lignes :

> - L'écriture manuscrite n'est pas lue : seul le texte imprimé est reconnu, en scan ou en photo.
> - Le moteur OCR se choisit par configuration (`OCR_PRIMARY_ENGINE`), pas à l'écran : Tesseract par défaut (#350), sans repli vers EasyOCR sauf si `OCR_FALLBACK_ENABLED` est activé (#365). Pour en changer, on modifie la variable puis on relance le worker. Un seul moteur à la fois : pas de vote entre plusieurs moteurs (décision du 18/11).

### 4.2 À compléter le 19 vers 16:30 (une seule des deux variantes par ligne)

| Sujet | Si la PR est fusionnée avant 17:15 | Si elle passe en V1.1 |
|---|---|---|
| #203, #358, #360 (périmètre de l'Admin Service) | **Fusionnées le 18/11 (17498b5, 4fcd8d9, 8ceae3b)** : variante à appliquer. Remplacer la ligne « L'Admin Service : ses documents et sa recherche couvrent toute l'institution… (#215) » par : « L'Admin Service ne voit, ne cherche et ne compte que les documents de son service et de ses sous-services (#203). Même limite pour les rapports, les circuits, les imports, les revues et les règles (#358), et pour les comptes et l'organigramme (#360). » Puis déplacer la ligne de Limites vers Sécurité. | Ligne actuelle conservée. Remplacer « prévu en V1.1 (#215) » par « prévu en V1.1 (#203, #358, #360) ». |
| RapidOCR | Fonctionnalités : « Photos, captures et formulaires lus par RapidOCR ; Tesseract en secours (#368). » Seulement si Q a validé la vraie photo de démo. Limites : « Moteur de la démonstration fixé le 20/11 (`OCR_PRIMARY_ENGINE`). » | Limites : « RapidOCR, moteur plus léger pour les photos, est reporté en V1.1. » |
| #363 (fichiers OCR de la démo, remise à zéro sur la pile complète) | **Fusionnée le 18/11 (9843e2f)** : ligne à ajouter telle quelle. Documentation : « Remise à zéro du jeu de démonstration sur la pile complète, rejouée le 18/11, et fichiers de l'étape photo (#363). » | — (sans objet) |
| #375 (fiche d'astreinte backend pour la recette) | Documentation : « Fiche d'astreinte backend pour la recette (#375). » | — (sans objet : document interne, rien dans les limites) |
| `fix/v10-lot5-ux` (F, 8 à 10 corrections UX ; repli : points a à e) | Corrections : une ligne qui résume les points fusionnés, avec le numéro de PR. Texte à reprendre de la description de la PR à 16:30 | Lots non fusionnés : la ligne d'O la couvre |
| #356 (tests e2e seuls) | Rien à ajouter : aucun effet visible | — |
| Lots non fusionnés | Remplacer « relevé O reporté ici le 19 au soir » par la liste d'O. Cette ligne doit être complète avant le tag (plan du tag, § 3 : aucun texte d'attente). | idem |

## 5. Autres sections (facultatif)

- Documentation : installation en séquence de l'image backend (#327) ; EasyOCR indisponible : redémarrer le worker (#328) ; mémoire d'échecs (#317) ; grille de relecture et fiche de décisions du 10/11 (#85, #86).
- Recette et CI : limites de débit d'authentification relevées sur la pile e2e (#74).
