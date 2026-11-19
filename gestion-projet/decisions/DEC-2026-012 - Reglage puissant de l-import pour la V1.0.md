# DEC-2026-012 : le réglage puissant de l'import devient celui de la V1.0 (item 8)

- **Date** : 19/11/2026, vers 13:45 (décision directe du PO, relayée par O).
- **Statut** : décidé par le PO ; exécution par aide-api (PR « capacité »), Q (essai de confirmation), O (fusion).

## Constat

Essais à 100 000 documents (rapport sur #473, 7243b3c7) :

| Réglage | Durée | Critère de 20 min | Perte / erreur |
|---|---|---|---|
| Installation livrée (1 processus api, concurrence 2) | 30 min 28 | non tenu | 0 / 0 |
| Réglage puissant (2 processus api, concurrence 4, 7,5 cœurs ; machine de 8 cœurs et 12 Go) | 18 min 41 | tenu, marge de 6 % | 0 / 0, recherche de 29 à 174 ms |

## Décisions

1. **Le réglage puissant devient celui de la V1.0.** Il est porté par la PR « capacité » d'aide-api (compose et variables d'environnement, avec `.env.example` à jour).
2. **Serveur minimum : 8 cœurs et 12 Go**, écrit dans `DOCS/exploitation/installation.md`. Sans ce minimum, la 1.0 promettrait plus que ce qui a été mesuré.
3. **Essai de confirmation à 16:00**, avec le compose de la PR capacité tel quel. Un seul essai à 6 % de marge ne suffit pas.
4. **La PR capacité est fusionnée avant 17:30.** Sinon l'item 8 n'est pas compté, et la coupe se fait sans lui.
5. **La coupe n'attend pas l'item 8.** Score : 30,5/32 avec C6 seule ; **31,5/32 avec C6 et l'item 8** (l'item 8 vaut 1 point).

## Ce que l'utilisateur voit

- Sur un serveur de 8 cœurs et 12 Go, l'import de 100 000 documents prend environ 19 minutes.
- Sur un serveur plus petit, le temps n'est pas garanti : la notice le dit.

## Suites

- O confirme vers 17:30 si la PR capacité est fusionnée ; l'innovateur note alors « item 8 compté » ou « item 8 non compté » dans `note-po-coupe-release-v1.0.0.md` et dans `couverture-95-19-11.md`.
- Si l'essai de 16:00 échoue, l'item 8 n'est pas compté et le réglage retourne en V1.1 pour analyse.
- **Porteur du minimum machine (décision 2) : aide-api, dans la PR capacité** (branche `feat/item8-capacity-settings`, pas encore poussée au 19/11 vers 13:50). Son diff de `DOCS/exploitation/installation.md` contient déjà « 8 cœurs » et « 12 Go de RAM », avec les nouveaux plafonds du compose et le renvoi au rapport de l'essai à 8 cœurs. La relecture de B vérifie que ces lignes sont présentes dans la PR fusionnée.
