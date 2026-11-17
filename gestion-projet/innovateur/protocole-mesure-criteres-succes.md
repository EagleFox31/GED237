# Protocole de mesure des critères de succès après mise en service : temps de recherche et adoption

- **Pour** : le PO (décide les définitions et la date de la mesure de départ), O (planifie), Q (prépare la grille et la requête), le client (fait les mesures sur site). Innovateur, 2026-11-17, d'après le carnet `carnet-suite-fonctionnalites.md` § 3 (PR #166) et `main` c216141.
- **Source des critères** : *Expression de besoin* (`Phase de Conception/Expression De Besoin Orientée Application – Organisation & Ged Familiale.pdf`), § 6 « Critères de succès » :
  - « Réduction de 70% du temps moyen de recherche documentaire » ;
  - « Adoption par 90% des collaborateurs dans les 3 premiers mois ».
- **Hors recette du 30/11** : ce ne sont pas des critères de la démonstration. Les trois autres critères du § 6 sont déjà couverts : classement (C2), latence (C3) et droits (C4) dans `criteres-acceptation.md` et `protocole-mesures-criteres.md`.
- `Vérifié` = lu dans `main` ; `Déduit` = raisonnement ; `À vérifier` = à confirmer avant la mesure.

## 1. Le point urgent : mesurer le départ avant l'installation

On ne peut prouver « − 70 % » que contre une mesure **d'avant**, prise quand les agents cherchent encore dans les armoires, les classeurs et les dossiers partagés. Une fois la GED en service, ce temps de départ ne peut plus être mesuré (`Déduit`).

**La seule action à ne pas manquer** est donc la mesure T0 (§ 2), faite sur site **avant** que les agents reçoivent leurs comptes. Tout le reste peut attendre trois mois.

## 2. M1 : temps moyen de recherche réduit de 70 %

**Pourquoi l'application ne peut pas le mesurer seule** (`Vérifié`) :
- aucune recherche n'est écrite dans le journal ; le journal ne trace que les connexions, les consultations, les dépôts et les mouvements de documents ;
- `took_ms` (`search.py`) mesure le temps du serveur, pas le temps de l'agent pour retrouver son document. C'est le critère C3, pas M1.

M1 se mesure donc **au chronomètre**, avec un exercice « retrouver un document ».

**Définition** : temps entre la demande (« retrouvez-moi … ») et le moment où l'agent a le document ouvert à l'écran ou en main.

| Paramètre | Valeur |
|---|---|
| Demandes | 20, tirées de demandes réelles récentes du client : 8 par référence ou numéro, 6 par objet ou mot-clé, 6 par description vague (« le contrat du fournisseur X de l'an dernier »). |
| Qui cherche | 5 agents de 2 ou 3 services, 4 demandes chacun. |
| Qui pose les demandes | Une personne du client qui n'est pas mesurée (secrétariat, par exemple), pour que l'agent ne connaisse pas la liste à l'avance. |
| Plafond | 15 min. Un document non trouvé compte 15 min et il est noté « non trouvé ». |
| Résultat | Moyenne des 20 temps (le CDC dit « temps moyen »), avec la médiane et le nombre de « non trouvés » à côté. |

**T0, avant l'installation** : les 20 demandes portent sur des documents du classement actuel (papier ou partages).

**T1, à J+90** : 20 nouvelles demandes, même répartition (8 / 6 / 6), sur des documents présents dans la GED. Mêmes agents si possible. On ne reprend pas les mêmes documents, sinon l'agent se souvient de la réponse.

**Seuil** : **réussi si moyenne T1 ≤ 0,30 × moyenne T0.** Exemple : T0 = 6 min 00 s, alors T1 doit être ≤ 1 min 48 s.

**Limites, à écrire avec le résultat** :
- 20 mesures donnent un ordre de grandeur, pas une preuve statistique. Un écart de quelques secondes autour du seuil ne tranche pas.
- Si T0 n'a pas été mesuré, M1 ne peut plus être prouvé. On le remplace alors par un questionnaire (« combien de temps vous fallait-il avant ? »), et on écrit « déclaré », pas « mesuré ».

## 3. M2 : adoption par 90 % des collaborateurs en 3 mois

**Définition à figer** (sans elle, le chiffre se discute) :
- **Dénominateur** = la liste des agents qui doivent utiliser la GED, donnée par le client à la mise en service (J0). Les comptes techniques et de démonstration en sont exclus. Un agent prévu mais sans compte compte comme non adoptant.
- **Numérateur** = les agents de cette liste **actifs** sur les semaines 9 à 12 après J0. Actif veut dire au moins une consultation ou un dépôt de document dans au moins 3 de ces 4 semaines.
- **Seuil** : **réussi si numérateur / dénominateur ≥ 90 %.**

**Données** (`Vérifié` dans `main`) :

| Donnée | Où |
|---|---|
| Consultation d'un document : action `content_viewed` | `audit_logs`, écrite par `documents.py` l. 1188 |
| Dépôt : action `upload` | `audit_logs`, `documents.py` l. 695 |
| Connexion : action `login`, écrite après le code à usage unique | `auth_service.py`, `verify_otp` (l. 148-200) |
| Dernière connexion | `users.last_login` (`user.py` l. 62). Elle ne garde que la dernière, donc elle ne suffit pas. |

Aucun code de `main` ne purge `audit_logs` (`Vérifié`). L'historique de 12 semaines est donc disponible, sauf si une purge manuelle est faite sur site (`À vérifier` auprès de l'exploitant).

