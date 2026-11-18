# DEC-2026-006 — Corbeille : supprimer met à la corbeille, la purge définitive est réservée au super_admin

- **Statut** : BROUILLON, préparé par l'innovateur le 18/11 au soir, à la demande d'O. Publié le 19/11 avec DEC-2026-004 et DEC-2026-005.
- **Décideur** : le PO (18/11, rapporté par O à 17:28), sur la PR #152 (corbeille, lot L2, V1.1).
- **Sources** : description de #152 et relectures de Q (OK sur le code en e27e01c), `backend/app/core/authz/policy.csv` (branche de #152), `plan-fusion-v1.1.md` (§ 9).

## 1. Contexte

- Sur `main` (rc.1), `DELETE /documents/{id}` efface le document. Il n'y a ni corbeille côté serveur ni trace d'audit de la suppression (#185).
- #152 change ce comportement :
  - `DELETE` met le document à la corbeille, avec un audit `document_trashed` ;
  - la purge définitive (`DELETE /documents/{id}/purge`) et le vidage groupé (`POST /documents/trash/empty`) n'acceptent que des documents déjà à la corbeille ;
  - une purge automatique s'applique après `TRASH_RETENTION_DAYS`, désactivée par défaut (0).
- Dans #152, la purge est ouverte par la permission `documents purge`, donnée au tenant_admin (`policy.csv:59`, commit 4314625). Le super_admin l'a aussi, par `documents manage`.
- Le PO a demandé qui peut purger, puis a tranché.

## 2. Décision

1. **Supprimer met à la corbeille.** Le comportement de #152 est approuvé : document restaurable, suppression tracée, `DELETE` rejouable (204 si le document est déjà à la corbeille).
2. **La purge définitive, document par document ou par vidage de la corbeille, est réservée au super_admin.** Le tenant_admin perd `documents purge` : la ligne `policy.csv:59` est retirée.
3. **La purge de rétention ne change pas.** C'est une tâche du système, sans utilisateur, réglée par `TRASH_RETENTION_DAYS` (0 = désactivée). Le réglage reste à l'exploitant.
4. **Un document signé ou archivé n'est jamais purgé**, quel que soit le profil ou le chemin (unitaire, groupé, rétention) : réponse 409 `DOCUMENT_PROTECTED`, document non compté dans `remaining`.
5. **Écran** : en V1.1, les boutons « Supprimer définitivement » et « Vider la corbeille » sont masqués pour tout profil sans `documents purge`, donc pour le tenant_admin. Le super_admin purge par l'API seulement. L'écran Corbeille du super_admin, avec un sélecteur d'institution, passe en V1.2.

## 3. Pourquoi

- Une purge est irréversible : les fichiers sont retirés du stockage après le `commit`. Elle est réservée au profil qui administre la plateforme, pas à celui qui administre une institution.
- Pour l'institution, la corbeille garde ce que « Supprimer » promettait déjà dans l'écran (#301 : Suppr met à la corbeille). Rien n'est perdu par erreur.
- Avec la rétention désactivée par défaut, aucune donnée ne disparaît sans un geste explicite de l'exploitant ou du super_admin.

## 4. Conséquences

| Qui | Ce qui change | Porteur |
|---|---|---|
| tenant_admin | Peut mettre à la corbeille et restaurer ; ne peut plus purger ni vider la corbeille (403). | B : `policy.csv`, tests 403 |
| super_admin | Seul profil humain qui purge. Il désigne l'institution par un `tenant_id` explicite, pris en compte seulement avec `tenants manage` (§ 6). | B : route, tests |
| Écran Corbeille (#181) | Boutons de purge masqués sans `documents purge` ; écran super_admin en V1.2. | F |
| E2e L2 (#168) | Le cas « purge 200 par le tenant_admin » devient 403 ; le cycle complet de purge passe sous un compte super_admin, ou reste aux tests backend. | Q, B |
| Rétention | Inchangée (tâche système, défaut 0). | — |
| Relecture | Delta de #152 relu par Q avant la fusion : policy, tests, effet sur #168 et #181. | Q |
| Ordre | Après #401, avant la commande « premier administrateur » (O, 18/11). | O |

Les tests de `main` sur les droits de `DELETE` (#345) restent verts : les droits ne changent pas, seul l'effet change (corbeille au lieu d'effacement).

## 5. Retour arrière

- Redonner la purge au tenant_admin, c'est remettre la ligne `p, tenant_admin, documents, purge` et ses tests. Aucune migration n'est en jeu : la permission vient de `policy.csv`.
- Retirer le ciblage par `tenant_id` revient à ôter le paramètre des routes de purge : le super_admin ne purge alors plus que par la rétention automatique.
- Revenir à l'effacement direct par `DELETE` exige un revert de #152 et une nouvelle décision du PO, car la rc.1 n'a pas de corbeille côté serveur.

## 6. Ciblage de l'institution par le super_admin (point réglé le 18/11)

- **Constat** : les routes de purge filtrent sur le tenant de l'utilisateur (`Document.tenant_id == current_user.tenant_id`). Or le super_admin appartient au tenant PLATFORM. Tel quel, il ne pouvait purger aucun document d'une institution (constat de Q sur #168 : aucun compte du seed ne peut purger un document MINFI).
- **Choix retenu** (B, option 1 sur #152, rapporté par O le 18/11) : les routes de purge acceptent un `tenant_id` explicite. Il n'est pris en compte que pour un profil qui détient `tenants manage`, c'est-à-dire le super_admin. Pour tout autre profil, il n'élargit rien : le filtre reste le tenant de l'utilisateur.
- **Écran** : le super_admin purge par l'API en V1.1. Son écran Corbeille, avec un sélecteur d'institution, passe en V1.2 (décision 5).
- **À vérifier dans le delta relu par Q** : un test où un tenant_admin passe un autre `tenant_id` sans rien obtenir de plus, et un audit de purge qui nomme le tenant visé.

## 7. À remplir par O avant publication

- [x] Résultat de la vérification de B sur le ciblage du tenant (§ 6) et choix retenu : option 1 (O, 18/11).
- [x] SHA de #152 après le retrait de la ligne 59, et OK de Q sur le delta : **a47df85**, OK de Q ; OK du PO pour la V1.1, en tête de la vague 2 (O, 18/11).
- [ ] Le statut passe à « DÉCIDÉ le 18/11 (PO), publié le 19/11 à ‹hh:mm› ».
