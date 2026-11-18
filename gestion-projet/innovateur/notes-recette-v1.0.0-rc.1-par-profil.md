# Ce qu'apporte la v1.0.0-rc.1, profil par profil

- **Pour** : le PO et les testeurs de la recette du 20 au 23/11.
- **Périmètre** : il n'y a encore aucun tag, donc tout ce qui est fusionné sur `main` depuis le début (169 PR au 18/11, dont une centaine qui changent quelque chose pour l'utilisateur ou l'installation). Les numéros entre parenthèses renvoient aux PR.
- **Ce document n'est pas les notes publiées.** Celles-ci arrivent avec #104 (`notes-version-v1.0.0-rc.1.md` et `CHANGELOG.md`), qui fait foi pour le tag.
- **Lignes en pointillé** : PR encore en attente le 18/11. On complète la ligne à la fusion, ou on la barre si la PR passe en V1.1.

## Pour tous les profils

- Connexion en deux temps : mot de passe, puis code à usage unique. Le code reçu peut être collé d'un coup (#336).
- Trois codes faux bloquent le compte 15 minutes, avec un compte à rebours à l'écran (#83, #88).
- Après une session expirée, on revient à la page qu'on avait quittée, et pas à celle d'un autre compte (#97, #123, #140).
- La recherche en haut de l'écran ouvre directement les résultats et ne perd aucune touche tapée (#174, #258). Elle ne montre que les documents qu'on a le droit de lire, et jamais ceux de la corbeille (#42).
- Libellés en français accentué, sans texte ni code brut du serveur à l'écran (#233, #257, #269, #286, #287, #341).
- Plus de fenêtres du navigateur (« alert ») : les confirmations passent par des dialogues de l'application (#339, #348).
- Les boutons qui ne faisaient rien sont retirés ou branchés (#314, #324, #334).
- « Paramètres » ne montre plus que les réglages personnels, sauf pour les administrateurs (#337).
- Version de l'application dans la barre latérale (#94) ; barre repliée sur les petits écrans (#93).
- L'interface fonctionne sans Internet : polices, images et avatars sont dans l'application (#116, #126, #146).

## Agent (rédacteur, collaborateur)

- Dépose ses documents. Un fichier trop gros est refusé avec un message clair (#52). Deux fichiers de même nom ne s'écrasent plus (#319), et les noms très longs passent (#321).
- Le texte des scans et des photos est lu (OCR), puis cherchable (#1, #325, #350). Voir les « Limites connues ».
- Explorateur des espaces : filtres, pagination, états vides (#38, #78) ; raccourcis clavier (#164) ; clic droit étendu (#173).
- Soumet un document à un circuit de validation, puis suit son état (#66, #341).

## Chef (manager)

- Vise ou rejette un document, avec un motif en cas de rejet. L'état se met à jour tout de suite (#66, #341).
- « Voir le document » depuis ses tâches. Il lit le document de l'étape qui lui est confiée, même s'il est d'un autre service (#340).
- Le menu « Rapports » et les compteurs se limitent à son service (#175, #177, #188).

## Administrateur d'unité

- Ne peut pas donner à quelqu'un un rôle plus élevé que le sien (#223).
- Supprime définitivement un document seulement s'il en a le droit (#345).
- ……… **en attente, #203** : il ne voit que son service et ses sous-services dans la liste, la recherche, les compteurs et les imports. ………
- ……… **en attente, #358** : même limite dans les rapports, les circuits, les imports, les revues et les règles. ………
- ……… **en attente, #360** : même limite sur les comptes et l'organigramme. ………
- Si ces trois PR ne sont pas dans la rc.1 (décision du 19 à 15:00), il voit encore tout l'établissement. C'est noté dans les « Limites connues ».

## Auditeur

- Entrée « Audit » dans son menu (#233).
- Le journal d'audit trace les connexions, les dépôts et les imports (#98).
- Exporte le journal filtré en CSV (#80, #87), jusqu'à 50 000 lignes.

## Lecteur

- Lit et cherche dans ce qu'il a le droit de voir, et seulement cela (#42, #47, #177).
- Réglages personnels seulement dans « Paramètres » (#337).

## Administrateur de l'institution (pour mémoire : il prépare la recette)

- Règles de rangement :
  - critères sur le texte lu et sur l'année du document (#92, #95) ;
  - l'année est aussi lue dans les noms de fichiers avec `_` (#76) ;
  - export et import des règles (#79, #84).
- Import de dossiers :
  - limité aux dossiers autorisés (#53) ;
  - dossiers surveillés, importés en continu (#100, #101).
- Tableau de bord : tuile « Doublons refusés » (#77, #81) ; compteurs sans la corbeille (#260).
- Archive des documents (#231, #246). Revue de classement avec des raisons lisibles (#287) ; filtre par structure (#346).

## Installation et exploitation (pour la personne qui installe)

- Démarrage sans Internet à partir d'images exportées (#144). Profil HTTPS local (#109). Redémarrage automatique après un arrêt du poste (#200).
- Sauvegarde et restauration de la base et des fichiers (#54, #62, #61).
- Modèles OCR (EasyOCR) inclus dans l'image, sans téléchargement (#325).
- ……… **en attente, #104** : notes de version publiées, `CHANGELOG.md` et page « Ce qui se règle où ». ………

## Limites connues

- **Le manuscrit n'est pas lu.** Seul le texte imprimé est reconnu, en scan ou en photo. Sur le banc du 18/11, le manuscrit photographié donne 1 à 10 % des mots.
- **Le moteur OCR se choisit par configuration** (`OCR_PRIMARY_ENGINE`), pas à l'écran. Par défaut, c'est Tesseract, avec EasyOCR en secours (#350). Pour en changer, on modifie la variable puis on relance le worker.
- ……… **RapidOCR** : dans la rc.1 seulement si sa PR est verte et relue avant le 19 à 16:00. Sinon, il arrive en V1.1. Le moteur de la démo est choisi le 20 à 09:00. ………
- Un seul moteur à la fois : pas de vote entre plusieurs moteurs (décision du 18/11).
- Les autres limites, comme les fonctions coupées par défaut et les écarts d'exploitation, sont dans les notes de #104, section « Limites connues ».
