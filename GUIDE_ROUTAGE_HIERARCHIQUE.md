# Architecture du Routage Hiérarchique (Concepts Métier)

Ce document explique comment le moteur de règles GED237 gère la remontée hiérarchique sans multiplier inutilement les rôles en base de données.

## 1. Séparation entre "Rôle métier" et "Périmètre"

La logique métier de l'administration a été modélisée selon un principe fondamental : **Le rôle donne le droit d'action, le périmètre donne le niveau hiérarchique.**

### Le Rôle « Manager / Valideur » (ID: 4)
C'est le rôle universel de validation. Un agent avec ce rôle a l'autorisation de vérifier, approuver ou signer des documents.
- Il n'y a pas de rôles distincts pour `Chef`, `Sous-Directeur` ou `Directeur` dans la structure d'orchestration.
- Ce sont **tous** des Managers.
- Ce qui les différencie strictement, c'est **la position de l'unité organisationnelle qu'ils dirigent**.

## 2. Le Scope (Périmètre d'assignation)

Pour qu'un circuit (Template) aille chercher la bonne personne au bon niveau hiérarchique, il combine le rôle de base avec le **Scope**.

| Scénario dans le workflow | Rôle configuré | Scope (Périmètre) | Moteur de recherche |
| :--- | :--- | :--- | :--- |
| **Validation par le Chef de Service** | Manager | `Dans le même service` | Cherche le manager directement dans l'unité qui a émis le document. |
| **Approbation par le Sous-Directeur** | Manager | `Remonter au niveau parent (N+1)` | Ignore l'unité émettrice, monte d'un cran dans l'organigramme (Sous-Direction) et y cherche le manager. |
| **Signature par le Directeur** | Manager | `Remonter au niveau N+2` | Monte de deux crans dans l'organigramme (Direction) et y cherche le manager. |

## 3. Autres Rôles Système (Hors Hiérarchie Validation)

Le système comporte d'autres rôles qui servent à l'administration technique du système, mais qui n'interviennent pas dans la ligne hiérarchique de validation documentaire.

- **Administrateur du Service (ID: 3)** : Point focal IT ou responsable de la configuration applicative locale.
- **Collaborateur (ID: 5)** : Agent exécutant. S'il est au service informatique, c'est un agent informatique. S'il est aux RH, c'est un agent RH.
- **Haute Direction / Admin Tenant (ID: 2)** : Paramétrage global du ministère ou gestion de conformité haute.

*Note de conception : Si ces rôles apparaissent dans la construction du circuit, c'est uniquement parce que le système est agnostique et permet de faire intervenir un informaticien ou le Secrétaire Général pour des circuits spécifiques (ex: création de compte), mais un circuit classique "Note de service" s'appuiera à 100% sur le trio : Manager + Scope.*
