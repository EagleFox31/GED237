// Spec pur (npm run test:unit) : confirmations vertes après une action clé.
import { test, expect } from '@playwright/test';
import { SUCCESS_NOTICE_MAX, appendNotice, decisionNotice } from '../../lib/successNotice';

test.describe('Confirmations après une action (lib/successNotice)', () => {
  test('un même message déjà affiché n est pas répété', () => {
    const list = [{ id: 1, message: 'Document visé.' }];
    expect(appendNotice(list, { id: 2, message: 'Document visé.' })).toBe(list);
    expect(appendNotice(list, { id: 2, message: 'Document signé.' }).map((n) => n.id)).toEqual([1, 2]);
  });

  test('la liste reste bornée : la plus ancienne confirmation laisse sa place', () => {
    let list: { id: number; message: string }[] = [];
    for (let id = 1; id <= SUCCESS_NOTICE_MAX + 2; id += 1) list = appendNotice(list, { id, message: `m${id}` });
    expect(list).toHaveLength(SUCCESS_NOTICE_MAX);
    expect(list[list.length - 1]?.id).toBe(SUCCESS_NOTICE_MAX + 2);
  });

  test('le texte suit la décision et l action attendue', () => {
    expect(decisionNotice('accept', 'visa')).toBe('Document visé.');
    expect(decisionNotice('accept', 'approval')).toBe('Document approuvé.');
    expect(decisionNotice('accept', 'final_signature')).toBe('Document signé.');
    expect(decisionNotice('accept', 'read_ack')).toBe('Lecture confirmée.');
    expect(decisionNotice('accept')).toBe('Document validé.');
    expect(decisionNotice('reject', 'visa')).toContain('motif');
  });
});
