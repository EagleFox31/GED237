import { test, expect } from '@playwright/test';
import { canEmptyTrash, identicalAfterRestore, isGoneFromTrash, isPurgeProtected, isRestoreReservedToAdmin } from '../../lib/trashRules';

test.describe('Corbeille : actions définitives possibles', () => {
  test('signé et archivé sont protégés, les autres statuts non', () => {
    expect(isPurgeProtected({ status: 'signed' })).toBe(true);
    expect(isPurgeProtected({ status: 'archived' })).toBe(true);
    expect(isPurgeProtected({ status: 'draft' })).toBe(false);
    expect(isPurgeProtected({ status: 'validated' })).toBe(false);
    for (const status of ['in_review', 'rejected', 'returned'] as const) {
      expect(isPurgeProtected({ status }), status).toBe(false);
    }
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

test.describe('Corbeille : document disparu', () => {
  test('seul un 404 retire la ligne', () => {
    expect(isGoneFromTrash({ status: 404 })).toBe(true);
    expect(isGoneFromTrash({ status: 403 })).toBe(false);
    expect(isGoneFromTrash({ status: 500 })).toBe(false);
    expect(isGoneFromTrash(new Error('réseau'))).toBe(false);
    expect(isGoneFromTrash(null)).toBe(false);
  });

  test('restaurer : réservé à l’administrateur si quelqu’un d’autre a retiré le document', () => {
    expect(isRestoreReservedToAdmin({ deleted_by: 'moi' }, 'moi', false)).toBe(false);
    expect(isRestoreReservedToAdmin({ deleted_by: 'admin' }, 'moi', false)).toBe(true);
    expect(isRestoreReservedToAdmin({ deleted_by: 'admin' }, 'moi', true)).toBe(false);
    expect(isRestoreReservedToAdmin({ deleted_by: null }, 'moi', false)).toBe(false);
  });
});

test.describe('Corbeille : restauration d’un doublon', () => {
  test('un document identique lisible est signalé, sinon rien', () => {
    const twin = { id: 'doc-1', title: 'Arrêté 12' };
    expect(identicalAfterRestore({ message: 'Document restaure.', identical_document: twin })).toEqual(twin);
    expect(identicalAfterRestore({ message: 'Document restaure.', identical_document: null })).toBeNull();
    // Serveur plus ancien, sans le champ.
    expect(identicalAfterRestore({ message: 'Document restaure.' })).toBeNull();
    for (const body of [null, undefined, true, {}, { identical_document: { id: '', title: 'x' } }, { identical_document: { id: 'doc-1' } }]) {
      expect(identicalAfterRestore(body), JSON.stringify(body)).toBeNull();
    }
  });
});
