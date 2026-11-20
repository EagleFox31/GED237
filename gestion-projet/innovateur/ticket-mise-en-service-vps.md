# Texte du ticket #288 : Mise en service sur le VPS (après le 30/11)

- **Pour** O, qui copie le corps dans #288. Innovateur, 17/11/2026, mis à jour après la décision de O (22:30).
- **Étiquette** : `v1.1`.
- **Source** : `gestion-projet/innovateur/deploiement-vps.md` (§ 0 et § 7).

---

**Titre** : Mise en service sur le VPS (après le 30/11)

**Corps** :

Mettre GED237 en service sur le VPS partagé, en deux phases. La phase 1 est en V1.1 ; la phase 2 est en V1.2, sauf si #154 et #212 sont fusionnés avant le 01/12. Rien ne se fait avant le tag du 24/11 ni avant la démo du 30/11. Chaque étape demande l'accord du PO.

### Dépendances

- [ ] Mesure OCR du 18/11 (pointe mémoire du worker) : fixe le plafond du worker et le seuil du contrôle préalable.
- [ ] #248 : surcouche Compose du VPS (accès VPN seulement).
- [ ] #267 : en-têtes de sécurité du proxy.
- [ ] #268 : contrôle de la surcouche en CI.
- [ ] #154 : canal d'envoi du code de connexion (phase 2 seulement).
- [ ] #212 : refus de démarrer en production sans clé sûre ni canal de code (phase 2 seulement).

### Bloquant connu

Le contrôle préalable de #248 exige au moins 2,5 Go de mémoire disponible. Le relevé du 17/11 donne environ 2,0 Go. Il faut soit libérer de la mémoire sur le VPS, soit abaisser le seuil à 2,0 Go avec un worker plafonné à 1 Go. La mesure du 18 tranche.

### Phase 1 : accès par VPN seulement

- [ ] Fusion de #248, #267 et #268 ; seuil du contrôle préalable et plafond du worker réglés d'après la mesure du 18.
- [ ] Contrôle `free -m` sur le VPS juste avant l'installation.
- [ ] Images construites sur un poste, exportées, copiées, chargées ; `up -d` ; `migrate`. Pas de jeu de démonstration ; comptes réels créés à la main.
- [ ] Une heure de mesure pendant un import réel (`free -m`, `docker stats`), avant d'ouvrir à des agents.
- [ ] Tâche cron de sauvegarde de la base (7 copies, copie hebdomadaire hors du VPS), à une heure qui ne chevauche pas les sauvegardes existantes.
- [ ] Première restauration de cette sauvegarde sur un poste.

### Phase 2 : accès public (après #154 et #212) — V1.2 par défaut

Cette phase passe en V1.2. Elle revient en V1.1 seulement si #154 et #212 sont fusionnés avant le 01/12.

- [ ] `ENVIRONMENT: production` dans la surcouche ; écoute sur `127.0.0.1` seulement.
- [ ] Nom de domaine choisi par le PO ; enregistrement DNS.
- [ ] Nouveau fichier de site pour le proxy du VPS, validé puis rechargé, sans toucher aux sites existants.
- [ ] Contrôle HTTPS sur le nom de domaine.
- [ ] Décision du PO : ouverture publique ou liste d'adresses autorisées.

### Effort

- Déjà au plan V1.1 : lot 12 (#248, #267, #268 et l'heure de mesure, ≈ 1,75 h-s). #154 et #212 sont au lot 2 (≈ 4 h-s).
- Phase 1, ajoutée en V1.1 : B 0,75, Q 0,25. En compensation, le serveur e-mail à l'écran (lot 8a, B 0,5) sort en V1.2.
- Phase 2, en V1.2 par défaut : B 0,5, Q 0,25. Si elle revient en V1.1, #278 sort (Q 0,5).

### Critères de fin

- Phase 1 : l'application répond par le VPN. Phase 2 : elle répond en HTTPS sur le nom de domaine.
- Une sauvegarde a été restaurée avec succès sur un poste.
- Pendant l'heure de mesure, la mémoire disponible du VPS ne descend pas sous 300 Mo et aucun autre service ne redémarre.
