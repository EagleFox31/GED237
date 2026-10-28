# [Gemini] Matrice de Traçabilité - Préparation Lundi

| ID Exigence | Besoin Métier | Scénario UAT associé | API / Fichier concerné | Statut Test (Tech Lead) | Preuve d'acceptation |
|---|---|---|---|---|---|
| **REQ-001** | Filtrage serveur des espaces pour gérer la volumétrie | Scénario 1, 2, 3 (UAT_Filtres_Espaces) | `spaces.py` & `documents.py` (méthode `list_workspace_documents`) | 🔴 À coder | Exécution `pytest` de la route modifiée. |
| **REQ-002** | Mesure fiable de l'activité du système (Rapports) | Dataset Étalon Rapports | `reports.py` (endpoints `/evolution`, `/document-activity`, etc.) | 🔴 À coder | Création de `test_reports.py` par Claude (Code 200). |
| **REQ-003** | Interface web stable et sans warnings | Inspection visuelle & CLI | `index.html` (suppression appel mort `/index.css`) | 🔴 À corriger | Commande `npm run build` exécutée sans erreurs Rollup. |
| **REQ-004** | Connecteur AIGLES (Interopérabilité) | N/A (V2) | N/A (V2) | ⚪ Planifié V2 | `BACKLOG_V2_EVOLUTIONS.md` |
| **REQ-005** | Gestion des Intérims et Délégations | N/A (V2) | N/A (V2) | ⚪ Planifié V2 | `BACKLOG_V2_EVOLUTIONS.md` |
| **REQ-006** | Contrôle de Complétude des dossiers | N/A (V2) | N/A (V2) | ⚪ Planifié V2 | `BACKLOG_V2_EVOLUTIONS.md` |
| **REQ-007** | Portail Public (Vérification par QR Code) | N/A (V2) | N/A (V2) | ⚪ Planifié V2 | `BACKLOG_V2_EVOLUTIONS.md` |
