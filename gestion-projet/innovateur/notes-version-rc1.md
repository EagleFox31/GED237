# Notes de version 1.0.0-rc.1, pour les utilisateurs

Ce qui change pour les agents et les responsables, en clair, et ce qu'on en dit pendant la démonstration du 30/11.
- **Base** : `main` 2f15b6e (18/11). Aucun lot de la V1.1 n'est entré à la coupe du 19/11 (`a1c15f61`).
- **Version technique** (numéros de PR, commandes) : `notes-version-v1.0.0-rc.1.md`. En cas d'écart, la version technique fait foi.
- Chaque thème se termine par **la phrase à dire en démo**.

## Nouveautés

### Se connecter en sécurité
- La connexion se fait en deux temps : le mot de passe, puis un code à usage unique.
- Après trois codes erronés, le compte est bloqué 15 minutes, avec un compte à rebours à l'écran.
- Après une déconnexion, on revient sur la page où l'on était.

> **En démo** : « Un mot de passe ne suffit pas : il faut aussi un code. Trois erreurs, et le compte se bloque un quart d'heure. »

### Importer et ranger les documents
- On importe un dossier entier en une fois. Les doublons sont repérés et refusés.
- Les documents sont rangés tout seuls selon des règles : type, origine, nom du fichier, année, texte lu dans le scan.
- Avant d'activer une règle, on la teste pour voir ce qu'elle rangerait.
- Les règles s'exportent dans un fichier et se réimportent sur une autre installation, sans doublon.
- Un dossier peut être surveillé : ce qu'on y dépose est importé automatiquement.
- Ce que les règles ne savent pas ranger va dans une bannette « à revoir », traitée par l'administrateur.

> **En démo** : « Trente fichiers de la DAF analysés et rangés en moins d'une seconde sur ce poste. Ce que la machine ne sait pas ranger, elle ne le devine pas : elle le met de côté pour un humain. »

### Retrouver un document
- Chaque service a son espace, rangé par domaine, activité et année.
- La recherche porte sur le texte des documents, scans compris, et seulement sur ce que l'utilisateur a le droit de lire.
- Dans l'explorateur des espaces : raccourcis clavier et clic droit, comme dans l'Explorateur de Windows.

> **En démo** : « Chacun cherche comme sur Internet, mais ne trouve que ce qu'il a le droit de voir. »

### Valider, archiver, garder la trace
- Un document est soumis à un valideur, qui le vise ou le rejette en donnant un motif.
- Un document validé ou signé peut être archivé par l'administrateur de l'institution.
- Le journal d'audit garde la trace des connexions, des dépôts, des imports et des consultations. L'auditeur le lit sans pouvoir le modifier et l'exporte en tableur.

> **En démo** : « Qui a vu quoi, qui a validé quoi, et quand : tout est écrit, et personne ne peut l'effacer. »

### Piloter
- Le tableau de bord donne les chiffres de l'institution, dont les doublons refusés.
- Le manager voit les rapports de son service seulement.

> **En démo** : « Le responsable voit d'un coup d'œil où en est son service, sans demander de rapport. »

### Fonctionner sans Internet et sans perte
- L'application fonctionne entièrement sans Internet : polices, styles et images sont fournis par l'application elle-même.
- L'accès se fait en HTTPS (connexion chiffrée) sur le poste de démonstration.
- La base et les fichiers se sauvegardent et se restaurent par une procédure documentée.

> **En démo** : « Coupez Internet : tout continue de fonctionner. Et une sauvegarde permet de tout remettre en place. »

## Corrections

- Les textes s'affichent en français accentué partout : écrans, messages, journal d'audit, motifs de revue.
- Plus de message technique ou de code incompréhensible à l'écran : les erreurs sont expliquées en clair.
- La recherche de l'en-tête ne perd plus de lettres pendant la frappe, et ses résultats s'ouvrent.
- Les documents mis à la corbeille ne sont plus comptés au tableau de bord de l'institution.
- Les menus ne mènent plus à une page introuvable ; l'auditeur a son entrée « Audit ».
- Les compteurs et les rapports ne montrent que ce que la personne a le droit de voir.
- Un administrateur ne peut plus donner à quelqu'un un rôle plus élevé que le sien.
- Après un redémarrage du serveur, l'application redémarre seule.

> **En démo** : « Nous avons corrigé ce que les essais ont révélé, des accents jusqu'aux droits d'accès. »

## Limites connues

| Ce que vous verrez | Ce qu'il faut savoir | Prévu |
|---|---|---|
| Un compte bloqué après trois codes erronés | Il se débloque seul après 15 minutes ; avant, seul l'administrateur peut le débloquer. | Écran de déblocage en 1.1 |
| La corbeille ne se vide pas seule | L'administrateur restaure ou supprime à la main ; aucune durée de conservation automatique. | — |
| Un collaborateur ne fait pas d'import en masse | C'est voulu : l'administrateur prépare, chacun ne voit que ce qui le concerne. | — |
| Le compteur des circuits de validation compte encore les documents en corbeille | Le tableau de bord de l'institution, lui, ne les compte plus. | Corrigé en 1.1 |
| Renommer ou reclasser un document ne laisse pas de trace dans le journal | Les autres actions sont tracées. | Corrigé en 1.1 |
| Depuis la bannette « à revoir », l'administrateur peut choisir un dossier dont le serveur ne vérifie pas qu'il appartient à son institution | Le contrôle est ajouté côté serveur. | Corrigé en 1.1 |
| Un manager ou un lecteur qui ouvre un document hors de son service voit « accès refusé » au lieu de « introuvable » | Le document n'est pas montré, mais le message confirme qu'il existe. | Corrigé en 1.1 |
| Les droits par rôle ne se modifient pas à l'écran | Ils sont réglés à l'installation. | Affichés en 1.1, modifiables ensuite |
| Les documents rangés avant cette version ne sont pas rerangés | Les nouvelles règles s'appliquent aux nouveaux documents. | — |
| Un scan de mauvaise qualité est moins bien lu | La lecture du texte des scans est volontairement légère, pour tenir sur une machine modeste. | — |
| L'export du journal s'arrête à 50 000 lignes | Au-delà, réduire la période ou ajouter un filtre. | — |
| Sur un autre poste que celui de la démo, le navigateur affiche un avertissement en HTTPS | Le certificat est installé sur le poste de démonstration seulement. | Adresse publique en 1.2 |
| GED237 n'est pas encore installé sur un serveur distant | La démonstration se fait sur place, avec les mêmes logiciels. | Serveur par réseau privé en 1.1, accès public en 1.2 |

Montré en démonstration mais livré en 1.1 : remplacement pendant une absence, recherche insensible aux accents, mesure des 100 000 fichiers, lisibilité des badges de statut, focus clavier à la connexion, déblocage d'un compte par l'administrateur.

> **En démo** : « Voici ce que cette version ne fait pas encore, et quand elle le fera. Rien n'est caché. »
