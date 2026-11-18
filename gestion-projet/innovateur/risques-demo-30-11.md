# Démo du 30/11 : les 10 risques et leurs replis

- **Pour** : O, P et la personne aux commandes le 30/11.
- **Sources** : `scenario-demo-30-11.md` § 4 et § 14, `checklist-demo.md`, et le registre des risques du 17/11 (R2, R3, R5, R6, R12).
- **Règle commune** (`checklist-demo.md` § C) : un essai (F5) ; sinon, bascule en moins de 60 s ; sinon, captures du rapport Playwright rejoué sur le tag. On ne redémarre jamais en séance.

| # | Risque | Repli prévu |
|---|---|---|
| 1 | Code à usage unique refusé, ou compte verrouillé après trois essais | Passer sur la fenêtre B, déjà connectée, et commenter le verrou comme une protection. Sinon, capture `auth-2fa`. |
| 2 | Code à usage unique visible à l'écran projeté (pile de démonstration) | Connecter A avant la séance et ne montrer l'écran de connexion que sans le valider. Ou bien saisir la connexion sur l'écran non projeté (mode « étendre »). |
| 3 | Session expirée sur une fenêtre préconnectée. Sans le point (a) de l'audit UX Lot 6, une micro-coupure réseau pendant le renouvellement de session déconnecte aussi, et la saisie en cours est perdue. | Ne rien saisir à l'avance dans un formulaire : remplir le dépôt en séance. Reconnecter ce compte (≈ 40 s). Si deux fenêtres expirent, passer aux captures pour les étapes restantes. Si (a) entre en V1.0 (go/no-go du 19/11 à 15:30), une coupure ne déconnecte plus et une vraie expiration affiche « Votre session a expiré… » sur `/login`. |
| 4 | Photo non lue à l'étape 5 bis (worker arrêté ou lecture lente) | À H-90 : ping du worker, et `rapidocr` et `false` lus dans l'environnement. En séance : relancer la lecture par le nom du fichier (fiche d'astreinte). Sinon, montrer `SCAN_0412`, déjà lu. |
| 5 | Import long ou en erreur | Importer le sous-dossier de 5 fichiers préparé, dont 1 doublon. Sinon, capture `directory-import`. |
| 6 | Chiffres différents de ceux annoncés, ou bannette vide | Lire les nombres affichés sans les commenter. Ouvrir un « à revoir » du jeu. Remise à zéro la veille et après chaque répétition. |
| 7 | Le jury demande d'archiver depuis l'explorateur (étape 8) | Passer par la recherche du bandeau, qui ouvre la fiche avec « Archiver » (chemin testé par #356). Phrase : « depuis l'explorateur, c'est dans la version suivante. » |
| 8 | Pile lente ou arrêtée (mémoire du poste) | À H-30 : au moins 5 Go de mémoire libre ; sinon, poste de secours. Aucune reconstruction d'image le jour J. |
| 9 | Certificat HTTPS refusé par le navigateur | L'autorité locale est installée sur le poste réel et acceptée par le PO. Sinon, passer en HTTP (8080) avec l'onglet de repli déjà connecté. |
| 10 | Poste de démonstration en panne | Le poste de secours a été restauré, avec la même pile, le même jeu et le même tag. Sinon, captures pour tout le reste. |
