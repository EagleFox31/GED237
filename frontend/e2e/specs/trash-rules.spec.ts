import { test, expect } from '@playwright/test';
import { canEmptyTrash, isPurgeProtected } from '../../lib/trashRules';

test.describe('Corbeille : actions définitives possibles', () => {
  test('signé et archivé sont protégés, les autres statuts non', () => {
    expect(isPurgeProtected({ status: 'signed' })).toBe(true);
    expect(isPurgeProtected({ status: 'archived' })).toBe(true);
    expect(isPurgeProtected({ status: 'draft' })).toBe(false);
    expect(isPurgeProtected({ status: 'validated' })).toBe(false);
  });

  test('« Vider » masqué quand il ne reste que des documents protégés', () => {
    expect(canEmptyTrash([{ status: 'signed' }, { status: 'archived' }], 2)).toBe(false);
    expect(canEmptyTrash([{ status: 'signed' }, { status: 'draft' }], 2)).toBe(true);
    expect(canEmptyTrash([], 0)).toBe(false);
  });

  test('« Vider » gardé tant que toutes les pages ne sont pas chargées', () => {
    expect(canEmptyTrash([{ status: 'signed' }], 51)).toBe(true);
  });
});
