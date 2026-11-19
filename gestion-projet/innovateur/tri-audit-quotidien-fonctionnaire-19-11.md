# Tri du rapport (G) « Quotidien fonctionnaire » du 19/11

Contexte : rapport de l'outil d'audit UX (G) du 19/11, fait sur `dd0436b5`, trié sur `87272fd3` (main du 19/11 à 09:47).

Lecture : h-s = heure de session ; F = frontend, B = backend ; « vague n » = rang dans `file-v1.1.md` ; les lignes citées sont celles de `87272fd3`. Les chemins courts sont sous `frontend/` (`components/`, `profiles/`, `lib/`) ou sous `backend/app/api/v1/endpoints/`.

| n° | constat (court) | statut | preuve ou PR | effort h-s | porteur | place |
|---|---|---|---|---|---|---|
| 1 | Dépôt : « règle d'aiguillage » n'est pas compris ; le mode « traitement » est coché d'avance | nouveau | `UploadDocumentModal.tsx:206` et `:31`. Aucune PR ne change ce texte. Garder le mot (c'est le nom de l'écran des règles) et ajouter une phrase simple | 0,25 | F | V1.1 après le 24/11, après #450 (même fichier) |
| 2 | Dépôt : un seul fichier à la fois | couvert en partie par #392 et #354 ; reste nouveau | #392 et #354 : « Déposer un autre », catégorie et mode gardés. Reste : plusieurs fichiers d'un coup (`UploadDocumentModal.tsx:62`), en boucle sur l'envoi existant | 2 | F | V1.1 après le 24/11, après #392, #354 et #450 |
| 3 | Dépôt : « Annuler » et « Envoyer » hors écran à 125 % | couvert par #450 | Empilée sur #441 | — | — | V1.1, vague 5 |
| 4 | Soumission : le dernier valideur n'est pas retenu | couvert par #393 et #362 | `DraftWorkspace.tsx:74`. Les deux PR font la même chose : doublon à trancher | — | — | V1.1, vague 5 |
| 5 | Pas de « Soumettre » depuis « Mes Documents » ni depuis la fiche | planifié, sans PR | `DocumentDetailModal.tsx:329`. Ligne 57 L12-1 du plan (2,5 h-s, aide-api, relu par F) : choix du valideur dans l'onglet « Circuit ». Aucune PR ni branche au 19/11 | déjà compté | — | V1.1 |
| 6 | Document rejeté : motif absent de la carte, pas de « Corriger et renvoyer » | couvert par #438, #440, #455 et #362 ; écran planifié, sans PR | Sur main, le motif se lit déjà dans l'onglet « Circuit » (`DocumentDetailModal.tsx:356-358`) et le serveur accepte le renvoi (`workflows.py:42`). Manque le bouton (`DraftWorkspace.tsx:129`) : ligne 57 L12-1 | déjà compté | — | V1.1, vague 1, puis 57 L12-1 |
| 7 | Pas de corbeille pour l'agent | couvert par #181 | Écran « Corbeille » et bouton dans la fiche ; serveur : #152 | — | — | V1.1, vague 0 |
| 8 | Deux écrans de tâches pour le chef ; « Valider » sans nuance sur `/tasks` | couvert en partie par #190 et #362 ; reste nouveau | #190 : une seule file à onglets. #362 : décider depuis la fiche ouverte. Reste : le libellé selon l'action (`WorkflowTasks.tsx:102`), repris de `ValidationHub.tsx:52-55` | 0,25 | F | V1.1 après le 24/11, après #190 |
| 9 | `/tasks` valide en un clic, sans confirmation | nouveau | `WorkflowTasks.tsx:98`. Reprendre la fenêtre de confirmation de `ValidationHub.tsx:114` | 0,5 | F | V1.1 après le 24/11 (change le geste de la recette et des tests : pas avant la démo) |
| 10 | Statut de tâche affiché en anglais | déjà corrigé sur main | `WorkflowTasks.tsx:89` ; `lib/workflowStepStatus.ts:4-12` | — | — | — |
| 11 | Cartes de tâches : ni expéditeur, ni service, ni ancienneté | couvert par #466 et #438 ; reste nouveau | #466 : « Envoyé par X le … à … » sur `/tasks`. Date déjà sur le tableau de bord du chef (`ValidationHub.tsx:88`). Retard « J+ » : ligne 57 L7-4, à ouvrir. Reste : l'expéditeur sur le tableau de bord du chef. Le service n'est dans aucune PR | 0,25 | F | V1.1 après le 24/11, après #438 et #466 |
| 12 | « Voir le document » ferait quitter la liste des tâches | déjà sur main (constat inexact) | `workflow/ViewDocumentButton.tsx:48` : la fiche s'ouvre par-dessus la liste. Décider depuis la fiche : #362 | — | — | — |
| 13 | Recherche du bandeau : rôle différent selon la page | couvert par #439 | `Header.tsx:47-58`. #439 : « Ce champ filtre cette page » et bouton « Chercher dans tous les documents » | — | — | V1.1, vague 1 |
| 14 | « Mes Documents » coupé à 100, sans compteur ni suite | nouveau (note partielle sur main) | `Documents.tsx:19`. Une note existe en bas de liste, en 9 px (`Documents.tsx:253-254`). Le serveur ne renvoie pas le total (`documents.py:883-908`). Reprendre l'en-tête de total déjà en place (`documents.py:122`) et la pagination du journal (#424, ouverte) | 0,5 (B) + 0,75 (F) | B et F | V1.1 après le 24/11 |
| 15 | Filtre « Rejeté » absent de « Mes Documents » | couvert par #440 | `Documents.tsx:190-194`. #440 : option « À corriger (rejeté ou renvoyé) » | — | — | V1.1, vague 1 |
| 16 | Connexion : institution à choisir chaque matin | couvert par #359 | `LoginPage.tsx:94` | — | — | V1.1, vague 5 |
| 17 | Code à 6 chiffres : rien ne se passe après le dernier chiffre | nouveau | `LoginPage.tsx:221-224`. Option simple : placer le curseur sur « Confirmer l'identité ». Pas d'envoi automatique : un code faux partirait sans relecture | 0,25 | F | V1.1 après le 24/11, avec #359 |
| 18 | Pas de « Renvoyer le code » | couvert par #154 et #219 | #154 : serveur ; #219 : bouton à l'écran | — | — | V1.1, vague 4 |
| 19 | Pas de compteur sur « Tâches & Suivi » | couvert par #442 | `Sidebar.tsx:91` | — | — | V1.1, vague 1 |
| 20 | Aucun message de succès après « Soumettre au visa » ou « Valider » | nouveau | `DraftWorkspace.tsx:71-75` ; `WorkflowTasks.tsx:36-41`. Aucune PR. Passer par le canal de messages existant, qui a déjà un niveau « info » (`lib/errors/ApiError.ts:12`) | 0,75 | F | V1.1 après le 24/11 |
| 21 | Textes de 8 à 10 px | nouveau, limité aux 9 écrans du parcours | Sur main : 60 textes sous 12 px sur ces 9 écrans, 580 dans toute l'application. La fenêtre de dépôt n'en a aucun | 1,5 | F | V1.1 après le 24/11, en dernier (après #441 et #450) |
| 22 | #453 : le chef de service reçoit un refus (403) sur la liste des agents | couvert par #453 et #445, correctif pas encore poussé | `profiles/manager/pages/DelegationsPage.tsx:78` (tête `6091935c`) appelle encore la liste complète. B ajoute une liste limitée au service dans #445, F branche l'écran | — | — | V1.1, vague 2 |

Le § 4 du rapport demande aussi de fusionner #450, #457, #462, #459 et #456 : toutes sont déjà dans la file (vagues 2 et 5).

## Risques pour la démo du 30/11 et la recette du 20 au 23

- Aucun constat ne bloque le scénario de démo ni la fiche de recette. Rien n'est à corriger sur main avant le 30/11.
- Validation en un clic sur « Tâches & Suivi » (n° 9). Un clic de trop consomme le document en attente chez le chef de service. La démo en a besoin (§ 5, n° 18) et la recette aussi (SC-VAL-03 demande un deuxième document en attente). Parade : préparer un document de rechange et toujours cliquer « Voir le document » d'abord.
- Dépôt (n° 2 et 3). Un fichier à la fois, la fenêtre se ferme après chaque envoi : la démo compte déjà deux ouvertures (0:30) et la recette écrit « deux fois ». À 1366×768 avec un zoom de 125 %, « Envoyer » est hors écran : projeter à 100 %.
- Document rejeté (n° 6). Sur main, le motif se lit dans l'onglet « Circuit de Validation » de la fiche, pas sur la carte, et aucun bouton ne permet de renvoyer. SC-VAL-04 attend exactement cela. Le dire aux testeurs, et ne pas promettre le renvoi en démo.
- Liste et recherche (n° 13 et 14). « Mes Documents » s'arrête à 100 et la barre du bandeau n'y filtre que la page. Un testeur peut croire un document perdu et noter un KO à tort. Parade : une ligne dans la consigne de recette. La démo est déjà protégée (filtre de statut à l'étape 8, recherche depuis les tâches à l'étape 5).
- Connexion (n° 17 et 18). Sur main, pas de « Renvoyer le code ». Si le code expire, on recommence la connexion. Gêne, pas blocage. Le défaut de #453 (n° 22) n'est pas sur main : sans effet sur la recette.

## Totaux

Nouveaux : 9 constats (n° 1, 2, 8, 9, 11, 14, 17, 20, 21), soit 6,5 h-s F et 0,5 h-s B. Déjà sur main : 2 (n° 10, 12). Couverts : 11, dont 9 par des PR ouvertes (n° 3, 4, 7, 13, 15, 16, 18, 19, 22) et 2 qui dépendent d'une ligne planifiée sans PR (n° 5, 6).

## À trancher par O

- Capacité : d'après `charges-v1.1.csv`, il reste 0,75 h-s à F et 0,45 h-s à B avant le 05/12. Les 6,5 h-s de F n'y tiennent pas. Aide-api garde environ 8 h-s de marge (à recalculer avec `charges.sh`) et fait déjà du front relu par F. Ordre conseillé : n° 9 et n° 20 d'abord (ils évitent une validation par erreur et un double dépôt), puis les quatre lignes à 0,25 h-s, puis n° 14 ; n° 2 et n° 21 en dernier.
- La ligne 57 L12-1 porte les n° 5 et 6, les deux impasses les plus gênantes du rapport. Elle n'a ni PR ni branche : à ouvrir dès le 24/11, après #438.
- #393 et #362 mémorisent toutes deux le dernier valideur, dans deux fichiers différents. En garder une seule avant la vague 5.
