# Backlog — Sprint suivant (features reportées)

Décisions prises le 2026-04-24 avec le PO. Ces features sont **reportées au sprint suivant** — elles sortent du scope actuel (P7 + tests E2E fonctionnels).

---

## F-NEXT-01 — Scan multi-postes réseau

### Contexte
L'ingestion actuelle (`backend/app/api/v1/endpoints/ingestion.py`) scanne un chemin **local côté serveur**. Le besoin métier est de scanner des répertoires sur plusieurs postes/serveurs du réseau de l'institution (postes agents, serveurs de fichiers MINFI/MINESUP…).

### Contraintes
- Authentification réseau (Kerberos/SMB) variable selon l'institution.
- Volume : potentiellement des dizaines de postes × milliers de fichiers.
- Sécurité : pas question d'ouvrir un partage SMB monde-lisible depuis le serveur GED.
- Tolérance aux pannes : un poste hors-ligne ne doit pas bloquer l'ingestion des autres.

### Pistes techniques
1. **Agent léger sur chaque poste** (service Windows / daemon Linux) qui publie vers un endpoint `/ingestion/push` authentifié par clé API. Poussé par l'agent = pas de SMB à ouvrir.
2. **Montage réseau côté serveur** (SMB/NFS) + chemins configurables par tenant. Plus simple mais moins sécurisé.
3. **Hybride** : agent pour les postes mobiles, montages pour les serveurs de fichiers statiques.

### Livrables attendus
- [ ] Modèle `IngestionSource` (type=local|smb|agent, credentials, enabled, last_run)
- [ ] Endpoint `POST /ingestion/sources` + CRUD
- [ ] Worker Celery `ingest_remote_source` déclenché par planning (cron) ou manuellement
- [ ] UI admin tenant pour configurer sources + voir dernier run + statistiques
- [ ] Monitoring : nb fichiers ingérés / par poste / par heure

### Questions ouvertes
- On fournit l'agent (à développer) ou on s'appuie sur robocopy/rsync + endpoint push ?
- Tenant peut-il configurer ses sources seul, ou validation super_admin requise ?

---

## F-NEXT-02 — URL signée expirante pour consultation de documents

### Contexte
Aujourd'hui `GET /documents/{id}/download` renvoie le fichier directement, authentifié par le JWT du user. Le besoin : un user autorisé demande à consulter un doc → le serveur génère un lien unique, expirant (ex. 10 min), traçable dans l'audit → le doc s'ouvre dans le viewer natif du poste utilisateur (pas forcément dans le navigateur).

### Objectifs
- Consultation **hors-application** (viewer système) sans exposer le fichier brut en permanence.
- Audit fin : qui a ouvert quoi, quand, depuis quel poste.
- Possibilité de watermark (nom user, timestamp) pour les docs sensibles.
- Pas de copie permanente sur le poste client (pas de cache navigateur durable).

### Pistes techniques
- JWT court dédié à l'accès fichier (claim `doc_id`, `exp`, `user_id`) → route `/documents/stream/{token}` qui stream le binaire.
- Header `Content-Disposition: inline; filename=...` + `Cache-Control: no-store`.
- Watermark injecté à la volée pour PDF (via PyPDF2 overlay) pour les docs tagués `confidentiel`.
- Log d'audit automatique à chaque consommation du token (table `document_access_logs`).

### Livrables attendus
- [ ] Endpoint `POST /documents/{id}/request-access` → renvoie `{ url: "...", expires_at: "..." }`
- [ ] Endpoint `GET /documents/stream/{token}` qui valide + stream + audit
- [ ] Watermark PDF configurable par tenant (setting `watermark_enabled`)
- [ ] UI : bouton "Ouvrir" dans le modal doc qui appelle request-access puis déclenche `window.open(url)`
- [ ] Page d'audit des accès (qui a ouvert quoi)

### Questions ouvertes
- Durée expiration par défaut ? (10 min proposé, configurable par tenant ?)
- Watermark obligatoire ou opt-in par document/rôle ?
- Limite nb d'accès concurrents par user (anti-scraping) ?

---

## F-NEXT-03 — (placeholder pour ajout ultérieur)

À compléter au fur et à mesure des décisions produit.
