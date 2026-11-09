# Concurrents open source et positionnement de la démo du 30/11

- **Pour** : plan de présentation (question probable du jury : « pourquoi pas Alfresco / Paperless ? ») et réponse aux écarts. Veille du 2026-11-09 20:25, recherche web standard ; niveau `Documenté` = page lue via le résumé de recherche, non vérifiée ligne à ligne ; chaque affirmation porte son URL.
- **Thèse en une phrase** : GED237 ne concurrence pas les ECM d'entreprise (Alfresco, Nuxeo) ni la GED personnelle (Paperless-ngx) ; il occupe la case **« GED de ministère, multi-tenant, classement par règles simulables, cycle de validation, audit, déployable sur un poste modeste »**, case que seul Maarch approche, pour l'administration française et sans multi-tenant par ministère.

## 1. Comparatif

| Critère (issu du CDC et du guide) | **GED237** (état 09/11) | Alfresco Community 26.1 | Nuxeo LTS 2025 | Paperless-ngx 3.x | Maarch Courrier / RM |
|---|---|---|---|---|---|
| Cible | ministères camerounais, multi-tenant par ministère, services | ECM grande entreprise | plateforme de contenu grande entreprise | particuliers, TPE, auto-hébergement | administrations et collectivités françaises (GEC courrier, archivage RM) |
| Licence / éditeur | code du prestataire (CDC 2025 § 6) | Hyland ; édition Community (licence non confirmée dans la recherche) | Hyland ; Apache 2.0 selon Wikipedia ; **hotfixes réservés aux instances enregistrées** | GPL-3.0, communauté | GPLv3 (SourceForge), éditeur Maarch/Xelians |
| Empreinte | api 1 Gio + worker 2 Gio + pg 768 Mio sous caps (compose) ; contrainte CDC « faible consommation » | **Java 21** obligatoire en 26.1, JVM à tuner ; installation zip/Ansible/Helm | JVM, Elasticsearch/OpenSearch, MongoDB ou PostgreSQL | Python/Django + Redis + Tesseract, léger | PHP + PostgreSQL, léger |
| Classement automatique par règles | moteur IFTTT (conditions + actions), **simulation avant activation**, file « à revoir » | règles de dossier, Smart Folders | automatisation par événements, scripting | tags/correspondants par correspondance de motifs, workflows (déclencheur → actions) | plans de classement, circuits de courrier |
| Cycle de validation | visa, rejet, retour, (signature V1.1) | workflows Activiti | workflows configurables | **aucun** circuit de validation | circuits de visa/signature du courrier (cœur de métier) |
| Multi-tenant | **oui**, `tenant_id` sur tout, isolation testée (SC-SEC-02) | multi-tenant limité (Community : pas de cluster, selon forum ancien) | oui (multi-repositories) | **non** (un seul espace, permissions par utilisateur/groupe) | une entité par instance |
| Authentification | JWT + **OTP 2FA**, blacklist | LDAP/SSO | SSO/SAML | OIDC (groupes → rôles superuser/staff) | LDAP/SSO |
| Audit | journal filtrable par agent/jour, export V1.1 | audit complet | audit complet | historique par document | piste d'audit réglementaire |
| OCR | léger, CPU, décidé V1.1 (DEC-003) | transformations via conteneurs annexes | conversions externes | **Tesseract intégré, plugin OCR en 3.0**, détection des doublons (3.2.0) | OCR via connecteurs |
| Versions / corbeille | API (UI = écart annoncé) | oui | oui | versioning ajouté en 3.0 | oui |
| Français, contexte administration | UI française, rôles ministère/service | multilingue | multilingue | multilingue | **français, retenu par l'État français (AMI, sept. 2025)** |

## 2. Ce que la démo doit dire (et ne pas dire)

1. **Ne pas** présenter GED237 comme « mieux qu'Alfresco » : dire qu'Alfresco/Nuxeo exigent une JVM, un moteur de recherche séparé et une équipe d'exploitation que le CDC exclut (« faible consommation de ressources », « déployable sur PC personnel, NAS ou intranet »). GED237 tourne sous 4 Gio avec des plafonds par conteneur (`goulot-vm-docker.md` § 1).
2. **Face à Paperless-ngx** (le concurrent que le jury connaît le plus) : Paperless est excellent pour un individu ; il n'a ni ministère/service, ni circuit de validation, ni cloisonnement par tenant. En revanche il a OCR et versionnage **dans l'UI** : ce sont exactement les écarts 8/14 de GED237, à annoncer franchement avec la trajectoire V1.1 (`sources/ocr-leger.md`).
3. **Face à Maarch** : le plus proche fonctionnellement (circuits, audit, administration), orienté courrier et archivage réglementaire français ; GED237 apporte le multi-tenant par ministère et le classement simulable, et reste à construire sur la partie archivage (ISO 15489 : `sources/ged-normes.md`).
4. **Argument Adopt/Build** à assumer si le jury demande « pourquoi ne pas avoir pris l'un d'eux » : le CDC 2025 § 6 fait du code la propriété du prestataire et vise une solution légère ; le cadrage de septembre 2025 fixe 6 mois et un budget outillage de 237 000 FCFA, sans licence éditeur ni exploitation JVM. Réponse honnête : « Build » assumé pour le cœur (règles, tenants, validation) et **Adopt** pour tout le reste (PostgreSQL, Tesseract/RapidOCR, Casbin, Playwright, docker-volume-backup).

