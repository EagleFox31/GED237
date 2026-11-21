# Déroulé de la démonstration du 30/11 en HTTPS

- **Pour** : P (présente), O (clavier de secours, chrono), Q (plan B). Innovateur, 2026-11-16, sur `main` ca9953b ; décision du PO du 16/11 (D6) : démonstration en HTTPS. Relu le 17/11 par lecture du code de `main` 371c0a0 (routes de `frontend/App.tsx`, menu de `frontend/profiles/tenant-admin/menuConfig.ts`), application non lancée : les écarts trouvés sont au § 2 bis.
- **Règle de lecture** : ce document **complète** `deroule-demo.md` (chronologie minute par minute, replis par parcours, questions) et ne le remplace pas. Il donne l'ordre des 8 parcours, le résultat attendu et le plan B de chacun, et ce que l'HTTPS change. Détail des clics : `parcours-demo.md` § 2. Comptes par identifiant seul (MINFI002, MGR001, READ001, AUDIT001, UNIT001 ; administrateur du seed), jamais par mot de passe.
- **Durée** : 20 min = ouverture 2 + direct 13 ± 1 + écarts 2 + questions 3 (identique à `deroule-demo.md` § 1).

## 1. Ce que l'HTTPS change

| Sujet | Valeur | Source |
|---|---|---|
| Adresse de la démonstration | `https://localhost:8443` (ou le nom / l'IP du poste, s'il figure dans le certificat) ; l'accès `http://localhost:8080` reste actif | `DOCS/exploitation/https-local.md` (#109) |
| Certificat | mkcert, généré **sur le poste réel** à H-30, autorité locale installée dans le navigateur de ce poste (`mkcert -install`, navigateur redémarré) | idem, § Mise en route |
| Poste de secours | seulement si le PO en annonce un (décision O du 17/11 : poste unique par défaut) ; dans ce cas `mkcert -install` aussi sur ce poste, sinon avertissement de certificat | idem, § Limites |
| Preuve avant la séance | `sh scripts/prove_tls.sh` : `OK: HTTPS …` et code 0 ; cadenas fermé dans le navigateur | idem, § Vérifier |
| Jeton, session | pas de cookie : jetons dans `sessionStorage` (propre à l'onglet **et** à l'origine) ; un F5 en HTTPS garde la session (`Déduit` du code, `audit-https-2026-11-16.md` ; à confirmer au rejeu du 20) | idem |

Avant d'ouvrir la séance : onglet 1 = `https://localhost:8443` avec le cadenas visible ; onglet de repli = `http://localhost:8080` **connecté au même compte que la fenêtre A à H-5** (même pile, aucun redémarrage). Vérifier aussi à H-30 que la salle a un accès Internet : l'interface charge ses styles et polices depuis Internet (`audit-https-2026-11-16.md`, écart 1).

## 2. Les 8 parcours dans l'ordre

Résultat attendu et repli : voir `deroule-demo.md` § 1 (colonne « Ce que le jury doit voir ») et § 2 (repli manuel, API, capture). Ici : ordre, durée, et ce qui est propre à l'HTTPS.

| Min | Parcours | Durée | Résultat attendu (résumé) | Plan B si l'étape échoue | Propre à l'HTTPS |
|---|---|---|---|---|---|
| 2:00–3:30 | **P1** connexion OTP (A, `MINFI002`) | 1:30 | écran de connexion, code OTP, nom et rôle dans l'en-tête | OTP refusé : relire le code dans la réponse ; 429 : attendre 60 s en commentant ; sinon repli API | cadenas fermé à montrer 5 s ; page qui ne charge pas en HTTPS : basculer sur l'onglet `http://localhost:8080` **sans le dire comme un incident**, c'est l'écart annoncé |
| 3:30–6:00 | **P2** import et classement (B administrateur, `/rules` ; A, `/ingestion`) | 2:30 | compteur d'import, documents dans l'arborescence, doublons refusés | déposer 3 fichiers à la main (dont un doublon) ; sinon repli API sur `/data/ingest/live` | aucun : l'envoi passe par le même proxy, plafond de taille inchangé |
| 6:00–7:30 | **P3** simulation de règle (B, `/rules`) | 1:30 | règle active « Factures » simulée sur `facture-fournisseur-2024.pdf` : destination proposée, rien n'est déplacé (REC-12 du 21/11) | simuler la règle seed active ; sinon repli API | aucun |
| 7:30–8:30 | **P6** revue manuelle (B, `/needs-review`) | 1:00 | raison affichée, choix du classement, le document quitte la liste | ouvrir un des ≈ 15 « à revoir » du seed | aucun |
| 8:30–10:00 | **P4** espaces (B, `MGR001`, `/spaces`) | 1:30 | arborescence 4 niveaux, ouverture d'un document ; historique des versions par « Mes Documents » | arbre seul (« tout tient sur une page ») ; sinon repli API | aucun |
| 10:00–12:00 | **P5** recherche et cloisonnement (B `MGR001`, puis B `READ001` ; REC-08 du 21/11) | 2:00 | deux listes différentes pour la même requête, document en corbeille absent ; temps de réponse par le repli `GET /search` (REC-09) | document mis en corbeille à H-30, dit ; sinon repli API des deux comptes | aucun |
| 12:00–14:30 | **P8** cycle de validation (A `MINFI002`, B `MGR001` puis `MINFI001` ; REC-13 du 21/11) | 2:30 | visa d'un document, rejet motivé d'un autre, signature de `MINFI001` dans `/tasks`, statut « Validé » chez le rédacteur | visa puis signature, rejet en capture ; sinon repli API | aucun |
| 14:30–15:30 | **P7** journal d'audit (B `AUDIT001`, `/audit`) | 1:00 | connexions, imports, corbeille, revue, visa, signature et rejet dans l'ordre, lecture seule | retirer le filtre agent, garder la journée ; sinon repli API | aucun |

