# Instruction : aperçu, cloche et Paramètres (V1.1) — 18/11

Ce sont trois points de l'audit UX complémentaire du 18/11, relevés sur main ccf2cc2.
On code sur une branche créée depuis main **après** la fusion de #334 et de la 2e PR de F
(fix/v10-ux-lot2), parce que ces deux PR touchent `DocumentDetailModal.tsx` et `Header.tsx`.

## 1. Aperçu dans la fiche document

- **Constat :** l'onglet « Détails & Aperçu » (`frontend/components/DocumentDetailModal.tsx`)
  affiche les métadonnées et un bouton « Télécharger », mais aucun aperçu.
- **Existant à réutiliser (Adopt) :** `frontend/components/preview/DocumentPreview.tsx`.
  - Ses stratégies couvrent PDF, image, DOCX, XLSX, plus un repli « non pris en charge ».
  - Il passe par le hook `usePreviewBlob` et accepte la prop `enabled`.
  - Il sert déjà dans `ClassificationSlideOver.tsx` et `SpacesPage.tsx`.
- **Approche :**
  - insérer `<DocumentPreview documentId filename mimeType enabled={activeTab === 'info'} />`
    dans l'onglet ;
  - garder le bouton « Télécharger » ;
  - ne pas ajouter de nouveau visualiseur ni d'iframe à la main.
- **Droits :** le contenu est lu par la même route que le téléchargement, qui applique déjà
  les contrôles de lecture. Aucun changement côté serveur.
- **Effort :** F 0,5 ; Q 0,25 (un e2e : un PDF s'affiche dans la fiche).

## 2. Cloche : un clic mène au document

- **Constat :** dans `frontend/components/Header.tsx`, cliquer sur une notification la marque
  comme lue. Le menu reste ouvert et on ne va nulle part.
- **Existant à réutiliser :**
  - #331 (`frontend/lib/desktopNotify.ts`) calcule déjà la cible :
    `meta_data.document_id` → `/documents?open=<id>`, sinon `/documents` ;
  - `Documents.tsx` sait déjà ouvrir la fiche grâce à `?open=` ;
  - le serveur enregistre l'événement dans `meta_data` (`listeners.py`).
- **Approche :**
  - sortir la fonction de cible dans un petit module partagé, utilisé par la notification
    bureau et par la cloche ;
  - au clic : marquer comme lu, fermer le menu, puis `navigate(cible)`.
- **Dépendance :** #331 fusionnée. Sans elle, on recopie la même règle en 5 lignes, puis on
  dédoublonne à sa fusion.
- **Effort :** F 0,5 (test unitaire de la cible compris) ; Q 0,25.

## 3. Bouton ⚙️ Paramètres

- **Constat :** le bouton ouvre `/settings/display` (`DisplaySettings.tsx`) pour tous les
  rôles. La page n'est pas purement personnelle. Elle a trois onglets :
  - **Apparence** : choix menu latéral ou barre du haut. C'est un réglage personnel, à garder
    pour tous.
  - **Configuration** : unités organisationnelles et « Checklist de déploiement ». C'est de
    l'administration, sans sens pour un lecteur, un collaborateur ou un responsable.
  - **Guide des rôles** : simple lecture, sans risque.
- **Le titre** « Paramètres Organisation » trompe l'agent.
- **Approche :**
  - pour les rôles non administrateurs, n'afficher que « Apparence » et « Guide des rôles » ;
  - titre « Mes paramètres » ;
  - réutiliser le miroir de rôle côté interface déjà posé par #334 pour le menu ;
  - aucun changement côté serveur : les données d'unités restent filtrées par le serveur.
- **Effort :** F 0,5 ; Q 0,25.

## Total et ordre

- **Total :** ≈ 2,25 h-s (F 1,5 ; Q 0,75).
- **Ordre :** 1, puis 3, puis 2. L'élément 2 vient en dernier parce qu'il attend #331.
- Les trois éléments sont indépendants et peuvent faire l'objet d'une seule PR frontend.
- **Non-régression :**
  - les e2e de la fiche document et du menu restent verts ;
  - le choix d'apparence reste accessible à tous.