## 3. Trois différenciateurs défendables et ce que le jury peut opposer

| Différenciateur (prouvé par un parcours) | Preuve le 30/11 | Objection probable du jury | Réponse |
|---|---|---|---|
| **Classement par règles avec simulation avant activation** et file « à revoir » (P2, P3, P6) | C2 mesuré le 20/11, simulation en direct | « Paperless fait des règles aussi » | Paperless classe en tags/correspondants pour un utilisateur ; ici règles par ministère, destination dans une arborescence service/domaine/activité/année, simulation sans effet et revue manuelle tracée |
| **Multi-tenant par ministère + cloisonnement par service**, 2FA OTP, audit (P1, P5, P7) | SC-SEC-01/02 verts sur `main`, journal filtré en direct | « Alfresco/Nuxeo font tout cela depuis dix ans » | Oui, pour une JVM, un moteur de recherche séparé et une équipe d'exploitation ; le CDC exige un poste modeste ; GED237 tient sous 4 Gio avec des plafonds par conteneur |
| **Cycle de validation administratif** visa / rejet / retour (P8) sur un outil léger | circuit `E2E-WF-VALID` en direct | « Maarch le fait, et il est retenu par l'État français » | Maarch est centré courrier et archivage réglementaire, une entité par instance ; GED237 est multi-ministère et classement d'abord ; l'archivage ISO 15489 est la trajectoire annoncée (écart 9) |

Ce que le jury opposera **à raison** : OCR et versionnage dans l'interface (Paperless les a : écarts 8/14), pas de surveillance de dossier (écart 4), pas de tags (écart 16), pas de VPS (C5). Ne pas discuter, renvoyer aux écarts déjà annoncés.

## 4. À ne pas faire avant le 30/11

Aucune démonstration comparative en direct (installer Alfresco ou Paperless pour la démo = 1 j et hors sujet). Une diapositive « où se situe GED237 » suffit (tableau § 1 réduit à 5 lignes : cible, empreinte, règles simulables, validation, multi-tenant).

## Sources (consultées le 2026-11-09)

- Alfresco Community Edition 26.1 release notes (Java 21, zip/Ansible/Helm) : https://connect.hyland.com/t5/alfresco-blog/alfresco-community-edition-26-1-release-notes/ba-p/497107 ; documentation 26.1 : https://support.hyland.com/r/Alfresco/Alfresco-Content-Services-Community-Edition/26.1/Alfresco-Content-Services-Community-Edition ; matériel/JVM 23.4 : https://support.hyland.com/r/Alfresco/Alfresco-Content-Services/23.4/Alfresco-Content-Services/Configure/Repository/Tune-the-JVM/Hardware
- Nuxeo LTS 2025 (31/03/2025) : https://connect.hyland.com/t5/nuxeo-blog/discover-nuxeo-lts-2025/ba-p/488269 ; versions supportées : https://www.hyland.com/en/legal/nuxeo-supported-versions ; hotfixes réservés aux instances enregistrées : https://connect.hyland.com/t5/nuxeo-blog/nuxeo-hotfix-release-update/ba-p/498209 ; publication du code LTS 2025 (fil communautaire) : https://connect.hyland.com/t5/nuxeo-forum/will-changes-to-source-code-of-lts-2025-continue-to-be-published/td-p/493612 ; licence Apache 2.0 : https://en.wikipedia.org/wiki/Nuxeo
- Paperless-ngx 3.0 (plugin OCR, tantivy, versioning, breaking changes) : https://github.com/paperless-ngx/paperless-ngx/pull/12713 et https://releasebot.io/updates/paperless-ngx ; 3.2.0 (liens de partage, doublons) : https://borncity.com/news/paperless-ngx-3-2-0-zentrale-verwaltung-fuer-freigabelinks/ ; releases officielles : https://www.github.com/paperless-ngx/paperless-ngx/releases
- Maarch Courrier retenu par l'État français (AMI, 02/09/2025) : https://www.xelians.fr/wp-content/uploads/2025/09/02.09.2025_CP_Maarch-Courrier_Selection-IA-1.pdf ; gamme et hébergement : https://europeanpurpose.com/tool/maarch ; licence GPLv3 : https://sourceforge.net/projects/maarch ; Maarch RM : https://www.linuxlinks.com/maarch/
- Internes : CDC 2025 § 2, 5, 6 ; cadrage 21/09/2025 § 4, 6 ; `innovateur/plan-presentation.md` (15 écarts), `sources/ocr-leger.md`, `sources/ged-normes.md`, `goulot-vm-docker.md`.
