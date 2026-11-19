import { test, expect } from '@playwright/test';
import { TO_FIX_PROFILES, TO_FIX_ROUTE, toFixLabel } from '../../lib/toFix';

// Spec pur : exécuté par `npm run test:unit`.
test.describe('Bandeau « à corriger » de l\'accueil', () => {
  test('additionne rejetés et renvoyés, au singulier comme au pluriel', () => {
    expect(toFixLabel({ rejected: 1, returned: 0 })).toBe('1 document à corriger');
    expect(toFixLabel({ rejected: 2, returned: 1 })).toBe('3 documents à corriger');
    expect(toFixLabel({ returned: 4 })).toBe('4 documents à corriger');
  });
  test('ne montre rien quand il n\'y a rien à corriger ou pas de compteur', () => {
    expect(toFixLabel({ rejected: 0, returned: 0 })).toBeNull();
    expect(toFixLabel(null)).toBeNull();
    expect(toFixLabel(undefined)).toBeNull();
  });
  test('ouvre la liste filtrée sur « À corriger », pour les profils qui déposent', () => {
    expect(TO_FIX_ROUTE).toBe('/documents?status=to_fix');
    expect([...TO_FIX_PROFILES].sort()).toEqual(['collab', 'manager', 'tenant', 'unit']);
  });
});