**Requête, en lecture seule** (`psql` dans le conteneur `postgres`, sur la base du client) :

```sql
-- :d0 = date de mise en service, :tenant = identifiant de l'institution
SELECT user_id
FROM audit_logs
WHERE tenant_id = :'tenant'
  AND action IN ('content_viewed', 'upload')
  AND created_at >= :'d0'::date + 56
  AND created_at <  :'d0'::date + 84
GROUP BY user_id
HAVING count(DISTINCT date_trunc('week', created_at)) >= 3;
```

Le résultat est croisé, **sur site**, avec la liste du client. Seuls les **comptes** sortent du site : nombre d'actifs, effectif prévu, pourcentage, par service. Aucun nom ni matricule n'entre dans le dépôt.

**Points d'étape** (alertes, pas des critères) : même requête sur les semaines 1 à 4 et 5 à 8.
- Moins de 50 % à J+30, ou moins de 75 % à J+60 : le client reçoit la liste des services en retard, pour relancer ou reformer les agents.

## 4. M3, en option : classement réel à J+90

C2 (≥ 95 %) n'est mesuré que sur le jeu de démonstration. À J+90, un simple comptage de `documents.classification_status` sur la base du client donne le chiffre réel : `classified` sur le total, hors corbeille. Coût : 10 min. Le résultat est indicatif, car il n'y a pas de manifeste pour savoir si la destination est la bonne.

## 5. Calendrier

| Quand | Quoi | Qui |
|---|---|---|
| Après le 30/11, avant l'installation sur site | Valider ce protocole (§ 6), préparer la grille des 20 demandes et la feuille de chronométrage. | PO, Q |
| Avant la remise des comptes | **T0** : mesure M1 de départ. | Client, avec un observateur |
| J0 | Mise en service ; le client remet la liste des agents prévus. | Client |
| J+30, J+60 | Points d'étape d'adoption. | Exploitant sur site |
| J+84 à J+90 | **T1** (M1), **M2** final, M3 en option. | Client, exploitant |

## 6. Coût

- **Équipe** :
  - I : 0 h-s de plus (ce document).
  - Q : ≈ 0,5 h-s après le 24 pour la grille des 20 demandes et pour essayer la requête M2 sur la base de démonstration, qui a déjà des actions `content_viewed`.
  - Rien pour B ni F : aucun code.
- **Client**, à chaque mesure (T0 puis T1) :
  - 5 agents × 4 demandes, soit au plus 20 × 15 min, et ≈ 2 h en pratique ;
  - un observateur pendant toute la séance.
- **Requête M2** : environ 10 min à chaque point.

## 7. Questions au PO

1. **Qui compte comme « collaborateur »** pour M2 : la liste des agents prévus, donnée par le client à J0, administrateurs compris, sans les comptes techniques ni de démonstration ? (Recommandé : **oui**.)
2. **Mesure de départ T0 avant l'installation**, faite par le client avec la grille de Q ? (Recommandé : **oui**. Sans elle, le « − 70 % » ne pourra jamais être prouvé.)
3. **Définition d'« actif »** : au moins une consultation ou un dépôt dans 3 des 4 semaines 9 à 12 ? (Recommandé : **oui**.)

Phrase d'accord, à reporter dans `criteres-acceptation.md` après le 30 :

> Accord PO du JJ/MM : les critères « − 70 % du temps de recherche » et « adoption ≥ 90 % en 3 mois » sont mesurés après la mise en service, selon `protocole-mesure-criteres-succes.md`. La mesure de départ est faite avant la remise des comptes. Les collaborateurs comptés sont ceux de la liste remise par le client à la mise en service.
