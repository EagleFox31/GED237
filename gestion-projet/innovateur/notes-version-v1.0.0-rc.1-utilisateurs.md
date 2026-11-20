# E-Dossier Cameroun v1.0.0-rc.1 : ce qui change pour vous

- **Pour** : le PO et les utilisateurs de la recette, puis de la release du 24/11.
- **Périmètre** : aucun tag n'existe encore, donc tout ce qui est fusionné sur `main` jusqu'à la coupe du 19/11 à 18:00. État relevé le 18/11 à 16:40 (`main` 55ac0ee). Les PR fusionnées entre ce relevé et la coupe s'ajoutent le 19 au soir.
- **Rangement** : par ce que l'utilisateur y gagne, et non par PR. Les numéros entre parenthèses servent à retrouver la source.
- **Référence pour le tag** : les notes techniques de #104 (`notes-version-v1.0.0-rc.1.md` et `CHANGELOG.md`). Ce texte en est la version grand public. En cas d'écart, #104 fait foi.

## En bref

E-Dossier range, lit et retrouve les documents d'une institution. Chacun ne voit que ce qui le concerne, les validations se font à l'écran et tout est tracé. L'application fonctionne sans Internet.

## 1. Se connecter en sécurité, sans perdre de temps

- Connexion en deux temps : le mot de passe, puis un code à usage unique. Le code reçu se colle d'un seul coup (#44, #336).
- Trois codes faux bloquent le compte 15 minutes, avec un compte à rebours à l'écran (#83, #88).
- Après une session expirée, on revient à la page qu'on avait quittée (#97, #123, #140).

## 2. Déposer ses documents sans souci

