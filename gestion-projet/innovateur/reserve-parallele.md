# Réserve parallèle par session (consigne du PO, 19/11)

Consigne du PO : « travaillons plus vite ». Aucune session n'attend sans rien faire. Pendant qu'un test, une passe Docker ou une relecture tourne, elle prend la tâche suivante de sa réserve. I rééquilibre dès qu'une session est surchargée ou libre, avec O en copie.

## Règles

1. On lance en arrière-plan tout test, toute passe Docker et toute CI de plus de 2 minutes, puis on prend aussitôt une tâche de réserve.
2. Une tâche de réserve touche **d'autres fichiers** que la tâche en cours, et se fait **sans créneau Docker** quand le créneau de la session est pris (créneaux du 19/11 : F 1, B 1, aide-api 1).
3. Une session sans tâche écrit tout de suite à I (« libre »). I lui envoie la suivante, avec O en copie, en partant de cette réserve, de `plan-fusion-v1.1.md` et de `charges-v1.1.csv`.
4. Un retour attendu (validation de Q, signal d'O, contrat d'un pair) n'est pas une raison d'attendre : on passe à la réserve et on revient au retour quand il arrive.
5. I met cette page à jour à chaque changement de charge, et au plus tard au point de 16:30.

## Réserve au 19/11, 09:00

| Session | En cours | Réserve, dans l'ordre | Docker ? |
|---|---|---|---|
| **Q** | veille ; attend #453 et le contrat DELETE de #181 | 1. **Avancer les preuves des 95 %** si rien ne bloque : `prove_tls` (item 27, prévu le 20/11), rejeu du manuel sans écart (item 31, issue #273, prévu le 25/11). Sinon, dire à I ce qui bloque. 2. Garde-fou des leçons LEC-3 (DEC-2026-009), en PR brouillon dès maintenant. 3. Réparation du hook pre-commit (0,5 h-s), empilée sur #433. 4. 57 septdecies, contrastes (S). | 1 : oui ; 2 à 4 : non |
| **F** | passe Docker `453f 181m` | 1. **#308 : LESSON-2026-045 → 073** (dernière collision de la file ; même titre que dans #241, par fusion, sans rebase). 2. Corps de PR et commits locaux de #453 et #181, prêts pour le signal. | non |
| **B** | #438 (fusion de main), puis tsc et unit sur l'essai 435×445 | 1. #197 : préparer le rattachement à `60e40a686375` dans une branche locale, à pousser dès que #457 est fusionnée. 2. Contrat DELETE de #181 pour F (cohérence #152/#263) : réponse écrite, sans Docker. | 1 : non |
| **aide-api** | 57 L7-3, filtres date et auteur sur GET /documents | 1. 57 L12-3 (demandeur et date d'envoi sur `/tasks`), empilée sur #438. 2. 57 L7-2, PDF officiel côté serveur, après L7-3 et #435. 3. 57 L13-4, WebSocket, après #155. | selon créneau |
| **I** | file, charges, DEC | 1. PR des leçons (LEC-1, LEC-2, DEC-2026-009), en brouillon. 2. Inscrire L7-3 dès qu'elle a un numéro. | non |

## Leviers pour les 95 % (proposés à O, pas décidés)

- **Preuves de Q plus tôt** : les 4 preuves des items 27, 28, 29 et 31 sont le chemin critique. Les avancer avance la coupe.
- **Paire doublons plus tôt dans la file** : #171 et #199, validées par Q, sont en vague 4 (30/11 au 02/12). Les placer juste derrière #181 en vague 2 ferait passer l'item 19 plus tôt. C'est un choix d'ordre de la file, pour O.
