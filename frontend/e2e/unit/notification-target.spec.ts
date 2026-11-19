import { test, expect } from '@playwright/test';
import { notificationTarget } from '../../lib/notificationTarget';

test.describe('notificationTarget', () => {
  test('document lié → ouverture du document', () => {
    expect(notificationTarget({ document_id: 'abc-123' })).toBe('/documents?open=abc-123');
  });
  test('identifiant encodé', () => {
    expect(notificationTarget({ document_id: 'a b&c' })).toBe('/documents?open=a%20b%26c');
  });
  test('sans document → tâches', () => {
    expect(notificationTarget({})).toBe('/tasks');
    expect(notificationTarget(null)).toBe('/tasks');
    expect(notificationTarget(undefined)).toBe('/tasks');
    expect(notificationTarget({ document_id: '' })).toBe('/tasks');
    expect(notificationTarget({ document_id: 42 })).toBe('/tasks');
  });
});
