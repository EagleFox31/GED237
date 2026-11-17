import { test, expect } from '@playwright/test';
import { accountKeyOf } from '../../services/http/accountKey';

test.describe('Clé du compte pour la reprise de page', () => {
  test('deux comptes de même rôle ont des clés différentes', () => {
    const a = accountKeyOf({ matricule: 'MINFI002', tenantId: 't1' });
    const b = accountKeyOf({ matricule: 'MINESUP001', tenantId: 't2' });
    expect(a).toBeTruthy();
    expect(a).not.toBe(b);
  });

  test('même matricule dans deux ministères : clés différentes', () => {
    expect(accountKeyOf({ matricule: 'U1', tenantId: 't1' })).not.toBe(accountKeyOf({ matricule: 'U1', tenantId: 't2' }));
  });

  test('même compte : clé stable', () => {
    expect(accountKeyOf({ matricule: 'MINFI002', tenantId: 't1' })).toBe(accountKeyOf({ matricule: 'MINFI002', tenantId: 't1' }));
  });

  for (const profile of [undefined, null, {}, { tenantId: 't1' }, { matricule: '' }]) {
    test(`sans matricule : pas de clé (${JSON.stringify(profile)})`, () => {
      expect(accountKeyOf(profile)).toBeUndefined();
    });
  }
});
