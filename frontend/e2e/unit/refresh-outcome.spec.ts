import { test, expect } from '@playwright/test';
import { refreshOutcome } from '../../services/http/refreshOutcome';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Renouvellement de session : garder ou déconnecter', () => {
  test('sans réponse (coupure réseau, délai) : la session est gardée', () => {
    expect(refreshOutcome(null)).toBe('transient');
  });
  test('jeton refusé (401, 403) : déconnexion', () => {
    expect(refreshOutcome(401)).toBe('expired');
    expect(refreshOutcome(403)).toBe('expired');
  });
  test('erreur serveur ou trop de demandes : la session est gardée', () => {
    for (const status of [429, 500, 502, 503, 504]) expect(refreshOutcome(status)).toBe('transient');
  });
  test('succès : nouveaux jetons', () => {
    expect(refreshOutcome(200)).toBe('renewed');
  });
});
