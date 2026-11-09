# Spécification — P8 jouable à l'écran : `fix/validation-cycle-ui` (dev-frontend, F ≈ 0,45 j, e2e jeu 12)

Pour : dev-frontend (reprise à froid à sa relance), ci-qa (rejeu `uat/validation-cycle.spec.ts`), orchestrateur. Instruction innovateur du 2026-11-09 soir. Corrige VAL-D1..D3 (`PASSATION-dev-frontend.md` 20:04, `matrice-recette.md` P8). Niveaux : `Vérifié` = lu dans `main` a4b8dbe et dans le diff des PR #48 / #51 ; `Proposé` = à trancher dans la PR. Pas de code ici.

**Contrat backend gelé** (`PASSATION-dev-backend.md` 20:16, PR #51 `fix/workflow-pending-validators`, « ne plus changer ces noms ») : `GET /workflows/validators` → `[{id, full_name}]` (utilisateurs actifs du tenant au rôle valideur, ouvert à tout rôle qui peut créer des documents, 403 au lecteur) ; `GET /workflows/pending` → chaque tâche porte `document.current_version_id` (UUID **nullable**) ; `POST /workflows/step/{id}/actions` attend `action_type` ∈ `read_ack | visa | approval | final_signature`, `outcome` ∈ `accepted | acknowledged | rejected | returned`, `document_version_id` UUID **obligatoire**, `comment` optionnel côté serveur (`schemas/workflow.py:72-78`).

## 1. Parcours P8 écran par écran (cible)

| # | Acteur, écran (route) | Geste | Appels API | Résultat visible |
|---|---|---|---|---|
| 1 | MINFI002, Atelier (`DraftWorkspace`, route `dashboard` du profil collaborateur) | sur une carte **brouillon**, bouton **Soumettre** → panneau « Soumettre au visa » : liste **Valideur** remplie, choix de MGR001, bouton **Soumettre au visa** | `GET /workflows/validators` à l'ouverture du panneau ; `POST /workflows/document/{id}/steps` avec `assigned_to` = id choisi | la carte passe au badge **En Validation** ; panneau fermé |
| 2 | MGR001, Espace Manager (`ValidationHub`, route `dashboard` du profil manager) | la carte du document apparaît avec **titre**, émetteur, date, lien **Ouvrir le document** (version courante), boutons **Rejeter** et **Viser** (libellé selon `expected_action_type`) | `GET /workflows/pending` au chargement ; lien → `GET /documents/{id}/content?disposition=inline` (existant, `documents.api.ts:77`) | pile des tâches ; aperçu du document dans un nouvel onglet |
| 3 | MGR001, même écran | **Viser** | `POST /workflows/step/{id}/actions` `{action_type: expected_action_type, outcome: accepted` (ou `acknowledged` si `read_ack`)`, document_version_id: document.current_version_id}` | la carte disparaît ; document `validated` (ou étape suivante) |
| 4 | MGR001, même écran | **Rejeter** → boîte **Motif du rejet** (champ obligatoire, **Confirmer** inactif tant que vide) → **Confirmer** | même route, `outcome: rejected`, `comment: motif` | carte disparue ; document `rejected` |
| 5 | MINFI002, Atelier | rouvre la carte : badge **Rejeté** ou **Validé**, **motif** lisible sous le badge, aucune action de modification | `GET /documents` (existant) + `GET /workflows/document/{id}/actions` pour le motif (existant, `workflows.api.ts:34-39`) | SC-VAL-04 réduit (« retour pour correction » reste V1.1) |

Actions par type (`Vérifié`, libellés déjà en place `ValidationHub.tsx:48-55`) : `visa` → **Viser**, `approval` → **Approuver**, `final_signature` → **Signer**, `read_ack` → **J'ai pris connaissance** (outcome `acknowledged`, pas de bouton Rejeter : une prise de connaissance ne se refuse pas, `Proposé`). Repli `|| 'visa'` quand `expected_action_type` est absent : à garder.

## 2. Écart existant → besoin (`Vérifié`, fichier:ligne)

| Écran | Existant | Écart |
|---|---|---|
| Atelier, liste des valideurs | `DraftWorkspace.tsx:25` `api.getUsers()` (refusé 403 au collaborateur, avalé par `.catch(() => [])`) ; `:246` filtre **en dur** `role_id !== 5` ; option `:248` = `matricule - prénom nom` | **VAL-D1** : remplacer par `GET /workflows/validators` (nouvelle fonction dans `workflows.api.ts`, exposée dans `services/index.ts` à côté de `submitWorkflowAction:105`) ; option = `full_name`, `value` = `id` ; supprimer le filtre en dur et l'appel `getUsers` de cet écran |
| Atelier, erreurs | `:64` et `:87` `alert(...)` | passer par le bus d'erreurs (`pushApiError` est déjà déclenché par `services/http/errorAdapter.ts:29,40` sur tout `apiCall` en échec) : retirer les `alert`, afficher l'état vide (§ 4) |
| Atelier, carte après décision | `:150-154` badge `in_review → En Validation`, sinon `doc.status` brut (`rejected`, `validated` en anglais) ; aucun motif affiché | libellés **Rejeté / Validé / Signé** ; motif = dernier `comment` des actions du document (`getWorkflowActions`), chargé à l'ouverture de la carte ou au clic « Voir le motif » |
| Espace Manager, version | `ValidationHub.tsx:36` `step?.document_version_id ?? step?.current_version_id ?? ''` : **aucun** de ces deux champs n'existe dans la réponse → chaîne vide → **422** | **VAL-D2** : lire `item.document?.current_version_id` ; si `null`, boutons inactifs (§ 4) ; aucune requête envoyée |
| Espace Manager, motif | `:23` `confirm()` natif ; `:37` commentaire **en dur** `Action via Dashboard Manager (…)` ; `:43` `alert("Erreur…")` | **VAL-D3** : boîte modale « Motif du rejet » (textarea avec `<label>` **Motif**, bouton **Confirmer** désactivé si vide, **Annuler**) ; pour Viser : pas de `confirm()` natif (`Proposé` : la carte disparaît, c'est le retour suffisant ; un `confirm` casse l'a11y et oblige la spec à un `page.once('dialog')`) ; `comment` = motif saisi ou absent ; erreurs via le bus, pas `alert` |
| Espace Manager, document | aucun lien vers le contenu ; la carte n'est pas cliquable (`cursor-pointer` sans `onClick`, `:81`) | lien **Ouvrir le document** (`target=_blank`) vers `GET /documents/{id}/content?disposition=inline` ; afficher `document.owner_name` déjà fourni (`schemas/workflow.py:48`) |
| `/tasks` (`WorkflowTasks`, `App.tsx:193`) | `:31` `api.validateWorkflowStep(stepId, 'approve' \| 'reject')` → `workflows.api.ts:47-59` envoie `action_type: 'approve'` (hors enum, 422) et **aucun** `document_version_id` ; `:78` affiche `document_id` brut | passer par `submitWorkflowAction` avec `task.expected_action_type || 'visa'` et `task.document.current_version_id` ; afficher `task.document.title` ; **supprimer** `validateWorkflowStep` du service (plus aucun appelant) |
| Fiche document (`DocumentDetailModal.tsx:59-80`) | déjà conforme : `expected_action_type`, `document.current_version_id`, garde `:66` si absent, `prompt()` pour le motif `:62` | hors périmètre de la PR (pas dans le parcours P8) ; remplacer `prompt()` par la même modale = V1.1 sauf si la modale est un composant partagé livré ici |

## 3. Sélecteurs et libellés attendus par `uat/validation-cycle.spec.ts` (PR #48)

| Spec | Sélecteur / libellé | Décision |
|---|---|---|
| carte (Atelier et Espace Manager) | `div:has(> h4)` filtré sur `h4` contenant le titre | **respecter** : le titre reste le `h4` enfant direct de la carte (`ValidationHub.tsx:96`, `DraftWorkspace` carte) ; ne pas envelopper le `h4` dans un autre bloc |
| SC-VAL-01 | boutons `Viser` (exact) et `/Rejeter/` visibles dans la carte | respecter |
| SC-VAL-01 écran | `getByRole('button', {name: 'Soumettre'})` sur la carte ; `page.getByRole('combobox')` **sans nom** ; `option` `hasText: 'MGR001'` ; bouton `Soumettre au visa` ; badge `En Validation` | **spec à faire évoluer** (contrat gelé) : l'option affiche `full_name`, pas le matricule → sélectionner par `value` = `manager.id` (déjà obtenu par `apiAs('manager').me()` dans la spec) ou par `hasText` du nom du manager seedé. Côté UI : donner `aria-label="Valideur"` au `select` (ou `htmlFor` sur le label `:239`) et la spec ciblera `getByRole('combobox', {name: /valideur/i})` |
| SC-VAL-02 | clic `Viser` → carte `toHaveCount(0)` ; API : document `validated`, étape `completed` | respecter ; la spec peut garder `page.once('dialog')` sans effet si le `confirm` disparaît |
| SC-VAL-03 | clic `/Rejeter/` → `getByRole('textbox', {name: /motif/i})` → `/Confirmer/` → document `rejected` | **respecter** : `<label>` lié contenant « Motif » ; bouton « Confirmer » |
| SC-VAL-04 | bouton `/Retour/`, textbox `/commentaire/i`, document `returned` | reste `fixme` (V1.1, écart 17) ; **ne pas** ajouter de bouton Retour |

À ajouter côté spec (ci-qa / F, jeu 12) : SC-VAL-03 bis « Confirmer inactif tant que le motif est vide » (`toBeDisabled`) ; SC-VAL-04 réduit : MINFI002 rouvre l'Atelier et lit le badge **Rejeté** + le motif « Référence budgétaire absente ».

## 4. États à couvrir

| État | Déclencheur | Comportement attendu |
|---|---|---|
| aucun valideur éligible | `/validators` → `[]` | message dans le panneau « Aucun valideur disponible dans votre institution : demandez à l'administrateur d'activer un responsable », bouton Soumettre au visa **inactif** ; pas d'`alert` |
| 403 lecteur | READ001 ou profil sans `documents:create` appelle `/validators` | le bus d'erreurs affiche le 403 (déjà câblé par `errorAdapter`) ; le panneau se ferme ou reste avec l'état vide ci-dessus ; **SMK-10** (masquer Soumettre au lecteur) reste dans `fix/recette-smoke-2` |
| document sans version | `document.current_version_id === null` dans `/pending` | Viser/Rejeter **désactivés**, infobulle « Document sans version : action impossible, contactez l'administrateur » ; aucune requête |
| 422 / 409 à l'action | réponse d'erreur du `POST …/actions` | la carte **reste** dans la pile, bus d'erreurs (`pushApiError`), bouton réactivé (`processingId` remis à `null`, déjà le cas `:45`) |
| erreur réseau | `buildNetworkError` (`http/client.ts:33`) | même bus ; liste non vidée ; pas de `console.error` seul (`ValidationHub.tsx:15`, `DraftWorkspace.tsx`) |
| pile vide | `/pending` → `[]` | écran vide existant « Aucun dossier en attente » (`:67-70`) conservé |
| double clic | deux clics sur Viser | `processingId` bloque déjà le second (`:98`) ; garder |
| `read_ack` | `expected_action_type === 'read_ack'` | un seul bouton **J'ai pris connaissance**, outcome `acknowledged` |

## 5. Acceptation et budget

- `criteres-acceptation.md` § P8 : SC-VAL-01 (pile visible, aucune modification du contenu), SC-VAL-02 (Viser → `validated`, rédacteur figé), SC-VAL-03 (motif **obligatoire côté UI** : le serveur l'accepte vide, la règle est donc à l'écran ; statut Rejeté, motif visible par le rédacteur), SC-VAL-04 réduit (badge + motif, aucune action). `matrice-recette.md` l.88-90 : état « e2e réel, jeu 12 » → à passer à l'état constaté par I après le run.
- Preuve dans la PR : build + lint Docker verts ; capture **Viser** / **Rejeter + motif** ; e2e local `--project=uat validation-cycle` : SC-VAL-01, 01 écran, 02, 03 verts (fixme retirés), 04 `fixme` conservé ; aucun `alert`/`confirm`/`prompt` dans les deux écrans du parcours (`grep -n "alert(\|confirm(" frontend/profiles/manager/pages/ValidationHub.tsx frontend/profiles/collaborator/pages/DraftWorkspace.tsx` vide).
- Budget : **0,45 j F**, déjà compté dans les +0,7 j P8 (`point-2026-11-14.md` § 4 ; 0,25 j B livré en #51). Pas de nouveau budget pour la modale si elle reste locale à `ValidationHub` ; composant partagé (réutilisé par `DocumentDetailModal`) = +0,1 j, à ne prendre que si l'avance le permet.

## 6. Ordre de réalisation conseillé (tenir e2e jeu 12)

1. **Mar 10 matin, sans attendre #51** : `workflows.api.ts` : `listValidators()` + export ; `ValidationHub` : lecture de `item.document?.current_version_id`, garde `null`, retrait de `confirm`/`alert`/commentaire en dur, modale motif ; `aria-label` du `select` de l'Atelier. Tout est codable contre le contrat gelé ; en local, `/validators` renvoie 404 tant que #51 n'est pas sur `main` : prévoir l'état vide (§ 4) et tester sur la branche B si besoin.
2. **Mar 10 après-midi** : Atelier → `/validators`, badges FR + motif du rédacteur ; `WorkflowTasks` → `submitWorkflowAction` ; suppression de `validateWorkflowStep`.
3. **Mer 11** : rebase sur `main` dès la fusion de #51 (prévue mer par O) ; e2e local P8 ; mise à jour de la spec (option par `value`, retrait des `fixme` 01 écran / 02 / 03, ajout 03 bis et 04 réduit) **dans la même PR** pour que #48 déjà fusionnée ne reste pas rouge ; PR ouverte depuis `main`.
4. **Jeu 12** : run P8 avec ci-qa sur `main` + PR F ; rapport joint ; I bascule la matrice.
5. Si #51 glisse après mer soir : livrer quand même les points 1-2 (ils ne dépendent que des noms gelés) et garder SC-VAL-01 écran en `fixme` jusqu'à la fusion ; P8 manuelle le 13 reste le repli (`deroule-demo.md` § 5).

Sources : `frontend/profiles/manager/pages/ValidationHub.tsx`, `frontend/profiles/collaborator/pages/DraftWorkspace.tsx`, `frontend/components/WorkflowTasks.tsx`, `frontend/components/DocumentDetailModal.tsx`, `frontend/services/resources/workflows.api.ts`, `frontend/services/http/errorAdapter.ts`, `frontend/App.tsx`, `backend/app/schemas/workflow.py`, `backend/app/models/workflow.py:20-25` (lus le 09/11 soir) ; `gh pr diff 48` (`frontend/e2e/specs/uat/validation-cycle.spec.ts`) et `gh pr diff 51` (lecture seule) ; `PASSATION-dev-backend.md` 20:16 ; `PASSATION-dev-frontend.md` 20:04 et 20:09 ; `criteres-acceptation.md` § P8 ; `matrice-recette.md` l.88-90.
