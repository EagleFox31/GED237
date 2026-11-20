# Fiche de décision du PO : ce que voit un responsable d'unité (#195)

- **Pour** : le PO, présenté par O avant que B termine sa PR brouillon. Innovateur, 2026-11-17, d'après l'issue #195, `main` c216141 et l'état de la branche donné par B le 17/11.
- **Qui est concerné** : le profil `unit_admin`, appelé ici « **responsable d'unité** » (par exemple le responsable d'un service et de ses bureaux).
- **État de la branche** (B, 17/11) : `feat/post-rc1-195-unit-admin-scope`, **en local seulement**. Elle part de la tête de #196 (e760d79) et n'a pas encore de commit propre. B la pousse après ses tests. Elle fusionne donc **après #196**, et après le 30 (`plan-fusion-post-rc1.md` § 7).
- `Vérifié` = lu dans `main` ; `B` = annoncé par B pour sa branche, pas encore lisible.

## 1. Aujourd'hui : il voit tout l'établissement

`Vérifié` : `documents.py` l. 90 et `imports.py` l. 44 rangent `unit_admin` parmi les administrateurs, donc parmi les profils qui lisent toute l'institution.

| Écran | Effet pour un responsable d'unité aujourd'hui |
|---|---|
| Liste des documents | Il voit les documents de **tous les services**, pas seulement du sien. |
| Recherche | Ses recherches trouvent aussi les documents des **autres services**. |
| Compteurs du tableau de bord | Ses chiffres comptent **tout l'établissement**. |
| Imports | Il voit les imports de **tous les services**. |
| Rapports | Il ne voit que **son service et ses bureaux** (depuis #188). |

Les rapports et le reste ne suivent donc pas la même règle : un responsable d'unité trouve en recherche des documents qu'il ne retrouve pas dans ses rapports.

## 2. Ce que #195 propose : son service et ses bureaux, partout

Une seule règle : le responsable d'unité voit **son unité et toutes les unités qui en dépendent**.
- `B` : la règle est calculée à partir du rattachement de chaque unité à son unité mère.
- `Vérifié` : la table qui devait contenir cette hiérarchie n'est jamais remplie (`documents.py` l. 363).

| Écran | Effet pour un responsable d'unité avec #195 |
|---|---|
| Liste des documents | Il ne voit plus que les documents de son service et de ses bureaux. |
| Recherche | Ses recherches ne trouvent plus rien en dehors de son service et de ses bureaux. |
| Compteurs du tableau de bord | Ses chiffres ne comptent plus que son service et ses bureaux. |
| Espace de travail (`B`) | Il peut ouvrir n'importe quel bureau de son service. Une unité hors de son service lui est refusée. |
| Imports (`B`) | Il voit les imports qu'il a lancés et ceux destinés à son service ou à ses bureaux, et il peut les valider. |
| Rapports | Pas de changement : c'est déjà la règle. |

**Ce que le responsable d'unité perd** : la vue d'ensemble de l'établissement. Elle reste à l'administrateur de l'institution et à l'auditeur.

## 3. Ce qui reste hors de #195 (inchangé)

| Point | Effet pour un responsable d'unité, même avec #195 |
|---|---|
| Ouverture d'un document par son lien direct | S'il a le lien d'un document d'un autre service, il peut encore l'ouvrir. |
| Modifier, déplacer, mettre à la corbeille | Ses droits de modification ne changent pas. Ils suivent les règles de droits actuelles, pas la règle du sous-arbre. |
| Importer pour le compte d'un autre agent | Il peut toujours lancer un import au nom de **n'importe quel agent de l'établissement** (`Vérifié`, `imports.py` l. 107). |
| Tableau « vue de l'institution » (`/analytics/tenant`) | Il garde accès aux chiffres de **tout l'établissement** (`Vérifié`, `analytics.py` l. 16-27). |
| Classement automatique et chemins des espaces (`B`) | Ils lisent encore la table de hiérarchie vide. Une issue de B est demandée par O. |

Avec #195 seule, il reste donc trois portes vers les autres services : le lien direct, l'import au nom d'un autre et la vue de l'institution. #195 aligne ce qu'il **voit en parcourant**, pas encore tout ce qu'il **peut atteindre**.

## 4. Questions au PO (réponse oui ou non)

1. Le responsable d'unité doit-il voir **seulement son service et ses bureaux**, en liste, en recherche, dans les compteurs et dans les imports, comme dans ses rapports ? (Recommandé : **oui**.)
2. Faut-il fermer aussi, **en V1.1**, les trois portes restantes : le lien direct, l'import au nom d'un agent d'un autre service et la vue de l'institution ? (Recommandé : **oui**, dans une PR distincte après #195.)
3. Un responsable d'unité a-t-il parfois besoin de **chercher dans tout l'établissement** dans son travail réel, par exemple pour retrouver un courrier mal classé ? (Si oui, il faut prévoir une autre voie avant de fusionner #195 : demande à l'administrateur, ou un profil dédié.)

Phrase d'accord, à coller sur #195 :

> Accord PO du JJ/11 : le responsable d'unité (`unit_admin`) voit seulement son service et ses bureaux, en liste, en recherche, dans les compteurs, les imports et les rapports. Le lien direct, l'import au nom d'un autre agent et la vue de l'institution seront fermés en V1.1, dans une PR distincte. Fusion après #196 et après le 30.
