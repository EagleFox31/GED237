# Dossier de décision PO — (a) démo VPS ou sur place, (b) B6 garde de routes

- **Statut** : **TRANCHÉ par le PO le 2026-11-09 (19:02, « go tout »)** : (a) **option A** — démo sur place en Docker avec poste de secours, VPS écarté, pas d'URL vitrine ; (b) **option B1** — garde admin / non-admin seule, les trois constats backend B6 passent en V1.1 et rejoignent les écarts annoncés. Consigné en fin de DEC-2026-002 ; propagé dans `checklist-demo.md`, `contexte-application.md`, `plan-presentation.md` § 3. Le dossier ci-dessous est conservé tel qu'instruit (traçabilité).
- **Pour** : PO, via l'orchestrateur. Était à trancher avant le 17/11.
- **Instruit par** : innovateur, 2026-11-09 19:10. Niveaux : `Vérifié` = mesuré ou lu ce jour ; `Déduit` = raisonnement sur ces faits.
- **Plan de référence** : DEC-2026-002 (9,75/10 j-p consommés, gel le 24/11) ; DEC-2026-003 (OCR léger, OCR-1 en V1.1 par défaut).

## (a) Démo sur le VPS OVH ou sur place en Docker

### Faits (Vérifié, 2026-11-09 19:05)

| Mesure | VPS OVH 15.235.90.215 | Besoin GED237 (`docker-compose.yml`) |
|---|---|---|
| RAM | 3,8 Go total, **198 Mo libres**, 2,6 Go en cache, swap 2 Go utilisé à moitié | plafonds déclarés : postgres 768 Mo + redis 192 + migrate 512 + api 1 Go + **worker 2 Go** + frontend 768 + nginx 64 = **≈ 5,3 Go** |
| Conteneurs | 13 déjà actifs (Précis prod, trigenys-sign, WAHA, loveink, casino, eli-bot, stack deploy-*) | 7 à ajouter |
| Disque | 38 Go, **77 % occupé** (8,9 Go libres) | images (torch CPU ≈ 1,5 Go) + corpus 500 documents + sauvegardes |
| HTTPS | Caddy en place, 5 sites, certificats automatiques | aucune config TLS dans le dépôt (`nginx.conf` sans TLS) |
| Dossier `deployment/` cité par le RACI | absent du dépôt | à créer dans les deux options |

### Options

| Option | Coût (j-p, hors DEC-002) | Risques démo | Ce que ça débloque / impose |
|---|---|---|---|
| **A. Sur place, Docker sur le poste de présentation** (16 Go recommandés), HTTPS local via Caddy `tls internal` ou simple HTTP sur `localhost` | **0,5** (compose « démo » + script de démarrage + pré-OCRisation la veille) | Panne du poste → second poste préparé à l'identique (clé USB avec images `docker save`) ; pas de réseau requis | Ordre 6 inchangé ; OCR-1 reste en V1.1 ; aucune charge pour ci-qa le 24–25 ; formulation « HTTPS porté par le reverse-proxy du client » |
| **B. VPS OVH tel quel** | **2–2,5** : OCR-1 obligatoire (1,5–2 j) + site Caddy, compose plafonné, images allégées (0,5) ; plus arrêt ou réduction d'au moins un service existant (décision hors GED237) | Mémoire : même avec OCR-1 le worker + api + postgres ≈ 1,5 Go minimum sur 198 Mo libres → OOM probable en pleine démo ; disque 77 % ; dépendance au réseau de la salle | Impose de sacrifier l'ordre 6 **et** la sauvegarde automatisée (ordre 5 → `pg_dump` manuel) ; OCR-1 avant le gel ; ci-qa mobilisé 24–25/11 |
| **C. Hybride** : démo sur place, **URL VPS en vitrine** (frontend statique + API en lecture seule sur un sous-ensemble, worker OCR éteint) | 1 (compose réduit sans worker, Caddy, seed figé) | Deux environnements à maintenir à jour ; incohérence de données entre les deux si l'un est modifié en séance | Démontre « déployable derrière HTTPS » sans jouer la démo dessus ; laisse OCR-1 en V1.1 ; coûte 0,5 j à ci-qa |

