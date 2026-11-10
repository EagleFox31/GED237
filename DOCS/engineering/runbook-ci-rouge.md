# Runbook — CI rouge : diagnostiquer avant de toucher aux pipelines

Pour : quiconque voit un run rouge sur une PR ou sur `main`. Agnostique du fournisseur CI ; GitHub Actions est l'instance actuelle (commandes `gh`). Source : LESSON-2026-024 (`lessons-learned.md`). Règle de revue : **aucune modification de `.github/` sans l'annotation d'erreur citée dans la PR** (texte et lien du run).

## Étape 0 — Est-ce nous ou la plateforme ? (5 min, dans cet ordre, s'arrêter à la première réponse)

| # | Question | Commande (GitHub) | Si oui |
|---|---|---|---|
| 0.1 | Le fournisseur CI est-il dégradé ? | `curl -s https://www.githubstatus.com/api/v2/components.json \| jq -r '.components[] \| select(.name=="Actions" or .name=="API Requests") \| "\(.name)=\(.status)"'` : l'un ≠ `operational` | plateforme : attendre `operational`, puis `gh run rerun <id>` ; ne rien modifier |
| 0.2 | Une PR **témoin sans surface CI** (docs seule) est-elle rouge en même temps ? | `gh run list --branch <branche-docs> --limit 3` | plateforme (même conclusion que 0.1) |
| 0.3 | Le run a-t-il au moins un job ? Sinon, que dit l'annotation ? | `gh run view <id>` ; `gh api repos/{owner}/{repo}/check-runs/<check_id>/annotations` | « workflow file issue » avec annotation → fichier et ligne désignés : passer à 0.5 |
| 0.4 | Le workflow réutilisable épinglé est-il joignable ? | SHA lu dans `ci.yml` (`uses: …reusable-impact-analysis.yml@<sha>`) → `gh api repos/EagleFox31/appfactory-project-automation/commits/<sha> -q .sha` | 404 ou droit refusé → SHA réécrit ou accès perdu : corriger l'épinglage, pas le job |
| 0.5 | Modification du pipeline | seulement maintenant, avec l'annotation de 0.3 citée dans la PR | — |

Mécanisme à retenir : un échec simultané sur des branches sans lien, dont une sans surface CI, désigne la plateforme, pas le code.

## Étape 1 — Quel gate, quel job ? (Impact-Aware CI)

1. Lire le job `impact` du run : sa sortie `gates` (liste parmi `backend`, `frontend`, `workflow-lint`, `sast`, `dependency-audit`, `container-scan`) vient de `.github/appfactory-impact.json` (surfaces ↔ chemins modifiés).
2. Un gate attendu absent = la surface n'est pas déclarée pour ces chemins (corriger la carte, pas le job) ; un gate inattendu = fichier transversal touché (voulu).
3. Journal du seul job rouge : `gh run view <id> --log-failed | tail -n 60` ; l'assertion ou l'erreur qui compte est dans les 60 dernières lignes, pas dans les étapes d'installation.

## Étape 2 — Rejouer en local avant toute PR de correctif (Docker uniquement)

- `backend` : `docker compose run --rm api pytest -q <chemin du test rouge>` ; `frontend` : `docker compose run --rm frontend npm run lint -s && npm run build -s` (mêmes versions que l'image CI).
- Le correctif part en PR seulement si le rejeu local reproduit **puis** fait disparaître l'erreur ; sinon c'est l'environnement CI (cache, secret, service) et l'étape 0.3 reprend.
- Pas de « retry jusqu'au vert » : un run instable se consigne dans `lessons-learned.md` avec le journal, puis se corrige.

## Preuve et mémoire

Toute panne plateforme ou CI instable > 15 min : entrée dans `lessons-learned.md` (contexte daté UTC, cause, classification, prévention vérifiable), identifiant d'incident du fournisseur quand il existe (ex. GitHub `tp8cghg7tlc4`, 09/11/2026).
