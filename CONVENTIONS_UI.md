# Conventions UI — GED237 Admin Interface

Ce document centralise les règles de cohérence visuelle à respecter sur toutes les pages de l'interface d'administration (profil `tenant-admin`).

## 1. Structure des vues en deux colonnes (Liste + Détail)

Toutes les pages utilisant ce layout (Circuits, Règles, etc.) doivent respecter la structure suivante :

### Colonne Gauche — Liste
- Bouton "Nouveau/Créer" pleine largeur en haut, bleu, arrondi (`rounded-[1.5rem]`), uppercase italic
- Chaque carte : `p-5 rounded-[2rem] border cursor-pointer`
- État actif : `border-rdpc-blue shadow-xl ring-2 ring-rdpc-blue/10`
- Bouton supprimer (icône poubelle) et toggle actif/désactif alignés en haut à droite de la carte

### Colonne Droite — Détail
- En-tête de la vue détail : **`flex justify-between items-start mb-6`**
  - À gauche : titre H2 + sous-titre (code, description)
  - À droite : **bouton "Modifier"** (style : `px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-rdpc-blue hover:text-white transition-all text-xs tracking-widest uppercase flex items-center gap-2 shadow-sm`)
- Le bouton "Modifier" ouvre le même modal que "Créer", pré-rempli avec les données existantes

> **Référence** : `TemplatesTab.tsx` lignes 272-283 est la version canonique de ce pattern.

---

## 2. Modals de Création / Édition

- Un modal unique sert à la fois pour la **création** et la **modification**
- Le titre du modal doit changer dynamiquement : `"Nouveau X"` ou `"Modifier le X"`
- Le bouton de soumission doit aussi changer : `"Enregistrer"` ou `"Mettre à jour"`
- À la fermeture, toujours appeler `resetAndClose()` qui remet tous les états à zéro (y compris `editingId`)

## 3. Gestion des erreurs API

- Les appels API (`api.ts`) doivent **toujours extraire le champ `detail`** de la réponse JSON d'erreur avant de lancer une `Error`
- L'interface doit afficher ce message exact, pas un message générique codé en dur
- Pattern à suivre :
```ts
if (!response.ok) {
    let msg = 'Fallback message';
    try { const errBody = await response.json(); msg = errBody.detail || msg; } catch(e) {}
    throw new Error(msg);
}
```

## 4. Messages Toast

- Succès (vert) : confirmer l'action qui vient d'être faite
- Erreur (rouge) : afficher le message de l'API, jamais un message générique
- Durée : 4 secondes, disparition automatique

## 5. Sécurité de saisie (Dirty State Guard)

- Tout modal de création qui contient un formulaire multi-champs doit implémenter un `isDirty` state
- Si `isDirty === true` au moment de fermer le modal, afficher un dialog de confirmation avant de perdre la saisie
- Pattern : `handleCloseModal()` vérifie `isDirty`, appelle `setShowCloseWarning(true)` si vrai, sinon `resetAndClose()`
