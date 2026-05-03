# GED237 Frontend

Frontend React/TypeScript de GED237.

## Role du module

Cette application expose les parcours web de GED237 :

- authentification MFA
- tableaux de bord par role
- consultation documentaire
- workflows et bannettes
- administration organisationnelle
- import, espaces documentaires et ecrans de classement

## Stack

- React 19
- TypeScript
- Vite
- Zustand
- Playwright

## Commandes utiles

```bash
npm ci
npm run dev
npm run build
npm run typecheck
npm run lint
npm run test:e2e
```

## Variable d'environnement principale

- `VITE_API_URL` : URL du backend, par exemple `http://localhost:8000/api/v1`

## Qualite attendue

Un frontend considere comme propre doit au minimum satisfaire :

- build de production vert
- typecheck vert
- lint vert

## Reference projet

Pour l'etat reel du projet et des risques connus, voir `../AUDIT.md`.
