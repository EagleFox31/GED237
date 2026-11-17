# Changelog

Changements visibles par les utilisateurs et les exploitants. Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Non publié] — v1.1.0-rc.1

### Droits retirés

- **Rapports (`/api/v1/reports/*`)** :
  - l'admin de service (`unit_admin`) ne voit plus que son service et ses sous-services ; un autre service demandé répond 403. Avant : toute l'institution.
  - le collaborateur (`collaborator`) n'a plus accès aux rapports (403 « Les rapports ne sont pas accessibles à votre profil. »). Avant : toute l'institution par l'API, sans écran. Ses indicateurs du tableau de bord (`/analytics/*`) ne changent pas.

### Corrigé

- **Rapports** : les signaux « imports à revoir » et « rangements sur poste » (`imports_needing_review`, `local_organize_*`) suivent désormais le périmètre du rapport. Ils comptaient toute l'institution, même pour un manager. Un import ou un rangement compte pour le service de l'utilisateur qui l'a fait.
