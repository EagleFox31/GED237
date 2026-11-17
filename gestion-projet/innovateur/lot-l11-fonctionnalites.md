# Lot L11+ : cinq fonctionnalités après L1–L10

- **Pour** : O (présente au PO), B, F, Q. Innovateur, 2026-11-17, sur `main` 4972a32. Après le tag `v1.0.0-rc.1` du 24/11 ; PR brouillon seulement avant. L1 à L10 (les dix capacités, `classement-dix-capacites-futures.md`) sont exclues.
- **Sources** : Expression de besoin (`Phase de Conception/Expression De Besoin … Organisation & Ged.docx` : § 3 rôles, § 4 périmètre, § 5 exigences), items du CDC (`releve-preliminaire-taux-cdc-19-11.md`), `gestion-projet/MATRICE_TRACABILITE_PRODUIT.md` (en-tête daté du 22/07, fichier modifié le 28/10 : à relire, certaines lignes ont pu évoluer). `Vérifié` = lu dans `main` ; `Déduit` = raisonnement.
- **Lien avec le carnet** (`carnet-suite-fonctionnalites.md`) : L11 reprend son rang 3 ; L12 élargit son rang 1. Les rangs 2 et 5 à 8 du carnet (issues #163, #157, #150, #151, preuve sur site) restent des issues, hors lot.

## 1. Classement

| Lot | Fonctionnalité | Source | Valeur | Risque | h-s | Porteur | Décision PO ? |
|---|---|---|---|---|---|---|---|
| **L11** | **Vue « doublons »** : groupes de documents identiques, choix de celui à garder, les autres partent à la corbeille (jamais de suppression définitive), action tracée dans le journal | item 19 `partiel` (CDC) ; Expression de besoin § 5 « corbeille applicative » | H (+0,5 point CDC) | M | 3 | B (route de liste, `Vérifié` : aucune n'existe), F (écran) | non, si « corbeille seulement » est retenu |
| **L12** | **Rapports par service** : le Manager voit les rapports de son service ; filtre de période sur l'onglet « Services » ; KPI du tableau de bord service limités au service | Expression de besoin § 3 « Managers : … accès aux rapports » ; matrice l. 50 (« ajouter période et scope ») et l. 66 (« KPI parfois tenant-wide ») | H | B | 2,5 | F (menu, filtre), B (période côté API), Q (test de portée) | non |
| **L13** | **Sauvegarde planifiée** : sauvegarde automatique à heure fixe, rétention appliquée, alerte visible si la dernière sauvegarde a échoué ou date de plus de 24 h | Expression de besoin § 4 « archivage sécurisé et sauvegardes planifiées » ; aujourd'hui `ops/backup.sh` se lance à la main (`Vérifié` : aucune planification dans `docker-compose.yml`, `ops/` ni `sauvegarde-restauration.md`) | H | B | 2 | B (planification par le beat Celery existant ou un conteneur dédié), Q (preuve de restauration de la sauvegarde planifiée) **décision PO du 17/11** : chaque nuit à 02:00 ; conservation de 7 sauvegardes quotidiennes et 4 hebdomadaires ; alerte en cas d'échec |
| **L14** | **Reprise d'un import de masse interrompu** : un import coupé reprend là où il s'est arrêté, sans doublon ni fichier perdu ; rapport des fichiers en erreur | matrice l. 36 (« tester reprise et erreurs ») ; prérequis de la mesure de charge (`protocole-mesure-charge-100k.md` § 7) | H | M | 3 | B (état d'avancement par lot), Q (test : arrêt forcé à mi-lot puis reprise) | non |
| **L15** | **Chiffrement des fichiers stockés** | Expression de besoin § 5 « chiffrement des données sensibles » ; aucun chiffrement trouvé dans `backend/app/core` ni le stockage (`Déduit` d'une recherche sans résultat) | H | **H** | ≥ 4, à préciser | B | **décision PO du 17/11** : reporté après la démo du 30/11. Restera à trancher : quelles données, où vit la clé, et ce qui se passe si la clé est perdue (perte des documents, restauration impossible) |

## 2. Pourquoi cet ordre

- **L11 et L12** : besoin écrit, faible coût, aucun effet sur les données (L11 passe par la corbeille, réversible).
- **L13** : le besoin est écrit et le risque est faible, car la sauvegarde et la restauration sont déjà prouvées (item 30). Il ne manque que l'automatisme et l'alerte. Fréquence et conservation fixées par la décision PO du 17/11 (02:00 chaque nuit, 7 quotidiennes, 4 hebdomadaires, alerte en cas d'échec).
- **L14** : sans reprise, un échec de la mesure de charge au lot 7 coûte une remise à zéro complète. À faire avant de répéter la mesure, pas forcément avant la première.
- **L15** : le plus de valeur sur la sécurité, le plus de risque. Un chiffrement mal géré rend les documents illisibles et les sauvegardes inutiles. `cryptography` est déjà installée comme dépendance de `python-jose` (`Vérifié`, `requirements.txt` l. 18), mais l'utiliser directement reste à décider avec B après le gel. Décision PO du 17/11 : reporté après la démo. Ensuite, ne pas démarrer sans décision écrite du PO sur les trois questions du tableau et un plan de restauration testé.

## 3. Écartés (hors phase initiale ou déjà ailleurs)

Signature électronique (Expression de besoin § 4 : « phase ultérieure ») ; intégration ERP/CRM (« phase 2 ») ; accès mobile et analyse IA (§ 7, vision à long terme) ; favoris, rapports planifiés, archivage légal, qualité documentaire (déjà dans L1–L10).

**Total L11 à L14** : ≈ 10,5 h-s ; L15 reporté après la démo (décision PO du 17/11), à chiffrer ensuite (`Déduit`).
