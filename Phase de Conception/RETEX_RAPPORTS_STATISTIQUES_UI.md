# Retour d'Expérience - UI Rapports & Statistiques

## Objet

Ce document fige les leçons tirées de l'itération sur `/reports` pour éviter :

- le retour du jargon technique dans l'UI
- la surcharge visuelle
- les doublons de navigation
- les écrans de reporting trop analytiques pour un usage administratif

---

## 1. Rôle du module

`Rapports & statistiques` est un **centre de pilotage**.

Il sert à :

- voir l'état général
- repérer les blocages
- comparer les services
- exporter un état
- orienter l'utilisateur vers le bon module pour agir

Il ne doit pas devenir :

- un second module d'audit
- un second module de classement
- un second module de gestion des agents
- un second explorateur documentaire

---

## 2. Public cible réel

Le profil à privilégier est un utilisateur administratif habitué à :

- Word
- Excel
- PowerPoint
- tableaux de suivi
- lecture rapide d'un état de situation

Conséquence :

- l'écran doit être calme
- la lecture doit être immédiate
- les termes doivent être métiers
- les exports doivent être évidents

---

## 3. Règles UX non négociables

- une seule navigation d'onglets, jamais de double navigation latérale dans `/reports`
- un onglet = une question métier
- la `Synthèse` doit rester la vue la plus simple
- les graphes ne doivent pas dominer la compréhension
- les tableaux ne doivent apparaître que s'ils servent vraiment
- les textes d'aide longs doivent aller en tooltip, pas en pavés visibles
- les actions doivent être compactes, de préférence en icônes avec tooltip
- l'ordre des onglets doit suivre l'ordre naturel de lecture métier

Ordre retenu :

- `Synthèse`
- `Workflows & délais`
- `Services`
- `Activité documentaire`

---

## 4. Règles de contenu

### 4.1 Interdiction du jargon technique visible

Ne jamais afficher au métier :

- clés techniques API
- noms internes de séries
- identifiants de champs
- noms d'endpoints
- termes comme `timeseries`, `analytics`, `classification_reviews`

Exemples :

- `documents_created` -> `Créations`
- `documents_auto_classified` -> `Classement automatique`
- `documents_needing_review` -> `À revoir`

### 4.2 Français naturel obligatoire

Les libellés visibles doivent utiliser :

- apostrophes correctes
- accents
- formulations administratives normales

À éviter :

- `l institution`
- `documents traites`
- `retards estimes`

À préférer :

- `l'institution`
- `documents traités`
- `retards estimés`

### 4.3 Cartes KPI

Une carte KPI ne doit pas contenir un paragraphe.

Structure recommandée :

- libellé
- valeur
- sous-texte court
- badge `Estimation` si nécessaire
- aide détaillée via tooltip

Le sous-texte doit rester compréhensible, pas télégraphique ni opaque.

---

## 5. Règles spécifiques à la Synthèse

La `Synthèse` doit répondre en quelques secondes à :

- est-ce que la situation est normale ?
- y a-t-il un problème ?
- où faut-il regarder ensuite ?

La structure recommandée est :

- état général
- 4 à 5 KPI
- un graphe de synthèse unique et sobre
- points d'attention

À éviter dans `Synthèse` :

- tableau détaillé systématique
- narration analytique complexe
- logique BI trop visible
- multiples sous-blocs concurrents

---

## 6. Règles sur les graphes

- un graphe doit répondre à une vraie question métier
- un tooltip de graphe ne doit jamais montrer des codes internes
- les couleurs ne doivent pas être le seul vecteur d'information
- la légende doit être lisible sans apprentissage
- dans `Synthèse`, un seul graphe principal maximum

---

## 7. Références de style interne

Pour `/reports`, viser :

- la paix visuelle de `/rules`
- la respiration du dashboard
- la sobriété d'un écran de travail administratif

Ne pas viser :

- un mini outil analytique autonome
- une galerie de widgets
- un écran "BI" surchargé

---

## 8. Contrôle avant livraison

Avant toute évolution de `/reports`, vérifier :

- est-ce qu'un administratif comprend l'écran sans explication orale ?
- est-ce qu'un tooltip montre un terme technique ?
- est-ce qu'un texte visible peut être raccourci ?
- est-ce qu'une carte répète ce qu'un autre bloc dit déjà ?
- est-ce que l'écran ressemble encore à la même application que `/rules` et `/classement` ?
