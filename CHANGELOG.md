# Changelog

Toutes les évolutions notables d'E-Dossier Cameroun (GED237). Format : [Keep a Changelog 1.1.0](https://keepachangelog.com/fr/1.1.0/) ; versions selon [SemVer](https://semver.org/lang/fr/). Le corps de chaque version sert aussi de texte à la release GitHub du même tag.

## [Unreleased]

## [1.0.0-rc.1] - 2026-11-24

Première version candidate d'E-Dossier Cameroun (GED237) pour la démonstration du 30/11 : connexion à deux facteurs, import et classement automatique, espaces par service, recherche cloisonnée, revue manuelle, cycle de validation, journal d'audit, sauvegarde et restauration.

### Fonctionnalités

- Connexion en deux temps (mot de passe puis code à usage unique) avec limitation des tentatives par compte et par adresse (#44, #73).
- Import d'un répertoire entier avec détection des doublons et classement automatique par règles (type, origine, nom de fichier, format) ; chemins d'import limités aux racines autorisées par l'administrateur (#2, #53).
- Règles de classement : création, simulation avant activation, lecture de l'année dans les noms de fichiers (#2, #76 — *en attente de fusion*).
- Espaces par service : arborescence service → domaine → activité → année, filtres et pagination côté serveur (#38 ; écran #78 — *en attente de fusion*).
- Recherche plein texte limitée au périmètre de lecture de l'utilisateur ; la corbeille est exclue des résultats (#42).
- Revue manuelle des documents que les règles ne savent pas classer (#2).
- Cycle de validation : soumission à un valideur, visa ou rejet motivé, suivi des tâches en attente (#51, #66).
- Journal d'audit en lecture seule pour le profil auditeur (#2).
- Rôles et accès : collaborateur limité à son service, lecteur, manager, auditeur, administrateur ; écrans d'administration réservés aux profils autorisés (#46, #47, #50).
- Plafond de taille à l'envoi appliqué sur tous les chemins de dépôt (#52).
- Sauvegarde et restauration de la base et du stockage par scripts d'exploitation, avec attente de la santé des services (#54, #62).
- Version de l'application affichée par l'API (`/health`) et lue du tag de release (#58).
- Jeu de démonstration reproductible (D1) et profil de remise à zéro associé (#70).

### Corrections

- Profil de démonstration : l'institution est retrouvée par le code du ministère (#41).
- Moteur OCR et démarrage Docker durcis ; garde « schéma à jour » au démarrage de l'API (#1, #5, #60).
- Codes de rôle en minuscules, jeu de référence convergent entre le seed et le service de démonstration (#50).
- Validation d'import : la file de traitement ne bloque plus la réponse quand le stockage des résultats est injoignable (#75).
- Interface : contraste, libellés de l'Atelier, message clair en cas de trop nombreuses tentatives de connexion, accessibilité des modales et du lecteur (#45, #73).

### Recette et CI

- Suite de fumée Playwright et parcours UAT P1–P8 joués contre la pile Docker complète (#39, #48, #55, #59, #63, #69).
- Scripts de mesure du taux de classement (C2), du temps de recherche (C3) et des compteurs de démonstration (#64, #65).
- CI proportionnée aux fichiers modifiés (impact-aware), lint et analyse de sécurité bloquants, vérification de l'intégrité des releases (#4, #17, #19, #20, #22).
- Exercice de restauration n° 1 consigné (#61).
- Scénarios préparés pour les cinq lots réouverts (#67, #71).

### Documentation

- Guide de test fonctionnel, exploitation (sauvegarde, données de démonstration), passations par rôle, dossiers de décision et fiches de lots (#3, #15, #24, #34, #36, #40, #43, #49, #57, #68, #72).

### Dépendances et outillage

- Node 24, mises à jour de sécurité Python et npm, portabilité des fichiers suivis (#7–#33, #37, #26, #16).

### Limites connues

Relevé des `fixme` encore ouverts dans `frontend/e2e/specs` (main 7ecde2b, 10/11) ; statut « corrigé avant le 19 » = une PR ouverte le couvre et doit être fusionnée avant la coupure du 19/11 18:00, sinon la ligne passe en V1.1 le 19 au soir.

| Défaut (spec) | Ce que voit l'utilisateur | Statut |
|---|---|---|
| SC-AUTH-02 E1 (`auth-2fa`) | Après une session expirée, la reconnexion ramène au tableau de bord et non à la page demandée : il faut y retourner soi-même. | **corrigé avant le 19 (#97), bascule en V1.1 le 19 à 18:00 si non fusionné** |
| SC-AUTH-01 E3 (`auth-2fa`) | Trois codes OTP erronés verrouillent le compte 15 minutes, avec un compte à rebours à l'écran ; le déblocage anticipé passe par l'administrateur (procédure d'exploitation), écran de déblocage en V1.1. | **corrigé avant le 19** (#83 + #88) |
| D3 (`audit-trail`) | Le journal d'audit ne trace ni les connexions, ni les dépôts, ni les imports : seuls la revue manuelle, les consultations, les doublons refusés, la corbeille et les versions y figurent. | **corrigé avant le 19 (PR à venir), bascule en V1.1 le 19 à 18:00 si non fusionné** (B, après le lot 4) |
| SC-V11-01 (`v11-lots`) | Tuile « Doublons refusés » du tableau de bord. | **corrigé avant le 19** (#77 + #81) |
| SC-V11-02 (`v11-lots`) | Export puis import des règles de classement, rejouable sans doublon. | **corrigé avant le 19** (#79 + #84) |
| SC-V11-03 (`v11-lots`) | Export CSV du journal d'audit, plafonné à 50 000 lignes (au-delà, affiner la période ou les filtres) ; verrou après 3 codes erronés. | **corrigé avant le 19** (#80 + #87 ; #83) |
| SC-V11-04 (`v11-lots`) | Les règles ne lisent ni le texte OCR ni la date du document : classement par nom de fichier et dossier seulement. | **corrigé avant le 19 (#92 relue OK, #95 UI), bascule en V1.1 le 19 à 18:00 si non fusionné** (lot 4). Limites de #92 (restent en V1.0) : un fichier passé par la file de revue d'import que rien ne classe à l'analyse ne crée pas de document, donc il n'est pas reclassé après OCR (seuls l'ingestion de dossier et le dépôt le sont) ; à l'ingestion, les règles sont évaluées avec la portée « service » : une règle à portée « utilisateur » ne s'applique jamais à un document ingéré ; les documents classés avant cette version ne sont pas reclassés. |
| SC-V11-05 (`v11-lots`) | Aucun dossier n'est surveillé en continu : l'import se lance à la main depuis l'écran Ingestion. | **en cours, bascule en V1.1 le 19 à 18:00 si non fusionné** (lot 5, aucune PR) |

Hors tableau : `demo-counters` (`AWAITING_D1`) est une activation de test, levée par #82 (recette, pas une limite produit) ; `validation-cycle` est déjà actif (`AWAITING_VALIDATION_UI = false`).

Limites hors `fixme` :

- Cycle de vie manuel : corbeille, restauration et purge par l'administrateur ; pas de durée de conservation automatique.
- OCR léger uniquement ; le moteur complet est hors budget machine (DEC-2026-003).
- Traces de recette : l'artefact CI `e2e-smoke-report` (14 jours) conserve les traces Playwright des tests rejoués, donc les en-têtes d'autorisation d'un jeton e2e éphémère (30 min, environnement CI détruit après le run) ; aucun compte réel n'y figure.
- Lots non fusionnés au 19/11 18:00 : relevé O reporté ici le 19 au soir ; phrases d'écart dans `plan-presentation.md` § 3.