- Un fichier trop gros est refusé avec un message qui donne la taille maximale (#52, #390).
- Deux fichiers de même nom ne s'écrasent plus, et les noms très longs passent (#319, #321).
- Un fichier déjà présent est refusé comme doublon. Le tableau de bord compte ces refus (#77, #81).

## 3. Retrouver un document en quelques secondes

- Le texte des scans, des photos et des captures d'écran est lu, puis cherchable. Les photos, les captures et les formulaires passent par un moteur de lecture plus adapté (#350, #365, #368).
- La recherche en haut de l'écran ouvre directement les résultats et ne perd aucune touche tapée (#174, #258).
- L'explorateur des espaces se parcourt comme un explorateur de fichiers : filtres, pagination, raccourcis clavier, clic droit (#38, #78, #164, #173).

## 4. Laisser l'application ranger

- Les règles de rangement classent les documents d'après leur nom, leur dossier, leur texte et leur année. On les essaie avant de les activer (#2, #76, #92, #95).
- Les règles s'exportent et se réimportent en un fichier (#79, #84).
- Un dossier entier s'importe d'un coup. Des dossiers peuvent être surveillés et importés en continu (#2, #100, #101).
- Ce que les règles ne savent pas classer arrive dans la bannette « À revoir ». Après chaque classement, la liste se recharge et passe au document suivant (#2, #287, #390).

## 5. Faire valider un document à l'écran

- L'agent soumet un document, le chef le vise ou le rejette avec un motif, et l'état se met à jour tout de suite (#51, #66, #341).
- Le chef ouvre le document depuis ses tâches, même s'il vient d'un autre service (#340).
- Une notification de la cloche ouvre le document concerné (#390).
- Un document validé ou signé peut être archivé (#231, #246).

## 6. Chacun ne voit que ce qui le concerne

- La recherche, les listes et les compteurs ne montrent que les documents qu'on a le droit de lire, jamais ceux de la corbeille (#42, #177, #260).
- L'administrateur d'un service ne voit que son service et ses sous-services : documents, rapports, circuits, imports, revues, règles, comptes et organigramme (#196, #203, #358, #360).
- Le chef ne voit les rapports que de son service (#175, #188).
- Personne ne peut donner un rôle plus élevé que le sien. La suppression définitive est réservée aux profils qui en ont le droit (#223, #345).

## 7. Garder la trace de tout

- Le journal d'audit trace les connexions, les dépôts, les imports, les consultations et les décisions de revue (#98, #269).
- L'auditeur a son entrée « Audit » et exporte le journal filtré, jusqu'à 50 000 lignes (#80, #87, #233).

## 8. Une interface claire, en français

- Les libellés sont en français accentué, sans texte ni code technique du serveur à l'écran (#233, #257, #269, #286, #287, #341, #364).
- Les boutons qui ne faisaient rien sont retirés ou branchés, et les confirmations passent par des fenêtres de l'application (#314, #324, #334, #339, #348).
- « Paramètres » ne montre que les réglages personnels, sauf aux administrateurs (#337).
- Les écrans d'administration et de fin de journée sont plus directs : un échec de chargement se distingue d'une liste vide, avec un bouton « Réessayer » (#346, #390).

## 9. Installer et faire tourner sans Internet

- L'application s'installe et démarre sans Internet, à partir d'images préparées à l'avance (#116, #126, #144, #146).
- Accès chiffré en local (HTTPS) et redémarrage automatique après un arrêt du poste (#109, #200).
- Sauvegarde et restauration de la base et des fichiers, essayées pour de vrai (#54, #61, #62).
- Si la lecture d'un document échoue, l'exploitant la relance par le nom du fichier. Une fiche d'astreinte décrit les trois pannes les plus probables (#369, #375).

## Limites connues

- **L'écriture manuscrite n'est pas lue.** Seul le texte imprimé est reconnu. Sur le banc du 18/11, le manuscrit photographié donne 1 à 10 % des mots.
- **Le moteur de lecture se règle par configuration, pas à l'écran.** RapidOCR lit les photos, les captures et les formulaires ; Tesseract lit les scans et les PDF, et sert de secours. Pour revenir à Tesseract partout : `OCR_PRIMARY_ENGINE=tesseract`, puis redémarrer le worker. Le repli sur EasyOCR est coupé par défaut (#365, #368).
- **Si le worker s'arrête pendant une lecture, cette lecture est perdue.** Le document reste sans texte jusqu'à ce que l'exploitant la relance (#369). Une reprise automatique est prévue en V1.1.
- **Les collaborateurs n'importent pas en masse.** L'import de dossiers, l'explorateur documentaire et la bannette sont réservés à l'administrateur. C'est voulu.
- **La corbeille se vide à la main.** Il n'y a pas encore de durée de conservation automatique.
- **Renommer ou reclasser un document ne laisse pas encore de trace** dans le journal d'audit. Prévu en V1.1 (#250).
- **Le compteur des circuits de validation compte encore les documents en corbeille.** Prévu en V1.1 (#220).
- **Les droits des rôles ne se règlent pas à l'écran.** C'est la personne qui installe qui les fixe. La grille s'affiche en V1.1.
- **Le certificat HTTPS est local.** Un autre poste affiche un avertissement tant que le certificat n'y est pas installé. L'accès en HTTP reste possible.
- **Pas de mise en service sur un serveur distant** dans cette version (décision du PO du 9/11). Elle arrive en V1.1, accessible par VPN seulement.
- **Volume mesuré : 420 documents.** Les 100 000 fichiers du cahier des charges sont mesurés en décembre.
- **Reporté en V1.2** : désigner un lecteur d'un autre service sans lancer de circuit, alertes et onglet « Qualité » des rapports, accès public en HTTPS.

## À compléter le 19/11 au soir

- PR fusionnées entre le relevé du 18/11 à 16:40 et la coupe du 19/11 à 18:00.
- Phrases d'écart des lots non fusionnés, à reprendre de `plan-presentation.md` § 3.
- Disponibilité mesurée (relevés du 17 au 21/11), à reprendre des notes de #104.
