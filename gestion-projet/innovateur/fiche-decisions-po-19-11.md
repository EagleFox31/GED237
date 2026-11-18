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
| 12 | L'administrateur de la plateforme doit-il pouvoir tout régler depuis l'écran ? Aujourd'hui, il règle à l'écran les institutions, les comptes, les droits et le classement. Le reste se règle dans les fichiers du serveur : mots de passe techniques, durée des sessions, taille des envois, sauvegardes. | A. comme aujourd'hui, avec une page « Ce qui se règle où » dans le guide ; B. A, plus, en V1.1, à l'écran : durée des sessions, taille des envois, fonctions activées, serveur e-mail ; C. B, plus, en V1.1, un écran des droits en français simple (rôles et actions à cocher) | **A** pour la rc.1, puis **B** en V1.1. Les mots de passe techniques ne passent jamais par l'écran. | Option A : rien ne change dans l'application, la page « Ce qui se règle où » est ajoutée aux notes rc.1 et au guide. B (≈ 4 à 6 h-s) et C (≈ 3 h-s de plus), `Déduit`, sont à chiffrer par B et F. |
| 13 | Une personne désignée sur un document d'un autre service (#254) : a) le lit-elle si on la désigne comme simple lecteur, hors d'un circuit de validation ? b) Garde-t-elle l'accès quand son étape est finie ? | a) A. oui, en lecture seule ; B. non, seulement par une étape d'un circuit. b) A. oui, en lecture seule ; B. non, l'accès se ferme à la fin de l'étape | **a) A et b) A** : lecture seule, jamais de modification. Garder l'accès permet de retrouver ce qu'on a validé. | On fait comme si la réponse était A et A en V1.1. La rc.1 ne change pas : la personne désignée hors de son service reçoit encore « document introuvable ». |
| 14 | Q peut-il mesurer l'OCR pendant 1 heure sur notre VPS, avant d'y mettre des agents ? Le VPS fait aussi tourner d'autres services (messagerie WhatsApp, signature). | A. oui, un soir après 22:00, avec la pile allégée, et arrêt immédiat si la mémoire sature ; B. non, mesure sur un poste local limité à la mémoire libre du VPS (moins fiable) ; C. après la démo | **A** : seule une mesure sur le VPS dit si la pile y tient. Un « oui » vaut accord pour cette seule mesure. Coût : B ≈ 1,5 h-s (pile allégée), Q ≈ 0,5 h-s. | Pas de mesure : la rc.1 ne va pas sur le VPS avant la réponse. |
| 15 | L'essai sans réseau du 25/11 (machine simulée par Q : conteneur Docker coupé du réseau, 7 Go de mémoire, 2 processeurs), ajouté à l'installation sur le PC Windows, vaut-il preuve pour l'exigence 28 ? | A. oui ; B. oui, à confirmer par une installation sur un vrai poste du ministère après la démo ; C. non | **B** : la machine simulée est proche d'un vrai poste, mais pas identique (7 Go au lieu de 8, pas de matériel réel). | L'exigence 28 est notée « vérifiée sur machine simulée » dans le relevé du 25, sans plus. |

Les questions 2 à 6 et 8 à 15 ne changent pas la rc.1 : leurs effets arrivent en V1.1. Seules les questions 1 et 7 touchent la démo du 30/11.

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
| 12 | A pour la rc.1, puis C en V1.1 (réponse du 17/11, transmise par O). | rc.1 : page « Ce qui se règle où » dans le guide (4bef7d8, branche du guide) et dans les notes rc.1 (push de #104 du 19). V1.1 : les réglages non secrets passent à l'écran, et un écran des droits en français simple (rôles × actions à cocher) remplace les règles brutes. Ticket #280 en deux lots, chiffrage par B et F. Les mots de passe techniques restent sur le serveur. |

## Questions du 19/11 au matin (décisions et points ouverts du 18/11)

Même règle : une lettre, ou « d'accord » pour notre choix. Toutes ces questions touchent la démo du 30/11 ou la coupe du 19 à 18:00.

| # | Question | Options | Notre choix par défaut | Sans réponse le 19/11 à 12:00 |
|---|---|---|---|---|
| 16 | Combiner plusieurs moteurs de lecture des photos (« vote ») : on l'écarte en V1.0 et en V1.1 ? Sur nos essais, il ne lit pas mieux qu'un seul moteur. | A. écarté, repris seulement avec de vraies photos de documents du ministère ; B. on le garde au programme de la V1.1 | **A** (décision d'O du 18/11, à confirmer) | A : un seul moteur de lecture, avec Tesseract en secours. |
| 17 | Le nouveau moteur de lecture des photos (RapidOCR) entre-t-il dans la rc.1 ? | A. oui, si sa PR est verte et relue par Q avant le 19 à 16:00, sinon V1.1 ; B. V1.1 dans tous les cas | **A**. Le 18 à 14:00, sa PR n'était pas encore ouverte. | A : sans PR prête à 16:00, il passe en V1.1. |
| 18 | Le filtrage par service du responsable d'unité (#203) et ses deux suites (#358 : rapports, circuits, imports, revues et règles ; #360 : comptes et organigramme) : si les tests de #203 ne sont pas verts le 19 à 15:00, passent-ils tous les trois en V1.1 ? Le 18, un test échoue encore (journal d'audit ouvert à tort) ; B corrige. | A. oui, les trois en V1.1 ; B. on attend jusqu'au gel de 17:15 | **A** : trois fusions de 15 à 20 minutes chacune ne tiennent pas entre 15:00 et 17:15. | A. La rc.1 garde alors la limite connue : le responsable d'unité voit tout l'établissement. |
| 19 | Les tests automatiques du parcours de démo (#356, sans changement de l'application) entrent-ils dans la rc.1 ? | A. oui, si ses tests sont verts et la relecture de F faite avant le 19 à 15:00, sinon V1.1 ; B. V1.1 | **A** : ils ne changent rien à la démo, et ils la vérifient en continu. | A. |
| 20 | Le numéro de version de l'écran (#121, « 1.0.0-rc.1 ») : on le met seulement sur la branche de la release, et jamais sur `main` ? | A. oui, sur la release après la coupe ; B. sur `main` avant la coupe | **A** : `main` continue vers la V1.1 sans porter le numéro rc.1. | A. |
| 21 | Quel moteur lit les photos pendant la démo ? Le choix se fait le 20 à 09:00, par un simple réglage du serveur, sans changer le code. | A. RapidOCR, s'il est dans la rc.1 et que la répétition du 20 passe ; B. Tesseract, le moteur actuel | **A** si la question 17 donne « oui », sinon **B**. | B : Tesseract, déjà en place. Le fichier propre (`SCAN_0412.pdf`) reste le plan B de l'étape 5 bis. |
