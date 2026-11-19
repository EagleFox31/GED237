// Spec pur (npm run test:unit) : badge règle désactivée du simulateur (Tâche 6).
import { test, expect } from '@playwright/test';
import {
  INACTIVE_RULE_BADGE,
  inactiveRuleBadgeText,
} from '../../lib/simulatorInactiveBadge';

test.describe('Badge règle désactivée (SimulatorTab)', () => {
  test('affiche le badge discret uniquement lorsque rule_is_active vaut false', () => {
    expect(inactiveRuleBadgeText(false)).toBe(INACTIVE_RULE_BADGE);
  });

  test('n affiche aucun badge lorsque rule_is_active vaut true ou est absent', () => {
    expect(inactiveRuleBadgeText(true)).toBeNull();
    expect(inactiveRuleBadgeText(undefined)).toBeNull();
    expect(inactiveRuleBadgeText(null)).toBeNull();
  });
});
