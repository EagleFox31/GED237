# Décisions attendues du PO avant le 19/11 à 18:00

Fiche d'une page, pour O, puis pour le PO. Innovateur, 17/11/2026. Le détail est dans `../decisions/dossier-decisions-po-23-11.md` (questions 1 à 5) et dans `veille-canal-code-connexion-v1.1.md` (question 6).

Pour chaque question, une réponse suffit : la lettre de l'option, ou « d'accord » pour notre choix par défaut.

| # | Question | Options | Notre choix par défaut | Sans réponse le 19/11 à 18:00 |
|---|---|---|---|---|
| 1 | Quel jour prêtez-vous un poste pour l'essai d'installation sans Internet ? Il faut Ubuntu 24.04, 8 Go de mémoire et 10 Go de disque libres. | A. mercredi 25/11, 09:00 à 13:00 ; B. jeudi 26/11, mêmes heures | **A**, pour garder le 26 en réserve | Aucun essai sans Internet avant la démo. L'exigence 28 du cahier des charges reste non prouvée. |
| 2 | Le responsable d'unité doit-il voir seulement son service et ses bureaux, partout (liste, recherche, compteurs, imports, rapports) ? | Oui ; Non | **Oui** | La rc.1 ne change pas : il voit tout l'établissement dans sa liste et sa recherche. C'est écrit dans les « Limites connues ». La correction (#203) attend votre accord. |
| 3 | Ses trois autres accès aux autres services (lien direct, import au nom d'un autre agent, vue de l'institution) seront-ils fermés en V1.1 ? | Oui ; Non | **Oui** | Ces accès restent ouverts en V1.1. |
| 4 | A-t-il besoin de chercher dans tout l'établissement pour son travail ? | Oui, avec un exemple réel ; Non | **Non** | On fait comme si la réponse était non. |
| 5 | Les rapports d'un manager ou d'un lecteur couvrent : | A. son service et ses bureaux ; B. son service seulement, comme sa liste | **B** : il voit les mêmes documents partout. Avec A, il voit des chiffres sur des documents qu'il ne peut pas ouvrir. | Ses bureaux restent comptés dans ses rapports. |
| 6 | Un manager doit valider un document d'un autre service et reçoit « accès refusé ». Que faire ? | A. il peut le lire pendant la validation ; B. le document n'apparaît plus dans sa liste | **A** : sinon, il vise un document sans l'avoir lu. | Le message « accès refusé » reste. |
| 7 | Corrige-t-on trois défauts d'écran (#229) avant la démo ? Les voici : « Gérer les permissions » ne fait rien ; des accents manquent (« A verifier », « Parametres ») ; l'auditeur n'a pas d'entrée « Audit » dans son menu. | A. dans la rc.1, par exception après la coupe ; B. en V1.1 | **B** : après la coupe, on ne change plus le code. On les signale comme limites connues. | Option B. Le guide utilisateur ne parle pas de ces trois points. |
| 8 | Quelles informations chacun peut-il changer seul dans son profil ? | A. nom, prénom, téléphone, puis ses préférences quand elles existeront ; B. A plus la photo ; C. A plus l'e-mail | **A**. Pas l'e-mail, parce qu'il sert à se connecter et à recevoir le code. | Option A, en V1.1 (#222). Rien ne change dans la rc.1. |
| 9 | Où l'application sera-t-elle hébergée après la démo, et qui paie ? | A. un serveur du ministère, déjà en place ; B. un serveur loué ; C. à décider plus tard | **A** : aucune licence. Il faut une machine avec 8 Go de mémoire, 10 Go de disque libres et Docker. | Au jury, on répond : « coût non chiffré ». On ne donne que la machine nécessaire. |
| 10 | L'administrateur d'une institution peut-il archiver des documents dès la rc.1 (#228) ? | A. dans la rc.1 ; B. en V1.1 | **B** : il faudrait changer les droits après la coupe. | Option B. Dans la rc.1, seul l'administrateur de la plateforme archive. C'est écrit dans les « Limites connues ». |
| 11 | Vos agents ont-ils une adresse e-mail sur un serveur du ministère, joignable sans Internet ? | Oui ; Non ; Je ne sais pas | Envoi du code par e-mail via ce serveur (#154), et application d'authentification pour les administrateurs | Envoi par e-mail quand même. Mais on ne sait pas si la connexion marche pendant une coupure d'Internet. Si la réponse est non, seuls les comptes avec l'application se connectent pendant une coupure. |

Les questions 2 à 6 et 8 à 11 ne changent pas la rc.1 : leurs effets arrivent en V1.1. Seules les questions 1 et 7 touchent la démo du 30/11.

## Réponses du PO, 17/11

| # | Réponse | Effet |
|---|---|---|
| 1 | Pas de poste prêté. | Q prouve l'installation sans Internet le 25/11, sur une machine simulée sans réseau. |
| 2 | Oui. | V1.1 (#203), après #196 et après le 30. |
| 3 | Oui. | Les trois accès sont fermés en V1.1, dans une PR distincte. |
| 4 | Non. | — |
| 5 | Le manager et le lecteur voient leur service et ses sous-services (un niveau), dans la liste, la recherche et les rapports. | V1.1, consigné sur #195. Écrit dans les « Limites connues » de la rc.1. |
| 6 | A. | V1.1. Annoncé dans « Prévu V1.1 ». |
| 7 | A : #233 est déjà dans `main`, donc dans la rc.1. | Guide aligné (E23 à E25). |
| 8 | A. | V1.1 (#222). |
| 9 | D'abord sur notre VPS. | Empreinte et réductions : `empreinte-pile-rc1-vps.md`. |
| 10 | A : archivage par l'administrateur d'institution dans la rc.1 (#231, puis #239). | Retiré des « Limites connues », ajouté au guide. **À condition que #231 et #239 fusionnent avant la coupe.** |
| 11 | Adresses internes du ministère. | Le code part par le serveur de messagerie du ministère (#154, transport SMTP). |
