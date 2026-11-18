# DEC-2026-007 — Délégation pendant une absence : le chef de service désigne l'intérimaire

- **Statut** : BROUILLON, rédigé par l'innovateur le 18/11 au soir, à la demande d'O. À publier avec les autres décisions de la V1.1.
- **Décideur** : le PO (18/11, rapporté par O), sur la ligne 57 L7-5 (audit UX Lot 7, point 5, V1.1).
- **Sources** : `plan-fusion-v1.1.md` (ligne 57 L7-5, § 4 ordre 9) et `plan-v1.1.md` (§ « Lots 7, 10 et 11 », § « Renfort aide-api »).

## 1. Contexte

- `main` ne prévoit pas de délégation. Quand un agent est absent, ses validations restent en attente : seul un administrateur peut les réassigner, à la main, tâche par tâche.
- L'audit UX Lot 7 (chef de service et auditeur) demande qu'un intérimaire puisse traiter ces validations pendant l'absence, avec une trace claire.
- La ligne 57 L7-5 était bloquée jusqu'à trois choix du PO : qui désigne l'intérimaire, quels droits il reçoit, ce que le journal trace.

## 2. Décision

1. **Le chef de service désigne l'intérimaire.** L'agent absent ne le fait pas lui-même, et l'intérimaire ne peut pas se désigner seul.
2. **Les droits de l'intérimaire se limitent à deux choses** :
   - les validations de l'agent absent ;
   - les documents liés à ces validations.

   Il ne reçoit ni les autres droits de l'agent absent ni l'accès à ses autres documents.
3. **La délégation a des dates fixes**, un début et une fin. Elle cesse d'elle-même à la date de fin.
4. **Le chef de service peut la révoquer** à tout moment. La révocation prend effet tout de suite.
5. **Le journal** :
   - chaque action de l'intérimaire y apparaît sous la forme « par X au nom de Y » ;
   - la création et la révocation de la délégation y sont aussi enregistrées.

## 3. Pourquoi

- Le chef de service connaît les absences et la charge de son service. Une désignation par l'agent absent ne marche pas pour une absence imprévue.
- Limiter l'intérimaire aux validations en cours garde le moindre privilège : il traite l'urgence sans accéder à tout le dossier de l'agent.
- Des dates fixes et la révocation empêchent qu'une délégation oubliée reste ouverte.
- La forme « par X au nom de Y » permet à l'auditeur de savoir qui a réellement validé.

## 4. Conséquences

| Qui | Ce qui change | Porteur |
|---|---|---|
| Serveur | Table des délégations et colonne « au nom de » dans le journal, dans une migration d'ordre 9 (fin de chaîne, après l'ordre 8 « recherche sans accents »). Droits limités aux tâches du circuit de l'agent absent et aux documents liés. Créer, lister, révoquer ; fin automatique à la date de fin. | aide-api (O, 18/11) |
| Écran | Écran de délégation pour le chef de service : désigner, dates, révoquer. Mention « au nom de » dans les tâches et dans le journal. | aide-api (O, 18/11, proposition 3) |
| Tests | Isolation : l'intérimaire ne voit rien en dehors du périmètre délégué, ni avant le début, ni après la fin ou la révocation ; aucune délégation entre deux institutions. Audit de la création, de la révocation et de chaque action. | aide-api ; relecture sécurité par Q |
| Charge | aide-api : une note de conception (1 h-s), puis la réalisation (6 à 7 h-s). Le chiffrage de l'écran est à recevoir. | O |

## 5. Points à confirmer avant de coder (non tranchés par le PO)

Ces points sont proposés, pas décidés. aide-api les fixe dans sa note de conception et O les valide.

- **Rôle du chef de service** : le profil `manager` sur son propre service. Le `tenant_admin` peut-il aussi désigner un intérimaire ? À vérifier.
- **Choix de l'intérimaire** : par défaut, seulement un agent du même service ou de la même institution, jamais d'une autre institution.
- **Redélégation** : par défaut, l'intérimaire ne peut pas redéléguer.
- **Validations en cours au début de la délégation** : sont-elles toutes incluses, ou seulement celles qui arrivent pendant la période ? Par défaut : toutes celles de l'agent absent tant que la délégation est active.

## 6. Retour arrière

- Révoquer toutes les délégations rend tout de suite à chaque agent ses seules validations. Le journal garde les actions faites « au nom de ».
- Retirer la fonction passe par un revert de la PR et une migration descendante de l'ordre 9. Les lignes « au nom de » déjà écrites dans le journal sont conservées.
