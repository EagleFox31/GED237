# Captures visuelles (API simulée)

Compare l'apparence de trois écrans entre deux builds du frontend (ex. avant / après une migration CSS),
sans pile : le build est servi par `vite preview`, l'API est simulée dans le navigateur.

| Écran | Route | Repère métier vérifié avant capture |
|---|---|---|
| Connexion | `/edossier/` | liste des institutions affichée, avec « Ministère des Finances (MINFI) » + titre « Connexion » |
| Accueil tenant_admin | `/edossier/dashboard` | « Résumé Des Workflows » + titre « Vue D'Ensemble » |
| Plan de classement | `/edossier/classement` | domaine « Finances publiques » + titre « Plan de classement » |

## Garde (LESSON-2026-035)

Avant chaque capture, `screen-guard.ts` fait échouer le test si :

1. le repère métier de l'écran n'est pas visible ;
2. l'écran d'erreur (« Une erreur est survenue ») est affiché ;
3. l'application a appelé une route absente de la maquette (réponse 404, listée dans l'échec).

La clause 3 est rejouée à la fin de chaque test, après la capture : un appel non prévu parti après le
repère fait aussi échouer le test.

Le groupe « la garde refuse » prouve chaque clause séparément, et vérifie que c'est bien elle qui refuse :

1. réponse `{}` de l'incident : l'accueil plante, le repère manque ;
2. repère mal choisi, visible sur l'écran d'erreur (« Recharger la page ») : l'écran d'erreur est détecté ;
3. route des notifications retirée de la maquette (`mockApi(page, { omit })`) : l'appel non prévu est détecté.

## Maquette d'API

`api-mock.ts` intercepte `/api/v1/**` (même origine : le build est fait avec `VITE_API_URL=/api/v1`),
`/health` et la socket des notifications.

- Chaque réponse est typée avec `satisfies` sur le type du contrat (`types.ts`, `TenantPublic`,
  `Notification`, `UserProfile`, `BackendUser`), et chaque entrée de `API_ROUTES` annonce ce type
  (`apiRoute<T>(motif, corps)`) : `tsc` refuse une maquette qui ne respecte plus le contrat.
- Jamais de `{}` générique : une liste vide s'écrit `[]` typé, un objet est rempli champ par champ.
- La session tenant_admin est posée en `sessionStorage` (clés de `persistAuthTokens`), sans connexion.
- Nouvel écran : ajouter ses routes dans `API_ROUTES`, puis un test qui appelle `expectScreen`
  avec un repère propre à cet écran.

## Lancer (conteneur Playwright borné)

Les références sont écrites hors du dépôt, dans `e2e-out/visual/baseline/<os>` (ou `VISUAL_SNAPSHOT_DIR`) :
une par système, car le rendu des polices diffère.

```bash
# Build A : produire les références
docker run --rm --memory 2g --cpus 2 --log-opt max-size=1m -v "$PWD:/app" -w /app \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  bash -c "npm ci && npm run test:visual -- --update-snapshots"

# Build B (autre branche, même dossier e2e-out ou VISUAL_SNAPSHOT_DIR) : comparer
docker run --rm --memory 2g --cpus 2 --log-opt max-size=1m -v "$PWD:/app" -w /app \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  bash -c "npm ci && npm run test:visual"
```

En cas d'écart, le rapport donne l'image attendue, l'image obtenue et le diff dans `e2e-out/visual/results`.
Lancer depuis `frontend/`. Le même conteneur pour A et B évite les écarts de polices du système.
