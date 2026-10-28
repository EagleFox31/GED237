# [Gemini] BACKLOG V2 - Évolutions Stratégiques

Ce backlog regroupe les fonctionnalités validées par le Product Owner (Cursor) mais qui sont **hors périmètre de la V1** (lundi 27 juillet). Elles seront implémentées dans une phase ultérieure.

## Epic 1 : Connecteur AIGLES (Interopérabilité)
- **Besoin :** Éviter la double saisie pour les agents de l'État et garantir la cohérence des données budgétaires et RH.
- **Fonctionnalité :** API de synchronisation ou d'import depuis la plateforme gouvernementale AIGLES.
- **Valeur :** Gain de temps massif, fiabilisation de la donnée.

## Epic 2 : Gestion des Intérims et Délégations
- **Besoin :** Assurer la continuité du service public en cas d'absence d'un directeur ou chef de service.
- **Fonctionnalité :** Module permettant d'allouer temporairement les droits de validation (RBAC dynamique sur Casbin) avec une date de début et de fin.
- **Valeur :** Fini les goulots d'étranglement administratifs.

## Epic 3 : Contrôle de Complétude
- **Besoin :** Bloquer le traitement d'un dossier (ex: demande de bourse, recrutement) s'il manque des pièces obligatoires.
- **Fonctionnalité :** Moteur de règles vérifiant la présence de types de documents spécifiques (ex: CNI, Acte de naissance) avant de permettre la transition de statut dans le workflow.
- **Valeur :** Qualité des dossiers garantie avant passage en commission.

## Epic 4 : Portail Public (Vérification par QR Code)
- **Besoin :** Lutter contre la fraude documentaire (faux diplômes, faux arrêtés).
- **Fonctionnalité :** Génération d'un QR code sur les documents validés. Une page publique accessible via mobile permet de vérifier l'authenticité du document.
- **Valeur :** Transparence institutionnelle et confiance des citoyens.
