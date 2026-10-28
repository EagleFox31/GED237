# [Gemini] Jeu de Données Étalon - Rapports & Statistiques

## Objectif
Fournir un dataset fixe permettant à Claude de tester les métriques remontées par le module de rapports de façon déterministe (sans dépendre des données organiques variables).

## Description du Dataset

### Tenant : "Ministère de la Santé" (ID: tenant_sante)

**1. Domaines & Activités**
- Domaine A : "Personnel Médical"
  - Activité A1 : "Recrutements Spéciaux"
  - Activité A2 : "Affections"
- Domaine B : "Infrastructures"

**2. Distribution des Documents (Total: 10)**
- **Doc 1 à 4** : `org_unit="Direction RH"`, Domaine="Personnel Médical", Activité="Recrutements Spéciaux", Année=2026, Statut="validated".
- **Doc 5 à 7** : `org_unit="Direction RH"`, Domaine="Personnel Médical", Activité="Affections", Année=2026, Statut="pending".
- **Doc 8 à 10** : `org_unit="Direction Logistique"`, Domaine="Infrastructures", Année=2025, Statut="rejected".

**3. Workflow Logs (Pour /workflow-activity)**
- Doc 1 a subi 3 étapes de validation.
- Doc 2 a été rejeté puis validé (2 événements d'audit).

## Cas d'usage pour Claude (Pytest)
Dans `test_reports.py`, lorsque ce dataset est instancié :
- L'appel à `/reports/document-activity?domain_id=<Personnel_Medical>` DOIT renvoyer un total de **7** documents.
- L'appel à `/reports/evolution` pour l'année 2026 DOIT renvoyer un volume de **7** créations.
