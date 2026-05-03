# Scenarios de Test Fonctionnel - E-Dossier Cameroun

## Pre-requis

### Services requis
- PostgreSQL (localhost:5432) - base `edossier` + base `test_ged`
- Redis (localhost:6379)
- Backend FastAPI (localhost:8000)
- Frontend Vite (localhost:5173)

### Lancer le backend
```bash
cd backend
source venv/Scripts/activate   # Windows Git Bash
uvicorn app.main:app --reload --port 8000
```

### Lancer le frontend
```bash
cd frontend
npm run dev
```

### Seeder la base (voir seed_db.py)
```bash
cd backend
python scripts/seed_db.py
```

---

## SCENARIO 1 : Authentification Complète

### 1.1 Login avec mauvais identifiants
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Ouvrir http://locaClhost:5173 | Page login affichee |
| 2 | Saisir institution="MINFI", matricule="WRONG", password="wrong" | - |
| 3 | Cliquer "Connexion" | Erreur 401 "Identifiants invalides" |

### 1.2 Login + OTP valide (Super Admin)
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Saisir institution="MINFI", matricule="SUPER001", password="Admin@2025" | - |
| 2 | Cliquer "Connexion" | Ecran OTP affiche, session_token recu |
| 3 | Saisir l'OTP recu (visible en dev dans la reponse) | - |
| 4 | Cliquer "Verifier" | Redirection vers Dashboard, tokens stockes en sessionStorage |
| 5 | Verifier sessionStorage: access_token, refresh_token, user_profile | Tous presents |

### 1.3 Login Tenant Admin
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Saisir matricule="MINFI001", password="Minfi@2025" | - |
| 2 | Completer le flow OTP | Dashboard Tenant Admin affiche |
| 3 | Le menu lateral montre les options Tenant (Org, Users, etc.) | Menu specifique au role |

### 1.4 Logout
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Cliquer "Deconnexion" | Redirection vers login |
| 2 | Verifier sessionStorage vide | access_token, refresh_token, user_profile supprimes |
| 3 | Essayer d'acceder a /dashboard directement | Redirige vers login |
| 4 | Essayer le meme access_token via curl | 401 "Token has been revoked" |

---

## SCENARIO 2 : Gestion des Documents

### 2.1 Upload d'un document PDF
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter comme collaborateur (MINFI002) | Dashboard affiche |
| 2 | Naviguer vers "Mes Documents" | Liste des documents (vide ou avec docs existants) |
| 3 | Cliquer "Nouveau Document" / Upload | Formulaire d'upload |
| 4 | Choisir un fichier PDF, titre="Note de Service RH", categorie="RH" | - |
| 5 | Cliquer "Envoyer" | Document cree, apparait dans la liste, statut "draft" |
| 6 | Verifier dans la liste que le document apparait | Titre, categorie, taille, date corrects |

### 2.2 Consulter un document
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Cliquer sur un document dans la liste | Modal/page detail ouverte |
| 2 | Verifier les metadonnees | Titre, proprietaire, categorie, statut, taille affiches |
| 3 | Verifier le circuit de validation (workflow steps) | Steps charges depuis l'API (pas mock) |

### 2.3 Recherche Full-Text
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Taper "budget" dans la barre de recherche du header | Resultats en temps reel |
| 2 | Verifier que les resultats correspondent | Titres contenant "budget" affiches |
| 3 | Appliquer un filtre (statut=draft) | Resultats filtres correctement |

### 2.4 Isolation multi-tenant
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter comme user du MINFI | Voir uniquement les docs MINFI |
| 2 | Se deconnecter, se reconnecter comme user MINESUP | Voir uniquement les docs MINESUP |
| 3 | Un user MINFI ne doit PAS voir les docs MINESUP | 0 docs MINESUP dans la liste |

---

## SCENARIO 3 : Workflow de Validation

### 3.1 Creer un circuit de validation
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter comme Manager (MGR001) | Dashboard avec taches |
| 2 | Ouvrir un document en statut "draft" | Detail du document |
| 3 | Creer un workflow : Step 1=Verification, Step 2=Validation, Step 3=Signature | Workflow cree, document passe en "in_review" |
| 4 | Step 1 assignee a l'utilisateur courant, status="current" | Visible dans "Mes Taches" |

### 3.2 Approuver une etape
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Naviguer vers "Taches" | Liste des taches pending |
| 2 | Cliquer "Approuver" sur la tache en cours | Step passe a "completed" |
| 3 | La prochaine step passe a "current" | Notification envoyee a l'assigne suivant |

### 3.3 Rejeter une etape
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Sur une tache en cours, cliquer "Rejeter" avec commentaire | Step passe a "rejected" |
| 2 | Le document passe en "rejected" | Toutes les steps pending sont annulees |
| 3 | Le proprietaire recoit une notification | Notification avec motif du rejet |

---

## SCENARIO 4 : Administration Tenant

### 4.1 Gerer les Unites Organisationnelles
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter comme Admin Tenant (MINFI001) | Dashboard admin |
| 2 | Naviguer vers "Organisation" | Arbre des unites organisationnelles |
| 3 | Creer une nouvelle unite "Direction des Affaires Juridiques" | Unite creee, visible dans l'arbre |
| 4 | Modifier le nom d'une unite existante | Nom mis a jour |
| 5 | Supprimer une unite sans enfants | Unite supprimee |

