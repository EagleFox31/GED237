import { test, expect } from '@playwright/test';
import { taskBadgeLabel } from '../../lib/taskCount';

test.describe('pastille des tâches', () => {
  test('rien à 0 ou sur une valeur invalide', () => {
    expect(taskBadgeLabel(0)).toBe('');
    expect(taskBadgeLabel(-2)).toBe('');
    expect(taskBadgeLabel(Number.NaN)).toBe('');
  });
  test('nombre exact jusqu’à 99, puis « 99+ »', () => {
    expect(taskBadgeLabel(1)).toBe('1');
    expect(taskBadgeLabel(99)).toBe('99');
    expect(taskBadgeLabel(100)).toBe('99+');
  });
});