### Recommandation (une phrase)

**Option A : démo sur place en Docker, avec un second poste de secours ; le VPS n'est pas viable avec 198 Mo libres et 77 % de disque, et l'option C n'est à retenir que si le PO veut absolument une URL publique à montrer (1 j-p supplémentaire).**

Ce que la décision A débloque immédiatement : OCR-1 confirmé en V1.1 (DEC-003), ordre 6 conservé, ci-qa libéré les 24–25/11 pour la recette, formulation HTTPS validée (DEC-002 § 4). Hypothèse de travail de l'orchestrateur déjà alignée.

## (b) B6 — garde de routes frontend et constats d'autorisation

### Faits (Vérifié)

- `App.tsx` ne garde **aucune route par rôle** : seules redirections après connexion (page d'accueil par profil) et forçage de `/change-password` (`App.tsx:134-150`). Un lecteur qui tape `/admin/...` voit l'écran ; l'API, elle, refuse (Casbin) → écrans vides ou erreurs 403, pas de fuite de données, mais effet désastreux en démo si quelqu'un essaie.
- Trois constats backend du walkthrough Lot B6 (29/10, `Documenté`) : `assignable-roles` servi sans contrôle RBAC (`users.py:245`) ; profil `standard` sans `users:update_own` ; snapshot upsert par `user_id` seul.

### Options

| Option | Coût (j-p) | Risques démo | Débloque |
|---|---|---|---|
| **B1. Garde minimale admin / non-admin** (ordre 6 de DEC-002) : routes `/admin/*` et `/super-admin/*` → redirection vers l'accueil du profil ; une liste déclarative route → rôles autorisés | **0,5 F** (déjà budgété, mercredi 18) | faible : liste de 7 profils × ~12 routes à relire par ci-qa | parcours « lecteur sur /admin → redirection » dans SEC ; message « on ne voit que son périmètre » tenable à l'écran |
| **B2. B1 + garde fine par profil** (manager, auditeur, rédacteur, lecteur, admin d'unité) | 1 F | recette plus large : chaque profil à rejouer | cohérent avec la matrice UAT ; retire 0,5 j ailleurs (sacrifice : sauvegarde automatisée) |
| **B3. Corriger aussi les 3 constats backend** | + 0,75 B (RBAC sur `assignable-roles` 0,25 ; permission `users:update_own` 0,25 ; clé de snapshot 0,25) | aucun pour la démo (surfaces non montrées) | dette fermée avant le gel ; mais 0,75 j que B n'a plus |
| **B4. Reporter tout en V1.1** | 0 | un clic hors périmètre en démo affiche un écran vide | libère 0,5 j pour la marge |

### Recommandation (une phrase)

**B1 avant le gel (0,5 j F, mercredi 18, déjà dans le plan) ; les trois constats backend en V1.1 car aucun n'est exposé en démo ni exploitable sans compte administrateur ; B2 seulement si la recette du 18–20 laisse la marge intacte.**

Ce que B1 débloque : la journée du mercredi 18 côté frontend est fixée (garde + brancher `SpacesPage` le 17), le parcours sécurité gagne une étape visible, et la décision n'exige aucune migration ni changement d'API.

## Récapitulatif pour le PO

| Décision | Recommandation | Coût | Si vous choisissez autrement |
|---|---|---|---|
| (a) Lieu de la démo | **Sur place, Docker, poste de secours** | 0,5 j | VPS : + 2 à 2,5 j, OCR-1 avant le gel, sauvegarde automatisée abandonnée, risque de panne mémoire en séance |
| (b) B6 | **Garde admin / non-admin seulement ; reste en V1.1** | 0,5 j déjà prévu | Garde fine : + 0,5 j pris sur la sauvegarde ; backend B6 : + 0,75 j que le plan n'a pas |

**Décision du PO (2026-11-09)** : les deux recommandations sont retenues telles quelles. Conséquences actées : OCR-1 reste en V1.1, ordre 6 maintenu (mercredi 18), aucune tâche VPS/Caddy avant le gel, constats backend B6 annoncés au jury (écart 10 de `plan-presentation.md`).
