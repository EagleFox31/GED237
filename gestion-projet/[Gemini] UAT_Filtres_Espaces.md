# [Gemini] UAT Scenarios - Filtres sur Espaces Documentaires

## Objectif
Garantir que la route `GET /api/v1/spaces/documents` filtre correctement les résultats côté serveur selon les exigences métier du plan V1, permettant ainsi de soulager le frontend.

## Scénarios

### Scénario 1 : Filtrage par Domaine
- **Étant donné** un tenant avec 100 documents (50 "RH", 50 "Finances").
- **Quand** le frontend appelle `GET /api/v1/spaces/documents?domain_id=<id_RH>`.
- **Alors** l'API renvoie uniquement les 50 documents appartenant au domaine RH.
- **Et** le code HTTP est 200.

### Scénario 2 : Filtrage Croisé (Activité + Année + Statut)
- **Étant donné** un tenant avec une grande volumétrie de dossiers.
- **Quand** l'utilisateur applique le filtre sur l'activité "Recrutements Spéciaux", l'année "2026", et le statut "validé".
- **Alors** la requête backend inclut les clauses appropriées pour `activity_id`, `classification_year`, et `status`.
- **Et** la réponse ne contient que les documents validés de 2026 pour cette activité.

### Scénario 3 : Tolérance aux paramètres manquants
- **Étant donné** l'API fonctionnant en production avec l'ancien comportement.
- **Quand** le frontend appelle la route sans les nouveaux filtres.
- **Alors** l'API retourne la liste complète comme auparavant (seuls `org_unit_id` et `recursive` sont appliqués).
- **Et** la rétrocompatibilité n'est pas cassée.
