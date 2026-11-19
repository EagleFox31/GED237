# Carnet de la suite : huit fonctionnalités au-delà des dix capacités

- **Pour** : O (présente au PO), B, F, Q (portent). Innovateur, 2026-11-17, sur `main` 4972a32. Consigne du PO relayée par O : « on est agile, si on finit plus vite on fait d'autres fonctionnalités ». Les dix capacités (L1 à L10) sont déjà attribuées et ne figurent pas ici.
- **Sources** : écarts CDC restants (`releve-preliminaire-taux-cdc-19-11.md` sur #104 : items 19, 27 et 31 partiels ; 8, 28 et 29 absents) ; issues ouvertes #150, #151, #157 et #163 ; Expression de besoin (`Phase de Conception/Expression De Besoin … Organisation & Ged.docx`, § 3 rôles, § 4 périmètre, § 5 exigences). `Vérifié` = lu dans le dépôt ou dans l'issue ; `Déduit` = raisonnement.
- **Règles qui s'appliquent** : rien ne fusionne avant le tag du 24/11 (PR brouillon seulement) ; gel des dépendances jusqu'au 30/11 ; nouvelle table = migration et `alembic upgrade head` sur chaque base. Durées en heures de session (h-s), indicatives.

## 1. Classement

Valeur : **H** (item CDC ou besoin écrit), **M**, **B**. Risque : **H** (supprime ou déplace des données, touche la connexion), **M**, **B**.

| Rang | Fonctionnalité | Source | Valeur | Risque | h-s | Porteur | Décision PO ? |
|---|---|---|---|---|---|---|---|
| 1 | **Rapports du Manager** (**#175, fusionnée** le 17/11, 74620fe) : entrée « Rapports » visible pour le Manager, limitée à son service ; test qui prouve qu'il ne voit pas les autres services | Expression de besoin § 3 : « Managers : … accès aux rapports » | H | B | 1,5 | F (menu), Q (test de portée) | non |
| 2 | **Recherche du bandeau : frappe rapide sans perte de caractères** (**#174, fusionnée** le 17/11, 8e992c0) | #163 (bug) | M à H | B | 1 | F | non |
| 3 | **Vue « doublons »** (**#171, en cours**, brouillon post-rc1) : liste des groupes de doublons, choix du document à garder, les autres partent à la **corbeille** (jamais de suppression définitive) | item 19 `partiel` (vue absente) | H | M | 3 | B (API de liste), F (écran) | non, si la règle « corbeille seulement » est retenue |
| 4 | **Mesure de charge : 100 000 fichiers en moins de 20 min** : script d'ingestion répétable, mesure sur la pile e2e, résultat daté | item 8 `absent` ; Expression de besoin § 5 | H | M | 4 | Q (script, mesure), B (réglages d'ingestion si la mesure échoue) | **décision PO du 17/11** : mesure sur ce PC, jeu synthétique de 100 000 fichiers généré, exécution après le 24/11 (protocole : `protocole-mesure-charge-100k.md`) |
| 5 | **Test du contrôle avant tag dans la CI**, lancé seulement quand le script ou son test change | #157 | M | B | 1 | Q | non ; à faire **après** le tag (décision O du 17/11) |
| 6 | **Preuve d'installation sur site** : installation rejouée sur un poste vierge à partir du manuel, temps et écarts notés | item 28 « non vérifiable » (VPS écarté le 9/11) | H | B | 2 | Q | **oui** : accepter l'installation sur site comme preuve de l'item 28 à la place du VPS |
| 7 | **Sélection multiple dans l'explorateur** (Ctrl+clic, Maj+clic, Ctrl+A, compteur, actions de groupe existantes) | #150 | M | M | 3 | F | non |
| 8 | **Suppr, F2 et glisser-déposer dans l'explorateur** | #151 | M | H | non chiffré | F (gestes), B (piste d'audit des renommages et reclassements) | **oui** : Suppr = corbeille seulement ; glisser-déposer = reclassement par le chemin « Classer » ; annulation (Ctrl+Z) non couverte par l'API |

## 2. Pourquoi cet ordre

- **1 et 2** sont les meilleurs rapports valeur/coût. Le besoin du Manager est écrit dans l'Expression de besoin. La route `/reports` existe, et l'API limite déjà le Manager à son service (`Vérifié`, `backend/app/api/v1/endpoints/reports.py` l. 50-57). Ce qui reste à vérifier : la page est-elle **visible** dans son menu, et un test le prouve-t-il ? Le menu affiché vient de `TENANT_ADMIN_MENU` (`Sidebar.tsx`). Je n'ai pas établi le filtrage par rôle : F le confirme d'abord. #163 se voit dès qu'on tape vite (`Vérifié` dans l'issue) ; à vérifier : si le parcours P5 passe par le bandeau, c'est un candidat à la règle D2 (moins de 2 h-s) avant le tag.
- **3 et 4** font bouger le taux CDC : item 19 +0,5 ; item 8 +1 si la mesure tient, +0,5 si elle est faite mais hors délai (`Déduit`). Aucune route de liste des doublons n'existe côté API (`Vérifié` : aucune route `duplicates`). Aucun script de charge n'existe dans `scripts/` (`Vérifié`).
- **5** protège le tag sans toucher au produit.
- **6** ne coûte presque rien en code, mais l'item 28 ne bouge que si le PO change le critère : sans réponse, ne pas lancer.
- **7 et 8** viennent de la demande du PO sur les réflexes Windows (17/11). La 8 attend la 7 et une décision écrite.

## 3. Hors liste, et pourquoi

- **Items 27 (HTTPS) et 31 (documentation)** : déjà couverts par les passages 2 et 1 du 19 au soir, pas une fonctionnalité nouvelle.
- **Item 29 (disponibilité)** : les sondes de santé sont dans les dix capacités. Il reste un travail de suivi, pas de code : prolonger la campagne C6 après la recette jusqu'à 10 relevés sur 10. C'est à Q de le faire, si O lève l'arrêt de la sonde le 19 à 18:00.
- **Expression de besoin, hors phase initiale** : signature électronique (§ 4, « phase ultérieure »), intégration ERP/CRM (« phase 2 »), accès mobile et IA (§ 7, vision à long terme). Ne pas les ouvrir sans décision écrite du PO.
- **Critères de succès non mesurés** (« − 70 % du temps de recherche », « adoption ≥ 90 % en 3 mois ») : ce sont des mesures après mise en service, pas des fonctionnalités.

## 4. Si le PO dit « oui » à tout

Ordre de démarrage proposé : 1, 2 et 5 en parallèle (F, F, Q), puis 3 (B et F), puis 4 après le 24/11 (poste et jeu décidés par le PO le 17/11). 6 dès que le PO accepte le critère. 7 après 1 et 2 ; 8 après la décision écrite. Total chiffré, hors 8 : ≈ 15,5 h-s, réparties sur B, F et Q (`Déduit`).
