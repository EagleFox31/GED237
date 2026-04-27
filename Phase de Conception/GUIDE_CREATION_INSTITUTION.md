# Guide — Créer et configurer une institution

Ce guide décrit, dans l'ordre, comment un Super Admin met en place une nouvelle institution (tenant) sur la plateforme E-Dossier.

## Vue d'ensemble du flux

```
[1] Créer l'institution      →  [2] Créer l'admin tenant  →  [3] Créer les services  →  [4] Créer les utilisateurs métier
     (page Institutions)         (page Détail institution)    (onglet Services)         (onglet Utilisateurs)
```

À chaque instant, **une seule action est mise en avant** : celle qui débloque l'étape suivante. Les autres boutons restent masqués pour ne pas semer le doute.

---

## Étape 1 — Créer l'institution

**Où** : page **Institutions** (sidebar Super Admin → "Institutions")

1. Clique sur **+ Nouvelle institution** en haut à droite
2. Remplis :
   - **Nom complet** (requis) — ex : *Ministère de la Fonction Publique*
   - **Sigle** — ex : *MINFOP*
   - **Domaine** — ex : *minfop.cm*
3. Clique **Créer**

L'institution est ajoutée à la liste avec le statut **Actif**.

> Astuce : clique sur la ligne pour ouvrir le détail de l'institution.

---

## Étape 2 — Créer le premier administrateur

**Où** : page **Détail institution** (clic sur une ligne de la liste)

À l'ouverture, tu verras :

- En haut à droite : un seul bouton rouge animé **CRÉER ADMIN** (les autres CTA sont masqués tant que l'admin n'existe pas)
- Sur l'onglet **Résumé** : un panneau **Configuration de l'institution** avec les 3 étapes ; seule l'étape 1 est active, les autres sont **verrouillées** 🔒

1. Clique **CRÉER ADMIN**
2. Renseigne :
   - **Matricule** (requis) — identifiant interne, ex : *MINFOP001*
   - **Rôle** — laisse "Tenant Admin" (par défaut)
   - **Prénom**, **Nom**, **Email** (optionnels)
3. Clique **Créer & générer le mot de passe**

Un panneau de confirmation s'affiche avec :

- Le **matricule**
- Un **mot de passe à usage unique** généré automatiquement (cryptographiquement fort)
- Un bouton **Copier**

> ⚠ **Important** : copie le mot de passe maintenant. Il ne sera plus affiché. L'admin devra le changer à sa première connexion.

Communique matricule + mot de passe à l'admin (canal sécurisé : message direct, hors-bande, etc.).

---

## Étape 3 — Créer la structure des services

**Où** : onglet **Services** (sur la page Détail institution)

Une fois l'admin créé, le panneau "Configuration" passe l'étape 1 en ✅ vert et active l'étape 2.

Le bouton **CRÉER SERVICE** apparaît dans la barre d'action en haut.

1. Clique **CRÉER SERVICE** (ou va sur l'onglet Services puis "Nouveau service racine")
2. Renseigne :
   - **Nom du service** (requis) — ex : *Direction des Affaires Générales*
   - **Code** — ex : *DAG*
   - **Service parent** (optionnel pour services racine)
3. Clique **Créer**

Tu peux créer une arborescence multi-niveaux (un service peut avoir des sous-services).

> Pourquoi avant les utilisateurs ? Chaque utilisateur métier (manager, collaborateur, lecteur) doit être rattaché à un service précis pour les règles d'isolation et de validation.

---

## Étape 4 — Créer les utilisateurs métier

**Où** : onglet **Utilisateurs**

Une fois au moins un service créé, le bouton **CRÉER UTILISATEUR** apparaît dans la barre d'action.

1. Clique **CRÉER UTILISATEUR**
2. Renseigne matricule, rôle (Manager / Collaborateur / Lecteur / Auditeur), prénom, nom, email
3. Le système génère un mot de passe à usage unique (même flux que l'admin)
4. Communique les identifiants à l'utilisateur

L'utilisateur sera forcé de changer son mot de passe à la première connexion (norme **NIST SP 800-63B**).

---

## Référentiel : règles UX

| État de l'institution | Bouton(s) visible(s)                          | Pourquoi                                              |
| --------------------- | --------------------------------------------- | ----------------------------------------------------- |
| Vide (0 admin)        | `Créer admin` (rouge animé) + `Suspendre`     | Sans admin, rien d'autre n'a de sens                  |
| Admin OK, 0 service   | `Créer service` + `Suspendre`                 | Les utilisateurs ont besoin d'un service              |
| Admin + Services OK   | `Créer service` + `Créer utilisateur` + `Suspendre` | Tous les CTA débloqués                                |
| Suspendue             | `Réactiver` uniquement                        | L'institution est gelée                               |

Le panneau **Configuration de l'institution** sur l'onglet Résumé montre toujours les 3 étapes :

- ✅ vert = terminé
- 🔵 bleu = étape active (CTA visible)
- 🔒 gris = verrouillée (prérequis manquant)

Il disparaît automatiquement quand les 3 étapes sont validées.

---

## Référence : standards et choix techniques

- **Mot de passe à usage unique** : généré par `secrets.token_urlsafe(12)` (≈ 96 bits d'entropie)
- **Force-change at first login** : flag `must_change_password` côté DB, redirection forcée vers `/change-password` côté front
- **Aucune rotation périodique** : conforme à NIST SP 800-63B (la rotation forcée est dépréciée)
- **Hash** : Argon2 (paramètres par défaut, conformes ANSSI)

---

## Dépannage

**"Create user failed" en créant l'admin** → la migration `e3a1b2c4d5f7_add_must_change_password` n'a pas été appliquée. Lance `alembic upgrade head`.

**Le bouton Créer Admin ne disparaît pas après création** → le profil utilisateur n'a pas été rechargé. Recharge la page.

**Mot de passe perdu** → utilise l'action "Réinitialiser le mot de passe" depuis la liste des utilisateurs (menu ⋯ en bout de ligne).