### 4.2 Gerer les Utilisateurs
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Naviguer vers "Utilisateurs" | Liste des users du tenant |
| 2 | Creer un nouvel utilisateur : matricule, nom, email, role | User cree |
| 3 | Modifier le role d'un utilisateur | Role mis a jour |
| 4 | Desactiver un utilisateur | is_active=false, ne peut plus se connecter |

### 4.3 Analytics Tenant
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Naviguer vers "Dashboard" | KPI reels affiches (pas mock) |
| 2 | Verifier "Nombre d'utilisateurs" | Correspond au nombre reel dans la base |
| 3 | Verifier "Nombre de documents" | Correspond au nombre reel |
| 4 | Verifier "Workflows en cours" | Correspond aux steps status=current |

---

## SCENARIO 5 : Super Admin - Plateforme

### 5.1 Gestion des Tenants
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter comme Super Admin (SUPER001) | Dashboard plateforme |
| 2 | Voir la liste de tous les tenants | MINFI, MINESUP, etc. |
| 3 | Creer un nouveau tenant "MINTP" | Tenant cree avec domain |
| 4 | Analytics plateforme : total tenants, total users, total docs | Chiffres reels |

### 5.2 Un standard user ne peut PAS acceder aux analytics plateforme
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter comme collaborateur (MINFI002) | Dashboard standard |
| 2 | Tenter GET /api/v1/analytics/platform via curl | 403 Forbidden |

---

## SCENARIO 6 : Notifications Temps Reel

### 6.1 Recevoir une notification
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter comme User A (dans un onglet) | Dashboard |
| 2 | Dans un autre onglet, assigner une tache workflow a User A | Tache creee |
| 3 | User A voit une notification en temps reel (WebSocket) | Badge rouge sur la cloche, notification dans le dropdown |
| 4 | Cliquer sur la notification | Marquer comme lue, badge disparait |

### 6.2 Marquer toutes comme lues
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Avoir plusieurs notifications non-lues | Badge avec compteur |
| 2 | Cliquer "Tout marquer comme lu" | Toutes passent a is_read=true |

---

## SCENARIO 7 : Regles IFTTT

### 7.1 Creer et tester une regle
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter comme Admin Tenant | Dashboard admin |
| 2 | Naviguer vers "Regles" | Liste des regles |
| 3 | Creer regle: "Quand document PDF cree -> auto-classifier en Finances" | Regle creee, is_active=true |
| 4 | Uploader un document PDF | La regle s'execute, categorie="Finances" appliquee |

---

## SCENARIO 8 : Securite

### 8.1 Rate Limiting
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Envoyer 6 requetes POST /api/v1/auth/login en < 1 minute | Les 5 premieres repondent (401 ou 200) |
| 2 | La 6eme requete | 429 Too Many Requests |

### 8.2 Token Blacklist apres Logout
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Se connecter, noter le access_token | Token valide |
| 2 | Se deconnecter (POST /logout) | 200 OK |
| 3 | Utiliser l'ancien token pour GET /api/v1/users/me | 401 "Token has been revoked" |

### 8.3 OTP non expose en production
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Avec ENVIRONMENT=development dans .env | Login response contient le champ "otp" |
| 2 | Avec ENVIRONMENT=production dans .env | Login response ne contient PAS "otp" |

### 8.4 SECRET_KEY en production
| Etape | Action | Resultat attendu |
|-------|--------|-------------------|
| 1 | Mettre ENVIRONMENT=production + garder le SECRET_KEY par defaut | L'app refuse de demarrer avec RuntimeError |
| 2 | Mettre un vrai SECRET_KEY | L'app demarre normalement |

---

## Mapping Mock Data -> API Reelle

| Composant Frontend | Mock Data | Endpoint API Backend | Statut |
|---------------------|-----------|----------------------|--------|
| Dashboard.tsx (chart) | data[] 7 points | GET /analytics/tenant | A connecter |
| Dashboard.tsx (activity) | 4 activites | GET /notifications ou /audit-logs | A creer endpoint |
| Documents.tsx | 6 documents | GET /documents | A connecter |
| WorkflowTasks.tsx | 3 taches | GET /workflows/pending | A connecter |
| DocumentDetailModal.tsx | steps + history | GET /workflows/document/{id}/steps + GET /documents/{id}/versions | A connecter |
| OrgDashboard.tsx | KPIs + chart + table | GET /analytics/tenant | A connecter |
| PlatformDashboard.tsx | 3 tenants | GET /tenants + /analytics/platform | A connecter |
| ServiceDashboard.tsx | 3 stats | GET /analytics/tenant | A connecter |
| AuditLogs.tsx | 4 logs | A creer endpoint /audit-logs | Backend manquant |
| LibraryView.tsx | 4 docs + stats | GET /documents?status=validated | A connecter |
| DisplaySettings.tsx | 5 departements | GET /org-units | A connecter |
| LoginPage.tsx | DEMO_CREDENTIALS | Garder en dev, cacher en prod | OK |
| DemoProfiles.tsx | 7 profils | Garder en dev, cacher en prod | OK |
