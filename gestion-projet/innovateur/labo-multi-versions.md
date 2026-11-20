# Labo multi-versions (Windows 7 → 11) : instruction

- **Demande** : audit du contre-testeur du 20/11 (compatibilité multi-versions et labo réseau Docker), à instruire avant toute action.
- **Instruction** : innovateur, 2026-11-20. Niveau : `Vérifié` pour l'existant (#500 lue en 686abb28) ; `À vérifier` pour les points marqués comme tels.
- **Décision demandée** : à O, et au PO pour le point 3.

## 1. Ce qui existe déjà : #500 (6a, brouillon)

- Projet compose `ged-lab`, distinct des piles de l'application.
- Poste W2 : `dockurr/windows:6.06`, `VERSION: "11l"`, plafond de 3,5 Go et 2 CPU, ports limités à 127.0.0.1.
- Postes Chromium C1 et C2, et un lien dégradable par toxiproxy (`link.sh`, `toxiproxy.json`).
- Un mode hors ligne (`compose.offline.yml`), avec son garde-fou testé.
- `10l` est écarté : l'évaluation de Windows 10 LTSC se déclarait expirée le 19/11 (commentaire du compose).

L'audit propose quatre conteneurs : Windows 10, Windows 7, Chromium et toxiproxy. Trois d'entre eux existent déjà dans #500 : W2 tient le rôle du poste Windows récent, C1 et C2 celui du poste léger, et `link.sh` celui du lien dégradable.

**Choix (Adapt)** : on étend `ged-lab` au lieu de monter un second labo. Il ne manque que les navigateurs anciens.

## 2. Ce qui doit être prouvé, et le moyen le moins cher

| Écart de l'audit | Ce qui le prouve | Moyen |
|---|---|---|
| P0 `clipboard.writeText` sans garde (HTTP LAN) | page servie en HTTP sur une adresse non locale : `navigator.clipboard` y manque **sur tout navigateur**, même récent, car le contexte n'est pas sécurisé. C'est le déploiement qui le provoque, pas l'âge du moteur. | **moteurs du labo** (109, 115) en HTTP LAN |
| P1 `100dvh` sans repli | moteur sans `dvh` : avant Chrome 108 et Firefox 101, à 1366×768 | **moteur ancien** : Chromium 107 |
| P1 bandeau `nomodule` | un navigateur sans modules ES (IE) | **poste Windows 7** |
| Concurrence multi-postes | trois sessions sur des postes distincts | W2 + C1 + C2 (#500), déjà possible |
| Envoi sous 2 Mbit/s et 250 ms, puis coupure | lien toxiproxy | `link.sh` (#500), déjà possible |

**Moteurs du labo (LMV-1)**
- Des images Playwright épinglées sur des versions qui embarquent Chromium 109 et Firefox 115 ESR, plus Playwright 1.27.1 pour Chromium 107. `À vérifier` : la correspondance exacte des versions dans les notes de version de Playwright.
- Conteneur `--rm`, plafonné, sans Windows ni KVM.
- Cela couvre P0, servi en HTTP sur une adresse non locale, et P1 sur Chromium 107.

**Poste Windows 7 (LMV-2)**
- Le seul apport propre est le test du bandeau `nomodule` sous IE.
- Il prouve aussi le rendu réel d'un poste ancien : polices, mise à l'échelle et pilote graphique.

## 3. Points bloquants avant tout poste Windows 7

1. **Licence (décision PO)** : Microsoft ne publie pas d'édition d'évaluation de Windows 7. `À vérifier` : d'où `dockurr/windows` tire l'image `7u`. Sans licence ni source officielle, on ne monte pas ce poste.
2. **Navigateurs sur Windows 7**
   - Firefox 115 ESR vient de l'archive officielle de Mozilla. `À vérifier` : la fin de son support sur Windows 7.
   - Google ne publie plus d'installateur hors ligne de Chrome 109 : pas de binaire de source tierce, et pas de Supermium (fork tiers). Chrome 109 n'est donc couvert que par LMV-1.
3. **IE présent** : Windows 7 est livré avec IE 8, et IE 11 s'installe à part. Le script `nomodule` de F est en ES5 et doit s'exécuter sous IE 8 : pas de `forEach`, pas d'`addEventListener`, pas de `JSON`. À relire sur la PR de F.
4. **Isolement** : un Windows 7 n'a plus de correctifs. Il ne sort pas sur Internet après l'installation : mode hors ligne de #500, réseau interne seul.
5. **Mémoire** : la limite est de 3 Go et 4 CPU par créneau Docker, avec au moins 2 Go libres sur l'hôte. On fait tourner **un seul poste Windows à la fois** : W2 ou W7, jamais les deux.

## 4. Lots

| Lot | Contenu | Porteur proposé | Effort | Preuve attendue |
|---|---|---|---|---|
| LMV-1 | Spec e2e des deux écarts : presse-papiers en HTTP LAN sur Chromium 109 et Firefox 115 ; modale de dépôt à 1366×768 sur Chromium 107 | Q | 0,5 h-s | sur main : P0 rouge sur 109 et 115, P1 rouge sur 107 ; vert après #523 |
| LMV-2 | Profil `w7` dans `ged-lab` (même réseau, même lien, hors ligne après installation, plafond de 2,5 Go), Firefox 115 ESR installé par `oem/` | 6a, après #500 | 1 h-s | bandeau `nomodule` visible sous IE, dépôt à 1366×768 sous Firefox 115 |
| — | Décision de licence pour Windows 7 | PO | — | décision écrite avant LMV-2 |

- **Ordre** : LMV-1 d'abord, car il ne dépend de rien et porte les deux écarts P0 et P1. LMV-2 vient seulement si le PO tranche la licence.
- **Option écartée** : le labo à quatre postes de l'audit. Il double #500, demande environ 6 Go si tout tourne ensemble, et utilise `10l`, dont l'évaluation est expirée.