L'ordre est celui de `deroule-demo.md` (P1, P2, P3, P6, P4, P5, P8, P7) ; ne pas le réordonner sans repasser par la répétition du 27/11. Lots de la V1.1 livrés (tuile doublons, export / import des règles, export CSV du journal, verrou après 3 OTP avec `UNIT001` seul, critères contenu et année) : leurs moments se jouent comme décrit dans `deroule-demo.md` § 1 bis ; la surveillance de dossier est livrée (#100, 187b7f7) et se montre sur `/ingestion`.

## 2 bis. Écarts relevés le 17/11 entre ce déroulé et `main` 371c0a0

`Déduit` du code, à confirmer au rejeu du 20. La ligne P6 du tableau (nombre de documents « à revoir ») est corrigée par F dans une PR séparée, après la fusion de #104 ; elle n'est pas retouchée ici.

| Parcours | Ce que `main` change | Conséquence pour la séance |
|---|---|---|
| Tous | l'interface n'appelle plus aucun service externe : styles compilés (#122), polices embarquées (#116), avatars locaux (#126) | l'en-tête montre un avatar local au lieu d'une image distante ; rien à dire au jury |
| P1, et toute reconnexion | après une reconnexion, l'application rouvre **la page quittée** et non le tableau de bord (#123) ; la mémoire est liée au compte et non plus au profil de rôle (#134 corrigé par #140, fusionnée en b64144f) | contrôle de routine : en fenêtre B, vérifier la page d'arrivée après un changement de compte (à confirmer au rejeu du 20 ; `Déduit` du texte de la PR, non rejoué) ; en plan B, la reconnexion ramène sur la page en cours |
| P2 | l'export et l'import des règles sont sur `/classement` (menu « Plan de classement », onglet des règles de classement), pas sur `/rules` | pour le moment « export / import » du § 1 bis de `deroule-demo.md`, ouvrir `/classement` |
| P2 | `/ingestion` (menu « Import en masse ») affiche l'état de la surveillance de dossier (#100) | montrer l'encart, puis le fichier déposé dans un dossier surveillé (`INGEST_WATCH_FOLDERS`, checklist H-30) |
| P3 | le simulateur est un onglet de `/rules` (menu « Traitement des documents ») | inchangé |
| P6 | `/needs-review` redirige vers `/classification-reviews` (menu « Ma bannette ») | l'adresse affichée change, l'écran est le même |
| P4 | `/spaces` s'appelle « Explorateur documentaire » dans le menu ; clic droit sur un document et double-clic disponibles ; clavier et clic droit étendu (lots L1 et L2) seulement si leurs PR sont fusionnées le 19 | ne montrer un raccourci clavier que s'il figure au relevé du 19 |
| P8 | les données du circuit de validation viennent de #127 (fusionnée en 22457a7) | P8 se joue normalement ; repli en visa seul ou capture si le jeu de données manque après la restauration (à confirmer au rejeu du 20) |
| Tous | aides contextuelles `HelpHint` et tuile des doublons livrées (#99, f89fce8) | une icône d'aide peut être ouverte pour répondre à une question, sans y passer plus de 10 s |

## 3. Plan B général (HTTPS)

| Situation | Action | Délai |
|---|---|---|
| Avertissement de certificat ou cadenas barré sur le poste principal | ouvrir l'onglet de repli `http://localhost:8080` **déjà connecté à H-5** (la session ne passe pas d'une origine à l'autre : sans onglet préparé, nouvelle connexion avec OTP dans chaque fenêtre, ≈ 40 s) ; dire « l'accès chiffré est livré, le certificat est local, il se prouve hors séance » | < 30 s avec onglet préparé, ≈ 40 s par fenêtre sinon |
| `nginx-tls` arrêté ou port 8443 occupé | ne pas redémarrer pendant la séance ; basculer sur 8080 ; `prove_tls.sh` rejoué après la séance | < 30 s |
| Poste de secours sans autorité mkcert | utiliser `http://<poste>:8080` | immédiat |
| Échec du rejeu du 20 | repli (b) de D6 : démonstration en HTTP, profil `tls` non activé, item 27 `partiel` | décision O le 20 |

Toute bascule garde la même pile : aucun redémarrage de conteneur pendant la séance.

## 4. À rejouer le 20/11 (condition de D6)

Horaires et critères d'arrêt : `registre-risques-demo-2026-11-17.md` § 3 (passages 2 et 5).

1. Sur le poste de démonstration, le 19 à 19:30, PO présent (confirmé le 17/11) : `mkcert -install`, génération du certificat, `sh scripts/prove_tls.sh` vert (mémoire libre ≥ 5 Go).
2. Le 20 à 09:45 : les **8 parcours en HTTPS** à la suite, chronométrés, de P1 à P7 dans l'ordre du § 2, joués par F et B ; Q observe, le PO assiste s'il est là ; écarts et durées notés dans le compte rendu du 20 (`gabarit-compte-rendu-20-11.md`).
3. Même rejeu partiel sur le poste de secours, seulement si le PO en annonce un.
4. Résultat reporté sur l'item 27 du taux CDC (#109 fusionnée en e1480c8 ; `fait` quand la preuve est verte) ; si un parcours échoue en HTTPS et pas en HTTP, repli (b).

Ce document ne contient aucun mot de passe ni certificat ; les clés et l'autorité mkcert ne sortent jamais du poste de démonstration.
