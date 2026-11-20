# Fiche de décision du PO : vue « doublons » (#171), corbeille seulement

- **Pour** : le PO, présenté par O. Innovateur, 2026-11-17, d'après le corps et le code de #171 (brouillon, branche `feat/post-rc1-duplicates-view`) et `main` c216141. Rang 3 du carnet `carnet-suite-fonctionnalites.md` (item 19 du CDC, `partiel` : vue absente).
- **Calendrier** : #171 est gelée jusqu'au 30 (`plan-fusion-post-rc1.md` § 5). Cette fiche fixe la règle avant que F construise l'écran.
- `Vérifié` = lu dans le code ; `Déduit` = raisonnement ; `À vérifier` = à mesurer.

## 1. Ce que l'utilisateur fera

1. Il ouvre « Doublons » et voit des groupes de documents au contenu identique (même empreinte de fichier). Les plus gros groupes s'affichent en premier.
2. Pour chaque copie, il voit son titre, son service, son propriétaire, son type, son emplacement et sa date. Le plus ancien document est proposé comme celui à garder.
3. Il choisit le document à garder et valide.
4. Les autres copies partent à la **corbeille**, d'où elles peuvent être restaurées. Rien n'est effacé définitivement par cet écran.

L'API fait déjà tout cela (`Vérifié`, corps de #171). L'écran (F) n'existe pas encore.

## 2. Règle à décider : « corbeille seulement »

`Vérifié` : la route de #171 ne supprime jamais définitivement. La suppression définitive reste la purge de la corbeille par l'administrateur. La résolution d'un groupe se fait en tout ou rien : si une seule copie est refusée (droit, verrou, contenu différent), aucune ne bouge. Chaque copie mise à la corbeille laisse une trace dans le journal, avec le motif « doublon » et le document gardé.

**Recommandation : oui.** Une erreur de choix se rattrape par une restauration, et l'utilisateur n'a pas de nouveau geste à apprendre, puisqu'il connaît déjà la corbeille.

## 3. Cas limites

| Cas | Ce que fait #171 | Risque | Proposition |
|---|---|---|---|
| **Copies dans deux services** | Seuls les profils qui voient toute l'institution (administrateur, auditeur) voient le groupe entier. Un manager ou un lecteur ne voit que son service ; un collaborateur, ses propres documents (`Vérifié`). | L'administrateur garde la copie du service A : celle du service B quitte l'espace de B, **sans que B soit prévenu**. Seul le journal le trace. | En V1.0, l'accepter : l'administrateur seul résout entre services, la copie reste restaurable et le journal suffit. Prévenir le propriétaire de la copie mise à la corbeille en V1.1. |
| **Copie en cours de validation** | Aucun contrôle du circuit de visa dans la route (`Vérifié` : ni le point d'entrée ni le service ne lisent les validations). | Une copie dont le visa est en attente part à la corbeille, et le valideur garde une tâche sur un document disparu (`Déduit`). | Refuser de mettre à la corbeille une copie dont la validation est ouverte (refus explicite, rien ne bouge) ; l'utilisateur garde alors cette copie. Coût B ≈ 0,5 h-s, Q ≈ 0,25 h-s. |
| **Classement différent entre copies** | Le document gardé conserve son propre titre, son type et son emplacement. Les autres copies gardent les leurs, mais à la corbeille (`Vérifié`). | Garder la « mauvaise » copie, celle qui est moins bien classée. | L'écran montre l'emplacement et le type côte à côte, ce que l'API fournit déjà. Le document proposé reste le plus ancien, mais l'utilisateur peut choisir une autre copie. |
| Document verrouillé par un autre utilisateur | Refus, rien ne bouge (`Vérifié`). | Aucun. | Tel quel. |
| Lecteur | Il voit les groupes de son service, mais ne peut pas résoudre (`Vérifié`). | Aucun. | Tel quel. |
| Anciennes versions | Seule la version courante compte : une ancienne version identique à un autre document ne fait pas de groupe (`Vérifié`). | Des doublons « cachés » restent. | Tel quel en V1.0. Le dire dans l'aide de l'écran. |

## 4. À mesurer avant de construire l'écran

`Vérifié` : l'envoi d'un fichier refuse déjà un contenu présent ailleurs dans l'institution, et l'import de dossiers détecte les doublons. La vue sert donc surtout aux doublons **anciens**, ceux qui existaient avant ces contrôles ou qui sont revenus par une restauration (`Déduit`). Leur nombre fixe la valeur de l'écran.

**Proposé** : après le 24, Q compte les groupes avec `GET /api/v1/duplicates` (en-tête `X-Total-Count`), en lecture seule, sur la base de démonstration et, si le PO l'accepte, sur une copie du jeu réel du client.
- **0 groupe** : l'écran de F (reste du rang 3) passe derrière la sélection multiple (rang 7).
- **Sinon** : l'ordre du carnet tient.

## 5. Questions au PO

1. **Corbeille seulement** pour la vue « doublons » : oui ou non (recommandé : oui).
2. **Copies dans deux services** : en V1.0, l'administrateur résout seul, sans prévenir le propriétaire ; notification en V1.1 (recommandé : oui).
3. **Copie en cours de validation** : refuser sa mise à la corbeille (recommandé : oui, B ≈ 0,5 h-s, Q ≈ 0,25 h-s, avant la fusion de #171).

Phrase d'accord, à coller sur #171 :

> Accord PO du JJ/11 : vue « doublons » en corbeille seulement, sans suppression définitive. Entre deux services, l'administrateur seul résout en V1.0 ; le propriétaire est prévenu en V1.1. Une copie en cours de validation n'est pas mise à la corbeille. Fusion après le 30.
