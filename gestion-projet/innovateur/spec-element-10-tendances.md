# Spec V1.2, élément 10 : tableaux de bord avec tendance

Plan : `plan-v1.2.md`, ligne 10. Chiffrage inchangé : B 1 h-s, F 1,5 h-s, Q 0,5 h-s.
Le manager a son tableau de bord dans l'élément 19 (#298). Cette spec ne le refait pas.

## Rôles couverts

| Profil | Où | Périmètre des chiffres |
|---|---|---|
| Admin d'institution (`tenant-admin`) | `OrgDashboard` | toute l'institution |
| Admin d'unité (`unit-admin`) | `ServiceDashboard` | son unité (`Document.org_unit_id`) |
| Collaborateur (`collaborator`) | une rangée de 4 cartes compactes au-dessus de `DraftWorkspace` | ses documents (`Document.owner_id`) |
| Manager (`manager`) | page de #298, même appel que l'admin d'unité | son unité ; **seulement si #298 est fusionné**, +0,25 h-s pour F |

Hors lot :
- **lecteur** : il ne fait que consulter, il n'y a pas d'activité à suivre ;
- **auditeur** : son accueil est le journal d'audit ;
- **super-admin** : il n'apparaît pas dans la démo.

## Indicateurs : 2 courbes et 2 chiffres du jour par rôle

| Rôle | Courbe 1 | Courbe 2 | Chiffres du jour (déjà servis) |
|---|---|---|---|
| Institution | Documents déposés | Visas rendus : acceptés, et rejetés ou renvoyés (2 traits) | En attente de visa ; espace utilisé |
| Unité | Documents déposés | Visas rendus (2 traits) | À revoir ; circuits actifs |
| Collaborateur | Mes dépôts | Issue de mes documents : visés, et rejetés ou renvoyés (2 traits) | Brouillons ; en attente de visa |

Les chiffres du jour viennent des appels existants. L'institution utilise `/analytics/tenant`. L'unité utilise `/analytics/manager`, qui filtre déjà par `org_unit_id`. Pour le collaborateur, ce sont deux nombres ajoutés à la réponse des tendances (voir le contrat).

**Écart constaté sur main** : `ServiceDashboard` appelle aujourd'hui `getTenantAnalytics()`, donc l'admin d'unité voit les chiffres de toute l'institution. F le bascule sur `/analytics/manager` dans ce lot. B vérifie que `unit-admin` y a accès.

## Période

- **12 dernières semaines, au pas de la semaine** (du lundi au dimanche, heure de Douala). Pas de sélecteur.
- Pourquoi la semaine : les volumes de la démo et des débuts sont faibles. Au pas du jour, la courbe serait surtout faite de zéros.
- La semaine en cours est incomplète : elle est tracée en pointillé, avec l'infobulle « Semaine en cours ».
- Infobulle d'un point : « Semaine du 3 nov. : 5 ».
- Le `aria-label` de chaque courbe résume la série : « 12 semaines, du 25 août au 10 nov. ; cette semaine : 5 ».

## Quand il n'y a pas de données

- La série a toujours 12 points. Les semaines vides valent 0, et c'est le serveur qui complète.
- Si les 12 points sont à zéro, aucune courbe n'est tracée. La carte affiche « Pas encore d'activité ces 12 dernières semaines. ». Les chiffres du jour restent affichés.
- Si l'appel échoue, la carte affiche « Tendance indisponible ». L'erreur passe par le bus d'erreurs habituel, et le reste de la page s'affiche normalement.

## Contrat pour B : `GET /api/v1/analytics/trends?scope=tenant|unit|mine&weeks=12`

- **Droits par portée** :
  - `tenant` : mêmes rôles que `/analytics/tenant` (`TENANT_WIDE_READ_ROLES`) ;
  - `unit` : unité de l'utilisateur ; 403 s'il n'a pas d'`org_unit_id` ;
  - `mine` : tout utilisateur connecté ;
  - portée non permise : 403 ;
  - `weeks` est compris entre 4 et 26 (12 par défaut), sinon 422.
- Toujours filtré par `tenant_id`, documents supprimés exclus (`deleted_at IS NULL`).
- **Réponse** (les tableaux sont alignés sur `weeks`, du plus ancien au plus récent ; le dernier est la semaine en cours) :

```json
{
  "scope": "unit",
  "timezone": "Africa/Douala",
  "weeks": ["2026-08-25", "…", "2026-11-10"],
  "series": {
    "documents_created": [0, 3, 1, "…"],
    "visas_accepted": [0, 1, 0, "…"],
    "visas_rejected_or_returned": [0, 0, 1, "…"]
  },
  "now": { "drafts": 2, "awaiting_visa": 1 }
}
```

- **Définitions** :
  - `documents_created` : `Document.created_at` ;
  - `visas_*` : `WorkflowAction.performed_at`, avec `outcome` dans `accepted`/`acknowledged`, ou dans `rejected`/`returned`. La table est jointe au document, avec le filtre de la portée ;
  - `now` n'existe que pour `mine` : nombre de documents de l'utilisateur en `draft` et en `in_review`.
- **Fuseau** : les colonnes de `TimestampMixin` sont de type `TIMESTAMP` sans fuseau, et l'heure du serveur est l'UTC. Il faut les passer en `Africa/Douala` avant `date_trunc('week', …)`. Les semaines sans valeur sont complétées par un `generate_series`, une requête par série.
- **Tests attendus** :
  - isolation entre deux tenants ;
  - filtre de chaque portée ;
  - 12 points complétés par des zéros ;
  - un visa du dimanche à 23 h 30 à Douala compte dans la bonne semaine ;
  - 403 et 422.

## Pour F

- Le composant de tendance en SVG, sans nouvelle bibliothèque, sert pour toutes les cartes.
- Les deux traits d'une courbe ont une légende en mots (« Acceptés », « Rejetés ou renvoyés »), pas seulement une couleur.
- Aucune aide en paragraphe dans les cartes. Au besoin, une icône `help` dans le coin.
